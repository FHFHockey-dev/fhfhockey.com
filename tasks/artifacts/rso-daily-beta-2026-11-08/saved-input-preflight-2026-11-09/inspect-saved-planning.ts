// File-only consistency preflight. Never fetches, rewrites a workspace, or grants forecast use.
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, openSync, readFileSync, readSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "../../../../web/node_modules/zod";
import { snapshotSchema } from "../../../../web/lib/in-season/workspaceSchema";
import { decodePlanningDataTransport } from "../../../../web/lib/rosterScheduleData/planningDataTransport";
import { BRIDGE_FORECAST_WIRE_VERSION, FORGE_DAILY_BRIDGE_VERSION, bridgeRunProofs, expandBridgeForecasts } from "../../../../web/lib/rosterScheduleData/bridgeForecastWire";
import { timestampMicros } from "../../../../web/lib/projections/evidenceTime";
import { verifiedForgeProducerClosure, verifiedForgeRelease } from "../../../../web/lib/projections/verifiedForgeReleases";

export const BODY_BYTE_LIMIT = 4_000_000, RECEIPT_BYTE_LIMIT = 16_384;
const prefix = FORGE_DAILY_BRIDGE_VERSION + ":";
const sha256 = (value: Buffer | string) => createHash("sha256").update(typeof value === "string" ? value : Uint8Array.from(value)).digest("hex");
const instant = z.string().refine(value => timestampMicros(value) !== null);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => timestampMicros(value + "T00:00:00Z") !== null);
const receiptSchema = z.object({
  version: z.literal("rso-saved-response-receipt-v1"),
  kind: z.enum(["provider_snapshot", "planning_data"]),
  bodySha256: z.string().regex(/^[a-f0-9]{64}$/),
  observedAt: instant,
  seasonId: z.number().int().refine(value => Math.floor(value / 10000) >= 2000 && Math.floor(value / 10000) <= 2199
    && value % 10000 === Math.floor(value / 10000) + 1),
  startDate: day, endDate: day,
  timeZone: z.string().refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }),
}).strict().refine(value => value.startDate <= value.endDate && Date.parse(value.endDate) - Date.parse(value.startDate) <= 366 * 86400000);

type Report = {
  version: "rso-saved-response-preflight-v1";
  consistentAtCapture: boolean;
  findings: string[];
  currentUseHolds: string[];
  bodySha256: string;
  observedAt: string | null;
  evaluatedAt: string | null;
  counts: Record<string, number>;
  authority: { networkVerified: false; captureAuthenticityVerified: false; servingBranchEstablished: false;
    authenticatedAcceptance: false; forecastUseGranted: false; managerIntentChanged: false };
};

/** Bounds the actual read, including files that grow after opening; refuses devices/directories. */
export function readBoundedFile(path: string, limit: number): Buffer {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > limit) throw new Error("input_file_invalid_or_too_large");
    const bytes = new Uint8Array(limit + 1); let offset = 0;
    while (offset <= limit) {
      const count = readSync(fd, bytes, offset, bytes.length - offset, null);
      if (!count) break;
      offset += count;
    }
    if (offset > limit) throw new Error("input_file_invalid_or_too_large");
    return Buffer.from(bytes.subarray(0, offset));
  } finally { closeSync(fd); }
}

export function verifySourcePins(): void {
  const repo = resolve(__dirname, "../../../..");
  const pins = JSON.parse(readFileSync(resolve(__dirname, "SOURCE-PINS.json"), "utf8")) as { files: { path: string; sha256: string }[] };
  for (const pin of pins.files) if (sha256(readFileSync(resolve(repo, pin.path))) !== pin.sha256) throw new Error("application_source_drift");
}

