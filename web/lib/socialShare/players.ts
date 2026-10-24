import type { Database } from "lib/supabase/database-generated.types";
import { localDate } from "lib/rosterScheduleOptimizer/planningDates";
import { normalizeEvDeploymentBucket, normalizePpDeploymentBucket } from "lib/rankings/skaterDeploymentAggregation";
import { byScore, opportunityMultiplier, playerScore } from "./score";
import { PICKUP_YAHOO_TEAM_ALIASES, type PickupOwnershipRow } from "./pickupsFixture";
import { SHARE_TIME_ZONE, type ShareDataState, type SharePlayer, type SharePlayerLayer, type SocialShareSnapshot } from "./types";

type Tables = Database["public"]["Tables"];
type Views = Database["public"]["Views"];
/** Read-only source shapes; only these columns are ever consumed. */
export type ShareMapRow = Pick<Views["yahoo_nhl_player_map_read"]["Row"], "yahoo_player_id" | "nhl_player_id">;
export type ShareSkaterRow = Pick<Tables["wgo_skater_stats_totals"]["Row"], "player_id" | "player_name" | "season" | "games_played" | "points_per_game" | "shots" | "hits" | "blocked_shots" | "current_team_abbreviation" | "updated_at">;
export type ShareGoalieRow = Pick<Tables["wgo_goalie_stats_totals"]["Row"], "goalie_id" | "goalie_name" | "season_id" | "games_played" | "games_started" | "quality_starts_pct" | "save_pct" | "current_team_abbreviation" | "updated_at">;
export type SharePlayerSources = { yahoo: PickupOwnershipRow[]; map: ShareMapRow[]; skaters: ShareSkaterRow[]; goalies: ShareGoalieRow[] };

/** Minimum sample before a season rate is shown. */
export const MIN_SKATER_GAMES = 5;
export const MIN_GOALIE_STARTS = 3;
/** Rates refresh daily; ownership must be today's or yesterday's (New York) observation. */
export const PLAYER_STATS_MAX_AGE_MS = 72 * 3600000;
/** "Top Week Score teams" for pickups and specialists. */
export const PLAYER_TEAM_RANK_MAX = 10;
export const PLAYERS_PER_LIST = 3;
/** Yahoo statuses that still allow a pickup; anything else (IR, O, NA, SUSP…) is excluded. */
const PLAYABLE_STATUSES = new Set(["", "DTD"]);

// Same parse as pages/api/v1/transactions/ownership-snapshots.ts.
const ownershipPct = (value: unknown): number | null => {
  const parsed = typeof value === "string" && /^\d+(\.\d+)?$/.test(value) ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
};
const isDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const count = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

/** Latest valid ownership_timeline point, else percent_ownership dated by last_updated (resolveOwnership rule). */
export function resolveOwnership(row: PickupOwnershipRow): { ownership: number; asOf: string | null } | null {
  const timeline = Array.isArray(row.ownership_timeline) ? (row.ownership_timeline as { date?: unknown; value?: unknown }[])
    .filter(point => isDate(point?.date) && ownershipPct(point?.value) !== null).sort((a, b) => String(a.date).localeCompare(String(b.date))) : [];
  const latest = timeline[timeline.length - 1];
  if (latest) return { ownership: ownershipPct(latest.value)!, asOf: latest.date as string };
  const fallback = ownershipPct(row.percent_ownership), updated = row.last_updated?.slice(0, 10);
  return fallback === null ? null : { ownership: fallback, asOf: isDate(updated) ? updated : null };
}

const PLAYING_POSITIONS = ["C", "LW", "RW", "D", "G"];
/**
 * One group per player, from the primary position: the first playing position in Yahoo's
 * display_position (its primary-first order), else in eligible_positions. A C/D dual-eligible
 * skater listed "C,D" is a forward and "D,C" a defenseman; the card still lists both positions.
 */
export function positionGroup(row: Pick<PickupOwnershipRow, "eligible_positions" | "display_position">): { group: SharePlayer["group"]; positions: string } | null {
  const eligible = Array.isArray(row.eligible_positions) ? (row.eligible_positions as { position?: unknown }[]).map(item => item?.position).filter((item): item is string => typeof item === "string" && PLAYING_POSITIONS.includes(item)) : [];
  if (!eligible.length) return null;
  const primary = (row.display_position ?? "").split(",").map(item => item.trim()).find(item => eligible.includes(item)) ?? eligible[0];
  return { group: primary === "G" ? "G" : primary === "D" ? "D" : "F", positions: eligible.join(",") };
}

