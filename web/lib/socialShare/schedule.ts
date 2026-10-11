import { DAYS, type WeekData } from "lib/NHL/types";
import { teamsInfo, activeTeamAbbreviations } from "lib/teamsInfo";
import { planningScheduleStatus } from "lib/rosterScheduleData/normalize";
import { localDate } from "lib/rosterScheduleOptimizer/planningDates";
import calcWeekScore from "components/GameGrid/utils/calcWeekScore";
import { calcWeightedOffNights } from "components/GameGrid/utils/helper";
import { SHARE_TIME_ZONE, type ShareGame, type ShareTeam, type SocialScheduleData, type SocialScheduleGame, type SocialShareFormat, type SocialShareSnapshot } from "./types";

export function assertCalendarDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error("Use a real YYYY-MM-DD calendar date.");
  return date;
}
export function weekDates(weekStart: string): string[] {
  assertCalendarDate(weekStart);
  const start = Date.parse(`${weekStart}T00:00:00Z`);
  if (new Date(start).getUTCDay() !== 1) throw new Error("weekStart must be a Monday.");
  return Array.from({ length: 7 }, (_, i) => new Date(start + i * 86400000).toISOString().slice(0, 10));
}
export function calendarWeekStart(asOfIso: string): string {
  if (!Number.isFinite(Date.parse(asOfIso))) throw new Error("Invalid as-of timestamp.");
  const date = localDate(asOfIso, SHARE_TIME_ZONE);
  const time = Date.parse(`${date}T00:00:00Z`);
  const offset = (new Date(time).getUTCDay() + 6) % 7;
  return new Date(time - offset * 86400000).toISOString().slice(0, 10);
}
function selectedWeekDates(weekStart: string, selected: string[]): string[] {
  const dates = weekDates(weekStart);
  if (new Set(selected).size !== selected.length || selected.some(date => !dates.includes(assertCalendarDate(date)))) throw new Error("Selected dates must be unique dates within the selected week.");
  return dates.filter(date => selected.includes(date));
}
function currentSeason(weekStart: string): number {
  const year = Number(weekStart.slice(0, 4)) - (Number(weekStart.slice(5, 7)) < 8 ? 1 : 0);
  return year * 10000 + year + 1;
}
function timestamp(value: string | null | undefined): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  try { assertCalendarDate(value.slice(0, 10)); } catch { return null; }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}
const staticTeams: ShareTeam[] = [...activeTeamAbbreviations].map(abbreviation => ({ id: teamsInfo[abbreviation].id, abbreviation: String(abbreviation), name: teamsInfo[abbreviation].name }));
function publicTeam(team: SocialScheduleGame["homeTeam"]): ShareTeam {
  const known = staticTeams.find(item => item.id === team.id);
  const abbreviation = team.abbrev ?? known?.abbreviation;
  if (!Number.isSafeInteger(team.id) || team.id <= 0 || !abbreviation || !/^[A-Z]{3}$/.test(abbreviation)) throw new Error("Invalid source team identity.");
  if (known && known.abbreviation !== abbreviation) throw new Error("Conflicting source team identity.");
  if (!known && !((team.id === 53 && abbreviation === "ARI") || (team.id === 59 && abbreviation === "UTA"))) throw new Error("Unsupported source team identity.");
  return { id: team.id, abbreviation, name: team.name || known?.name || abbreviation };
}
function editionId(snapshot: SocialShareSnapshot): string {
  // Content fingerprint, not a security identifier.
  const content = JSON.stringify([snapshot.format, snapshot.weekStart, snapshot.generatedAt, snapshot.source, snapshot.games, snapshot.selectedDates]);
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++) hash = Math.imul(hash ^ content.charCodeAt(i), 16777619);
  return `schedule-${(hash >>> 0).toString(16)}`;
}
export function selectScheduleDates(snapshot: SocialShareSnapshot, selectedDates: string[]): SocialShareSnapshot {
  const selected = selectedWeekDates(snapshot.weekStart, selectedDates);
  const asOf = Date.parse(snapshot.generatedAt);
  const reasons = [...snapshot.source.reasons];
  const regular = snapshot.games.filter(game => game.gameType === 2);
  const remaining = regular.filter(game => selected.includes(game.date) && game.status === "scheduled" && game.startTimeUtc !== null && Date.parse(game.startTimeUtc) > asOf);
  for (const game of regular) {
    if (selected.includes(game.date) && (game.status === "unknown" || (game.status === "scheduled" && !game.startTimeUtc))) reasons.push(`Game ${game.id} has an unknown start or state on a selected date.`);
  }
  const days = weekDates(snapshot.weekStart).map((date, i) => {
    // Full eligible daily slate, independent of selected dates and elapsed games.
    const leagueGames = regular.filter(game => game.date === date && ["scheduled", "live", "final"].includes(game.status)).length;
    return { date, label: DAYS[i], leagueGames, offNight: leagueGames <= 8, selected: selected.includes(date) };
  });
  let expiresAt: string | null = null;
  let state = snapshot.source.state;
  if (state === "ready" && reasons.length) state = "partial";
  const fetched = snapshot.source.fetchedAt ? Date.parse(snapshot.source.fetchedAt) : NaN;
  const updated = snapshot.source.updatedAt ? Date.parse(snapshot.source.updatedAt) : null;
  if (!Number.isFinite(fetched) || fetched > asOf || (updated !== null && updated > asOf)) {
    state = "missing";
    reasons.push("Schedule provenance is missing or in the future.");
  } else {
    const sixHours = 6 * 3600000;
    const soon = remaining.some(game => Date.parse(game.startTimeUtc!) - asOf <= sixHours);
    let expiry = fetched + (soon ? 15 * 60000 : sixHours);
    // An edition cannot cross either a puck drop or the tighter freshness window.
    for (const game of remaining) {
      const start = Date.parse(game.startTimeUtc!);
      expiry = Math.min(expiry, start, start - sixHours <= asOf ? Infinity : Math.max(start - sixHours, fetched + 15 * 60000));
    }
    expiresAt = new Date(expiry).toISOString();
    if (expiry <= asOf) { state = "stale"; reasons.push("Schedule read is older than the applicable freshness limit."); }
  }
  if (!["game-grid", "remaining-week"].includes(snapshot.format)) { state = "blocked"; reasons.push("This format requires ownership or player evidence that is not available in this schedule-only edition."); }
  const rows = snapshot.teams.map(team => {
    const games = snapshot.games.filter(game => game.homeTeam.id === team.id || game.awayTeam.id === team.id);
    const opportunities = remaining.filter(game => game.homeTeam.id === team.id || game.awayTeam.id === team.id);
    const matchUps: WeekData = {};
    // Sum per-game helper contributions so unusual doubleheaders remain countable.
    let weightedOffNights = 0;
    for (const game of opportunities) {
      const day = DAYS[days.findIndex(item => item.date === game.date)];
      matchUps[day] = { id: game.id, season: game.season, gameType: 2, homeTeam: { id: game.homeTeam.id }, awayTeam: { id: game.awayTeam.id } };
      weightedOffNights += calcWeightedOffNights({ [day]: matchUps[day] }, days.map(item => item.leagueGames));
    }
    const offNightGames = opportunities.filter(game => days.find(day => day.date === game.date)?.offNight).length;
    const slateCounts = opportunities.map(game => days.find(day => day.date === game.date)!.leagueGames);
    return { team, rank: 0, score: calcWeekScore([], offNightGames, remaining.length, opportunities.length, slateCounts, snapshot.source.state === "ready"), remainingGames: opportunities.length, offNightGames, weightedOffNights, games };
  }).sort((a, b) => b.score - a.score || a.team.abbreviation.localeCompare(b.team.abbreviation) || a.team.id - b.team.id).map((row, i) => ({ ...row, rank: i + 1 }));
  const result = { ...snapshot, selectedDates: selected, state, reasons: [...new Set(reasons)], days, rows, expiresAt };
  result.id = editionId(result);
  return result;
}

