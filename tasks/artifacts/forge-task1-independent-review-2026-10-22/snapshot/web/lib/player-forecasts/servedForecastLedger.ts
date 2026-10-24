import { computeGoalieFantasyPoints, computeSkaterFantasyPoints } from "lib/projections/accuracy/fantasyPoints";
import { DEFAULT_GOALIE_FANTASY_POINTS, DEFAULT_SKATER_FANTASY_POINTS } from "lib/projectionsConfig/fantasyPointsConfig";
import type { GameForecast } from "lib/rosterScheduleOptimizer/planningTypes";
import type { GameExpectation } from "./gameExpectations";

/** Served-forecast ledger (S-B): what the RSO was shown per player-game, beside naive controls. Pure, no I/O. */
export const LEDGER_SOURCES = ["bridge_exact", "bridge_reaimed", "native", "naive_last5", "naive_season"] as const;
export type LedgerSource = typeof LEDGER_SOURCES[number];
export const NAIVE_METHOD_VERSION = "served-ledger-naive-v1";
type Row = Record<string, any>;
type Num = number | null;
type Class = "skater" | "goalie";

/** Mirrors `forge_served_forecast_ledger` (created_at/updated_at are database defaults). */
export type LedgerRow = {
  served_date: string; season_id: number; player_id: number; game_id: number; source: LedgerSource; player_class: Class;
  team_id: number; opponent_team_id: number; is_home: boolean; scheduled_at: string; team_rest_days: Num; opponent_rest_days: Num;
  run_id: string | null; source_watermark: string | null; method_version: string | null; cutoff_at: string | null; issued_at: string | null; expires_at: string | null;
  participation_probability: Num; start_probability: Num;
  exp_goals: Num; exp_assists: Num; exp_pp_points: Num; exp_shots: Num; exp_hits: Num; exp_blocks: Num;
  exp_saves: Num; exp_goals_against: Num; exp_shots_against: Num; exp_win_prob: Num; exp_shutout_prob: Num; exp_fantasy_points: Num;
  act_goals: Num; act_assists: Num; act_pp_points: Num; act_shots: Num; act_hits: Num; act_blocks: Num;
  act_saves: Num; act_goals_against: Num; act_shots_against: Num; act_win: Num; act_shutout: Num; act_fantasy_points: Num;
  dressed: boolean | null; started: boolean | null; settled_at: string | null; outcome_source: string | null;
};
export type LedgerGame = { gameId: number; date: string; scheduledAt: string | null; status: string; homeTeamId: number; awayTeamId: number };
/** `planningId` is the bridge forecast's `playerId` (identity id); `nhlId` keys WGO rows and the ledger. */
export type LedgerPlayer = { nhlId: number; planningId: string; playerClass: Class; teamId: number };
/** Independent snapshot membership, including players with no forecast or history. Requires separate durable storage. */
export type LedgerUniverseRow = Pick<LedgerRow, "served_date" | "season_id" | "player_id" | "game_id" | "player_class" | "team_id" | "dressed">;
export type BuildLedgerInput = {
  date: string; seasonId: number; now: Date; games: LedgerGame[]; players: LedgerPlayer[];
  bridgeForecasts: GameForecast[]; /** forge_runs run_id → as_of_date */ runDates: Map<string, string>;
  nativeExpectations?: Array<{ playerId: number; expectation: GameExpectation }>;
  /** This season's `games` rows (id, date, homeTeamId, awayTeamId) through `date`: rest days and team start shares. */
  scheduleGames: Row[];
  /** `wgo_skater_stats` per-game rows (player_id, date, season_id, goals, assists, pp_points, shots, hits, blocked_shots). */
  wgoGameRows: Row[];
  /** `wgo_goalie_stats` per-game rows (goalie_id, game_id, date, season_id, games_started, saves, goals_against, shots_against, wins, shutouts). */
  goalieGameRows: Row[];
  /** `${gameId}:${teamId}` → team win chance from team xG (bridge `teamWinProbability`); absent means 0.5. */
  teamWin?: Map<string, number>;
};

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const num = (value: unknown): Num => finite(value) ? value : null;
const round = (value: Num) => value === null ? null : Math.round(value * 10000) / 10000;
const mean = (values: unknown[]) => { const known = values.filter(finite); return known.length ? known.reduce((a, b) => a + b, 0) / known.length : null; };
const times = (a: Num, b: Num) => a === null || b === null ? null : a * b;
const SKATER_HEADS = { goals: "GOALS", assists: "ASSISTS", pp_points: "PP_POINTS", shots: "SHOTS_ON_GOAL", hits: "HITS", blocks: "BLOCKED_SHOTS" } as const;
const GOALIE_HEADS = { saves: "SAVES_GOALIE", goals_against: "GOALS_AGAINST_GOALIE", shots_against: "SHOTS_AGAINST_GOALIE", win_prob: "WINS_GOALIE", shutout_prob: "SHUTOUTS_GOALIE" } as const;
const WGO_SKATER = { goals: "goals", assists: "assists", pp_points: "pp_points", shots: "shots", hits: "hits", blocks: "blocked_shots" } as const;
export type FantasyWeights = { skater?: Record<string, number>; goalie?: Record<string, number> };

