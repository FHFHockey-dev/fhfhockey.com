import { currentSeason } from "lib/socialShare/schedule";
import { teamsInfo } from "lib/teamsInfo";
import { defineShareModule, type SharePostLoadResult } from "./contract";
import { competitionRanks, editionDate } from "./shared/definitions";

/** The seam's example post (SS 1.0): each team's completed games over the last N days. Small on purpose. */
export type TeamGamesSettings = { days: number };
export type TeamGamesRow = { team: string; games: number; lastGame: string | null; rank: number };
export type TeamGamesData = { from: string; through: string; rows: TeamGamesRow[] };
export type TeamGameInput = { team_id: number | null; game_id: number | null; date: string };

export const shiftDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
/** Through yesterday in New York: today's games may not be final. */
export function teamGamesWindow(generatedAt: string, days: number) {
  const through = shiftDays(editionDate(generatedAt), -1);
  return { from: shiftDays(through, 1 - days), through, season: currentSeason(through) };
}
const teamById = new Map(Object.entries(teamsInfo).map(([abbreviation, team]) => [team.id, abbreviation]));

/** A team with no reported game in the window is a known 0 only when `scheduledGames` proves the feed is complete. */
export function buildTeamGames(input: { rows: readonly TeamGameInput[]; scheduledGames: number; from: string; through: string; teams: readonly string[]; updatedAt: string | null }): SharePostLoadResult<TeamGamesData> {
  const games = new Map<string, { ids: Set<number>; last: string | null }>(input.teams.map(team => [team, { ids: new Set<number>(), last: null }]));
  for (const row of input.rows) {
    const team = teamById.get(row.team_id ?? -1), entry = team ? games.get(team) : undefined;
    if (!entry || row.game_id == null) continue;
    entry.ids.add(row.game_id);
    if (!entry.last || row.date > entry.last) entry.last = row.date;
  }
  const expected = input.scheduledGames * 2, observed = [...games.values()].reduce((total, entry) => total + entry.ids.size, 0), missing = Math.max(0, expected - observed);
  const complete = missing === 0 && observed === expected;
  const asOf = [...games.values()].reduce<string | null>((latest, entry) => entry.last && (!latest || entry.last > latest) ? entry.last : latest, null);
  const ranked = competitionRanks([...games.entries()], ([, entry]) => entry.ids.size, ([team]) => team);
  return {
    state: complete ? "ready" : "partial",
    reasons: complete ? [] : [`${missing} of ${expected} scheduled team games have no reported result.`],
    data: { from: input.from, through: input.through, rows: ranked.map(({ row: [team, entry], rank }) => ({ team, games: entry.ids.size, lastGame: entry.last, rank })) },
    teams: [...input.teams],
    evidence: {
      sources: [{ name: "NHL.com team game stats", tables: ["wgo_team_stats", "games"], state: complete ? "ready" : "partial", asOf, updatedAt: input.updatedAt }],
      sample: `${input.from} to ${input.through}: ${observed} completed team games`, strength: "Not applicable (game counts)", cohort: `All ${input.teams.length} teams`,
      coverage: { observed, expected, missing, unit: "team games" },
    },
  };
}

export const teamGamesModule = defineShareModule<TeamGamesSettings, TeamGamesData>({
  id: "team-games", title: "Team Games Played", summary: "Completed games per team over recent days.", group: "schedule", basis: "observed",
  fields: [{ id: "days", label: "Days", kind: "number", default: 7, min: 1, max: 30, step: 1 }],
  load: () => import("./teamGames.sources").then(sources => sources.loadTeamGames),
  card: () => import("components/SocialShare/modules/TeamGamesCard").then(card => card.default),
  hasRows: data => data.rows.some(row => row.games > 0),
  altText: (snapshot, data) => `FHFH completed games per team, ${data.from} to ${data.through}. ${data.rows.map(row => `${row.rank}. ${row.team}: ${row.games}`).join("; ")}. ${snapshot.evidence.sample}.`,
});
