// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { parseShareSettings, type SharePostSnapshot } from "./contract";
import { skaterBoardModules } from "./lanes/skaterBoards";
import { buildMultiCatStars, MULTI_CAT_ROWS, multiCatDates, multiCatHeadline, multiCatPercentiles, multiCatScore, multiCatStarsModule, radarRuns, type MultiCatData, type MultiCatGame, type MultiCatSeason, type MultiCatSettings } from "./multiCatStars";
import { readMultiCatSeason } from "./multiCatStars.sources";

const THROUGH = "2026-10-31"; // A Saturday: the week is Oct 26 to Nov 1, and the last 7 days start Oct 25.
const settings = (over: Partial<MultiCatSettings> = {}): MultiCatSettings => ({ basis: "total", formula: "standard", ...over });
const game = (playerId: number, date: string, stats: Partial<MultiCatGame> = {}): MultiCatGame => ({
  playerId, name: `Skater ${playerId}`, position: "C", group: "F", gameId: Number(date.replace(/-/g, "")) * 100 + (playerId % 50), date, team: "NJD", opponent: "NYR", home: true,
  goals: 0, assists: 0, points: 0, shots: 1, hits: 1, blocks: 1, ppPoints: 0, toiSeconds: 900, ppToiSeconds: 0, penaltyMinutes: 0, plusMinus: 0, ...stats,
});
const season = (appearances: MultiCatGame[], through = THROUGH): MultiCatSeason => {
  const teamGames = [...new Map(appearances.map(row => [`${row.team}:${row.gameId}`, { gameId: row.gameId, date: row.date, team: row.team! }])).values()];
  return { appearances, teamGames, scheduledGames: teamGames.length / 2, through };
};
const ranks = (data: MultiCatData | null) => data!.rows.map(row => [row.playerId, row.rank, row.score]);
/** A: 2 games, 2 PTS and 6 others. B: 3 games, 1 PTS and 8 others. C: 1 big game. */
const views = () => season([
  game(1, "2026-10-27", { points: 1, shots: 1, hits: 1, blocks: 1 }), game(1, "2026-10-29", { points: 1, shots: 1, hits: 1, blocks: 1 }),
  game(2, "2026-10-26", { points: 1, shots: 2, hits: 1, blocks: 0 }), game(2, "2026-10-28", { points: 0, shots: 2, hits: 1, blocks: 0 }), game(2, "2026-10-30", { points: 0, shots: 1, hits: 1, blocks: 0 }),
  game(3, "2026-10-28", { points: 3, shots: 3, hits: 1, blocks: 0 }),
]);

describe("ranking views", () => {
  it("Fantasy Week Total, Standard: PTS + BLK + SOG + HIT, and a single game qualifies", () => {
    expect(ranks(buildMultiCatStars(views(), settings()).data)).toEqual([[2, 1, 9], [1, 2, 8], [3, 3, 7]]);
  });
  it("Fantasy Week Total, Points-First: points count double", () => {
    expect(ranks(buildMultiCatStars(views(), settings({ formula: "pointsFirst" })).data)).toEqual([[1, 1, 10], [2, 1, 10], [3, 1, 10]]); // All tied: one rule, display by id.
  });
  it("Per Game, Standard: 2 GP minimum removes the one-game skater and counts him", () => {
    const { data, evidence } = buildMultiCatStars(views(), settings({ basis: "perGame" }));
    expect(ranks(data)).toEqual([[1, 1, 4], [2, 2, 3]]);
    expect(data!.cohort).toMatchObject({ weekSkaters: 3, belowMinGp: 1, ranked: 2 });
    expect(evidence.cohort).toContain("1 under 2 GP");
  });
  it("Per Game, Points-First", () => {
    expect(ranks(buildMultiCatStars(views(), settings({ basis: "perGame", formula: "pointsFirst" })).data)).toEqual([[1, 1, 5], [2, 2, 10 / 3]]);
  });
  it("headline follows each view", () => {
    expect(multiCatHeadline(settings())).toBe("Top Multi-Cat Stars of the Week");
    expect(multiCatHeadline(settings({ basis: "perGame" }))).toBe("Top Multi-Cat Stars Per Game");
    expect(multiCatHeadline(settings({ formula: "pointsFirst" }))).toBe("Top Points-First Stars of the Week");
    expect(multiCatHeadline(settings({ basis: "perGame", formula: "pointsFirst" }))).toBe("Top Points-First Stars Per Game");
  });
  it("exactly 2 GP passes the minimum and an empty per-game board stays empty", () => {
    expect(buildMultiCatStars(season([game(1, "2026-10-27"), game(1, "2026-10-28")]), settings({ basis: "perGame" })).data!.rows).toHaveLength(1);
    expect(buildMultiCatStars(season([game(1, "2026-10-27")]), settings({ basis: "perGame" })).data!.rows).toEqual([]);
  });
});

