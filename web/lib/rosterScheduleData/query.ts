import {
  DEFAULT_MATCHUP_WEEK_RANGE,
  DEFAULT_YAHOO_GAME_KEY,
  MAX_MATCHUP_WEEK_SPAN,
} from "./constants";
import type {
  RosterOptimizerTeamGameRecord,
  RosterScheduleReadFilter,
} from "./types";

type QueryError = { code?: string; details?: string; message: string };
type QueryResult = {
  data: unknown[] | null;
  error: QueryError | null;
};
type QueryBuilder = PromiseLike<QueryResult> & {
  eq(column: string, value: unknown): QueryBuilder;
  gte(column: string, value: unknown): QueryBuilder;
  lte(column: string, value: unknown): QueryBuilder;
  order(column: string, options: { ascending: boolean }): QueryBuilder;
  range(from: number, to: number): QueryBuilder;
};
export type ScheduleReadClient = {
  from(table: string): {
    select(columns: string): QueryBuilder;
  };
};

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseWeek(
  value: string | undefined,
  fallback: number,
  field: string,
): number {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${field} must be a positive integer.`);
  }
  return parsed;
}

export function parseRosterScheduleReadFilter(query: {
  gameKey?: string | string[];
  startWeek?: string | string[];
  endWeek?: string | string[];
}): RosterScheduleReadFilter {
  const gameKey =
    firstQueryValue(query.gameKey)?.trim() || DEFAULT_YAHOO_GAME_KEY;
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(gameKey)) {
    throw new Error("gameKey has an invalid format.");
  }
  const startWeek = parseWeek(
    firstQueryValue(query.startWeek),
    DEFAULT_MATCHUP_WEEK_RANGE.startWeek,
    "startWeek",
  );
  const endWeek = parseWeek(
    firstQueryValue(query.endWeek),
    DEFAULT_MATCHUP_WEEK_RANGE.endWeek,
    "endWeek",
  );
  if (endWeek < startWeek) {
    throw new Error("endWeek must be greater than or equal to startWeek.");
  }
  if (endWeek - startWeek + 1 > MAX_MATCHUP_WEEK_SPAN) {
    throw new Error(`The matchup-week range cannot exceed ${MAX_MATCHUP_WEEK_SPAN} weeks.`);
  }
  return { gameKey, startWeek, endWeek };
}

const READ_COLUMNS = [
  "id",
  "yahoo_matchup_week_id",
  "game_key",
  "season",
  "week",
  "source_game_id",
  "source_season_id",
  "game_date",
  "start_time",
  "game_type",
  "game_status",
  "schedule_status",
  "mapping_status",
  "is_countable",
  "team_id",
  "team_abbreviation",
  "opponent_team_id",
  "opponent_abbreviation",
  "home_away",
  "source_url",
  "source_updated_at",
  "source_metadata",
  "fetched_at",
  "inserted_at",
  "updated_at",
].join(",");

const READ_PAGE_SIZE = 1_000;

/** Paged Data API reads supply the complete team-game matrix. */
export async function readRosterSchedule(
  client: ScheduleReadClient,
  filter: RosterScheduleReadFilter,
): Promise<RosterOptimizerTeamGameRecord[]> {
  const games: RosterOptimizerTeamGameRecord[] = [];

  for (let from = 0; ; from += READ_PAGE_SIZE) {
    const { data, error } = await client
      .from("roster_optimizer_team_games")
      .select(READ_COLUMNS)
      .eq("game_key", filter.gameKey)
      .gte("week", filter.startWeek)
      .lte("week", filter.endWeek)
      .eq("mapping_status", "mapped")
      .eq("is_countable", true)
      .order("game_date", { ascending: true })
      .order("source_game_id", { ascending: true })
      .order("team_id", { ascending: true })
      .range(from, from + READ_PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data ?? []) as RosterOptimizerTeamGameRecord[];
    games.push(...page);
    if (page.length < READ_PAGE_SIZE) break;
  }

  return games;
}
