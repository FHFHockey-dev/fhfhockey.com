// The authoritative witness gate for live, game-scoped publication: the independent verifier's Ed25519-signed verdict,
// verified in release code against the pinned keys (signedVerdict.ts, Track A). The publish route, both RSO readback
// paths and the offline acceptance audit all decide through checkSignedVerdict; a database gate alone is never enough.
import type { SupabaseClient } from "@supabase/supabase-js";

export type SignedVerdictExpected = {
  claimId: string; gameId: number; raw: string; canonical: string; tsaTokenSha256: string; release: string;
};
export type SignedVerdictVerification = { ok: boolean; reason?: string | null; deadline?: string | null; verifiedAt?: string | null };
export type SignedVerdictVerify = (signedVerdict: unknown, expected: SignedVerdictExpected) => SignedVerdictVerification;
export type SignedVerdictDecision = {
  ok: boolean; reason: string | null; officialStart: string | null; deadline: string | null; verifiedAt: string | null;
};

/** Seam to the verifier package's verify(signedVerdict, expected). Until it is bound, every verdict fails closed. */
export const verifySignedVerdict: SignedVerdictVerify = () => ({ ok: false, reason: "signed_verdict_verifier_not_integrated" });

const HOUR = 3_600_000;
const instant = (value: unknown) => (typeof value === "string" && value ? Date.parse(value) : NaN);

/** Accept only a signature-valid accepted verdict for exactly this claim, whose signed official start is the claim's
 * scheduled start and which was verified at or before its signed deadline (official start − 60 min). */
export function checkSignedVerdict(signedVerdict: unknown, expected: SignedVerdictExpected, claimScheduledStart: string,
  verify: SignedVerdictVerify = verifySignedVerdict): SignedVerdictDecision {
  const payload = (signedVerdict as { payload?: Record<string, unknown> } | null)?.payload ?? null;
  const officialStart = typeof payload?.officialStart === "string" ? payload.officialStart : null;
  const decide = (reason: string | null, result?: SignedVerdictVerification): SignedVerdictDecision =>
    ({ ok: reason === null, reason, officialStart, deadline: result?.deadline ?? null, verifiedAt: result?.verifiedAt ?? null });
  if (!signedVerdict) return decide("signed_verdict_missing");
  let result: SignedVerdictVerification;
  try {
    result = verify(signedVerdict, expected);
  } catch {
    return decide("signed_verdict_unverifiable");
  }
  if (result.ok !== true) return decide(result.reason || "signed_verdict_invalid", result);
  if (payload?.verdict !== "accepted") return decide("signed_verdict_not_accepted", result);
  const start = instant(officialStart), deadline = instant(result.deadline), verifiedAt = instant(result.verifiedAt);
  if (!Number.isFinite(start) || start !== instant(claimScheduledStart)) return decide("official_start_mismatch", result);
  if (!Number.isFinite(deadline) || deadline !== start - HOUR) return decide("deadline_mismatch", result);
  if (!Number.isFinite(verifiedAt) || verifiedAt > deadline) return decide("verified_late", result);
  return decide(null, result);
}

export type SignedVerdictBinding = {
  claimId: string; gameId: number; scheduledStart: string; raw: string; canonical: string; tsaTokenSha256: string;
  signedVerdict: unknown;
};

/** One claim's custody hashes and its stored signed verdict (forge_live_signed_verdict_v1, service role, read-only). */
export async function loadSignedVerdictBinding(db: SupabaseClient, claimId: string, signal?: AbortSignal): Promise<SignedVerdictBinding | null> {
  let call = db.rpc("forge_live_signed_verdict_v1", { p_claim: claimId });
  if (signal) call = call.abortSignal(signal);
  const { data, error } = await call;
  if (error || !data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (row.claimId !== claimId || typeof row.raw !== "string" || typeof row.canonical !== "string"
      || typeof row.tsaTokenSha256 !== "string" || typeof row.scheduledStart !== "string" || !Number.isSafeInteger(Number(row.gameId))) return null;
  return { claimId, gameId: Number(row.gameId), scheduledStart: row.scheduledStart, raw: row.raw, canonical: row.canonical,
    tsaTokenSha256: row.tsaTokenSha256, signedVerdict: row.signedVerdict ?? null };
}

/** Load and decide in one step for a claim published by this release. */
export async function gateSignedVerdict(db: SupabaseClient, claimId: string, gameId: number, release: string,
  verify: SignedVerdictVerify = verifySignedVerdict, signal?: AbortSignal): Promise<SignedVerdictDecision> {
  const binding = await loadSignedVerdictBinding(db, claimId, signal).catch(() => null);
  if (!binding) return { ok: false, reason: "signed_verdict_unreadable", officialStart: null, deadline: null, verifiedAt: null };
  if (binding.gameId !== gameId) return { ok: false, reason: "claim_mismatch", officialStart: null, deadline: null, verifiedAt: null };
  return checkSignedVerdict(binding.signedVerdict, { claimId, gameId, raw: binding.raw, canonical: binding.canonical,
    tsaTokenSha256: binding.tsaTokenSha256, release }, binding.scheduledStart, verify);
}
