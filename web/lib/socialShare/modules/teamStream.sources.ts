import { getSchedule } from "lib/NHL/server";
import { buildScheduleSnapshot, currentSeason } from "lib/socialShare/schedule";
import type { ShareMapRow } from "lib/socialShare/players";
import { bounded } from "lib/socialShare/trendSources";
import type { SharePostContext, SharePostLoadResult, SharePostReadClient } from "./contract";
import { seasonScope } from "./creaseShift";
import { LINE_COMBO_COLUMNS, lineRowsFromCombinations, type LineComboRow } from "./lastNightsStandouts";
import { OFF_NIGHT_LOOKBACK_DAYS, OFF_NIGHT_MAX_SCHEDULE_WEEKS, OFF_NIGHT_THIS_WEEK, offNightEmptyWindow, offNightPeriodMissing, offNightScheduleGate, offNightUpcoming, offNightWeeks, type OffNightYahooRow } from "./offNightEdge";
import { ROLE_PP_COLUMNS, type RoleEvidence, type RolePpRow } from "./roleWatch";
import { editionDate } from "./shared/definitions";
import { matchupCalendar } from "./shared/periodWindow";
import { readMatchupRows } from "./shared/periodWindow.sources";
import { readSkaterAppearances } from "./shared/skaterAppearances.sources";
import { asOffNightSettings, buildTeamStream, resolveTeamStreamWindow, TEAM_STREAM_HISTORY_DAYS, teamStreamRefusal, teamStreamLatestGames, teamStreamPool, type TeamStreamData, type TeamStreamSettings } from "./teamStream";
import { shiftDays } from "./teamGames";
import { NST_COUNT_COLUMNS, type NstCountRow } from "./whatChanged";

/**
 * Off-Night Edge's ceilings for the lookback, plus the per-skater reads. The pool is about 15 skaters on each of 8 teams; at
 * most about 30 games each in 60 days. Roles are read only for each skater's newest game. Over any ceiling fails closed.
 */
const LIMITS = { skaters: 9000, games: 1000, yahoo: 2000, map: 3000, history: 8000, nst: 8000, lineCombos: 400, pp: 4000 } as const;
const YAHOO_COLUMNS = "player_key,player_id,player_name,editorial_team_abbreviation,display_position,eligible_positions,position_type,percent_ownership,status,season,last_updated";
const STATEMENT_TIMEOUT = "57014";

/** NST rates are a choice on the card, not the post: a failed read leaves them unknown rather than taking the post down. */
async function readNst(client: SharePostReadClient, scope: { season: number; from: string; through: string; playerIds: readonly number[] }) {
  if (!scope.playerIds.length) return [];
  try {
    return await bounded<NstCountRow>("NST individual counts", LIMITS.nst, async (start, end) => {
      const read = () => client.from("nst_gamelog_as_counts").select(NST_COUNT_COLUMNS.join(","), { count: "exact" }).eq("season", scope.season).gte("date_scraped", scope.from).lte("date_scraped", scope.through).in("player_id", [...scope.playerIds]).order("date_scraped", { ascending: true }).order("player_id", { ascending: true }).range(start, end);
      const first = await read();
      return first.error?.code === STATEMENT_TIMEOUT ? read() : first;
    });
  } catch { return null; }
}
/** Line and PP units of the newest games only. A chip is not worth the post: a failed read leaves the chips off. */
async function readRoles(client: SharePostReadClient, gameIds: readonly number[]): Promise<RoleEvidence | null> {
  if (!gameIds.length) return { rolling: [], pp: [] };
  try {
    const [lineCombos, pp] = await Promise.all([
      bounded<LineComboRow>("Line combinations", LIMITS.lineCombos, (start, end) => client.from("lineCombinations").select(LINE_COMBO_COLUMNS.join(","), { count: "exact" }).in("gameId", [...gameIds]).eq("source_kind", "gamecenter").order("gameId", { ascending: true }).order("teamId", { ascending: true }).range(start, end)),
      bounded<RolePpRow>("Power-play combinations", LIMITS.pp, (start, end) => client.from("powerPlayCombinations").select(ROLE_PP_COLUMNS.join(","), { count: "exact" }).in("gameId", [...gameIds]).order("gameId", { ascending: true }).order("playerId", { ascending: true }).range(start, end)),
    ]);
    return { rolling: lineRowsFromCombinations(lineCombos), pp };
  } catch { return null; }
}

