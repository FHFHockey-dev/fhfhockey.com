import { pickupTiers, playersReady, scoreOrder, specialists, trimPlayerLayer, type RankedPlayer } from "./players";
import type { SharePlayerLayer, ShareTeam, ShareTeamRow, SocialShareSnapshot } from "./types";
import { STREAM_LIMIT, streamingNights } from "./matchups";
import { TARGETS_PER_NIGHT, targetCandidates, targetKey, targetPicks } from "./targets";

/**
 * Schedule-aware streaming tiers (TJ, ticket 13). Teams with games are grouped by their exact
 * (GP, off-nights) pair; pairs are ordered by Game Grid Week Score (the best team's score in the pair,
 * TJ's pop-up choice), so the order matches the Best Schedules grid. Only the top three tiers show.
 * Strict: one pair per tier. Widen: from Tier 2 down, each tier also takes the next pair, so on TJ's
 * Oct 26 week Tier 2 = 4/2 + 4/1 (WPG, LAK, OTT) and Tier 3 = 3/2 (+ the next pair).
 */
export const TIER_COUNT = 3;
/** Player rows across all three tiers; a tier that runs out says "+N more" instead of shrinking text. */
export const TIER_LIST_ROWS = 15;

export type TierMode = "strict" | "widened";
export type SchedulePair = { gp: number; off: number; teams: ShareTeamRow[]; bestScore: number };
export type StreamingTier = { index: number; pairs: SchedulePair[]; teams: ShareTeam[]; players: RankedPlayer[]; shown: RankedPlayer[]; more: number };

