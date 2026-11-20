import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
import { canonicalJson } from "./packet";
import { POLICY_ID } from "./policy";
import { MICROS_PER_MINUTE, parseInstantMicros } from "./time";
import { WITNESS_SIGNING_KEYS } from "./witnessSigningKeys";

/**
 * Signed verdicts of the independent FORGE witness: the release-side check used by the publication gate, the readers
 * and the offline acceptance audit. The database only stores (payload, signature); nothing it holds is trusted. A
 * verdict passes only if its Ed25519 signature verifies under a key pinned in witnessSigningKeys.ts, its canonical
 * payload names exactly this claim, game and these hashes, it is "accepted", and it was decided at or before its
 * deadline, which is the official NHL start − 60 min as the verifier observed it.
 */

export const SIGNED_VERDICT_VERSION = "forge-witness-signed-verdict-v1";

export interface SignedVerdictPayload {
  version: typeof SIGNED_VERDICT_VERSION;
  keyId: string;
  claimId: string;
  gameId: number;
  policyId: string;
  rawSha256: string | null;
  canonicalSha256: string | null;
  tsaTokenSha256: string | null;
  statementSha256: string | null;
  inputCutoff: string;
  verdict: "accepted" | "rejected";
  reason: string | null;
  verifiedAt: string;
  officialStart: string;
  deadline: string;
  release: string;
}

export interface SignedVerdictRow { payload: string; signature: string }
export interface SignedVerdictExpectation { claimId: string; gameId: number; rawSha256: string; canonicalSha256: string; tsaTokenSha256: string }
export type SignedVerdictRefusal = "verdict_missing" | "payload_invalid" | "key_unpinned" | "signature_invalid" | "verdict_rejected"
  | "binding_mismatch" | "verified_late";
export interface SignedVerdictCheck { accepted: boolean; reason: SignedVerdictRefusal | null; payload: SignedVerdictPayload | null }

const HEX64 = /^[0-9a-f]{64}$/;
const B64URL32 = /^[A-Za-z0-9_-]{43}$/;

/** keyId of a raw Ed25519 public key given as base64url. */
export function witnessKeyId(rawPublicKeyB64url: string): string {
  return createHash("sha256").update(Buffer.from(rawPublicKeyB64url, "base64url") as unknown as Uint8Array).digest("hex").slice(0, 16);
}

/** Structural check of a payload (no signature): every field present, typed, and internally consistent. */
export function payloadProblem(p: SignedVerdictPayload): string | null {
  try {
    if (p.version !== SIGNED_VERDICT_VERSION || !/^[0-9a-f]{16}$/.test(p.keyId) || typeof p.claimId !== "string"
      || !Number.isSafeInteger(p.gameId) || p.gameId <= 0 || p.policyId !== POLICY_ID
      || !["accepted", "rejected"].includes(p.verdict) || (p.verdict === "accepted") !== (p.reason === null)
      || !HEX64.test(p.release)) return "fields";
    for (const hash of [p.rawSha256, p.canonicalSha256, p.tsaTokenSha256, p.statementSha256]) {
      if (hash !== null && !HEX64.test(hash)) return "hash";
      if (p.verdict === "accepted" && hash === null) return "hash";
    }
    for (const instant of [p.inputCutoff, p.verifiedAt, p.officialStart, p.deadline]) parseInstantMicros(instant);
    if (parseInstantMicros(p.deadline) !== parseInstantMicros(p.officialStart) - BigInt(60) * MICROS_PER_MINUTE) return "deadline";
    return null;
  } catch {
    return "instant";
  }
}

export function checkSignedVerdict(row: SignedVerdictRow | null | undefined, expect: SignedVerdictExpectation,
  keys: Readonly<Record<string, string>> = WITNESS_SIGNING_KEYS): SignedVerdictCheck {
  const refuse = (reason: SignedVerdictRefusal, payload: SignedVerdictPayload | null = null): SignedVerdictCheck =>
    ({ accepted: false, reason, payload });
  if (!row || typeof row.payload !== "string" || typeof row.signature !== "string") return refuse("verdict_missing");
  let payload: SignedVerdictPayload;
  try {
    payload = JSON.parse(row.payload) as SignedVerdictPayload;
    // The signature covers these exact bytes; only canonical JSON is accepted, so one verdict has one encoding.
    if (canonicalJson(payload) !== row.payload || payloadProblem(payload)) return refuse("payload_invalid");
  } catch {
    return refuse("payload_invalid");
  }
  const key = Object.prototype.hasOwnProperty.call(keys, payload.keyId) ? keys[payload.keyId] : undefined;
  if (!key || !B64URL32.test(key) || witnessKeyId(key) !== payload.keyId) return refuse("key_unpinned", payload);
  let valid = false;
  try {
    const signature = Buffer.from(row.signature, "base64");
    const publicKey = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: key }, format: "jwk" });
    valid = signature.length === 64 && row.signature === signature.toString("base64")
      && verifySignature(null, Buffer.from(row.payload, "utf8") as unknown as Uint8Array, publicKey, signature as unknown as Uint8Array);
  } catch {
    valid = false;
  }
  if (!valid) return refuse("signature_invalid", payload);
  if (payload.verdict !== "accepted") return refuse("verdict_rejected", payload);
  if (payload.claimId !== expect.claimId || payload.gameId !== expect.gameId || payload.rawSha256 !== expect.rawSha256
    || payload.canonicalSha256 !== expect.canonicalSha256 || payload.tsaTokenSha256 !== expect.tsaTokenSha256) {
    return refuse("binding_mismatch", payload);
  }
  if (parseInstantMicros(payload.verifiedAt) > parseInstantMicros(payload.deadline)) return refuse("verified_late", payload);
  return { accepted: true, reason: null, payload };
}

/** Throws unless the signed verdict passes; for the publish route and the readers. */
export function assertSignedVerdict(row: SignedVerdictRow | null | undefined, expect: SignedVerdictExpectation,
  keys: Readonly<Record<string, string>> = WITNESS_SIGNING_KEYS): SignedVerdictPayload {
  const check = checkSignedVerdict(row, expect, keys);
  if (!check.accepted || !check.payload) throw new Error(`witness_verdict_required:${check.reason}`);
  return check.payload;
}
