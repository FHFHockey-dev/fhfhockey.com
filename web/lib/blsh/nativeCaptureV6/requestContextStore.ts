/** Fixed-origin custody for one request-context run. Each operation gets one attempt. */
import { createHash } from "node:crypto";
import * as https from "node:https";
import { PINNED_SUPABASE_ORIGIN } from "./core";
import { NATIVE_PACKET_FILES, matches, nativeObjectLimit, need, object, parseJSON, timestamp, validateNativeManifest } from "./packetFormat";
import { SEASON_FIRST_DATE, SEASON_LAST_DATE } from "./sourceDate";
import { PACKET_BUCKET, packetObjectPath, writerAgent } from "./writer";

const MIB = 1024 * 1024, JSON_LIMIT = 64 * 1024, DAY_MS = 86_400_000;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/, SHA = /^[0-9a-f]{64}$/;
export const REQUEST_CONTEXT_FILES = ["DB-CONTEXT.json", "RAW-wgo.json", "RAW-individual.json", "RAW-onIce.json",
  "RAW-calendar.json", "CURRENT-REQUEST.json", "RESULT.json", "MANIFEST.json"] as const;
export function contextObjectLimit(file: string) {
  if (file === "DB-CONTEXT.json") return 8 * MIB;
  if (file.startsWith("RAW-")) return 16 * MIB;
  if (file === "CURRENT-REQUEST.json") return 32 * MIB;
  return JSON_LIMIT;
}
export type NativeContextTarget = { sourceDate: string; nativeRunId: string; nativeManifestSHA256: string };
export interface RequestContextStore {
  source(target: NativeContextTarget): Promise<{ claimedAtUTC: string; closedAtUTC: string; manifest: Buffer; individual: Buffer; onIce: Buffer }>;
  claim(target: NativeContextTarget): Promise<{ claimed: true; runId: string } | { claimed: false }>;
  readContext(dateFrom: string, sourceDate: string): Promise<Buffer>;
  putObject(runId: string, sourceDate: string, ordinal: number, file: string, bytes: Buffer, sha256: string): Promise<void>;
  close(runId: string, state: "packet_complete_pending_review" | "failed", reason: string | null,
    manifestSHA256: string | null, manifestBytes: Buffer | null): Promise<void>;
}
type Request = { method: "GET" | "POST"; url: string; headers: Record<string, string>; body?: Buffer; limit: number; timeoutMs: number };
export type ContextTransport = (request: Request) => Promise<Buffer>;

const digest = (bytes: Buffer) => createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
function dateMs(value: string) {
  need(matches(value, /^\d{4}-\d{2}-\d{2}$/) && value >= SEASON_FIRST_DATE && value <= SEASON_LAST_DATE, "context_date_invalid");
  const ms = Date.parse(value + "T00:00:00Z");
  need(Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value, "context_date_invalid");
  return ms;
}
function targetArguments(target: NativeContextTarget) {
  dateMs(target.sourceDate);
  need(matches(target.nativeRunId, UUID) && matches(target.nativeManifestSHA256, SHA), "context_target_invalid");
  return { p_source_date: target.sourceDate, p_native_run_id: target.nativeRunId, p_native_manifest_sha256: target.nativeManifestSHA256 };
}

const boundedHTTPS: ContextTransport = ({ method, url, headers, body, limit, timeoutMs }) => new Promise((resolve, reject) => {
  let settled = false;
  const fail = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    reject(new Error("context_transport_failed"));
    req.destroy();
  };
  const req = https.request(url, { method, headers, agent: writerAgent() }, res => {
    const length = res.headers["content-length"];
    const expected = length === undefined ? undefined : Number(length);
    const encoding = res.headers["content-encoding"];
    if (!res.statusCode || res.statusCode < 200 || res.statusCode > 299 || (encoding && encoding !== "identity")
      || (expected !== undefined && (!Number.isSafeInteger(expected) || expected < 0 || expected > limit))) { fail(); return; }
    const chunks: Uint8Array[] = [];
    let size = 0;
    res.on("error", fail);
    res.on("aborted", fail);
    res.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) { fail(); return; }
      chunks.push(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
    });
    res.on("end", () => {
      if (!res.complete || (expected !== undefined && expected !== size)) { fail(); return; }
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(Buffer.concat(chunks, size));
    });
  });
  const timer = setTimeout(fail, timeoutMs);
  req.once("error", fail);
  req.once("close", fail);
  req.end(body);
});

