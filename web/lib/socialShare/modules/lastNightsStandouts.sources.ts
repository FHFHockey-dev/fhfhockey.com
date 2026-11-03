import { bounded } from "lib/socialShare/trendSources";
import { SKATER_SEASON_LIMITS } from "./bshBoard.sources";
import { UNKNOWN_EVIDENCE, type SharePostContext, type SharePostLoadResult, type SharePostReadClient } from "./contract";
import { NST_GSAX_COLUMNS, NST_GSAX_TABLES, type NstGsaxRow } from "./goalieGsax";
import { buildLastNightsStandouts, fallbackReason, isGoalieView, LINE_COMBO_COLUMNS, lineRowsFromCombinations, scheduledSlateDates, scheduledTeamGames, slateCoverage, slateNeighbours, standoutsNoSlate, type EarlierLineRow, type LastNightsStandoutsData, type LastNightsStandoutsSettings, type LineComboRow, type SlateScheduleRow, type StandoutFallback } from "./lastNightsStandouts";
import { ownershipByPlayer, type OwnershipMapRow, type YahooOwnershipRow } from "./nightlyFloor";
import { OWNERSHIP_LIMITS } from "./nightlyFloor.sources";
import { ROLE_PP_COLUMNS, type RolePpRow } from "./roleWatch";
import type { GoalieAppearance } from "./shared/goalieLedger";
import { readGoalieAppearances } from "./shared/goalieLedger.sources";
import type { SkaterAppearance } from "./shared/skaterAppearances";
import { readSkaterAppearances } from "./shared/skaterAppearances.sources";
import { NST_COUNT_COLUMNS, NST_ON_ICE_COLUMNS, shareThrough, type NstCountRow, type NstOnIceRow } from "./whatChanged";

/**
 * Ceilings, all failing closed. A full 16-game slate is about 576 skaters and 36 goalies, and each skater has at most
 * 84 games. NST and season reads ask only for the players on the slate; role reads only for the slate's games.
 */
export const STANDOUT_LIMITS = { slateSkaters: 700, slateGoalies: 60, seasonGoalieRows: 6000, seasonRows: 60000, lineCombos: 80, earlierLines: 5000, pp: 800 } as const;
const STATEMENT_TIMEOUT = "57014";

/** This season's regular-season schedule through the cutoff: slates and their games come from it, never from a results feed. */
const readSchedule = (client: SharePostReadClient, scope: { season: number; from: string; through: string }) =>
  bounded<SlateScheduleRow>("Schedule", SKATER_SEASON_LIMITS.scheduledGames, (start, end) => client.from("games").select("id,date,homeTeamId,awayTeamId", { count: "exact" }).eq("seasonId", scope.season).eq("type", 2).gte("date", scope.from).lte("date", scope.through).order("date").order("id").range(start, end));
/** How many incomplete nights a blank date looks back over before it shows the latest as it is. */
export const FALLBACK_NIGHTS = 7;
const readNstSeason = <Row>(what: string, table: string, columns: readonly string[], client: SharePostReadClient, scope: { season: number; through: string; playerIds: readonly number[] }) =>
  bounded<Row>(what, STANDOUT_LIMITS.seasonRows, (from, to) => client.from(table).select(columns.join(","), { count: "exact" }).eq("season", scope.season).lte("date_scraped", scope.through).in("player_id", [...scope.playerIds]).order("date_scraped", { ascending: true }).order("player_id", { ascending: true }).range(from, to));
async function readOwnership(client: SharePostReadClient, season: number) {
  const [yahoo, map] = await Promise.all([
    bounded<YahooOwnershipRow>("Yahoo ownership", OWNERSHIP_LIMITS.yahoo, (start, end) => client.from("yahoo_players").select("player_key,player_id,percent_ownership,last_updated", { count: "exact" }).eq("season", Math.floor(season / 10000)).order("player_key").range(start, end)),
    bounded<OwnershipMapRow>("Yahoo to NHL id map", OWNERSHIP_LIMITS.map, (start, end) => client.from("yahoo_nhl_player_map_read").select("yahoo_player_id,nhl_player_id", { count: "exact" }).order("yahoo_player_id").order("nhl_player_id").range(start, end)),
  ]);
  return { byPlayer: ownershipByPlayer(map, yahoo), updatedAt: yahoo.reduce<string | null>((latest, row) => row.last_updated && (!latest || row.last_updated > latest) ? row.last_updated : latest, null) };
}

/**
 * Rolling is read only for players with no line in last night's game. It can hit the statement timeout, so a page is read
 * once more; if it still fails those lines stay unknown, because a line chip is not worth losing the whole post.
 */
async function readEarlierLines(client: SharePostReadClient, scope: { season: number; through: string; playerIds: readonly number[] }) {
  if (!scope.playerIds.length) return [];
  try {
    return await bounded<EarlierLineRow>("Earlier line combinations", STANDOUT_LIMITS.earlierLines, async (start, end) => {
      const read = () => client.from("rolling_player_game_metrics").select("player_id,game_date,line_combo_slot,line_combo_group", { count: "exact" }).eq("season", scope.season).eq("strength_state", "all").in("player_id", [...scope.playerIds]).lte("game_date", scope.through).not("line_combo_slot", "is", null).order("game_date", { ascending: false }).order("player_id", { ascending: true }).range(start, end);
      const first = await read();
      return first.error?.code === STATEMENT_TIMEOUT ? read() : first;
    });
  } catch { return []; }
}

