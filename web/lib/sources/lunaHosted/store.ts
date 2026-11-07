import { z } from "zod";
import { boundedIftttRpc, type IftttRpcClient } from "../iftttRpcDeadline";
import { LUNA_RESERVATION_NANO_USD, priceLunaUsage, type LunaAdmissionStore, type LunaReceipt } from "../tweetLunaTransport";
import { HOSTED_LUNA_VERSION, jobIdSchema } from "./contract";
import type { runRetainedTweetLunaReviewWithBinding } from "../tweetLunaBindingWorkflow";

export type HostedLunaResult = Awaited<ReturnType<typeof runRetainedTweetLunaReviewWithBinding>>;
export interface HostedLunaStore {
  claim(jobId: string): Promise<{ status: "claimed"; job: unknown } | { status: "completed" | "held" }>;
  admission(jobId: string): LunaAdmissionStore;
  finish(jobId: string, result: HostedLunaResult): Promise<void>;
  hold(jobId: string): Promise<void>;
}
const receiptSchema = z.object({ body: z.record(z.unknown()), requestId: z.string().nullable(),
  endpoint: z.literal("responses"), chargeNanoUsd: z.number().int().nonnegative().safe() }).strict();
function validateReceipt(value: unknown): LunaReceipt {
  const receipt = receiptSchema.parse(value);
  if (receipt.chargeNanoUsd > LUNA_RESERVATION_NANO_USD
    || receipt.chargeNanoUsd !== priceLunaUsage(receipt.body, "responses")) throw new Error("invalid_hosted_receipt");
  return receipt;
}

/** Every RPC has a caller-wide deadline. Ambiguous mutations are never retried.
 * A lost claim/reserve reply leaves a durable running job/reservation for review.
 */
export function createHostedLunaStore(db: IftttRpcClient): HostedLunaStore {
  async function call(action: string, jobId: string, payload: Record<string, unknown> = {}) {
    const normalizedId = jobIdSchema.parse(jobId);
    const result = await boundedIftttRpc(db, "luna_hosted_review_rpc", {
      p_action: action, p_job_id: normalizedId, p_payload: payload,
    }, 6000);
    const responseId = jobIdSchema.safeParse(result.data?.jobId);
    if (result.error || result.data?.version !== HOSTED_LUNA_VERSION
      || !responseId.success || responseId.data !== normalizedId) {
      throw new Error("hosted_store_unavailable");
    }
    return result.data;
  }
  async function expectStatus(action: string, id: string, payload: Record<string, unknown>, status: string) {
    const result = await call(action, id, payload);
    if (result.status !== status) throw new Error("hosted_store_refused");
    return result;
  }
  return {
    async claim(id) {
      const r = await call("claim", id);
      if (r.status === "claimed") return { status: "claimed", job: r.job };
      if (r.status === "completed" || r.status === "held") return { status: r.status };
      throw new Error("hosted_job_unavailable");
    },
    admission(id) {
      return {
        async reserve(key, amountNanoUsd) {
          if (!/^[a-f0-9]{64}$/.test(key) || amountNanoUsd !== LUNA_RESERVATION_NANO_USD) throw new Error("invalid_hosted_reservation");
          const r = await call("reserve", id, { key, amountNanoUsd });
          if (r.status === "reserved") return { status: "reserved" };
          if (r.status === "replay") return { status: "replay", receipt: validateReceipt(JSON.parse(r.receiptJson)) };
          throw new Error("luna_budget_stopped");
        },
        async settle(key, receipt) {
          validateReceipt(receipt);
          await expectStatus("settle", id, { key, receiptJson: JSON.stringify(receipt) }, "settled");
        },
        async uncertain(key, requestId) {
          await expectStatus("uncertain", id, { key, requestId: requestId ?? null }, "held");
        },
      };
    },
    async finish(id, result) {
      const r = result.review;
      if (!["review_only", "held"].includes(r.status) || r.canPublish !== false || r.canChangeStatus !== false
        || r.canWriteAliases !== false || r.canExecuteReplacement !== false
        || (result.candidate !== null && result.candidate.content.canApply !== false) || Buffer.byteLength(JSON.stringify(result)) > 1_500_000) {
        throw new Error("invalid_hosted_result");
      }
      await expectStatus("finish", id, { resultJson: JSON.stringify(result) }, r.status === "held" ? "held" : "completed");
    },
    async hold(id) { await expectStatus("hold", id, {}, "held"); },
  };
}
