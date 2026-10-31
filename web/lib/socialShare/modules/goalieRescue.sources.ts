import { calendarWeekStart } from "lib/socialShare/schedule";
import { bounded } from "lib/socialShare/trendSources";
import { teamsInfo } from "lib/teamsInfo";
import { goalieLedgerScope } from "./busyQuiet";
import { readGoalieLedger } from "./busyQuiet.sources";
import type { SharePostContext, SharePostLoadResult } from "./contract";
import { buildGoalieRescue, goalieAvailability, YAHOO_GOALIE_COLUMNS, type GoalieRescueSettings, type RescueData, type ScheduledGame, type YahooGoalieRow, type YahooMapRow } from "./goalieRescue";

/** 181 Yahoo goalies on 2026-10-31. Week games: at most 16 a night. Above a ceiling a read fails closed. */
const YAHOO_GOALIE_LIMIT = 400, MAP_CHUNK = 150, WEEK_GAME_LIMIT = 120;
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const teamById = new Map(Object.entries(teamsInfo).map(([abbreviation, team]) => [team.id, abbreviation]));

export function teamGamesLeft(games: readonly ScheduledGame[]) {
  const left = new Map(Object.keys(teamsInfo).map(team => [team, 0]));
  for (const game of games) for (const id of [game.homeTeamId, game.awayTeamId]) {
    const team = teamById.get(id);
    if (team) left.set(team, (left.get(team) ?? 0) + 1);
  }
  return left;
}

export async function loadGoalieRescue({ client, generatedAt }: SharePostContext, settings: GoalieRescueSettings): Promise<SharePostLoadResult<RescueData>> {
  const scope = goalieLedgerScope(generatedAt), weekEnd = addDays(calendarWeekStart(generatedAt), 6), yahooSeason = Math.floor(scope.season / 10000);
  const [ledger, yahoo, week] = await Promise.all([
    readGoalieLedger(client, scope),
    bounded<YahooGoalieRow>("Yahoo goalies", YAHOO_GOALIE_LIMIT, (start, end) => client.from("yahoo_players").select(YAHOO_GOALIE_COLUMNS, { count: "exact" }).eq("season", yahooSeason).eq("display_position", "G").order("player_key").range(start, end)),
    bounded<ScheduledGame>("Week schedule", WEEK_GAME_LIMIT, (start, end) => client.from("games").select("date,homeTeamId,awayTeamId", { count: "exact" }).eq("seasonId", scope.season).eq("type", 2).gte("date", scope.today).lte("date", weekEnd).order("date").order("id").range(start, end)),
  ]);
  const keys = [...new Set(yahoo.flatMap(row => row.player_id ? [row.player_key, row.player_id] : [row.player_key]))], map: YahooMapRow[] = [];
  for (let index = 0; index < keys.length; index += MAP_CHUNK) {
    const chunk = keys.slice(index, index + MAP_CHUNK);
    map.push(...await bounded<YahooMapRow>("Yahoo to NHL id map", chunk.length * 2, (start, end) => client.from("yahoo_nhl_player_map_read").select("yahoo_player_id,nhl_player_id", { count: "exact" }).in("yahoo_player_id", chunk).order("yahoo_player_id").order("nhl_player_id").range(start, end)));
  }
  const ownershipAsOf = yahoo.reduce<string | null>((latest, row) => { const date = row.last_updated?.slice(0, 10) ?? null; return date && (!latest || date > latest) ? date : latest; }, null);
  return buildGoalieRescue({ settings, ...ledger, availability: goalieAvailability(yahoo, map), ownershipAsOf, ownershipFresh: ownershipAsOf !== null && ownershipAsOf >= scope.through, teamGamesLeft: teamGamesLeft(week), through: scope.through, weekEnd });
}
