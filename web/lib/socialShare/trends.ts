import type { Database } from "lib/supabase/database-generated.types";
import { localDate } from "lib/rosterScheduleOptimizer/planningDates";
import { PICKUP_YAHOO_TEAM_ALIASES, type PickupOwnershipRow } from "./pickupsFixture";
import { PLAYER_STATS_MAX_AGE_MS } from "./players";
import { SHARE_TIME_ZONE, type ShareDataState, type ShareOwnershipMover, type ShareTeam, type ShareTrendLayer, type ShareTrendPlayer, type SocialShareSnapshot } from "./types";

type Tables = Database["public"]["Tables"];
/** Read-only source shapes (rolling_player_game_metrics rows are one per player per game). */
export type ShareRollingRow = Pick<Tables["rolling_player_game_metrics"]["Row"],
  "player_id" | "team_id" | "season" | "game_date" | "strength_state" | "updated_at" | "season_games_played" |
  "points_avg_last5" | "points_avg_season" | "toi_seconds_avg_last5" | "toi_seconds_avg_season" | "toi_seconds_total_last5" |
  "pp_share_pct_last5" | "pp_share_pct_season" | "sog_per_60_last5" | "sog_per_60_season" |
  "shot_attempts_per_60_last5" | "shot_attempts_per_60_season" | "ixg_per_60_last5" | "ixg_per_60_season" |
  "line_combo_slot" | "line_combo_group" | "pp_unit">;
export type SharePlayerNameRow = Pick<Tables["players"]["Row"], "id" | "fullName" | "position">;
export type ShareTrendSources = { rolling: ShareRollingRow[]; players: SharePlayerNameRow[]; ownership: PickupOwnershipRow[] };

/** Trend windows: last five games played vs season to date; movers over five days. */
export const TREND_WINDOW_GAMES = 5;
export const MOVER_WINDOW_DAYS = 5;
/** A trend needs a real season baseline. */
export const MIN_TREND_SEASON_GAMES = 10;
/** Last-5 per-60 rates need at least 50 minutes of ice time behind them. */
export const MIN_RATE_TOI_SECONDS_LAST5 = 3000;
/** A player whose latest game is older than this is not on a current trend (injury, scratch). */
export const TREND_MAX_GAME_AGE_DAYS = 7;
export const TREND_LIST = 5;
export const DEPLOYMENT_LIST = 4;
export const RATE_LIST = 3;

const shiftDate = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const isDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const pct = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
const pair = (last5: number | null, season: number | null) => ({ last5: Number.isFinite(last5) ? last5 : null, season: Number.isFinite(season) ? season : null });
const staleMajority = (stale: number, kept: number, what: string) => `Most ${what} are stale (${stale} of ${stale + kept}).`;

