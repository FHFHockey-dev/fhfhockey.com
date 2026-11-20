// Binding point for the independent verifier's signed verdict (Track A). Until that package is integrated, every check
// fails closed: no signed verdict is ever reported as valid. Replace both functions with Track A's loader and its
// pinned-public-key verification; nothing else in the audit, the publish route or the readers changes.
import type { SignatureCheck, SignatureVerdict, VerdictBinding } from "./liveAcceptance";

type Queryable = { query: (text: string, args?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

export async function loadSignedVerdict(_db: Queryable, _claimId: string): Promise<unknown> {
  return null;
}

export const verifySignedVerdict: SignatureCheck = (_signed: unknown, _binding: VerdictBinding): SignatureVerdict =>
  ({ ok: false, reason: "signed_verdict_verifier_not_integrated" });
