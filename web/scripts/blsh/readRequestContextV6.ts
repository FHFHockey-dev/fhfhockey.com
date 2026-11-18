/** Offline readback of the completed eight-object request/context export. */
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, openSync, readSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { reviewedEvidenceTime } from "../../lib/buyLowSellHigh/reviewedFiveGameWindow.server";
import { matches, need, object, parseJSON, timestamp } from "../../lib/blsh/nativeCaptureV6/packetFormat";
import { buildRequestFromContextV1, REQUEST_CONTEXT_CAPTURE, type RequestContextResult } from "../../lib/blsh/nativeCaptureV6/requestContext";
import { contextObjectLimit, REQUEST_CONTEXT_FILES, type NativeContextTarget } from "../../lib/blsh/nativeCaptureV6/requestContextStore";
import { PILOT_FENCE_FIRST_CAPTURE_DATE, SEASON_FIRST_DATE, SEASON_LAST_DATE } from "../../lib/blsh/nativeCaptureV6/sourceDate";

export type RequestContextV6Pins = NativeContextTarget & {
  runId: string; manifestSHA256: string; deploymentId: string; gitCommitSha: string;
};
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/, SHA = /^[0-9a-f]{64}$/;
const COMPLETE = "packet_complete_pending_review", DAY_MS = 86400000;
const digest = (b: Buffer) => createHash("sha256").update(new Uint8Array(b.buffer, b.byteOffset, b.length)).digest("hex");
const decode = (b: Buffer) => parseJSON(new Uint8Array(b.buffer, b.byteOffset, b.length));
const json = (value: unknown) => Buffer.from(JSON.stringify(value) + "\n");
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
function utc(value: unknown) {
  need(typeof value === "string", "invalid_utc_time");
  timestamp(value);
  return value;
}

function localFile(root: string, name: string, limit: number, expected?: number) {
  const path = join(root, name);
  need(realpathSync(path) === path, "context_export_path_mismatch");
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd);
    need(stat.isFile() && stat.size > 0 && stat.size <= limit && (expected === undefined || expected === stat.size), "context_export_file_size");
    const bytes = Buffer.alloc(stat.size);
    const view = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.length);
    for (let offset = 0; offset < bytes.length;) {
      const n = readSync(fd, view, offset, bytes.length - offset, offset);
      need(n > 0, "context_export_file_size");
      offset += n;
    }
    need(fstatSync(fd).size === stat.size, "context_export_file_size");
    return bytes;
  } finally { closeSync(fd); }
}

