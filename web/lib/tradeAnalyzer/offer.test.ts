import { describe, expect, it } from "vitest";

import { assetsFromText, previewOffer, rosterFromText, type OfferInput, type OfferTeam, type TeamId } from "./offer";

const team = (id: TeamId, roster: string, capacity: number): OfferTeam => ({ id, name: `Team ${id}`, roster: rosterFromText(id, roster),
  rosterReviewed: true, totalCapacity: capacity, capacityReviewed: true, givePlayerIds: [], dropPlayerIds: [], otherAssets: [] });
function input(): OfferInput {
  const a = team("a", "A1 | C | active\nA2 | LW | bench\nA3 | D | IR", 3);
  const b = team("b", "B1 | RW | active\nB2 | C | bench\nB3 | D | IR", 3);
  a.givePlayerIds = [a.roster[0].id];
  b.givePlayerIds = [b.roster[0].id];
  return { effectiveDate: "2026-11-10", teams: [a, b] };
}
const ids = (roster: ReturnType<typeof previewOffer>["teams"][number]["after"]) => roster.status === "available" ? roster.value.map(player => player.name) : null;

describe("manual entered-offer preview", () => {
  it("applies the whole one-for-one exchange to both complete rosters without mutation or value claims", () => {
    const offer = input(), before = JSON.stringify(offer);
    const result = previewOffer(offer);
    expect(result.entryComplete).toBe(true);
    expect(ids(result.teams[0].after)).toEqual(["A2", "A3", "B1"]);
    expect(ids(result.teams[1].after)).toEqual(["B2", "B3", "A1"]);
    expect(JSON.stringify(offer)).toBe(before);
    for (const key of ["datedLegality", "valuation", "impact", "acceptance", "market"] as const) {
      expect(result[key].status).toBe("unavailable");
    }
  });

  it("requires an explicit drop for a two-for-one and includes the selected drop in the final roster", () => {
    const offer = input();
    offer.teams[1].givePlayerIds.push(offer.teams[1].roster[1].id);
    let result = previewOffer(offer);
    expect(result.entryComplete).toBe(false);
    expect(result.teams[0].capacity).toMatchObject({ status: "available", value: { beforeCount: 3, afterExchangeCount: 4, requiredDrops: 1, additionalDrops: 1 } });
    expect(ids(result.teams[0].after)).toEqual(["A2", "A3", "B1", "B2"]);
    expect(ids(result.teams[1].after)).toEqual(["B3", "A1"]);
    offer.teams[0].dropPlayerIds = [offer.teams[0].roster[1].id];
    result = previewOffer(offer);
    expect(result.entryComplete).toBe(true);
    expect(ids(result.teams[0].after)).toEqual(["A3", "B1", "B2"]);
    expect(result.teams[0].drops.map(player => player.name)).toEqual(["A2"]);
    expect(result.teams[0].capacity).toMatchObject({ status: "available", value: { afterCount: 3, additionalDrops: 0 } });
  });

  it("checks drops on either team, preserving reserve rows and separate before-limit violations", () => {
    const offer = input();
    offer.teams[0].givePlayerIds.push(offer.teams[0].roster[1].id);
    offer.teams[1].totalCapacity = 2;
    let result = previewOffer(offer);
    expect(result.issues.filter(issue => issue.teamId === "b").map(issue => issue.code)).toEqual(["before_capacity", "drop_required"]);
    expect(result.teams[1].capacity).toMatchObject({ value: { beforeExcess: 1, afterExchangeCount: 4, additionalDrops: 2 } });
    offer.teams[1].totalCapacity = 3;
    offer.teams[1].dropPlayerIds = [offer.teams[1].roster[1].id];
    result = previewOffer(offer);
    expect(result.entryComplete).toBe(true);
    expect(result.teams[1].after).toMatchObject({ value: [{ name: "B3", status: "IR" }, { name: "A1" }, { name: "A2" }] });
  });

  it("does not assume missing, invalid or unreviewed total capacity is free space", () => {
    for (const capacity of [null, -1, 1.5, 101]) {
      const offer = input(); offer.teams[0].totalCapacity = capacity;
      const result = previewOffer(offer);
      expect(result.teams[0].capacity.status).toBe("unavailable");
      expect(result.issues.some(issue => issue.code === "capacity_missing")).toBe(true);
      expect(ids(result.teams[0].after)).toEqual(["A2", "A3", "B1"]);
    }
    const offer = input(); offer.teams[1].capacityReviewed = false;
    expect(previewOffer(offer).teams[1].capacity.status).toBe("unavailable");
    const empty = team("a", "", 0); empty.otherAssets = assetsFromText("pick: conditional future pick");
    const result = previewOffer({ ...input(), teams: [empty, input().teams[1]] });
    expect(result.teams[0].capacity).toMatchObject({ value: { total: 0, additionalDrops: 1 } });
  });

  it("blocks duplicate and ambiguous identities or outgoing ownership on both exchange previews", () => {
    const cases = [input(), input(), input(), input()];
    cases[0].teams[1].roster[0].id = cases[0].teams[0].roster[0].id;
    cases[1].teams[1].roster[0].name = " a1 ";
    cases[2].teams[0].givePlayerIds = ["manual:b:1"];
    cases[3].teams[0].givePlayerIds.push(cases[3].teams[0].givePlayerIds[0]);
    for (const offer of cases) {
      const result = previewOffer(offer);
      expect(result.entryComplete).toBe(false);
      expect(result.teams.map(preview => preview.after.status)).toEqual(["unavailable", "unavailable"]);
    }
  });

  it("rejects exchanged, incoming, nonexistent or repeated drops instead of removing a player twice", () => {
    for (const dropIds of [["manual:a:1"], ["manual:b:1"], ["missing"], ["manual:a:2", "manual:a:2"]]) {
      const offer = input(); offer.teams[0].dropPlayerIds = dropIds;
      const result = previewOffer(offer);
      expect(result.issues.some(issue => issue.code === "invalid_drop")).toBe(true);
      expect(result.teams[0].after.status).toBe("unavailable");
      expect(result.teams[0].capacity.status).toBe("unavailable");
    }
  });

  it("preserves complete pick conditions and unknown text without roster slots, inferred identities or prices", () => {
    const offer = input();
    offer.teams[0].otherAssets = assetsFromText("pick: 2027 second, original owner unknown, conditional on playoffs\nUnresolved rights / future considerations");
    const before = JSON.stringify(offer);
    const result = previewOffer(offer);
    expect(result.entryComplete).toBe(true);
    expect(offer.teams[0].otherAssets).toEqual([
      { kind: "pick", rawText: "2027 second, original owner unknown, conditional on playoffs", season: null, round: null, originalOwnerText: null, conditionText: null },
      { kind: "unknown", rawText: "Unresolved rights / future considerations" },
    ]);
    expect(result.teams[0].capacity).toMatchObject({ value: { afterCount: 3 } });
    expect(JSON.stringify(offer)).toBe(before);
  });

  it("keeps repeated or incomplete assets for correction and enforces support bounds", () => {
    const offer = input();
    offer.teams[0].otherAssets = assetsFromText("pick: same description\npick: same description\npick:");
    expect(previewOffer(offer).issues.map(issue => issue.code)).toEqual(["asset_text", "duplicate_asset"]);
    expect(offer.teams[0].otherAssets).toHaveLength(3);
    offer.teams[0].roster = rosterFromText("a", Array.from({ length: 101 }, (_, i) => `Synthetic ${i}`).join("\n"));
    expect(previewOffer(offer).issues.some(issue => issue.code === "roster_limit")).toBe(true);
    offer.teams[1].otherAssets = assetsFromText(Array.from({ length: 21 }, (_, i) => `pick: distinct ${i}`).join("\n"));
    expect(previewOffer(offer).issues.some(issue => issue.code === "asset_limit")).toBe(true);
  });

  it("requires dates, named sides, roster review and nonempty offers without inventing legality", () => {
    const offer = input();
    offer.effectiveDate = "2026-02-30";
    offer.teams[1].name = offer.teams[0].name;
    offer.teams[0].rosterReviewed = false;
    offer.teams[1].givePlayerIds = [];
    const result = previewOffer(offer);
    expect(result.entryComplete).toBe(false);
    expect(result.issues.map(issue => issue.code)).toEqual(["effective_date", "team_names", "roster_review", "empty_side", "drop_required"]);
    expect(result.datedLegality.status).toBe("unavailable");
  });
});