describe("week and last 7 days", () => {
  it("uses the Monday to Sunday week holding the cutoff, and a Monday post shows the week just ended", () => {
    expect(multiCatDates(THROUGH)).toEqual({ weekStart: "2026-10-26", weekEnd: "2026-11-01", last7From: "2026-10-25", last7To: THROUGH });
    expect(multiCatDates("2026-11-01").weekStart).toBe("2026-10-26");
    expect(multiCatDates("2026-11-02").weekStart).toBe("2026-11-02");
  });
  it("ranks only the week while the table reaches back 7 days and the radar the whole season", () => {
    const { data } = buildMultiCatStars(season([
      game(1, "2026-10-10", { goals: 9, points: 9, shots: 9 }), game(1, "2026-10-25", { goals: 5, points: 5, shots: 5 }), game(1, "2026-10-27", { goals: 1, points: 1, shots: 2 }),
      game(2, "2026-10-27", { shots: 1 }),
    ]), settings());
    const row = data!.rows.find(entry => entry.playerId === 1)!;
    expect(row.week).toMatchObject({ games: 1, points: 1, shots: 2 });
    expect(row.score).toBe(5); // 1 PTS + 1 BLK + 2 SOG + 1 HIT, with Oct 25 and Oct 10 outside the week.
    expect(row.last7.games).toBe(2);
    expect(row.last7.values.find(value => value.id === "goals")!.total).toBe(6); // Oct 25 and Oct 27, not Oct 10.
    expect(row.radar.find(spoke => spoke.id === "goals")!.percentile).toBe(75); // Season average beats the only other skater: (1 + 0.5) / 2.
  });
});

describe("percentiles", () => {
  it("is Wigo's method: per-game averages, below plus half of equal over the cohort, higher is better even on PIM", () => {
    const players = new Map([
      [1, [game(1, "2026-10-27", { goals: 2, penaltyMinutes: 4 }), game(1, "2026-10-28", { goals: 0, penaltyMinutes: 0 })]],
      [2, [game(2, "2026-10-27", { goals: 1, penaltyMinutes: 0 })]],
      [3, [game(3, "2026-10-27", { goals: 0, penaltyMinutes: 0 })]],
      [4, [game(4, "2026-10-27", { goals: 3, penaltyMinutes: 0 })]],
    ]);
    const spokes = multiCatPercentiles(players);
    const value = (player: number, id: string) => spokes(player).find(spoke => spoke.id === id)!.percentile;
    expect(value(1, "goals")).toBe(50); // Averages 1 and 1 tie: (1 + 2 x 0.5) / 4.
    expect(value(4, "goals")).toBe(87.5);
    expect(value(3, "goals")).toBe(12.5);
    expect(value(1, "penaltyMinutes")).toBe(87.5);
    expect(spokes(1).map(spoke => spoke.label)).toEqual(["G", "A", "PPP", "SOG", "+/-", "PIM", "BLK", "HIT"]);
  });
  it("a negative +/- ranks low rather than failing", () => {
    const spokes = multiCatPercentiles(new Map([[1, [game(1, "2026-10-27", { plusMinus: -3 })]], [2, [game(2, "2026-10-27", { plusMinus: 2 })]]]));
    expect(spokes(1).find(spoke => spoke.id === "plusMinus")!.percentile).toBe(25);
  });
  it("a missing value has no percentile and leaves that skater out of that category's cohort only", () => {
    const spokes = multiCatPercentiles(new Map([[1, [game(1, "2026-10-27", { hits: null, shots: 5 })]], [2, [game(2, "2026-10-27", { hits: 3, shots: 1 })]], [3, [game(3, "2026-10-27", { hits: 1, shots: 1 })]]]));
    expect(spokes(1).find(spoke => spoke.id === "hits")!.percentile).toBeNull();
    expect(spokes(2).find(spoke => spoke.id === "hits")!.percentile).toBe(75); // Of 2 known, not 3.
    expect(spokes(1).find(spoke => spoke.id === "shots")!.percentile).toBeCloseTo(83.333);
  });
  it("the radar closes only when every spoke is known, and never bridges a gap", () => {
    expect(radarRuns([1, 2, 3])).toEqual({ closed: true, runs: [[0, 1, 2]] });
    expect(radarRuns([0, 2, 3])).toEqual({ closed: true, runs: [[0, 1, 2]] }); // 0 is a known value.
    expect(radarRuns([1, null, 3, 4, null, 6])).toEqual({ closed: false, runs: [[2, 3], [5, 0]] });
    expect(radarRuns([null, null])).toEqual({ closed: false, runs: [] });
  });
});

