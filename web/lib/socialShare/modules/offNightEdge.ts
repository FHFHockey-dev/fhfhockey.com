import calcWeekScore from "components/GameGrid/utils/calcWeekScore";
import { countsAsOpportunity } from "lib/socialShare/mondayGrid";
import { PICKUP_YAHOO_TEAM_ALIASES, type PickupOwnershipRow } from "lib/socialShare/pickupsFixture";
import { positionGroup, RECENT_MAX_AGE_DAYS, resolveOwnership, MIN_SKATER_GAMES, type ShareMapRow } from "lib/socialShare/players";
import { calendarWeekStart, weekDates } from "lib/socialShare/schedule";
import { fantasyPointsPerGame, playerScore } from "lib/socialShare/score";
import type { ShareDataState, SocialShareSnapshot } from "lib/socialShare/types";
import { defineShareModule, SHARE_POST_DEFAULT_TTL_SECONDS, type SharePostEvidence, type SharePostLoadResult, type SharePostSource } from "./contract";
import { appearancesByPlayer, type SkaterAppearance } from "./shared/skaterAppearances";
import { spanDays } from "./shared/categoryCounts";
import { completeThrough, completeThroughNote, countNights, teamGameDates } from "./shared/completeThrough";
import { competitionRanks, editionDate, lastN, ownershipInRange, ownershipLabel, ownershipOf, type OwnershipState } from "./shared/definitions";
import { customRangeReason, PERIOD_CUSTOM, periodDates, periodWindowFields, resolvePeriodWindow, type MatchupCalendar, type PeriodControl, type PeriodWindow, type PeriodWindowResult, type PeriodWindowSettings } from "./shared/periodWindow";
import { shiftDays } from "./teamGames";

/**
 * Off-Night Edge (SS 6.0, SS-R07): GP by day and the top 16 teams by actual Game Grid Week Score for the selected dates,
 * with up to one forward and one defenseman under a Yahoo ownership ceiling. A HOT skater comes first, then the best
 * by the score method, then a short sample (TJ, 2026-11-03). An empty slot's reason is a page note, never on the card.
 */
export const OFF_NIGHT_TEAMS = 16;
/** Appearances read per skater window. Five in this span is the sample rule, so L5 is always a full five. */
export const OFF_NIGHT_LOOKBACK_DAYS = 21;
/** Same playable rule as players.ts: anything else (IR, O, NA, SUSP) is not available to pick up. */
const PLAYABLE_STATUSES = new Set(["", "DTD"]);
/**
 * Yahoo's status sticks: its writer keeps the old flag when Yahoo omits status for a healthy player, so preseason NA and
 * old IR flags outlive the injury. A skater in one of his team's last this-many games is playing, whatever the flag says.
 */
export const OFF_NIGHT_PLAYING_GAMES = 2;
/**
 * HOT, from the appearances already read: L5 fantasy points per game at least this multiple of the same skater's rate
 * over his earlier games in the lookback (at least `OFF_NIGHT_HOT_BASE_GAMES` of them), and at or above his position's
 * median L5 among this edition's eligible skaters, so a small rise from nothing is not hot.
 */
export const OFF_NIGHT_HOT_RATIO = 1.25, OFF_NIGHT_HOT_BASE_GAMES = 3;

export type OffNightDates = "weekly" | "rest-of-week";
export type OffNightSettings = PeriodWindowSettings & { ownershipCeiling: number; includeUnknown: "on" | "off"; dates: OffNightDates };
export type OffNightGroup = "F" | "D";
export type OffNightYahooRow = Omit<PickupOwnershipRow, "ownership_timeline">;
export type OffNightPick = { nhlId: number; name: string; positions: string; ownership: OwnershipState; games: number; fantasyPerGame: number; score: number;
  /** L5 well above his own earlier rate and his position's median: preferred over a better score that is not. */
  hot: boolean;
  /** Fewer than five complete games: used only when no full-sample skater qualifies, and chipped on the card. */
  shortSample: boolean;
  /**
   * Yahoo's IR, O or NA flag, kept although he played one of his team's last games: the flag may be stale or may be last
   * night's injury, so he is picked only when no unflagged skater qualifies, and a page note names him. Null when unflagged.
   */
  yahooStatus: string | null };
