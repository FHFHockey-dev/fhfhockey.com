import calcWeekScore from "components/GameGrid/utils/calcWeekScore";
import { countsAsOpportunity } from "lib/socialShare/mondayGrid";
import { PICKUP_YAHOO_TEAM_ALIASES, type PickupOwnershipRow } from "lib/socialShare/pickupsFixture";
import { positionGroup, RECENT_MAX_AGE_DAYS, resolveOwnership, MIN_SKATER_GAMES, type ShareMapRow } from "lib/socialShare/players";
import { weekDates } from "lib/socialShare/schedule";
import { fantasyPointsPerGame, playerScore } from "lib/socialShare/score";
import type { ShareDataState, SocialShareSnapshot } from "lib/socialShare/types";
import { defineShareModule, SHARE_POST_DEFAULT_TTL_SECONDS, type SharePostEvidence, type SharePostLoadResult, type SharePostSource } from "./contract";
import { appearancesByPlayer, type SkaterAppearance } from "./shared/skaterAppearances";
import { competitionRanks, editionDate, lastN, ownershipInRange, ownershipLabel, ownershipOf, type OwnershipState } from "./shared/definitions";
import { shiftDays } from "./teamGames";

/**
 * Off-Night Edge (SS 6.0, SS-R07): GP by day and the top 16 teams by actual Game Grid Week Score for the selected dates,
 * with up to one forward and one defenseman under a Yahoo ownership ceiling. Fewer picks carry their reason; never filler.
 */
export const OFF_NIGHT_TEAMS = 16;
/** Appearances read per skater window. Five in this span is the sample rule, so L5 is always a full five. */
export const OFF_NIGHT_LOOKBACK_DAYS = 21;
/** Same playable rule as players.ts: anything else (IR, O, NA, SUSP) is not available to pick up. */
const PLAYABLE_STATUSES = new Set(["", "DTD"]);

export type OffNightDates = "weekly" | "rest-of-week";
export type OffNightSettings = { ownershipCeiling: number; includeUnknown: "on" | "off"; dates: OffNightDates };
export type OffNightGroup = "F" | "D";
export type OffNightYahooRow = Omit<PickupOwnershipRow, "ownership_timeline">;
export type OffNightPick = { nhlId: number; name: string; positions: string; ownership: OwnershipState; games: number; fantasyPerGame: number; score: number };
export type OffNightExclusions = { aboveCeiling: number; unknownOwnership: number; staleOwnership: number; unavailable: number; sample: number; identity: number };
export type OffNightDay = { date: string; label: string; leagueGames: number; offNight: boolean };
export type OffNightRow = {
  team: string; teamName: string; rank: number; score: number; games: number; offNightGames: number;
  /** Counted games per entry of `days`. */
  gamesByDay: number[];
  picks: Record<OffNightGroup, OffNightPick | null>;
  /** Why a position has no pick; null when it has one. */
  gaps: Record<OffNightGroup, string | null>;
};
export type OffNightData = {
  dates: OffNightDates; weekStart: string; weekEnd: string; days: OffNightDay[]; rows: OffNightRow[];
  teamsWithGames: number; countedGames: number;
  /** Equal scores cut by the fixed top 16: they share the last rank and are named rather than silently dropped. */
  tiedOut: string[];
  ownership: { known: number; unknown: number; stale: number; asOf: string | null };
};
export type OffNightScheduleRow = Omit<OffNightRow, "picks" | "gaps">;

/** Weekly is Monday to Sunday; rest of week starts today in New York. */
export function offNightSelectedDates(weekStart: string, today: string, dates: OffNightDates) {
  const week = weekDates(weekStart);
  return dates === "weekly" ? week : week.filter(date => date >= today);
}

/**
 * Week Score over the games the selection counts, by the same `calcWeekScore` inputs as selectScheduleDates.
 * Rest of week uses its opportunity rule (selected, scheduled, known future start). The helper would drop played games
 * from a seven-day selection too, making weekly equal rest of week mid-week, so weekly counts the whole slate.
 */
