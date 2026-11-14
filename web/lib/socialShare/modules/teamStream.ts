import type { EvDeploymentBucket, SpecialTeamsDeploymentBucket } from "lib/rankings/skaterDeploymentAggregation";
import { MIN_SKATER_GAMES, RECENT_MAX_AGE_DAYS, type ShareMapRow } from "lib/socialShare/players";
import { fantasyPointsPerGame, playerScore } from "lib/socialShare/score";
import type { ShareDataState, SocialShareSnapshot } from "lib/socialShare/types";
import { defineShareModule, SHARE_POST_DEFAULT_TTL_SECONDS, type SharePostEvidence, type SharePostLoadResult, type SharePostSource } from "./contract";
import { formOf, OFF_NIGHT_HOT_RATIO, OFF_NIGHT_THIS_WEEK, offNightCompleteThrough, offNightGapReason, offNightPageNotes, offNightPools, offNightSchedule, offNightScheduleGate, offNightUpcoming, resolveOffNightWindow, validateOffNight, type OffNightDates, type OffNightDay, type OffNightGroup, type OffNightPoolEntry, type OffNightSettings, type OffNightWindow, type OffNightYahooRow } from "./offNightEdge";
import { roleSlotReader, type RoleEvidence } from "./roleWatch";
import { editionDate, lastN, ownershipLabel, per60, previousN, type OwnershipState } from "./shared/definitions";
import { periodWindowFields, PERIOD_CUSTOM, type MatchupCalendar, type PeriodWindow, type PeriodWindowSettings } from "./shared/periodWindow";
import type { SkaterAppearance } from "./shared/skaterAppearances";
import type { NstCountRow } from "./whatChanged";

/**
 * Team Stream (TJ, 2026-11-06): the top Week Score teams for the chosen dates in a side rail, and one 1080 card for the
 * team picked there: its schedule, Week Score and rank, and three low-rostered skaters to stream. Window, score and
 * candidate pools are Off-Night Edge's; the team and how its skaters are ranked are browser-only, so a click never refetches.
 */
export const TEAM_STREAM_TEAMS = 8;
export const TEAM_STREAM_PLAYERS = 3;
/** Each window of form is five complete games: the last five, and the five before them for the delta. */
export const TEAM_STREAM_FORM_GAMES = MIN_SKATER_GAMES;
/** Days of games read per pool skater: enough for ten games through a two-week break. */
export const TEAM_STREAM_HISTORY_DAYS = 60;

export type TeamStreamFocus = "overall" | "peripherals" | "hits" | "blocks" | "pim" | "shots";
export type TeamStreamCategory = "hits" | "blocks" | "pim" | "shots";
export type TeamStreamMetric = "fp" | "points" | "ixg60" | "iscf60" | "icf60" | "sog60" | "toi" | "ppToi";
export type TeamStreamSettings = PeriodWindowSettings & { ownershipCeiling: number; includeUnknown: "on" | "off"; focus: TeamStreamFocus; metric: TeamStreamMetric; team: string };

export const TEAM_STREAM_FOCI: readonly { value: TeamStreamFocus; label: string; short: string }[] = [
  { value: "overall", label: "Best available, 1+ D", short: "Best available" },
  { value: "peripherals", label: "Peripherals (HIT, BLK, PIM, SOG)", short: "Peripherals" },
  { value: "hits", label: "Hits", short: "Hits" },
  { value: "blocks", label: "Blocks", short: "Blocks" },
  { value: "pim", label: "PIM", short: "PIM" },
  { value: "shots", label: "Shots", short: "Shots" },
];
export const TEAM_STREAM_CATEGORIES: readonly TeamStreamCategory[] = ["hits", "blocks", "pim", "shots"];
/** The delta's metric. `nst` metrics join NST game logs by player and date; a game without one leaves the window unknown. */
export const TEAM_STREAM_METRICS: readonly { value: TeamStreamMetric; label: string; digits: number; time?: true; nst?: true }[] = [
  { value: "fp", label: "FP/GP", digits: 1 },
  { value: "points", label: "PTS/GP", digits: 2 },
  { value: "ixg60", label: "ixG/60", digits: 2, nst: true },
  { value: "iscf60", label: "iSCF/60", digits: 1, nst: true },
  { value: "icf60", label: "iCF/60", digits: 1, nst: true },
  { value: "sog60", label: "SOG/60", digits: 1 },
  { value: "toi", label: "TOI/GP", digits: 0, time: true },
  { value: "ppToi", label: "PP TOI/GP", digits: 0, time: true },
];
const metricOf = (metric: TeamStreamMetric) => TEAM_STREAM_METRICS.find(entry => entry.value === metric) ?? TEAM_STREAM_METRICS[0];
export const focusOf = (focus: TeamStreamFocus) => TEAM_STREAM_FOCI.find(entry => entry.value === focus) ?? TEAM_STREAM_FOCI[0];

