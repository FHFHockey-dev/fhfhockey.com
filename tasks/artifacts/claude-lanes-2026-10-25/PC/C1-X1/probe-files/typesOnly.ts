// PROBE (must pass): type-only imports are not restricted
import type { RetainedReceipt, EvidenceResult } from "../player-cards/evidenceBundle";
export type Probe = RetainedReceipt | EvidenceResult;
