import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalJson } from "./packet";
import { POLICY_ID } from "./policy";
import { SIGNED_VERDICT_VERSION, witnessKeyId, type SignedVerdictPayload } from "./signedVerdict";
import { checkSignedVerdict, gateSignedVerdict, type SignedVerdictExpected } from "./signedVerdictGate";
import { WITNESS_SIGNING_KEYS } from "./witnessSigningKeys";

const start = "2026-11-20T03:00:00.000000Z", claimId = "c1aa0000-0000-4000-8000-000000000001";
const expected: SignedVerdictExpected = { claimId, gameId: 2026020358, raw: "a".repeat(64), canonical: "b".repeat(64), tsaTokenSha256: "c".repeat(64) };
// TEST-ONLY key, pinned into the in-memory map for one test at a time and removed after it; never shipped.
const pair = generateKeyPairSync("ed25519");
const x = pair.publicKey.export({ format: "jwk" }).x!, keyId = witnessKeyId(x);
const pinTestKey = () => Object.assign(WITNESS_SIGNING_KEYS, { [keyId]: x });
afterEach(() => { delete WITNESS_SIGNING_KEYS[keyId]; vi.restoreAllMocks(); });

function signed(over: Partial<SignedVerdictPayload> = {}) {
  const payload: SignedVerdictPayload = { version: SIGNED_VERDICT_VERSION, keyId, claimId, gameId: 2026020358, policyId: POLICY_ID,
    rawSha256: "a".repeat(64), canonicalSha256: "b".repeat(64), tsaTokenSha256: "c".repeat(64), statementSha256: "d".repeat(64),
    inputCutoff: "2026-11-20T01:40:00.000000Z", verdict: "accepted", reason: null, verifiedAt: "2026-11-20T01:58:00.000000Z",
    officialStart: start, deadline: "2026-11-20T02:00:00.000000Z", release: "e".repeat(64), ...over };
  const text = canonicalJson(payload);
  return { payload: text, signature: sign(null, Buffer.from(text, "utf8") as unknown as Uint8Array, pair.privateKey).toString("base64") };
}

describe("signed verdict gate (bound to the verifier package)", () => {
  it("refuses a verdict signed by any key the release does not pin (the shipped state pins only production's key)", () => {
    expect(Object.keys(WITNESS_SIGNING_KEYS)).not.toContain(keyId);
    expect(checkSignedVerdict(signed(), expected, start)).toMatchObject({ ok: false, reason: "key_unpinned" });
    expect(checkSignedVerdict(null, expected, start).reason).toBe("verdict_missing");
  });

  it("accepts a verdict signed by a pinned key for exactly this claim, its start and its deadline", () => {
    pinTestKey();
    expect(checkSignedVerdict(signed(), expected, start))
      .toMatchObject({ ok: true, reason: null, officialStart: start, deadline: "2026-11-20T02:00:00.000000Z", verifiedAt: "2026-11-20T01:58:00.000000Z" });
  });

  it("refuses another key, a tampered payload, another claim's hashes, a rejected or late verdict, and a different official start", () => {
    pinTestKey();
    const other = generateKeyPairSync("ed25519");
    const forged = signed(); forged.signature = sign(null, Buffer.from(forged.payload, "utf8") as unknown as Uint8Array, other.privateKey).toString("base64");
    expect(checkSignedVerdict(forged, expected, start).reason).toBe("signature_invalid");
    const tampered = signed(); tampered.payload = tampered.payload.replace("a".repeat(64), "f".repeat(64));
    expect(checkSignedVerdict(tampered, expected, start).reason).toBe("signature_invalid");
    expect(checkSignedVerdict(signed({ canonicalSha256: "f".repeat(64) }), expected, start).reason).toBe("binding_mismatch");
    expect(checkSignedVerdict(signed({ verdict: "rejected", reason: "token_invalid" }), expected, start).reason).toBe("verdict_rejected");
    expect(checkSignedVerdict(signed({ verifiedAt: "2026-11-20T02:00:00.000001Z" }), expected, start).reason).toBe("verified_late");
    const moved = signed({ officialStart: "2026-11-20T02:55:00.000000Z", deadline: "2026-11-20T01:55:00.000000Z", verifiedAt: "2026-11-20T01:50:00.000000Z" });
    expect(checkSignedVerdict(moved, expected, start).reason).toBe("official_start_mismatch");
  });

  it("reads custody hashes and the signed row through their read-only RPCs and refuses another game's claim", async () => {
    pinTestKey();
    const row = signed();
    const hashes = { claimId, gameId: 2026020358, scheduledStart: start, raw: "a".repeat(64), canonical: "b".repeat(64), tsaTokenSha256: "c".repeat(64) };
    const call = (data: unknown) => ({ abortSignal() { return this; }, then: (resolve: (v: unknown) => void) => resolve({ data, error: null }) });
    const witnessRpc = vi.fn(() => call(row));
    const db = { rpc: vi.fn(() => call(hashes)), schema: vi.fn(() => ({ rpc: witnessRpc })) };
    expect((await gateSignedVerdict(db as never, claimId, 2026020358)).ok).toBe(true);
    expect(db.rpc).toHaveBeenCalledWith("forge_live_claim_hashes_v1", { p_claim: claimId });
    expect(db.schema).toHaveBeenCalledWith("forge_witness_api");
    expect(witnessRpc).toHaveBeenCalledWith("signed_verdict_v1", { p_claim_id: claimId });
    expect((await gateSignedVerdict(db as never, claimId, 2026020357)).reason).toBe("claim_mismatch");
  });
});
