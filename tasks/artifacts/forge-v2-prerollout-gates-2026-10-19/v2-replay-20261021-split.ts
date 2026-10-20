/** Offline engineering replay of the v2 daily driver at 2026-10-21 clocks (flags all off), updated for patch 06 (A-13..A-18
 * gates) and patch 07 (A-14: one skater and one goalie materialization, one issuance). Derived from
 * ../forge-target-scope-fix-2026-10-19/v2-replay-20261021-publishdry.ts, which stays unchanged beside its receipts.
 * Two phases, both recorded in the receipt:
 *  - A: the means plan's true status. The retained cache lacks some goalie summaries, so the plan is pending and inputs-v2 must
 *    stop with `means_plan_incomplete` (the A-17 gate).
 *  - B: the same means with the plan marked complete (a disclosed stand-in), run through inputs-v2 (two requests), two simulated
 *    closures, outputs-v2 (two proofs, the pinned standing-approval ref), a synthetic review, cadence validation and a publish dry run.
 * Stand-ins, each disclosed in the receipt:
 *  - universe: the retained 69-player 2026-10-16 scope as a universe document (no Yahoo read);
 *  - capture: retained club-roster and history-week bodies re-stamped to the run clock; future weeks re-sliced from the
 *    retained weekly schedules (as the v1 dry-run did);
 *  - means: the means stage planned and assembled at run clocks from retained originals only, so history stops at
 *    2026-10-12 (`historyBefore`) and Fiala's prior boxscores come from their retained original spans.
 * No network (fetch throws), no database (stores refuse), new private output directory only.
 * Usage (from web/): NODE_PATH=. npx ts-node --transpile-only -O '{"module":"commonjs","moduleResolution":"node"}' \
 *   ../tasks/artifacts/forge-v2-prerollout-gates-2026-10-19/v2-replay-20261021-split.ts PRIVATE_ROOT NEW_OUTPUT_DIR */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dailyCapturePlan, runForgeDaily } from "../../../web/scripts/forge-daily";
import { validateCadenceCommand } from "../../../web/scripts/native-baseline-cadence";
import { publishObservedNativeBaselineCadence } from "../../../web/lib/player-forecasts/nativeBaselineCadence";
import { prepareNativeInputMaterialization } from "../../../web/lib/player-forecasts/nativeInputMaterialization";
import { applyNativeDailyReview } from "../../../web/lib/player-forecasts/nativeDailyPipeline";
import { validateNativeBaselinePublication } from "../../../web/lib/player-forecasts/nativeBaselinePublication";
import { assembleNativeDailyMeans, planNativeMeansCapture } from "../../../web/lib/player-forecasts/nativeDailyMeansCapture";
import { playerForecastSourcePayloadHash as hash } from "../../../web/lib/player-forecasts/sourceSnapshot";
import { NATIVE_DAILY_APPROVED_METHODS } from "../../../web/lib/player-forecasts/nativeDailyPipelineV2";

const P = process.argv[2], out = process.argv[3];
if (!P || !out) throw new Error("usage: v2-replay-20261021-split.ts PRIVATE_ROOT NEW_OUTPUT_DIR");
globalThis.fetch = (() => { throw new Error("network disabled in replay"); }) as any;
mkdirSync(out, { mode: 0o700 });
const sha = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const write = (name: string, value: unknown) => { const bytes = JSON.stringify(value); writeFileSync(join(out, name), bytes, { flag: "wx", mode: 0o600 }); return [join(out, name), sha(bytes)]; };
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const DATE = "2026-10-21", CAPTURED = "2026-10-21T10:50:00.000Z", MEANS_AS_OF = "2026-10-21T10:45:00.000Z", MEANS_CUTOFF = "2026-10-21T10:55:00.000Z";
const CLOSED = "2026-10-21T12:05:00.000Z", ISSUED = "2026-10-21T12:10:00.000Z", REVIEWED = "2026-10-21T12:20:00.000Z";
const retainedPath = join(P, "daily-acquisition-contract-20261016-v1/retained-materialization-request.json"), retained = read(retainedPath);
const seasonId = retained.acquisition.seasonId, log: any = { date: DATE, flags: "all_off", standIns: [] as string[] };