export type OffNightExclusions = { aboveCeiling: number; unknownOwnership: number; staleOwnership: number; unavailable: number; inactive: number; sample: number; identity: number };
export type OffNightDay = { date: string; label: string; leagueGames: number; offNight: boolean };
/** How many skaters' Yahoo flags were ignored because they played, and how many had no Yahoo % at all. */
export type OffNightDiagnostics = { statusOverridden: number; unknownOwnership: number };
export type OffNightRow = {
  team: string; teamName: string; rank: number; score: number; games: number; offNightGames: number;
  /** Counted games per entry of `days`. */
  gamesByDay: number[];
  /** Opponents in those games, per entry of `days`. */
  opponentsByDay: string[][];
  picks: Record<OffNightGroup, OffNightPick | null>;
  /** Why a position has no pick; null when it has one. */
  gaps: Record<OffNightGroup, string | null>;
};
/** The dates shown. A past or upcoming window has its own schedule, but its picks and ownership are always today's. */
export type OffNightWindow = Pick<PeriodWindow, "kind" | "week" | "from" | "through" | "label"> & { past: boolean; playedIncluded: boolean;
  /** Set when none of the dates have started: next week when they start next Monday. */
  upcoming?: "next-week" | "upcoming" | null };
export type OffNightData = {
  /** What the score counts: `weekly` is every game on the dates, played or not; only this week's rest of week counts just what is left. */
  dates: OffNightDates; window: OffNightWindow; weekStart: string; weekEnd: string; days: OffNightDay[]; rows: OffNightRow[];
  teamsWithGames: number; countedGames: number;
  /** Equal scores cut by the fixed top 16: they share the last rank and are named rather than silently dropped. */
  tiedOut: string[];
  ownership: { known: number; unknown: number; stale: number; asOf: string | null };
};
/** Admin-only page notes: the empty slots and why, and the data problems found. Never on the PNG. */
export function offNightPageNotes(rows: readonly Pick<OffNightRow, "team" | "gaps" | "picks">[], diagnostics: OffNightDiagnostics, settings: Pick<OffNightSettings, "includeUnknown">) {
  return [
    ...rows.flatMap(row => (["F", "D"] as const).flatMap(group => row.gaps[group] ? [`${row.team} ${row.gaps[group]}.`] : [])),
    ...rows.flatMap(row => (["F", "D"] as const).flatMap(group => { const pick = row.picks[group]; return pick?.yahooStatus ? [`${row.team} ${group}: ${pick.name} is marked ${pick.yahooStatus} by Yahoo but played one of ${row.team}'s last ${OFF_NIGHT_PLAYING_GAMES} games, and no unflagged skater qualifies. Check he is healthy before posting.`] : []; })),
    ...(diagnostics.statusOverridden ? [`Yahoo marks ${diagnostics.statusOverridden} eligible skaters IR, O or NA although each played in one of his team's last ${OFF_NIGHT_PLAYING_GAMES} games; they stay pickable. Yahoo's writer keeps an old status when Yahoo omits it.`] : []),
    ...(diagnostics.unknownOwnership ? [`${diagnostics.unknownOwnership} eligible skaters have no Yahoo % rostered: Yahoo has never reported one for them (no history row), so it is unknown, not 0%.${settings.includeUnknown === "on" ? "" : " They are left out while Include unknown ownership is Off."}`] : []),
  ];
}
export type OffNightScheduleRow = Omit<OffNightRow, "picks" | "gaps">;

/** Weekly is Monday to Sunday; rest of week starts today in New York. */
export function offNightSelectedDates(weekStart: string, today: string, dates: OffNightDates) {
  const week = weekDates(weekStart);
  return dates === "weekly" ? week : week.filter(date => date >= today);
}