/** L5 totals as printed. PIM is null when a game in the five has no PIM row. */
export type TeamStreamTotals = { goals: number; assists: number; ppPoints: number; shots: number; pim: number | null; hits: number; blocks: number };
/** A metric over the last five and the five before them; null when a window is short or a game in it has no value. */
export type TeamStreamWindowValue = { l5: number | null; prior: number | null };
export type TeamStreamCandidate = {
  nhlId: number; name: string; positions: string; group: OffNightGroup; ownership: OwnershipState;
  /** Yahoo's IR, O or NA flag on a skater who played one of his team's last games (Off-Night's rule): ranked last. */
  yahooStatus: string | null;
  /** Complete games in the L5 window; under five is a short sample, ranked after full ones. */
  games: number; shortSample: boolean;
  /** L5 FP/GP at least Off-Night's HOT multiple of the five before and at or above his position's median here. */
  hot: boolean;
  /** L5 fantasy points per game × opportunity (line, PP unit, L5 TOI), as the pickups cards score. */
  score: number;
  totals: TeamStreamTotals;
  metrics: Record<TeamStreamMetric, TeamStreamWindowValue>;
  /** Mean percentile of L5 HIT, BLK, PIM and SOG per game among every skater in this edition, 0 to 1. */
  peripheral: number | null;
  /** Latest game's line or pair and PP unit; null when unknown or off the top two units. */
  role: { line: string | null; pp: 1 | 2 | null };
};
export type TeamStreamGame = { opponent: string; home: boolean | null; played: boolean };
export type TeamStreamTeam = {
  team: string; teamName: string; rank: number; score: number; games: number; offNightGames: number;
  /** Games per entry of `days`. */
  schedule: TeamStreamGame[][];
  candidates: TeamStreamCandidate[];
};
export type TeamStreamData = {
  window: OffNightWindow; days: OffNightDay[]; teams: TeamStreamTeam[]; teamsWithGames: number; countedGames: number;
  /** Equal scores cut by the top eight: they share its last rank. */
  tiedOut: string[];
  /** The last date the form windows include. */
  formThrough: string;
  ownership: { known: number; unknown: number; stale: number; asOf: string | null };
};

/** Off-Night's own window and pool settings: Team Stream's default period is its rest of week. */
export const asOffNightSettings = (settings: Pick<TeamStreamSettings, "period" | "week" | "start" | "end" | "ownershipCeiling" | "includeUnknown">): OffNightSettings => ({ period: settings.period, week: settings.week, start: settings.start, end: settings.end, ownershipCeiling: settings.ownershipCeiling, includeUnknown: settings.includeUnknown, dates: "rest-of-week" });
export const resolveTeamStreamWindow = (settings: TeamStreamSettings, calendar: MatchupCalendar, generatedAt: string) => resolveOffNightWindow(asOffNightSettings(settings), calendar, generatedAt);
/** Rest of week counts only what is left; a matchup week or custom range counts every game on its dates, as Off-Night does. */
export const teamStreamDates = (settings: Pick<TeamStreamSettings, "period">): OffNightDates => settings.period === OFF_NIGHT_THIS_WEEK ? "rest-of-week" : "weekly";

/** The selected team: the rail's choice when it is still in the top eight, else the top team. */
export const teamStreamSelected = (data: Pick<TeamStreamData, "teams">, settings: Pick<TeamStreamSettings, "team">) => data.teams.find(team => team.team === settings.team) ?? data.teams[0] ?? null;

