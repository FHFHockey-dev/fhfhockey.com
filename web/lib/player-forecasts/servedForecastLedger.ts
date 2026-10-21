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
export function buildLedgerRows(input: BuildLedgerInput): { rows: LedgerRow[]; skippedGameIds: number[] } {
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
  const rows: LedgerRow[] = [], skippedGameIds: number[] = [];
  for (const game of [...input.games].sort((a, b) => a.gameId - b.gameId)) {
    if (game.status !== "scheduled" || !game.scheduledAt || !(Date.parse(game.scheduledAt) > now.getTime())) { skippedGameIds.push(game.gameId); continue; }
    const players = input.players.filter(player => player.teamId === game.homeTeamId || player.teamId === game.awayTeamId).sort((a, b) => a.nhlId - b.nhlId);
    for (const player of players) {
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
  return { rows, skippedGameIds };
}

export type LedgerActuals = { skaters: Row[]; goalies: Row[]; skaterSource?: string; goalieSource?: string };
/** Fills settlement columns from per-game rows keyed (game_id, player_id) — never player_id alone. A game with no
 * actual rows of the player's class stays unsettled; a player missing from a settled game did not dress (zero output).
 * A null stat in an actual row stays null. */
export function settleLedgerRows(rows: LedgerRow[], actuals: LedgerActuals, settledAt: string): LedgerRow[] {
  const index = (list: Row[]) => new Map(list.filter(row => finite(Number(row.game_id)) && finite(Number(row.player_id))).map(row => [`${Number(row.game_id)}:${Number(row.player_id)}`, row]));
  const skaters = index(actuals.skaters), goalies = index(actuals.goalies);
  const skaterGames = new Set([...skaters.keys()].map(key => key.split(":")[0])), goalieGames = new Set([...goalies.keys()].map(key => key.split(":")[0]));
  const flag = (value: unknown) => finite(value) ? (value > 0 ? 1 : 0) : null;
  return rows.map(row => {
    const skater = row.player_class === "skater", games = skater ? skaterGames : goalieGames;
    if (!games.has(String(row.game_id))) return row;
    const actual = (skater ? skaters : goalies).get(`${row.game_id}:${row.player_id}`);
    const out: LedgerRow = { ...row, settled_at: settledAt, outcome_source: skater ? actuals.skaterSource ?? "wgo_skater_stats" : actuals.goalieSource ?? "goalie_stats_unified", dressed: !!actual };
    if (skater) for (const [head, column] of Object.entries(WGO_SKATER)) (out as Row)[`act_${head}`] = actual ? num(actual[column]) : 0;
    else Object.assign(out, actual ? { act_saves: num(actual.saves), act_goals_against: num(actual.goals_against), act_shots_against: num(actual.shots_against),
      act_win: flag(actual.wins), act_shutout: flag(actual.shutouts), started: finite(actual.games_started) ? actual.games_started > 0 : null }
      : { act_saves: 0, act_goals_against: 0, act_shots_against: 0, act_win: 0, act_shutout: 0, started: false });
    out.act_fantasy_points = ledgerFantasyPoints(row.player_class, actHeads(out));
    return out;
  });
}

export type ErrorStat = { n: number; mae: Num; bias: Num };
export type ReliabilityBin = { bin: number; n: number; predicted: number; observed: number };
export type LedgerScore = { source: LedgerSource; player_class: Class; n: number; dressed: number; covered: number; coverage: Num; phantoms: number;
  heads: Record<string, ErrorStat>; fantasyPoints: ErrorStat; decile10: { n: number; expected: number; actual: number; ratio: Num } | null;
  reliability: Partial<Record<"win" | "shutout" | "start", ReliabilityBin[]>>; b2b: { heads: Record<string, ErrorStat>; fantasyPoints: ErrorStat } };
const SCORED_HEADS: Record<Class, string[]> = { skater: ["goals", "assists", "pp_points", "shots", "hits", "blocks"], goalie: ["saves", "goals_against", "shots_against"] };

function errorStat(pairs: Array<[Num, Num]>): ErrorStat {
  const known = pairs.filter((pair): pair is [number, number] => finite(pair[0]) && finite(pair[1]));
  if (!known.length) return { n: 0, mae: null, bias: null };
  return { n: known.length, mae: round(known.reduce((sum, [e, a]) => sum + Math.abs(e - a), 0) / known.length), bias: round(known.reduce((sum, [e, a]) => sum + e - a, 0) / known.length) };
}
function reliability(pairs: Array<[Num, Num | boolean | null]>): ReliabilityBin[] | undefined {
  const known = pairs.map(([p, o]) => [p, typeof o === "boolean" ? Number(o) : o] as [Num, Num]).filter((pair): pair is [number, number] => finite(pair[0]) && finite(pair[1]));
  if (!known.length) return undefined;
  const bins = new Map<number, number[][]>();
  for (const [p, o] of known) { const bin = Math.min(9, Math.max(0, Math.floor(p * 10))); bins.set(bin, [...(bins.get(bin) ?? []), [p, o]]); }
  return [...bins].sort((a, b) => a[0] - b[0]).map(([bin, list]) => ({ bin, n: list.length,
    predicted: round(list.reduce((s, x) => s + x[0], 0) / list.length)!, observed: round(list.reduce((s, x) => s + x[1], 0) / list.length)! }));
}

/** Per source × player class over settled rows. With `weights`, fantasy points are recomputed from the heads. */
export function scoreLedger(rows: LedgerRow[], weights?: FantasyWeights): LedgerScore[] {
  const settled = rows.filter(row => row.settled_at !== null);
  const fp = (row: LedgerRow): [Num, Num] => weights ? [ledgerFantasyPoints(row.player_class, expHeads(row), weights), ledgerFantasyPoints(row.player_class, actHeads(row), weights)]
    : [row.exp_fantasy_points, row.act_fantasy_points];
  const errors = (list: LedgerRow[], playerClass: Class) => ({
    heads: Object.fromEntries(SCORED_HEADS[playerClass].map(head => [head, errorStat(list.map(row => [(row as Row)[`exp_${head}`], (row as Row)[`act_${head}`]]))])),
    fantasyPoints: errorStat(list.map(fp)) });
  const out: LedgerScore[] = [];
  for (const playerClass of ["skater", "goalie"] as const) {
    const classRows = settled.filter(row => row.player_class === playerClass);
    const dressed = new Set(classRows.filter(row => row.dressed).map(row => `${row.player_id}:${row.game_id}`)).size;
    for (const source of LEDGER_SOURCES) {
      const list = classRows.filter(row => row.source === source);
      if (!list.length) continue;
      const covered = new Set(list.filter(row => row.dressed).map(row => `${row.player_id}:${row.game_id}`)).size;
      const ranked = list.filter(row => finite(row.exp_goals) && finite(row.act_goals)).sort((a, b) => b.exp_goals! - a.exp_goals! || a.player_id - b.player_id || a.game_id - b.game_id);
      const top = ranked.slice(0, Math.ceil(ranked.length / 10)), expected = top.reduce((s, row) => s + row.exp_goals!, 0), actual = top.reduce((s, row) => s + row.act_goals!, 0);
      const bins = { win: reliability(list.map(row => [row.exp_win_prob, row.act_win])), shutout: reliability(list.map(row => [row.exp_shutout_prob, row.act_shutout])),
        start: playerClass === "goalie" ? reliability(list.map(row => [row.start_probability, row.started])) : undefined };
      out.push({ source, player_class: playerClass, n: list.length, dressed, covered, coverage: dressed ? round(covered / dressed) : null,
        phantoms: list.filter(row => row.dressed === false).length, ...errors(list, playerClass),
        decile10: top.length ? { n: top.length, expected: round(expected)!, actual: round(actual)!, ratio: expected > 0 ? round(actual / expected) : null } : null,
        reliability: Object.fromEntries(Object.entries(bins).filter(([, value]) => value)), b2b: errors(list.filter(row => row.team_rest_days === 1), playerClass) });
    }
  }
  return out;
}
