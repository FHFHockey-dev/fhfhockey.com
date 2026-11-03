import { currentSeason } from "lib/socialShare/schedule";
import { teamsInfo } from "lib/teamsInfo";
import { defineShareModule, type SharePostLoadResult } from "./contract";
import { completeThrough, completeThroughNote, countNights, teamGameDates, type NightCoverage } from "./shared/completeThrough";
import { competitionRanks, editionDate } from "./shared/definitions";
import { customRangeReason, PERIOD_CUSTOM, periodDates, periodWindowFields, resolvePeriodWindow, type MatchupCalendar, type PeriodControl, type PeriodWindowResult, type PeriodWindowSettings } from "./shared/periodWindow";

/** The seam's example post (SS 1.0): each team's completed games over the last N days. Small on purpose. */
export type TeamGamesSettings = PeriodWindowSettings & { days: number };
export type TeamGamesRow = { team: string; games: number; lastGame: string | null; rank: number };
export type TeamGamesData = { from: string; through: string; label: string; rows: TeamGamesRow[] };
export type TeamGameInput = { team_id: number | null; game_id: number | null; date: string };

export const shiftDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
/** Through yesterday in New York: today's games may not be final. */
export function teamGamesWindow(generatedAt: string, days: number) {
  const through = shiftDays(editionDate(generatedAt), -1);
  return { from: shiftDays(through, 1 - days), through, season: currentSeason(through) };
}
/** The period option for the rolling `days` window, the default. Needs no matchup calendar. */
export const TEAM_GAMES_ROLLING = "rolling";
export const TEAM_GAMES_CONTROL: PeriodControl = { mode: "past-only" };
export function resolveTeamGamesWindow(settings: TeamGamesSettings, calendar: MatchupCalendar, generatedAt: string): PeriodWindowResult {
  const rolling = teamGamesWindow(generatedAt, settings.days), resolved = resolvePeriodWindow(settings, calendar, { ...TEAM_GAMES_CONTROL, cutoff: rolling.through, own: { [TEAM_GAMES_ROLLING]: () => ({ from: rolling.from, through: rolling.through, label: `Last ${settings.days === 1 ? "day" : `${settings.days} days`} · ${periodDates(rolling.from, rolling.through)}` }) } });
  // A week under way counts through the last completed games; its later games are not missing results.
  if (!resolved.window || resolved.window.through <= rolling.through) return resolved;
  return { window: { ...resolved.window, through: rolling.through, label: `Week ${resolved.window.week} · ${periodDates(resolved.window.from, rolling.through)} so far` } };
}
const teamById = new Map(Object.entries(teamsInfo).map(([abbreviation, team]) => [team.id, abbreviation]));

export type TeamGamesScheduled = { id: number; date: string };
/** Each scheduled night's team games against those reported, for `completeThrough`. */
function teamGameNights(rows: readonly TeamGameInput[], schedule: readonly TeamGamesScheduled[]): NightCoverage[] {
  // One entry per reported team game, so a repeated row cannot count twice.
  const reported = new Map(rows.flatMap(row => row.game_id != null && teamById.has(row.team_id ?? -1) ? [[`${row.team_id}:${row.game_id}`, row.date] as const] : []));
  return countNights(teamGameDates(schedule), reported.values());
}
/** The window's label once late nights are cut: a week keeps its number, other periods name their dates, since "Last 7 days" would no longer be true. */
const cutLabel = (label: string, from: string, through: string) => /^Week \d+/.test(label) ? `${label.split(" · ")[0]} · ${periodDates(from, through)}` : periodDates(from, through);

/**
 * A team with no reported game in the window is a known 0 only when the schedule proves the feed is complete. Late newest
 * nights end the window at the last complete night (TJ, 2026-11-03), with a page note; an older gap stays partial.
 */
