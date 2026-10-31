import { currentSeason } from "lib/socialShare/schedule";
import { bounded } from "lib/socialShare/trendSources";
import { teamsInfo } from "lib/teamsInfo";
import type { SharePostContext, SharePostLoadResult } from "./contract";
import candidateFile from "./playerVsPlayer.candidates.json";
import { buildPlayerVsPlayer, resolvePlayers, type PlayerVsPlayerData, type PlayerVsPlayerSettings, type PvpNstRow, type PvpTeamCoverage } from "./playerVsPlayer";
import { editionDate } from "./shared/definitions";
import { readSkaterAppearances } from "./shared/skaterAppearances.sources";
import { shiftDays } from "./teamGames";

/** Two players × 82 games, and each one's latest team × 82; anything above that fails closed. */
const APPEARANCE_LIMIT = 170, NST_LIMIT = 170, TEAM_GAME_LIMIT = 170, SCHEDULE_LIMIT = 170;

export async function loadPlayerVsPlayer({ client, generatedAt }: SharePostContext, settings: PlayerVsPlayerSettings): Promise<SharePostLoadResult<PlayerVsPlayerData>> {
  const today = editionDate(generatedAt), through = shiftDays(today, -1), season = currentSeason(through);
  const base = { settings, season, through, today, candidates: candidateFile };
  const players = resolvePlayers(settings);
  if (!players) return buildPlayerVsPlayer({ ...base, appearances: [], nst: [], teamCoverage: [] });
  const ids = [players.a, players.b], from = `${String(season).slice(0, 4)}-07-01`;
  const appearances = await readSkaterAppearances(client, { season, from, through, playerIds: ids, limit: APPEARANCE_LIMIT });

  /* NST is optional context: a failed read leaves those rows unranked and the post partial, not a failed post. */
  const nst = settings.strength !== "all" ? [] : await bounded<PvpNstRow>("NST game logs", NST_LIMIT, (start, end) => client.from("nst_gamelog_as_counts").select("player_id,date_scraped,gp,ixg,iscfs", { count: "exact" }).in("player_id", ids).gte("date_scraped", from).lte("date_scraped", through).order("date_scraped").order("player_id").range(start, end)).catch(() => null);

  /* A player's own rows cannot tell a missed game from a late feed, so each latest team's results are checked against its schedule. */
  const latestTeams = [...new Set(ids.flatMap(id => { const team = appearances.filter(game => game.playerId === id).at(-1)?.team; return team ? [team] : []; }))];
  const teamIds = latestTeams.flatMap(team => { const info = teamsInfo[team as keyof typeof teamsInfo]; return info ? [{ team, id: info.id }] : []; });
  let teamCoverage: PvpTeamCoverage[] = [];
  if (teamIds.length) {
    const list = teamIds.map(team => team.id);
    const [scheduled, completed] = await Promise.all([
      bounded<{ id: number; homeTeamId: number; awayTeamId: number }>("Schedule", SCHEDULE_LIMIT, (start, end) => client.from("games").select("id,homeTeamId,awayTeamId", { count: "exact" }).eq("seasonId", season).eq("type", 2).lte("date", through).or(`homeTeamId.in.(${list.join(",")}),awayTeamId.in.(${list.join(",")})`).order("id").range(start, end)),
      bounded<{ team_id: number; game_id: number | null }>("Team game stats", TEAM_GAME_LIMIT, (start, end) => client.from("wgo_team_stats").select("team_id,game_id", { count: "exact" }).eq("season_id", season).lte("date", through).in("team_id", list).order("game_id").order("team_id").range(start, end)),
    ]);
    teamCoverage = teamIds.map(({ team, id }) => {
      const done = new Set(completed.flatMap(row => row.team_id === id && row.game_id !== null ? [row.game_id] : []));
      const expected = scheduled.filter(game => game.homeTeamId === id || game.awayTeamId === id);
      return { team, scheduled: expected.length, completed: expected.filter(game => done.has(game.id)).length };
    });
  }
  return buildPlayerVsPlayer({ ...base, appearances, nst, teamCoverage });
}