describe("ties and missing values", () => {
  it("equal scores share a competition rank, and a tie past the cut is counted, not hidden", () => {
    const { data, evidence } = buildMultiCatStars(season([9, 8, 8, 8, 8, 8, 7].map((shots, index) => game(index + 1, "2026-10-27", { shots }))), settings());
    expect(data!.rows).toHaveLength(MULTI_CAT_ROWS);
    expect(data!.rows.map(row => row.rank)).toEqual([1, 2, 2, 2]);
    expect(data!.rows.map(row => row.playerId)).toEqual([1, 2, 3, 4]);
    expect(data).toMatchObject({ notShown: 3, tiedBeyondCut: 2 });
    expect(evidence.cohort).toContain("3 more below the card, 2 tied with the last row");
  });
  it("a missing score component leaves the skater unranked, never scored on the rest", () => {
    for (const missing of ["points", "shots", "hits", "blocks"] as const) {
      const { data } = buildMultiCatStars(season([game(1, "2026-10-27", { [missing]: null, goals: 9 }), game(2, "2026-10-27")]), settings());
      expect(data!.rows.map(row => row.playerId)).toEqual([2]);
      expect(data!.cohort.missingComponent).toBe(1);
    }
    expect(multiCatScore({ games: 2, points: null, blocks: 1, shots: 1, hits: 1 }, settings())).toBeNull();
  });
  it("a known zero scores zero, and a zero game count has no per-game score", () => {
    expect(multiCatScore({ games: 2, points: 0, blocks: 0, shots: 0, hits: 0 }, settings())).toBe(0);
    expect(multiCatScore({ games: 0, points: 0, blocks: 0, shots: 0, hits: 0 }, settings({ basis: "perGame" }))).toBeNull();
  });
  it("a missing table or radar value stays null for a ranked skater, never zero", () => {
    const { data } = buildMultiCatStars(season([game(1, "2026-10-27", { plusMinus: null, penaltyMinutes: null, ppPoints: null }), game(2, "2026-10-27")]), settings());
    const row = data!.rows.find(entry => entry.playerId === 1)!;
    for (const id of ["plusMinus", "penaltyMinutes", "ppPoints"]) {
      expect(row.last7.values.find(value => value.id === id)!.total).toBeNull();
      expect(row.radar.find(spoke => spoke.id === id)!.percentile).toBeNull();
    }
    expect(row.last7.values.find(value => value.id === "shots")!.total).toBe(1);
  });
});

