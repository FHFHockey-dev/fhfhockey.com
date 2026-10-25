import { describe, expect, it } from "vitest";
import type { GameForecast } from "lib/rosterScheduleOptimizer/planningTypes";
import { devigTwoWayAmerican, devigYesOnly } from "lib/projections/utils/devig";
import { getModelLineProbabilities } from "lib/projections/utils/market-output-builders";
import { buildLedgerRows, buildMarketLedgerRows, impliedMeanFromMarket, scoreLedger, scoreMarketLedger, scorePairedLedger, settleLedgerRows, settleLedgerUniverse,
  type BuildLedgerInput, type LedgerMarketQuote, type LedgerRow } from "./servedForecastLedger";

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

  it("keeps unknown actuals null and refuses to infer DNP from unrelated actuals", () => {
    expect(find(settled, 11, "bridge_exact")).toMatchObject({ dressed: true, act_goals: 1, act_hits: null, act_fantasy_points: null, settled_at: "2026-10-22T11:00:00Z" });
    expect(find(settled, 22, "bridge_reaimed")).toMatchObject({ dressed: null, act_goals: null, act_fantasy_points: null, settled_at: null });
    expect(find(settled, 31, "naive_last5")).toMatchObject({ dressed: true, started: true, act_win: 1, act_shutout: 1, act_fantasy_points: 13 });
  });

  it("leaves rows unsettled when their game has no actual rows", () => {
    expect(settleLedgerRows(rows, { skaters: [], goalies: [] }, "x").every(row => row.settled_at === null)).toBe(true);
  });

  it("requires final and complete evidence for the exact game, team and class before inferring zero", () => {
    const scope = { gameId: 100, teamId: 2, playerClass: "skater" as const, final: true, complete: true };
    for (const change of [{ final: false }, { complete: false }, { gameId: 999 }, { teamId: 1 }, { playerClass: "goalie" as const }]) {
      const result = settleLedgerRows(rows, { skaters: [], goalies: [], completeScopes: [{ ...scope, ...change }] }, "s");
      expect(find(result, 22, "bridge_reaimed")).toMatchObject({ dressed: null, settled_at: null, act_fantasy_points: null });
    }
    const dnp = settleLedgerRows(rows, { skaters: [], goalies: [], completeScopes: [scope] }, "s");
    expect(find(dnp, 22, "bridge_reaimed")).toMatchObject({ dressed: false, act_goals: 0, act_fantasy_points: 0 });
    const recovered = settleLedgerRows(dnp, { skaters: [{ game_id: 100, player_id: 22, goals: 1 }], goalies: [] }, "later");
    expect(find(recovered, 22, "bridge_reaimed")).toMatchObject({ dressed: true, act_goals: 1, act_hits: null, act_fantasy_points: null });
    expect(settleLedgerRows(recovered, { skaters: [{ game_id: 100, player_id: 22, goals: 1 }], goalies: [] }, "later")).toEqual(recovered);
    expect(find(settleLedgerRows(dnp, { skaters: [], goalies: [] }, "unverified"), 22, "bridge_reaimed"))
      .toMatchObject({ dressed: null, settled_at: null, act_goals: null, act_fantasy_points: null });
  });
});