/** "T1" when another team in the top eight, or one cut at its last rank, shares the rank. */
export const teamStreamRank = (data: Pick<TeamStreamData, "teams" | "tiedOut">, team: Pick<TeamStreamTeam, "team" | "rank">) => {
  const tied = data.teams.some(other => other.team !== team.team && other.rank === team.rank) || (data.tiedOut.length > 0 && team.rank === data.teams[data.teams.length - 1]?.rank);
  return `${tied ? "T" : ""}${team.rank}`;
};
const highFirst = (x: number | null, y: number | null) => x === y ? 0 : x === null ? 1 : y === null ? -1 : y - x;
const flaggedLast = (a: TeamStreamCandidate, b: TeamStreamCandidate) => Number(a.yahooStatus !== null) - Number(b.yahooStatus !== null) || Number(a.shortSample) - Number(b.shortSample);
/** Off-Night's order: unflagged, then full samples, then HOT, then score; ties go to the lower known %, then the id. */
const overallOrder = (a: TeamStreamCandidate, b: TeamStreamCandidate) => flaggedLast(a, b) || Number(b.hot) - Number(a.hot) || b.score - a.score || (a.ownership.pct ?? 101) - (b.ownership.pct ?? 101) || a.nhlId - b.nhlId;
export const categoryPerGame = (candidate: Pick<TeamStreamCandidate, "totals" | "games">, category: TeamStreamCategory) => {
  const total = candidate.totals[category];
  return total === null || !candidate.games ? null : total / candidate.games;
};
/**
 * The card's skaters. Best available keeps at least one defenseman (TJ, 2026-11-06): with none on merit, the best D takes the
 * last slot. A peripheral focus ranks by that category's L5 per game (or the peripheral percentile), unflagged and full samples first.
 */
export function teamStreamPicks(candidates: readonly TeamStreamCandidate[], focus: TeamStreamFocus, count = TEAM_STREAM_PLAYERS): TeamStreamCandidate[] {
  if (focus === "overall") {
    const sorted = [...candidates].sort(overallOrder), picks = sorted.slice(0, count), defenseman = sorted.find(candidate => candidate.group === "D");
    return picks.some(candidate => candidate.group === "D") || !defenseman || count < 1 ? picks : [...picks.slice(0, count - 1), defenseman];
  }
  const value = (candidate: TeamStreamCandidate) => focus === "peripherals" ? candidate.peripheral : categoryPerGame(candidate, focus);
  return [...candidates].sort((a, b) => flaggedLast(a, b) || highFirst(value(a), value(b)) || overallOrder(a, b)).slice(0, count);
}