/** The period option that keeps this calendar week's `dates` choice, the default. Needs no matchup calendar. */
export const OFF_NIGHT_THIS_WEEK = "this-week";
export const OFF_NIGHT_CONTROL: PeriodControl = { mode: "any-week" };
/** Wider than this, the day columns no longer fit beside the picks. The longest matchup on the calendar is 14 days. */
export const OFF_NIGHT_CUSTOM_MAX_DAYS = 14;
/** One NHL schedule call per Monday week; 14 days can touch three. Above this a load fails closed. */
export const OFF_NIGHT_MAX_SCHEDULE_WEEKS = 3;
export const validateOffNight = (settings: OffNightSettings) => {
  if (settings.period !== PERIOD_CUSTOM) return null;
  return customRangeReason(settings) ?? (spanDays(settings.start!, settings.end!) > OFF_NIGHT_CUSTOM_MAX_DAYS ? `A custom range covers at most ${OFF_NIGHT_CUSTOM_MAX_DAYS} days.` : null);
};
export function resolveOffNightWindow(settings: OffNightSettings, calendar: MatchupCalendar, generatedAt: string): PeriodWindowResult {
  const today = editionDate(generatedAt);
  return resolvePeriodWindow(settings, calendar, { ...OFF_NIGHT_CONTROL, cutoff: shiftDays(today, -1), own: { [OFF_NIGHT_THIS_WEEK]: () => {
    const dates = offNightSelectedDates(calendarWeekStart(generatedAt), today, settings.dates), from = dates[0], through = dates[dates.length - 1];
    return { from, through, label: `${settings.dates === "weekly" ? "Full week" : "Rest of week"} · ${periodDates(from, through)}` };
  } } });
}
/** The Monday weeks a window touches, each with its dates inside the window. */
export function offNightWeeks(from: string, through: string) {
  const weeks: { weekStart: string; dates: string[] }[] = [];
  for (let monday = shiftDays(from, -((new Date(`${from}T12:00:00Z`).getUTCDay() + 6) % 7)); monday <= through; monday = shiftDays(monday, 7)) weeks.push({ weekStart: monday, dates: weekDates(monday).filter(date => date >= from && date <= through) });
  return weeks;
}

type OffNightEditions = SocialShareSnapshot | readonly SocialShareSnapshot[];
const editionsOf = (editions: OffNightEditions): readonly SocialShareSnapshot[] => "games" in editions ? [editions] : editions;

/** A window with every date ahead of today, and whether it starts next Monday. */
export function offNightUpcoming(window: Pick<PeriodWindow, "from">, generatedAt: string): OffNightWindow["upcoming"] {
  if (window.from <= editionDate(generatedAt)) return null;
  return window.from === shiftDays(calendarWeekStart(generatedAt), 7) ? "next-week" : "upcoming";
}

/**
 * Week Score over the games the selection counts, by the same `calcWeekScore` inputs as selectScheduleDates.
 * Rest of week uses its opportunity rule (selected, scheduled, known future start). The helper would drop played games
 * from a seven-day selection too, making weekly equal rest of week mid-week, so weekly counts the whole slate.
 * A window across Monday weeks passes one edition per week and is scored as a single horizon.
 */
export function offNightSchedule(input: OffNightEditions, dates: OffNightDates) {
  const editions = editionsOf(input);
  const counted = editions.flatMap(edition => edition.games.filter(game => dates === "rest-of-week" ? countsAsOpportunity(edition, game)
    : game.gameType === 2 && edition.selectedDates.includes(game.date) && ["scheduled", "live", "final"].includes(game.status)));
  const days = editions.flatMap(edition => edition.days.filter(day => day.selected)).map(({ date, label, leagueGames, offNight }): OffNightDay => ({ date, label, leagueGames, offNight }));
  const dayOf = new Map(editions.flatMap(edition => edition.days).map(day => [day.date, day]));
  const teams = [...new Map(editions.flatMap(edition => edition.teams).map(team => [team.id, team])).values()];
  const trusted = editions.every(edition => edition.source.state === "ready");
  const scored = teams.flatMap(team => {
    const own = counted.filter(game => game.homeTeam.id === team.id || game.awayTeam.id === team.id);
    if (!own.length) return [];
    const offNightGames = own.filter(game => dayOf.get(game.date)?.offNight).length;
    const score = calcWeekScore([], offNightGames, counted.length, own.length, own.map(game => dayOf.get(game.date)!.leagueGames), trusted);
    const onDay = (date: string) => own.filter(game => game.date === date);
    return [{ team, score, games: own.length, offNightGames, gamesByDay: days.map(day => onDay(day.date).length), opponentsByDay: days.map(day => onDay(day.date).map(game => (game.homeTeam.id === team.id ? game.awayTeam : game.homeTeam).abbreviation)) }];
  });
  // Rounded for the comparison only: sums over the same slates in another order differ by float noise, not by schedule.
  const ranked = competitionRanks(scored, row => Math.round(row.score * 1e6) / 1e6, row => row.team.abbreviation);
  const toRow = ({ row, rank }: typeof ranked[number]): OffNightScheduleRow => ({ team: row.team.abbreviation, teamName: row.team.name, rank, score: row.score, games: row.games, offNightGames: row.offNightGames, gamesByDay: row.gamesByDay, opponentsByDay: row.opponentsByDay });
  const top = ranked.slice(0, OFF_NIGHT_TEAMS), lastRank = top[top.length - 1]?.rank;
  return { days, countedGames: counted.length, teamsWithGames: ranked.length, rows: top.map(toRow), tiedOut: ranked.slice(OFF_NIGHT_TEAMS).filter(item => item.rank === lastRank).map(item => item.row.team.abbreviation) };
}