// Universe stand-in: the retained scope; owned = the 2026-10-16 owned native scope.
const owned = new Set(read(join(P, "native-assembly-scope-v2.json")).roster.map((row: any) => row.playerId));
const universe = { version: "forge-daily-yahoo-universe-v1", date: DATE, seasonId, status: "complete", ownedComplete: true,
  counts: { owned: owned.size }, players: retained.acquisition.roster.map((row: any) => ({ playerId: row.playerId, nhlPlayerId: row.nhlPlayerId, teamId: row.teamId,
    class: row.playerClass, universe: owned.has(row.playerId) ? "owned" : "candidate", rosterRevision: row.rosterRevision, yahooPlayerKey: row.yahooPlayerKey ?? `replay:${row.playerId}` })),
  unmapped: [], ambiguous: [], membershipUnresolved: [], excluded: [], change: null, injury: { evidence: [] } };
log.standIns.push("universe: retained 2026-10-16 scope (69 players), no Yahoo read");

// Capture stand-in: v1 capture plan for the day, retained bodies re-stamped, future weeks re-sliced.
const originals = new Map<string, string>(retained.parents.filter((parent: any) => parent.original).map((parent: any) => [parent.original.url, parent.original.rawBody]));
const futureGames = new Map<number, any>();
for (const [url, body] of originals) if (/\/v1\/schedule\//.test(url) && url.slice(-10) >= "2026-10-13")
  for (const day of JSON.parse(body).gameWeek) for (const game of day.games) futureGames.set(game.id, { ...game, date: day.date });
const receipt = (url: string, rawBody: string, capturedAt = CAPTURED) => ({ url, capturedAt, bodySha256: sha(rawBody), rawBody });
const captureReceipts = dailyCapturePlan(retained, DATE, 8).map(url => {
  if (originals.has(url)) return receipt(url, originals.get(url)!);
  const start = url.slice(-10), days = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(`${start}T12:00:00Z`) + i * 86400000).toISOString().slice(0, 10));
  return receipt(url, JSON.stringify({ gameWeek: days.map(date => ({ date, games: [...futureGames.values()].filter(game => game.date === date).map(({ date: _d, ...game }) => game) })) }));
});
log.standIns.push(`capture: ${captureReceipts.length} receipts (club rosters and history weeks re-stamped to ${CAPTURED}; future weeks re-sliced)`);

// Means stand-in: retained originals as the cache; history cut at 2026-10-13 New York.
const cache = [...read(join(P, "native-capture-v2/receipts.json")).receipts, ...read(join(P, "candidate-participation-capture-v1/receipts.json")).receipts,
  ...read(join(P, "candidate-conditional-capture-v1/receipts.json")).receipts, ...read(join(P, "fiala-prior-landings-v1/receipts.json")).receipts,
  ...["goalie-shutout-hart-v1", "goalie-shutout-oettinger-v1"].flatMap(dir => read(join(P, dir, "observation.json"))[0].payload.shutoutSummary.receipts),
  ...retained.parents.filter((parent: any) => parent.original && /\/v1\/schedule\/2026-(09-29|10-06)$/.test(parent.original.url))
    .map((parent: any) => ({ url: parent.original.url, capturedAt: parent.capturedAt, bodySha256: parent.original.bodySha256, rawBody: parent.original.rawBody }))];
const fiala = retained.additionalNativeObservations.find((value: any) => value.payload.policyVersion === "native-prior-appearance-skater-rates-v1");
for (const appearance of fiala.payload.appearances) {
  const raw = appearance.finalBoxscore.rawRow, { rawBody, bodySha256 } = raw.retainedOriginal;
  cache.push({ url: `https://api-web.nhle.com/v1/gamecenter/${raw.game_id}/boxscore`, capturedAt: new Date(raw.fetched_at).toISOString(), bodySha256, rawBody });
}
const universeRows = universe.players.map((player: any) => ({ playerId: player.playerId, nhlPlayerId: player.nhlPlayerId, teamId: player.teamId,
  playerClass: player.class, rosterRevision: player.rosterRevision, yahooPlayerKey: player.yahooPlayerKey }));
const priorSeasonGames = { [fiala.payload.playerId]: fiala.payload.appearances.map((appearance: any) => appearance.gameId) };
const plan = planNativeMeansCapture({ seasonId, asOf: MEANS_AS_OF, historyBefore: "2026-10-13T03:59:59.999Z", scheduleAnchor: "2026-09-29",
  universe: universeRows, cache, priorSeasonGames });
const means = assembleNativeDailyMeans({ seasonId, cutoffAt: MEANS_CUTOFF, universe: universeRows, games: plan.assembly.games, playerGames: plan.assembly.playerGames,
  summaries: plan.assembly.summaries, priorGames: plan.assembly.priorGames, notes: plan.assembly.notes, receipts: cache }, new Date(MEANS_CUTOFF));