/**
 * Join Yahoo ownership → NHL id → WGO season totals into public rows. Excludes unplayable statuses,
 * unknown ownership, unmapped players, small samples and teams outside the edition. Never copies
 * Yahoo keys, notes or timelines into the output.
 */
export function buildPlayerLayer(sources: SharePlayerSources | null, input: { season: number; teams: string[]; fetchedAt: string; generatedAt: string }): SharePlayerLayer {
  const base = { name: "Yahoo ownership + NHL.com season totals" as const, season: input.season, fetchedAt: input.fetchedAt };
  if (!sources) return { ...base, ownershipAsOf: null, statsUpdatedAt: null, state: "missing", reasons: ["Player ownership and season totals are not connected."], players: [] };
  const yahooSeason = Math.floor(input.season / 10000), reasons: string[] = [];
  const nhlIdByYahoo = new Map<string, number>();
  for (const row of sources.map) {
    const nhlId = Number(row.nhl_player_id);
    if (row.yahoo_player_id && Number.isSafeInteger(nhlId) && nhlId > 0) nhlIdByYahoo.set(row.yahoo_player_id, nhlId);
  }
  const skaters = new Map(sources.skaters.filter(row => row.season === String(input.season)).map(row => [row.player_id, row]));
  const goalies = new Map(sources.goalies.filter(row => row.season_id === input.season).map(row => [row.goalie_id, row]));
  const players: SharePlayer[] = [];
  let ownershipAsOf: string | null = null, statsUpdatedAt: string | null = null, droppedStale = 0, droppedFuture = 0;
  const seen = new Set<number>();
  const today = localDate(input.generatedAt, SHARE_TIME_ZONE), yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const generated = Date.parse(input.generatedAt);
  for (const row of sources.yahoo) {
    if (row.season !== yahooSeason || !PLAYABLE_STATUSES.has(row.status ?? "")) continue;
    const owned = resolveOwnership(row), position = positionGroup(row);
    const nhlId = nhlIdByYahoo.get(row.player_key) ?? (row.player_id ? nhlIdByYahoo.get(row.player_id) : undefined);
    if (!owned || !position || nhlId === undefined || seen.has(nhlId)) continue;
    const yahooTeam = PICKUP_YAHOO_TEAM_ALIASES[row.editorial_team_abbreviation ?? ""] ?? row.editorial_team_abbreviation;
    let player: SharePlayer | null = null, updated: string | null = null;
    if (position.group === "G") {
      const stats = goalies.get(nhlId);
      if (stats && count(stats.games_started) && stats.games_started >= MIN_GOALIE_STARTS && count(stats.games_played) && stats.goalie_name && stats.current_team_abbreviation) {
        player = { nhlId, name: stats.goalie_name, team: stats.current_team_abbreviation, group: "G", positions: position.positions, ownership: owned.ownership, gamesPlayed: stats.games_played,
          pointsPerGame: null, hits: null, shots: null, blocks: null, gamesStarted: stats.games_started, qualityStartPct: count(stats.quality_starts_pct) ? stats.quality_starts_pct : null, savePct: count(stats.save_pct) ? stats.save_pct : null };
        updated = stats.updated_at;
      }
    } else {
      const stats = skaters.get(nhlId);
      if (stats && count(stats.games_played) && stats.games_played >= MIN_SKATER_GAMES && stats.player_name && stats.current_team_abbreviation && count(stats.points_per_game) && count(stats.hits) && count(stats.shots) && count(stats.blocked_shots)) {
        player = { nhlId, name: stats.player_name, team: stats.current_team_abbreviation, group: position.group, positions: position.positions, ownership: owned.ownership, gamesPlayed: stats.games_played,
          pointsPerGame: stats.points_per_game, hits: stats.hits, shots: stats.shots, blocks: stats.blocked_shots, gamesStarted: null, qualityStartPct: null, savePct: null };
        updated = stats.updated_at;
      }
    }
    // WGO's current team is authoritative; a Yahoo team that disagrees means a stale mapping.
    if (!player || !input.teams.includes(player.team) || (yahooTeam && yahooTeam !== player.team)) continue;
    // Freshness is gated per player: one fresh row never vouches for another player's old data.
    const totalsAt = updated && Number.isFinite(Date.parse(updated)) ? Date.parse(updated) : NaN;
    if ((owned.asOf && owned.asOf > today) || totalsAt > generated) { droppedFuture++; continue; }
    if (!owned.asOf || owned.asOf < yesterday || !Number.isFinite(totalsAt) || generated - totalsAt > PLAYER_STATS_MAX_AGE_MS) { droppedStale++; continue; }
    seen.add(nhlId); players.push(player);
    // The card shows the oldest included observation, so every as-of it prints covers every tile.
    if (!ownershipAsOf || owned.asOf < ownershipAsOf) ownershipAsOf = owned.asOf;
    const iso = new Date(totalsAt).toISOString();
    if (!statsUpdatedAt || iso < statsUpdatedAt) statsUpdatedAt = iso;
  }
  let state: ShareDataState = "ready";
  // More stale rows than current ones means the source refresh failed; rank nobody.
  if (droppedStale > players.length) { state = "stale"; reasons.push(`Most player rows are stale (${droppedStale} of ${droppedStale + players.length}): Yahoo ownership older than a day or season totals older than 72 hours.`); }
  else if (!players.length) { state = droppedFuture ? "missing" : "partial"; reasons.push(droppedFuture ? "Player source time is in the future." : "No eligible players joined ownership and season totals."); }
  else if (droppedStale || droppedFuture) reasons.push(`Excluded ${droppedStale} stale and ${droppedFuture} future-dated player rows.`);
  return { ...base, ownershipAsOf, statsUpdatedAt, state, reasons, players: players.sort((a, b) => a.nhlId - b.nhlId) };
}