export function buildScheduleSnapshot(input: { format: SocialShareFormat; weekStart: string; schedule: SocialScheduleData; generatedAt: string; selectedDates?: string[] }): SocialShareSnapshot {
  const dates = weekDates(input.weekStart);
  const generatedAt = timestamp(input.generatedAt);
  if (!generatedAt) throw new Error("Invalid generatedAt timestamp.");
  const coveredDates = [...new Set(input.schedule.coveredDates ?? [])].filter(date => dates.includes(date)).sort();
  const reasons: string[] = [];
  if (coveredDates.length !== 7) reasons.push("Upstream schedule does not cover all seven dates.");
  // October exposes team/day copies. Unique game counts below must reconcile
  // before those indexed records can qualify as a complete schedule edition.
  // Reader retrieval is a check time, never the provider's update timestamp.
  const fetchedAt = timestamp(input.schedule.fetchedAt ?? input.schedule.retrievedAt);
  const updatedAt = timestamp(input.schedule.updatedAt);
  if (input.schedule.updatedAt && !updatedAt) reasons.push("Invalid provider update timestamp.");
  const records: SocialScheduleGame[] = input.schedule.games ?? Object.values(input.schedule.data).flatMap(week => Object.values(week)).filter((game): game is SocialScheduleGame => !!game);
  const gamesById = new Map<number, ShareGame>();
  const rejectedIds = new Set<number>();
  for (const raw of records) {
    try {
      if (!Number.isSafeInteger(raw.id) || raw.id <= 0 || raw.season !== currentSeason(input.weekStart) || !Number.isSafeInteger(raw.gameType) || !raw.gameDate || !dates.includes(assertCalendarDate(raw.gameDate))) throw new Error("Invalid game identity, date, type or season.");
      const startTimeUtc = timestamp(raw.startTimeUTC);
      if (raw.startTimeUTC && !startTimeUtc) throw new Error("Invalid start timestamp.");
      if (startTimeUtc && localDate(startTimeUtc, SHARE_TIME_ZONE) !== raw.gameDate) throw new Error("Start time falls outside the source calendar date.");
      const homeTeam = publicTeam(raw.homeTeam), awayTeam = publicTeam(raw.awayTeam);
      if (homeTeam.id === awayTeam.id) throw new Error("Identical opponent identities.");
      const game: ShareGame = { id: raw.id, season: raw.season, gameType: raw.gameType!, date: raw.gameDate, startTimeUtc, status: planningScheduleStatus(raw.gameState ?? "", raw.gameScheduleState ?? "") ?? "unknown", homeTeam, awayTeam };
      const prior = gamesById.get(game.id);
      if (prior && JSON.stringify(prior) !== JSON.stringify(game)) throw new Error("Conflicting records for game ID.");
      if (!rejectedIds.has(game.id)) gamesById.set(game.id, game);
    } catch {
      reasons.push(`Invalid or conflicting source game ${raw.id}.`);
      rejectedIds.add(raw.id); gamesById.delete(raw.id);
    }
  }
  const games = [...gamesById.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  if (input.schedule.numGamesPerDay.length !== 7 || dates.some((date, i) => !Number.isSafeInteger(input.schedule.numGamesPerDay[i]) || input.schedule.numGamesPerDay[i] < 0 || games.filter(game => game.date === date).length !== input.schedule.numGamesPerDay[i])) reasons.push("Declared source daily game counts do not reconcile with the complete game records.");
  const teams = [...staticTeams];
  for (const game of games) for (const team of [game.homeTeam, game.awayTeam]) if (!teams.some(item => item.id === team.id)) teams.push(team);
  const snapshot: SocialShareSnapshot = { schemaVersion: 1, id: "", format: input.format, state: "ready", reasons: [], generatedAt, expiresAt: null, timeZone: SHARE_TIME_ZONE, weekStart: input.weekStart, weekEnd: dates[6], selectedDates: [], basis: "schedule_only", source: { name: "NHL schedule", fetchedAt, updatedAt, coveredDates, state: reasons.length ? "partial" : "ready", reasons }, days: [], teams, games, rows: [] };
  return selectScheduleDates(snapshot, input.selectedDates ?? (input.format === "remaining-week" ? dates.slice(3) : dates));
}
