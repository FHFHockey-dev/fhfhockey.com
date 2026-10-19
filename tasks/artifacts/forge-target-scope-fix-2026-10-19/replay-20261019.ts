/** Offline replay of the 2026-10-19 v1 live run's publish hold, at that run's own clocks.
 *  A. Control: today's reviewed cadence command and closed materialize proof, unchanged, through the publish dry run.
 *  B. Fix: today's real capture and the retained request through the patched inputs and outputs stages; the closure is
 *     simulated with the materializer's own planner at today's closure instant (the real materialize was a hosted write);
 *     a synthetic review; then the same publish dry run.
 * No network (fetch throws) and no database client. Usage: replay-20261019.ts PRIVATE_ROOT NEW_OUTPUT_DIR */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runForgeDaily } from "../../../web/scripts/forge-daily";
import { validateCadenceCommand } from "../../../web/scripts/native-baseline-cadence";
import { publishObservedNativeBaselineCadence } from "../../../web/lib/player-forecasts/nativeBaselineCadence";
import { prepareNativeInputMaterialization } from "../../../web/lib/player-forecasts/nativeInputMaterialization";
import { applyNativeDailyReview } from "../../../web/lib/player-forecasts/nativeDailyPipeline";
import { playerForecastSourcePayloadHash as hash } from "../../../web/lib/player-forecasts/sourceSnapshot";

const P = process.argv[2], out = process.argv[3];
if (!P || !out) throw new Error("usage: replay-20261019.ts PRIVATE_ROOT NEW_OUTPUT_DIR");
globalThis.fetch = (() => { throw new Error("network disabled in replay"); }) as any;
mkdirSync(out, { mode: 0o700 });
const D = join(P, "daily-20261019-v1"), sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const fileSha = (path: string) => sha(readFileSync(path)), read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const write = (name: string, value: unknown) => { const bytes = JSON.stringify(value); writeFileSync(join(out, name), bytes, { flag: "wx", mode: 0o600 }); return [join(out, name), sha(bytes)]; };
// Today's clocks (LEDGER section 13): closure, outputs issuance, review, publish dry run.
const CLOSED = "2026-10-19T11:53:48.782Z", ISSUED = "2026-10-19T12:00:33.671Z", REVIEWED = "2026-10-19T12:03:57.000Z", PUBLISH = "2026-10-19T12:04:26.231Z";
const catalogHead = { headId: "00000000-0000-4000-8000-000000000001", expectedRevision: 0, expectedHash: null, observationId: "00000000-0000-4000-8000-000000000002" };
const publishDry = async (command: any, proof: any) => {
  const at = new Date(PUBLISH), validated = await validateCadenceCommand(command, proof, at);
  const result: any = await publishObservedNativeBaselineCadence(validated.input, { dryRun: true,
    approvedPackageHash: hash(validated.input.publicationPlan), producerReceiptIds: command.producerReceiptIds, catalogHead: command.catalogHead });
  return { cadenceValidationRows: validated.validation.rows, status: result.status, reasons: result.reasons ?? [], slot: result.slot?.key ?? null,
    attemptedWrites: result.publication?.attemptedWrites ?? null };
};
const targets = (plan: any) => {
  const scopes = plan.rows.filter((row: any) => row.entity_kind === "participation_bundle").flatMap((row: any) => row.payload.entries.map((entry: any) => entry.input.scope));
  const keys = new Set(scopes.map((s: any) => [s.playerId, s.nhlPlayerId, s.teamId, s.rosterRevision].join(":")));
  const sources = plan.rows.filter((row: any) => row.entity_kind === "seasonal_rate_bundle").flatMap((row: any) => row.payload.sources);
  const unbound = sources.filter((s: any) => !keys.has([s.playerId, s.nhlPlayerId, s.teamId, s.rosterRevision].join(":")));
  return { sources: sources.length, unboundSources: unbound.length, unboundPlayers: [...new Set(unbound.map((s: any) => s.playerId))].sort((a: any, b: any) => a - b) };
};
const log: any = { networkRequests: 0, databaseWrites: 0, clocks: { CLOSED, ISSUED, REVIEWED, PUBLISH } };