const sameDates = (a: string[], b: string[]) => a.length === b.length && a.every((date, i) => date === b[i]);
/** True when the layer is ready and was prepared for the edition's current day selection. */
export const playersMatchSelection = (snapshot: SocialShareSnapshot) => !snapshot.players?.selectedDates || sameDates(snapshot.players.selectedDates, snapshot.selectedDates);
export const playersReady = (snapshot: SocialShareSnapshot) => snapshot.players?.state === "ready" && playersMatchSelection(snapshot);

/** `widened`: the player's team ranks outside the top 10 and only fills a short list (TJ, ticket 10). */
export type RankedPlayer = SharePlayer & { weekRank: number; remainingGames: number; offNightGames: number; widened: boolean };
function rankedPlayers(snapshot: SocialShareSnapshot): RankedPlayer[] {
  const rows = new Map(snapshot.rows.filter(row => row.remainingGames > 0).map(row => [row.team.abbreviation, row]));
  return (snapshot.players?.players ?? []).flatMap(player => {
    const row = rows.get(player.team);
    return row ? [{ ...player, weekRank: row.rank, remainingGames: row.remainingGames, offNightGames: row.offNightGames, widened: row.rank > PLAYER_TEAM_RANK_MAX }] : [];
  });
}
/**
 * Top-10 Week Score teams first, by `order`; a list still short of three is filled from teams ranked
 * 11+, best schedule first, then the same order. Fill players keep `widened: true` for the card.
 */
function fillThree<T extends RankedPlayer>(candidates: T[], order: (a: T, b: T) => number, perList = PLAYERS_PER_LIST): T[] {
  const top = candidates.filter(player => !player.widened).sort(order).slice(0, perList);
  const wider = candidates.filter(player => player.widened).sort((a, b) => a.weekRank - b.weekRank || order(a, b));
  return [...top, ...wider].slice(0, perList);
}
// Never alphabetical (TJ, ticket 15): schedule rank, then rostered %, then the stable NHL id.
const tieBreak = (a: RankedPlayer, b: RankedPlayer) => a.weekRank - b.weekRank || a.ownership - b.ownership || a.nhlId - b.nhlId;
/** Existing per-player season rate: skater points per game; goalie quality-start %, then save %. */
export const seasonOrder = (a: RankedPlayer, b: RankedPlayer) => a.group === "G" && b.group === "G"
  ? (b.qualityStartPct ?? -1) - (a.qualityStartPct ?? -1) || (b.savePct ?? -1) - (a.savePct ?? -1) || tieBreak(a, b)
  : (b.pointsPerGame ?? -1) - (a.pointsPerGame ?? -1) || tieBreak(a, b);
