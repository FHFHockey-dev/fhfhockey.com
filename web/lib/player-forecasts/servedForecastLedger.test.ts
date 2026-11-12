import { describe, expect, it } from "vitest";
import { evaluateRetainedLedger } from "../../scripts/forge-ledger-evaluate";
import type { GameForecast } from "lib/rosterScheduleOptimizer/planningTypes";
import { devigTwoWayAmerican, devigYesOnly } from "lib/projections/utils/devig";
import { getModelLineProbabilities } from "lib/projections/utils/market-output-builders";
import { buildBoxscoreReceipts, buildLedgerRows, buildMarketLedgerRows, impliedMeanFromMarket, ledgerForecastBasis, scoreLedger, scoreMarketLedger, scorePairedLedger,
  settleLedgerRows, settleLedgerUniverse, type BuildLedgerInput, type LedgerMarketQuote, type LedgerRow, type StoredBoxscore } from "./servedForecastLedger";

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
    games_started: 1, saves: 25, goals_against: id % 2 ? 2 : 3, shots_against: id % 2 ? 27 : 28, wins: id === 20 ? 0 : 1, shutouts: id === 21 ? 1 : 0 })),
});
const HASH = "a".repeat(64);
const lineupPlayer = (playerId: number, extra: Record<string, unknown> = {}) => ({ playerId, toi: "15:00", ...extra });
/** A stored final boxscore for game 100 (team 1 hosts team 2). */
const boxscore = (home: { skaters: number[]; goalies: Array<Record<string, unknown>> }, away: { skaters: number[]; goalies: Array<Record<string, unknown>> },
  extra: Record<string, unknown> = {}): StoredBoxscore => ({ game_id: 100, payload_hash: HASH, fetched_at: "2026-10-22T06:00:00Z",
  payload: { id: 100, gameState: "OFF", homeTeam: { id: 1 }, awayTeam: { id: 2 }, ...extra,
    playerByGameStats: { homeTeam: { forwards: home.skaters.map(id => lineupPlayer(id)), defense: [], goalies: home.goalies },
      awayTeam: { forwards: away.skaters.map(id => lineupPlayer(id)), defense: [], goalies: away.goalies } } } });
const GAME_100 = { id: 100, homeTeamId: 1, awayTeamId: 2, startTime: "2026-10-21T23:00:00Z" };
const find = (rows: LedgerRow[], player: number, source: string) => rows.find(row => row.player_id === player && row.source === source);

