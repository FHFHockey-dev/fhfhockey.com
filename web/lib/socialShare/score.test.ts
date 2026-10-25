import { describe, expect, it } from "vitest";
import { DEFAULT_GOALIE_FANTASY_POINTS, DEFAULT_SKATER_FANTASY_POINTS } from "lib/projectionsConfig/fantasyPointsConfig";
import { byScore, fantasyPointsPerGame, opportunityMultiplier, OPPORTUNITY, playerScore, SCORE_FORMULA } from "./score";
import type { SharePlayer, SharePlayerRecent } from "./types";

type Skater = Extract<SharePlayerRecent, { kind: "skater" }>;
const skater = (recent: Partial<Skater>, group: SharePlayer["group"] = "F") => ({ group, recent: { kind: "skater", games: 5, through: "2026-10-24", goals: 0, assists: 0, points: 0, shots: 0,
  hitsPerGame: 0, blocksPerGame: 0, toiSeconds: null, ppPoints: 0, line: null, ppUnit: null, toiSeasonSeconds: null, ...recent } as Skater });
const clockSeconds = (text: string) => { const [m, s] = text.split(":").map(Number); return m * 60 + s; };

describe("L5 fantasy score (ticket 15)", () => {
  it("TJ's case: Vilardi (1G 2A, 8 SOG, 1 PPP, 18:20) outranks Iafallo (2G 1A, 10 SOG, 0 PPP, 14:29)", () => {
    const vilardi = skater({ goals: 1, assists: 2, points: 3, shots: 8, ppPoints: 1, toiSeconds: clockSeconds("18:20") });
    const iafallo = skater({ goals: 2, assists: 1, points: 3, shots: 10, ppPoints: 0, toiSeconds: clockSeconds("14:29") });
    // Raw L5 points favour Iafallo slightly (10.0 vs 9.6 over five games): opportunity decides.
    expect(fantasyPointsPerGame(vilardi)).toBeCloseTo((3 + 4 + 1 + 8 * 0.2) / 5);
    expect(fantasyPointsPerGame(iafallo)).toBeCloseTo((6 + 2 + 10 * 0.2) / 5);
    expect(playerScore(vilardi)!).toBeGreaterThan(playerScore(iafallo)!);
    // With roles (Vilardi on L1 and PP1, Iafallo on L3 with no PP) the gap only widens.
    const vilardiRole = skater({ ...vilardi.recent, line: "L1", ppUnit: "PP1" }), iafalloRole = skater({ ...iafallo.recent, line: "L3", ppUnit: null });
    expect(playerScore(vilardiRole)! - playerScore(iafalloRole)!).toBeGreaterThan(playerScore(vilardi)! - playerScore(iafallo)!);
    const order = byScore(playerScore, () => 0);
    expect([iafallo, vilardi].sort(order)).toEqual([vilardi, iafallo]);
  });

  it("uses the site's default fantasy values (read-only) for skaters and goalies", () => {
    const line = skater({ goals: 2, assists: 3, ppPoints: 1, shots: 15, hitsPerGame: 2, blocksPerGame: 1 });
    const s = DEFAULT_SKATER_FANTASY_POINTS;
    expect(fantasyPointsPerGame(line)).toBeCloseTo((2 * s.GOALS + 3 * s.ASSISTS + 1 * s.PP_POINTS + 15 * s.SHOTS_ON_GOAL + 5 * (2 * s.HITS + 1 * s.BLOCKED_SHOTS)) / 5);
    const g = DEFAULT_GOALIE_FANTASY_POINTS;
    const goalie = { group: "G" as const, recent: { kind: "goalie" as const, games: 4, through: "2026-10-24", wins: 3, saves: 110, shotsAgainst: 118, goalsAgainst: 8, qualityStarts: 3, shutouts: 1 } };
    expect(fantasyPointsPerGame(goalie)).toBeCloseTo((3 * g.WINS_GOALIE + 110 * g.SAVES_GOALIE + 8 * g.GOALS_AGAINST_GOALIE + 1 * g.SHUTOUTS_GOALIE) / 4);
    expect(opportunityMultiplier(goalie)).toBe(1);
    // The printed formula states exactly these values.
    for (const [label, value] of [["G", s.GOALS], ["A", s.ASSISTS], ["PPP", s.PP_POINTS], ["SOG", s.SHOTS_ON_GOAL], ["HIT", s.HITS], ["BLK", s.BLOCKED_SHOTS], ["W", g.WINS_GOALIE], ["SV", g.SAVES_GOALIE], ["SO", g.SHUTOUTS_GOALIE]] as const)
      expect(SCORE_FORMULA).toContain(`${label} ${value}`);
    expect(SCORE_FORMULA).toContain(`GA −${Math.abs(g.GOALS_AGAINST_GOALIE)}`);
    expect(SCORE_FORMULA).toContain(`L1 +${OPPORTUNITY.line.L1 * 100}%`);
    expect(SCORE_FORMULA).toContain(`PP1 +${OPPORTUNITY.pp.PP1 * 100}%`);
  });

  it("scores opportunity by line or pair, PP unit and capped relative TOI", () => {
    const base = { goals: 1, assists: 1, shots: 5 };
    expect(opportunityMultiplier(skater({ ...base, line: "L1", ppUnit: "PP1", toiSeconds: 16 * 60 }))).toBeCloseTo(1.25);
    expect(opportunityMultiplier(skater({ ...base, line: "L4", ppUnit: "PP3", toiSeconds: 16 * 60 }))).toBeCloseTo(1);
    expect(opportunityMultiplier(skater({ ...base, line: "P1", ppUnit: "PP2", toiSeconds: 20 * 60 }, "D"))).toBeCloseTo(1.15);
    expect(opportunityMultiplier(skater({ ...base, toiSeconds: 30 * 60 }))).toBeCloseTo(1 + OPPORTUNITY.toiCap);
    expect(opportunityMultiplier(skater({ ...base, toiSeconds: 5 * 60 }))).toBeCloseTo(1 - OPPORTUNITY.toiCap);
  });

  it("puts unscored players after scored ones and lets the season rate (never the name) break ties", () => {
    type Row = Pick<SharePlayer, "group" | "recent"> & { season: number; name: string };
    const scored = skater({ goals: 1 }), unscored = { group: "F" as const, recent: null };
    const season = (a: Row, b: Row) => b.season - a.season;
    const rows: Row[] = [{ ...unscored, season: 9, name: "A" }, { ...scored, season: 1, name: "Z" }, { ...scored, season: 2, name: "Y" }];
    expect(rows.sort(byScore<Row>(playerScore, season)).map(row => row.season)).toEqual([2, 1, 9]);
    expect(playerScore(unscored)).toBeNull();
    expect(playerScore(skater({ goals: null, assists: null, shots: null, ppPoints: null, hitsPerGame: null, blocksPerGame: null }))).toBeNull();
  });
});