const NO_EXCLUSIONS: OffNightExclusions = { aboveCeiling: 0, unknownOwnership: 0, staleOwnership: 0, unavailable: 0, inactive: 0, sample: 0, identity: 0 };
/** Why a position came up empty, from what was excluded and why. */
export function offNightGapReason(group: OffNightGroup, excluded: OffNightExclusions, ceiling: number) {
  const parts = [[excluded.aboveCeiling, `over ${ceiling}%`], [excluded.unknownOwnership, "unknown %"], [excluded.staleOwnership, "stale %"], [excluded.unavailable, "unavailable"], [excluded.inactive, `no game in ${RECENT_MAX_AGE_DAYS} days`], [excluded.sample, "no complete game"], [excluded.identity, "no identity"]] as const;
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

type FormRow = Pick<SkaterAppearance, "goals" | "assists" | "ppPoints" | "shots" | "hits" | "blocks" | "toiSeconds" | "date">;
/** The score inputs over some complete games, as players.ts builds them. */
export function formOf(rows: readonly FormRow[], group: OffNightGroup) {
  const sum = (key: "goals" | "assists" | "ppPoints" | "shots" | "hits" | "blocks" | "toiSeconds") => rows.reduce((total, game) => total + game[key]!, 0);
  const recent = { kind: "skater" as const, games: rows.length, through: rows[rows.length - 1].date, goals: sum("goals"), assists: sum("assists"), points: sum("goals") + sum("assists"), shots: sum("shots"), hitsPerGame: sum("hits") / rows.length, blocksPerGame: sum("blocks") / rows.length, toiSeconds: sum("toiSeconds") / rows.length, ppPoints: sum("ppPoints") };
  return { recent, group };
}
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2); return sorted.length ? sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2 : Infinity; };
/** Unflagged first; then HOT, then the best score; a short sample only when no full sample is left. Ties: lower known %, then id. */
const pickOrder = (a: OffNightPick, b: OffNightPick) => Number(a.yahooStatus !== null) - Number(b.yahooStatus !== null) || Number(a.shortSample) - Number(b.shortSample) || Number(b.hot) - Number(a.hot) || b.score - a.score || (a.ownership.pct ?? 101) - (b.ownership.pct ?? 101) || a.nhlId - b.nhlId;

export type OffNightPoolEntry = OffNightPick & { group: OffNightGroup; baseline: number | null };
export type OffNightPool = { picks: Record<OffNightGroup, OffNightPoolEntry[]>; excluded: Record<OffNightGroup, OffNightExclusions> };
export type OffNightPoolInput = { appearances: readonly SkaterAppearance[]; yahoo: readonly OffNightYahooRow[]; map: readonly ShareMapRow[]; teams: readonly string[]; settings: Pick<OffNightSettings, "ownershipCeiling" | "includeUnknown">; today: string };
/**
 * Every skater on each wanted team who could be picked up, by position, with why the others were left out. Latest game's
 * team is the player's team now; earlier games stay bound to the team they were played for. Team Stream reads the same pools.
 */
