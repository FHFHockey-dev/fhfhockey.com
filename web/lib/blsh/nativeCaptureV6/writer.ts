/** BLSH native capture v6: the isolated Supabase writer (DESIGN.md §3.3).
 * Every in-run write (kill switch, claim, intent rows, Storage uploads, object rows, run
 * close) goes through node:https with keep-alive off and the TLS session cache disabled.
 * That is a different TLS stack from undici's fetch: it shares no sockets and no cached
 * sessions with the admission RPC, and it publishes nothing on undici:client:sendHeaders.
 * It never touches the global dispatcher. Failures carry whitelisted codes only: no
 * response bodies, headers, credentials or URLs. */
import * as https from "node:https";

export const WRITER_AGENT_OPTIONS = Object.freeze({ keepAlive: false, maxCachedSessions: 0 });
export const PACKET_BUCKET = "blsh-native-packets";
export const CAPTURE_PIPELINE = "native-v6";
const MAX_RESPONSE_BYTES = 64 * 1024;
const WRITE_TIMEOUT_MS = 5000;

export class CaptureStoreError extends Error {}
export type WriterRequest = { method: "GET" | "POST"; url: string; headers: Record<string, string>; body?: Buffer; timeoutMs: number };
export type WriterResponse = { status: number; body: Buffer };
export type WriterTransport = (request: WriterRequest) => Promise<WriterResponse>;

let agent: https.Agent | undefined;
/** One agent per instance; its options forbid connection reuse and session resumption. */
export function writerAgent(): https.Agent { return agent ??= new https.Agent({ ...WRITER_AGENT_OPTIONS }); }

export const httpsWriterTransport: WriterTransport = request => new Promise((resolve, reject) => {
  let settled = false;
  const finish = (error: Error | null, value?: WriterResponse) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(value!); };
  const timer = setTimeout(() => { req.destroy(); finish(new CaptureStoreError("writer_timeout")); }, request.timeoutMs);
  const req = https.request(request.url, { method: request.method, headers: request.headers, agent: writerAgent() }, response => {
    const chunks: Uint8Array[] = []; let size = 0;
    response.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_RESPONSE_BYTES) { response.destroy(); finish(new CaptureStoreError("writer_response_too_large")); return; }
      chunks.push(new Uint8Array(chunk));
    });
    response.on("end", () => finish(null, { status: response.statusCode ?? 0, body: Buffer.concat(chunks) }));
    response.on("error", () => finish(new CaptureStoreError("writer_transport_failed")));
  });
  req.on("error", () => finish(new CaptureStoreError("writer_transport_failed")));
  req.end(request.body);
});

export type RunState = "packet_complete_pending_review" | "no_slate" | "refused_schedule" | "failed";
export interface CaptureStore {
  enabled(): Promise<boolean>;
  claim(input: { sourceDate: string; deployment: Record<string, unknown> }): Promise<{ claimed: true; runId: string } | { claimed: false }>;
  intent(runId: string, group: string, operations: readonly string[]): Promise<void>;
  putObject(runId: string, sourceDate: string, ordinal: number, file: string, bytes: Buffer, sha256: string): Promise<void>;
  close(runId: string, state: RunState, reason: string | null, manifestSHA256: string | null): Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Storage key of one packet file: native-v6/{sourceDate}/{runId}/{file}. */
export const packetObjectPath = (sourceDate: string, runId: string, file: string) => `${CAPTURE_PIPELINE}/${sourceDate}/${runId}/${file}`;

export function createCaptureStore(options: { origin: string; serviceKey: string; transport?: WriterTransport }): CaptureStore {
  const transport = options.transport ?? httpsWriterTransport;
  const origin = new URL(options.origin).origin;
  const auth = { apikey: options.serviceKey, Authorization: `Bearer ${options.serviceKey}` };
  const rpc = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    let response: WriterResponse;
    try {
      response = await transport({ method: "POST", url: `${origin}/rest/v1/rpc/${name}`, timeoutMs: WRITE_TIMEOUT_MS,
        headers: { ...auth, "Content-Type": "application/json", Accept: "application/json" }, body: Buffer.from(JSON.stringify(args)) });
    } catch { throw new CaptureStoreError(`store_${name}_transport_failed`); }
    if (response.status < 200 || response.status > 299) throw new CaptureStoreError(`store_${name}_http_${response.status}`);
    if (response.body.length === 0) return null;
    try { return JSON.parse(response.body.toString("utf8")); } catch { throw new CaptureStoreError(`store_${name}_invalid_json`); }
  };
  return {
    async enabled() { return (await rpc("blsh_capture_enabled_v1", {})) === true; },
    async claim({ sourceDate, deployment }) {
      const result = await rpc("blsh_capture_claim_v1", { p_pipeline: CAPTURE_PIPELINE, p_source_date: sourceDate, p_deployment: deployment }) as Record<string, unknown> | null;
      if (result?.claimed === false) return { claimed: false };
      if (result?.claimed === true && typeof result.run_id === "string" && UUID.test(result.run_id)) return { claimed: true, runId: result.run_id };
      throw new CaptureStoreError("store_claim_unacknowledged");
    },
    async intent(runId, group, operations) {
      const result = await rpc("blsh_capture_intent_v1", { p_run_id: runId, p_group: group, p_operations: operations });
      if (result !== true) throw new CaptureStoreError("store_intent_unacknowledged");
    },
    async putObject(runId, sourceDate, ordinal, file, bytes, sha256) {
      if (!UUID.test(runId) || !FILE.test(file) || !DAY.test(sourceDate)) throw new CaptureStoreError("store_object_path_invalid");
      // blsh_capture_object_v1 re-derives this path from the run row and refuses any other.
      const path = packetObjectPath(sourceDate, runId, file);
      let response: WriterResponse;
      try {
        response = await transport({ method: "POST", url: `${origin}/storage/v1/object/${PACKET_BUCKET}/${path}`, timeoutMs: WRITE_TIMEOUT_MS,
          headers: { ...auth, "Content-Type": file.endsWith(".html") ? "text/html" : "application/json", "x-upsert": "false", "Cache-Control": "no-store" }, body: bytes });
      } catch { throw new CaptureStoreError("store_upload_transport_failed"); }
      if (response.status < 200 || response.status > 299) throw new CaptureStoreError(`store_upload_http_${response.status}`);
      const recorded = await rpc("blsh_capture_object_v1", { p_run_id: runId, p_ordinal: ordinal, p_path: path, p_sha256: sha256, p_bytes: bytes.length });
      if (recorded !== true) throw new CaptureStoreError("store_object_unacknowledged");
    },
    async close(runId, state, reason, manifestSHA256) {
      const result = await rpc("blsh_capture_close_v1", { p_run_id: runId, p_state: state, p_reason: reason, p_manifest_sha256: manifestSHA256 });
      if (result !== true) throw new CaptureStoreError("store_close_unacknowledged");
    },
  };
}