export function offNightSchedule(edition: SocialShareSnapshot, dates: OffNightDates) {
  const counted = edition.games.filter(game => dates === "rest-of-week" ? countsAsOpportunity(edition, game)
    : game.gameType === 2 && edition.selectedDates.includes(game.date) && ["scheduled", "live", "final"].includes(game.status));
  const days = edition.days.filter(day => day.selected).map(({ date, label, leagueGames, offNight }): OffNightDay => ({ date, label, leagueGames, offNight }));
  const dayOf = new Map(edition.days.map(day => [day.date, day]));
  const scored = edition.teams.flatMap(team => {
    const own = counted.filter(game => game.homeTeam.id === team.id || game.awayTeam.id === team.id);
    if (!own.length) return [];
    const offNightGames = own.filter(game => dayOf.get(game.date)?.offNight).length;
    const score = calcWeekScore([], offNightGames, counted.length, own.length, own.map(game => dayOf.get(game.date)!.leagueGames), edition.source.state === "ready");
    return [{ team, score, games: own.length, offNightGames, gamesByDay: days.map(day => own.filter(game => game.date === day.date).length) }];
  });
  // Rounded for the comparison only: sums over the same slates in another order differ by float noise, not by schedule.
  const ranked = competitionRanks(scored, row => Math.round(row.score * 1e6) / 1e6, row => row.team.abbreviation);
  const toRow = ({ row, rank }: typeof ranked[number]): OffNightScheduleRow => ({ team: row.team.abbreviation, teamName: row.team.name, rank, score: row.score, games: row.games, offNightGames: row.offNightGames, gamesByDay: row.gamesByDay });
  const top = ranked.slice(0, OFF_NIGHT_TEAMS), lastRank = top[top.length - 1]?.rank;
  return { days, countedGames: counted.length, teamsWithGames: ranked.length, rows: top.map(toRow), tiedOut: ranked.slice(OFF_NIGHT_TEAMS).filter(item => item.rank === lastRank).map(item => item.row.team.abbreviation) };
}

const NO_EXCLUSIONS: OffNightExclusions = { aboveCeiling: 0, unknownOwnership: 0, staleOwnership: 0, unavailable: 0, sample: 0, identity: 0 };
/** Why a position came up empty, from what was excluded and why. */
export function offNightGapReason(group: OffNightGroup, excluded: OffNightExclusions, ceiling: number) {
  const parts = [[excluded.aboveCeiling, `over ${ceiling}%`], [excluded.unknownOwnership, "unknown %"], [excluded.staleOwnership, "stale %"], [excluded.unavailable, "unavailable"], [excluded.sample, "short sample"], [excluded.identity, "no identity"]] as const;
  const shown = parts.filter(([count]) => count > 0).map(([count, label]) => `${count} ${label}`);
  return `No ${group}: ${shown.length ? shown.join(", ") : "no skaters played"}`;
}

/** Yahoo row per NHL id through the map. A Yahoo id on two NHL ids, or an NHL id on two Yahoo rows, is ambiguous and dropped. */
function yahooByNhlId(yahoo: readonly OffNightYahooRow[], map: readonly ShareMapRow[]) {
  const nhlIds = new Map<string, Set<number>>();
  for (const row of map) {
    const id = Number(row.nhl_player_id);
    if (row.yahoo_player_id && Number.isInteger(id) && id > 0) nhlIds.set(row.yahoo_player_id, (nhlIds.get(row.yahoo_player_id) ?? new Set()).add(id));
  }
  const rows = new Map<number, OffNightYahooRow[]>();
  for (const row of yahoo) {
    const ids = new Set([...(nhlIds.get(row.player_key) ?? []), ...(row.player_id ? nhlIds.get(row.player_id) ?? [] : [])]);
    if (ids.size === 1) { const id = [...ids][0]; rows.set(id, [...(rows.get(id) ?? []), row]); }
  }
  return rows;
}