/** Relative change of the last five against the five before; null without both or from zero. */
export const teamStreamDelta = ({ l5, prior }: TeamStreamWindowValue) => l5 === null || prior === null || prior <= 0 ? null : (l5 - prior) / prior;
export const deltaText = (delta: number | null) => delta === null ? "—" : `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${Math.abs(Math.round(delta * 100))}%`;
export const deltaTone = (delta: number | null) => delta === null || Math.round(delta * 100) === 0 ? "flat" : delta > 0 ? "up" : "down";
export function metricText(metric: TeamStreamMetric, value: number | null) {
  if (value === null) return "—";
  const entry = metricOf(metric);
  if (entry.time) { const whole = Math.round(value); return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`; }
  return value.toFixed(entry.digits);
}
export const metricLabel = (metric: TeamStreamMetric) => metricOf(metric).label;
export const roleChipText = (role: TeamStreamCandidate["role"]) => [...(role.line ? [role.line] : []), ...(role.pp ? [`PP${role.pp}`] : [])];

const COMPLETE_KEYS = ["goals", "assists", "shots", "hits", "blocks", "ppPoints", "toiSeconds"] as const;
/** Off-Night's complete game: a missing stat leaves the game out of the form rather than counting zero. */
const isComplete = (game: SkaterAppearance) => COMPLETE_KEYS.every(key => game[key] !== null);
type NstByGame = ReadonlyMap<string, NstCountRow>;
const nstKey = (playerId: number, date: string) => `${playerId}:${date}`;

/** One metric over some complete games; null when any game lacks the value, never a partial sum. */
export function metricValue(metric: TeamStreamMetric, rows: readonly SkaterAppearance[], group: OffNightGroup, nst: NstByGame): number | null {
  if (!rows.length) return null;
  const sum = (read: (game: SkaterAppearance) => number | null | undefined) => {
    let total = 0;
    for (const game of rows) { const value = read(game); if (value === null || value === undefined || !Number.isFinite(value)) return null; total += value; }
    return total;
  };
  const toi = sum(game => game.toiSeconds), nstSum = (key: "ixg" | "iscfs" | "icf") => sum(game => nst.get(nstKey(game.playerId, game.date))?.[key]);
  switch (metric) {
    case "fp": return fantasyPointsPerGame(formOf(rows, group));
    case "points": { const goals = sum(game => game.goals), assists = sum(game => game.assists); return goals === null || assists === null ? null : (goals + assists) / rows.length; }
    case "sog60": return per60(sum(game => game.shots), toi);
    case "toi": return toi === null ? null : toi / rows.length;
    case "ppToi": { const pp = sum(game => game.ppToiSeconds); return pp === null ? null : pp / rows.length; }
    case "ixg60": return per60(nstSum("ixg"), toi);
    case "iscf60": return per60(nstSum("iscfs"), toi);
    case "icf60": return per60(nstSum("icf"), toi);
  }
}

/** Each pool skater's newest game, regular season through the form cutoff: the role chips read only these games. */
export function teamStreamLatestGames(history: readonly SkaterAppearance[], scope: { gameIds: readonly number[]; through: string }) {
  const regular = new Set(scope.gameIds), latest = new Map<number, SkaterAppearance>();
  for (const game of history) if (regular.has(game.gameId) && game.date <= scope.through) { const seen = latest.get(game.playerId); if (!seen || game.date > seen.date || (game.date === seen.date && game.gameId > seen.gameId)) latest.set(game.playerId, game); }
  return latest;
}

type Built = Omit<TeamStreamCandidate, "hot" | "peripheral">;
function candidateOf(entry: OffNightPoolEntry, games: readonly SkaterAppearance[], latest: SkaterAppearance | undefined, nst: NstByGame, role: ReturnType<typeof roleSlotReader>): Built | null {
  const complete = games.filter(isComplete);
  if (!complete.length || !latest) return null;
  const l5 = lastN(complete, TEAM_STREAM_FORM_GAMES).rows, prior = previousN(complete, l5.length, TEAM_STREAM_FORM_GAMES), priorRows = prior.rows.length === TEAM_STREAM_FORM_GAMES ? prior.rows : null;
  const slot = role(entry.nhlId, latest.gameId), line = slot.line === "unknown" ? null : slot.line, pp = slot.pp === 1 || slot.pp === 2 ? slot.pp : null;
  const form = formOf(l5, entry.group);
  const score = playerScore({ group: entry.group, recent: { ...form.recent, line: line as EvDeploymentBucket | null, ppUnit: (pp ? `PP${pp}` : null) as SpecialTeamsDeploymentBucket | null } }) ?? 0;
  const total = (key: "goals" | "assists" | "ppPoints" | "shots" | "hits" | "blocks") => l5.reduce((sum, game) => sum + game[key]!, 0);
  const pim = l5.every(game => game.penaltyMinutes !== null) ? l5.reduce((sum, game) => sum + game.penaltyMinutes!, 0) : null;
  const metrics = Object.fromEntries(TEAM_STREAM_METRICS.map(({ value }) => [value, { l5: metricValue(value, l5, entry.group, nst), prior: priorRows ? metricValue(value, priorRows, entry.group, nst) : null }])) as Record<TeamStreamMetric, TeamStreamWindowValue>;
  return { nhlId: entry.nhlId, name: entry.name, positions: entry.positions, group: entry.group, ownership: entry.ownership, yahooStatus: entry.yahooStatus, games: l5.length, shortSample: l5.length < TEAM_STREAM_FORM_GAMES, score,
    totals: { goals: total("goals"), assists: total("assists"), ppPoints: total("ppPoints"), shots: total("shots"), pim, hits: total("hits"), blocks: total("blocks") }, metrics, role: { line, pp } };
}
const median = (values: readonly number[]) => { const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2); return sorted.length ? sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2 : Infinity; };
/** Share of the values below this one, ties counting half: 0 is the lowest here, near 1 the highest. */
const percentile = (values: readonly number[], value: number) => values.length ? (values.filter(other => other < value).length + 0.5 * values.filter(other => other === value).length) / values.length : null;
/** HOT and the peripheral percentile compare every skater in the edition, so they are set once all are built. */
function finishCandidates(built: readonly Built[]): TeamStreamCandidate[] {
  const medians = Object.fromEntries((["F", "D"] as const).map(group => [group, median(built.filter(row => row.group === group && !row.shortSample && row.metrics.fp.l5 !== null).map(row => row.metrics.fp.l5!))]));
  const pools = Object.fromEntries(TEAM_STREAM_CATEGORIES.map(category => [category, built.flatMap(row => { const value = categoryPerGame(row, category); return value === null ? [] : [value]; })]));
  return built.map(row => {
    const { l5, prior } = row.metrics.fp;
    const hot = !row.shortSample && l5 !== null && prior !== null && l5 >= OFF_NIGHT_HOT_RATIO * prior && l5 >= medians[row.group];
    const parts = TEAM_STREAM_CATEGORIES.flatMap(category => { const value = categoryPerGame(row, category), share = value === null ? null : percentile(pools[category], value); return share === null ? [] : [share]; });
    return { ...row, hot, peripheral: parts.length ? parts.reduce((sum, part) => sum + part, 0) / parts.length : null };
  });
}

/** Off-Night's Week Score order cut to the top eight, with each game's side and whether it has started. */
export function teamStreamSchedule(editions: readonly SocialShareSnapshot[], dates: OffNightDates) {
  const schedule = offNightSchedule(editions, dates), top = schedule.rows.slice(0, TEAM_STREAM_TEAMS), lastRank = top[top.length - 1]?.rank;
  const below = schedule.rows.slice(TEAM_STREAM_TEAMS), tiedOut = [...below.filter(row => row.rank === lastRank).map(row => row.team), ...(below.length && below[below.length - 1].rank === lastRank ? schedule.tiedOut : [])];
  const games = editions.flatMap(edition => edition.games);
  const gameOf = (date: string, team: string, opponent: string) => games.find(game => game.date === date && [game.homeTeam.abbreviation, game.awayTeam.abbreviation].sort().join() === [team, opponent].sort().join());
  const rows = top.map(row => ({ team: row.team, teamName: row.teamName, rank: row.rank, score: row.score, games: row.games, offNightGames: row.offNightGames,
    schedule: row.opponentsByDay.map((opponents, index) => opponents.map((opponent): TeamStreamGame => { const game = gameOf(schedule.days[index].date, row.team, opponent); return { opponent, home: game ? game.homeTeam.abbreviation === row.team : null, played: game ? game.status === "live" || game.status === "final" : false }; })) }));
  return { scoreVersion: schedule.scoreVersion, days: schedule.days, countedGames: schedule.countedGames, teamsWithGames: schedule.teamsWithGames, rows, tiedOut };
}

const OWNERSHIP_TABLES = ["yahoo_players", "yahoo_nhl_player_map_read"] as const;
const STATS_TABLES = ["wgo_skater_stats", "games", "lineCombinations", "powerPlayCombinations"] as const;
const scheduleSource = (editions: readonly SocialShareSnapshot[]): SharePostSource => {
  const last = editions[editions.length - 1];
  return { name: "NHL schedule (Game Grid edition)", tables: ["NHL schedule API"], state: editions.find(edition => edition.state !== "ready")?.state ?? "ready", asOf: last.weekEnd, updatedAt: last.source.updatedAt ?? last.source.fetchedAt, reasons: [...new Set(editions.flatMap(edition => edition.reasons))] };
};
/** Off-Night's refusals carry no data, so they are Team Stream's too. */
export const teamStreamRefusal = (result: SharePostLoadResult<unknown>): SharePostLoadResult<TeamStreamData> => ({ ...result, data: null });
const unready = (state: ShareDataState, reasons: string[], sources: SharePostSource[], sample: string): SharePostLoadResult<TeamStreamData> => {
  const evidence: SharePostEvidence = { sources, sample, strength: "All situations", cohort: "Not ranked", coverage: null };
  return { state, reasons, evidence, data: null };
};

export type TeamStreamInput = {
  edition: readonly SocialShareSnapshot[]; window: PeriodWindow; settings: TeamStreamSettings;
  /** Every skater's games in Off-Night's lookback: who is on each team and eligible. */
  appearances: readonly SkaterAppearance[]; yahoo: readonly OffNightYahooRow[]; map: readonly ShareMapRow[];
  /** Regular-season games in the lookback, and with dates when a late newest night should be cut rather than block export. */
  gameIds: readonly number[]; scheduled?: readonly { id: number; date: string }[]; from: string; through: string;
};
export type TeamStreamStage = {
  editions: readonly SocialShareSnapshot[]; settings: TeamStreamSettings; window: OffNightWindow; dates: OffNightDates;
  schedule: ReturnType<typeof teamStreamSchedule>; pools: ReturnType<typeof offNightPools>["pools"]; ownership: TeamStreamData["ownership"];
  diagnostics: ReturnType<typeof offNightPools>["diagnostics"]; lateNotes: string[]; from: string; formThrough: string;
  /** Pool skaters, for the history, NST and role reads. */
  ids: number[]; observed: number; expected: number; statsAsOf: string | null; skaters: number;
};

/**
 * First half of the build, before the per-skater reads: the schedule gate, Off-Night's late-feed cut, the top eight, and
 * their pools. An unusable edition ends here with its reason, so no further rows are read.
 */
export function teamStreamPool(full: TeamStreamInput): { result: SharePostLoadResult<TeamStreamData> } | { stage: TeamStreamStage } {
  const { input, pageNotes: lateNotes, unavailable } = full.scheduled ? offNightCompleteThrough(full, full.scheduled) : { input: full, pageNotes: [] };
  const editions = input.edition, first = editions[0], { settings } = input;
  const gated = offNightScheduleGate(editions);
  if (gated) return { result: teamStreamRefusal(gated) };
  if (unavailable) {
    const reason = `No night from ${input.from} to ${input.through} is fully reported, so recent form cannot pick anyone.`;
    return { result: unready("missing", [reason], [scheduleSource(editions), { name: "NHL.com game stats", tables: STATS_TABLES, state: "missing", asOf: null, updatedAt: null }], reason) };
  }
  const dates = teamStreamDates(settings), schedule = teamStreamSchedule(editions, dates), today = editionDate(first.generatedAt);
  const window: OffNightWindow = { kind: input.window.kind, week: input.window.week, from: input.window.from, through: input.window.through, label: input.window.label, past: input.window.through < today, playedIncluded: dates === "weekly" && input.window.from < today && input.window.through >= today, upcoming: offNightUpcoming(input.window, first.generatedAt) };
  const regular = new Set(input.gameIds), appearances = input.appearances.filter(row => regular.has(row.gameId));
  const { pools, ownership, diagnostics } = offNightPools({ appearances, yahoo: input.yahoo, map: input.map, teams: schedule.rows.map(row => row.team), settings: asOffNightSettings(settings), today });
  const expected = input.gameIds.length * 2, observed = new Set(appearances.map(row => `${row.gameId}:${row.team}`)).size;
  const statsAsOf = appearances.reduce<string | null>((latest, row) => !latest || row.date > latest ? row.date : latest, null);
  const judged = ownership.known + ownership.unknown + ownership.stale;
  const sources = [scheduleSource(editions), { name: "NHL.com game stats", tables: STATS_TABLES, state: observed === expected ? "ready" : "partial", asOf: statsAsOf, updatedAt: null } as SharePostSource, { name: "Yahoo ownership", tables: OWNERSHIP_TABLES, state: "missing", asOf: ownership.asOf, updatedAt: null } as SharePostSource];
  if (!input.yahoo.length) return { result: unready("missing", ["Yahoo ownership returned no rows, so no streamers can be judged."], sources, "No ownership read") };
  if (judged && ownership.stale > ownership.known + ownership.unknown) return { result: unready("stale", [`Most Yahoo ownership is older than a day (${ownership.stale} of ${judged} qualified skaters).`], sources.map(source => source.name === "Yahoo ownership" ? { ...source, state: "stale" } : source), "Ownership stale") };
  const ids = [...new Set([...pools.values()].flatMap(pool => [...pool.picks.F, ...pool.picks.D].map(entry => entry.nhlId)))].sort((a, b) => a - b);
  return { stage: { editions, settings, window, dates, schedule, pools, ownership, diagnostics, lateNotes, from: input.from, formThrough: input.through, ids, observed, expected, statsAsOf, skaters: new Set(appearances.map(row => row.playerId)).size } };
}

export type TeamStreamReads = {
  /** Pool skaters' games over `TEAM_STREAM_HISTORY_DAYS`, and the regular-season game ids in that span. */
  history: readonly SkaterAppearance[]; historyGameIds: readonly number[];
  /** Null when the read failed: NST metrics stay unknown and a page note says so. */
  nst: readonly NstCountRow[] | null;
  /** Null when the read failed: no role chips, and a page note says so. */
  role: RoleEvidence | null;
};
export function buildTeamStream(stage: TeamStreamStage, reads: TeamStreamReads): SharePostLoadResult<TeamStreamData> {
  const { settings, editions, schedule, ownership } = stage, first = editions[0];
  const regular = new Set(reads.historyGameIds), history = reads.history.filter(game => regular.has(game.gameId) && game.date <= stage.formThrough);
  const byPlayer = new Map<number, SkaterAppearance[]>();
  for (const game of history) { const list = byPlayer.get(game.playerId); if (list) list.push(game); else byPlayer.set(game.playerId, [game]); }
  for (const list of byPlayer.values()) list.sort((a, b) => a.date.localeCompare(b.date) || a.gameId - b.gameId);
  const latest = teamStreamLatestGames(history, { gameIds: reads.historyGameIds, through: stage.formThrough });
  const nst = new Map((reads.nst ?? []).map(row => [nstKey(row.player_id, row.date_scraped), row]));
  const role = roleSlotReader(reads.role ?? { rolling: [], pp: [] });
  const built = schedule.rows.map(row => {
    const pool = stage.pools.get(row.team);
    return { row, built: pool ? [...pool.picks.F, ...pool.picks.D].flatMap(entry => { const candidate = candidateOf(entry, byPlayer.get(entry.nhlId) ?? [], latest.get(entry.nhlId), nst, role); return candidate ? [candidate] : []; }) : [] };
  });
  const finished = finishCandidates(built.flatMap(item => item.built)), byId = new Map(finished.map(candidate => [candidate.nhlId, candidate]));
  const teams: TeamStreamTeam[] = built.map(({ row, built: list }) => ({ ...row, candidates: list.map(candidate => byId.get(candidate.nhlId)!) }));
  const nstPlayers = new Set((reads.nst ?? []).map(row => row.player_id)), nstAsOf = (reads.nst ?? []).reduce<string | null>((max, row) => !max || row.date_scraped > max ? row.date_scraped : max, null);
  const ownershipState: ShareDataState = ownership.stale ? "partial" : "ready", complete = stage.observed === stage.expected, missing = Math.max(0, stage.expected - stage.observed);
  const sources: SharePostSource[] = [scheduleSource(editions),
    { name: "NHL.com game stats", tables: STATS_TABLES, state: complete && reads.role ? "ready" : "partial", asOf: stage.statsAsOf, updatedAt: null },
    { name: "Yahoo ownership", tables: OWNERSHIP_TABLES, state: ownershipState, asOf: ownership.asOf, updatedAt: null },
    { name: "NST game logs", tables: ["nst_gamelog_as_counts"], state: !reads.nst ? "missing" : stage.ids.every(id => nstPlayers.has(id)) ? "ready" : "partial", asOf: nstAsOf, updatedAt: null }];
  const reasons = [
    ...(complete ? [] : [`${missing} of ${stage.expected} scheduled team games have no skater rows.`]),
    ...(ownership.stale ? [`${ownership.stale} qualified skaters have Yahoo ownership older than a day, so they are excluded.`] : []),
  ];
  const emptyTeams = teams.filter(team => !team.candidates.length).map(team => { const pool = stage.pools.get(team.team); return pool ? `${team.team}: no streamer qualifies (${offNightGapReason("F", pool.excluded.F, settings.ownershipCeiling)}; ${offNightGapReason("D", pool.excluded.D, settings.ownershipCeiling)}).` : `${team.team}: no streamer qualifies.`; });
  const noDefense = teams.filter(team => team.candidates.length && !team.candidates.some(candidate => candidate.group === "D")).map(team => `${team.team} has no defenseman under the ceiling, so Best available shows forwards only.`);
  const pageNotes = [...stage.lateNotes, ...emptyTeams, ...noDefense, ...offNightPageNotes([], stage.diagnostics, settings),
    ...(!reads.nst ? ["NST game logs could not be read, so ixG/60, iSCF/60 and iCF/60 show —."] : []),
    ...(!reads.role ? ["Line and power-play roles could not be read, so the card has no role chips."] : [])];
  const sample = `${stage.from} to ${stage.formThrough}: ${stage.skaters} skaters; ${finished.length} streamers in the top ${teams.length}; skaters who played in the last ${RECENT_MAX_AGE_DAYS} days; L5 is the last ${TEAM_STREAM_FORM_GAMES} complete games and the delta compares them with the ${TEAM_STREAM_FORM_GAMES} before; ranked as Off-Night Edge: HOT (L5 FP/GP at least ${OFF_NIGHT_HOT_RATIO}× the five before and at or above his position's median) first, then L5 fantasy points per game × opportunity; ownership among qualified skaters: ${ownership.known} known, ${ownership.unknown} unknown, ${ownership.stale} stale`;
  return {
    state: reasons.length ? "partial" : "ready", reasons,
    data: { window: stage.window, days: schedule.days, teams, teamsWithGames: schedule.teamsWithGames, countedGames: schedule.countedGames, tiedOut: schedule.tiedOut, formThrough: stage.formThrough, ownership },
    // Opponents too: the rail shows their logos, and any team can be picked in the browser.
    teams: [...new Set(teams.flatMap(team => [team.team, ...team.schedule.flat().map(game => game.opponent)]))],
    pageNotes,
    ttlSeconds: Math.min(SHARE_POST_DEFAULT_TTL_SECONDS, Math.floor((Math.min(...editions.map(edition => Date.parse(edition.expiresAt!))) - Date.parse(first.generatedAt)) / 1000)),
    evidence: { sources, sample, strength: "All situations",
      cohort: `Top ${teams.length} of ${schedule.teamsWithGames} teams with games${schedule.tiedOut.length ? ` (also tied at the last rank: ${schedule.tiedOut.join(", ")})` : ""}; skaters at or under ${settings.ownershipCeiling}% rostered, unknown % ${settings.includeUnknown === "on" ? "included" : "excluded"}`,
      coverage: { observed: stage.observed, expected: stage.expected, missing, unit: "team games" } },
  };
}

const pickText = (candidate: TeamStreamCandidate, metric: TeamStreamMetric) => {
  const { totals } = candidate, value = candidate.metrics[metric];
  return `${candidate.name} (${candidate.positions}, ${ownershipLabel(candidate.ownership)} rostered${candidate.hot ? ", hot" : ""}${roleChipText(candidate.role).length ? `, ${roleChipText(candidate.role).join(" ")}` : ""}): last ${candidate.games} games ${totals.goals} G, ${totals.assists} A, ${totals.ppPoints} PPP, ${totals.shots} SOG, ${totals.pim ?? "unknown"} PIM, ${totals.hits} HIT, ${totals.blocks} BLK; ${metricLabel(metric)} ${metricText(metric, value.l5)} against ${metricText(metric, value.prior)} the five before, ${deltaText(teamStreamDelta(value))}`;
};

export const teamStreamModule = defineShareModule<TeamStreamSettings, TeamStreamData>({
  id: "team-stream", title: "Team Stream", summary: "One top Week Score team's schedule and three low-rostered skaters to stream, with recent form and role.", group: "schedule", basis: "observed",
  suggestedUse: "Pick a team in the rail for a Monday plan or a midweek rest-of-week post.",
  headline: settings => settings.focus && settings.focus !== "overall" ? `Team Stream · ${focusOf(settings.focus).short}` : "Team Stream",
  periodControl: { mode: "any-week" },
  validate: settings => validateOffNight(asOffNightSettings(settings)),
  fields: [
    { id: "ownershipCeiling", label: "Ownership ceiling %", kind: "number", default: 50, min: 0, max: 100, step: 1 },
    { id: "includeUnknown", label: "Include unknown ownership", kind: "select", default: "off", options: [{ value: "off", label: "Off" }, { value: "on", label: "On" }] },
    { id: "focus", label: "Streamers", kind: "select", default: "overall", options: TEAM_STREAM_FOCI.map(({ value, label }) => ({ value, label })), clientOnly: true },
    { id: "metric", label: "Delta metric", kind: "select", default: "fp", options: TEAM_STREAM_METRICS.map(({ value, label }) => ({ value, label })), clientOnly: true },
    { id: "team", label: "Team", kind: "text", default: "", maxLength: 3, clientOnly: true, panelOnly: true },
    ...periodWindowFields({ mode: "any-week", default: OFF_NIGHT_THIS_WEEK, options: [{ value: OFF_NIGHT_THIS_WEEK, label: "Rest of week" }, { value: "matchup", label: "Matchup week" }, { value: PERIOD_CUSTOM, label: "Custom range" }] }),
  ],
  load: () => import("./teamStream.sources").then(sources => sources.loadTeamStream),
  card: () => import("components/SocialShare/modules/TeamStreamCard").then(card => card.default),
  panel: () => import("components/SocialShare/modules/TeamStreamPanel").then(panel => panel.default),
  hasRows: (data, settings) => { const team = teamStreamSelected(data, settings); return !!team && teamStreamPicks(team.candidates, settings.focus).length > 0; },
  altText: (snapshot, data, settings) => {
    const team = teamStreamSelected(data, settings);
    if (!team) return `FHFH Team Stream, ${data.window.label}: no team has a game in these dates.`;
    const days = data.days.map((day, index) => `${day.label} ${team.schedule[index]?.length ? team.schedule[index].map(game => `${game.home === false ? "at" : "vs"} ${game.opponent}`).join(" and ") : "no game"}${day.offNight ? " (off night)" : ""}`).join(", ");
    const picks = teamStreamPicks(team.candidates, settings.focus);
    return `FHFH Team Stream, ${data.window.label}, ${focusOf(settings.focus).short.toLowerCase()}${data.window.past ? ", past dates; streamers and ownership are current, not as of then" : ""}. ${team.teamName}: Week Score ${team.score.toFixed(1)}, ${teamStreamRank(data, team).startsWith("T") ? "tied for " : ""}rank ${team.rank} of ${data.teamsWithGames}, ${team.games} games, ${team.offNightGames} on off nights. ${days}. Streamers: ${picks.length ? picks.map(candidate => pickText(candidate, settings.metric)).join(". ") : "none qualify"}. ${snapshot.evidence.cohort}.`;
  },
});