describe("scoreLedger", () => {
  // 20 settled skater rows: expected goals 0.05..1.00, actual goals 1 for the top two, else 0; even ids on a back-to-back.
  const base = buildLedgerRows(input()).rows.find(row => row.source === "bridge_exact")!;
  const fixture: LedgerRow[] = Array.from({ length: 20 }, (_, i) => ({ ...base, player_id: 1000 + i, exp_goals: (i + 1) / 20, act_goals: i >= 18 ? 1 : 0,
    exp_fantasy_points: 2, act_fantasy_points: i % 2 ? 1 : 4, team_rest_days: i % 2 ? 2 : 1, dressed: i !== 0, settled_at: "s" }));
  fixture.push({ ...base, player_id: 9999, settled_at: null });
  const [score] = scoreLedger(fixture, undefined, fixture.filter(row => row.settled_at !== null));

  it("reports n, coverage, phantoms, MAE and signed bias", () => {
    expect(score).toMatchObject({ source: "bridge_exact", player_class: "skater", n: 20, dressed: 19, covered: 19, coverage: 1, phantoms: 1 });
    const meanExp = (10.5 - 0.05) / 19, meanAct = 2 / 19;
    expect(score.heads.goals.bias).toBeCloseTo(meanExp - meanAct, 4);
    expect(score.heads.goals.n).toBe(19);
    expect(score.fantasyPoints).toMatchObject({ n: 19, mae: 1.4737, bias: -0.4211 });
  });

  it("keeps tied expected FP together and slices dressed-only back-to-backs", () => {
    expect(score.decile10).toBeNull();
    expect(score.expectedFpDeciles).toMatchObject([{ decile: 6, n: 19, minExpectedFp: 2, maxExpectedFp: 2 }]);
    expect(score.b2b.fantasyPoints).toMatchObject({ n: 9, mae: 2, bias: -2 });
    expect(score.reliability).toEqual({});
  });

  it("bins goalie start and win probabilities", () => {
    const goalie = settleLedgerRows(buildLedgerRows(input()).rows, { skaters: [], goalies: [{ game_id: 100, player_id: 31, saves: 30, goals_against: 0, shots_against: 30, wins: 1, shutouts: 1, games_started: 1 }] }, "s");
    const last5 = scoreLedger(goalie).find(row => row.source === "naive_last5" && row.player_class === "goalie")!;
    expect(last5.reliability.start).toEqual([{ bin: 8, n: 1, predicted: 0.8, observed: 1 }]);
    expect(last5.reliability.win).toEqual([{ bin: 4, n: 1, predicted: 0.48, observed: 1 }]);
  });

  it("includes a no-history debut in the independent coverage universe without fabricating a forecast", () => {
    const args = input();
    args.players = [args.players[0], { nhlId: 99, planningId: "debut", playerClass: "skater", teamId: 1 }];
    const built = buildLedgerRows(args);
    expect(built.universe.map(row => row.player_id)).toEqual([11, 99]);
    expect(built.rows.some(row => row.player_id === 99)).toBe(false);
    const actuals = { skaters: [11, 99].map(player_id => ({ game_id: 100, player_id, goals: 0 })), goalies: [] };
    const rows = settleLedgerRows(built.rows, actuals, "s"), universe = settleLedgerUniverse(built.universe, actuals);
    expect(scoreLedger(rows, undefined, [...universe, ...universe])[0]).toMatchObject({ dressed: 2, covered: 1, coverage: 0.5, coverageStatus: "known" });
    expect(scoreLedger(rows)[0]).toMatchObject({ dressed: null, coverage: null, coverageStatus: "unavailable" });
    expect(scoreLedger(rows, undefined, built.universe)[0]).toMatchObject({ dressed: null, coverage: null, coverageStatus: "incomplete" });
    expect(scoreLedger(rows, undefined, [])[0]).toMatchObject({ dressed: 0, covered: 0, coverage: null, coverageStatus: "known" });
  });
});