export function offNightPools(input: OffNightPoolInput) {
  const { settings } = input, wanted = new Set(input.teams), identities = yahooByNhlId(input.yahoo, input.map);
  const yesterday = shiftDays(input.today, -1), activeSince = shiftDays(input.today, -RECENT_MAX_AGE_DAYS);
  const pools = new Map<string, OffNightPool>(input.teams.map(team => [team, { picks: { F: [], D: [] }, excluded: { F: { ...NO_EXCLUSIONS }, D: { ...NO_EXCLUSIONS } } }]));
  const ownership = { known: 0, unknown: 0, stale: 0, asOf: null as string | null }, diagnostics: OffNightDiagnostics = { statusOverridden: 0, unknownOwnership: 0 };
  // Each team's last games in the read, newest first: playing in one of them outranks a Yahoo flag.
  const teamGames = new Map<string, { gameId: number; date: string }[]>();
  for (const row of input.appearances) if (row.team) { const list = teamGames.get(row.team) ?? []; if (!list.some(game => game.gameId === row.gameId)) list.push({ gameId: row.gameId, date: row.date }); teamGames.set(row.team, list); }
  const playing = new Map([...teamGames].map(([team, games]) => [team, new Set([...games].sort((a, b) => b.date.localeCompare(a.date) || b.gameId - a.gameId).slice(0, OFF_NIGHT_PLAYING_GAMES).map(game => game.gameId))]));
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
    // A game with a missing stat is left out of the form, not counted as zero.
    const complete = games.filter(game => game.goals !== null && game.assists !== null && game.shots !== null && game.hits !== null && game.blocks !== null && game.ppPoints !== null && game.toiSeconds !== null);
    if (latest.date < activeSince) { excluded.inactive++; continue; }
    if (!complete.length) { excluded.sample++; continue; }
    const flagged = !PLAYABLE_STATUSES.has(yahoo.status ?? ""), played = games.some(game => playing.get(latest.team!)?.has(game.gameId));
    if (flagged && !played) { excluded.unavailable++; continue; }
    // Only skaters who could be picked count toward ownership evidence, so a stale bench row cannot block the post.
    const resolved = resolveOwnership({ ...yahoo, ownership_timeline: null }), asOf = yahoo.last_updated?.slice(0, 10) ?? null;
    if (!asOf || asOf < yesterday || asOf > input.today) { ownership.stale++; excluded.staleOwnership++; continue; }
    const owned = ownershipOf(resolved?.ownership, asOf);
    if (owned.state === "known") { ownership.known++; if (!ownership.asOf || asOf < ownership.asOf) ownership.asOf = asOf; } else { ownership.unknown++; diagnostics.unknownOwnership++; }
    if (!ownershipInRange(owned, 0, settings.ownershipCeiling, settings.includeUnknown === "on")) { if (owned.state === "known") excluded.aboveCeiling++; else excluded.unknownOwnership++; continue; }
    if (flagged) diagnostics.statusOverridden++;
    const window = lastN(complete, MIN_SKATER_GAMES).rows, earlier = complete.slice(0, complete.length - window.length), player = formOf(window, group);
    const baseline = earlier.length >= OFF_NIGHT_HOT_BASE_GAMES ? fantasyPointsPerGame(formOf(earlier, group)) : null;
    pool.picks[group].push({ nhlId, name: latest.name, positions: position.positions, group, ownership: owned, games: window.length, fantasyPerGame: fantasyPointsPerGame(player)!, score: playerScore(player)!, hot: false, shortSample: window.length < MIN_SKATER_GAMES, yahooStatus: flagged ? yahoo.status : null, baseline });
  }
  return { pools, ownership, diagnostics };
}

function selectPicks(input: OffNightPoolInput & { settings: OffNightSettings }) {
  const { settings } = input, { pools, ownership, diagnostics } = offNightPools(input);
  const medians = Object.fromEntries((["F", "D"] as const).map(group => [group, median([...pools.values()].flatMap(pool => pool.picks[group].filter(pick => !pick.shortSample).map(pick => pick.fantasyPerGame)))]));
  const best = (group: OffNightGroup, picks: OffNightPoolEntry[]) => picks.map(({ baseline, group: _group, ...pick }): OffNightPick => ({ ...pick, hot: !pick.shortSample && baseline !== null && pick.fantasyPerGame >= OFF_NIGHT_HOT_RATIO * baseline && pick.fantasyPerGame >= medians[group] })).sort(pickOrder)[0] ?? null;
  return { ownership, diagnostics, byTeam: new Map(input.teams.map(team => {
    const pool = pools.get(team)!, F = best("F", pool.picks.F), D = best("D", pool.picks.D);
    return [team, { picks: { F, D }, gaps: { F: F ? null : offNightGapReason("F", pool.excluded.F, settings.ownershipCeiling), D: D ? null : offNightGapReason("D", pool.excluded.D, settings.ownershipCeiling) } }] as const;
  })) };
}

