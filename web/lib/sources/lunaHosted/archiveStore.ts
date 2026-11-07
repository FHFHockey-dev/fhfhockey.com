import { isDeepStrictEqual } from "node:util";
import type { IftttRpcClient } from "../iftttRpcDeadline";
import { prepareCaptureEnvelope, validateCaptureResult, type CaptureStore } from "./capture";

/** Injectable backend archive adapter; no environment or client construction.
 * The capture handler owns deadlines and the single read reconciliation. Never
 * use this backend RPC for raw loading, approvals, policy changes or staging.
 */
export function createLunaArchiveStore(db: IftttRpcClient): CaptureStore {
  async function call(action: string, policyId: string, payload: Record<string, unknown>, signal: AbortSignal) {
    if (signal.aborted) throw new Error("archive_request_aborted");
    const result = await db.rpc("luna_capture_archive_rpc", { p_action: action,
      p_policy_id: policyId.toLowerCase(), p_payload: payload }).abortSignal(signal);
    if (result.error) throw new Error("archive_unavailable");
    return result.data;
  }
  return {
    async retain(input, signal) {
      const checked = prepareCaptureEnvelope(Buffer.from(input.rawBody,"utf8"), input.scope, input.receivedAt);
      if (!isDeepStrictEqual(checked, input)) throw new Error("invalid_archive_envelope");
      return validateCaptureResult(await call("retain", input.scope.policyId,
        { envelopeJson: JSON.stringify(input) }, signal), input);
    },
    async lookupExact(input, signal) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.scope.policyId) || !/^[a-f0-9]{64}$/.test(input.deliveryKey)
        || !/^[a-f0-9]{64}$/.test(input.payloadSha256)) throw new Error("invalid_archive_lookup");
      // Full receipt consistency is checked by the handler against the retained
      // request envelope; lookup never returns raw bytes or modifies counters.
      return call("lookup", input.scope.policyId, { appletId: input.scope.appletId,
        deliveryKey: input.deliveryKey, payloadSha256: input.payloadSha256 }, signal);
    },
  };
}
