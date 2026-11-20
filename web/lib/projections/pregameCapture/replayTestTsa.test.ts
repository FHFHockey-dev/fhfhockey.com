import { describe, expect, it } from "vitest";
import { mintTimeStampResponse, testTsaTrust } from "./__fixtures__/testTsa";
import { buildTimeStampRequest, extractToken, verifyTimeStampToken } from "./rfc3161";
import { mintReplayTimestamp, replayTestTsaTrust } from "./replayTestTsa";

describe("replay test TSA", () => {
  it("mints exactly the fixture TSA's response and verifies under its trust only", () => {
    const digest = Buffer.alloc(32, 7);
    const nonce = BigInt(123456789);
    const request = buildTimeStampRequest(digest, nonce);
    const genTimeMicros = BigInt(Date.parse("2026-11-21T01:40:00.123Z")) * BigInt(1000);
    const replay = mintReplayTimestamp(request, genTimeMicros, BigInt(1));
    expect(replay.toString("hex")).toBe(mintTimeStampResponse(request, { genTimeMicros }).toString("hex"));
    expect(replayTestTsaTrust().anchorsPem.map(p => p.trim())).toEqual(testTsaTrust().anchorsPem.map(p => p.trim()));
    expect(replayTestTsaTrust().policies).toEqual(testTsaTrust().policies);
    const verified = verifyTimeStampToken(extractToken(replay), { sha256Digest: digest, nonce }, replayTestTsaTrust());
    expect(verified.genTime).toBe("20261121014000.123Z");
  });
});