/** Latest game's team is the player's team now; earlier games stay bound to the team they were played for. */
function selectPicks(input: { appearances: readonly SkaterAppearance[]; yahoo: readonly OffNightYahooRow[]; map: readonly ShareMapRow[]; teams: readonly string[]; settings: OffNightSettings; today: string }) {
  const { settings } = input, wanted = new Set(input.teams), identities = yahooByNhlId(input.yahoo, input.map);
  const yesterday = shiftDays(input.today, -1), activeSince = shiftDays(input.today, -RECENT_MAX_AGE_DAYS);
  const pools = new Map<string, { picks: Record<OffNightGroup, OffNightPick[]>; excluded: Record<OffNightGroup, OffNightExclusions> }>(input.teams.map(team => [team, { picks: { F: [], D: [] }, excluded: { F: { ...NO_EXCLUSIONS }, D: { ...NO_EXCLUSIONS } } }]));
  const ownership = { known: 0, unknown: 0, stale: 0, asOf: null as string | null };
  for (const [nhlId, games] of appearancesByPlayer(input.appearances)) {
    const latest = games[games.length - 1], pool = latest.team && wanted.has(latest.team) ? pools.get(latest.team) : undefined;
    if (!pool) continue;
    const rows = identities.get(nhlId) ?? [], yahoo = rows.length === 1 ? rows[0] : null;
    const position = yahoo ? positionGroup(yahoo) : null;
    const group = position ? position.group : latest.group;
    if (group !== "F" && group !== "D") continue;
    const excluded = pool.excluded[group];
    const yahooTeam = yahoo?.editorial_team_abbreviation ? PICKUP_YAHOO_TEAM_ALIASES[yahoo.editorial_team_abbreviation] ?? yahoo.editorial_team_abbreviation : null;
    if (!yahoo || !position || !latest.name || (yahooTeam && yahooTeam !== latest.team)) { excluded.identity++; continue; }
    const window = lastN(games, MIN_SKATER_GAMES).rows;
    const complete = window.every(game => game.goals !== null && game.assists !== null && game.shots !== null && game.hits !== null && game.blocks !== null && game.ppPoints !== null && game.toiSeconds !== null);
    if (games.length < MIN_SKATER_GAMES || !complete || latest.date < activeSince) { excluded.sample++; continue; }
    if (!PLAYABLE_STATUSES.has(yahoo.status ?? "")) { excluded.unavailable++; continue; }
    // Only skaters who could be picked count toward ownership evidence, so a stale bench row cannot block the post.
    const resolved = resolveOwnership({ ...yahoo, ownership_timeline: null }), asOf = yahoo.last_updated?.slice(0, 10) ?? null;
    if (!asOf || asOf < yesterday || asOf > input.today) { ownership.stale++; excluded.staleOwnership++; continue; }
    const owned = ownershipOf(resolved?.ownership, asOf);
    if (owned.state === "known") { ownership.known++; if (!ownership.asOf || asOf < ownership.asOf) ownership.asOf = asOf; } else ownership.unknown++;
    if (!ownershipInRange(owned, 0, settings.ownershipCeiling, settings.includeUnknown === "on")) { if (owned.state === "known") excluded.aboveCeiling++; else excluded.unknownOwnership++; continue; }
    const sum = (key: "goals" | "assists" | "ppPoints" | "shots" | "hits" | "blocks" | "toiSeconds") => window.reduce((total, game) => total + game[key]!, 0);
    const recent = { kind: "skater" as const, games: window.length, through: latest.date, goals: sum("goals"), assists: sum("assists"), points: sum("goals") + sum("assists"), shots: sum("shots"), hitsPerGame: sum("hits") / window.length, blocksPerGame: sum("blocks") / window.length, toiSeconds: sum("toiSeconds") / window.length, ppPoints: sum("ppPoints") };
    const player = { recent, group };
    pool.picks[group].push({ nhlId, name: latest.name, positions: position.positions, ownership: owned, games: window.length, fantasyPerGame: fantasyPointsPerGame(player)!, score: playerScore(player)! });
  }
  const best = (picks: OffNightPick[]) => [...picks].sort((a, b) => b.score - a.score || (a.ownership.pct ?? 101) - (b.ownership.pct ?? 101) || a.nhlId - b.nhlId)[0] ?? null;
  return { ownership, byTeam: new Map(input.teams.map(team => {
    const pool = pools.get(team)!, F = best(pool.picks.F), D = best(pool.picks.D);
    return [team, { picks: { F, D }, gaps: { F: F ? null : offNightGapReason("F", pool.excluded.F, settings.ownershipCeiling), D: D ? null : offNightGapReason("D", pool.excluded.D, settings.ownershipCeiling) } }] as const;
  })) };
}