/** A receipt is caller-supplied provenance, not proof of transport or an owner approval. */
export function inspectSavedPlanning(bytes: Buffer, receiptInput: unknown, evaluatedAt = new Date().toISOString()): Report {
  const findings = new Set<string>(), holds = new Set<string>(["saved_capture_is_not_current_authenticated_acceptance"]);
  const now = timestampMicros(evaluatedAt);
  const report: Report = { version: "rso-saved-response-preflight-v1", consistentAtCapture: false,
    findings: [], currentUseHolds: [], bodySha256: sha256(bytes), observedAt: null, evaluatedAt: now === null ? null : evaluatedAt,
    counts: { players: 0, games: 0, rawForecasts: 0, bridgeRows: 0, bridgeRuns: 0, proofs: 0, bridgeNullStats: 0, bridgeZeroStats: 0 },
    authority: { networkVerified: false, captureAuthenticityVerified: false, servingBranchEstablished: false,
      authenticatedAcceptance: false, forecastUseGranted: false, managerIntentChanged: false } };
  const finish = () => ({ ...report, consistentAtCapture: findings.size === 0,
    findings: [...findings].sort(), currentUseHolds: [...holds].sort() });
  const parsed = receiptSchema.safeParse(receiptInput);
  if (!parsed.success || now === null || bytes.length > BODY_BYTE_LIMIT) {
    findings.add("receipt_clock_or_input_size_invalid"); return finish();
  }
  const receipt = parsed.data, observed = timestampMicros(receipt.observedAt)!;
  report.observedAt = receipt.observedAt;
  if (observed > now) findings.add("capture_is_in_the_future");
  if (report.bodySha256 !== receipt.bodySha256) { findings.add("body_hash_mismatch"); return finish(); }
  let body: any, data: ReturnType<typeof decodePlanningDataTransport> | z.infer<typeof snapshotSchema>;
  try {
    body = JSON.parse(bytes.toString("utf8"));
    if (body?.success !== true) throw new Error();
    if (receipt.kind === "provider_snapshot") {
      if (body.data !== undefined) throw new Error();
      const snapshot = snapshotSchema.parse(body.snapshot), asOf = timestampMicros(snapshot.context.asOf);
      data = snapshot;
      if (snapshot.context.seasonId !== receipt.seasonId || snapshot.context.startDate !== receipt.startDate
        || snapshot.context.endDate !== receipt.endDate || snapshot.context.timeZone !== receipt.timeZone) findings.add("snapshot_scope_mismatch");
      if (asOf === null) findings.add("snapshot_clock_invalid");
      else if (asOf > observed) findings.add("snapshot_from_future");
    } else {
      if (body.snapshot !== undefined) throw new Error();
      data = decodePlanningDataTransport(body.data);
    }
  } catch { findings.add("response_shape_invalid"); return finish(); }
  report.counts.players = data.players.length; report.counts.games = data.games.length; report.counts.rawForecasts = data.forecasts.length;
  if (!data.players.length || !data.games.length) findings.add("planning_population_empty");
  if (new Set(data.players.map(row => row.id)).size !== data.players.length
    || new Set(data.games.map(row => `${row.id}|${row.teamAbbreviation}`)).size !== data.games.length) findings.add("planning_identity_duplicated");
  if (data.games.some(row => row.date < receipt.startDate || row.date > receipt.endDate)) findings.add("game_outside_capture_scope");
  const manifest = data.forecastManifest;
  if (!manifest || manifest.seasonId !== receipt.seasonId || timestampMicros(manifest.asOf) === null) findings.add("manifest_missing_or_scope_invalid");
  else if (timestampMicros(manifest.asOf)! > observed) findings.add("manifest_from_future");
  if (data.forecasts.length) holds.add("non_wire_forecasts_require_separate_use_review");
  if (data.forecasts.some(row => row.revisionId.startsWith(prefix))) findings.add("unpacked_bridge_rows_require_review");
  if (body.bridgeForecasts === undefined || body.bridgeForecasts === null) {
    if (manifest?.rsoUsePolicy?.bridgeRevisionIds.length) findings.add("declared_bridge_wire_missing");
    holds.add("serving_source_and_forecast_use_not_established"); return finish();
  }
  const wire = body.bridgeForecasts;
  if (wire.version !== BRIDGE_FORECAST_WIRE_VERSION || wire.seasonId !== receipt.seasonId || !Array.isArray(wire.rows)
    || !wire.rows.length || wire.rows.length > 15000 || !Array.isArray(wire.runs) || !wire.runs.length || wire.runs.length > 500) {
    findings.add("bridge_wire_invalid_or_empty"); return finish();
  }
  const expanded = expandBridgeForecasts(wire, data);
  report.counts.bridgeRows = wire.rows.length; report.counts.bridgeRuns = wire.runs.length;
  if (expanded.length !== wire.rows.length) { findings.add("bridge_rows_dropped_by_codec"); return finish(); }
  const revisions = wire.runs.map((run: string[]) => run[0]);
  if (new Set(revisions).size !== revisions.length || new Set(expanded.map(row => `${row.playerId}|${row.gameId}`)).size !== expanded.length)
    findings.add("bridge_identity_duplicated");
  const used = new Set(expanded.map(row => row.revisionId)), declared = manifest?.rsoUsePolicy?.bridgeRevisionIds;
  if (!declared || new Set(declared).size !== declared.length || declared.length !== used.size || declared.some(id => !used.has(id)))
    findings.add("bridge_manifest_binding_mismatch");
  if (used.size !== revisions.length) findings.add("bridge_run_not_used");
  const proofs = bridgeRunProofs(wire); report.counts.proofs = proofs.length;
  if (!Array.isArray(wire.proofs) || wire.proofs.length > 500 || proofs.length !== wire.proofs.length
    || proofs.length !== revisions.length || new Set(proofs.map(row => row.runId)).size !== proofs.length)
    findings.add("bridge_proof_population_invalid");
  for (const run of wire.runs as string[][]) {
    const [revision, watermark, model, issuedAt, cutoffAt] = run, issued = timestampMicros(issuedAt), cutoff = timestampMicros(cutoffAt);
    if (!revision.startsWith(prefix) || revision === prefix || watermark !== revision || !model.startsWith(prefix)
      || !/^([a-f0-9]{40}|unknown)$/.test(model.slice(prefix.length)) || issued === null || cutoff === null
      || cutoff > issued || issued > observed) findings.add("bridge_run_identity_or_clock_invalid");
    const proof = proofs.find(row => `${prefix}${row.runId}` === revision);
    if (!proof || !proof.basis) { findings.add("bridge_run_proof_missing"); continue; }
    if (proof.releaseSha !== null && model !== prefix + proof.releaseSha) findings.add("bridge_release_binding_mismatch");
    if (proof.basis === "verified_producer_closure" && (!verifiedForgeProducerClosure(proof.closureSha256)
      || !/^[a-f0-9]{40}$/.test(proof.releaseSha ?? ""))) findings.add("bridge_producer_proof_unrecognized");
    if (proof.basis === "verified_release" && (!verifiedForgeRelease(proof.releaseSha) || proof.closureSha256 !== null))
      findings.add("bridge_release_proof_unrecognized");
    if (proof.basis === "captured_snapshot") holds.add("original_captured_snapshot_proof_still_required");
  }
  for (const row of expanded) {
    const expiry = timestampMicros(row.expiresAt!), start = timestampMicros(row.issuedContext!.scheduledAt);
    if (!Number.isSafeInteger(row.issuedContext!.nhlPlayerId) || row.issuedContext!.nhlPlayerId <= 0
      || !Number.isSafeInteger(row.issuedContext!.teamId) || row.issuedContext!.teamId <= 0
      || !row.issuedContext!.scheduleRevision || !row.issuedContext!.rosterRevision) findings.add("bridge_player_game_binding_incomplete");
    if (expiry === null || start === null || observed >= expiry || observed >= start || expiry > start)
      findings.add("bridge_expired_or_invalid_at_capture");
    else if (now >= expiry || now >= start) holds.add("bridge_expired_now");
    for (const value of Object.values(row.stats)) {
      if (value === null) report.counts.bridgeNullStats++;
      else if (value === 0) report.counts.bridgeZeroStats++;
    }
  }
  holds.add("original_served_run_and_source_selection_need_owner_evidence");
  return finish();
}

if (require.main === module) {
  try {
    const [bodyPath, receiptPath, evaluatedAt] = process.argv.slice(2);
    if (!bodyPath || !receiptPath || process.argv.length > 5) throw new Error("usage");
    verifySourcePins();
    const body = readBoundedFile(bodyPath, BODY_BYTE_LIMIT), receipt = JSON.parse(readBoundedFile(receiptPath, RECEIPT_BYTE_LIMIT).toString("utf8"));
    const result = inspectSavedPlanning(body, receipt, evaluatedAt);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    process.exitCode = result.consistentAtCapture ? 0 : 1;
  } catch {
    // Never echo JSON parse errors, paths, payload fragments, names, identifiers or credentials.
    process.stderr.write("saved_input_preflight_failed: check arguments, file bounds, JSON and source pins.\n");
    process.exitCode = 2;
  }
}
