// The authoritative witness gate for live, game-scoped publication: the independent verifier's Ed25519-signed verdict,
// verified in release code against the keys pinned in witnessSigningKeys.ts (signedVerdict.ts). The publish route, both
// RSO readback paths and the offline acceptance audit all decide through checkSignedVerdict; a database gate is never
// enough. With no key pinned, every verdict is refused (fail closed).
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSignedVerdict, type SignedVerdictRow } from "./signedVerdict";
import { WITNESS_SIGNING_KEYS } from "./witnessSigningKeys";

export type SignedVerdictExpected = { claimId: string; gameId: number; raw: string; canonical: string; tsaTokenSha256: string };
export type SignedVerdictVerification = {
  ok: boolean; reason?: string | null; officialStart?: string | null; deadline?: string | null; verifiedAt?: string | null;
};
export type SignedVerdictVerify = (signedVerdict: unknown, expected: SignedVerdictExpected) => SignedVerdictVerification;
export type SignedVerdictDecision = {
  ok: boolean; reason: string | null; officialStart: string | null; deadline: string | null; verifiedAt: string | null;
};

/** The verifier package's assertSignedVerdict (pinned keys, canonical payload, Ed25519, accepted, exact claim, game and
 * hashes, verifiedAt ≤ signed deadline = signed official start − 60 min), as a non-throwing decision. */
export const verifySignedVerdict: SignedVerdictVerify = (signedVerdict, expected) => {
  try {
    const payload = assertSignedVerdict(signedVerdict as SignedVerdictRow | null, { claimId: expected.claimId, gameId: expected.gameId,
      rawSha256: expected.raw, canonicalSha256: expected.canonical, tsaTokenSha256: expected.tsaTokenSha256 }, WITNESS_SIGNING_KEYS);
    return { ok: true, officialStart: payload.officialStart, deadline: payload.deadline, verifiedAt: payload.verifiedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return { ok: false, reason: message.startsWith("witness_verdict_required:") ? message.slice("witness_verdict_required:".length) : "signed_verdict_unverifiable" };
  }
};

const HOUR = 3_600_000;
const instant = (value: unknown) => (typeof value === "string" && value ? Date.parse(value) : NaN);

/** Accept only a verified verdict whose signed official start is the claim's scheduled start and which was verified at
 * or before its signed deadline (official start − 60 min). */
export function checkSignedVerdict(signedVerdict: unknown, expected: SignedVerdictExpected, claimScheduledStart: string,
  verify: SignedVerdictVerify = verifySignedVerdict): SignedVerdictDecision {
  const decide = (reason: string | null, result?: SignedVerdictVerification): SignedVerdictDecision => ({ ok: reason === null, reason,
    officialStart: result?.officialStart ?? null, deadline: result?.deadline ?? null, verifiedAt: result?.verifiedAt ?? null });
  if (!signedVerdict) return decide("verdict_missing");
  let result: SignedVerdictVerification;
  try {
    result = verify(signedVerdict, expected);
  } catch {
    return decide("signed_verdict_unverifiable");
  }
  if (result.ok !== true) return decide(result.reason || "signed_verdict_invalid", result);
  const start = instant(result.officialStart), deadline = instant(result.deadline), verifiedAt = instant(result.verifiedAt);
  if (!Number.isFinite(start) || start !== instant(claimScheduledStart)) return decide("official_start_mismatch", result);
  if (!Number.isFinite(deadline) || deadline !== start - HOUR) return decide("deadline_mismatch", result);
  if (!Number.isFinite(verifiedAt) || verifiedAt > deadline) return decide("verified_late", result);
  return decide(null, result);
}

export type ClaimHashes = { claimId: string; gameId: number; scheduledStart: string; raw: string; canonical: string; tsaTokenSha256: string };

/** The claim's custody hashes (public.forge_live_claim_hashes_v1) and its signed verdict row, read through the verifier
 * package's Data API read (forge_witness_api.signed_verdict_v1); both as service_role, read-only. */
export async function loadSignedVerdictBinding(db: SupabaseClient, claimId: string, signal?: AbortSignal)
  : Promise<{ hashes: ClaimHashes; signedVerdict: unknown } | null> {
  const timed = <T extends { abortSignal: (s: AbortSignal) => T }>(call: T) => (signal ? call.abortSignal(signal) : call);
  const [hashes, signed] = await Promise.all([
    timed(db.rpc("forge_live_claim_hashes_v1", { p_claim: claimId })),
    timed(db.schema("forge_witness_api").rpc("signed_verdict_v1", { p_claim_id: claimId })),
  ]);
  if (hashes.error || signed.error || !hashes.data || typeof hashes.data !== "object") return null;
  const row = hashes.data as Record<string, unknown>;
  if (row.claimId !== claimId || typeof row.raw !== "string" || typeof row.canonical !== "string"
      || typeof row.tsaTokenSha256 !== "string" || typeof row.scheduledStart !== "string" || !Number.isSafeInteger(Number(row.gameId))) return null;
  return { hashes: { claimId, gameId: Number(row.gameId), scheduledStart: row.scheduledStart, raw: row.raw, canonical: row.canonical,
    tsaTokenSha256: row.tsaTokenSha256 }, signedVerdict: signed.data ?? null };
}

/** Load and decide in one step for one claim of this game. */
export async function gateSignedVerdict(db: SupabaseClient, claimId: string, gameId: number,
  verify: SignedVerdictVerify = verifySignedVerdict, signal?: AbortSignal): Promise<SignedVerdictDecision> {
  const none = (reason: string): SignedVerdictDecision => ({ ok: false, reason, officialStart: null, deadline: null, verifiedAt: null });
  const binding = await loadSignedVerdictBinding(db, claimId, signal).catch(() => null);
  if (!binding) return none("signed_verdict_unreadable");
  if (binding.hashes.gameId !== gameId) return none("claim_mismatch");
  const { raw, canonical, tsaTokenSha256, scheduledStart } = binding.hashes;
  return checkSignedVerdict(binding.signedVerdict, { claimId, gameId, raw, canonical, tsaTokenSha256 }, scheduledStart, verify);
}