function buildMovers(rows: PickupOwnershipRow[], yahooSeason: number, today: string) {
  const yesterday = shiftDate(today, -1), target = shiftDate(today, -MOVER_WINDOW_DAYS);
  const movers: ShareOwnershipMover[] = [];
  let stale = 0, future = 0, asOf: string | null = null;
  for (const row of rows) {
    if (row.season !== yahooSeason || !Array.isArray(row.ownership_timeline)) continue;
    const timeline = (row.ownership_timeline as { date?: unknown; value?: unknown }[])
      .filter((point): point is { date: string; value: number } => isDate(point?.date) && pct(point?.value) !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    const latest = timeline[timeline.length - 1];
    if (!latest) continue;
    if (latest.date > today) { future++; continue; }
    if (latest.date < yesterday) { stale++; continue; }
    // Same rule as pages/api/v1/transactions/ownership-trends.ts: the point on the target date,
    // else the latest earlier point at or before it.
    const previous = timeline.find(point => point.date === target) ?? [...timeline.slice(0, -1)].reverse().find(point => point.date <= target);
    if (!previous) continue;
    const team = row.editorial_team_abbreviation ? PICKUP_YAHOO_TEAM_ALIASES[row.editorial_team_abbreviation] ?? row.editorial_team_abbreviation : null;
    if (!row.player_name) continue;
    // Keyed by public name and team: no Yahoo identifiers leave the layer.
    movers.push({ key: `${row.player_name}|${team ?? ""}`, name: row.player_name, team, positions: row.display_position ?? "", latest: latest.value, previous: previous.value,
      delta: Number((latest.value - previous.value).toFixed(2)), latestDate: latest.date, previousDate: previous.date });
    if (!asOf || latest.date < asOf) asOf = latest.date;
  }
  let state: ShareDataState = "ready";
  const reasons: string[] = [];
  if (stale > movers.length) { state = "stale"; reasons.push(staleMajority(stale, movers.length, "ownership rows")); }
  else if (!movers.length) { state = future ? "missing" : "partial"; reasons.push(future ? "Ownership time is in the future." : `No player has ownership points ${MOVER_WINDOW_DAYS} days apart.`); }
  return { movers, state, reasons, asOf };
}

/**
 * Latest rolling row per skater (strength "all") with the row five games earlier for line and
 * PP-unit context. Freshness is gated per player (F1): rows updated over 72 h ago are stale,
 * and a majority of stale rows makes the layer stale.
 */
export function buildTrendLayer(sources: ShareTrendSources | null, input: { season: number; teams: ShareTeam[]; fetchedAt: string; generatedAt: string }): ShareTrendLayer {
  const base = { name: "FHFH rolling game metrics + Yahoo ownership" as const, season: input.season, fetchedAt: input.fetchedAt, moverWindowDays: MOVER_WINDOW_DAYS };
  if (!sources) {
    const reasons = ["Rolling game metrics and ownership are not connected."];
    return { ...base, metricsThrough: null, metricsUpdatedAt: null, ownershipAsOf: null, state: "missing", reasons, moversState: "missing", moversReasons: reasons, players: [], movers: [] };
  }
  const today = localDate(input.generatedAt, SHARE_TIME_ZONE), generated = Date.parse(input.generatedAt), oldestGame = shiftDate(today, -TREND_MAX_GAME_AGE_DAYS);
  const names = new Map(sources.players.map(row => [row.id, row]));
  const teams = new Map(input.teams.map(team => [team.id, team.abbreviation]));
  const byPlayer = new Map<number, ShareRollingRow[]>();
  for (const row of sources.rolling) {
    if (row.season !== input.season || row.strength_state !== "all" || !isDate(row.game_date)) continue;
    byPlayer.set(row.player_id, [...(byPlayer.get(row.player_id) ?? []), row]);
  }
  const players: ShareTrendPlayer[] = [];
  let stale = 0, future = 0, inactive = 0, through: string | null = null, updatedAt: string | null = null;
  for (const [playerId, rows] of byPlayer) {
    rows.sort((a, b) => a.game_date.localeCompare(b.game_date));
    const latest = rows[rows.length - 1], before = rows.length > TREND_WINDOW_GAMES ? rows[rows.length - 1 - TREND_WINDOW_GAMES] : null;
    const who = names.get(playerId), team = latest.team_id === null ? undefined : teams.get(latest.team_id);
    if (!who || who.position === "G" || !team || (latest.season_games_played ?? 0) < MIN_TREND_SEASON_GAMES) continue;
    const updated = Date.parse(latest.updated_at);
    if (latest.game_date > today || updated > generated) { future++; continue; }
    if (!Number.isFinite(updated) || generated - updated > PLAYER_STATS_MAX_AGE_MS) { stale++; continue; }
    if (latest.game_date < oldestGame) { inactive++; continue; }
    players.push({
      nhlId: playerId, name: who.fullName, team, position: who.position, lastGame: latest.game_date, seasonGames: latest.season_games_played!,
      pointsPerGame: pair(latest.points_avg_last5, latest.points_avg_season), toiSeconds: pair(latest.toi_seconds_avg_last5, latest.toi_seconds_avg_season),
      ppSharePct: pair(latest.pp_share_pct_last5, latest.pp_share_pct_season), sogPer60: pair(latest.sog_per_60_last5, latest.sog_per_60_season),
      icfPer60: pair(latest.shot_attempts_per_60_last5, latest.shot_attempts_per_60_season), ixgPer60: pair(latest.ixg_per_60_last5, latest.ixg_per_60_season),
      toiSecondsLast5: latest.toi_seconds_total_last5, line: { now: latest.line_combo_slot, before: before?.line_combo_slot ?? null, group: latest.line_combo_group },
      ppUnit: { now: latest.pp_unit, before: before?.pp_unit ?? null },
    });
    if (!through || latest.game_date < through) through = latest.game_date;
    const iso = new Date(updated).toISOString();
    if (!updatedAt || iso < updatedAt) updatedAt = iso;
  }
  let state: ShareDataState = "ready";
  const reasons: string[] = [];
  if (stale > players.length) { state = "stale"; reasons.push(staleMajority(stale, players.length, "rolling metric rows")); }
  else if (!players.length) { state = future ? "missing" : "partial"; reasons.push(future ? "Rolling metric time is in the future." : "No skater has a current rolling row."); }
  else if (stale || future || inactive) reasons.push(`Excluded ${stale} stale, ${future} future-dated and ${inactive} inactive skaters.`);
  const movers = buildMovers(sources.ownership, Math.floor(input.season / 10000), today);
  return { ...base, metricsThrough: through, metricsUpdatedAt: updatedAt, ownershipAsOf: movers.asOf, state, reasons, moversState: movers.state, moversReasons: movers.reasons,
    players: players.sort((a, b) => a.nhlId - b.nhlId), movers: movers.movers.sort((a, b) => a.key.localeCompare(b.key)) };
}

export const trendsReady = (snapshot: SocialShareSnapshot) => snapshot.trends?.state === "ready";
export const moversReady = (snapshot: SocialShareSnapshot) => snapshot.trends?.moversState === "ready";

export type TrendPick = ShareTrendPlayer & { delta: number; last5: number; season: number; weekGames: number | null };
type Metric = "pointsPerGame" | "toiSeconds" | "sogPer60" | "icfPer60" | "ixgPer60";
function picks(snapshot: SocialShareSnapshot, metric: Metric, filter: (player: ShareTrendPlayer) => boolean = () => true): TrendPick[] {
  const games = new Map(snapshot.rows.map(row => [row.team.abbreviation, row.remainingGames]));
  return (snapshot.trends?.players ?? []).filter(filter).flatMap(player => {
    const { last5, season } = player[metric];
    return last5 === null || season === null ? [] : [{ ...player, last5, season, delta: last5 - season, weekGames: games.get(player.team) ?? null }];
  });
}
const byDelta = (direction: 1 | -1) => (a: TrendPick, b: TrendPick) => direction * (b.delta - a.delta) || b.season - a.season || a.name.localeCompare(b.name) || a.nhlId - b.nhlId;

/** Hot and cold: points per game over the last 5 games vs season to date, largest gaps first. */
export function hotCold(snapshot: SocialShareSnapshot, trusted: boolean) {
  if (!trusted || !trendsReady(snapshot)) return { hot: [], cold: [] };
  const all = picks(snapshot, "pointsPerGame");
  return { hot: all.filter(pick => pick.delta > 0).sort(byDelta(1)).slice(0, TREND_LIST), cold: all.filter(pick => pick.delta < 0).sort(byDelta(-1)).slice(0, TREND_LIST) };
}

/** Deployment: TOI per game over the last 5 games vs season, with line and PP unit vs five games earlier. */
export function deploymentChanges(snapshot: SocialShareSnapshot, trusted: boolean) {
  if (!trusted || !trendsReady(snapshot)) return { up: [], down: [] };
  const all = picks(snapshot, "toiSeconds");
  return { up: all.filter(pick => pick.delta > 0).sort(byDelta(1)).slice(0, DEPLOYMENT_LIST), down: all.filter(pick => pick.delta < 0).sort(byDelta(-1)).slice(0, DEPLOYMENT_LIST) };
}

export type RateMetric = "sogPer60" | "icfPer60" | "ixgPer60";
/** Rate standouts: biggest last-5 over season gains in SOG/60, iCF/60 and ixG/60 with 50+ L5 minutes. */
export function rateStandouts(snapshot: SocialShareSnapshot, trusted: boolean): Record<RateMetric, TrendPick[]> {
  if (!trusted || !trendsReady(snapshot)) return { sogPer60: [], icfPer60: [], ixgPer60: [] };
  const sampled = (player: ShareTrendPlayer) => (player.toiSecondsLast5 ?? 0) >= MIN_RATE_TOI_SECONDS_LAST5;
  return Object.fromEntries((["sogPer60", "icfPer60", "ixgPer60"] as const).map(metric =>
    [metric, picks(snapshot, metric, sampled).filter(pick => pick.delta > 0).sort(byDelta(1)).slice(0, RATE_LIST)])) as Record<RateMetric, TrendPick[]>;
}

/** Ownership movers: largest five-day rostered-% gains and drops. */
export function ownershipMovers(snapshot: SocialShareSnapshot, trusted: boolean) {
  if (!trusted || !moversReady(snapshot)) return { risers: [], fallers: [] };
  const all = snapshot.trends!.movers, order = (direction: 1 | -1) => (a: ShareOwnershipMover, b: ShareOwnershipMover) => direction * (b.delta - a.delta) || b.latest - a.latest || a.name.localeCompare(b.name);
  return { risers: all.filter(mover => mover.delta > 0).sort(order(1)).slice(0, TREND_LIST), fallers: all.filter(mover => mover.delta < 0).sort(order(-1)).slice(0, TREND_LIST) };
}
