import { describe, expect, it } from "vitest";
import type { StreamNight } from "./matchups";
import { targetCandidates, targetKey, targetPicks, targetRoles } from "./targets";
import type { SharePlayer, SocialShareSnapshot } from "./types";

// Season totals over 20 GP: goals, shots, blocks per player (TJ's ticket 22 pick rules).
const skater = (nhlId: number, goals: number | null, shots: number | null, blocks: number | null, extra: Partial<SharePlayer> = {}): SharePlayer => ({ nhlId, name: `P${nhlId}`, team: "STL", group: "F", positions: "C",
  ownership: 20, gamesPlayed: 20, pointsPerGame: 0.5, goals, hits: 10, shots, blocks, gamesStarted: null, qualityStartPct: null, savePct: null, ...extra });
const snapshot = (players: SharePlayer[]) => ({ players: { state: "ready", players } }) as unknown as SocialShareSnapshot;
const rate = (rank: number) => ({ perGame: 1, rank, of: 32 });
const night = (storms: { goals?: boolean; shots?: boolean; blocks?: boolean }, ranks = { goals: [5, 5], shots: [12, 12], blocks: [20, 20] }) => ({
  team: { id: 1, abbreviation: "STL", name: "St. Louis" },
  evidence: {
    goals: { team: rate(ranks.goals[0]), opponent: rate(ranks.goals[1]), storm: !!storms.goals },
    shots: { team: rate(ranks.shots[0]), opponent: rate(ranks.shots[1]), storm: !!storms.shots },
    blocks: { team: rate(ranks.blocks[0]), opponent: rate(ranks.blocks[1]), storm: !!storms.blocks },
    rest: { opponentSecondNight: false, teamSecondNight: false }, flags: [],
  },
}) as unknown as StreamNight;
const ids = (picks: ReturnType<typeof targetPicks>) => picks.map(pick => pick.player.nhlId);

// 1–3 are scorers (10, 8, 6 goals), 4–6 shooters (80, 70, 60 shots), 7–8 blockers (60, 50 blocks); 9 is the best
// scorer AND shooter (12 goals, 90 shots). Others are low in everything.
const roster = [skater(1, 10, 30, 5), skater(2, 8, 25, 5), skater(3, 6, 20, 5), skater(4, 2, 80, 5), skater(5, 2, 70, 5), skater(6, 2, 60, 5),
  skater(7, 1, 10, 60, { group: "D", positions: "D" }), skater(8, 1, 10, 50, { group: "D", positions: "D" })];

describe("Targeted Matchups picks (ticket 22)", () => {
  it("goal storm picks the 3 best scorers by G/GP, with the justifying stat", () => {
    const picks = targetPicks(snapshot(roster), night({ goals: true }), true);
    expect(ids(picks)).toEqual([1, 2, 3]);
    expect(picks[0]).toMatchObject({ roles: ["scorer"], stat: "0.50 G/GP" });
  });

  it("shot storm picks shooters by SOG/GP; shots-against storm picks blockers by BLK/GP", () => {
    expect(ids(targetPicks(snapshot(roster), night({ shots: true }), true))).toEqual([4, 5, 6]);
    const blockers = targetPicks(snapshot(roster), night({ blocks: true }), true);
    expect(ids(blockers)).toEqual([7, 8, 1]);
    expect(blockers[0]).toMatchObject({ roles: ["blocker"], stat: "3.0 BLK/GP" });
  });

  it("two tilts spread the 3 picks across them, best remaining first", () => {
    const picks = targetPicks(snapshot(roster), night({ goals: true, shots: true }), true);
    expect(picks.map(pick => [pick.player.nhlId, pick.roles])).toEqual([[1, ["scorer"]], [4, ["shooter"]], [2, ["scorer"]]]);
  });

  it("a player who is the best fit for two tilts covers both, freeing a slot", () => {
    const both = skater(9, 12, 90, 5);
    const picks = targetPicks(snapshot([...roster, both]), night({ goals: true, shots: true }), true);
    expect(picks.map(pick => [pick.player.nhlId, pick.roles])).toEqual([[9, ["scorer", "shooter"]], [4, ["shooter"]], [1, ["scorer"]]]);
  });

  it("without a storm (tired / soft defense / off-night only) uses the strongest primary pairing", () => {
    // Goals pairing ranks 5 and 5 beat shots (12) and shots-against (20): scorers.
    expect(targetRoles(night({}))).toEqual(["scorer"]);
    expect(targetRoles(night({}, { goals: [30, 30], shots: [3, 4], blocks: [20, 20] }))).toEqual(["shooter"]);
    expect(ids(targetPicks(snapshot(roster), night({}), true))).toEqual([1, 2, 3]);
  });

  it("never picks with unknown data, other teams or goalies, and shows fewer cards rather than filler", () => {
    const thin = [skater(1, null, 30, 5), skater(2, 8, 25, 5), skater(3, 4, 20, 5, { team: "ANA" }), skater(4, 9, 20, 5, { group: "G", positions: "G" })];
    expect(ids(targetPicks(snapshot(thin), night({ goals: true }), true))).toEqual([2]);
    expect(targetPicks(snapshot(roster), night({ goals: true }), false)).toEqual([]);
    expect(targetPicks({ players: { state: "stale", players: roster } } as unknown as SocialShareSnapshot, night({ goals: true }), true)).toEqual([]);
  });

  it("a trimmed live layer shows exactly the server's recorded picks and roles, and none when they are missing", () => {
    const both = skater(9, 12, 90, 5), full = targetPicks(snapshot([...roster, both]), night({ goals: true, shots: true }), true);
    const recorded = { [targetKey(night({}) as StreamNight)]: full.map(pick => ({ id: pick.player.nhlId, roles: pick.roles })) };
    // Only the picked players leave the server; the roles come from the record, not from re-ranking fewer players.
    const trimmed = { players: { state: "ready", selectedDates: [], players: full.map(pick => pick.player), targets: recorded } } as unknown as SocialShareSnapshot;
    const live = targetPicks({ ...trimmed, selectedDates: [] } as SocialShareSnapshot, night({ goals: true, shots: true }), true);
    expect(live.map(pick => [pick.player.nhlId, pick.roles, pick.stat])).toEqual(full.map(pick => [pick.player.nhlId, pick.roles, pick.stat]));
    const legacy = { players: { state: "ready", selectedDates: [], players: full.map(pick => pick.player) }, selectedDates: [] } as unknown as SocialShareSnapshot;
    expect(targetPicks(legacy, night({ goals: true }), true)).toEqual([]);
  });

  it("the server pool keeps the top 3 per tilt role, enough for any pick order", () => {
    expect(targetCandidates(snapshot(roster), night({ goals: true, shots: true })).map(player => player.nhlId)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