/** Card order (ticket 15): L5 fantasy score × opportunity first, season rate as the tiebreak. */
export const scoreOrder = byScore<RankedPlayer>(playerScore, seasonOrder);

/** Separate rostered-% bands (TJ, SS1-4-O1): each player belongs to exactly one, min ≤ % < max. */
export const PICKUP_BANDS = [
  { max: 50, min: 30, label: "30–49%" },
  { max: 30, min: 20, label: "20–29%" },
  { max: 20, min: 0, label: "Under 20%" },
] as const;
export type PickupTier = (typeof PICKUP_BANDS)[number] & { groups: Record<SharePlayer["group"], RankedPlayer[]> };
/**
 * Pickups: players on top-10 Week Score teams, ranked within F/D/G by an existing per-player rate,
 * then team schedule rank, listed in their own rostered band (30–49%, 20–29%, under 20%).
 */
export function pickupTiers(snapshot: SocialShareSnapshot, trusted: boolean, perList = PLAYERS_PER_LIST): PickupTier[] {
  if (!trusted || !playersReady(snapshot)) return [];
  // Sort within a position group only: skaters and goalies use different rates.
  const pool = rankedPlayers(snapshot);
  return PICKUP_BANDS.map(band => ({ ...band, groups: Object.fromEntries((["F", "D", "G"] as const).map(group =>
    [group, fillThree(pool.filter(player => player.group === group && player.ownership >= band.min && player.ownership < band.max), scoreOrder, perList)])) as PickupTier["groups"] }));
}

/**
 * Server-side: keep only the players the pickup and specialist cards show for this edition's
 * selected dates, and record that selection. An unready layer keeps nobody, so no names leave it.
 */
export function trimPlayerLayer(snapshot: SocialShareSnapshot, layer: SharePlayerLayer): SharePlayerLayer {
  const prepared = { ...layer, selectedDates: [...snapshot.selectedDates] };
  if (layer.state !== "ready") return { ...prepared, players: [] };
  const edition = { ...snapshot, players: prepared };
  const shown = new Set([...pickupTiers(edition, true).flatMap(tier => Object.values(tier.groups).flat()), ...Object.values(specialists(edition, true)).flat()].map(player => player.nhlId));
  return { ...prepared, players: layer.players.filter(player => shown.has(player.nhlId)) };
}

export type SpecialistCategory = "hits" | "shots" | "blocks";
/** `perGame`: season total ÷ games played (the tiebreak); `l5PerGame`: the category over the last five games. */
export type Specialist = RankedPlayer & { perGame: number; l5PerGame: number | null };
/** L5 per-game value of a specialist category; null without recent games. */
export function l5CategoryPerGame(player: SharePlayer, category: SpecialistCategory): number | null {
  const recent = player.recent;
  if (!recent || recent.kind !== "skater" || recent.games <= 0) return null;
  return category === "hits" ? recent.hitsPerGame : category === "blocks" ? recent.blocksPerGame : recent.shots === null ? null : recent.shots / recent.games;
}
/**
 * Specialists: skaters under 50% rostered on top-10 Week Score teams, by the category's L5 per-game rate
 * × opportunity (ticket 15), with the season total ÷ games played as the tiebreak.
 */
export function specialists(snapshot: SocialShareSnapshot, trusted: boolean, perList = PLAYERS_PER_LIST): Record<SpecialistCategory, Specialist[]> {
  const empty = { hits: [], shots: [], blocks: [] };
  if (!trusted || !playersReady(snapshot)) return empty;
  const pool = rankedPlayers(snapshot).filter(player => player.group !== "G" && player.ownership < 50);
  return Object.fromEntries((["hits", "shots", "blocks"] as const).map(category => [category,
    fillThree(pool.map(player => ({ ...player, perGame: player[category]! / player.gamesPlayed, l5PerGame: l5CategoryPerGame(player, category) })),
      byScore<Specialist>(player => player.l5PerGame === null ? null : player.l5PerGame * opportunityMultiplier(player), (a, b) => b.perGame - a.perGame || tieBreak(a, b)), perList)])) as Record<SpecialistCategory, Specialist[]>;
}