describe("read-only retained ledger adapter", () => {
  const retained = () => buildLedgerRows(input()).rows.map(row => ({ ...row, created_at: NOW.toISOString() }));
  it("preserves unknown population rows and refuses invented H10/H20 trajectories", () => {
    const rows = retained(), report = evaluateRetainedLedger(rows, "2026-10-22T12:00:00Z");
    expect(report.population.acceptedRows).toBe(rows.length);
    expect(report.population.bySource.reduce((sum, row) => sum + row.unknownAppearance, 0)).toBe(rows.length);
    expect(report.population.independentEligiblePopulation).toBeNull();
    expect(report.horizons.slice(1)).toEqual([10, 20].map(horizon => ({ horizon, status: "unavailable", reason: "no_frozen_cumulative_window_in_served_ledger" })));
    expect(rows.every(row => row.dressed === null)).toBe(true);
  });
  it("excludes future canaries and postgame captures with explicit reasons", () => {
    const rows = retained();
    rows[0].cutoff_at = "2026-10-22T00:00:00Z";
    rows[1].created_at = "2026-10-22T00:00:00Z";
    const report = evaluateRetainedLedger(rows, "2026-10-23T00:00:00Z");
    expect(report.population.excluded).toEqual([{ index: 0, reason: "not_retained_pregame" }, { index: 1, reason: "not_retained_pregame" }]);
  });
  it("masks immature labels without changing retained forecasts or supplied records", () => {
    const rows = retained();
    Object.assign(rows[0], { settled_at: "2026-10-24T00:00:00Z", dressed: true, act_goals: 4 });
    const report = evaluateRetainedLedger(rows, "2026-10-22T12:00:00Z");
    expect(report.population.outcomeUnavailable[0].reason).toBe("invalid_or_immature_settlement");
    expect(report.population.bySource.every(row => row.knownAppearance === 0)).toBe(true);
    expect(rows[0].act_goals).toBe(4);
  });
  it("retains proven DNP separately from unknowns and never fills a missing count", () => {
    const rows = retained();
    Object.assign(rows[0], { settled_at: "2026-10-22T06:00:00Z", dressed: false, act_goals: 0, act_hits: null });
    const report = evaluateRetainedLedger(rows, "2026-10-22T12:00:00Z");
    expect(report.population.bySource.reduce((sum, row) => sum + row.knownDnp, 0)).toBe(1);
    expect(rows[0].act_hits).toBeNull();
  });
  it("quarantines invalid observed counts without repairing labels", () => {
    const rows = retained();
    Object.assign(rows[0], { settled_at: "2026-10-22T06:00:00Z", dressed: true, act_goals: 0.5 });
    expect(evaluateRetainedLedger(rows, "2026-10-22T12:00:00Z").population.outcomeUnavailable[0].reason).toBe("invalid_observed_counts");
    expect(rows[0].act_goals).toBe(0.5);
    // Two observed ledger accounting failures, without inferring a corrected GA.
    for (const [saves, goalsAgainst, shotsAgainst] of [[25, 6, 30], [29, 4, 32]]) {
      Object.assign(rows[0], { player_class: "goalie", act_goals: null, act_saves: saves, act_goals_against: goalsAgainst, act_shots_against: shotsAgainst });
      expect(evaluateRetainedLedger(rows, "2026-10-22T12:00:00Z").population.outcomeUnavailable[0].reason).toBe("invalid_observed_counts");
      expect(rows[0].act_goals_against).toBe(goalsAgainst);
    }
  });
  it("quarantines incoherent point means while retaining their population and known outcomes", () => {
    const rows = retained();
    Object.assign(rows[0], { player_class: "goalie", exp_shots_against: 13.5833, exp_saves: 11, exp_goals_against: 2.6667,
      dressed: true, settled_at: "2026-10-22T06:00:00Z" });
    const result = evaluateRetainedLedger(rows, "2026-10-22T12:00:00Z");
    expect(result.population.forecastUnavailable).toEqual([{ index: 0, reason: "invalid_prediction_accounting" }]);
    expect(result.population.acceptedRows).toBe(rows.length);
    expect(result.population.bySource.reduce((sum, row) => sum + row.knownAppearance, 0)).toBe(1);
    rows[0].exp_goals_against = 2.5834;
    expect(evaluateRetainedLedger(rows, "2026-10-22T12:00:00Z").population.forecastUnavailable).toEqual([]);
  });
});

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

  it("computes naive controls from WGO games before the date, conditional on dressing with unknown participation", () => {
    const last5 = find(rows, 11, "naive_last5")!, season = find(rows, 11, "naive_season")!;
    // W2-7 D6: means over games played are an if-dressed line; v1 stamped participation 1.
    expect(last5).toMatchObject({ exp_goals: 0.4, exp_assists: 1, exp_hits: 1, participation_probability: null, method_version: "served-ledger-naive-v2",
      source_watermark: "wgo_skater_stats:2026-10-20:5", forecast_basis: "conditional_dressed" });
    expect(season.exp_goals).toBeCloseTo(4 / 6, 4);
    expect(find(rows, 22, "naive_last5")).toBeUndefined();
  });

  it("uses a true last-5 window and the goalie's own credited wins, never the team win chance", () => {
    const last5 = find(rows, 31, "naive_last5")!, season = find(rows, 31, "naive_season")!;
    // Team 1's last five games (17..21): he started 18..21, so 4/5. His last five starts are 16, 18, 19, 20, 21:
    // one shutout (21) and one loss (20). Ten starts would give shutout .1 and wins .9; team win would give .6.
    expect(last5.start_probability).toBe(0.8);
    expect(last5).toMatchObject({ exp_saves: 20, exp_goals_against: 2.08, exp_shots_against: 22.08, exp_win_prob: 0.64, exp_shutout_prob: 0.16,
      forecast_basis: "unconditional", source_watermark: "wgo_goalie_stats:2026-10-20:5" });
    expect(last5.exp_fantasy_points).toBeCloseTo(0.2 * 20 - 2.08 + 4 * 0.64 + 3 * 0.16, 4);
    expect(season.start_probability).toBeCloseTo(10 / 12, 4);
    expect(season.exp_win_prob).toBeCloseTo((10 / 12) * 0.9, 4);
  });

  it("keeps an unrecorded goalie decision unknown instead of a neutral 0.5", () => {
    const args = input();
    args.goalieGameRows = args.goalieGameRows.map(row => ({ ...row, wins: null }));
    const last5 = find(buildLedgerRows(args).rows, 31, "naive_last5")!;
    expect(last5.exp_win_prob).toBeNull();
    expect(last5.exp_fantasy_points).toBeNull();
  });

  it("declares a basis on every row: bridge unconditional, naive skater conditional, naive goalie unconditional", () => {
    expect(rows.map(row => [row.player_id, row.source, row.forecast_basis])).toEqual(expect.arrayContaining([
      [11, "bridge_exact", "unconditional"], [22, "bridge_reaimed", "unconditional"], [11, "naive_last5", "conditional_dressed"], [31, "naive_season", "unconditional"]]));
    expect(rows.every(row => row.forecast_basis === ledgerForecastBasis({ source: row.source, player_class: row.player_class }))).toBe(true);
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

  // Team 1 dressed skater 11 and goalie 31 (starter); team 2 dressed 201 and 202, not skater 22.
  const official = () => boxscore({ skaters: [11], goalies: [lineupPlayer(31, { starter: true })] },
    { skaters: [201, 202], goalies: [lineupPlayer(32, { starter: true })] });
  const wgo = { skaters: [11, 201, 202].map(player_id => ({ game_id: 100, player_id, goals: 0, assists: 0, pp_points: 0, shots: 1, hits: 0, blocked_shots: 0 })),
    goalies: [{ game_id: 100, player_id: 31, saves: 30, goals_against: 0, shots_against: 30, wins: 1, shutouts: 1, games_started: 1 }] };
  const receiptsFor = (stored: StoredBoxscore[], actuals: { skaters: Array<Record<string, unknown>>; goalies: Array<Record<string, unknown>> } = wgo) => buildBoxscoreReceipts({ games: [GAME_100], boxscores: stored, ...actuals });

  it("settles a receipt-proven non-appearance as 0 on an unconditional row only", () => {
    const { receipts, rejections } = receiptsFor([official()]);
    expect(rejections).toEqual([]);
    expect(receipts.map(receipt => [receipt.teamId, receipt.skaterIds, receipt.goalieIds])).toEqual([[1, [11], [31]], [2, [201, 202], [32]]]);
    const dnp = settleLedgerRows(rows, { ...wgo, receipts }, "s");
    expect(find(dnp, 22, "bridge_reaimed")).toMatchObject({ dressed: false, act_goals: 0, act_hits: 0, act_fantasy_points: 0, settled_at: "s",
      outcome_source: `nhl_api_game_payloads_raw:boxscore:${HASH}` });
    expect(find(dnp, 11, "bridge_exact")).toMatchObject({ dressed: true, act_shots: 1, outcome_source: `wgo_skater_stats+nhl_api_game_payloads_raw:boxscore:${HASH}` });
  });

  it("voids, never zeroes, a non-appearance on a conditional row", () => {
    const lineup = boxscore({ skaters: [12], goalies: [lineupPlayer(31, { starter: true })] }, { skaters: [201], goalies: [lineupPlayer(32, { starter: true })] });
    const actuals = { skaters: [12, 201].map(player_id => ({ game_id: 100, player_id, goals: 0 })), goalies: wgo.goalies };
    const { receipts } = receiptsFor([lineup], actuals);
    const settled = settleLedgerRows(rows, { ...actuals, receipts }, "s");
    expect(find(settled, 11, "bridge_exact")).toMatchObject({ dressed: false, act_goals: 0, act_fantasy_points: 0 });
    expect(find(settled, 11, "naive_last5")).toMatchObject({ dressed: false, settled_at: "s", act_goals: null, act_fantasy_points: null });
  });

  it("rejects a receipt whose ingested ids differ from the official lineup even when the counts match", () => {
    // Official [201, 202] against ingested [201, 999]: two rows each, not the same players.
    const actuals = { skaters: [11, 201, 999].map(player_id => ({ game_id: 100, player_id, goals: 0 })), goalies: wgo.goalies };
    const { receipts, rejections } = receiptsFor([official()], actuals);
    expect(receipts).toEqual([]);
    expect(rejections).toEqual([{ gameId: 100, reason: "ingested_identity_conflict" }]);
    expect(find(settleLedgerRows(rows, { ...actuals, receipts }, "s"), 22, "bridge_reaimed")).toMatchObject({ dressed: null, settled_at: null, act_fantasy_points: null });
  });

  it("requires a final boxscore for the scheduled game and teams with a parseable lineup and provenance", () => {
    const variants: Array<[StoredBoxscore, string]> = [
      [boxscore({ skaters: [11], goalies: [lineupPlayer(31)] }, { skaters: [201, 202], goalies: [lineupPlayer(32)] }, { gameState: "LIVE" }), "not_final"],
      [boxscore({ skaters: [11], goalies: [lineupPlayer(31)] }, { skaters: [201, 202], goalies: [lineupPlayer(32)] }, { awayTeam: { id: 9 } }), "game_identity_mismatch"],
      [{ ...official(), payload_hash: "short" }, "invalid_provenance"],
      [{ ...official(), fetched_at: "2026-10-21T20:00:00Z" }, "invalid_provenance"],
      [boxscore({ skaters: [11], goalies: [] }, { skaters: [201, 202], goalies: [lineupPlayer(32)] }), "unparseable_lineup"],
      [boxscore({ skaters: [11, 11], goalies: [lineupPlayer(31)] }, { skaters: [201, 202], goalies: [lineupPlayer(32)] }), "duplicate_player_ids"],
    ];
    for (const [stored, reason] of variants) {
      const { receipts, rejections } = receiptsFor([stored]);
      expect(receipts).toEqual([]);
      expect(rejections).toEqual([{ gameId: 100, reason }]);
    }
    expect(receiptsFor([]).rejections).toEqual([{ gameId: 100, reason: "no_stored_boxscore" }]);
    // The newest stored boxscore decides: a later live re-fetch withdraws the receipt.
    expect(receiptsFor([{ ...official(), payload: { ...official().payload, gameState: "LIVE" } }, official()]).receipts).toEqual([]);
  });

  it("leaves a player listed for the other side unresolved (team scope conflict)", () => {
    const lineup = boxscore({ skaters: [11], goalies: [lineupPlayer(31, { starter: true })] }, { skaters: [201, 22], goalies: [lineupPlayer(32, { starter: true })] });
    const { receipts } = receiptsFor([lineup], { skaters: [11, 201].map(player_id => ({ game_id: 100, player_id, goals: 0 })), goalies: wgo.goalies });
    const moved = rows.map(row => row.player_id === 22 ? { ...row, team_id: 1 } : row);
    expect(find(settleLedgerRows(moved, { ...wgo, skaters: [], receipts }, "s"), 22, "bridge_reaimed")).toMatchObject({ dressed: null, settled_at: null });
  });

  it("settles a dressed backup with zero TOI from the receipt and keeps an unlisted WGO-less starter unresolved", () => {
    const lineup = boxscore({ skaters: [11], goalies: [lineupPlayer(30, { starter: true }), lineupPlayer(31, { starter: false, toi: "00:00" })] },
      { skaters: [201, 202], goalies: [lineupPlayer(32, { starter: true })] });
    const actuals = { skaters: wgo.skaters, goalies: [{ game_id: 100, player_id: 30, saves: 20, goals_against: 2, shots_against: 22, wins: 1, shutouts: 0, games_started: 1 }] };
    const { receipts } = receiptsFor([lineup], actuals);
    const settled = settleLedgerRows(rows, { ...actuals, receipts }, "s");
    expect(find(settled, 31, "naive_last5")).toMatchObject({ dressed: true, started: false, act_saves: 0, act_win: 0, act_fantasy_points: 0 });
    const starter = boxscore({ skaters: [11], goalies: [lineupPlayer(31, { starter: true })] }, { skaters: [201, 202], goalies: [lineupPlayer(32, { starter: true })] });
    const noRow = settleLedgerRows(rows, { skaters: wgo.skaters, goalies: [], receipts: receiptsFor([starter], { skaters: wgo.skaters, goalies: [] }).receipts }, "s");
    expect(find(noRow, 31, "naive_last5")).toMatchObject({ dressed: null, settled_at: null });
  });

  it("never infers a non-appearance without a receipt, and drops a settlement the evidence no longer supports", () => {
    const { receipts } = receiptsFor([official()]);
    const dnp = settleLedgerRows(rows, { ...wgo, receipts }, "s");
    expect(find(settleLedgerRows(rows, { skaters: [], goalies: [] }, "s"), 22, "bridge_reaimed")).toMatchObject({ dressed: null, settled_at: null });
    const recovered = settleLedgerRows(dnp, { skaters: [{ game_id: 100, player_id: 22, goals: 1 }], goalies: [] }, "later");
    expect(find(recovered, 22, "bridge_reaimed")).toMatchObject({ dressed: true, act_goals: 1, act_hits: null, act_fantasy_points: null });
    expect(settleLedgerRows(recovered, { skaters: [{ game_id: 100, player_id: 22, goals: 1 }], goalies: [] }, "later")).toEqual(recovered);
    expect(find(settleLedgerRows(dnp, { skaters: [], goalies: [] }, "unverified"), 22, "bridge_reaimed"))
      .toMatchObject({ dressed: null, settled_at: null, act_goals: null, act_fantasy_points: null });
  });

  it("settles the universe from the same receipts and keeps the receipt with it", () => {
    const { receipts } = receiptsFor([official()]);
    const universe = settleLedgerUniverse(buildLedgerRows(input()).universe, { ...wgo, receipts }, "s");
    expect(universe.find(row => row.player_id === 22)).toMatchObject({ dressed: false, settled_at: "s", receipt: { teamId: 2, payloadHash: HASH } });
    expect(universe.find(row => row.player_id === 11)).toMatchObject({ dressed: true, receipt: { teamId: 1 } });
    expect(settleLedgerUniverse(buildLedgerRows(input()).universe, { skaters: [], goalies: [] }, "s").every(row => row.dressed === null && row.settled_at === null)).toBe(true);
  });
});