export function buildTeamGames(input: { rows: readonly TeamGameInput[]; schedule: readonly TeamGamesScheduled[]; from: string; through: string; label: string; teams: readonly string[]; updatedAt: string | null }): SharePostLoadResult<TeamGamesData> {
  const cut = completeThrough(teamGameNights(input.rows, input.schedule), input.through), note = completeThroughNote(cut);
  if (!cut.through) {
    const reason = `No night from ${input.from} to ${input.through} is fully reported yet.`;
    return { state: "missing", reasons: [reason], data: null, teams: [], evidence: { sources: [{ name: "NHL.com team game stats", tables: ["wgo_team_stats", "games"], state: "partial", asOf: null, updatedAt: input.updatedAt }], sample: reason, strength: "Not applicable (game counts)", cohort: `All ${input.teams.length} teams`, coverage: null } };
  }
  const through = cut.through, trimmed = cut.trimmed.length > 0, label = trimmed ? cutLabel(input.label, input.from, through) : input.label;
  const rows = input.rows.filter(row => row.date <= through), scheduledGames = input.schedule.filter(game => game.date <= through).length;
  const games = new Map<string, { ids: Set<number>; last: string | null }>(input.teams.map(team => [team, { ids: new Set<number>(), last: null }]));
  for (const row of rows) {
    const team = teamById.get(row.team_id ?? -1), entry = team ? games.get(team) : undefined;
    if (!entry || row.game_id == null) continue;
    entry.ids.add(row.game_id);
    if (!entry.last || row.date > entry.last) entry.last = row.date;
  }
  const expected = scheduledGames * 2, observed = [...games.values()].reduce((total, entry) => total + entry.ids.size, 0), missing = Math.max(0, expected - observed);
  const complete = missing === 0 && observed === expected;
  const asOf = [...games.values()].reduce<string | null>((latest, entry) => entry.last && (!latest || entry.last > latest) ? entry.last : latest, null);
  const ranked = competitionRanks([...games.entries()], ([, entry]) => entry.ids.size, ([team]) => team);
  return {
    state: complete ? "ready" : "partial",
    reasons: complete ? [] : [`${missing} of ${expected} scheduled team games have no reported result.`],
    data: { from: input.from, through, label, rows: ranked.map(({ row: [team, entry], rank }) => ({ team, games: entry.ids.size, lastGame: entry.last, rank })) },
    teams: [...input.teams],
    ...(note && trimmed ? { pageNotes: [note] } : {}),
    evidence: {
      sources: [{ name: "NHL.com team game stats", tables: ["wgo_team_stats", "games"], state: complete ? "ready" : "partial", asOf, updatedAt: input.updatedAt }],
      sample: `${input.from} to ${through}: ${observed} completed team games`, strength: "Not applicable (game counts)", cohort: `All ${input.teams.length} teams`,
      coverage: { observed, expected, missing, unit: "team games" },
    },
  };
}

export const teamGamesModule = defineShareModule<TeamGamesSettings, TeamGamesData>({
  id: "team-games", title: "Team Games Played", summary: "Completed games per team over recent days.", group: "schedule", basis: "observed",
  fields: [
    { id: "days", label: "Days", kind: "number", default: 7, min: 1, max: 30, step: 1, onlyForPeriod: TEAM_GAMES_ROLLING },
    ...periodWindowFields({ mode: TEAM_GAMES_CONTROL.mode, default: TEAM_GAMES_ROLLING, options: [{ value: TEAM_GAMES_ROLLING, label: "Recent days" }, { value: "matchup", label: "Matchup week" }, { value: PERIOD_CUSTOM, label: "Custom range" }] }),
  ],
  periodControl: TEAM_GAMES_CONTROL,
  validate: settings => settings.period === PERIOD_CUSTOM ? customRangeReason(settings) : null,
  load: () => import("./teamGames.sources").then(sources => sources.loadTeamGames),
  card: () => import("components/SocialShare/modules/TeamGamesCard").then(card => card.default),
  hasRows: data => data.rows.some(row => row.games > 0),
  altText: (snapshot, data) => `FHFH completed games per team, ${data.label}. ${data.rows.map(row => `${row.rank}. ${row.team}: ${row.games}`).join("; ")}. ${snapshot.evidence.sample}.`,
});