// Counts only: the receipt carries no player identities, so it can be quoted.
log.means = { planStatus: plan.status, pendingRequests: plan.requests.reduce((counts: Record<string, number>, value) => ({ ...counts, [value.kind]: (counts[value.kind] ?? 0) + 1 }), {}),
  selected: means.nativeSelection.length,
  byPolicy: means.nativeSelection.reduce((counts: Record<string, number>, value) => ({ ...counts, [value.policyVersion]: (counts[value.policyVersion] ?? 0) + 1 }), {}),
  withoutSelection: means.coverage.filter(row => !row.selectedPolicies.length).length, stats: means.stats };
log.standIns.push("means: history through 2026-10-12 only; Oct 13-20 schedule weeks, boxscores, landings and goalie summaries need live capture");
// means.json as `forge-daily means assemble` now writes it (06): the plan's status travels with the means.
const meansPlan = { status: plan.status, inputHash: plan.inputHash, asOf: plan.asOf, pendingRequests: plan.requests.length };

const inputsArgs = (dir: string, meansPath: string, meansSha: string, universePath: string, universeSha: string, capturePath: string, captureSha: string) =>
  ["inputs-v2", "--universe", universePath, "--universe-sha256", universeSha, "--means", meansPath, "--means-sha256", meansSha,
    "--capture", capturePath, "--capture-sha256", captureSha, "--retained", retainedPath, "--retained-sha256", sha(readFileSync(retainedPath)),
    "--date", DATE, "--out", join(out, dir)];
const proofSummary = (proof: any) => ({ rows: proof.rows.length + 2, manifestItems: proof.manifest.expectedItems,
  participationInputs: proof.rows.filter((row: any) => row.dataset_key === "native-participation-input-v1").reduce((sum: number, row: any) => sum + row.payload.inputs.length, 0),
  nativeInputs: proof.rows.filter((row: any) => row.entity_kind === "player").length });

