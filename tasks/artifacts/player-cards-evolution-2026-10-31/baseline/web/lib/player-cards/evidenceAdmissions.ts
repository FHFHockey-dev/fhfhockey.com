import type { DefinitionReceipt, FinalityReceipt, HistoryReceipt, PopulationReceipt } from "./evidenceBundle";

/**
 * One claim an independent review verified in exact retained bytes. The loader writes these
 * authority labels onto the admitted receipt; a file's own sourceClass/dateBasis/zeroSemantics is never read as proof.
 */
export type VerifiedClaim =
  | { receiptId: string; kind: "appearance-history"; sourceClass: HistoryReceipt["subject"]["sourceClass"]; dateBasis: HistoryReceipt["subject"]["dateBasis"] }
  | { receiptId: string; kind: "game-finality"; sourceClass: FinalityReceipt["subject"]["sourceClass"] }
  | { receiptId: string; kind: "metric-definition"; zeroSemantics: DefinitionReceipt["subject"]["zeroSemantics"] }
  | { receiptId: string; kind: "population-membership"; sourceClass: PopulationReceipt["subject"]["sourceClass"] };

export type Admission = {
  /** Relative path under the retained-evidence root; the bytes there must hash to `sha256`. */
  path: string; sha256: string;
  /** `receipt-v1`: one receipt object. `completion-read-rows-v1`: ingestion-manifest rows, which can only establish ingestion completion. */
  format: "receipt-v1" | "completion-read-rows-v1";
  origin: "synthetic" | "local-observed";
  /** Recorded review decision that verified these exact bytes (e.g. CODEX-20261025-080); synthetic fixtures use "SYNTHETIC". */
  authority: string;
  claims: readonly VerifiedClaim[];
};

const COMPLETION_READ_01 = "player-cards-2026-10-25/completion-read-01/RESULT.json";

/**
 * Reviewed admission ledger: the only source of admitted evidence. Adding an entry is a reviewed code
 * change pinned to exact bytes, never request, card or browser input.
 */
export const EVIDENCE_ADMISSIONS: readonly Admission[] = Object.freeze([
  // CODEX-20261025-080: the five-row read establishes an ingestion completion observation only, not actual end of play.
  Object.freeze({
    path: COMPLETION_READ_01,
    sha256: "6ee7b37d6f6d075557d9987599043ba09320ca9d66e9c9a6bbdf75bf5dd5dae2",
    format: "completion-read-rows-v1",
    origin: "local-observed",
    authority: "CODEX-20261025-080",
    claims: Object.freeze([2026020095, 2026020111, 2026020123, 2026020151, 2026020167].map(gameId => Object.freeze({ receiptId: `${COMPLETION_READ_01}#game-${gameId}`, kind: "game-finality", sourceClass: "ingestion-completion" } as const))),
  } as const),
]);