/** League-default (TJ's) fantasy points; null when any head with a non-zero weight is unknown (R15 accuracy rule). */
export function ledgerFantasyPoints(playerClass: Class, heads: Record<string, Num>, weights: FantasyWeights = {}): Num {
  if (playerClass === "skater") {
    const config = weights.skater ?? DEFAULT_SKATER_FANTASY_POINTS;
    const line = { goals: heads.goals, assists: heads.assists, ppPoints: heads.pp_points, shots: heads.shots, hits: heads.hits, blockedShots: heads.blocks };
    const keys: Array<[keyof typeof line, string]> = [["goals", "GOALS"], ["assists", "ASSISTS"], ["ppPoints", "PP_POINTS"], ["shots", "SHOTS_ON_GOAL"], ["hits", "HITS"], ["blockedShots", "BLOCKED_SHOTS"]];
    return keys.some(([key, weight]) => config[weight] && line[key] === null) ? null : round(computeSkaterFantasyPoints(line as never, config));
  }
  const config = weights.goalie ?? DEFAULT_GOALIE_FANTASY_POINTS;
  const line = { saves: heads.saves, goalsAgainst: heads.goals_against, wins: heads.win, shutouts: heads.shutout };
  const keys: Array<[keyof typeof line, string]> = [["saves", "SAVES_GOALIE"], ["goalsAgainst", "GOALS_AGAINST_GOALIE"], ["wins", "WINS_GOALIE"], ["shutouts", "SHUTOUTS_GOALIE"]];
  return keys.some(([key, weight]) => config[weight] && line[key] === null) ? null : round(computeGoalieFantasyPoints(line as never, config));
}
const expHeads = (row: LedgerRow): Record<string, Num> => row.player_class === "skater"
  ? { goals: row.exp_goals, assists: row.exp_assists, pp_points: row.exp_pp_points, shots: row.exp_shots, hits: row.exp_hits, blocks: row.exp_blocks }
  : { saves: row.exp_saves, goals_against: row.exp_goals_against, win: row.exp_win_prob, shutout: row.exp_shutout_prob };
const actHeads = (row: LedgerRow): Record<string, Num> => row.player_class === "skater"
  ? { goals: row.act_goals, assists: row.act_assists, pp_points: row.act_pp_points, shots: row.act_shots, hits: row.act_hits, blocks: row.act_blocks }
  : { saves: row.act_saves, goals_against: row.act_goals_against, win: row.act_win, shutout: row.act_shutout };

const EMPTY = { run_id: null, source_watermark: null, method_version: null, cutoff_at: null, issued_at: null, expires_at: null,
  participation_probability: null, start_probability: null, exp_goals: null, exp_assists: null, exp_pp_points: null, exp_shots: null, exp_hits: null,
  exp_blocks: null, exp_saves: null, exp_goals_against: null, exp_shots_against: null, exp_win_prob: null, exp_shutout_prob: null, exp_fantasy_points: null,
  act_goals: null, act_assists: null, act_pp_points: null, act_shots: null, act_hits: null, act_blocks: null, act_saves: null, act_goals_against: null,
  act_shots_against: null, act_win: null, act_shutout: null, act_fantasy_points: null, dressed: null, started: null, settled_at: null, outcome_source: null };