const OWNERSHIP_TABLES = ["yahoo_players", "yahoo_nhl_player_map_read"] as const;
const scheduleSource = (editions: readonly SocialShareSnapshot[]): SharePostSource => {
  const last = editions[editions.length - 1];
  return { name: "NHL schedule (Game Grid edition)", tables: ["NHL schedule API"], state: editions.find(edition => edition.state !== "ready")?.state ?? "ready", asOf: last.weekEnd, updatedAt: last.source.updatedAt ?? last.source.fetchedAt, reasons: [...new Set(editions.flatMap(edition => edition.reasons))] };
};
const unready = (state: ShareDataState, reasons: string[], sources: SharePostSource[], sample: string): SharePostLoadResult<OffNightData> => {
  const evidence: SharePostEvidence = { sources, sample, strength: "All situations", cohort: "Not ranked", coverage: null };
  return { state, reasons, evidence, data: null };
};
/** A schedule edition that is not ready publishes no order and reads no players, as on the Monday cards. */
export const offNightScheduleGate = (input: OffNightEditions): SharePostLoadResult<OffNightData> | null => {
  const editions = editionsOf(input), edition = editions.find(item => item.state !== "ready" || item.source.state !== "ready");
  return edition ? unready(edition.state === "ready" ? edition.source.state : edition.state, edition.reasons.length ? edition.reasons : ["The schedule edition is not ready, so no order is published."], [scheduleSource(editions)], "Schedule not ready; no players read") : null;
};
/** Chosen dates with no games give a reason, not an empty ranking: ahead of today, the NHL may not have published them. */
export function offNightEmptyWindow(editions: readonly SocialShareSnapshot[], window: PeriodWindow, settings: OffNightSettings): SharePostLoadResult<OffNightData> | null {
  if (settings.period === OFF_NIGHT_THIS_WEEK || offNightSchedule(editions, "weekly").countedGames) return null;
  const reason = offNightUpcoming(window, editions[0].generatedAt) ? `The NHL schedule shows no games yet for ${window.label}, so there is no ranking. It may not be published.` : `The NHL schedule has no games for ${window.label}, so there is no ranking.`;
  return unready("missing", [reason], [scheduleSource(editions)], reason);
}
/** The chosen dates could not be resolved: nothing is read, and the reason prints. */
export const offNightPeriodMissing = (reasons: string[]) => unready("missing", reasons, [{ name: "Yahoo matchup weeks", tables: ["yahoo_matchup_weeks"], state: "ready", asOf: null, updatedAt: null }], reasons[0]);

/**
 * TJ's late-feed rule (2026-11-03): when only the newest nights lack skater rows, the form window ends at the last
 * complete night and the post stays exportable, with a page note. An older gap stays in the window and keeps it partial.
 */
export function offNightCompleteThrough<T extends { appearances: readonly SkaterAppearance[]; gameIds: readonly number[]; through: string }>(input: T, scheduled: readonly { id: number; date: string }[]): { input: T; pageNotes: string[]; unavailable?: true } {
  const dateOf = new Map(scheduled.map(game => [game.id, game.date]));
  // One entry per team with skater rows in a scheduled game.
  const reported = new Map(input.appearances.flatMap(row => row.team && dateOf.has(row.gameId) ? [[`${row.gameId}:${row.team}`, dateOf.get(row.gameId)!] as const] : []));
  const nights = countNights(teamGameDates(scheduled), reported.values());
  const result = completeThrough(nights, input.through), note = completeThroughNote(result);
  // No complete night at all: there is no form to judge pickups by.
  if (!result.through) return { input, pageNotes: [], unavailable: true };
  if (!note) return { input, pageNotes: [] };
  const through = result.through, kept = new Set(scheduled.filter(game => game.date <= through).map(game => game.id));
  return { input: { ...input, through, gameIds: input.gameIds.filter(id => kept.has(id)), appearances: input.appearances.filter(row => row.date <= through) }, pageNotes: [note] };
}

