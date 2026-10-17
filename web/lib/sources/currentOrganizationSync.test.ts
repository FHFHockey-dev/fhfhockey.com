import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { currentOrganizationReceipt, syncCurrentCanonicalOrganizations } from "./currentOrganizationSync";

const players = [{ id: 8474141, teamId: 16, teamName: "Chicago Blackhawks", teamAbbreviation: "CHI" },
  { id: 8474590, teamId: 14, teamName: "Tampa Bay Lightning", teamAbbreviation: "TBL" }];
const input = { seasonId: 20262027, observedAt: "2026-10-13T20:00:00.000Z", complete: true, players };

describe("completed native roster organization receipt", () => {
  it("binds both offseason moves to current-roster sources without using historical teams", () => {
    const result = currentOrganizationReceipt(input);
    expect(result.receipt.players).toEqual([
      { nhlPlayerId: 8474141, teamId: 16, organizationName: "Chicago Blackhawks", sourceUrl: "https://api-web.nhle.com/v1/roster/CHI/current" },
      { nhlPlayerId: 8474590, teamId: 14, organizationName: "Tampa Bay Lightning", sourceUrl: "https://api-web.nhle.com/v1/roster/TBL/current" },
    ]);
    expect(result.receiptHash).toBe(createHash("sha256").update(result.serialized).digest("hex"));
    expect(result.serialized).not.toContain("verification_status");
  });
  it("is deterministic for reordered input and cannot hash a mutated binding identically", () => {
    const original = currentOrganizationReceipt(input);
    expect(currentOrganizationReceipt({ ...input, players: [...players].reverse() })).toEqual(original);
    expect(currentOrganizationReceipt({ ...input, players: [{ ...players[0], teamId: 17 }, players[1]] }).receiptHash).not.toBe(original.receiptHash);
    expect(input.players).toEqual(players);
  });
  it.each([
    { complete: false }, { seasonId: 20252026 }, { observedAt: "not-a-time" }, { players: [] },
    { players: [players[0], { ...players[0], teamId: 17 }] },
    { players: [{ ...players[0], id: 9005 }] }, { players: [{ ...players[0], teamId: 0 }] },
    { players: [{ ...players[0], teamName: " " }] }, { players: [{ ...players[0], teamAbbreviation: "CHI/current" }] },
    { players: Array.from({ length: 2001 }, (_, index) => ({ ...players[0], id: 8_000_000 + index })) },
  ])("rejects incomplete, historical or conflicting evidence before RPC: %j", async overrides => {
    const rpc = vi.fn();
    await expect(syncCurrentCanonicalOrganizations({ rpc }, { ...input, ...overrides })).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("uses the offseason roster rollover rather than the previous statistical season", () => {
    expect(currentOrganizationReceipt({ ...input, observedAt: "2026-07-01T00:00:00Z" }).receipt.seasonId).toBe(20262027);
    expect(() => currentOrganizationReceipt({ ...input, observedAt: "2026-06-30T23:59:59Z" })).toThrow();
  });
  it("passes only the source-bound receipt to the restricted RPC and validates its returned hash", async () => {
    const rpc = vi.fn(async (_name, args) => ({ data: { receiptHash: args.p_receipt_hash, changedIds: [9005, 9016], skipped: [] }, error: null }));
    expect(await syncCurrentCanonicalOrganizations({ rpc }, input)).toMatchObject({ changedIds: [9005, 9016] });
    expect(rpc).toHaveBeenCalledWith("sync_current_canonical_organizations", {
      p_receipt_text: currentOrganizationReceipt(input).serialized, p_receipt_hash: currentOrganizationReceipt(input).receiptHash,
    });
    await expect(syncCurrentCanonicalOrganizations({ rpc: async () => ({ data: { receiptHash: "wrong", changedIds: [], skipped: [] } }) }, input)).rejects.toThrow("invalid receipt");
  });
  it("propagates apply failure without claiming a successful sync", async () => {
    await expect(syncCurrentCanonicalOrganizations({ rpc: async () => ({ error: new Error("membership changed") }) }, input)).rejects.toThrow("membership changed");
  });
});
