import { describe, expect, it } from "vitest";
import {
  allocate,
  canComplete,
  commitPick,
  decide,
  delayMs,
  makeRoom,
  newSession,
  seatAt,
  slots,
  waitUntilNext,
} from "./engine";
import type { MockConfig, MockPlayer, MockSession } from "./contracts";
import { contrarianAdjustment, normalizeSuppliedResearch, researchAvailable, reviewedResearch, validateResearch } from "./research";
import suppliedResearch from "components/DraftDashboard/mock-sleepers-value-list.json";

export function fixture(count = 4, tier: "free" | "pro" = "free") {
  const config: MockConfig = {
    season: "20262027",
    teamCount: count,
    leagueType: "points",
    scoring: { GOALS: 1 },
    goalieScoring: {},
    roster: { C: 1, LW: 1, D: 1, G: 1, bench: 1, utility: 0 },
    grouping: "split",
    userSeat: 0,
    seconds: 30,
    timeout: "autopick",
    tier,
    bots: [],
  };
  config.bots = makeRoom(config, "room");
  const players: MockPlayer[] = Array.from({ length: count * 10 }, (_, i) => ({
    id: String(i + 1),
    name: `Player ${i}`,
    team: "",
    positions: [["C"], ["LW"], ["D"], ["G"], ["C", "LW"]][i % 5],
    value: 200 - i,
    adp: i + 1,
    workload: i % 5 === 3 ? 60 - i / 4 : null,
    workloadKind: "starts",
    categories: {},
  }));
  return { config, players };
}
function run(seed: string, count = 4, tier: "free" | "pro" = "free") {
  const { config, players } = fixture(count, tier);
  let s = {
    ...newSession(config, players, seed, "id", null, false),
    status: "running",
  } as MockSession;
  while (s.status !== "complete") {
    const decision = decide(s);
    s = commitPick(
      s,
      decision.playerId,
      seatAt(s.picks.length + 1, count) === config.userSeat ? "human" : "bot",
    );
  }
  return s;
}
describe("mock engine", () => {
  it("normalizes all supplied identities, citations, and season without inventing goalie starts", () => {
    expect(reviewedResearch.season).toBe("20262027");
    expect(reviewedResearch.players).toHaveLength(44);
    expect(new Set(reviewedResearch.players.map(p => p.playerId)).size).toBe(44);
    expect(reviewedResearch.players.every(p => p.citations.length > 0)).toBe(true);
    expect(reviewedResearch.players.find(p => p.playerId === "8484210")?.thesis).toBeTruthy();
    expect(reviewedResearch.players.some(p => p.playerId === "8483678")).toBe(false);
    expect(reviewedResearch.players.find(p => p.playerId === "8482661")?.workload).toBeNull();
    expect(() => normalizeSuppliedResearch({ ...suppliedResearch, players: [{ ...suppliedResearch.players[0], nhlPlayerId: null }] })).toThrow();
    expect(() => normalizeSuppliedResearch({ ...suppliedResearch, players: [suppliedResearch.players[0], suppliedResearch.players[0]] })).toThrow(/Duplicate/);
  });
  it("enables Contrarian only in Pro rooms for the research season", () => {
    const { config } = fixture(12, "pro");
    expect(makeRoom(config, "research").some(b => b.personality === "Contrarian")).toBe(true);
    expect(makeRoom({ ...config, tier: "free" }, "research").some(b => b.personality === "Contrarian")).toBe(false);
    expect(makeRoom({ ...config, season: "20272028" }, "research").some(b => b.personality === "Contrarian")).toBe(false);
    expect(researchAvailable("20272028")).toBe(false);
  });
  it("applies bounded upside and fade adjustments only to the pinned research version", () => {
    const { config, players } = fixture(4, "pro");
    players[0].id = "8480015"; // Owen Tippett: sleeper/value.
    players[1].id = "8476945"; // Hellebuyck: bounce-back with an explicit fade.
    const session = newSession(config, players, "research", "id", null, false);
    const profile = { personality: "Contrarian" as const, variation: 0.5 };
    const withResearch = decide(session, profile);
    const withoutResearch = decide({ ...session, researchVersion: null }, profile);
    for (const playerId of ["8480015", "8476945"]) {
      const entry = reviewedResearch.players.find(p => p.playerId === playerId)!;
      expect(withResearch.shortlist.find(p => p.playerId === playerId)!.score - withoutResearch.shortlist.find(p => p.playerId === playerId)!.score).toBeCloseTo(contrarianAdjustment(entry));
    }
    const mixed = reviewedResearch.players.find(p => p.playerId === "8484227")!; // Will Smith: breakout/bust risk.
    expect(contrarianAdjustment(mixed)).toBeGreaterThan(0);
    expect(contrarianAdjustment(mixed)).toBeLessThan(contrarianAdjustment({ ...mixed, tags: ["breakout"] }));
    expect(contrarianAdjustment({ ...mixed, tags: ["breakout", "fade"] })).toBeLessThan(0);
    expect(decide({ ...session, researchVersion: "different-version" }, profile)).toEqual(withoutResearch);
  });
  it("prioritizes starters over bench regardless of imported roster key order", () => {
    expect(slots({ roster: { bench: 4, utility: 1, G: 2, C: 2 }, grouping: "split" })).toEqual(["C", "C", "G", "G", "utility", "bench", "bench", "bench", "bench"]);
  });
  it("rejects research from a different season or unresolved identities", () => {
    const { players } = fixture();
    const data = {
      version: "research-1",
      season: "20262027",
      researchedAt: "2026-09-17",
      players: [
        {
          playerId: "1",
          tags: ["sleeper"],
          confidence: "high",
          formats: ["points"],
          workload: null,
          citations: ["https://example.com/research"],
        },
      ],
    };
    expect(validateResearch(data, "20262027", players).version).toBe(
      "research-1",
    );
    expect(() => validateResearch(data, "20272028", players)).toThrow(/season/);
    expect(() => validateResearch(data, "20262027", players.slice(1))).toThrow(
      /identities/,
    );
  });
  it("replays exactly while different seeds vary legal completed drafts", () => {
    const a = run("a"),
      b = run("b");
    expect(a.picks).toEqual(run("a").picks);
    expect(a.picks).not.toEqual(b.picks);
    expect(new Set(a.picks.map((p) => p.playerId)).size).toBe(a.picks.length);
    expect(canComplete(a)).toBe(true);
  });
  it("calculates actual snake horizons", () => {
    expect(waitUntilNext(12, 12)).toBe(0);
    expect(waitUntilNext(13, 12)).toBe(22);
    expect(waitUntilNext(1, 12)).toBe(22);
    expect(waitUntilNext(6, 12)).toBe(12);
  });
  it("reassigns multi-position players without consuming an unnecessary bench", () => {
    const { players } = fixture();
    expect(
      allocate(
        [{ ...players[0], positions: ["C", "LW"] }, players[0]],
        ["C", "LW"],
      ).size,
    ).toBe(2);
  });
  it("separates clocks, rejects duplicates, and never collects timeout picks", () => {
    const { config, players } = fixture();
    let s = {
      ...newSession(config, players, "x", "id", "user", true),
      status: "running",
    } as MockSession;
    const before = decide(s);
    expect(delayMs(s)).toBeGreaterThan(0);
    expect(decide(s)).toEqual(before);
    s = commitPick(s, before.playerId, "timeout");
    expect(s.picks[0].contributes).toBe(false);
    expect(commitPick(s, players[1].id, "bot", [], 1)).toBe(s);
  });
  it("blocks insufficient pools and runs Pro specialists", () => {
    const { config, players } = fixture();
    expect(() =>
      newSession(
        config,
        players.filter((p) => !p.positions.includes("G")),
        "a",
        "id",
        null,
        false,
      ),
    ).toThrow(/pool/);
    expect(run("pro", 4, "pro").picks).toHaveLength(20);
  });
  it("supports team boundaries and zero-goalie combined-forward category rosters", () => {
    for (const count of [2, 40]) {
      const { config, players } = fixture(count);
      config.roster = { FWD: 1, D: 1, bench: 0, utility: 0 };
      config.grouping = "fwd";
      config.leagueType = "categories";
      players.forEach((p) => {
        if (p.positions.some((v) => v === "C" || v === "LW"))
          p.positions = ["FWD"];
      });
      const s = newSession(config, players, "a", "id", null, false);
      expect(canComplete(s)).toBe(true);
      expect(slots(config).sort()).toEqual(["D", "FWD"]);
    }
  });
  it("scales feasibility to forty teams and distinguishes goalie strategies", () => {
    const { config, players } = fixture(40, "pro");
    config.roster = { C: 2, LW: 2, D: 2, G: 1, bench: 1 };
    const s = newSession(config, players, "large", "id", null, false);
    expect(decide(s).shortlist.length).toBeGreaterThan(0);
    const small = fixture(4, "pro");
    small.players.forEach((p) => {
      p.adp = null;
      if (p.positions.includes("G")) p.value = 205;
    });
    const profiles = ["Zero-G", "Hero-G"] as const;
    const goalieCounts = profiles.map((personality) =>
      Array.from({ length: 12 }, (_, i) => {
        const state = newSession(
          small.config,
          small.players,
          `strategy-${i}`,
          "id",
          null,
          false,
        );
        return state.players
          .find(
            (p) =>
              p.id === decide(state, { personality, variation: 0.5 }).playerId,
          )!
          .positions.includes("G")
          ? 1
          : 0;
      }).reduce<number>((a, b) => a + b, 0),
    );
    expect(goalieCounts[1]).toBeGreaterThan(goalieCounts[0]);
  });
  it("responds to league values rather than blindly following identical ADP", () => {
    const { config, players } = fixture();
    const before = newSession(config, players, "score", "id", null, false);
    const chosen = decide(before, {
      personality: "BPA",
      variation: 0,
    }).playerId;
    const target = players.find((p) => p.id !== chosen)!;
    const after = newSession(
      config,
      players.map((p) => (p.id === target.id ? { ...p, value: 10000 } : p)),
      "score",
      "id",
      null,
      false,
    );
    expect(decide(after, { personality: "BPA", variation: 0 }).playerId).toBe(
      target.id,
    );
  });
});