export async function loadLastNightsStandouts({ client, generatedAt }: SharePostContext, settings: LastNightsStandoutsSettings): Promise<SharePostLoadResult<LastNightsStandoutsData>> {
  const { through, season, from } = shareThrough(generatedAt);
  const chosen = settings.slate, schedule = await readSchedule(client, { season, from, through }), dates = scheduledSlateDates(schedule), goalieView = isGoalieView(settings.view);
  if (!chosen && !dates.length) return { state: "missing", reasons: ["No completed slate this season yet."], evidence: UNKNOWN_EVIDENCE, data: null };
  if (chosen && !dates.includes(chosen)) return standoutsNoSlate(chosen, settings, slateNeighbours(dates, chosen, { first: from, last: through }));
  const teamGamesOn = (date: string) => scheduledTeamGames(schedule.filter(game => game.date === date));
  // The view's own rows for one night; the skater views and the goalie view each need only their own feed.
  const readNight = async (date: string) => {
    const rows = goalieView ? await readGoalieAppearances(client, { season, from: date, through: date, limit: STANDOUT_LIMITS.slateGoalies }) : await readSkaterAppearances(client, { season, from: date, through: date, limit: STANDOUT_LIMITS.slateSkaters });
    return { date, rows, coverage: slateCoverage({ playerTeamGames: rows, scheduledTeamGames: teamGamesOn(date) }) };
  };
  let night = await readNight(chosen ?? dates[dates.length - 1]), fallback: StandoutFallback | null = null;
  // A blank date never shows a night still loading: it steps back to the last complete one, which then carries its date.
  if (!chosen && !night.coverage.complete) {
    const latest = night;
    for (const date of [...dates].reverse().slice(1, FALLBACK_NIGHTS + 1)) {
      const earlier = await readNight(date);
      if (earlier.coverage.complete) { night = earlier; fallback = { date: latest.date, reason: fallbackReason(latest.date, date, latest.coverage, goalieView ? "goalie" : "skater") }; break; }
    }
  }
  const slate = night.date, slates = slateNeighbours(dates, slate, { first: from, last: through }), scheduledGameIds = schedule.filter(game => game.date === slate).map(game => game.id);
  const ownership = night.rows.length ? await readOwnership(client, season) : { byPlayer: new Map(), updatedAt: null };
  const shared = { slate, slates, season, settings, scheduledTeamGames: teamGamesOn(slate), scheduledGameIds, ownership, fallback };
  if (isGoalieView(settings.view)) {
    const goalieIds = (night.rows as GoalieAppearance[]).map(row => row.goalieId);
    if (!goalieIds.length) return buildLastNightsStandouts({ ...shared, goalies: [] });
    const [goalies, nstGoalies] = await Promise.all([
      readGoalieAppearances(client, { season, from, through: slate, goalieIds, limit: STANDOUT_LIMITS.seasonGoalieRows }),
      bounded<NstGsaxRow>("NST goalie logs", STANDOUT_LIMITS.seasonGoalieRows, (start, end) => client.from(NST_GSAX_TABLES.all).select(NST_GSAX_COLUMNS.join(","), { count: "exact" }).eq("season", season).lte("date_scraped", slate).in("player_id", goalieIds).order("date_scraped").order("player_id").range(start, end)),
    ]);
    return buildLastNightsStandouts({ ...shared, goalies, nstGoalies });
  }
  const onSlate = night.rows as SkaterAppearance[];
  const playerIds = onSlate.map(game => game.playerId), gameIds = [...new Set(onSlate.map(game => game.gameId))];
  if (!playerIds.length) return buildLastNightsStandouts({ ...shared, appearances: [] });
  const appearances = await readSkaterAppearances(client, { season, from, through: slate, playerIds, limit: STANDOUT_LIMITS.seasonRows });
  const nstCounts = await readNstSeason<NstCountRow>("NST individual counts", "nst_gamelog_as_counts", NST_COUNT_COLUMNS, client, { season, through: slate, playerIds });
  const nstOnIce = await readNstSeason<NstOnIceRow>("NST on-ice counts", "nst_gamelog_as_counts_oi", NST_ON_ICE_COLUMNS, client, { season, through: slate, playerIds });
  const lineCombos = await bounded<LineComboRow>("Line combinations", STANDOUT_LIMITS.lineCombos, (start, end) => client.from("lineCombinations").select(LINE_COMBO_COLUMNS.join(","), { count: "exact" }).in("gameId", gameIds).eq("source_kind", "gamecenter").order("gameId", { ascending: true }).order("teamId", { ascending: true }).range(start, end));
  const rolling = lineRowsFromCombinations(lineCombos), withLine = new Set(rolling.map(row => row.player_id));
  const earlierLines = await readEarlierLines(client, { season, through: slate, playerIds: playerIds.filter(id => !withLine.has(id)) });
  const pp = await bounded<RolePpRow>("Power-play combinations", STANDOUT_LIMITS.pp, (start, end) => client.from("powerPlayCombinations").select(ROLE_PP_COLUMNS.join(","), { count: "exact" }).in("gameId", gameIds).order("gameId", { ascending: true }).order("playerId", { ascending: true }).range(start, end));
  return buildLastNightsStandouts({ ...shared, appearances, nstCounts, nstOnIce, role: { rolling, pp }, earlierLines });
}
