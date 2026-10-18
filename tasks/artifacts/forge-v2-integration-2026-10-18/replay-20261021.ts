/** Offline engineering replay of the combined v2 daily driver at 2026-10-21 clocks (flags all off).
 * Stand-ins, each disclosed in the receipt:
 *  - universe: the retained 69-player 2026-10-16 scope as a universe document (no Yahoo read);
 *  - capture: retained club-roster and history-week bodies re-stamped to the run clock; future weeks re-sliced from the
 *    retained weekly schedules (as the v1 dry-run did);
 *  - means: the means stage planned and assembled at run clocks from retained originals only, so history stops at
 *    2026-10-12 (`historyBefore`) and Fiala's prior boxscores come from their retained original spans.
 * No network (fetch throws), no database (stores refuse), new private output directory only.
 * Usage: replay-20261021.ts PRIVATE_ROOT NEW_OUTPUT_DIR */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dailyCapturePlan, runForgeDaily } from "../../../web/scripts/forge-daily";
import { validateCadenceCommand } from "../../../web/scripts/native-baseline-cadence";
import { prepareNativeInputMaterialization } from "../../../web/lib/player-forecasts/nativeInputMaterialization";
import { applyNativeDailyReview } from "../../../web/lib/player-forecasts/nativeDailyPipeline";
import { validateNativeBaselinePublication } from "../../../web/lib/player-forecasts/nativeBaselinePublication";
import { assembleNativeDailyMeans, planNativeMeansCapture } from "../../../web/lib/player-forecasts/nativeDailyMeansCapture";
import { playerForecastSourcePayloadHash as hash } from "../../../web/lib/player-forecasts/sourceSnapshot";

const P = process.argv[2], out = process.argv[3];
if (!P || !out) throw new Error("usage: replay-20261021.ts PRIVATE_ROOT NEW_OUTPUT_DIR");
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
log.means = { planStatus: plan.status, pendingRequests: plan.requests.map(value => `${value.kind}:${value.reason}`), selected: means.nativeSelection.length,
  byPolicy: means.nativeSelection.reduce((counts: Record<string, number>, value) => ({ ...counts, [value.policyVersion]: (counts[value.policyVersion] ?? 0) + 1 }), {}),
  withoutSelection: means.coverage.filter(row => !row.selectedPolicies.length).map(row => ({ playerId: row.playerId, reasons: row.reasons })), stats: means.stats };
log.standIns.push("means: history through 2026-10-12 only; Oct 13-20 schedule weeks, boxscores, landings and goalie summaries need live capture");

(async () => {
  const [universePath, universeSha] = write("universe.json", universe), [capturePath, captureSha] = write("capture.json", { receipts: captureReceipts, failures: [] });
  const [meansPath, meansSha] = write("means.json", means);
  log.inputs = await runForgeDaily(["inputs-v2", "--universe", universePath, "--universe-sha256", universeSha, "--means", meansPath, "--means-sha256", meansSha,
    "--capture", capturePath, "--capture-sha256", captureSha, "--retained", retainedPath, "--retained-sha256", sha(readFileSync(retainedPath)),
    "--date", DATE, "--out", join(out, "inputs")]);
  const request = read(join(out, "inputs/materialization-request.json"));
  const proof = { status: "closed", ...prepareNativeInputMaterialization(request, CLOSED) };
  const [proofPath, proofSha] = write("simulated-closed-proof.json", proof);
  log.proof = { rows: proof.rows.length + 2, manifestItems: proof.manifest.expectedItems, closure: proof.closure.id };
  const templates = { version: "native-baseline-publication-plan-v1", seasonId, rows: ["candidate-conditional-publication-candidate-v2/final-publication-plan.json",
    "goalie-summary-win-preparation-v1/final-publication-plan.compact.json"].flatMap(file => read(join(P, file)).rows)
    .filter((row: any) => ["baseline_evaluation_policy", "baseline_validation_review"].includes(row.entity_kind)) };
  const [templatesPath, templatesSha] = write("policy-templates.json", templates);
  const commandPath = join(out, "inputs/preparation-command.json");
  log.outputs = await runForgeDaily(["outputs-v2", "--command", commandPath, "--command-sha256", sha(readFileSync(commandPath)), "--proof", proofPath,
    "--proof-sha256", proofSha, "--templates", templatesPath, "--templates-sha256", templatesSha, "--approval-ref", "replay:synthetic-standing-approval",
    "--max-null-participation", "100", "--out", join(out, "outputs")], () => new Date(ISSUED));
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
    log.cadenceValidation = (await validateCadenceCommand(full, proof as any, at)).validation.rows;
  } catch (error) { log.cadenceValidationError = (error as Error).message; }
  const nullReasons: Record<string, number> = {};
  for (const row of pending.rows.filter((value: any) => value.entity_kind === "participation_bundle")) for (const entry of row.payload.entries)
    if (entry.receipt.probability === null) for (const reason of entry.receipt.reasons) nullReasons[reason] = (nullReasons[reason] ?? 0) + 1;
  log.nullReasons = nullReasons;
  log.networkRequests = 0; log.databaseWrites = 0;
  write("replay-receipt.json", log);
  console.log(JSON.stringify(log, null, 1));
})().catch(error => { console.error(error instanceof Error ? error.stack : error); process.exitCode = 1; });
