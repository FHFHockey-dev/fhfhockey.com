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
