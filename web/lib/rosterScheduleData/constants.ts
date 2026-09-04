export const DEFAULT_YAHOO_GAME_KEY = "477";

export const DEFAULT_MATCHUP_WEEK_RANGE = Object.freeze({
  startWeek: 1,
  endWeek: 30,
});

export const MAX_MATCHUP_WEEK_SPAN = 40;
export const MAX_BOUNDED_REFRESH_DAYS = 45;
export const DEFAULT_BOUNDED_REFRESH_PAST_DAYS = 2;
export const DEFAULT_BOUNDED_REFRESH_FUTURE_DAYS = 21;

export const ROSTER_SCHEDULE_CACHE_VERSION = "roster-team-games.v1";
export const ROSTER_SCHEDULE_UPSERT_CONFLICT =
  "game_key,source_game_id,team_id";