describe("post seam", () => {
  it("is registered, with visible defaults and refused values", () => {
    expect(skaterBoardModules).toContain(multiCatStarsModule);
    expect(parseShareSettings(multiCatStarsModule, {})).toEqual({ basis: "total", formula: "standard" });
    expect(() => parseShareSettings(multiCatStarsModule, { basis: "season" })).toThrow();
    expect(() => parseShareSettings(multiCatStarsModule, { minGp: "1" })).toThrow();
  });
  it("an incomplete season is partial, and a coverage gap is stated", () => {
    const input = { ...views(), scheduledGames: 99 };
    const { state, reasons } = buildMultiCatStars(input, settings());
    expect(state).toBe("partial");
    expect(reasons![0]).toContain("of 198 scheduled team games");
  });
  it("evidence names the cohort, windows and strength, and alt text prints missing values", () => {
    const result = buildMultiCatStars(season([game(1, "2026-10-27", { plusMinus: null })]), settings());
    expect(result.evidence.cohort).toContain("Radar: 1 skaters with 1+ season GP");
    expect(result.evidence.sample).toContain("ranking 2026-10-26 to 2026-11-01, table 2026-10-25 to 2026-10-31, radar full season");
    expect(result.evidence.strength).toBe("All situations");
    const snapshot = { evidence: result.evidence } as SharePostSnapshot<MultiCatSettings, MultiCatData>;
    expect(multiCatStarsModule.altText(snapshot, result.data, settings())).toContain("+/- missing");
  });
  it("an empty board cannot export, and data from other settings cannot either", () => {
    const empty = buildMultiCatStars(season([game(1, "2026-10-27")]), settings({ basis: "perGame" })).data!;
    expect(multiCatStarsModule.hasRows(empty, settings({ basis: "perGame" }))).toBe(false);
    const full = buildMultiCatStars(views(), settings()).data!;
    expect(multiCatStarsModule.hasRows(full, settings())).toBe(true);
    expect(multiCatStarsModule.hasRows(full, settings({ formula: "pointsFirst" }))).toBe(false);
  });
});

describe("read", () => {
  it("is SELECT only, bounded, and carries +/- through", async () => {
    const calls: string[] = [];
    const rows = [{ player_id: 1, player_name: "Skater 1", position_code: "C", date: "2026-10-27", season_id: 20262027, game_id: 5, team_abbrev: "NJD", opponent_team_abbrev: "NYR", home_road: "H", games_played: 1, goals: 0, assists: 0, points: 0, shots: 1, hits: 1, blocked_shots: 1, pp_points: 0, toi_per_game: 900, pp_toi: 0, penalty_minutes: 0, plus_minus: -2 }];
    const chain = (table: string): any => {
      const data = table === "wgo_skater_stats" ? rows : table === "games" ? [{ id: 5 }] : [{ team_id: 1, game_id: 5, date: "2026-10-27" }];
      const query: any = { select: (columns: string) => { calls.push(`${table}:${columns}`); return query; }, eq: () => query, gte: () => query, lte: () => query, in: () => query, not: () => query, order: () => query, range: () => query, then: (done: (value: unknown) => unknown) => done({ data, error: null, count: data.length }) };
      return query;
    };
    const result = await readMultiCatSeason({ client: { from: chain }, generatedAt: "2026-11-01T16:00:00Z" });
    expect(result.through).toBe(THROUGH);
    expect((result.appearances[0] as MultiCatGame).plusMinus).toBe(-2);
    expect(calls.find(call => call.startsWith("wgo_skater_stats"))).toContain("plus_minus");
    expect(calls.length).toBe(3);
  });
});

afterEach(cleanup);
describe("card", () => {
  const renderCard = async (input: MultiCatSeason, active: MultiCatSettings) => {
    const Card = await multiCatStarsModule.card(), { data, evidence } = buildMultiCatStars(input, active);
    return render(createElement(Card, { data, settings: active, logos: {}, snapshot: { evidence } as never }));
  };
  it("labels the three windows, and draws an open radar with a marked gap when a spoke is missing", async () => {
    await renderCard(season([game(1, "2026-10-27", { plusMinus: null }), game(2, "2026-10-27")]), settings());
    expect(screen.getAllByText("LAST 7 DAYS")).toHaveLength(2);
    expect(screen.getAllByText("SEASON PERCENTILE")).toHaveLength(2);
    expect(screen.getByText(/fantasy week Oct 26-Nov 1, through Oct 31/)).toBeTruthy();
    expect(screen.getByText(/last 7 days, Oct 25-Oct 31/)).toBeTruthy();
    const [gappy, whole] = screen.getAllByTestId("multi-cat-radar").map(node => node.getAttribute("data-closed"));
    expect([gappy, whole].sort()).toEqual(["false", "true"]);
    expect(screen.getAllByTestId("multi-cat-gap")).toHaveLength(1);
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });
  it("states why a board is empty", async () => {
    await renderCard(season([game(1, "2026-10-27")]), settings({ basis: "perGame" }));
    expect(screen.getByText("No skater has 2 GP this fantasy week yet")).toBeTruthy();
  });
});
