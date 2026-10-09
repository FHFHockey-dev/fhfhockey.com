import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { auditNativeGoalLedger } from "../lib/projections/nativeGoalLedgerAudit";
import { evaluateRetainedResearchGoals } from "../lib/projections/researchGoalBaseline";
import { projectionInputHash } from "../lib/projections/inputCapture";
import { researchGoalAppearanceManifestSchema } from "../lib/projections/researchGoalAppearanceManifest";

const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
function localJson(path: string) {
  if (statSync(path).size > 32 * 1024 * 1024) throw new Error("Retained input exceeds 32 MiB");
  const bytes = readFileSync(path);
  return { path, sha256: digest(new Uint8Array(bytes)), value: JSON.parse(bytes.toString("utf8")) };
}

/** Offline GOALS research only: no DB client, acquisition, forecast freeze or issuance. */
export function runResearchGoalBaseline(args: string[]) {
  const usage = "Use --history FILE --revisions DIR --attribute-audit FILE --supplemental DIR --output NEW_FILE [--appearance-manifest FILE]";
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    if (!["--history", "--revisions", "--attribute-audit", "--supplemental", "--output", "--appearance-manifest"].includes(args[index]) || !args[index + 1] || options.has(args[index])) throw new Error(usage);
    options.set(args[index], resolve(args[index + 1]));
  }
  if (!["--history", "--revisions", "--attribute-audit", "--supplemental", "--output"].every(key => options.has(key))) throw new Error(usage);
  const history = localJson(options.get("--history")!), prior = localJson(options.get("--attribute-audit")!);
  const manifest = localJson(resolve(options.get("--supplemental")!, "manifest.json"));
  if (manifest.value.version !== "official-supplemental-observations-v1" || manifest.value.acceptanceEligible !== false
    || projectionInputHash(manifest.value.prospectiveScope) !== projectionInputHash(history.value.scope)
    || !Array.isArray(manifest.value.games)) throw new Error("Supplemental manifest scope mismatch");
  const inputs = [history, prior, manifest];
  const readRevision = (directory: string, id: string) => {
    if (typeof id !== "string" || !/^[A-Za-z0-9-]{1,128}$/.test(id)) throw new Error("Unsafe retained revision filename");
    const file = localJson(resolve(directory, `${id}.json`));
    if (file.value.revisionId !== id) throw new Error("Retained revision filename/identity mismatch");
    inputs.push(file); return file.value;
  };
  const revisions = [...history.value.retainedHistorySources, ...history.value.scheduleSources]
    .map(row => readRevision(options.get("--revisions")!, row.revisionId));
  const root = resolve(__dirname, "../..");
  const paths = ["web/lib/projections/researchGoalBaseline.ts", "web/scripts/evaluate-research-goal-baseline.ts",
    "web/lib/projections/researchGoalAppearanceManifest.ts",
    "web/lib/projections/nativeGoalLedgerAudit.ts", "web/lib/supabase/Upserts/nhlStrengthState.ts",
    "web/lib/forecast-diagnostics/pairedInputs.ts", "web/lib/projections/inputCapture.ts"];
  const sourceHashes = Object.fromEntries(paths.map(path => [path, digest(new Uint8Array(readFileSync(resolve(root, path))))]));
  const ledger = auditNativeGoalLedger({ historyBundle: history.value, revisions, attributeAudit: prior.value,
    parserSourceHash: sourceHashes["web/lib/supabase/Upserts/nhlStrengthState.ts"] });
  if (new Set(manifest.value.games.map((row: any) => row.gameId)).size !== manifest.value.games.length
    || manifest.value.games.some((row: any) => !ledger.games.some(game => game.gameId === row.gameId))) throw new Error("Supplemental game population mismatch");
  const boxes = manifest.value.games.filter((row: any) => row.boxscoreRevisionId != null)
    .map((row: any) => {
      const source = readRevision(options.get("--supplemental")!, row.boxscoreRevisionId);
      if (source.gameId !== row.gameId) throw new Error("Boxscore revision differs from manifest game identity");
      return source;
    });
  let appearanceEvidence: { manifest: unknown; revisions: unknown[] } | undefined;
  if (options.has("--appearance-manifest")) {
    const appearanceManifest = localJson(options.get("--appearance-manifest")!); inputs.push(appearanceManifest);
    const population = researchGoalAppearanceManifestSchema.parse(appearanceManifest.value);
    const refs = population.players.flatMap(player => [player.gameLogRevisionId, ...player.indexRevisionIds]);
    const directory = resolve(options.get("--appearance-manifest")!, "..");
    appearanceEvidence = { manifest: appearanceManifest.value, revisions: refs.map((ref: string) => readRevision(directory, ref)) };
  }
  const result = evaluateRetainedResearchGoals({ ledger, historyBundle: history.value, boxscoreRevisions: boxes, appearanceEvidence });
  for (const input of inputs) if (digest(new Uint8Array(readFileSync(input.path))) !== input.sha256) throw new Error("Retained input changed during evaluation");
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const receipt = { version: "research-goals-local-receipt-v1", codeCommit: git("rev-parse", "HEAD"), sourceDirty: Boolean(git("status", "--porcelain")),
    nodeVersion: process.version, sourceHashes, lockfileHash: digest(new Uint8Array(readFileSync(resolve(root, "web/package-lock.json")))),
    inputFiles: inputs.map(({ path, sha256 }) => ({ path, sha256 })), ledgerResultHash: projectionInputHash(ledger), resultHash: projectionInputHash(result), result };
  writeFileSync(options.get("--output")!, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  return receipt;
}

if (require.main === module) {
  try {
    const receipt = runResearchGoalBaseline(process.argv.slice(2));
    console.log(JSON.stringify({ codeCommit: receipt.codeCommit, resultHash: receipt.resultHash, category: "GOALS", acceptanceEligible: false,
      supportedPlayerSeasonMeans: receipt.result.playerSeasonResearch?.supportedPlayerCount ?? 0,
      retainedProviderCohortObservations: receipt.result.playerSeasonResearch?.retainedProviderCohortObservationCount ?? 0,
      additionalGameIds: receipt.result.playerSeasonResearch?.additionalGameIds ?? [],
      historyTargetAt: receipt.result.playerSeasonResearch?.historyTargetAt ?? null,
      completePlayerSeasonAtFeatureCutoff: receipt.result.playerSeasonResearch?.completePlayerSeasonAtFeatureCutoff ?? false,
      teams: receipt.result.teams.map(team => ({ teamId: team.teamId, games: team.games.length, players: team.players.length,
        supportedPlayerSeasonMeans: (receipt.result.playerSeasonResearch?.players ?? team.players)
          .filter(player => team.players.some(member => member.playerId === player.playerId) && player.conditionalGoalsPerPlayingAppearance !== null).length,
        retainedProviderCohortObservations: receipt.result.playerSeasonResearch?.players
          .filter(player => team.players.some(member => member.playerId === player.playerId) && player.providerCohortObservation.goalsPerPlayingAppearance !== null).length ?? 0,
        observedAccounting: team.historicalAccounting })) }));
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