export async function loadTeamStream({ client, generatedAt }: SharePostContext, settings: TeamStreamSettings): Promise<SharePostLoadResult<TeamStreamData>> {
  const today = editionDate(generatedAt), restOfWeek = settings.period === OFF_NIGHT_THIS_WEEK, offNight = asOffNightSettings(settings);
  // Rest of week needs no matchup calendar, so that table cannot take it down.
  const calendar = restOfWeek ? { weeks: [], reasons: [] } : matchupCalendar(await readMatchupRows(client, String(seasonScope(generatedAt).season).slice(0, 4)));
  const { window, reason } = resolveTeamStreamWindow(settings, calendar, generatedAt);
  if (!window) return teamStreamRefusal(offNightPeriodMissing([reason, ...calendar.reasons]));
  const weeks = offNightWeeks(window.from, window.through);
  if (weeks.length > OFF_NIGHT_MAX_SCHEDULE_WEEKS) return teamStreamRefusal(offNightPeriodMissing([`${window.label} touches ${weeks.length} schedule weeks; this post reads at most ${OFF_NIGHT_MAX_SCHEDULE_WEEKS}.`]));
  const upcoming = offNightUpcoming(window, generatedAt);
  const schedules = await Promise.all(weeks.map(week => getSchedule(week.weekStart, { includeOdds: false }))).catch((cause: unknown) => {
    if (upcoming) return null;
    throw cause;
  });
  if (!schedules) return teamStreamRefusal(offNightPeriodMissing([`The NHL schedule for ${window.label} could not be read. It may not be published yet.`]));
  // The edition refuses a read newer than its own time, so it is stamped after the schedule answers.
  const stamped = new Date().toISOString();
  const edition = weeks.map((week, index) => buildScheduleSnapshot({ format: restOfWeek ? "remaining-week" : "game-grid", weekStart: week.weekStart, schedule: schedules[index], generatedAt: stamped, selectedDates: week.dates }));
  const gated = offNightScheduleGate(edition);
  if (gated) return teamStreamRefusal(upcoming ? { ...gated, reasons: [`The NHL schedule for ${window.label} is not fully published, so there is no ranking.`, ...gated.reasons ?? []] } : gated);
  const empty = offNightEmptyWindow(edition, window, offNight);
  if (empty) return teamStreamRefusal(empty);
  const through = shiftDays(today, -1), from = shiftDays(through, 1 - OFF_NIGHT_LOOKBACK_DAYS), historyFrom = shiftDays(through, 1 - TEAM_STREAM_HISTORY_DAYS), season = currentSeason(through);
  const [appearances, games, yahoo, map] = await Promise.all([
    readSkaterAppearances(client, { season, from, through, limit: LIMITS.skaters }),
    bounded<{ id: number; date: string }>("Schedule", LIMITS.games, (start, end) => client.from("games").select("id,date", { count: "exact" }).eq("seasonId", season).eq("type", 2).gte("date", historyFrom).lte("date", through).order("id").range(start, end)),
    // No ownership filter in the read: a range filter would drop null, and unknown has to stay distinct from 0%.
    bounded<OffNightYahooRow>("Yahoo ownership", LIMITS.yahoo, (start, end) => client.from("yahoo_players").select(YAHOO_COLUMNS, { count: "exact" }).eq("season", Math.floor(season / 10000)).order("player_key").range(start, end)),
    bounded<ShareMapRow>("Yahoo to NHL id map", LIMITS.map, (start, end) => client.from("yahoo_nhl_player_map_read").select("yahoo_player_id,nhl_player_id", { count: "exact" }).order("yahoo_player_id").order("nhl_player_id").range(start, end)),
  ]);
  const scheduled = games.filter(game => game.date >= from);
  const pooled = teamStreamPool({ edition, window, settings, appearances, yahoo, map, gameIds: scheduled.map(game => game.id), scheduled, from, through });
  if ("result" in pooled) return pooled.result;
  const { stage } = pooled, historyGameIds = games.map(game => game.id);
  const history = stage.ids.length ? await readSkaterAppearances(client, { season, from: historyFrom, through: stage.formThrough, playerIds: stage.ids, limit: LIMITS.history }) : [];
  const latest = teamStreamLatestGames(history, { gameIds: historyGameIds, through: stage.formThrough });
  const [nst, role] = await Promise.all([
    readNst(client, { season, from: historyFrom, through: stage.formThrough, playerIds: stage.ids }),
    readRoles(client, [...new Set([...latest.values()].map(game => game.gameId))].sort((a, b) => a - b)),
  ]);
  return buildTeamStream(stage, { history, historyGameIds, nst, role });
}