(async () => {
  const [universePath, universeSha] = write("universe.json", universe), [capturePath, captureSha] = write("capture.json", { receipts: captureReceipts, failures: [] });
  // Phase A: the true plan status must stop inputs-v2 before anything is bound.
  const [truePath, trueSha] = write("means-true-plan.json", { ...means, plan: meansPlan });
  try { await runForgeDaily(inputsArgs("inputs-true-plan", truePath, trueSha, universePath, universeSha, capturePath, captureSha)); log.phaseA = { stopped: false }; }
  catch (error) { log.phaseA = { stopped: true, reason: (error as Error).message, planStatus: meansPlan.status, pendingRequests: meansPlan.pendingRequests }; }
  // Phase B: the plan marked complete (stand-in), then the whole split pipeline.
  log.standIns.push(`phase B: means plan marked complete (true status ${meansPlan.status}, ${meansPlan.pendingRequests} pending requests)`);
  const [meansPath, meansSha] = write("means.json", { ...means, plan: { ...meansPlan, status: "complete", pendingRequests: 0 } });
  log.inputs = await runForgeDaily(inputsArgs("inputs", meansPath, meansSha, universePath, universeSha, capturePath, captureSha));
  const proofs = { skater: { status: "closed", ...prepareNativeInputMaterialization(read(join(out, "inputs/materialization-request-skater.json")), CLOSED) },
    goalie: { status: "closed", ...prepareNativeInputMaterialization(read(join(out, "inputs/materialization-request-goalie.json")), CLOSED) } };
  const [skaterPath, skaterSha] = write("simulated-closed-proof-skater.json", proofs.skater);
  const [goaliePath, goalieSha] = write("simulated-closed-proof-goalie.json", proofs.goalie);
  log.proofs = { skater: proofSummary(proofs.skater), goalie: proofSummary(proofs.goalie),
    manifestItemsTotal: proofs.skater.manifest.expectedItems + proofs.goalie.manifest.expectedItems,
    sharedClosureScope: (proofs.skater.closure.payload as any).scopeHash === (proofs.goalie.closure.payload as any).scopeHash };
  const templates = { version: "native-baseline-publication-plan-v1", seasonId, rows: ["candidate-conditional-publication-candidate-v2/final-publication-plan.json",
    "goalie-summary-win-preparation-v1/final-publication-plan.compact.json"].flatMap(file => read(join(P, file)).rows)
    .filter((row: any) => ["baseline_evaluation_policy", "baseline_validation_review"].includes(row.entity_kind)) };
  const [templatesPath, templatesSha] = write("policy-templates.json", templates);
  const commandPath = join(out, "inputs/preparation-command.json");
  const outputsArgs = (dir: string, approvalRef: string, goalie = true) => ["outputs-v2", "--command", commandPath, "--command-sha256", sha(readFileSync(commandPath)),
    "--proof", skaterPath, "--proof-sha256", skaterSha, ...(goalie ? ["--goalie-proof", goaliePath, "--goalie-proof-sha256", goalieSha] : []),
    "--templates", templatesPath, "--templates-sha256", templatesSha, "--approval-ref", approvalRef, "--max-null-participation", "100", "--out", join(out, dir)];
  // Gate spot-checks (06 A-18, 07 A-14): each must stop before writing anything.
  log.gateChecks = {};
  for (const [name, args] of [["unpinnedApprovalRef", outputsArgs("outputs-unpinned", "replay:synthetic-standing-approval")],
    ["missingGoalieProof", outputsArgs("outputs-one-proof", NATIVE_DAILY_APPROVED_METHODS.standingApprovalRef, false)]] as const) {
    try { await runForgeDaily([...args], () => new Date(ISSUED)); log.gateChecks[name] = "not_stopped"; } catch (error) { log.gateChecks[name] = (error as Error).message; }
  }
  log.outputs = await runForgeDaily(outputsArgs("outputs", NATIVE_DAILY_APPROVED_METHODS.standingApprovalRef), () => new Date(ISSUED));
  const pending = read(join(out, "outputs/pending-plan.json"));
  try { await validateNativeBaselinePublication(pending, new Date(ISSUED)); log.pendingAdmitted = true; } catch (error) { log.pendingRejected = (error as Error).message; }
  const decision = { version: "native-daily-review-decision-v1" as const, planHash: hash(pending), decision: "approve" as const, reviewer: "replay-synthetic",
    reviewRef: "replay:synthetic-review", reviewedAt: REVIEWED, findings: [] };
  const reviewedPlan = applyNativeDailyReview(pending, decision), at = new Date("2026-10-21T12:25:00.000Z");
  try { log.reviewedValidation = (await validateNativeBaselinePublication(reviewedPlan as any, at)).rows; } catch (error) { log.reviewedValidationError = (error as Error).message; }
  try {
    const cadence = read(join(out, "outputs/pending-cadence-command.json"));
    const full = { ...cadence, cadenceInput: { ...cadence.cadenceInput, publicationPlan: reviewedPlan },
      catalogHead: { headId: "00000000-0000-4000-8000-000000000001", expectedRevision: 0, expectedHash: null, observationId: "00000000-0000-4000-8000-000000000002" } };
    log.cadence = { requiredSources: full.cadenceInput.cadence.requiredSources.length, inputSources: !!full.cadenceInput.inputSources,
      producerReceipts: Object.keys(full.producerReceiptIds).length };
    try { await validateCadenceCommand(full, proofs.skater as any, at); log.gateChecks.singleProofValidation = "not_stopped"; }
    catch (error) { log.gateChecks.singleProofValidation = (error as Error).message; }
    const validated = await validateCadenceCommand(full, proofs as any, at); log.cadenceValidation = validated.validation.rows;
    const dry: any = await publishObservedNativeBaselineCadence(validated.input, { dryRun: true, approvedPackageHash: hash(validated.input.publicationPlan),
      producerReceiptIds: full.producerReceiptIds, catalogHead: full.catalogHead });
    const plan2 = validated.input.publicationPlan as any, keys = new Set(plan2.rows.filter((r: any) => r.entity_kind === "participation_bundle")
      .flatMap((r: any) => r.payload.entries.map((e: any) => [e.input.scope.playerId, e.input.scope.nhlPlayerId, e.input.scope.teamId, e.input.scope.rosterRevision].join(":"))));
    const unbound = plan2.rows.filter((r: any) => r.entity_kind === "seasonal_rate_bundle").flatMap((r: any) => r.payload.sources)
      .filter((s: any) => !keys.has([s.playerId, s.nhlPlayerId, s.teamId, s.rosterRevision].join(":")));
    log.publishDry = { status: dry.status, reasons: dry.reasons ?? [], unboundSources: unbound.length, unboundPlayers: new Set(unbound.map((s: any) => s.playerId)).size };
  } catch (error) { log.cadenceValidationError = (error as Error).message; }
  const nullReasons: Record<string, number> = {};
  for (const row of pending.rows.filter((value: any) => value.entity_kind === "participation_bundle")) for (const entry of row.payload.entries)
    if (entry.receipt.probability === null) for (const reason of entry.receipt.reasons) nullReasons[reason] = (nullReasons[reason] ?? 0) + 1;
  log.nullReasons = nullReasons;
  log.networkRequests = 0; log.databaseWrites = 0;
  write("replay-receipt.json", log);
  console.log(JSON.stringify(log, null, 1));
})().catch(error => { console.error(error instanceof Error ? error.stack : error); process.exitCode = 1; });