(async () => {
  // A. Control: the exact files the live publish dry run read.
  const reviewedPath = join(D, "reviewed/cadence-command.json"), proofPath = join(D, "materialize/stage.json");
  const todayCommand = read(reviewedPath), todayProof = read(proofPath);
  log.control = { inputs: { reviewedCommandSha256: fileSha(reviewedPath), proofSha256: fileSha(proofPath) },
    scope: targets(todayCommand.cadenceInput.publicationPlan), publishDry: await publishDry(todayCommand, todayProof) };

  // B. Fix: rebuild today from the same retained request and today's real capture.
  const retainedPath = join(P, "daily-acquisition-contract-20261016-v1/retained-materialization-request.json"), capturePath = join(D, "capture/receipts.json");
  log.fix = { inputs: { retainedSha256: fileSha(retainedPath), captureSha256: fileSha(capturePath) } };
  log.fix.inputsStage = await runForgeDaily(["inputs", "--retained", retainedPath, "--retained-sha256", log.fix.inputs.retainedSha256,
    "--capture", capturePath, "--capture-sha256", log.fix.inputs.captureSha256, "--date", "2026-10-19", "--out", join(out, "inputs")]);
  const request = read(join(out, "inputs/materialization-request.json"));
  log.fix.meansOnlyExcluded = read(join(out, "inputs/coverage.json")).meansOnlyExcluded;
  const proof = { status: "closed", ...prepareNativeInputMaterialization(request, CLOSED) };
  const [simulatedProofPath, simulatedProofSha] = write("simulated-closed-proof.json", proof);
  log.fix.simulatedClosure = { rows: proof.rows.length, manifestItems: proof.manifest.expectedItems, todayManifestItems: (todayProof.manifest ?? {}).expectedItems ?? null };
  // The reviewed native plan the live outputs stage re-issued: the Oct 16 rows without participation.
  const reviewedNative = { version: "native-baseline-publication-plan-v1", seasonId: 20262027, rows: ["candidate-conditional-publication-candidate-v2/final-publication-plan.json",
    "goalie-summary-win-preparation-v1/final-publication-plan.compact.json"].flatMap(file => read(join(P, file)).rows)
    .filter((row: any) => row.entity_kind !== "participation_bundle") };
  const todayOriginalBundles = read(join(D, "outputs/receipt.json")).reviews.map((review: any) => review.originalBundleId).sort();
  log.fix.reviewedNativeMatchesToday = JSON.stringify(reviewedNative.rows.filter((row: any) => row.entity_kind === "seasonal_rate_bundle").map((row: any) => row.id).sort())
    === JSON.stringify(todayOriginalBundles);
  const [reviewedNativePath, reviewedNativeSha] = write("reviewed-native.json", reviewedNative);
  const commandPath = join(out, "inputs/preparation-command.json");
  log.fix.outputsStage = await runForgeDaily(["outputs", "--command", commandPath, "--command-sha256", fileSha(commandPath), "--proof", simulatedProofPath,
    "--proof-sha256", simulatedProofSha, "--reviewed", reviewedNativePath, "--reviewed-sha256", reviewedNativeSha, "--approval-ref", "replay:synthetic-participation-approval",
    "--max-null-participation", "100", "--standing-approval-ref", "replay:synthetic-standing-approval", "--out", join(out, "outputs")], () => new Date(ISSUED));
  delete log.fix.outputsStage.reviews;
  const plan = read(join(out, "outputs/pending-plan.json")), pending = read(join(out, "outputs/pending-cadence-command.json"));
  // Means and participation must equal today's apart from the excluded players.
  const todayPlan = todayCommand.cadenceInput.publicationPlan, excluded = new Set(log.fix.meansOnlyExcluded.map((value: any) => value.playerId));
  const means = (p: any) => p.rows.filter((row: any) => row.entity_kind === "seasonal_rate_bundle").flatMap((row: any) => row.payload.sources)
    .map((s: any) => `${s.sourceId}|${s.mean}|${s.cutoffAt}|${s.expiresAt}`).sort();
  const receipts = (p: any) => p.rows.filter((row: any) => row.entity_kind === "participation_bundle").flatMap((row: any) => row.payload.entries)
    .map((entry: any) => hash({ input: entry.input, receipt: entry.receipt })).sort();
  const todayKept = todayPlan.rows.filter((row: any) => row.entity_kind === "seasonal_rate_bundle").flatMap((row: any) => row.payload.sources)
    .filter((s: any) => !excluded.has(s.playerId)).map((s: any) => `${s.sourceId}|${s.mean}|${s.cutoffAt}|${s.expiresAt}`).sort();
  log.fix.comparison = { meansEqualTodayMinusExcluded: JSON.stringify(means(plan)) === JSON.stringify(todayKept), keptSources: todayKept.length,
    participationEqualToday: JSON.stringify(receipts(plan)) === JSON.stringify(receipts(todayPlan)), participationEntries: receipts(plan).length,
    policies: plan.rows.filter((row: any) => row.entity_kind === "baseline_evaluation_policy").map((row: any) => ({ policyVersion: row.payload.policyVersion,
      reissuedOct16Row: todayPlan.rows.some((old: any) => old.id === row.id), ownerApprovalRef: row.payload.ownerApprovalRef,
      sources: plan.rows.find((b: any) => b.entity_kind === "seasonal_rate_bundle" && b.payload.manifest.evaluationPolicyId === row.id).payload.sources.length })) };
  const decision = { version: "native-daily-review-decision-v1" as const, planHash: hash(plan), decision: "approve" as const, reviewer: "replay-synthetic",
    reviewRef: "replay:synthetic-review", reviewedAt: REVIEWED, findings: [] };
  const reviewed = applyNativeDailyReview(plan, decision);
  log.fix.scope = targets(reviewed);
  log.fix.publishDry = await publishDry({ ...pending, cadenceInput: { ...pending.cadenceInput, publicationPlan: reviewed }, catalogHead }, proof);
  write("replay-receipt.json", log);
  console.log(JSON.stringify(log, null, 1));
})().catch(error => { console.error(error instanceof Error ? error.stack : error); process.exitCode = 1; });
