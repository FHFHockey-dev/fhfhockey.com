import { describe, expect, it } from "vitest";
import type { GameForecast } from "lib/rosterScheduleOptimizer/planningTypes";
import { buildLedgerRows, scoreLedger, settleLedgerRows, type BuildLedgerInput, type LedgerRow } from "./servedForecastLedger";

const NOW = new Date("2026-10-21T12:30:00Z");
const forecast = (playerId: string, gameId: string, runId: string, stats: Record<string, number | null>, startProbability: number | null = null): GameForecast => ({
  playerId, gameId, stats, conditioning: "unconditional", startProbability, confirmedStart: false, revisionId: `forge-daily-bridge-v1:${runId}`,
  issuedAt: "2026-10-21T10:30:00Z", cutoffAt: "2026-10-21T10:30:00Z", expiresAt: "2026-10-21T23:00:00Z", sourceWatermark: `forge-daily-bridge-v1:${runId}`,
  modelVersion: "forge-daily-bridge-v1:abc", limitations: [] });
const skaterLine = { GOALS: 0.4, ASSISTS: 0.5, PP_POINTS: 0.2, SHOTS_ON_GOAL: 3, HITS: 1, BLOCKED_SHOTS: 0.5 };
// Team 1 hosts team 2 tonight (game 100); team 3 at team 4 already started (game 101). Team 1 also played yesterday (B2B).
const scheduleGames = [
  ...Array.from({ length: 12 }, (_, i) => ({ id: 10 + i, date: `2026-10-${String(9 + i).padStart(2, "0")}`, homeTeamId: 1, awayTeamId: 5 })),
  { id: 100, date: "2026-10-21", homeTeamId: 1, awayTeamId: 2 }, { id: 101, date: "2026-10-21", homeTeamId: 4, awayTeamId: 3 },
  { id: 50, date: "2026-10-18", homeTeamId: 2, awayTeamId: 6 } ];
const wgoSkater = (date: string, goals: number, hits: number | null = 1) => ({ player_id: 11, date, season_id: 20262027, goals, assists: 1, pp_points: 0, shots: 3, hits, blocked_shots: 1 });
const input = (): BuildLedgerInput => ({
  date: "2026-10-21", seasonId: 20262027, now: NOW,
  games: [{ gameId: 100, date: "2026-10-21", scheduledAt: "2026-10-21T23:00:00Z", status: "scheduled", homeTeamId: 1, awayTeamId: 2 },
    { gameId: 101, date: "2026-10-21", scheduledAt: "2026-10-21T12:00:00Z", status: "scheduled", homeTeamId: 4, awayTeamId: 3 }],
  players: [{ nhlId: 11, planningId: "p11", playerClass: "skater", teamId: 1 }, { nhlId: 22, planningId: "p22", playerClass: "skater", teamId: 2 },
    { nhlId: 31, planningId: "p31", playerClass: "goalie", teamId: 1 }, { nhlId: 41, planningId: "p41", playerClass: "skater", teamId: 4 }],
  bridgeForecasts: [forecast("p11", "100", "run-today", skaterLine), forecast("p22", "100", "run-old", { ...skaterLine, HITS: null }),
    forecast("p41", "101", "run-today", skaterLine)],
  runDates: new Map([["run-today", "2026-10-21"], ["run-old", "2026-10-19"]]),
  scheduleGames,
  // Six games for skater 11, newest last; the oldest (2 goals) falls outside the last five.
  wgoGameRows: [wgoSkater("2026-10-10", 2), wgoSkater("2026-10-12", 0), wgoSkater("2026-10-14", 1), wgoSkater("2026-10-16", 0, null), wgoSkater("2026-10-18", 1), wgoSkater("2026-10-20", 0),
    wgoSkater("2026-10-21", 5)],
  // Goalie 31 started 8 of team 1's last 10 games (ids 12..21 minus 13 and 17), 10 starts in all.
  goalieGameRows: [10, 11, 12, 14, 15, 16, 18, 19, 20, 21].map(id => ({ goalie_id: 31, game_id: id, date: scheduleGames.find(row => row.id === id)!.date, season_id: 20262027,
    games_started: 1, saves: 25, goals_against: id % 2 ? 2 : 3, shots_against: id % 2 ? 27 : 28, wins: 1, shutouts: id === 21 ? 1 : 0 })),
  teamWin: new Map([["100:1", 0.6]]),
});
const find = (rows: LedgerRow[], player: number, source: string) => rows.find(row => row.player_id === player && row.source === source);