const OWNERSHIP_TABLES = ["yahoo_players", "yahoo_nhl_player_map_read"] as const;
const scheduleSource = (edition: SocialShareSnapshot): SharePostSource => ({ name: "NHL schedule (Game Grid edition)", tables: ["NHL schedule API"], state: edition.state, asOf: edition.weekEnd, updatedAt: edition.source.updatedAt ?? edition.source.fetchedAt, reasons: edition.reasons });
const unready = (state: ShareDataState, reasons: string[], sources: SharePostSource[], sample: string): SharePostLoadResult<OffNightData> => {
  const evidence: SharePostEvidence = { sources, sample, strength: "All situations", cohort: "Not ranked", coverage: null };
  return { state, reasons, evidence, data: null };
};
/** A schedule edition that is not ready publishes no order and reads no players, as on the Monday cards. */
export const offNightScheduleGate = (edition: SocialShareSnapshot): SharePostLoadResult<OffNightData> | null => edition.state === "ready" && edition.source.state === "ready" ? null
  : unready(edition.state === "ready" ? edition.source.state : edition.state, edition.reasons.length ? edition.reasons : ["The schedule edition is not ready, so no order is published."], [scheduleSource(edition)], "Schedule not ready; no players read");

export function buildOffNightEdge(input: { edition: SocialShareSnapshot; settings: OffNightSettings; appearances: readonly SkaterAppearance[]; yahoo: readonly OffNightYahooRow[]; map: readonly ShareMapRow[]; gameIds: readonly number[]; from: string; through: string }): SharePostLoadResult<OffNightData> {
  const { edition, settings } = input;
  const gated = offNightScheduleGate(edition);
  if (gated) return gated;
  const schedule = offNightSchedule(edition, settings.dates), today = editionDate(edition.generatedAt);
  // Regular season only: the game ids come from `games` with type 2.
  const regular = new Set(input.gameIds), appearances = input.appearances.filter(row => regular.has(row.gameId));
  const { byTeam, ownership } = selectPicks({ appearances, yahoo: input.yahoo, map: input.map, teams: schedule.rows.map(row => row.team), settings, today });
  const asOf = appearances.reduce<string | null>((latest, row) => !latest || row.date > latest ? row.date : latest, null);
  const expected = input.gameIds.length * 2, observed = new Set(appearances.map(row => `${row.gameId}:${row.team}`)).size, missing = Math.max(0, expected - observed), complete = observed === expected;
  const statsSource: SharePostSource = { name: "NHL.com game stats", tables: ["wgo_skater_stats", "games"], state: complete ? "ready" : "partial", asOf, updatedAt: null };
  const judged = ownership.known + ownership.unknown + ownership.stale;
  const ownershipState: ShareDataState = !input.yahoo.length ? "missing" : judged && ownership.stale > ownership.known + ownership.unknown ? "stale" : ownership.stale ? "partial" : "ready";
  const ownershipSource: SharePostSource = { name: "Yahoo ownership", tables: OWNERSHIP_TABLES, state: ownershipState, asOf: ownership.asOf, updatedAt: null };
  const sources = [scheduleSource(edition), statsSource, ownershipSource];
  const sample = `${input.from} to ${input.through}: ${new Set(appearances.map(row => row.playerId)).size} skaters; picks need ${MIN_SKATER_GAMES} appearances, active in ${RECENT_MAX_AGE_DAYS} days, ranked by L5 fantasy points per game × ice time; ownership among qualified skaters: ${ownership.known} known, ${ownership.unknown} unknown, ${ownership.stale} stale`;
  if (ownershipState === "missing") return unready("missing", ["Yahoo ownership returned no rows, so no pickups can be judged."], sources, sample);
  if (ownershipState === "stale") return unready("stale", [`Most Yahoo ownership is older than a day (${ownership.stale} of ${judged} qualified skaters).`], sources, sample);
  const reasons = [
    ...(complete ? [] : [`${missing} of ${expected} scheduled team games have no skater rows.`]),
    ...(ownership.stale ? [`${ownership.stale} qualified skaters have Yahoo ownership older than a day, so they are excluded.`] : []),
  ];
  const unknownNote = settings.includeUnknown === "on" ? "unknown % included" : "unknown % excluded";
  return {
    state: reasons.length ? "partial" : "ready", reasons,
    data: { dates: settings.dates, weekStart: edition.weekStart, weekEnd: edition.weekEnd, days: schedule.days, countedGames: schedule.countedGames, teamsWithGames: schedule.teamsWithGames, tiedOut: schedule.tiedOut, ownership,
      rows: schedule.rows.map(row => ({ ...row, ...byTeam.get(row.team)! })) },
    teams: schedule.rows.map(row => row.team),
    // A puck drop or the schedule's freshness window ends this edition sooner than the default.
    ttlSeconds: Math.min(SHARE_POST_DEFAULT_TTL_SECONDS, Math.floor((Date.parse(edition.expiresAt!) - Date.parse(edition.generatedAt)) / 1000)),
    evidence: { sources, sample, strength: "All situations", cohort: `Top ${schedule.rows.length} of ${schedule.teamsWithGames} teams with games${schedule.tiedOut.length ? ` (also tied at the last rank: ${schedule.tiedOut.join(", ")})` : ""}; skaters at or under ${settings.ownershipCeiling}% rostered, ${unknownNote}`,
      coverage: { observed, expected, missing, unit: "team games" } },
  };
}

