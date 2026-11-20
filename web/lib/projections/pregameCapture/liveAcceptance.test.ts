import { describe, expect, it } from "vitest";
import { assessLiveAcceptance, type AcceptanceEvidence } from "./liveAcceptance";
import type { SignedVerdictVerify } from "./signedVerdictGate";

const claimId = "c1aa0000-0000-4000-8000-000000000001", revisionId = "r1aa0000-0000-4000-8000-000000000001";
const start = "2026-11-20T03:00:00.000Z";
const good = (): AcceptanceEvidence => ({
  gameId: 2026020358,
  release: "f".repeat(40),
  game: { startTime: start },
  run: { outcome: "succeeded", claimId, revisionId, scheduledStart: start, publishFinishedAt: "2026-11-20T02:05:10.000Z",
    readers: { daily: { selectedRun: claimId, revisionId: `forge-daily-bridge-v1:${claimId}`, points: 2.9 },
      detailed: { selectedRun: claimId, revisionId, points: null, reason: "missing_participation" } } },
  claim: { id: claimId, gameId: 2026020358, scheduledStart: start },
  outcome: "qualified",
  artifact: { rawSha256: "a".repeat(64), canonicalSha256: "b".repeat(64) },
  witness: { tsaTokenSha256: "c".repeat(64) },
  signedVerdict: { sig: "valid", payload: { verdict: "accepted", officialStart: start } },
  publications: [{ claimId, revisionId, rawSha256: "a".repeat(64), canonicalSha256: "b".repeat(64) }],
});
const valid: SignedVerdictVerify = (signed, expected) =>
  (signed as { sig?: string })?.sig === "valid" && expected.claimId === claimId && expected.raw === "a".repeat(64) && expected.release === "f".repeat(40)
    ? { ok: true, deadline: "2026-11-20T02:00:00.000Z", verifiedAt: "2026-11-20T01:55:00.000Z" } : { ok: false, reason: "bad_signature" };
const failed = (r: Awaited<ReturnType<typeof assessLiveAcceptance>>) => r.checks.filter(c => !c.ok).map(c => c.name);

describe("live acceptance audit", () => {
  it("accepts a run whose signed verdict, single publication and both readers bind to the same claim", async () => {
    const result = await assessLiveAcceptance(good(), valid);
    expect(result.accepted).toBe(true);
    expect(result.checks.map(c => c.name)).toEqual(["run_succeeded", "custody_qualified", "signed_verdict",
      "exactly_one_publication", "published_before_puck_drop", "daily_reader_on_claim", "detailed_reader_on_revision"]);
  });

  it("rejects a publication without a valid signed verdict, whatever the database gate said", async () => {
    const e = good(); e.signedVerdict = null;
    expect(failed(await assessLiveAcceptance(e, valid))).toEqual(["signed_verdict"]);
    expect(failed(await assessLiveAcceptance(good(), () => { throw new Error("no key"); }))).toEqual(["signed_verdict"]);
  });

  it("fails closed with the unbound seam, and uses the signed official start, not the database's", async () => {
    expect((await assessLiveAcceptance(good())).checks.find(c => c.name === "signed_verdict")?.detail)
      .toBe("rejected:signed_verdict_verifier_not_integrated");
    const moved = good(); (moved.signedVerdict as { payload: { officialStart: string } }).payload.officialStart = "2026-11-20T02:50:00.000Z";
    expect((await assessLiveAcceptance(moved, valid)).checks.find(c => c.name === "signed_verdict")?.detail).toBe("rejected:official_start_mismatch");
  });

  it("requires exactly one publication for the game, on that claim and its hashes", async () => {
    const two = good(); two.publications.push({ ...two.publications[0], claimId: "other" });
    expect(failed(await assessLiveAcceptance(two, valid))).toEqual(["exactly_one_publication"]);
    const none = good(); none.publications = [];
    expect(failed(await assessLiveAcceptance(none, valid))).toEqual(["exactly_one_publication"]);
    const forged = good(); forged.publications[0].canonicalSha256 = "d".repeat(64);
    expect(failed(await assessLiveAcceptance(forged, valid))).toEqual(["exactly_one_publication"]);
  });

  it("rejects readers that name another run or revision, and a publication at or after puck drop", async () => {
    const e = good();
    e.run!.readers!.daily!.selectedRun = "daily-run";
    e.run!.readers!.detailed!.revisionId = "other";
    e.run!.publishFinishedAt = start;
    expect(failed(await assessLiveAcceptance(e, valid))).toEqual(["published_before_puck_drop", "daily_reader_on_claim", "detailed_reader_on_revision"]);
  });
});
