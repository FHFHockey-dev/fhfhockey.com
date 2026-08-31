import type {
  MatchupWeekMapping,
  NhlScheduleGame,
  RosterOptimizerTeamGameUpsert,
  YahooMatchupWeekRow,
} from "./types";

const EXACT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const COUNTABLE_GAME_STATES = new Set([
  "FUT",
  "PRE",
  "LIVE",
  "CRIT",
  "FINAL",
  "OFF",
  "OVER",
]);
const EXCLUDED_SCHEDULE_STATES = new Set([
  "PPD",
  "POSTPONED",
  "CANCELLED",
  "CANCELED",
  "SUSPENDED",
]);

function assertExactDate(value: string, field: string): string {
  if (!EXACT_DATE_PATTERN.test(value)) {
    throw new Error(`${field} must use YYYY-MM-DD.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`${field} must be a real calendar date.`);
  }
  return value;
}

function normalizeState(value: string | null | undefined): string {
  const normalized = value?.trim().toUpperCase();
  return normalized || "UNKNOWN";
}

function assertTeam(team: NhlScheduleGame["homeTeam"], label: string) {
  if (!Number.isSafeInteger(team.id) || team.id <= 0) {
    throw new Error(`${label}.id must be a positive integer.`);
  }
  const abbreviation = team.abbrev?.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(abbreviation)) {
    throw new Error(`${label}.abbrev must be a three-letter NHL abbreviation.`);
  }
  return { id: team.id, abbreviation };
}

function normalizeTimestamp(
  value: string | null | undefined,
  field: string,
): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} must be an ISO timestamp when present.`);
  }
  return parsed.toISOString();
}

/** Yahoo matchup week boundaries are inclusive on both ends. */
export function mapGameDateToYahooWeek(
  gameDate: string,
  weeks: readonly YahooMatchupWeekRow[],
): MatchupWeekMapping {
  const date = assertExactDate(gameDate, "gameDate");
  const matches = weeks.filter(
    (week) =>
      week.start_date != null &&
      week.end_date != null &&
      date >= week.start_date &&
      date <= week.end_date,
  );

  if (matches.length > 1) {
    throw new Error(
      `Yahoo matchup weeks overlap for ${date}: ${matches
        .map((week) => week.week)
        .join(", ")}.`,
    );
  }
  if (matches.length === 0) {
    return {
      status: "unmapped",
      reason: `No inclusive Yahoo matchup week contains ${date}.`,
    };
  }
  return { status: "mapped", week: matches[0] };
}

export function isCountableNhlGame(args: {
  gameType: number;
  gameState: string | null | undefined;
  scheduleState: string | null | undefined;
  mappingStatus: MatchupWeekMapping["status"];
}): boolean {
  const gameState = normalizeState(args.gameState);
  const scheduleState = normalizeState(args.scheduleState);
  return (
    args.mappingStatus === "mapped" &&
    args.gameType === 2 &&
    COUNTABLE_GAME_STATES.has(gameState) &&
    !EXCLUDED_SCHEDULE_STATES.has(gameState) &&
    !EXCLUDED_SCHEDULE_STATES.has(scheduleState)
  );
}

/**
 * Uses NHL `gameDate` as the fantasy scoring date. UTC start-time conversion is
 * deliberately avoided because late games would otherwise move calendar days.
 */
export function normalizeNhlGameToTeamRows(args: {
  fetchedAt: string;
  game: NhlScheduleGame;
  gameKey: string;
  mapping: MatchupWeekMapping;
  sourceUrl: string;
  yahooSeason: string;
}): [RosterOptimizerTeamGameUpsert, RosterOptimizerTeamGameUpsert] {
  const { game, mapping } = args;
  if (!Number.isSafeInteger(game.id) || game.id <= 0) {
    throw new Error("NHL source game id must be a positive integer.");
  }
  if (!Number.isSafeInteger(game.season) || game.season <= 0) {
    throw new Error("NHL source season id must be a positive integer.");
  }
  if (!Number.isSafeInteger(game.gameType) || game.gameType <= 0) {
    throw new Error("NHL game type must be a positive integer.");
  }
  const gameDate = assertExactDate(game.gameDate, "game.gameDate");
  const home = assertTeam(game.homeTeam, "game.homeTeam");
  const away = assertTeam(game.awayTeam, "game.awayTeam");
  if (home.id === away.id) {
    throw new Error(`NHL game ${game.id} has the same team on both sides.`);
  }

  const fetchedAt = normalizeTimestamp(args.fetchedAt, "fetchedAt");
  if (!fetchedAt) throw new Error("fetchedAt is required.");
  const gameStatus = normalizeState(game.gameState);
  const scheduleStatus = normalizeState(game.gameScheduleState);
  const matchupWeek = mapping.status === "mapped" ? mapping.week : null;
  const isCountable = isCountableNhlGame({
    gameType: game.gameType,
    gameState: gameStatus,
    scheduleState: scheduleStatus,
    mappingStatus: mapping.status,
  });
  const common = {
    yahoo_matchup_week_id: matchupWeek?.id ?? null,
    game_key: args.gameKey,
    season: args.yahooSeason,
    week: matchupWeek?.week ?? null,
    source_game_id: game.id,
    source_season_id: game.season,
    game_date: gameDate,
    start_time: normalizeTimestamp(game.startTimeUTC, "game.startTimeUTC"),
    game_type: game.gameType,
    game_status: gameStatus,
    schedule_status: scheduleStatus,
    mapping_status: mapping.status,
    is_countable: isCountable,
    source_url: args.sourceUrl,
    source_updated_at: normalizeTimestamp(
      game.lastUpdatedUTC,
      "game.lastUpdatedUTC",
    ),
    source_metadata: {
      canonicalDateSource: "gameDate",
      mappingReason: mapping.status === "unmapped" ? mapping.reason : null,
      venue: game.venue?.default ?? null,
      venueUTCOffset: game.venueUTCOffset ?? null,
      easternUTCOffset: game.easternUTCOffset ?? null,
    },
    fetched_at: fetchedAt,
  };

  return [
    {
      ...common,
      team_id: away.id,
      team_abbreviation: away.abbreviation,
      opponent_team_id: home.id,
      opponent_abbreviation: home.abbreviation,
      home_away: "away",
    },
    {
      ...common,
      team_id: home.id,
      team_abbreviation: home.abbreviation,
      opponent_team_id: away.id,
      opponent_abbreviation: away.abbreviation,
      home_away: "home",
    },
  ];
}