export function createRequestContextStore(options: { serviceKey: string; transport?: ContextTransport }): RequestContextStore {
  need(typeof options.serviceKey === "string" && options.serviceKey.trim().length > 0, "context_credentials_missing");
  const auth = { apikey: options.serviceKey, Authorization: "Bearer " + options.serviceKey, "Accept-Encoding": "identity" };
  const transport = options.transport ?? boundedHTTPS;
  const send = async (path: string, limit: number, body?: Buffer, extra: Record<string, string> = {}, timeoutMs = 5000) => {
    try {
      const bytes = await transport({ method: body ? "POST" : "GET", url: PINNED_SUPABASE_ORIGIN + path, body, limit, timeoutMs,
        headers: { ...auth, ...(body ? { "Content-Type": "application/json" } : {}), ...extra } });
      need(Buffer.isBuffer(bytes) && bytes.length <= limit, "context_response_limit");
      return bytes;
    } catch { throw new Error("context_transport_failed"); }
  };
  const rpc = async (name: string, args: Record<string, unknown>) =>
    parseJSON(new Uint8Array(await send("/rest/v1/rpc/" + name, JSON_LIMIT, Buffer.from(JSON.stringify(args)))));
  return {
    async source(target) {
      const meta = object(await rpc("blsh_context_source_v1", targetArguments(target)));
      need(meta.sourceDate === target.sourceDate && meta.nativeRunId === target.nativeRunId
        && meta.nativeManifestSHA256 === target.nativeManifestSHA256, "context_native_target_mismatch");
      const { claimedAtUTC, closedAtUTC } = meta;
      need(typeof claimedAtUTC === "string" && typeof closedAtUTC === "string", "context_native_clock");
      let previousWrite = timestamp(claimedAtUTC), total = 0;
      const closed = timestamp(closedAtUTC);
      need(Array.isArray(meta.objects) && meta.objects.length === NATIVE_PACKET_FILES.length, "context_native_index_incomplete");
      const rows = meta.objects.map((raw, index) => {
        const row = object(raw), file = NATIVE_PACKET_FILES[index];
        const path = packetObjectPath(target.sourceDate, target.nativeRunId, file);
        const written = timestamp(row.writtenAtUTC);
        need(row.ordinal === index + 1 && row.path === path && matches(row.sha256, SHA)
          && typeof row.bytes === "number" && Number.isSafeInteger(row.bytes) && row.bytes >= 1 && row.bytes <= nativeObjectLimit(file)
          && written >= previousWrite && written <= closed, "context_native_index_invalid");
        previousWrite = written;
        if (file !== "MANIFEST.json") total += row.bytes;
        return { path, bytes: row.bytes, sha256: row.sha256, written };
      });
      need(total <= 8 * MIB && rows[19].sha256 === target.nativeManifestSHA256, "context_native_manifest_pin");
      const download = async (ordinal: number) => {
        const row = rows[ordinal - 1];
        const bytes = await send("/storage/v1/object/authenticated/" + PACKET_BUCKET + "/" + row.path, row.bytes);
        need(bytes.length === row.bytes && digest(bytes) === row.sha256, "context_native_object_mismatch");
        return bytes;
      };
      const manifest = await download(20);
      const body = object(parseJSON(new Uint8Array(manifest)));
      validateNativeManifest(body, target.nativeRunId, target.sourceDate, rows);
      const complete = timestamp(body.completedAtUTC);
      need(complete >= timestamp(claimedAtUTC) && complete <= rows[19].written, "context_native_manifest_clock");
      const observation = async (ordinal: number) => {
        const bytes = await download(ordinal);
        const obs = object(parseJSON(new Uint8Array(bytes))), entry = rows[ordinal - 2];
        need(obs.file === NATIVE_PACKET_FILES[ordinal - 2] && obs.bytes === entry.bytes && obs.sha256 === entry.sha256
          && timestamp(obs.retainedAtUTC) <= rows[ordinal - 1].written, "context_native_observation_mismatch");
        return bytes;
      };
      return { claimedAtUTC, closedAtUTC, manifest, individual: await observation(13), onIce: await observation(19) };
    },
    async claim(target) {
      const ack = object(await rpc("blsh_context_claim_v1", targetArguments(target)));
      if (ack.claimed === false && ack.runId === undefined) return { claimed: false };
      need(ack.claimed === true && matches(ack.runId, UUID), "context_claim_unacknowledged");
      return { claimed: true, runId: ack.runId };
    },
    async readContext(dateFrom, sourceDate) {
      need(dateMs(sourceDate) - dateMs(dateFrom) === 28 * DAY_MS, "context_date_range_invalid");
      return send("/rest/v1/rpc/blsh_request_context_v1", 8 * MIB,
        Buffer.from(JSON.stringify({ p_date_from: dateFrom, p_event_through: sourceDate })), {}, 15_000);
    },
    async putObject(runId, sourceDate, ordinal, file, bytes, sha256) {
      dateMs(sourceDate);
      need(matches(runId, UUID) && Number.isInteger(ordinal) && ordinal >= 1 && ordinal <= REQUEST_CONTEXT_FILES.length
        && REQUEST_CONTEXT_FILES[ordinal - 1] === file, "context_object_path_invalid");
      need(Buffer.isBuffer(bytes) && bytes.length >= 1 && bytes.length <= contextObjectLimit(file) && digest(bytes) === sha256, "context_object_invalid");
      const path = "request-context-v1/" + sourceDate + "/" + runId + "/" + file;
      await send("/storage/v1/object/blsh-request-context/" + path, JSON_LIMIT, bytes, { "x-upsert": "false", "Cache-Control": "no-store" }, 15_000);
      need(await rpc("blsh_context_object_v1", { p_run_id: runId, p_ordinal: ordinal, p_path: path, p_sha256: sha256, p_bytes: bytes.length }) === true,
        "context_object_unacknowledged");
    },
    async close(runId, state, reason, manifestSHA256, manifestBytes) {
      need(matches(runId, UUID), "context_run_invalid");
      if (state === "failed") need(matches(reason, /^[a-z][a-z0-9_:]{2,100}$/) && manifestSHA256 === null && manifestBytes === null, "context_failed_close_invalid");
      else need(state === "packet_complete_pending_review" && reason === null && Buffer.isBuffer(manifestBytes)
        && manifestBytes.length > 0 && manifestBytes.length <= JSON_LIMIT && digest(manifestBytes) === manifestSHA256, "context_success_close_invalid");
      const manifestText = manifestBytes === null ? null : new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(new Uint8Array(manifestBytes));
      need(await rpc("blsh_context_close_v1", { p_run_id: runId, p_state: state, p_reason: reason, p_manifest_sha256: manifestSHA256,
        p_manifest_text: manifestText }) === true, "context_close_unacknowledged");
    },
  };
}
