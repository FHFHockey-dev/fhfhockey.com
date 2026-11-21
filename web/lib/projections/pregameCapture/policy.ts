import type { CaptureBudget } from "./custody";

export const POLICY_ID = "pregame-native-v1";

/** Exceeding any of these limits refuses the capture rather than saving a partial packet. */
export const PILOT_TRANSPORT_LIMITS = {
  maxCalls: 600, maxRows: 400_000, maxBytes: 96 * 1024 * 1024, maxResponseBytes: 24 * 1024 * 1024, stampToleranceMs: 5_000,
} as const;

export const DEFAULT_CAPTURE_BUDGET = {
  readMs: 120_000, saveWaitMs: 20_000, tsaTimeoutMs: 10_000, skewToleranceMs: 2_000, rpcMs: 10_000,
  // Covers the post-claim read, save, settlement, verification and outcome. T−60 never moves.
  requiredMs: 240_000,
} as const satisfies CaptureBudget;

/** V2 reserves the final 12 seconds for the dispatch receipt and another 10 for response delivery. */
export const HOSTED_V2_TIMING = {
  platformMs: 240_000, workMs: 218_000, finishMs: 230_000, dispatchRpcMs: 6_000, scheduleMs: 6_000,
} as const;

export const HOSTED_V2_BUDGET = {
  pinMs: 12_000, readMs: 75_000, saveWaitMs: 12_000, tsaTimeoutMs: 8_000, skewToleranceMs: 2_000, rpcMs: 5_000,
  // Includes ambiguous-save settlement and witness/outcome lookups, plus local packet and signature processing.
  requiredMs: 160_000,
} as const satisfies CaptureBudget;
