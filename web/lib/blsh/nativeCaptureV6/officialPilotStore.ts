/** One hosted official pilot. Every RPC and append-only upload is attempted once. */
import { createHash } from "node:crypto";
import { PINNED_SUPABASE_ORIGIN } from "./core";
import { matches, need, object, parseJSON } from "./packetFormat";
import { boundedHTTPS, type ContextTransport } from "./requestContextStore";

const SOURCE_DATE = "2026-11-21";
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/, SHA = /^[0-9a-f]{64}$/;
const SMALL = 65536;
export type OfficialPilotTarget = {
  sourceDate: string; nativeRunId: string; nativeManifestSHA256: string;
  deploymentId: string; gitCommitSha: string; scheduleSHA256: string; gameIds: readonly number[];
};
export interface OfficialPilotStore {
  claim(target: OfficialPilotTarget, remainingMs?: () => number): Promise<{ claimed: true; runId: string } | { claimed: false }>;
  putObject(runId: string, sourceDate: string, ordinal: number, file: string, bytes: Buffer, sha256: string, remainingMs?: () => number): Promise<void>;
  close(runId: string, state: "packet_complete_pending_review" | "failed", reason: string | null,
    manifestSHA256: string | null, manifestBytes: Buffer | null, remainingMs?: () => number): Promise<void>;
}
const digest = (bytes: Buffer) => createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
const utf8 = (bytes: Buffer) => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(new Uint8Array(bytes));

export function officialPilotObjectLimit(file: string): number {
  if (file === "RUNTIME.json" || file === "MANIFEST.json" || /^operation-(?:[1-9]|1[0-6])-STARTED\.json$/.test(file)) return SMALL;
  if (/^boxscore-202602\d{4}\.body\.json$/.test(file)) return 4 * 1024 * 1024;
  if (/^boxscore-202602\d{4}\.receipt\.json$/.test(file)) return 384 * 1024;
  return 0;
}

export function createOfficialPilotStore(options: { serviceKey: string; transport?: ContextTransport }): OfficialPilotStore {
  need(typeof options.serviceKey === "string" && options.serviceKey.trim().length > 0, "official_credentials_missing");
  const transport = options.transport ?? boundedHTTPS;
  const rpc = async (name: string, args: Record<string,unknown>, remainingMs?: () => number) => {
    const body = Buffer.from(JSON.stringify(args));
    const timeoutMs = Math.min(5000, Math.floor(remainingMs?.() ?? 5000));
    need(Number.isFinite(timeoutMs) && timeoutMs > 0, "official_store_deadline");
    try {
      const response = await transport({ method: "POST", url: PINNED_SUPABASE_ORIGIN + "/rest/v1/rpc/" + name,
        headers: { apikey: options.serviceKey, Authorization: "Bearer " + options.serviceKey,
          "Accept-Encoding": "identity", "Content-Type": "application/json" }, body, limit: SMALL, timeoutMs });
      need(Buffer.isBuffer(response) && response.length <= SMALL, "official_response_bound");
      return parseJSON(new Uint8Array(response));
    } catch { throw new Error("official_store_transport_failed"); }
  };
  return {
    async claim(t, remainingMs) {
      need(t.sourceDate === SOURCE_DATE && matches(t.nativeRunId, UUID) && matches(t.nativeManifestSHA256, SHA)
        && matches(t.scheduleSHA256, SHA) && matches(t.deploymentId, /^[A-Za-z0-9_-]{1,128}$/)
        && matches(t.gitCommitSha, /^[0-9a-f]{40}$/) && Array.isArray(t.gameIds) && t.gameIds.length >= 1 && t.gameIds.length <= 16
        && t.gameIds.every((id,i) => Number.isSafeInteger(id) && /^202602\d{4}$/.test(String(id)) && (!i || t.gameIds[i-1] < id)), "official_target_invalid");
      const ack = object(await rpc("blsh_official_claim_v1", { p_source_date: t.sourceDate, p_native_run_id: t.nativeRunId,
        p_native_manifest_sha256: t.nativeManifestSHA256, p_schedule_sha256: t.scheduleSHA256,
        p_deployment_id: t.deploymentId, p_git_commit_sha: t.gitCommitSha, p_game_ids: t.gameIds }, remainingMs));
      if (ack.claimed === false && Object.keys(ack).length === 1) return { claimed: false };
      need(ack.claimed === true && Object.keys(ack).length === 2 && matches(ack.runId, UUID), "official_claim_unacknowledged");
      return { claimed: true, runId: ack.runId };
    },
    async putObject(runId, day, ordinal, file, bytes, hash, remainingMs) {
      need(matches(runId, UUID) && day === SOURCE_DATE && Number.isInteger(ordinal) && ordinal >= 1 && ordinal <= 50
        && Buffer.isBuffer(bytes) && bytes.length >= 1 && bytes.length <= officialPilotObjectLimit(file) && digest(bytes) === hash, "official_object_invalid");
      const path = "official-v1/" + day + "/" + runId + "/" + file;
      need(await rpc("blsh_official_object_v1", { p_run_id: runId, p_ordinal: ordinal, p_path: path,
        p_bytes: bytes.length, p_sha256: hash, p_body_base64: bytes.toString("base64") }, remainingMs) === true, "official_object_unacknowledged");
    },
    async close(runId, state, reason, hash, bytes, remainingMs) {
      need(matches(runId, UUID), "official_run_invalid");
      if (state === "failed") need(matches(reason, /^[a-z][a-z0-9_:]{2,100}$/) && hash === null && bytes === null, "official_failure_invalid");
      else need(state === "packet_complete_pending_review" && reason === null && Buffer.isBuffer(bytes)
        && bytes.length > 0 && bytes.length <= SMALL && digest(bytes) === hash, "official_manifest_invalid");
      need(await rpc("blsh_official_close_v1", { p_run_id: runId, p_state: state, p_reason: reason,
        p_manifest_sha256: hash, p_manifest_text: bytes === null ? null : utf8(bytes) }, remainingMs) === true, "official_close_unacknowledged");
    },
  };
}