export function buildOffNightEdge(full: { edition: OffNightEditions; window: PeriodWindow; settings: OffNightSettings; appearances: readonly SkaterAppearance[]; yahoo: readonly OffNightYahooRow[]; map: readonly ShareMapRow[]; gameIds: readonly number[]; from: string; through: string;
  /** The regular-season games behind `gameIds`, with dates: given, a late newest night is cut rather than blocking export. */
  scheduled?: readonly { id: number; date: string }[] }): SharePostLoadResult<OffNightData> {
  const { input, pageNotes: lateNotes, unavailable } = full.scheduled ? offNightCompleteThrough(full, full.scheduled) : { input: full, pageNotes: [] };
  const { settings } = input, editions = editionsOf(input.edition), first = editions[0], last = editions[editions.length - 1];
  const gated = offNightScheduleGate(editions);
  if (gated) return gated;
  if (unavailable) {
    const reason = `No night from ${input.from} to ${input.through} is fully reported, so recent form cannot pick anyone.`;
    return unready("missing", [reason], [scheduleSource(editions), { name: "NHL.com game stats", tables: ["wgo_skater_stats", "games"], state: "missing", asOf: null, updatedAt: null }], reason);
  }
  const dates: OffNightDates = settings.period === OFF_NIGHT_THIS_WEEK ? settings.dates : "weekly";
  const schedule = offNightSchedule(editions, dates), today = editionDate(first.generatedAt);
  const window: OffNightWindow = { kind: input.window.kind, week: input.window.week, from: input.window.from, through: input.window.through, label: input.window.label, past: input.window.through < today, playedIncluded: dates === "weekly" && input.window.from < today && input.window.through >= today, upcoming: offNightUpcoming(input.window, first.generatedAt) };
  // Regular season only: the game ids come from `games` with type 2.
  const regular = new Set(input.gameIds), appearances = input.appearances.filter(row => regular.has(row.gameId));
  const { byTeam, ownership, diagnostics } = selectPicks({ appearances, yahoo: input.yahoo, map: input.map, teams: schedule.rows.map(row => row.team), settings, today });
  const asOf = appearances.reduce<string | null>((latest, row) => !latest || row.date > latest ? row.date : latest, null);
  const expected = input.gameIds.length * 2, observed = new Set(appearances.map(row => `${row.gameId}:${row.team}`)).size, missing = Math.max(0, expected - observed), complete = observed === expected;
  const statsSource: SharePostSource = { name: "NHL.com game stats", tables: ["wgo_skater_stats", "games"], state: complete ? "ready" : "partial", asOf, updatedAt: null };
  const judged = ownership.known + ownership.unknown + ownership.stale;
  const ownershipState: ShareDataState = !input.yahoo.length ? "missing" : judged && ownership.stale > ownership.known + ownership.unknown ? "stale" : ownership.stale ? "partial" : "ready";
  const ownershipSource: SharePostSource = { name: "Yahoo ownership", tables: OWNERSHIP_TABLES, state: ownershipState, asOf: ownership.asOf, updatedAt: null };
  const sources = [scheduleSource(editions), statsSource, ownershipSource];
  const sample = `${input.from} to ${input.through}: ${new Set(appearances.map(row => row.playerId)).size} skaters; picks played in the last ${RECENT_MAX_AGE_DAYS} days; HOT means L5 fantasy points per game at least ${OFF_NIGHT_HOT_RATIO}× his earlier games in this span and at or above his position's median, and comes first; then L5 fantasy points per game × ice time; under ${MIN_SKATER_GAMES} complete games is a short sample, used last; ownership among qualified skaters: ${ownership.known} known, ${ownership.unknown} unknown, ${ownership.stale} stale`;
  if (ownershipState === "missing") return unready("missing", ["Yahoo ownership returned no rows, so no pickups can be judged."], sources, sample);
  if (ownershipState === "stale") return unready("stale", [`Most Yahoo ownership is older than a day (${ownership.stale} of ${judged} qualified skaters).`], sources, sample);
  const reasons = [
    ...(complete ? [] : [`${missing} of ${expected} scheduled team games have no skater rows.`]),
    ...(ownership.stale ? [`${ownership.stale} qualified skaters have Yahoo ownership older than a day, so they are excluded.`] : []),
  ];
  const unknownNote = settings.includeUnknown === "on" ? "unknown % included" : "unknown % excluded";
  const rows = schedule.rows.map(row => ({ ...row, ...byTeam.get(row.team)! }));
  return {
    state: reasons.length ? "partial" : "ready", reasons,
    data: { dates, window, weekStart: first.weekStart, weekEnd: last.weekEnd, days: schedule.days, countedGames: schedule.countedGames, teamsWithGames: schedule.teamsWithGames, tiedOut: schedule.tiedOut, ownership,
      rows },
    // Opponents too: the day grid shows their logos, and the shell holds export until every listed logo is ready.
    teams: [...new Set(schedule.rows.flatMap(row => [row.team, ...row.opponentsByDay.flat()]))],
    pageNotes: [...lateNotes, ...offNightPageNotes(rows, diagnostics, settings)],
    // A puck drop or the schedule's freshness window ends this edition sooner than the default.
    ttlSeconds: Math.min(SHARE_POST_DEFAULT_TTL_SECONDS, Math.floor((Math.min(...editions.map(edition => Date.parse(edition.expiresAt!))) - Date.parse(first.generatedAt)) / 1000)),
    evidence: { sources, sample, strength: "All situations", cohort: `Top ${schedule.rows.length} of ${schedule.teamsWithGames} teams with games${schedule.tiedOut.length ? ` (also tied at the last rank: ${schedule.tiedOut.join(", ")})` : ""}; skaters at or under ${settings.ownershipCeiling}% rostered, ${unknownNote}`,
      coverage: { observed, expected, missing, unit: "team games" } },
  };
}