describe("buildLedgerRows", () => {
  const { rows, skippedGameIds } = buildLedgerRows(input());

  it("splits exact and re-aimed bridge rows by the issuing run's date and keeps unknown heads null", () => {
    const exact = find(rows, 11, "bridge_exact")!, reaimed = find(rows, 22, "bridge_reaimed")!;
    expect(exact).toMatchObject({ run_id: "run-today", game_id: 100, team_id: 1, opponent_team_id: 2, is_home: true, team_rest_days: 1, opponent_rest_days: 3,
      exp_goals: 0.4, exp_shots: 3, exp_fantasy_points: 3.325, scheduled_at: "2026-10-21T23:00:00.000Z" });
    expect(find(rows, 11, "bridge_reaimed")).toBeUndefined();
    expect(reaimed).toMatchObject({ run_id: "run-old", exp_hits: null, exp_fantasy_points: null, is_home: false });
    expect(rows.some(row => row.source === "native")).toBe(false);
  });

  it("computes naive controls from WGO games before the date", () => {
    const last5 = find(rows, 11, "naive_last5")!, season = find(rows, 11, "naive_season")!;
    expect(last5).toMatchObject({ exp_goals: 0.4, exp_assists: 1, exp_hits: 1, participation_probability: 1, method_version: "served-ledger-naive-v1",
      source_watermark: "wgo_skater_stats:2026-10-20:5" });
    expect(season.exp_goals).toBeCloseTo(4 / 6, 4);
    expect(find(rows, 22, "naive_last5")).toBeUndefined();
  });

  it("scales a goalie's per-start means by his last-10 start share and the team win chance", () => {
    const last5 = find(rows, 31, "naive_last5")!, season = find(rows, 31, "naive_season")!;
    expect(last5.start_probability).toBe(0.8);
    expect(last5).toMatchObject({ exp_saves: 20, exp_goals_against: 2.08, exp_shots_against: 22.08, exp_win_prob: 0.48, exp_shutout_prob: 0.08 });
    expect(last5.exp_fantasy_points).toBeCloseTo(0.2 * 20 - 2.08 + 4 * 0.48 + 3 * 0.08, 4);
    expect(season.start_probability).toBeCloseTo(10 / 12, 4);
  });

  it("refuses a game that already started", () => {
    expect(skippedGameIds).toEqual([101]);
    expect(rows.some(row => row.game_id === 101)).toBe(false);
  });
});

describe("settleLedgerRows", () => {
  const { rows } = buildLedgerRows(input());
  const settled = settleLedgerRows(rows, {
    skaters: [{ game_id: 100, player_id: 11, goals: 1, assists: 0, pp_points: 0, shots: 4, hits: null, blocked_shots: 2 }],
    goalies: [{ game_id: 100, player_id: 31, saves: 30, goals_against: 0, shots_against: 30, wins: 1, shutouts: 1, games_started: 1 }] }, "2026-10-22T11:00:00Z");

  it("keeps unknown actuals null and marks players missing from a settled game as not dressed", () => {
    expect(find(settled, 11, "bridge_exact")).toMatchObject({ dressed: true, act_goals: 1, act_hits: null, act_fantasy_points: null, settled_at: "2026-10-22T11:00:00Z" });
    expect(find(settled, 22, "bridge_reaimed")).toMatchObject({ dressed: false, act_goals: 0, act_fantasy_points: 0, outcome_source: "wgo_skater_stats" });
    expect(find(settled, 31, "naive_last5")).toMatchObject({ dressed: true, started: true, act_win: 1, act_shutout: 1, act_fantasy_points: 13 });
  });

  it("leaves rows unsettled when their game has no actual rows", () => {
    expect(settleLedgerRows(rows, { skaters: [], goalies: [] }, "x").every(row => row.settled_at === null)).toBe(true);
  });
});

describe("scoreLedger", () => {
  // 20 settled skater rows: expected goals 0.05..1.00, actual goals 1 for the top two, else 0; even ids on a back-to-back.
  const base = buildLedgerRows(input()).rows.find(row => row.source === "bridge_exact")!;
  const fixture: LedgerRow[] = Array.from({ length: 20 }, (_, i) => ({ ...base, player_id: 1000 + i, exp_goals: (i + 1) / 20, act_goals: i >= 18 ? 1 : 0,
    exp_fantasy_points: 2, act_fantasy_points: i % 2 ? 1 : 4, team_rest_days: i % 2 ? 2 : 1, dressed: i !== 0, settled_at: "s" }));
  fixture.push({ ...base, player_id: 9999, settled_at: null });
  const [score] = scoreLedger(fixture);

  it("reports n, coverage, phantoms, MAE and signed bias", () => {
    expect(score).toMatchObject({ source: "bridge_exact", player_class: "skater", n: 20, dressed: 19, covered: 19, coverage: 1, phantoms: 1 });
    const meanExp = 21 / 40, meanAct = 2 / 20;
    expect(score.heads.goals.bias).toBeCloseTo(meanExp - meanAct, 4);
    expect(score.heads.goals.n).toBe(20);
    expect(score.fantasyPoints).toMatchObject({ n: 20, mae: 1.5, bias: -0.5 });
  });

  it("calibrates the top expected-goals decile and slices back-to-backs", () => {
    expect(score.decile10).toEqual({ n: 2, expected: 1.95, actual: 2, ratio: 1.0256 });
    expect(score.b2b.fantasyPoints).toMatchObject({ n: 10, mae: 2, bias: -2 });
    expect(score.reliability).toEqual({});
  });

  it("bins goalie start and win probabilities", () => {
    const goalie = settleLedgerRows(buildLedgerRows(input()).rows, { skaters: [], goalies: [{ game_id: 100, player_id: 31, saves: 30, goals_against: 0, shots_against: 30, wins: 1, shutouts: 1, games_started: 1 }] }, "s");
    const last5 = scoreLedger(goalie).find(row => row.source === "naive_last5" && row.player_class === "goalie")!;
    expect(last5.reliability.start).toEqual([{ bin: 8, n: 1, predicted: 0.8, observed: 1 }]);
    expect(last5.reliability.win).toEqual([{ bin: 4, n: 1, predicted: 0.48, observed: 1 }]);
  });
});
