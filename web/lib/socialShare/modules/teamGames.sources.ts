import { bounded } from "lib/socialShare/trendSources";
import { activeTeamAbbreviations } from "lib/teamsInfo";
import type { SharePostContext, SharePostLoadResult } from "./contract";
import { matchupCalendar } from "./shared/periodWindow";
import { readMatchupRows } from "./shared/periodWindow.sources";
import { buildTeamGames, resolveTeamGamesWindow, TEAM_GAMES_ROLLING, teamGamesWindow, type TeamGameInput, type TeamGamesData, type TeamGamesScheduled, type TeamGamesSettings } from "./teamGames";

/** A custom range can cover the season: 32 teams × 82 games, and half that in games. Anything above fails closed. */
const TEAM_GAME_LIMIT = 2700;
const SCHEDULE_LIMIT = 1400;

export async function loadTeamGames({ client, generatedAt }: SharePostContext, settings: TeamGamesSettings): Promise<SharePostLoadResult<TeamGamesData>> {
  const { season } = teamGamesWindow(generatedAt, settings.days);
  // The rolling default needs no matchup calendar, so that table cannot take it down.
  const calendar = settings.period === TEAM_GAMES_ROLLING ? { weeks: [], reasons: [] } : matchupCalendar(await readMatchupRows(client, String(season).slice(0, 4)));
  const { window, reason } = resolveTeamGamesWindow(settings, calendar, generatedAt);
  if (!window) {
    const reasons = [reason, ...calendar.reasons];
    return { state: "missing", reasons, data: null, evidence: { sources: [{ name: "Yahoo matchup weeks", tables: ["yahoo_matchup_weeks"], state: "ready", asOf: null, updatedAt: null }], sample: reason, strength: "Not applicable (game counts)", cohort: "Not available", coverage: null } };
  }
  const { from, through, label } = window;
  const rows = await bounded<TeamGameInput>("Team game stats", TEAM_GAME_LIMIT, (start, end) => client.from("wgo_team_stats").select("team_id,game_id,date", { count: "exact" }).eq("season_id", season).gte("date", from).lte("date", through).order("date").order("game_id").order("team_id").range(start, end));
  const schedule = await bounded<TeamGamesScheduled>("Schedule", SCHEDULE_LIMIT, (start, end) => client.from("games").select("id,date", { count: "exact" }).eq("seasonId", season).eq("type", 2).gte("date", from).lte("date", through).order("id").range(start, end));
  return buildTeamGames({ rows, schedule, from, through, label, teams: [...activeTeamAbbreviations].map(String).sort(), updatedAt: null });
}