describe("paired served-forecast scoring", () => {
  const base = buildLedgerRows(input()).rows.find(row => row.source === "bridge_exact")!;
  const row = (player_id: number, source: LedgerRow["source"], expected: number, actual: number, extra: Partial<LedgerRow> = {}): LedgerRow => ({
    ...base, player_id, source, dressed: true, settled_at: "2026-10-22T11:00:00Z", exp_goals: expected, act_goals: actual,
    exp_fantasy_points: expected, act_fantasy_points: actual, ...extra,
  });
  const comparison = (rows: LedgerRow[]) => scorePairedLedger(rows).comparisons.find(value => value.source === "bridge_exact" && value.reference === "naive_last5")!;

  it("scores the common player-game cohort and computes RMSE skill and MZ with an intercept", () => {
    const rows = [row(1, "bridge_exact", 1, 3), row(2, "bridge_exact", 2, 5), row(99, "bridge_exact", 100, 0),
      row(1, "naive_last5", 0, 3), row(2, "naive_last5", 0, 5), row(88, "naive_last5", 0, 100)];
    const score = comparison(rows);
    expect(score.pairing).toMatchObject({ matched: 2, dressed: 2, sourceOnly: 1, referenceOnly: 1 });
    expect(score.heads.goals.source).toEqual({ n: 2, expected: 3, actual: 8, ratio: 2.6667, mae: 2.5, bias: -2.5, rmse: 2.5495, mzSlope: 2, mzIntercept: 1 });
    expect(score.heads.goals.reference).toMatchObject({ n: 2, rmse: 4.1231, mzSlope: null, mzIntercept: null, ratio: null });
    expect(score.heads.goals.rmseSkill).toBeCloseTo(1 - Math.sqrt(6.5 / 17), 4);
    expect(score.fantasyPoints).toEqual(score.heads.goals);
    expect(comparison([...rows].reverse())).toEqual(score);
  });

  it("does not join a different served date, season or game, and reports missing source evidence", () => {
    const rows = [row(1, "bridge_exact", 1, 1), row(1, "naive_last5", 1, 1, { game_id: 101 }),
      row(1, "naive_last5", 1, 1, { served_date: "2026-10-20" }), row(1, "naive_last5", 1, 1, { season_id: 20252026 })];
    expect(comparison(rows)).toMatchObject({ status: "no_shared_player_games", pairing: { matched: 0, sourceOnly: 1, referenceOnly: 3 },
      fantasyPoints: { status: "no_valid_pairs", source: { n: 0, rmse: null }, rmseSkill: null } });
    const missing = scorePairedLedger(rows).comparisons.find(value => value.source === "bridge_exact" && value.reference === "naive_season")!;
    expect(missing.pairing).toMatchObject({ sourceRows: 1, referenceRows: 0, matched: 0 });
  });

  it("excludes duplicate source keys and malformed identities instead of picking a row", () => {
    const score = scorePairedLedger([row(1, "bridge_exact", 1, 1), row(1, "bridge_exact", 9, 1), row(1, "naive_last5", 1, 1),
      row(NaN, "bridge_exact", 1, 1), row(2, "bridge_exact", 1, 1, { season_id: null as any })]);
    expect(score.invalidIdentityRows).toBe(2);
    expect(score.comparisons.find(value => value.source === "bridge_exact" && value.reference === "naive_last5"))
      .toMatchObject({ pairing: { duplicateSourceKeys: 1, matched: 0 }, fantasyPoints: { source: { n: 0 } } });
    const goalie = row(1, "bridge_exact", 0, 0, { player_class: "goalie", start_probability: 0.8, started: true });
    expect(scoreLedger([goalie, goalie, { ...goalie, player_id: NaN }])).toEqual([]);
  });

  it("keeps partial heads separate, rejects conflicting actuals, and excludes DNP/unknown participation", () => {
    const rows = [
      row(1, "bridge_exact", 1, 1, { act_hits: null, exp_hits: 1 }), row(1, "naive_last5", 2, 1, { act_hits: 0, exp_hits: 1 }),
      row(2, "bridge_exact", 1, 1), row(2, "naive_last5", 1, 2),
      row(3, "bridge_exact", 9, 0, { dressed: false }), row(3, "naive_last5", 2, 0, { dressed: false }),
      row(4, "bridge_exact", 9, 0, { dressed: null }), row(4, "naive_last5", 2, 0, { dressed: null }),
      row(5, "bridge_exact", 9, 0), row(5, "naive_last5", 2, 0, { dressed: false }),
    ];
    const score = comparison(rows);
    expect(score.pairing).toMatchObject({ matched: 5, dressed: 2, conflictingParticipation: 1 });
    expect(score.heads.goals).toMatchObject({ source: { n: 1, bias: 0 }, reference: { n: 1, bias: 1 }, exclusions: { conflictingOutcome: 1 } });
    expect(score.heads.hits).toMatchObject({ source: { n: 0 }, exclusions: { missingOutcome: 2 } });
    expect(score.fantasyPoints.source.n).toBe(1);
  });

  it("bins by source expected FP rather than goals or actual FP and exposes per-head ratios", () => {
    const rows = Array.from({ length: 20 }, (_, i) => [
      row(i + 1, "bridge_exact", 20 - i, i >= 18 ? 4 : 0, { exp_fantasy_points: i + 1, act_fantasy_points: 2 }),
      row(i + 1, "naive_last5", 1, i >= 18 ? 4 : 0, { exp_fantasy_points: 1, act_fantasy_points: 2 }),
    ]).flat();
    const score = comparison(rows), top = score.expectedFpDeciles.find(bin => bin.decile === 10)!;
    expect(top).toMatchObject({ n: 2, minExpectedFp: 19, maxExpectedFp: 20,
      heads: { goals: { source: { n: 2, expected: 3, actual: 8, ratio: 2.6667 } } },
      fantasyPoints: { source: { expected: 39, actual: 4, ratio: 0.1026 } } });
    expect(scoreLedger(rows)[0].decile10).toEqual({ n: 2, expected: 39, actual: 4, ratio: 0.1026 });
    expect(score.position).toBe("unknown");
    expect(scorePairedLedger(rows).limitations).toMatchObject({ position: "unavailable_skater_position_not_captured",
      opportunityRate: "unavailable_expected_and_actual_toi_pp_toi_not_captured" });
  });

  it("recomputes FP with supplied weights and does not fill missing weighted heads", () => {
    const rows = [row(1, "bridge_exact", 2, 1, { act_hits: null }), row(1, "naive_last5", 3, 1, { act_hits: null })];
    const goalsOnly = scorePairedLedger(rows, { skater: { GOALS: 2 } }).comparisons.find(value => value.reference === "naive_last5")!;
    expect(goalsOnly.fantasyPoints.source).toMatchObject({ n: 1, expected: 4, actual: 2, bias: 2 });
    const withHits = scorePairedLedger(rows, { skater: { GOALS: 2, HITS: 1 } }).comparisons.find(value => value.reference === "naive_last5")!;
    expect(withHits.fantasyPoints.source.n).toBe(0);
    expect(withHits.heads.goals.source.n).toBe(1);
  });

  it("keeps zero-reference-error skill and constant-forecast slopes undefined", () => {
    const score = comparison([row(1, "bridge_exact", 2, 1), row(1, "naive_last5", 1, 1)]);
    expect(score.fantasyPoints).toMatchObject({ rmseSkill: null, source: { rmse: 1, mzSlope: null, mzIntercept: null }, reference: { rmse: 0 } });
  });

  it("pairs goalie event probabilities with their own binary outcomes, including proven non-starts", () => {
    const rows = [row(1, "bridge_exact", 0, 0, { player_class: "goalie", start_probability: 0.8, started: true, exp_win_prob: 0.6, act_win: 1, exp_shutout_prob: 0.2, act_shutout: 0 }),
      row(1, "naive_last5", 0, 0, { player_class: "goalie", start_probability: 0.5, started: true, exp_win_prob: 0.5, act_win: 1, exp_shutout_prob: 0.1, act_shutout: 0 }),
      row(2, "bridge_exact", 0, 0, { player_class: "goalie", dressed: false, start_probability: 0.2, started: false, exp_win_prob: 0.1, act_win: 0, exp_shutout_prob: 0.05, act_shutout: 0 }),
      row(2, "naive_last5", 0, 0, { player_class: "goalie", dressed: false, start_probability: 0.5, started: false, exp_win_prob: 0.2, act_win: 0, exp_shutout_prob: 0.1, act_shutout: 0 })];
    const score = comparison(rows);
    expect(score).toMatchObject({ position: "G", pairing: { dressed: 1 }, binaryPopulation: "settled_known_event" });
    expect(score.binary.start).toMatchObject({ source: { n: 2, brier: 0.04 }, reference: { n: 2, brier: 0.25 } });
    expect(score.binary.win).toMatchObject({ source: { n: 2, brier: 0.085 }, reference: { n: 2, brier: 0.145 } });
    expect(score.binary.shutout).toMatchObject({ source: { n: 2, brier: 0.0213 } });
    expect(score.binary.start!.source.reliability).toEqual([{ bin: 2, n: 1, predicted: 0.2, observed: 0 }, { bin: 8, n: 1, predicted: 0.8, observed: 1 }]);
    expect(scoreLedger(rows)[0].binary.start).toEqual(score.binary.start!.source);
  });

  it("withholds missing, non-binary, out-of-range and conflicting event pairs", () => {
    const variants: Partial<LedgerRow>[] = [{ exp_win_prob: -0.1 }, { exp_win_prob: 1.1 }, { act_win: 0.5 }, { act_win: null }, { act_win: 0 }];
    const rows = variants.flatMap((extra, i) => [
      row(i + 1, "bridge_exact", 0, 0, { player_class: "goalie", exp_win_prob: 0.5, act_win: 1, ...extra }),
      row(i + 1, "naive_last5", 0, 0, { player_class: "goalie", exp_win_prob: 0.5, act_win: 1 }),
    ]);
    expect(comparison(rows).binary.win).toEqual({ source: { n: 0, brier: null, reliability: [] }, reference: { n: 0, brier: null, reliability: [] },
      exclusions: { missingPrediction: 2, missingOutcome: 2, conflictingOutcome: 1 } });
    expect(comparison(rows).binary.start!.source.n).toBe(0);
  });

  it("includes exact zero/one probabilities and excludes an unsettled event partner", () => {
    const rows = [row(1, "bridge_exact", 0, 0, { player_class: "goalie", start_probability: 1, started: true }),
      row(1, "naive_last5", 0, 0, { player_class: "goalie", start_probability: 0, started: true }),
      row(2, "bridge_exact", 0, 0, { player_class: "goalie", start_probability: 0, started: false }),
      row(2, "naive_last5", 0, 0, { player_class: "goalie", start_probability: 1, started: false, settled_at: null })];
    expect(comparison(rows).binary.start).toMatchObject({ source: { n: 1, brier: 0, reliability: [{ bin: 9, predicted: 1, observed: 1 }] },
      reference: { n: 1, brier: 1, reliability: [{ bin: 0, predicted: 0, observed: 1 }] } });
  });
});