/** One row per source per identified player-game; games already started (or not scheduled) are refused and listed. */
export function buildLedgerRows(input: BuildLedgerInput): { rows: LedgerRow[]; universe: LedgerUniverseRow[]; skippedGameIds: number[] } {
  const { date, seasonId, now } = input, nowIso = now.toISOString();
  const datesByTeam = new Map<number, string[]>(), gamesByTeam = new Map<number, Row[]>();
  for (const row of [...input.scheduleGames].sort((a, b) => String(a.date).localeCompare(String(b.date)) || Number(a.id) - Number(b.id)))
    for (const team of [row.homeTeamId, row.awayTeamId]) if (finite(team)) {
      datesByTeam.set(team, [...new Set([...(datesByTeam.get(team) ?? []), String(row.date)])]);
      if (String(row.date) < date) gamesByTeam.set(team, [...(gamesByTeam.get(team) ?? []), row]);
    }
  const restDays = (team: number) => {
    const previous = (datesByTeam.get(team) ?? []).filter(day => day < date).at(-1);
    return previous ? Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${previous}T12:00:00Z`)) / 86400000) : null;
  };
  const forecasts = new Map(input.bridgeForecasts.map(row => [`${row.playerId}:${row.gameId}`, row]));
  const native = new Map((input.nativeExpectations ?? []).map(row => [`${row.playerId}:${row.expectation.gameId}`, row.expectation]));
  const skaterRows = new Map<number, Row[]>(), goalieStarts = new Map<number, Row[]>();
  for (const row of input.wgoGameRows) if (finite(row.player_id) && String(row.date) < date) skaterRows.set(row.player_id, [...(skaterRows.get(row.player_id) ?? []), row]);
  for (const row of input.goalieGameRows) if (finite(row.goalie_id) && String(row.date) < date && Number(row.games_started) > 0)
    goalieStarts.set(row.goalie_id, [...(goalieStarts.get(row.goalie_id) ?? []), row]);
  const byDateDesc = (a: Row, b: Row) => String(b.date).localeCompare(String(a.date)) || Number(b.game_id ?? 0) - Number(a.game_id ?? 0);
  const rows: LedgerRow[] = [], universe: LedgerUniverseRow[] = [], skippedGameIds: number[] = [];
  for (const game of [...input.games].sort((a, b) => a.gameId - b.gameId)) {
    if (game.status !== "scheduled" || !game.scheduledAt || !(Date.parse(game.scheduledAt) > now.getTime())) { skippedGameIds.push(game.gameId); continue; }
    const players = input.players.filter(player => player.teamId === game.homeTeamId || player.teamId === game.awayTeamId).sort((a, b) => a.nhlId - b.nhlId);
    for (const player of players) {
      universe.push({ served_date: date, season_id: seasonId, player_id: player.nhlId, game_id: game.gameId,
        player_class: player.playerClass, team_id: player.teamId, dressed: null });
      const isHome = player.teamId === game.homeTeamId, opponent = isHome ? game.awayTeamId : game.homeTeamId;
      const base = { ...EMPTY, served_date: date, season_id: seasonId, player_id: player.nhlId, game_id: game.gameId, player_class: player.playerClass,
        team_id: player.teamId, opponent_team_id: opponent, is_home: isHome, scheduled_at: new Date(game.scheduledAt).toISOString(),
        team_rest_days: restDays(player.teamId), opponent_rest_days: restDays(opponent) };
      const push = (source: LedgerSource, fields: Partial<LedgerRow>, heads: Record<string, Num>) => {
        const exp: Partial<LedgerRow> = {};
        for (const [key, value] of Object.entries(heads)) (exp as Row)[`exp_${key}`] = round(value);
        const row = { ...base, ...fields, ...exp, source } as LedgerRow;
        row.exp_fantasy_points = ledgerFantasyPoints(player.playerClass, expHeads(row));
        rows.push(row);
      };
      const mapping = player.playerClass === "skater" ? SKATER_HEADS : GOALIE_HEADS;
      const forecast = forecasts.get(`${player.planningId}:${game.gameId}`);
      if (forecast) {
        const runId = forecast.revisionId.split(":").at(-1) ?? null;
        push(runId && input.runDates.get(runId) === game.date ? "bridge_exact" : "bridge_reaimed", { run_id: runId, source_watermark: forecast.sourceWatermark ?? forecast.revisionId,
          method_version: forecast.modelVersion, cutoff_at: forecast.cutoffAt ?? null, issued_at: forecast.issuedAt, expires_at: forecast.expiresAt ?? null,
          participation_probability: num(forecast.appearanceProbability), start_probability: num(forecast.startProbability) },
        Object.fromEntries(Object.entries(mapping).map(([head, key]) => [head, num(forecast.stats[key])])));
      }
      const expectation = native.get(`${player.nhlId}:${game.gameId}`);
      if (expectation) {
        const lead = Object.values(expectation.targets).find(target => target.issuedAt) ?? null;
        push("native", { source_watermark: lead?.sourceWatermarks.join(",") || null, method_version: lead?.methodVersions.join(",") || null,
          cutoff_at: lead?.cutoffAt ?? null, issued_at: lead?.issuedAt ?? null, expires_at: lead?.expiresAt ?? null,
          participation_probability: num(expectation.appearanceProbability), start_probability: num(expectation.startProbability) },
        Object.fromEntries(Object.entries(mapping).map(([head, key]) => [head, num(expectation.targets[key]?.expected)])));
      }
      const naive = (source: LedgerSource, history: Row[], latest: string, fields: Partial<LedgerRow>, heads: Record<string, Num>) =>
        push(source, { method_version: NAIVE_METHOD_VERSION, source_watermark: `${player.playerClass === "skater" ? "wgo_skater_stats" : "wgo_goalie_stats"}:${latest}:${history.length}`,
          cutoff_at: nowIso, issued_at: nowIso, expires_at: base.scheduled_at, ...fields }, heads);
      if (player.playerClass === "skater") {
        const history = (skaterRows.get(player.nhlId) ?? []).sort(byDateDesc), season = history.filter(row => Number(row.season_id) === seasonId);
        const means = (sample: Row[]) => Object.fromEntries(Object.entries(WGO_SKATER).map(([head, column]) => [head, mean(sample.map(row => row[column]))]));
        if (history.length) naive("naive_last5", history.slice(0, 5), String(history[0].date), { participation_probability: 1 }, means(history.slice(0, 5)));
        if (season.length) naive("naive_season", season, String(season[0].date), { participation_probability: 1 }, means(season));
      } else {
        const starts = (goalieStarts.get(player.nhlId) ?? []).sort(byDateDesc), teamGames = gamesByTeam.get(player.teamId) ?? [];
        const win = input.teamWin?.get(`${game.gameId}:${player.teamId}`) ?? 0.5;
        const goalie = (source: LedgerSource, sample: Row[], teamSample: Row[]) => {
          const ids = new Set(teamSample.map(row => String(row.id)));
          const share = teamSample.length ? Math.min(1, starts.filter(row => ids.has(String(row.game_id))).length / teamSample.length) : null;
          naive(source, sample, String(sample[0].date), { start_probability: round(share) }, { saves: times(share, mean(sample.map(row => row.saves))),
            goals_against: times(share, mean(sample.map(row => row.goals_against))), shots_against: times(share, mean(sample.map(row => row.shots_against))),
            win_prob: times(share, win), shutout_prob: times(share, mean(sample.map(row => finite(row.shutouts) ? Math.min(1, row.shutouts) : null))) });
        };
        const season = starts.filter(row => Number(row.season_id) === seasonId);
        if (starts.length) goalie("naive_last5", starts.slice(0, 10), teamGames.slice(-10));
        if (season.length) goalie("naive_season", season, teamGames);
      }
    }
  }
  return { rows, universe, skippedGameIds };
}

export type LedgerActuals = {
  skaters: Row[]; goalies: Row[]; skaterSource?: string; goalieSource?: string;
  /** Trusted ingestion receipts, not inferred from row counts or an unrelated player's presence. */
  completeScopes?: Array<{ gameId: number; teamId: number; playerClass: Class; final: boolean; complete: boolean }>;
};
function settlementEvidence(actuals: LedgerActuals) {
  const index = (list: Row[]) => new Map(list.filter(row => finite(Number(row.game_id)) && finite(Number(row.player_id))).map(row => [`${Number(row.game_id)}:${Number(row.player_id)}`, row]));
  const skaters = index(actuals.skaters), goalies = index(actuals.goalies);
  const complete = new Set((actuals.completeScopes ?? []).filter(scope => scope.final === true && scope.complete === true)
    .map(scope => `${scope.gameId}:${scope.teamId}:${scope.playerClass}`));
  return (row: LedgerUniverseRow) => ({
    actual: (row.player_class === "skater" ? skaters : goalies).get(`${row.game_id}:${row.player_id}`),
    absenceProven: complete.has(`${row.game_id}:${row.team_id}:${row.player_class}`),
  });
}

export function settleLedgerUniverse(rows: LedgerUniverseRow[], actuals: LedgerActuals): LedgerUniverseRow[] {
  const evidence = settlementEvidence(actuals);
  return rows.map(row => {
    const { actual, absenceProven } = evidence(row);
    return { ...row, dressed: actual ? true : absenceProven ? false : null };
  });
}

/** Known per-game actuals can settle individually. Absence is DNP only with final, complete team/class evidence.
 * A null stat remains null; a previous settlement unsupported by the current evidence becomes unknown. */
export function settleLedgerRows(rows: LedgerRow[], actuals: LedgerActuals, settledAt: string): LedgerRow[] {
  const evidence = settlementEvidence(actuals);
  const flag = (value: unknown) => finite(value) ? (value > 0 ? 1 : 0) : null;
  return rows.map(row => {
    const skater = row.player_class === "skater", { actual, absenceProven } = evidence(row);
    if (!actual && !absenceProven) {
      const out = { ...row };
      for (const key of Object.keys(EMPTY).filter(key => key.startsWith("act_") || ["dressed", "started", "settled_at", "outcome_source"].includes(key)))
        (out as Row)[key] = null;
      return out;
    }
    const out: LedgerRow = { ...row, settled_at: settledAt, outcome_source: skater ? actuals.skaterSource ?? "wgo_skater_stats" : actuals.goalieSource ?? "goalie_stats_unified", dressed: !!actual };
    if (skater) for (const [head, column] of Object.entries(WGO_SKATER)) (out as Row)[`act_${head}`] = actual ? num(actual[column]) : 0;
    else Object.assign(out, actual ? { act_saves: num(actual.saves), act_goals_against: num(actual.goals_against), act_shots_against: num(actual.shots_against),
      act_win: flag(actual.wins), act_shutout: flag(actual.shutouts), started: finite(actual.games_started) ? actual.games_started > 0 : null }
      : { act_saves: 0, act_goals_against: 0, act_shots_against: 0, act_win: 0, act_shutout: 0, started: false });
    out.act_fantasy_points = ledgerFantasyPoints(row.player_class, actHeads(out));
    return out;
  });
}

export type ErrorStat = { n: number; mae: Num; bias: Num; rmse: Num; expected: Num; actual: Num; ratio: Num; mzSlope: Num; mzIntercept: Num };
export type ReliabilityBin = { bin: number; n: number; predicted: number; observed: number };
export type BinaryScore = { n: number; brier: Num; reliability: ReliabilityBin[] };
export const LEDGER_SCORING_LIMITATIONS = {
  position: "unavailable_skater_position_not_captured",
  opportunityRate: "unavailable_expected_and_actual_toi_pp_toi_not_captured",
  coverage: "unavailable_independent_universe_not_persisted",
  settlement: "known_outcomes_only_missing_players_remain_unknown_without_complete_scope",
  qualification: "descriptive_scores_not_predictive_qualification",
} as const;
type HeadScores = { heads: Record<string, ErrorStat>; fantasyPoints: ErrorStat };
type ExpectedFpBin = HeadScores & { decile: number; n: number; minExpectedFp: number; maxExpectedFp: number };
export type LedgerScore = { source: LedgerSource; player_class: Class; n: number; dressed: Num; covered: number; coverage: Num;
  coverageStatus: "known" | "unavailable" | "incomplete"; phantoms: number;
  heads: Record<string, ErrorStat>; fantasyPoints: ErrorStat; decile10: { n: number; expected: number; actual: number; ratio: Num } | null;
  scoringPopulation: "dressed_only"; position: "G" | "unknown"; expectedFpDeciles: ExpectedFpBin[];
  binary: Partial<Record<"win" | "shutout" | "start", BinaryScore>>;
  reliability: Partial<Record<"win" | "shutout" | "start", ReliabilityBin[]>>; b2b: HeadScores };
const SCORED_HEADS: Record<Class, string[]> = { skater: ["goals", "assists", "pp_points", "shots", "hits", "blocks"], goalie: ["saves", "goals_against", "shots_against"] };

function errorStat(pairs: Array<[Num, Num]>): ErrorStat {
  const known = pairs.filter((pair): pair is [number, number] => finite(pair[0]) && finite(pair[1]));
  if (!known.length) return { n: 0, mae: null, bias: null, rmse: null, expected: null, actual: null, ratio: null, mzSlope: null, mzIntercept: null };
  const n = known.length, expected = known.reduce((s, [e]) => s + e, 0), actual = known.reduce((s, [, a]) => s + a, 0);
  const variance = known.reduce((s, [e]) => s + (e - expected / n) ** 2, 0);
  // Mincer–Zarnowitz: actual = intercept + slope * forecast, with an intercept.
  const slope = n > 1 && variance > 0 ? known.reduce((s, [e, a]) => s + (e - expected / n) * (a - actual / n), 0) / variance : null;
  return { n, mae: round(known.reduce((s, [e, a]) => s + Math.abs(e - a), 0) / n), bias: round((expected - actual) / n),
    rmse: round(Math.sqrt(known.reduce((s, [e, a]) => s + (e - a) ** 2, 0) / n)), expected: round(expected), actual: round(actual),
    ratio: expected !== 0 ? round(actual / expected) : null, mzSlope: round(slope), mzIntercept: slope === null ? null : round(actual / n - slope * expected / n) };
}
const probability = (value: unknown): value is number => finite(value) && value >= 0 && value <= 1;
const binaryOutcome = (value: unknown): Num => typeof value === "boolean" ? Number(value) : value === 0 || value === 1 ? value : null;
function binaryScore(pairs: Array<[Num, Num | boolean | null]>): BinaryScore {
  const known = pairs.map(([p, o]) => [p, binaryOutcome(o)] as [Num, Num])
    .filter((pair): pair is [number, number] => probability(pair[0]) && pair[1] !== null);
  if (!known.length) return { n: 0, brier: null, reliability: [] };
  const bins = new Map<number, number[][]>();
  for (const [p, o] of known) {
    const bin = Math.min(9, Math.floor(p * 10)), list = bins.get(bin) ?? [];
    list.push([p, o]); bins.set(bin, list);
  }
  return { n: known.length, brier: round(known.reduce((s, [p, o]) => s + (p - o) ** 2, 0) / known.length),
    reliability: [...bins].sort((a, b) => a[0] - b[0]).map(([bin, list]) => ({ bin, n: list.length,
      predicted: round(list.reduce((s, x) => s + x[0], 0) / list.length)!, observed: round(list.reduce((s, x) => s + x[1], 0) / list.length)! })) };
}

const ledgerKey = (row: LedgerRow) => `${row.season_id}:${row.served_date}:${row.player_class}:${row.player_id}:${row.game_id}`;
function scoringRows(rows: LedgerRow[]) {
  let invalidIdentityRows = 0;
  const grouped = new Map<string, LedgerRow[]>();
  for (const row of rows) {
    if (!Number.isInteger(row.season_id) || !Number.isInteger(row.player_id) || row.player_id <= 0 || !Number.isInteger(row.game_id) || row.game_id <= 0
      || !/^\d{4}-\d{2}-\d{2}$/.test(row.served_date) || !["skater", "goalie"].includes(row.player_class) || !LEDGER_SOURCES.includes(row.source)) {
      invalidIdentityRows++; continue;
    }
    const key = `${row.source}:${ledgerKey(row)}`, list = grouped.get(key) ?? [];
    list.push(row); grouped.set(key, list);
  }
  return { invalidIdentityRows,
    unique: [...grouped.values()].filter(list => list.length === 1).map(list => list[0]).filter(row => !!row.settled_at),
    duplicates: [...grouped.values()].filter(list => list.length > 1).map(list => list[0]) };
}
const fantasyPair = (row: LedgerRow, weights?: FantasyWeights): [Num, Num] => weights
  ? [ledgerFantasyPoints(row.player_class, expHeads(row), weights), ledgerFantasyPoints(row.player_class, actHeads(row), weights)]
  : [row.exp_fantasy_points, row.act_fantasy_points];
/** Ascending expected FP rank; tied predictions stay together, independent of outcome/input order.
 * Small or tied cohorts can leave deciles empty. No actuals are used to assign bins. */
function fpBins<T>(list: T[], expected: (value: T) => Num): Array<{ decile: number; list: T[]; minExpectedFp: number; maxExpectedFp: number }> {
  const ranked = list.filter(row => finite(expected(row))).sort((a, b) => expected(a)! - expected(b)!);
  const bins = new Map<number, { decile: number; list: T[]; minExpectedFp: number; maxExpectedFp: number }>();
  for (let i = 0; i < ranked.length;) {
    let end = i + 1;
    while (end < ranked.length && expected(ranked[end]) === expected(ranked[i])) end++;
    const decile = Math.min(10, Math.floor(((i + end) / 2) / ranked.length * 10) + 1), value = expected(ranked[i])!;
    const bin = bins.get(decile) ?? { decile, list: [], minExpectedFp: value, maxExpectedFp: value };
    for (let j = i; j < end; j++) bin.list.push(ranked[j]);
    bin.maxExpectedFp = value; bins.set(decile, bin); i = end;
  }
  return [...bins.values()];
}

/** Per-source errors use each source's own observed sample, not a paired model comparison.
 * Coverage requires an independently captured and settled universe; forecast rows cannot supply it. */
export function scoreLedger(rows: LedgerRow[], weights?: FantasyWeights, universe?: LedgerUniverseRow[]): LedgerScore[] {
  const settled = scoringRows(rows).unique;
  const fp = (row: LedgerRow) => fantasyPair(row, weights);
  const errors = (list: LedgerRow[], playerClass: Class) => ({
    heads: Object.fromEntries(SCORED_HEADS[playerClass].map(head => [head, errorStat(list.map(row => [(row as Row)[`exp_${head}`], (row as Row)[`act_${head}`]]))])),
    fantasyPoints: errorStat(list.map(fp)) });
  const out: LedgerScore[] = [];
  for (const playerClass of ["skater", "goalie"] as const) {
    const classRows = settled.filter(row => row.player_class === playerClass);
    const key = (row: LedgerUniverseRow) => `${row.served_date}:${row.player_id}:${row.game_id}`;
    const members = universe?.filter(row => row.player_class === playerClass);
    const coverageStatus = members === undefined ? "unavailable" : members.some(row => row.dressed === null) ? "incomplete" : "known";
    const dressedKeys = new Set(members?.filter(row => row.dressed === true).map(key));
    const dressed = coverageStatus === "known" ? dressedKeys.size : null;
    for (const source of LEDGER_SOURCES) {
      const list = classRows.filter(row => row.source === source);
      if (!list.length) continue;
      const covered = new Set(list.filter(row => row.dressed && (members === undefined || dressedKeys.has(key(row)))).map(key)).size;
      const dressedRows = list.filter(row => row.dressed === true);
      const expectedFpDeciles = fpBins(dressedRows, row => fp(row)[0]).map(({ list: binRows, ...bin }) => ({ ...bin, n: binRows.length, ...errors(binRows, playerClass) }));
      const top = expectedFpDeciles.find(bin => bin.decile === 10)?.fantasyPoints;
      const binary = playerClass === "goalie" ? { win: binaryScore(list.map(row => [row.exp_win_prob, row.act_win])),
        shutout: binaryScore(list.map(row => [row.exp_shutout_prob, row.act_shutout])), start: binaryScore(list.map(row => [row.start_probability, row.started])) } : {};
      out.push({ source, player_class: playerClass, n: list.length, dressed, covered, coverageStatus, coverage: dressed ? round(covered / dressed) : null,
        phantoms: list.filter(row => row.dressed === false).length, ...errors(dressedRows, playerClass),
        scoringPopulation: "dressed_only", position: playerClass === "goalie" ? "G" : "unknown", expectedFpDeciles,
        decile10: top?.n ? { n: top.n, expected: top.expected!, actual: top.actual!, ratio: top.ratio } : null,
        binary, reliability: Object.fromEntries(Object.entries(binary).filter(([, value]) => value.n).map(([event, value]) => [event, value.reliability])),
        b2b: errors(dressedRows.filter(row => row.team_rest_days === 1), playerClass) });
    }
  }
  return out;
}

type LedgerPair = [LedgerRow, LedgerRow];
type PairExclusions = { missingPrediction: number; missingOutcome: number; conflictingOutcome: number };
export type PairedErrorStat = {
  source: ErrorStat; reference: ErrorStat; rmseSkill: Num;
  status: "scored" | "no_valid_pairs"; exclusions: PairExclusions;
};
type PairedHeads = { heads: Record<string, PairedErrorStat>; fantasyPoints: PairedErrorStat };
type PairedBinaryScore = { source: BinaryScore; reference: BinaryScore; exclusions: PairExclusions };
export type PairedLedgerScore = PairedHeads & {
  source: LedgerSource; reference: LedgerSource; player_class: Class; position: "G" | "unknown";
  status: "paired" | "no_shared_player_games"; scoringPopulation: "dressed_only"; binaryPopulation: "settled_known_event";
  pairing: { sourceRows: number; referenceRows: number; matched: number; sourceOnly: number; referenceOnly: number;
    duplicateSourceKeys: number; duplicateReferenceKeys: number; conflictingParticipation: number; dressed: number };
  expectedFpDeciles: Array<PairedHeads & { decile: number; n: number; minExpectedFp: number; maxExpectedFp: number }>;
  binary: Partial<Record<"start" | "win" | "shutout", PairedBinaryScore>>;
};

function comparableValues(pairs: LedgerPair[], values: (row: LedgerRow) => [Num, Num], binary = false) {
  const known: Array<[number, number, number]> = [];
  const exclusions: PairExclusions = { missingPrediction: 0, missingOutcome: 0, conflictingOutcome: 0 };
  for (const [source, reference] of pairs) {
    const [p, a] = values(source), [q, b] = values(reference);
    if (!(binary ? probability(p) && probability(q) : finite(p) && finite(q))) { exclusions.missingPrediction++; continue; }
    if (!finite(a) || !finite(b) || (binary && (binaryOutcome(a) === null || binaryOutcome(b) === null))) { exclusions.missingOutcome++; continue; }
    if (a !== b) { exclusions.conflictingOutcome++; continue; }
    known.push([p!, q!, a]);
  }
  return { known, exclusions };
}

function pairedError(pairs: LedgerPair[], values: (row: LedgerRow) => [Num, Num]): PairedErrorStat {
  const { known, exclusions } = comparableValues(pairs, values);
  const source = errorStat(known.map(([p, , a]) => [p, a])), reference = errorStat(known.map(([, q, a]) => [q, a]));
  // Compute skill from unrounded SSEs on exactly the same head-specific cohort.
  const sourceSse = known.reduce((s, [p, , a]) => s + (p - a) ** 2, 0), referenceSse = known.reduce((s, [, q, a]) => s + (q - a) ** 2, 0);
  return { source, reference, rmseSkill: referenceSse > 0 ? round(1 - Math.sqrt(sourceSse / referenceSse)) : null,
    status: known.length ? "scored" : "no_valid_pairs", exclusions };
}

/** Pairwise comparisons, never intersections of unrelated source-level averages. Each head requires
 * both forecasts and equal known outcomes on the same served date, season, player and game.
 * Duplicate source keys are ambiguous and excluded, even when input order would pick a winner.
 * Historical F/D and opportunity/rate decompositions are unavailable in the persisted contract. */
export function scorePairedLedger(rows: LedgerRow[], weights?: FantasyWeights): {
  pairingKey: string[]; biasDefinition: string; rmseSkillDefinition: string; binning: string; limitations: typeof LEDGER_SCORING_LIMITATIONS;
  invalidIdentityRows: number; comparisons: PairedLedgerScore[];
} {
  const { unique, duplicates, invalidIdentityRows } = scoringRows(rows);
  const comparisons: PairedLedgerScore[] = [];
  for (const playerClass of ["skater", "goalie"] as const) {
    const index = new Map(LEDGER_SOURCES.map(source => [source, new Map(unique.filter(row => row.source === source && row.player_class === playerClass).map(row => [ledgerKey(row), row]))]));
    for (let i = 0; i < LEDGER_SOURCES.length; i++) for (const reference of LEDGER_SOURCES.slice(i + 1)) {
      const source = LEDGER_SOURCES[i], sourceRows = index.get(source)!, referenceRows = index.get(reference)!;
      const duplicateSourceKeys = duplicates.filter(row => row.source === source && row.player_class === playerClass).length;
      const duplicateReferenceKeys = duplicates.filter(row => row.source === reference && row.player_class === playerClass).length;
      if (!sourceRows.size && !referenceRows.size && !duplicateSourceKeys && !duplicateReferenceKeys) continue;
      const matches: LedgerPair[] = [...sourceRows].flatMap(([key, row]) => referenceRows.has(key) ? [[row, referenceRows.get(key)!] as LedgerPair] : []);
      const consistent = matches.filter(([a, b]) => a.dressed === b.dressed);
      const dressed = consistent.filter(([a, b]) => a.dressed === true && b.dressed === true);
      const summarize = (list: LedgerPair[]): PairedHeads => ({
        heads: Object.fromEntries(SCORED_HEADS[playerClass].map(head => [head, pairedError(list, row => [(row as Row)[`exp_${head}`], (row as Row)[`act_${head}`]])])),
        fantasyPoints: pairedError(list, row => fantasyPair(row, weights)),
      });
      const binary: PairedLedgerScore["binary"] = {};
      if (playerClass === "goalie") for (const event of ["start", "win", "shutout"] as const) {
        const { known, exclusions } = comparableValues(consistent, row => event === "start"
          ? [row.start_probability, binaryOutcome(row.started)] : [row[`exp_${event}_prob`], row[`act_${event}`]], true);
        binary[event] = { source: binaryScore(known.map(([p, , a]) => [p, a])), reference: binaryScore(known.map(([, q, a]) => [q, a])), exclusions };
      }
      comparisons.push({ source, reference, player_class: playerClass, position: playerClass === "goalie" ? "G" : "unknown",
        status: matches.length ? "paired" : "no_shared_player_games", scoringPopulation: "dressed_only", binaryPopulation: "settled_known_event",
        pairing: { sourceRows: sourceRows.size, referenceRows: referenceRows.size, matched: matches.length,
          sourceOnly: sourceRows.size - matches.length, referenceOnly: referenceRows.size - matches.length,
          duplicateSourceKeys, duplicateReferenceKeys, conflictingParticipation: matches.length - consistent.length, dressed: dressed.length },
        ...summarize(dressed), expectedFpDeciles: fpBins(dressed, ([row]) => fantasyPair(row, weights)[0])
          .map(({ list, ...bin }) => ({ ...bin, n: list.length, ...summarize(list) })), binary });
    }
  }
  return { pairingKey: ["season_id", "served_date", "player_class", "player_id", "game_id"],
    biasDefinition: "mean(forecast - actual)",
    rmseSkillDefinition: "1 - RMSE(source) / RMSE(reference); null when reference RMSE is zero or no pairs",
    binning: "ascending source expected FP, tied values share midpoint-rank decile; head-specific missing pairs remain excluded",
    limitations: LEDGER_SCORING_LIMITATIONS, invalidIdentityRows, comparisons };
}