const pickText = (pick: OffNightPick | null, gap: string | null) => pick ? `${pick.name} ${ownershipLabel(pick.ownership)}` : gap;

export const offNightEdgeModule = defineShareModule<OffNightSettings, OffNightData>({
  id: "off-night-edge", title: "Off-Night Edge", summary: "Games by day and the top 16 Week Score teams, with one forward and one defenseman under an ownership ceiling.", group: "schedule", basis: "observed",
  suggestedUse: "Works for a Monday plan or a midweek rest-of-week post.",
  fields: [
    { id: "ownershipCeiling", label: "Ownership ceiling %", kind: "number", default: 50, min: 0, max: 100, step: 1 },
    { id: "includeUnknown", label: "Include unknown ownership", kind: "select", default: "off", options: [{ value: "off", label: "Off" }, { value: "on", label: "On" }] },
    { id: "dates", label: "Dates", kind: "select", default: "rest-of-week", options: [{ value: "rest-of-week", label: "Rest of week" }, { value: "weekly", label: "Weekly" }] },
  ],
  load: () => import("./offNightEdge.sources").then(sources => sources.loadOffNightEdge),
  card: () => import("components/SocialShare/modules/OffNightEdgeCard").then(card => card.default),
  hasRows: data => data.rows.some(row => row.picks.F || row.picks.D),
  altText: (snapshot, data) => `FHFH Off-Night Edge, ${data.dates === "weekly" ? "full week" : "rest of week"}, ${data.days[0]?.date ?? data.weekStart} to ${data.weekEnd}. ${data.rows.map(row => `${row.rank}. ${row.team}: ${row.games} games, ${row.offNightGames} off-night, score ${row.score.toFixed(1)}; ${pickText(row.picks.F, row.gaps.F)}; ${pickText(row.picks.D, row.gaps.D)}`).join(". ")}. NHL games by day: ${data.days.map(day => `${day.label} ${day.leagueGames}${day.offNight ? " (off night)" : ""}`).join(", ")}. ${snapshot.evidence.cohort}. ${snapshot.evidence.sample}.`,
});
