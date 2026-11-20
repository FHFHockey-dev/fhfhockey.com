import { describe, expect, it, vi } from "vitest";
import { checkSignedVerdict, gateSignedVerdict, type SignedVerdictExpected, type SignedVerdictVerify } from "./signedVerdictGate";

const start = "2026-11-20T03:00:00.000Z", claimId = "c1aa0000-0000-4000-8000-000000000001";
const expected: SignedVerdictExpected = { claimId, gameId: 2026020358, raw: "a".repeat(64), canonical: "b".repeat(64),
  tsaTokenSha256: "c".repeat(64), release: "f".repeat(40) };
const signed = (payload: Record<string, unknown> = {}) => ({ signature: "sig", payload: { verdict: "accepted", officialStart: start, ...payload } });
const ok = (over: Partial<ReturnType<SignedVerdictVerify>> = {}): SignedVerdictVerify =>
  () => ({ ok: true, deadline: "2026-11-20T02:00:00.000Z", verifiedAt: "2026-11-20T01:58:00.000Z", ...over });

describe("signed verdict gate", () => {
  it("accepts a signature-valid accepted verdict for the claim's own start, verified by official start − 60 min", () => {
    expect(checkSignedVerdict(signed(), expected, start, ok())).toMatchObject({ ok: true, reason: null, officialStart: start });
  });

  it("fails closed until the verifier package is bound, and on a missing, throwing or invalid signature", () => {
    expect(checkSignedVerdict(signed(), expected, start).reason).toBe("signed_verdict_verifier_not_integrated");
    expect(checkSignedVerdict(null, expected, start, ok()).reason).toBe("signed_verdict_missing");
    expect(checkSignedVerdict(signed(), expected, start, () => { throw new Error("x"); }).reason).toBe("signed_verdict_unverifiable");
    expect(checkSignedVerdict(signed(), expected, start, () => ({ ok: false, reason: "bad_signature" })).reason).toBe("bad_signature");
  });

  it("refuses a rejected verdict, a different official start, a deadline that is not start − 60 min, and a late verdict", () => {
    expect(checkSignedVerdict(signed({ verdict: "rejected" }), expected, start, ok()).reason).toBe("signed_verdict_not_accepted");
    expect(checkSignedVerdict(signed({ officialStart: "2026-11-20T02:55:00.000Z" }), expected, start, ok()).reason).toBe("official_start_mismatch");
    expect(checkSignedVerdict(signed(), expected, start, ok({ deadline: "2026-11-20T02:10:00.000Z" })).reason).toBe("deadline_mismatch");
    expect(checkSignedVerdict(signed(), expected, start, ok({ verifiedAt: "2026-11-20T02:00:00.001Z" })).reason).toBe("verified_late");
    expect(checkSignedVerdict(signed(), expected, start, ok({ verifiedAt: "2026-11-20T02:00:00.000Z" })).ok).toBe(true);
  });

  it("binds the verification to the stored custody hashes and this release, and refuses another game's claim", async () => {
    const row = { claimId, gameId: 2026020358, scheduledStart: start, raw: "a".repeat(64), canonical: "b".repeat(64),
      tsaTokenSha256: "c".repeat(64), signedVerdict: signed() };
    const db = { rpc: vi.fn(async () => ({ data: row, error: null })) };
    const verify = vi.fn(ok());
    expect((await gateSignedVerdict(db as never, claimId, 2026020358, "f".repeat(40), verify)).ok).toBe(true);
    expect(db.rpc).toHaveBeenCalledWith("forge_live_signed_verdict_v1", { p_claim: claimId });
    expect(verify).toHaveBeenCalledWith(row.signedVerdict, expected);
    expect((await gateSignedVerdict(db as never, claimId, 2026020357, "f".repeat(40), verify)).reason).toBe("claim_mismatch");
    const unreadable = { rpc: vi.fn(async () => ({ data: null, error: { message: "boom" } })) };
    expect((await gateSignedVerdict(unreadable as never, claimId, 2026020358, "f".repeat(40), verify)).reason).toBe("signed_verdict_unreadable");
  });
});