/** Distinct (GP, off-nights) pairs of teams with games, best Week Score first; teams inside by rank. */
export function schedulePairs(snapshot: Pick<SocialShareSnapshot, "rows">): SchedulePair[] {
  const groups = new Map<string, ShareTeamRow[]>();
  for (const row of snapshot.rows.filter(item => item.remainingGames > 0)) {
    const key = `${row.remainingGames}/${row.offNightGames}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].map(teams => {
    const sorted = [...teams].sort((a, b) => a.rank - b.rank || a.team.abbreviation.localeCompare(b.team.abbreviation));
    return { gp: sorted[0].remainingGames, off: sorted[0].offNightGames, teams: sorted, bestScore: Math.max(...sorted.map(team => team.score)) };
  }).sort((a, b) => b.bestScore - a.bestScore || b.gp - a.gp || b.off - a.off);
}

/** The pairs in each shown tier for the mode. */
export function tierPairs(pairs: SchedulePair[], mode: TierMode): SchedulePair[][] {
  if (mode === "strict") return pairs.slice(0, TIER_COUNT).map(pair => [pair]);
  // Widen: Tier 1 keeps the best pair alone; Tiers 2 and 3 each fold in the next pair.
  return [pairs.slice(0, 1), pairs.slice(1, 3), pairs.slice(3, 5)].filter(tier => tier.length > 0);
}

/** Split the row budget: an equal share each (capped by its players), leftovers to earlier tiers first; an empty tier keeps one row for its note. */
export function allocateRows(counts: number[], capacity = TIER_LIST_ROWS): number[] {
  const reserved = counts.filter(count => count === 0).length, budget = Math.max(0, capacity - reserved);
  const active = counts.filter(count => count > 0).length;
  const share = active ? Math.floor(budget / active) : 0;
  const rows = counts.map(count => Math.min(count, share));
  let left = budget - rows.reduce((sum, value) => sum + value, 0);
  for (let i = 0; i < counts.length && left > 0; i++) {
    const add = Math.min(left, counts[i] - rows[i]);
    rows[i] += add; left -= add;
  }
  return rows;
}

/** Skaters first, then goalies; within each, the L5 fantasy score × opportunity with the season rate as tiebreak (ticket 15). */
const listOrder = (a: RankedPlayer, b: RankedPlayer) => Number(a.group === "G") - Number(b.group === "G") || scoreOrder(a, b);

/**
 * The tier list needs every under-50% player on the tier teams, or, on a live layer trimmed to what
 * the cards show (it carries `selectedDates`), the per-tier counts the server recorded while trimming.
 */
export const tierPlayersAvailable = (snapshot: SocialShareSnapshot) => playersReady(snapshot) && (!snapshot.players?.selectedDates || !!snapshot.players.tierCounts);

/** Each tier's pairs, teams and eligible players (under 50% rostered, tier teams only), in list order. */
function tierCandidates(snapshot: SocialShareSnapshot, mode: TierMode, withPlayers: boolean) {
  const rows = new Map(snapshot.rows.map(row => [row.team.abbreviation, row]));
  return tierPairs(schedulePairs(snapshot), mode).map((pairs, index) => {
    const teams = pairs.flatMap(pair => pair.teams);
    const names = new Set(teams.map(row => row.team.abbreviation));
    const players = !withPlayers ? [] : (snapshot.players?.players ?? []).filter(player => names.has(player.team) && player.ownership < 50).map(player => {
      const row = rows.get(player.team)!;
      return { ...player, weekRank: row.rank, remainingGames: row.remainingGames, offNightGames: row.offNightGames, widened: false };
    }).sort(listOrder);
    return { index: index + 1, pairs, teams: teams.map(row => row.team), players };
  });
}

/**
 * Players under 50% rostered on each tier's teams only, tier order before rate. `shown` fits the row
 * budget; `more` counts the rest. On a trimmed layer the rows are split by the server's full counts,
 * and the kept players still hold every shown row as a prefix of each tier's list order.
 */
export function streamingTiers(snapshot: SocialShareSnapshot, trusted: boolean, mode: TierMode): StreamingTier[] {
  if (!trusted) return [];
  const ready = tierPlayersAvailable(snapshot), tiers = tierCandidates(snapshot, mode, ready);
  const recorded = ready && snapshot.players?.selectedDates ? snapshot.players.tierCounts?.[mode] : null;
  if (recorded && recorded.length !== tiers.length) return tiers.map(tier => ({ ...tier, players: [], shown: [], more: 0 }));
  const counts = recorded ?? tiers.map(tier => tier.players.length);
  const allocation = allocateRows(counts);
  return tiers.map((tier, i) => {
    const shown = tier.players.slice(0, allocation[i]);
    return { ...tier, shown, more: Math.max(0, counts[i] - shown.length) };
  });
}

/** Largest trimmed live layer: 27 pickup + 9 specialist players, both tier modes' 15 rows, and 3 targets per matchup night. */
export const TRIMMED_PLAYERS_MAX = 36 + 2 * TIER_LIST_ROWS + STREAM_LIMIT * TARGETS_PER_NIGHT;

/** Each tier's full eligible-player count per mode, from the untrimmed layer. */
export function tierCountsOf(snapshot: SocialShareSnapshot, layer: SharePlayerLayer) {
  const full = { ...snapshot, players: { ...layer, selectedDates: null } };
  return { strict: tierCandidates(full, "strict", true).map(tier => tier.players.length), widened: tierCandidates(full, "widened", true).map(tier => tier.players.length) };
}

/**
 * Server-side trim for live editions: the pickup and specialist cards' players plus the rows both tier
 * modes show. `counts` are the full per-tier counts when `layer` is already a ranking pool (ticket 15);
 * they split the rows and say "+N more". No other player leaves the server; an unready layer keeps nobody.
 */
export function trimEditionPlayers(snapshot: SocialShareSnapshot, layer: SharePlayerLayer, counts = tierCountsOf(snapshot, layer)): SharePlayerLayer {
  const trimmed = trimPlayerLayer(snapshot, layer);
  if (trimmed.state !== "ready") return trimmed;
  const recorded = { ...snapshot, players: { ...layer, selectedDates: [...snapshot.selectedDates], tierCounts: counts } };
  // Picks come from the untrimmed layer (no selectedDates), then are recorded for the client.
  const untrimmed = { ...snapshot, players: { ...layer, selectedDates: null } };
  const shown = (["strict", "widened"] as const).flatMap(mode => streamingTiers(recorded, true, mode).flatMap(tier => tier.shown));
  // Targeted Matchups picks (ticket 22), from the same layer, so the client recomputes the same three per night.
  const picks = Object.fromEntries(streamingNights(untrimmed, true).map(night => [targetKey(night), targetPicks(untrimmed, night, true)]));
  const targets = Object.values(picks).flat().map(pick => pick.player);
  const keep = new Set([...trimmed.players, ...shown, ...targets].map(player => player.nhlId));
  return { ...trimmed, players: layer.players.filter(player => keep.has(player.nhlId)), tierCounts: counts,
    // Only shown players' ids leave the server (SS1-24).
    ...(trimmed.recentUnavailableIds ? { recentUnavailableIds: trimmed.recentUnavailableIds.filter(id => keep.has(id)) } : {}),
    targets: Object.fromEntries(Object.entries(picks).map(([key, list]) => [key, list.map(pick => ({ id: pick.player.nhlId, roles: pick.roles }))])) };
}

/** Ranking pool depth (ticket 15): candidates per card list, and extra tier rows, read for L5 before the final rank. */
export const RANK_POOL_PER_LIST = 6;
export const RANK_POOL_TIER_EXTRA = 5;
/** Most players the L5 read can cover: 9 pickup and 3 specialist lists, plus both tier modes' rows and extras. */
export const RANK_POOL_MAX = 12 * RANK_POOL_PER_LIST + 2 * (TIER_LIST_ROWS + TIER_COUNT * RANK_POOL_TIER_EXTRA) + STREAM_LIMIT * 3 * TARGETS_PER_NIGHT;

/**
 * Server-side ranking pool: the L5 score needs last-five-games rows, which are read only for a bounded
 * pool. Each card list contributes its best RANK_POOL_PER_LIST players by season rate (no L5 yet), and each
 * tier its row share plus RANK_POOL_TIER_EXTRA; the final cards then rank this pool by L5 score.
 */
export function rankingPool(snapshot: SocialShareSnapshot, layer: SharePlayerLayer): SharePlayerLayer {
  if (layer.state !== "ready") return { ...layer, players: [] };
  const full = { ...snapshot, players: { ...layer, selectedDates: null } };
  const unscored = { ...full, players: { ...full.players, players: full.players.players.map(player => ({ ...player, recent: null })) } };
  const lists = [...pickupTiers(unscored, true, RANK_POOL_PER_LIST).flatMap(tier => Object.values(tier.groups).flat()), ...Object.values(specialists(unscored, true, RANK_POOL_PER_LIST)).flat()];
  const tiers = (["strict", "widened"] as const).flatMap(mode => {
    const candidates = tierCandidates(unscored, mode, true), allocation = allocateRows(candidates.map(tier => tier.players.length));
    return candidates.flatMap((tier, i) => tier.players.slice(0, allocation[i] + RANK_POOL_TIER_EXTRA));
  });
  // Each matchup night's tilt-team candidates (top 3 per tilt role), so the final picks match the full layer.
  const targets = streamingNights(full, true).flatMap(night => targetCandidates(full, night));
  const keep = new Set([...lists, ...tiers, ...targets].map(player => player.nhlId));
  return { ...layer, players: layer.players.filter(player => keep.has(player.nhlId)) };
}
