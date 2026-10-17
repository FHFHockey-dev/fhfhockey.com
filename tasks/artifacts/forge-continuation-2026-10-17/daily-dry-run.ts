/** Target-date engineering replay of the v1 daily driver: retained 2026-10-16 original bodies stand in
 * for a 2026-10-20 capture (clocks shifted to the run day; future weeks re-sliced to the planned URLs),
 * so every clock rule runs as it would live. No network or database: fetch throws, stores are in-memory. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { runForgeDaily, dailyCapturePlan } from "../../../web/scripts/forge-daily";
import { validateCadenceCommand } from "../../../web/scripts/native-baseline-cadence";
import { prepareNativeInputMaterialization } from "../../../web/lib/player-forecasts/nativeInputMaterialization";
import { applyNativeDailyReview } from "../../../web/lib/player-forecasts/nativeDailyPipeline";
import { validateNativeBaselinePublication } from "../../../web/lib/player-forecasts/nativeBaselinePublication";
import { playerForecastSourcePayloadHash as hash } from "../../../web/lib/player-forecasts/sourceSnapshot";

const P = process.argv[2], out = process.argv[3];
if (!P || !out) throw new Error("usage: daily-dry-run.ts PRIVATE_ROOT NEW_OUTPUT_DIR");
globalThis.fetch = (() => { throw new Error("network disabled in dry-run"); }) as any;
mkdirSync(out, { mode: 0o700 });
const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const write = (name: string, value: unknown) => { const bytes = JSON.stringify(value); writeFileSync(join(out, name), bytes, { flag: "wx", mode: 0o600 }); return [join(out, name), sha(bytes)]; };
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const retainedPath = join(P, "daily-acquisition-contract-20261016-v1/retained-materialization-request.json");
const retained = read(retainedPath);
const DATE = "2026-10-20", CAPTURED = "2026-10-20T11:00:00.000Z";
const originals = new Map<string, string>(retained.parents.filter((parent: any) => parent.original).map((parent: any) => [parent.original.url, parent.original.rawBody]));
const futureGames = new Map<number, any>();
for (const [url, body] of originals) if (/\/v1\/schedule\//.test(url) && url.slice(-10) >= "2026-10-13")
  for (const day of JSON.parse(body).gameWeek) for (const game of day.games) futureGames.set(game.id, { ...game, date: day.date });
const plan = dailyCapturePlan(retained, DATE, 8), receipt = (url: string, rawBody: string) => ({ url, capturedAt: CAPTURED, bodySha256: sha(rawBody), rawBody });
const receipts = plan.map(url => {
  if (originals.has(url)) return receipt(url, originals.get(url)!);
  const start = url.slice(-10), days = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(`${start}T12:00:00Z`) + i * 86400000).toISOString().slice(0, 10));
  return receipt(url, JSON.stringify({ gameWeek: days.map(date => ({ date, games: [...futureGames.values()].filter(game => game.date === date).map(({ date: _d, ...game }) => game) })) }));
});
const [capturePath, captureSha] = write("capture.json", { receipts, failures: [], attempted: receipts.length });
const log: any = { receipts: receipts.length };

(async () => {
  log.syntheticFutureWeeks = receipts.filter(value => !originals.has(value.url)).map(value => value.url);
  const inputs = await runForgeDaily(["inputs", "--retained", retainedPath, "--retained-sha256", sha(readFileSync(retainedPath)),
    "--capture", capturePath, "--capture-sha256", captureSha, "--date", DATE, "--out", join(out, "inputs")]);
  log.inputs = inputs;
  const request = read(join(out, "inputs/materialization-request.json")), command = read(join(out, "inputs/preparation-command.json"));
  // Simulated closure on the due date (the real run uses the materialize stage against the store).
  const closedAt = "2026-10-20T12:05:00.000Z", issuedAt = "2026-10-20T12:10:00.000Z";
  const proof = { status: "closed", ...prepareNativeInputMaterialization(request, closedAt) };
  const [proofPath, proofSha] = write("simulated-closed-proof.json", proof);
  log.proof = { rows: proof.rows.length, manifestItems: proof.manifest.expectedItems, closure: proof.closure.id };
  // Reviewed native rows from 2026-10-16 (policies, reviews, bundles), without participation.
  const reviewed = { version: "native-baseline-publication-plan-v1", seasonId: 20262027, rows: ["candidate-conditional-publication-candidate-v2/final-publication-plan.json",
    "goalie-summary-win-preparation-v1/final-publication-plan.compact.json"].flatMap(file => read(join(P, file)).rows)
    .filter((row: any) => row.entity_kind !== "participation_bundle") };
  const [reviewedPath, reviewedSha] = write("reviewed-native.json", reviewed);
  const [commandPath, commandSha] = [join(out, "inputs/preparation-command.json"), sha(readFileSync(join(out, "inputs/preparation-command.json")))];
  const outputs = await runForgeDaily(["outputs", "--command", commandPath, "--command-sha256", commandSha, "--proof", proofPath, "--proof-sha256", proofSha,
    "--reviewed", reviewedPath, "--reviewed-sha256", reviewedSha, "--approval-ref", "dry-run:synthetic-approval", "--max-null-participation", "1260",
    "--out", join(out, "outputs")], () => new Date(issuedAt));
  log.outputs = outputs;
  const plan = read(join(out, "outputs/pending-plan.json"));
  try { await validateNativeBaselinePublication(plan, new Date(issuedAt)); log.pendingAdmitted = true; } catch (error) { log.pendingRejected = (error as Error).message; }
  const decision = { version: "native-daily-review-decision-v1" as const, planHash: hash(plan), decision: "approve" as const, reviewer: "dry-run-synthetic",
    reviewRef: "dry-run:synthetic-review", reviewedAt: "2026-10-20T12:20:00.000Z", findings: [] };
  const reviewedPlan = applyNativeDailyReview(plan, decision), at = new Date("2026-10-20T12:25:00.000Z");
  try { log.reviewedValidation = (await validateNativeBaselinePublication(reviewedPlan as any, at)).rows; } catch (error) { log.reviewedValidationError = (error as Error).message; }
  try {
    const cadence = read(join(out, "outputs/pending-cadence-command.json"));
    const full = { ...cadence, cadenceInput: { ...cadence.cadenceInput, publicationPlan: reviewedPlan },
      catalogHead: { headId: "00000000-0000-4000-8000-000000000001", expectedRevision: 0, expectedHash: null, observationId: "00000000-0000-4000-8000-000000000002" } };
    log.cadenceValidation = (await validateCadenceCommand(full, proof as any, at)).validation.rows;
  } catch (error) { log.cadenceValidationError = (error as Error).message; }
  // Participation comparison against the receipts actually published on 2026-10-16, by method/player/game.
  const published = new Map<string, any>();
  for (const file of ["native-publication-candidate-v1/final-publication-plan.json", "candidate-participation-preparation-v1/immediate14-v1/final-publication-plan.json",
    "candidate-participation-preparation-v2/additional25-v1/final-publication-plan.json"]) for (const row of read(join(P, file)).rows)
    if (row.entity_kind === "participation_bundle") for (const entry of row.payload.entries) published.set(`${row.dataset_key}:${entry.receipt.scope.playerId}:${entry.receipt.scope.gameId}`, entry.receipt);
  const compare = { same: 0, differentProbability: 0, differentReasons: 0, newOnly: 0, examples: [] as any[], nullReasons: {} as Record<string, number> };
  for (const row of plan.rows.filter((value: any) => value.entity_kind === "participation_bundle")) for (const entry of row.payload.entries) {
    if (entry.receipt.probability === null) for (const reason of entry.receipt.reasons) compare.nullReasons[reason] = (compare.nullReasons[reason] ?? 0) + 1;
    const old = published.get(`${row.dataset_key}:${entry.receipt.scope.playerId}:${entry.receipt.scope.gameId}`);
    if (!old) { compare.newOnly++; continue; }
    if (old.probability !== entry.receipt.probability) { compare.differentProbability++; if (compare.examples.length < 5) compare.examples.push({ key: `${entry.receipt.scope.playerId}:${entry.receipt.scope.gameId}`, old: old.probability, now: entry.receipt.probability, oldReasons: old.reasons, nowReasons: entry.receipt.reasons }); }
    else if (hash(old.reasons) !== hash(entry.receipt.reasons)) compare.differentReasons++;
    else compare.same++;
  }
  log.participationComparison = compare;
  log.networkRequests = 0; log.databaseWrites = 0;
  write("dry-run-receipt.json", log);
  console.log(JSON.stringify(log, null, 1));
})().catch(error => { console.error(error instanceof Error ? error.stack : error); process.exitCode = 1; });