describe("scoreLedger", () => {
  // 20 settled skater rows: expected goals 0.05..1.00, actual goals 1 for the top two, else 0; even ids on a back-to-back.
  const base = buildLedgerRows(input()).rows.find(row => row.source === "bridge_exact")!;
  const fixture: LedgerRow[] = Array.from({ length: 20 }, (_, i) => ({ ...base, player_id: 1000 + i, exp_goals: (i + 1) / 20, act_goals: i >= 18 ? 1 : 0,
    exp_fantasy_points: 2, act_fantasy_points: i % 2 ? 1 : 4, team_rest_days: i % 2 ? 2 : 1, dressed: i !== 0, settled_at: "s" }));
  fixture.push({ ...base, player_id: 9999, settled_at: null });
  const [score] = scoreLedger(fixture, undefined, fixture.filter(row => row.settled_at !== null));

  it("reports n, coverage, phantoms, MAE and signed bias over the unconditional row's settled eligible population", () => {
    // Decision 41: the settled non-appearance (row 0) is part of an unconditional forecast's population; v1 scored 19 dressed rows.
    expect(score).toMatchObject({ source: "bridge_exact", player_class: "skater", n: 20, dressed: 19, covered: 19, coverage: 1, phantoms: 1,
      basis: "unconditional", scoringPopulation: "settled_eligible", scoringVersion: "served-ledger-scoring-v2" });
    expect(score.heads.goals.bias).toBeCloseTo((10.5 - 2) / 20, 4);
    expect(score.heads.goals.n).toBe(20);
    expect(score.fantasyPoints).toMatchObject({ n: 20, mae: 1.5, bias: -0.5 });
  });

  it("keeps tied expected FP together and slices back-to-backs from the same population", () => {
    expect(score.decile10).toBeNull();
    expect(score.expectedFpDeciles).toMatchObject([{ decile: 6, n: 20, minExpectedFp: 2, maxExpectedFp: 2 }]);
    expect(score.b2b.fantasyPoints).toMatchObject({ n: 10, mae: 2, bias: -2 });
    expect(score.reliability).toEqual({});
  });

  it("scores a conditional source on dressed players only", () => {
    const conditional = scoreLedger(fixture.map(row => ({ ...row, source: "naive_last5" as const, forecast_basis: undefined })))[0];
    expect(conditional).toMatchObject({ source: "naive_last5", basis: "conditional_dressed", scoringPopulation: "dressed_only", fantasyPoints: { n: 19, mae: 1.4737 } });
  });

  it("includes a receipt-settled backup in the unconditional count score (W2-8 D1)", () => {
    // Starter 31 played; backup 33 is on the roster and did not dress. Both unconditional bridge rows.
    const goalieRow = (player_id: number, saves: number) => ({ ...base, player_id, player_class: "goalie" as const, source: "bridge_exact" as const,
      exp_saves: saves, exp_goals_against: 1, exp_shots_against: saves + 1, exp_win_prob: 0.3, exp_shutout_prob: 0.02, forecast_basis: "unconditional" as const });
    const lineup = boxscore({ skaters: [11], goalies: [lineupPlayer(31, { starter: true })] }, { skaters: [201], goalies: [lineupPlayer(32, { starter: true })] });
    const actuals = { skaters: [11, 201].map(player_id => ({ game_id: 100, player_id, goals: 0 })),
      goalies: [{ game_id: 100, player_id: 31, saves: 25, goals_against: 2, shots_against: 27, wins: 1, shutouts: 0, games_started: 1 }] };
    const { receipts } = buildBoxscoreReceipts({ games: [GAME_100], boxscores: [lineup], ...actuals });
    const settled = settleLedgerRows([goalieRow(31, 20), goalieRow(33, 6)], { ...actuals, receipts }, "s");
    const [goalieScore] = scoreLedger(settled);
    expect(goalieScore.heads.saves).toMatchObject({ n: 2, expected: 26, actual: 25 });
    expect(goalieScore.binary.start).toMatchObject({ n: 0 });
    expect(goalieScore.binary.win).toMatchObject({ n: 2 });
    // Without the receipt the backup stays unresolved and out of every population.
    expect(scoreLedger(settleLedgerRows([goalieRow(31, 20), goalieRow(33, 6)], actuals, "s"))[0].heads.saves).toMatchObject({ n: 1, expected: 20 });
  });

  it("bins goalie start and win probabilities", () => {
    const goalie = settleLedgerRows(buildLedgerRows(input()).rows, { skaters: [], goalies: [{ game_id: 100, player_id: 31, saves: 30, goals_against: 0, shots_against: 30, wins: 1, shutouts: 1, games_started: 1 }] }, "s");
    const last5 = scoreLedger(goalie).find(row => row.source === "naive_last5" && row.player_class === "goalie")!;
    expect(last5.reliability.start).toEqual([{ bin: 8, n: 1, predicted: 0.8, observed: 1 }]);
    expect(last5.reliability.win).toEqual([{ bin: 6, n: 1, predicted: 0.64, observed: 1 }]);
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

  it("keeps partial heads separate, rejects conflicting actuals, keeps settled DNP pairs for an unconditional basis and excludes unknown participation", () => {
    const rows = [
      row(1, "bridge_exact", 1, 1, { act_hits: null, exp_hits: 1 }), row(1, "naive_last5", 2, 1, { act_hits: 0, exp_hits: 1 }),
      row(2, "bridge_exact", 1, 1), row(2, "naive_last5", 1, 2),
      row(3, "bridge_exact", 9, 0, { dressed: false }), row(3, "naive_last5", 2, 0, { dressed: false }),
      row(4, "bridge_exact", 9, 0, { dressed: null }), row(4, "naive_last5", 2, 0, { dressed: null }),
      row(5, "bridge_exact", 9, 0), row(5, "naive_last5", 2, 0, { dressed: false }),
    ];
    const score = comparison(rows);
    // Both rows carry the bridge's unconditional basis, so the proven DNP pair (player 3) is scored (decision 41).
    expect(score.pairing).toMatchObject({ matched: 5, dressed: 3, conflictingParticipation: 1 });
    expect(score).toMatchObject({ status: "paired", scoringPopulation: "settled_eligible", basis: { source: "unconditional", reference: "unconditional" } });
    expect(score.heads.goals).toMatchObject({ source: { n: 2, bias: 4.5 }, reference: { n: 2, bias: 1.5 }, exclusions: { conflictingOutcome: 1 } });
    expect(score.heads.hits).toMatchObject({ source: { n: 0 }, exclusions: { missingOutcome: 3 } });
    expect(score.fantasyPoints.source.n).toBe(2);
  });

  it("refuses to compare an unconditional source with a conditional one (decision 41)", () => {
    const rows = [row(1, "bridge_exact", 1, 0, { dressed: false }), row(1, "naive_last5", 2, 0, { dressed: false, forecast_basis: undefined }),
      row(2, "bridge_exact", 1, 2), row(2, "naive_last5", 2, 2, { forecast_basis: undefined })];
    const score = comparison(rows);
    expect(score).toMatchObject({ status: "basis_mismatch", scoringPopulation: "not_comparable",
      basis: { source: "unconditional", reference: "conditional_dressed" }, pairing: { matched: 2, dressed: 0, conflictingParticipation: 0 } });
    expect(score.heads.goals).toMatchObject({ status: "no_valid_pairs", source: { n: 0 } });
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
    expect(score).toMatchObject({ position: "G", pairing: { dressed: 2 }, binaryPopulation: "settled_known_event" });
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
    expect(skater).toMatchObject({ source: "market", method_version: "served-ledger-market-v2", issued_at: "2026-10-21T11:00:00.000Z", run_id: null,
      exp_hits: null, exp_fantasy_points: null, forecast_basis: "conditional_dressed" });
    const shots = skater.market_lines!.props.shots;
    expect(shots).toMatchObject({ market_type: "player_shots_on_goal", line: 2.5, books: 2, two_way_books: 2, yes_only_books: 0, devig_method: "shin" });
    expect(shots.market_p_over).toBeCloseTo(fairShots, 4);
    expect(getModelLineProbabilities({ marketType: "player_shots_on_goal", mean: shots.implied_mean!, line: 2.5 })!.overGivenNoPush).toBeCloseTo(fairShots, 3);
    expect(skater.exp_shots).toBe(shots.implied_mean);
    // A prop prices a dressed player: only if-dressed sources get a model P(over); the bridge's unconditional mean does not (decision 41).
    expect(Object.keys(shots.model_p_over).sort()).toEqual(["naive_last5", "naive_season"]);
    expect(shots.model_p_over.naive_last5).toBeCloseTo(1 - Math.exp(-3) * 8.5, 4);
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
    const shots = scored.comparisons.find(row => row.event === "shots" && row.model === "naive_last5")!;
    const pModel = skater.market_lines!.props.shots.model_p_over.naive_last5!, pMarket = skater.market_lines!.props.shots.market_p_over;
    expect(shots).toMatchObject({ player_class: "skater", n: 1 });
    expect(shots.market.brier).toBeCloseTo((pMarket - 1) ** 2, 4);
    expect(shots.source.brier).toBeCloseTo((pModel - 1) ** 2, 4);
    expect(shots.source.logLoss).toBeCloseTo(-Math.log(pModel), 4);
    expect(shots.brierSkill).toBeCloseTo(1 - (pModel - 1) ** 2 / (pMarket - 1) ** 2, 4);
    const goals = scored.comparisons.find(row => row.event === "goals" && row.model === "naive_last5")!;
    expect(goals.market.brier).toBeCloseTo(skater.market_lines!.props.goals.market_p_over ** 2, 4);
    expect(scored.comparisons.find(row => row.event === "team_win")).toMatchObject({ player_class: "goalie", model: "bridge_team_xg", n: 1, source: { brier: 0.16 } });
    // Paired mean errors: the served sources against the market's implied mean on the same player-game.
    const paired = scorePairedLedger(settled).comparisons.find(row => row.source === "naive_last5" && row.reference === "market" && row.player_class === "skater")!;
    expect(paired.heads.shots).toMatchObject({ status: "scored", source: { n: 1, bias: -1 } });
    expect(paired.heads.hits).toMatchObject({ status: "no_valid_pairs", exclusions: { missingPrediction: 1 } });
    expect(scorePairedLedger(settled).comparisons.find(row => row.source === "bridge_exact" && row.reference === "market" && row.player_class === "skater"))
      .toMatchObject({ status: "basis_mismatch" });
  });

  it("skips an issued v1 market row's unconditional model probabilities instead of relabelling them", () => {
    const v1 = { ...skater, method_version: "served-ledger-market-v1", forecast_basis: undefined, settled_at: "s", dressed: true, act_shots: 4,
      market_lines: { props: { shots: { ...skater.market_lines!.props.shots, model_p_over: { bridge_exact: 0.6, naive_last5: 0.55 } } }, team_win: null } };
    const scored = scoreMarketLedger([v1]);
    expect(scored.basisMismatch).toBe(1);
    expect(scored.comparisons.map(row => row.model)).toEqual(["naive_last5"]);
  });

  it("excludes pushes, DNP voids and non-starts from market events", () => {
    const base = { ...skater, settled_at: "s", dressed: true, market_lines: { props: { shots: { ...skater.market_lines!.props.shots, line: 3 } }, team_win: null } };
    const scored = scoreMarketLedger([{ ...base, act_shots: 3 }, { ...base, player_id: 12, dressed: false, act_shots: 0 },
      { ...goalie, settled_at: "s", dressed: true, started: false, act_win: 0 }]);
    expect(scored).toMatchObject({ pushes: 1, missingOutcome: 1, notStarted: 1, comparisons: [] });
  });
});
