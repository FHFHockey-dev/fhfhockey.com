import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { projectionInputHash } from "../lib/projections/inputCapture";
import { auditNativeGoalLedger } from "../lib/projections/nativeGoalLedgerAudit";
import { evaluateRetainedResearchGoals } from "../lib/projections/researchGoalBaseline";
import { evaluateResearchGoalChronologicalFolds, forecastResearchGameGoals, latestObservedResearchRoster,
  researchGoalHistoryFromReplay, researchRosterFromOfficialRevision } from "../lib/projections/researchGameGoals";

const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
function readJson(path: string) {
  if (statSync(path).size > 32 * 1024 * 1024) throw new Error("Research input exceeds 32 MiB");
  const bytes = readFileSync(path);
  return { path, sha256: digest(new Uint8Array(bytes)), value: JSON.parse(bytes.toString("utf8")) };
}

/** Local reads and new artifact writes only. Replays original raw evidence before modeling. */
export function runResearchGameGoals(args: string[]) {
  const options = new Map<string, string>();
  const names = ["--baseline", "--feature-cutoff", "--ability-cutoff", "--as-of", "--output", "--roster-manifest", "--roster-basis", "--p-game-played"];
  const usage = "Use --baseline RECEIPT --feature-cutoff ISO --as-of ISO --output NEW_FILE and either --roster-manifest FILE or --roster-basis latest_observed_box_population; optional --ability-cutoff ISO --p-game-played PROBABILITY";
  for (let index = 0; index < args.length; index += 2) {
    if (!names.includes(args[index]) || !args[index + 1] || options.has(args[index])) throw new Error(usage);
    options.set(args[index], args[index + 1]);
  }
  if (!["--baseline", "--feature-cutoff", "--as-of", "--output"].every(key => options.has(key))
    || options.has("--roster-manifest") === options.has("--roster-basis")) throw new Error(usage);
  if (options.has("--roster-basis") && options.get("--roster-basis") !== "latest_observed_box_population") throw new Error(usage);
  const root = resolve(__dirname, "../.."), prior = readJson(resolve(options.get("--baseline")!));
  const receipt = prior.value;
  if (receipt.version !== "research-goals-local-receipt-v1" || receipt.sourceDirty !== false || !Array.isArray(receipt.inputFiles)
    || !receipt.sourceHashes || receipt.resultHash !== projectionInputHash(receipt.result)) throw new Error("Unverified retained baseline receipt");
  for (const [file, hash] of Object.entries(receipt.sourceHashes)) {
    if (!/^web\/[A-Za-z0-9/_.-]+\.ts$/.test(file) || file.split("/").includes("..")
      || digest(new Uint8Array(readFileSync(resolve(root, file)))) !== hash) throw new Error("Baseline replay source differs from retained version");
  }
  const inputs = receipt.inputFiles.map((row: any) => {
    const file = readJson(row.path);
    if (file.sha256 !== row.sha256) throw new Error("Original research input hash changed");
    return file;
  });
  const one = (predicate: (value: any) => boolean) => {
    const selected = inputs.filter((file: any) => predicate(file.value));
    if (selected.length !== 1) throw new Error("Missing or ambiguous retained replay input");
    return selected[0].value;
  };
  const history = one(value => Array.isArray(value.retainedHistorySources) && Array.isArray(value.scheduleSources));
  const attributeAudit = one(value => value.version === "retained-goal-attribute-audit-v1");
  const supplemental = one(value => value.version === "official-supplemental-observations-v1");
  if (supplemental.acceptanceEligible !== false || projectionInputHash(supplemental.prospectiveScope) !== projectionInputHash(history.scope))
    throw new Error("Supplemental replay scope differs");
  const revision = (id: string) => one(value => value.revisionId === id);
  const revisions = [...history.retainedHistorySources, ...history.scheduleSources].map(row => revision(row.revisionId));
  const ledger = auditNativeGoalLedger({ historyBundle: history, revisions, attributeAudit,
    parserSourceHash: receipt.sourceHashes["web/lib/supabase/Upserts/nhlStrengthState.ts"] });
  if (projectionInputHash(ledger) !== receipt.ledgerResultHash) throw new Error("Ledger replay differs from the retained artifact");
  const boxes = supplemental.games.map((game: any) => {
    const source = revision(game.boxscoreRevisionId);
    if (source.gameId !== game.gameId) throw new Error("Supplemental BOX game differs");
    return source;
  });
  const appearanceManifests = inputs.filter((file: any) => file.value.version === "research-player-season-appearance-manifest-v1");
  if (appearanceManifests.length > 1) throw new Error("Ambiguous appearance manifest in baseline receipt");
  const manifest = appearanceManifests[0]?.value;
  const evaluation = evaluateRetainedResearchGoals({ ledger, historyBundle: history, boxscoreRevisions: boxes,
    appearanceEvidence: manifest ? { manifest, revisions: manifest.players.flatMap((player: any) => [player.gameLogRevisionId, ...player.indexRevisionIds]).map(revision) } : undefined });
  if (projectionInputHash(evaluation) !== receipt.resultHash) throw new Error("Retained baseline raw replay differs from receipt");
  const goalHistory = researchGoalHistoryFromReplay({ evaluation, ledger, boxscoreRevisions: boxes });
  const featureCutoffAt = options.get("--feature-cutoff")!, asOf = options.get("--as-of")!;
  if (Date.parse(asOf) > Date.now()) throw new Error("Evaluation asOf cannot claim future generation");
  const pGamePlayed = options.has("--p-game-played") ? Number(options.get("--p-game-played")) : null;
  const scope = { gameId: history.scope.gameId, seasonId: history.scope.seasonId, phase: 2 as const,
    homeTeamId: history.scope.homeTeamId, awayTeamId: history.scope.awayTeamId, startAt: history.scope.startAt,
    abilityCutoffAt: options.get("--ability-cutoff") ?? featureCutoffAt, featureCutoffAt, asOf, pGamePlayed };
  const teamIds = [scope.homeTeamId, scope.awayTeamId];
  const rosterInputs: ReturnType<typeof readJson>[] = [];
  const rosters = options.has("--roster-manifest") ? (() => {
    const file = readJson(resolve(options.get("--roster-manifest")!)); rosterInputs.push(file);
    const value = file.value;
    if (value.version !== "research-current-roster-snapshot-v1" || value.seasonId !== scope.seasonId || !Array.isArray(value.teams)
      || value.teams.length !== 2 || new Set(value.teams.map((team: any) => team.teamId)).size !== 2
      || value.teams.some((team: any) => !teamIds.includes(team.teamId)) || Date.parse(value.collectedAt) >= Date.parse(featureCutoffAt))
      throw new Error("Public roster manifest population, season or cutoff differs");
    return value.teams.map((team: any) => {
      if (!/^[A-Za-z0-9-]{1,128}$/.test(team.revisionId)) throw new Error("Unsafe roster revision ID");
      const source = readJson(resolve(file.path, "..", `${team.revisionId}.json`)); rosterInputs.push(source);
      const identityBox = boxes.find((box: any) => box.payload.homeTeam.id === team.teamId || box.payload.awayTeam.id === team.teamId);
      if (!identityBox) throw new Error("No independently replayed BOX team identity for public roster");
      return researchRosterFromOfficialRevision(source.value, { ...team, seasonId: scope.seasonId, featureCutoffAt }, identityBox);
    });
  })() : teamIds.map(teamId => latestObservedResearchRoster(goalHistory.filter(game => game.teamId === teamId)));
  const forecast = forecastResearchGameGoals({ scope, history: goalHistory, rosters });
  const diagnostics = evaluateResearchGoalChronologicalFolds({ history: goalHistory, focalTeamIds: teamIds });
  const replayedBlend = forecast.models.find(model => model.model === "opponent_blended")!.teams;
  const baselineBlend = evaluation.comparison.sameInputTeamGoalBaseline;
  if (baselineBlend.homeMean === null || baselineBlend.awayMean === null
    || Math.abs(replayedBlend[0].goalMeanGivenGamePlayed - baselineBlend.homeMean) > 1e-10
    || Math.abs(replayedBlend[1].goalMeanGivenGamePlayed - baselineBlend.awayMean) > 1e-10) throw new Error("Disjoint-cell opponent blend differs from the same-input established baseline");
  const allInputs = [prior, ...inputs, ...rosterInputs];
  for (const input of allInputs) if (digest(new Uint8Array(readFileSync(input.path))) !== input.sha256) throw new Error("Retained file changed during evaluation");
  const sourcePaths = ["web/lib/projections/researchGameGoals.ts", "web/scripts/evaluate-research-game-goals.ts"];
  const sourceHashes = { ...receipt.sourceHashes, ...Object.fromEntries(sourcePaths.map(path => [path, digest(new Uint8Array(readFileSync(resolve(root, path))))])) };
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const result = { forecast, diagnostics, baselineReplayResultHash: receipt.resultHash,
    sameInputEstablishedTeamBlendReconciled: true, retainedTeamGameObservations: goalHistory.length, newCollection: false };
  const output = { version: "research-game-goals-local-receipt-v1", codeCommit: git("rev-parse", "HEAD"), sourceDirty: Boolean(git("status", "--porcelain")),
    generatedAt: new Date().toISOString(), nodeVersion: process.version, sourceHashes, lockfileHash: digest(new Uint8Array(readFileSync(resolve(root, "web/package-lock.json")))),
    inputFiles: allInputs.map(({ path, sha256 }) => ({ path, sha256 })), resultHash: projectionInputHash(result), result };
  writeFileSync(resolve(options.get("--output")!), JSON.stringify(output, null, 2) + "\n", { flag: "wx" });
  return output;
}

if (require.main === module) {
  globalThis.fetch = async () => { throw new Error("Network disabled: this research runner is offline"); };
  try {
    const receipt = runResearchGameGoals(process.argv.slice(2));
    console.log(JSON.stringify({ codeCommit: receipt.codeCommit, resultHash: receipt.resultHash, acceptanceEligible: false,
      models: receipt.result.forecast.models.map(model => ({ model: model.model, teams: model.teams.map(team => ({ teamId: team.teamId,
        rosterBasis: team.rosterBasis, rosterPlayers: team.players.length, goalsGivenPlayed: team.goalMeanGivenGamePlayed,
        residualGivenPlayed: team.residual.goalMeanGivenGamePlayed, cellSummary: team.cellSummary, physicalAppearances: team.expectedPositiveToiAppearances,
        unassignedPhysicalAppearances: team.residual.expectedPositiveToiAppearances })) })),
      diagnostics: receipt.result.diagnostics.sameFoldSummaries, historicalForecastBacktestEligible: false }));
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
