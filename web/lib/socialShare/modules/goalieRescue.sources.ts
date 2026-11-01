import { getSchedule } from "lib/NHL/server";
import { planningScheduleStatus } from "lib/rosterScheduleData/normalize";
import { calendarWeekStart } from "lib/socialShare/schedule";
import { bounded } from "lib/socialShare/trendSources";
import type { SocialScheduleData, SocialScheduleGame } from "lib/socialShare/types";
import { teamsInfo } from "lib/teamsInfo";
import { goalieLedgerScope } from "./busyQuiet";
import { readGoalieLedger } from "./busyQuiet.sources";
import type { SharePostContext, SharePostLoadResult } from "./contract";
import { buildGoalieRescue, goalieAvailability, YAHOO_GOALIE_COLUMNS, type GoalieRescueSettings, type RescueData, type ScheduledGame, type YahooGoalieRow, type YahooMapRow } from "./goalieRescue";

/** 181 Yahoo goalies on 2026-10-31. Above a ceiling a read fails closed. */
const YAHOO_GOALIE_LIMIT = 400, MAP_CHUNK = 150;
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const teamById = new Map(Object.entries(teamsInfo).map(([abbreviation, team]) => [team.id, abbreviation]));

/** The `games` table has a start time but no state, so the state comes from the NHL schedule feed, as on the other schedule posts. The feed lists a game once per team. */
export function scheduledGames(schedule: Pick<SocialScheduleData, "data" | "games">): ScheduledGame[] {
  const records = schedule.games ?? Object.values(schedule.data).flatMap(week => Object.values(week)).filter((game): game is SocialScheduleGame => !!game);
  return [...new Map(records.map(game => [game.id, { id: game.id, date: game.gameDate ?? null, gameType: game.gameType ?? null, startTimeUtc: game.startTimeUTC ?? null, state: game.gameState ?? null, scheduleState: game.gameScheduleState ?? null, homeTeamId: game.homeTeam.id, awayTeamId: game.awayTeam.id }])).values()];
}

/**
 * Whether a game is still to come at generation. NHL state decides, whatever the start time says: live counts, even past midnight on
 * yesterday's date; final, postponed and cancelled don't; scheduled does. With no usable state, a future start counts and anything else,
 * a null start time included, is unknown (null). A game with no date can't be placed in the week: only a finished, postponed or cancelled state settles it.
 */
export function gameLeft(game: ScheduledGame, today: string, generatedAt: string): boolean | null {
  const status = planningScheduleStatus(game.state ?? "", game.scheduleState ?? "");
  if (status === "live") return true;
  if (!game.date) return status && status !== "scheduled" ? false : null;
  if (game.date < today) return false;
  if (status) return status === "scheduled";
  return game.startTimeUtc && Date.parse(game.startTimeUtc) > Date.parse(generatedAt) ? true : null;
}

/** A team with a game of unknown state has an unknown count, printed as a dash: never a smaller number. */
export function teamGamesLeft(games: readonly ScheduledGame[], today: string, generatedAt: string) {
  const left = new Map<string, number | null>(Object.keys(teamsInfo).map(team => [team, 0]));
  let unresolved = 0;
  for (const game of games) {
    if (game.gameType !== 2) continue;
    const counts = gameLeft(game, today, generatedAt);
    if (counts === null) unresolved++;
    if (counts === false) continue;
    for (const id of [game.homeTeamId, game.awayTeamId]) {
      const team = teamById.get(id);
      if (team) { const current = left.get(team)!; left.set(team, counts === null || current === null ? null : current + 1); }
    }
  }
  return { left, unresolved };
}

export async function loadGoalieRescue({ client, generatedAt }: SharePostContext, settings: GoalieRescueSettings): Promise<SharePostLoadResult<RescueData>> {
  const scope = goalieLedgerScope(generatedAt), weekEnd = addDays(calendarWeekStart(generatedAt), 6), yahooSeason = Math.floor(scope.season / 10000);
  // GMS LEFT is context: a failed schedule read leaves the rest of the card standing and says so.
  const [ledger, yahoo, week] = await Promise.all([
    readGoalieLedger(client, scope),
    bounded<YahooGoalieRow>("Yahoo goalies", YAHOO_GOALIE_LIMIT, (start, end) => client.from("yahoo_players").select(YAHOO_GOALIE_COLUMNS, { count: "exact" }).eq("season", yahooSeason).eq("display_position", "G").order("player_key").range(start, end)),
    getSchedule(calendarWeekStart(generatedAt), { includeOdds: false }).then(scheduledGames).catch(() => null),
  ]);
  const keys = [...new Set(yahoo.flatMap(row => row.player_id ? [row.player_key, row.player_id] : [row.player_key]))], map: YahooMapRow[] = [];
  for (let index = 0; index < keys.length; index += MAP_CHUNK) {
    const chunk = keys.slice(index, index + MAP_CHUNK);
    map.push(...await bounded<YahooMapRow>("Yahoo to NHL id map", chunk.length * 2, (start, end) => client.from("yahoo_nhl_player_map_read").select("yahoo_player_id,nhl_player_id", { count: "exact" }).in("yahoo_player_id", chunk).order("yahoo_player_id").order("nhl_player_id").range(start, end)));
  }
  const games = teamGamesLeft(week ?? [], scope.today, generatedAt);
  const scheduleReasons = !week ? ["The NHL schedule could not be read, so GMS LEFT prints a dash."] : games.unresolved ? [`${games.unresolved === 1 ? "1 game has" : `${games.unresolved} games have`} no usable date, state or start time, so those teams' GMS LEFT print a dash.`] : [];
  return buildGoalieRescue({ settings, ...ledger, availability: goalieAvailability(yahoo, map, scope.through), teamGamesLeft: week ? games.left : new Map(), scheduleReasons, through: scope.through, weekEnd });
}