export function readRequestContextV6Export(contextExportDir: string, pins: RequestContextV6Pins) {
  const { sourceDate, nativeRunId, nativeManifestSHA256, runId, manifestSHA256, deploymentId, gitCommitSha } = pins;
  need(matches(sourceDate, /^\d{4}-\d\d-\d\d$/), "context_date_invalid");
  const sourceMs = Date.parse(sourceDate + "T00:00:00Z");
  need(Number.isFinite(sourceMs) && day(sourceMs) === sourceDate && sourceDate >= SEASON_FIRST_DATE, "context_date_invalid");
  const nextDay = day(sourceMs + DAY_MS), dateFrom = day(sourceMs - 28 * DAY_MS);
  need(nextDay >= PILOT_FENCE_FIRST_CAPTURE_DATE && nextDay <= SEASON_LAST_DATE, "context_date_invalid");
  need(matches(runId, UUID) && matches(nativeRunId, UUID) && matches(nativeManifestSHA256, SHA) && matches(manifestSHA256, SHA)
    && matches(deploymentId, /^[A-Za-z0-9_-]{1,128}$/) && matches(gitCommitSha, /^[0-9a-f]{40}$/), "context_target_invalid");
  const root = realpathSync(contextExportDir);
  const runBytes = localFile(root, "run.json", 65536), objectRowsBytes = localFile(root, "objects.json", 65536);
  const run = object(decode(runBytes)), rows = decode(objectRowsBytes);
  need(run.state === COMPLETE && run.reason === null && run.run_id === runId && run.source_date === sourceDate
    && run.native_run_id === nativeRunId && run.native_manifest_sha256 === nativeManifestSHA256 && run.manifest_sha256 === manifestSHA256,
  "context_run_mismatch");
  const claimedAtUTC = utc(run.claimed_at), closedAtUTC = utc(run.closed_at);
  const claimed = timestamp(claimedAtUTC), closed = timestamp(closedAtUTC);
  // Both ledger stamps come from PostgreSQL. One invocation has a 240-second hosted limit.
  need(closed >= claimed && closed - claimed <= 240_000_000, "context_clock_mismatch");
  need(Array.isArray(rows) && rows.length === REQUEST_CONTEXT_FILES.length, "context_index_count");
  const sorted = rows.map(object).sort((a, b) => Number(a.ordinal) - Number(b.ordinal));
  let prior = claimed, total = 0;
  const records = REQUEST_CONTEXT_FILES.map((file, i) => {
    const row = sorted[i], path = "request-context-v1/" + sourceDate + "/" + runId + "/" + file;
    need(row.run_id === runId && row.ordinal === i + 1 && row.path === path && matches(row.sha256, SHA), "context_index_mismatch");
    const size = row.bytes;
    need(typeof size === "number" && Number.isSafeInteger(size) && size > 0 && size <= contextObjectLimit(file), "context_export_file_size");
    total += size;
    need(total <= 64 * 1024 * 1024, "context_packet_size");
    const written = timestamp(row.written_at);
    need(prior <= written && written <= closed, "context_clock_mismatch");
    prior = written;
    return { file, bytes: size, sha256: row.sha256 };
  });
  const files = new Map<string, Buffer>();
  for (const [i, record] of records.entries()) {
    const bytes = localFile(root, join("objects", sorted[i].path as string), contextObjectLimit(record.file), record.bytes);
    need(digest(bytes) === record.sha256, "context_object_digest_mismatch");
    files.set(record.file, bytes);
  }
  const identity = { runId, sourceDate, nativeRunId, nativeManifestSHA256 };
  need(records[7].sha256 === manifestSHA256 && isDeepStrictEqual(decode(files.get("MANIFEST.json")!), {
    version: "fhfh.blsh.request-context-manifest.v1", ...identity, files: records.slice(0, 7),
  }), "context_manifest_mismatch");
  const result = object(decode(files.get("RESULT.json")!));
  const context = object(decode(files.get("DB-CONTEXT.json")!)) as unknown as RequestContextResult;
  need(context.dateFrom === dateFrom && context.eventThroughDate === sourceDate && result.dateFrom === dateFrom
    && result.eventThroughDate === sourceDate, "context_scope_mismatch");
  const asOfUTC = utc(result.asOfUTC), observed = object(result.nativeRetrievedAtUTC);
  const nativeRetrievedAtUTC = { individual: utc(observed.individual), onIce: utc(observed.onIce) };
  const individual = timestamp(nativeRetrievedAtUTC.individual), onIce = timestamp(nativeRetrievedAtUTC.onIce);
  // PostgreSQL serializes these two original clocks in the statement's session time zone.
  const snapshot = reviewedEvidenceTime(context.snapshotUTC), statement = reviewedEvidenceTime(context.statementUTC);
  const captured = timestamp(asOfUTC);
  need(day(individual / 1000) === nextDay && day(claimed / 1000) === nextDay && individual <= onIce && onIce <= claimed
    && claimed <= snapshot && snapshot <= statement && statement <= captured && captured <= timestamp(sorted[0].written_at)
    && captured <= individual + 12 * 3600000000 && asOfUTC === new Date(captured / 1000).toISOString(), "context_clock_mismatch");
  const projected = buildRequestFromContextV1(context, { capturedAtUTC: asOfUTC });
  for (const [file, bytes] of [...Object.entries(projected.rawFiles), ["CURRENT-REQUEST.json", json(projected.request)] as const]) {
    need(files.get(file)!.equals(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.length)), "context_projection_mismatch");
  }
  need(isDeepStrictEqual(result, {
    version: "fhfh.blsh.request-context-result.v1", state: "CAPTURED_READ_ONLY_UNQUALIFIED", executionMode: REQUEST_CONTEXT_CAPTURE,
    captureContext: REQUEST_CONTEXT_CAPTURE, atomicDatabaseSnapshot: true, sessionClosed: true, ...identity,
    requestDeployment: { deploymentId, gitCommitSha }, dateFrom, eventThroughDate: sourceDate,
    snapshotUTC: context.snapshotUTC, statementUTC: context.statementUTC, nativeRetrievedAtUTC, asOfUTC, rows: projected.rows,
    artifacts: Object.fromEntries(records.slice(0, 6).map(r => [r.file, r.sha256])), independentlyAccepted: false, advancedAdmission: false, score: null,
  }), "context_result_mismatch");
  return { request: projected.request, files: files as ReadonlyMap<string, Buffer>, runBytes, objectRowsBytes, receipt: {
    sourceDate, nativeRunId, nativeManifestSHA256, runId, manifestSHA256, deploymentId, gitCommitSha,
    dateFrom, eventThroughDate: sourceDate, snapshotUTC: context.snapshotUTC, statementUTC: context.statementUTC,
    status: "request_context_readback_pending_review" as const, state: COMPLETE, asOfUTC, claimedAtUTC, closedAtUTC, nativeRetrievedAtUTC,
    independentlyAccepted: false as const, advancedAdmission: false as const, score: null,
  } };
}
