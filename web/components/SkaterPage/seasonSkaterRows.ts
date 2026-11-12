import { seasonDateWindow } from "components/PlayerStats/playerStatsContract";
import type { SkaterGameRow } from "./skaterTypes";

export const SKATER_SELECT_FIELDS = [
  "player_id",
  "player_name",
  "team_abbrev",
  "current_team_abbreviation",
  "position_code",
  "date",
  "season_id",
  "games_played",
  "points",
  "points_per_game",
  "goals",
  "assists",
  "shots",
  "shooting_percentage",
  "plus_minus",
  "pp_points",
  "pp_goals",
  "pp_assists",
  "pp_toi",
  "pp_toi_per_game",
  "sh_points",
  "sh_goals",
  "sh_assists",
  "hits",
  "blocked_shots",
  "penalty_minutes",
  "toi_per_game",
  "individual_sat_for_per_60",
  "toi_per_game_5v5"
].join(",");

/** Last row of the previous page; (date, player_id) is unique. */
export type SkaterRowsCursor = { date: string; playerId: number };

export type SeasonSkaterRowsPage = {
  rows: SkaterGameRow[];
  hasMore: boolean;
  nextCursor: SkaterRowsCursor | null;
};

type SeasonSkaterRowsClient = { from: (table: string) => any };

/**
 * One page of a season's skater game rows, keyset-paged on (date, player_id)
 * inside the season's date window. Ordering by id with an offset walked the
 * primary key across the whole 2.2M-row table and hit the statement timeout;
 * the date bound lets the date index serve each page.
 */
export async function fetchSeasonSkaterRowsPage(
  client: SeasonSkaterRowsClient,
  seasonId: number,
  cursor: SkaterRowsCursor | null,
  pageSize: number
): Promise<SeasonSkaterRowsPage> {
  const window = seasonDateWindow(seasonId);
  if (!window) {
    return { rows: [], hasMore: false, nextCursor: null };
  }

  let query = client
    .from("wgo_skater_stats")
    .select(SKATER_SELECT_FIELDS)
    .eq("season_id", seasonId)
    .gt("games_played", 0)
    .gte("date", cursor ? cursor.date : window.start)
    .lte("date", window.end);
  if (cursor) {
    // With date >= cursor.date this keeps rows strictly after the cursor.
    query = query.or(`date.gt.${cursor.date},player_id.gt.${cursor.playerId}`);
  }
  const { data, error } = await query
    .order("date", { ascending: true })
    .order("player_id", { ascending: true })
    .limit(pageSize);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as SkaterGameRow[];
  const last = rows[rows.length - 1];
  const hasMore = rows.length === pageSize;
  return {
    rows,
    hasMore,
    nextCursor:
      hasMore && last?.date != null && typeof last.player_id === "number"
        ? { date: String(last.date).slice(0, 10), playerId: last.player_id }
        : null
  };
}