const pickText = (pick: OffNightPick | null) => pick ? `${pick.name} ${ownershipLabel(pick.ownership)}${pick.hot ? ", hot" : ""}${pick.shortSample ? `, short sample of ${pick.games}` : ""}` : "no pick";

export const offNightEdgeModule = defineShareModule<OffNightSettings, OffNightData>({
  id: "off-night-edge", title: "Off-Night Edge", summary: "Games by day and the top 16 Week Score teams, with one forward and one defenseman under an ownership ceiling.", group: "schedule", basis: "observed",
  suggestedUse: "Works for a Monday plan or a midweek rest-of-week post.",
  periodControl: OFF_NIGHT_CONTROL,
  validate: validateOffNight,
  fields: [
    { id: "ownershipCeiling", label: "Ownership ceiling %", kind: "number", default: 50, min: 0, max: 100, step: 1 },
    { id: "includeUnknown", label: "Include unknown ownership", kind: "select", default: "off", options: [{ value: "off", label: "Off" }, { value: "on", label: "On" }] },
    { id: "dates", label: "Dates", kind: "select", default: "rest-of-week", options: [{ value: "rest-of-week", label: "Rest of week" }, { value: "weekly", label: "Weekly" }], onlyForPeriod: OFF_NIGHT_THIS_WEEK },
    ...periodWindowFields({ mode: OFF_NIGHT_CONTROL.mode, default: OFF_NIGHT_THIS_WEEK, options: [{ value: OFF_NIGHT_THIS_WEEK, label: "This week" }, { value: "matchup", label: "Matchup week" }, { value: PERIOD_CUSTOM, label: "Custom range" }] }),
  ],
  load: () => import("./offNightEdge.sources").then(sources => sources.loadOffNightEdge),
  card: () => import("components/SocialShare/modules/OffNightEdgeCard").then(card => card.default),
  hasRows: data => data.rows.some(row => row.picks.F || row.picks.D),
  altText: (snapshot, data) => `${data.window.kind === OFF_NIGHT_THIS_WEEK ? `FHFH Off-Night Edge, ${data.dates === "weekly" ? "full week" : "rest of week"}, ${data.window.from} to ${data.window.through}` : `FHFH Off-Night Edge, ${data.window.label}`}${data.window.past ? ", past dates; picks and ownership are current, not as of then" : ""}${data.window.upcoming ? `, ${data.window.upcoming === "next-week" ? "next week" : "upcoming"}; picks use recent form and ownership as of today` : ""}. ${data.rows.map(row => `${row.rank}. ${row.team}: ${row.games} games, ${row.offNightGames} off-night, score ${row.score.toFixed(1)}; ${pickText(row.picks.F)}; ${pickText(row.picks.D)}`).join(". ")}. NHL games by day: ${data.days.map(day => `${day.label} ${day.leagueGames}${day.offNight ? " (off night)" : ""}`).join(", ")}. ${snapshot.evidence.cohort}. ${snapshot.evidence.sample}.`,
});
