import { closeSync, fsyncSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { dirname } from "node:path";
import type { LunaAdmissionStore, LunaReceipt } from "./tweetLunaTransport";

const money = z.number().int().nonnegative().safe();
const ledgerSchema = z.object({ version: z.literal("luna-local-admission-v1"), approvedPolicyId: z.string().min(1),
  enabled: z.boolean(), blockedReason: z.string().nullable(), expiresAt: z.string().datetime({ offset: true }),
  capNanoUsd: money, priorExposureNanoUsd: money, maxCalls: z.number().int().min(0).max(20),
  attempts: z.record(z.object({ reservedNanoUsd: money, state: z.enum(["reserved", "settled", "uncertain"]),
    requestId: z.string().nullable().optional(),
    receipt: z.object({ body: z.unknown(), requestId: z.string().nullable(), endpoint: z.enum(["responses", "decisions"]), chargeNanoUsd: money }).nullable(),
  }).strict()),
}).strict();

/** Single-host manual worker only. Never initializes/resets a ledger, clears a stop,
 * frees uncertain reservations, or steals a stale lock. Not a serverless budget store.
 * The reviewed existing ledger must include all prior exposure under its approval.
 */
export function openLunaLocalAdmission(path: string, now = () => Date.now()): LunaAdmissionStore {
  const transaction = <T>(update: (ledger: z.infer<typeof ledgerSchema>) => T): T => {
    const lock = `${path}.lock`, fd = openSync(lock, "wx", 0o600);
    try {
      const raw = readFileSync(path);
      if (raw.length > 6_000_000) throw new Error("luna_ledger_too_large");
      const ledger = ledgerSchema.parse(JSON.parse(raw.toString("utf8")));
      const result = update(ledger), tmp = `${path}.${process.pid}.pending`;
      const out = openSync(tmp, "wx", 0o600);
      try { writeFileSync(out, JSON.stringify(ledger)); fsyncSync(out); } finally { closeSync(out); }
      renameSync(tmp, path);
      const directory = openSync(dirname(path), "r");
      try { fsyncSync(directory); } finally { closeSync(directory); }
      return result;
    } finally { closeSync(fd); unlinkSync(lock); }
  };
  return {
    async reserve(key, amount) {
      return transaction(ledger => {
        if (!ledger.enabled || ledger.blockedReason || Date.parse(ledger.expiresAt) <= now()) throw new Error("luna_budget_stopped");
        const previous = ledger.attempts[key];
        if (previous?.state === "settled" && previous.receipt) return { status: "replay" as const, receipt: previous.receipt as LunaReceipt };
        const entries = Object.values(ledger.attempts);
        if (entries.some(e => e.state !== "settled")) throw new Error("luna_unsettled_attempt");
        const exposure = entries.reduce((sum, e) => sum + (e.receipt?.chargeNanoUsd ?? e.reservedNanoUsd), ledger.priorExposureNanoUsd);
        if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(exposure + amount)
          || exposure + amount > ledger.capNanoUsd || entries.length >= ledger.maxCalls) throw new Error("luna_budget_exhausted");
        ledger.attempts[key] = { reservedNanoUsd: amount, state: "reserved", receipt: null };
        return { status: "reserved" as const };
      });
    },
    async settle(key, receipt) {
      transaction(ledger => {
        const row = ledger.attempts[key];
        if (!row || row.state !== "reserved" || !Number.isSafeInteger(receipt.chargeNanoUsd)
          || receipt.chargeNanoUsd < 0 || receipt.chargeNanoUsd > row.reservedNanoUsd) throw new Error("luna_settlement_rejected");
        row.state = "settled"; row.receipt = receipt;
      });
    },
    async uncertain(key, requestId) {
      transaction(ledger => {
        if (ledger.attempts[key]?.state !== "settled") {
          if (ledger.attempts[key]) { ledger.attempts[key]!.state = "uncertain"; ledger.attempts[key]!.requestId = requestId ?? null; }
          ledger.blockedReason = ledger.blockedReason ?? "unknown_billed_outcome";
        }
      });
    },
  };
}
