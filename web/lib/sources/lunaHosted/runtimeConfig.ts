import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { jobIdSchema } from "./contract";
import type { HostedLunaStore } from "./store";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.string().datetime().refine(s => Number.isFinite(Date.parse(s)));
const scope = z.object({ policyId: jobIdSchema, appletId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  sourceAccount: z.string().regex(/^[A-Za-z0-9_]{1,15}$/) }).strict();
const captureSchema = z.object({ version: z.literal("luna-pilot-runtime-v1"),
  startsAt: timestamp, expiresAt: timestamp, scope }).strict();
const workerSchema = captureSchema.extend({ job: z.object({ id: jobIdSchema, inputHash: digest,
  receiptHash: digest, referenceHash: digest, provenanceRef: z.string().trim().min(1).max(500) }).strict() });
export type CaptureRuntimeConfig = z.infer<typeof captureSchema>;
export type WorkerRuntimeConfig = z.infer<typeof workerSchema>;
type Env = Record<string, string | undefined>;

/** Nonsecret release configuration only. Database owner policy must separately
 * enforce 10 recorded attempts, one receipt/call and the aggregate $1 cap.
 * Parsing this configuration proves neither that policy nor source authenticity.
 */
export function readCaptureRuntimeConfig(env: Env, now = Date.now()): CaptureRuntimeConfig | null {
  return read(env.IFTTT_LUNA_CAPTURE_ENABLED, env.IFTTT_LUNA_CAPTURE_CONFIG, captureSchema, now);
}
export function readWorkerRuntimeConfig(env: Env, now = Date.now()): WorkerRuntimeConfig | null {
  return read(env.IFTTT_LUNA_REVIEW_ENABLED, env.IFTTT_LUNA_REVIEW_CONFIG, workerSchema, now);
}
function read<T extends CaptureRuntimeConfig>(flag: string | undefined, raw: string | undefined,
  schema: z.ZodType<T>, now: number): T | null {
  if (flag !== "true" || !raw || raw.length > 4096 || !Number.isFinite(now)) return null;
  try {
    const config = schema.parse(JSON.parse(raw));
    const start = Date.parse(config.startsAt), end = Date.parse(config.expiresAt);
    if (end <= start || end - start > 60 * 60 * 1000 || now < start || now >= end) return null;
    return config;
  } catch { return null; }
}
export function captureRuntimeStillEnabled(env: Env, config: CaptureRuntimeConfig | null, now = Date.now()) {
  return config !== null && isDeepStrictEqual(config, readCaptureRuntimeConfig(env, now));
}
export function workerRuntimeStillEnabled(env: Env, config: WorkerRuntimeConfig | null, now = Date.now()) {
  return config !== null && isDeepStrictEqual(config, readWorkerRuntimeConfig(env, now));
}

/** Restrict the route to the one owner-approved job and exact archive scope.
 * An ambiguous claim is never repeated. A known claim with mismatched metadata
 * is held before admission/provider access; failure to hold stays locked for
 * reconciliation. The existing worker validates all bytes and hashes afterward.
 */
export function bindWorkerRuntimeStore(store: HostedLunaStore, config: WorkerRuntimeConfig): HostedLunaStore {
  return { ...store, async claim(id) {
    if (id !== config.job.id) throw new Error("unapproved_runtime_job");
    const result = await store.claim(id);
    if (result.status !== "claimed") return result;
    try {
      const job = result.job as Record<string, unknown>;
      for (const [key, value] of Object.entries(config.job)) {
        if (job[key] !== value) throw new Error("runtime_job_mismatch");
      }
      if (typeof job.receiptJson !== "string") throw new Error("runtime_receipt_missing");
      const receipt = JSON.parse(job.receiptJson);
      if (receipt?.kind !== "luna-isolated-review-receipt-v1" || receipt.eventTable !== "luna_capture.receipts"
        || !isDeepStrictEqual(receipt.archive?.envelope?.scope, config.scope)) throw new Error("runtime_scope_mismatch");
    } catch {
      await store.hold(id).catch(() => undefined);
      throw new Error("runtime_job_held");
    }
    return result;
  } };
}