/** Read-only recent-game source shapes. */
export type ShareRecentRollingRow = Pick<Tables["rolling_player_game_metrics"]["Row"], "player_id" | "season" | "game_date" | "strength_state" | "season_games_played" |
  "goals_total_last5" | "assists_total_last5" | "points_total_last5" | "shots_total_last5" | "hits_avg_last5" | "blocks_avg_last5" | "toi_seconds_avg_last5" | "pp_points_total_last5"
  | "toi_seconds_avg_season" | "line_combo_slot" | "line_combo_group" | "pp_unit">;
export type ShareGoalieGameRow = Pick<Tables["wgo_goalie_stats"]["Row"], "goalie_id" | "date" | "season_id" | "games_played" | "wins" | "saves" | "shots_against" | "goals_against" | "quality_start" | "shutouts">;
/** A last-5 window older than this (no game in two weeks) is not shown as recent form. */
export const RECENT_MAX_AGE_DAYS = 14;

/**
 * Attach last-five-games evidence to the (already trimmed) players: the latest strength-all rolling row
 * for skaters, and the five most recent games played for goalies (sums only; SV% = saves ÷ shots).
 */
export function attachRecent(layer: SharePlayerLayer, sources: { rolling: ShareRecentRollingRow[]; goalieGames: ShareGoalieGameRow[] } | null, generatedAt: string): SharePlayerLayer {
  const today = localDate(generatedAt, SHARE_TIME_ZONE), oldest = new Date(Date.parse(`${today}T00:00:00Z`) - RECENT_MAX_AGE_DAYS * 86400000).toISOString().slice(0, 10);
  // A failed read is "unavailable", never "no recent game".
  if (!sources) return { ...layer, recentState: "unavailable", players: layer.players.map(player => ({ ...player, recent: null })) };
  const players = layer.players.map(player => {
    if (player.group !== "G") {
      const latest = sources.rolling.filter(row => row.player_id === player.nhlId && row.season === layer.season && row.strength_state === "all" && isDate(row.game_date) && row.game_date <= today)
        .sort((a, b) => b.game_date.localeCompare(a.game_date))[0];
      if (!latest || latest.game_date < oldest) return { ...player, recent: null };
      return { ...player, recent: { kind: "skater" as const, games: Math.min(5, latest.season_games_played ?? 5), through: latest.game_date, goals: latest.goals_total_last5, assists: latest.assists_total_last5, points: latest.points_total_last5,
        shots: latest.shots_total_last5, hitsPerGame: latest.hits_avg_last5, blocksPerGame: latest.blocks_avg_last5, toiSeconds: latest.toi_seconds_avg_last5, ppPoints: latest.pp_points_total_last5,
        line: normalizeEvDeploymentBucket({ lineComboGroup: latest.line_combo_group, lineComboSlot: latest.line_combo_slot }), ppUnit: normalizePpDeploymentBucket(latest.pp_unit), toiSeasonSeconds: latest.toi_seconds_avg_season ?? null } };
    }
    const games = sources.goalieGames.filter(row => row.goalie_id === player.nhlId && row.season_id === layer.season && isDate(row.date) && row.date <= today && (row.games_played ?? 0) > 0)
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    if (!games.length || games[0].date < oldest) return { ...player, recent: null };
    const sum = (key: "wins" | "saves" | "shots_against" | "goals_against" | "quality_start" | "shutouts") => games.reduce((total, row) => total + (count(row[key]) ? row[key]! : 0), 0);
    return { ...player, recent: { kind: "goalie" as const, games: games.length, through: games[0].date, wins: sum("wins"), saves: sum("saves"), shotsAgainst: sum("shots_against"), goalsAgainst: sum("goals_against"), qualityStarts: sum("quality_start"), shutouts: sum("shutouts") } };
  });
  return { ...layer, recentState: "ready", players };
}