describe("market source (task 6.3)", () => {
  const built = buildLedgerRows(input()).rows;
  const quote = (player_id: number | null, market_type: string, sportsbook_key: string, outcome_key: string, line_value: number | null, price_american: number,
    source_observed_at = "2026-10-21T11:00:00Z"): LedgerMarketQuote => ({ game_id: 100, player_id, market_type, sportsbook_key, outcome_key, line_value, price_american, source_observed_at });
  const propQuotes = [quote(11, "player_shots_on_goal", "a", "over", 2.5, -120), quote(11, "player_shots_on_goal", "a", "under", 2.5, 100),
    quote(11, "player_shots_on_goal", "b", "over", 2.5, -115), quote(11, "player_shots_on_goal", "b", "under", 2.5, -105),
    // Decimal odds stored as American, a post-puck-drop price and a price newer than the snapshot never reach a probability.
    quote(11, "player_shots_on_goal", "veikkaus", "over", 2.5, 2), quote(11, "player_shots_on_goal", "veikkaus", "under", 2.5, 1),
    quote(11, "player_shots_on_goal", "live", "over", 2.5, 300, "2026-10-21T23:30:00Z"), quote(11, "player_shots_on_goal", "live", "under", 2.5, -400, "2026-10-21T23:30:00Z"),
    quote(11, "player_shots_on_goal", "late", "over", 2.5, 150, "2026-10-21T12:45:00Z"), quote(11, "player_shots_on_goal", "late", "under", 2.5, -180, "2026-10-21T12:45:00Z"),
    quote(11, "player_goal_scorer_anytime", "a", "yes", null, 250), quote(22, "player_assists", "a", "over", 0.5, 2)];
  const gameQuotes = [quote(null, "h2h", "a", "team:AAA", null, -150), quote(null, "h2h", "a", "team:BBB", null, 130),
    quote(null, "h2h", "tipsport", "team:AAA", null, 1), quote(null, "h2h", "tipsport", "team:BBB", null, 3)];
  const market = buildMarketLedgerRows({ date: "2026-10-21", now: NOW, rows: built, propQuotes, gameQuotes,
    teamAbbreviations: new Map([["100:1", "AAA"], ["100:2", "BBB"]]), teamWin: new Map([["100:1", 0.6]]) });
  const skater = market.find(row => row.player_id === 11)!, goalie = market.find(row => row.player_id === 31)!;
  const fairShots = (devigTwoWayAmerican(-120, 100)!.fairA + devigTwoWayAmerican(-115, -105)!.fairA) / 2;

  it("records the de-vigged market probability, its implied mean and each served source's probability at the market line", () => {
    expect(market.map(row => row.player_id)).toEqual([11, 31]);
    expect(built.some(row => "market_lines" in row)).toBe(false);
    expect(skater).toMatchObject({ source: "market", method_version: "served-ledger-market-v1", issued_at: "2026-10-21T11:00:00.000Z", run_id: null,
      exp_hits: null, exp_fantasy_points: null });
    const shots = skater.market_lines!.props.shots;
    expect(shots).toMatchObject({ market_type: "player_shots_on_goal", line: 2.5, books: 2, two_way_books: 2, yes_only_books: 0, devig_method: "shin" });
    expect(shots.market_p_over).toBeCloseTo(fairShots, 4);
    expect(getModelLineProbabilities({ marketType: "player_shots_on_goal", mean: shots.implied_mean!, line: 2.5 })!.overGivenNoPush).toBeCloseTo(fairShots, 3);
    expect(skater.exp_shots).toBe(shots.implied_mean);
    expect(Object.keys(shots.model_p_over).sort()).toEqual(["bridge_exact", "naive_last5", "naive_season"]);
    expect(shots.model_p_over.bridge_exact).toBeCloseTo(1 - Math.exp(-3) * 8.5, 4);
    expect(skater.market_lines!.props.goals).toMatchObject({ market_type: "player_goal_scorer_anytime", line: 0.5, books: 1, yes_only_books: 1 });
    expect(skater.market_lines!.props.goals.market_p_over).toBeCloseTo(devigYesOnly(250)!.probability, 4);
    // Skater 22's only price is decimal odds: no market row.
    expect(market.some(row => row.player_id === 22)).toBe(false);
  });

  it("keeps the moneyline as a conditional team win beside the bridge team-xG chance, not as exp_win_prob", () => {
    expect(goalie.market_lines).toMatchObject({ props: {}, team_win: { books: 1, model_p_win: { bridge_team_xg: 0.6 } } });
    expect(goalie.market_lines!.team_win!.market_p_win).toBeCloseTo(devigTwoWayAmerican(-150, 130)!.fairA, 4);
    expect(goalie.exp_win_prob).toBeNull();
  });

  it("inverts a market probability to a mean under the scoring distribution", () => {
    const p = getModelLineProbabilities({ marketType: "player_points", mean: 1.3, line: 0.5 })!.overGivenNoPush;
    expect(impliedMeanFromMarket("player_points", 0.5, p)).toBeCloseTo(1.3, 3);
    expect(impliedMeanFromMarket("player_points", 0.5, 1)).toBeNull();
  });

  it("settles market rows like any source and scores model versus market Brier/log loss on the same events", () => {
    const settled = settleLedgerRows([...built, ...market], { skaters: [{ game_id: 100, player_id: 11, goals: 0, assists: 1, pp_points: 0, shots: 4, hits: 0, blocked_shots: 1 }],
      goalies: [{ game_id: 100, player_id: 31, saves: 30, goals_against: 1, shots_against: 31, wins: 1, shutouts: 0, games_started: 1 }] }, "2026-10-22T11:00:00Z");
    const settledSkater = settled.find(row => row.player_id === 11 && row.source === "market")!;
    expect(settledSkater).toMatchObject({ act_shots: 4, act_goals: 0, dressed: true, market_lines: skater.market_lines });
    const scored = scoreMarketLedger(settled);
    const shots = scored.comparisons.find(row => row.event === "shots" && row.model === "bridge_exact")!;
    const pModel = skater.market_lines!.props.shots.model_p_over.bridge_exact!, pMarket = skater.market_lines!.props.shots.market_p_over;
    expect(shots).toMatchObject({ player_class: "skater", n: 1 });
    expect(shots.market.brier).toBeCloseTo((pMarket - 1) ** 2, 4);
    expect(shots.source.brier).toBeCloseTo((pModel - 1) ** 2, 4);
    expect(shots.source.logLoss).toBeCloseTo(-Math.log(pModel), 4);
    expect(shots.brierSkill).toBeCloseTo(1 - (pModel - 1) ** 2 / (pMarket - 1) ** 2, 4);
    const goals = scored.comparisons.find(row => row.event === "goals" && row.model === "bridge_exact")!;
    expect(goals.market.brier).toBeCloseTo(skater.market_lines!.props.goals.market_p_over ** 2, 4);
    expect(scored.comparisons.find(row => row.event === "team_win")).toMatchObject({ player_class: "goalie", model: "bridge_team_xg", n: 1, source: { brier: 0.16 } });
    // Paired mean errors: the served sources against the market's implied mean on the same player-game.
    const paired = scorePairedLedger(settled).comparisons.find(row => row.source === "bridge_exact" && row.reference === "market" && row.player_class === "skater")!;
    expect(paired.heads.shots).toMatchObject({ status: "scored", source: { n: 1, bias: -1 } });
    expect(paired.heads.hits).toMatchObject({ status: "no_valid_pairs", exclusions: { missingPrediction: 1 } });
  });

  it("excludes pushes, DNP voids and non-starts from market events", () => {
    const base = { ...skater, settled_at: "s", dressed: true, market_lines: { props: { shots: { ...skater.market_lines!.props.shots, line: 3 } }, team_win: null } };
    const scored = scoreMarketLedger([{ ...base, act_shots: 3 }, { ...base, player_id: 12, dressed: false, act_shots: 0 },
      { ...goalie, settled_at: "s", dressed: true, started: false, act_win: 0 }]);
    expect(scored).toMatchObject({ pushes: 1, missingOutcome: 1, notStarted: 1, comparisons: [] });
  });
});
