export type TravelFatigueFeatureAvailability = "pregame_safe";
export type TravelDirection = "east" | "west" | "none" | "unknown";

export type TravelFatigueGameRow = {
  id: number;
  seasonId: number | null;
  date: string | null;
  startTime: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  type?: number | null;
};

export type TeamGameTravelFatigueFeatureRow = {
  travel_fatigue_version: string;
  season_id: number | null;
  game_id: number;
  game_date: string | null;
  game_type: number | null;
  team_id: number;
  opponent_team_id: number | null;
  is_home: boolean;
  start_time_utc: string;
  venue_team_id: number | null;
  venue_timezone: string | null;
  venue_timezone_source: "home_team_inference" | "missing_home_team_timezone";
  team_home_timezone: string | null;
  local_puck_drop_date: string | null;
  local_puck_drop_hour: number | null;
  team_body_clock_puck_drop_hour: number | null;
  body_clock_delta_hours: number | null;
  previous_game_id: number | null;
  previous_game_start_time_utc: string | null;
  previous_is_home: boolean | null;
  previous_venue_timezone: string | null;
  hours_since_previous_game: number | null;
  rest_days: number | null;
  is_back_to_back: boolean;
  games_in_last_4_days: number;
  games_in_last_7_days: number;
  games_in_last_14_days: number;
  is_three_in_four: boolean;
  road_trip_game_number: number;
  home_stand_game_number: number;
  timezone_delta_hours_from_previous_game: number | null;
  abs_timezone_delta_hours_from_previous_game: number | null;
  travel_direction_from_previous_game: TravelDirection;
  next_game_id: number | null;
  next_game_start_time_utc: string | null;
  next_is_home: boolean | null;
  hours_until_next_game: number | null;
  is_neutral_site_inferred: boolean;
  source_scope: "schedule_derived";
  feature_availability: TravelFatigueFeatureAvailability;
  provenance: Record<string, unknown>;
  updated_at: string;
};

type TeamScheduleItem = {
  game: TravelFatigueGameRow;
  teamId: number;
  opponentTeamId: number | null;
  isHome: boolean;
  venueTeamId: number | null;
  startDate: Date;
};

export const NHL_TEAM_TIMEZONES_BY_ID: Record<number, string> = {
  1: "America/New_York",
  2: "America/New_York",
  3: "America/New_York",
  4: "America/New_York",
  5: "America/New_York",
  6: "America/New_York",
  7: "America/New_York",
  8: "America/Toronto",
  9: "America/Toronto",
  10: "America/Toronto",
  12: "America/New_York",
  13: "America/New_York",
  14: "America/New_York",
  15: "America/New_York",
  16: "America/Chicago",
  17: "America/New_York",
  18: "America/Chicago",
  19: "America/Chicago",
  20: "America/Edmonton",
  21: "America/Denver",
  22: "America/Edmonton",
  23: "America/Vancouver",
  24: "America/Los_Angeles",
  25: "America/Chicago",
  26: "America/Los_Angeles",
  28: "America/Los_Angeles",
  29: "America/New_York",
  30: "America/Chicago",
  52: "America/Winnipeg",
  53: "America/Phoenix",
  54: "America/Los_Angeles",
  55: "America/Los_Angeles",
  59: "America/Denver",
};

function roundMetric(value: number): number {
  return Number(value.toFixed(6));
}

function asFiniteNumber(value: number | null | undefined): number | null {
  return Number.isFinite(value) ? Number(value) : null;
}

function validDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function localParts(date: Date, timeZone: string): {
  date: string;
  hour: number;
  minute: number;
} | null {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const parts = formatter.formatToParts(date);
    const value = (type: string) => parts.find((part) => part.type === type)?.value;
    const year = value("year");
    const month = value("month");
    const day = value("day");
    const hour = Number(value("hour"));
    const minute = Number(value("minute"));
    if (!year || !month || !day || !Number.isFinite(hour) || !Number.isFinite(minute)) {
      return null;
    }
    return { date: `${year}-${month}-${day}`, hour, minute };
  } catch {
    return null;
  }
}

function timezoneOffsetHours(date: Date, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
      hour: "2-digit",
    }).formatToParts(date);
    const label = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    if (label === "GMT" || label === "UTC") return 0;
    const match = label.match(/^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/);
    if (!match) return null;
    const sign = match[1] === "-" ? -1 : 1;
    const hours = Number(match[2]);
    const minutes = Number(match[3] ?? "0");
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return sign * (hours + minutes / 60);
  } catch {
    return null;
  }
}

function dayOrdinal(dateValue: string | null): number | null {
  if (!dateValue) return null;
  const [year, month, day] = dateValue.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function restDaysBetween(previousDate: string | null, currentDate: string | null): number | null {
  const previous = dayOrdinal(previousDate);
  const current = dayOrdinal(currentDate);
  if (previous == null || current == null) return null;
  return Math.max(0, current - previous - 1);
}

function hourOfDay(parts: { hour: number; minute: number } | null): number | null {
  if (!parts) return null;
  return roundMetric(parts.hour + parts.minute / 60);
}

function hoursBetween(left: Date, right: Date): number {
  return roundMetric((right.getTime() - left.getTime()) / 3600000);
}

function gamesSince(items: TeamScheduleItem[], index: number, hours: number): number {
  const current = items[index]!;
  const cutoffMs = hours * 3600000;
  let count = 0;
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    if (current.startDate.getTime() - items[cursor]!.startDate.getTime() <= cutoffMs) {
      count += 1;
    }
  }
  return count;
}

function travelDirection(delta: number | null): TravelDirection {
  if (delta == null) return "unknown";
  if (delta > 0) return "east";
  if (delta < 0) return "west";
  return "none";
}

function sourceProvenance(args: {
  version: string;
  generatedAt: string;
  timezoneSource: string;
}) {
  return {
    sourceTables: ["games"],
    travelFatigueVersion: args.version,
    sourceScope: "schedule_derived",
    featureAvailability: "pregame_safe",
    timezoneSource: args.timezoneSource,
    neutralSiteHandling: "no venue override available; venue timezone inferred from home team",
    generatedAt: args.generatedAt,
  };
}

export function buildTeamGameTravelFatigueFeatures(args: {
  games: TravelFatigueGameRow[];
  version?: string;
  generatedAt?: string;
  teamTimezonesById?: Record<number, string>;
}): TeamGameTravelFatigueFeatureRow[] {
  const version = args.version ?? "travel_fatigue_v1";
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const teamTimezonesById = args.teamTimezonesById ?? NHL_TEAM_TIMEZONES_BY_ID;
  const byTeam = new Map<number, TeamScheduleItem[]>();

  for (const game of args.games) {
    const startDate = validDate(game.startTime);
    if (!startDate) continue;
    const teams = [
      {
        teamId: asFiniteNumber(game.homeTeamId),
        opponentTeamId: asFiniteNumber(game.awayTeamId),
        isHome: true,
      },
      {
        teamId: asFiniteNumber(game.awayTeamId),
        opponentTeamId: asFiniteNumber(game.homeTeamId),
        isHome: false,
      },
    ];

    for (const team of teams) {
      if (team.teamId == null) continue;
      const current = byTeam.get(team.teamId) ?? [];
      current.push({
        game,
        teamId: team.teamId,
        opponentTeamId: team.opponentTeamId,
        isHome: team.isHome,
        venueTeamId: asFiniteNumber(game.homeTeamId),
        startDate,
      });
      byTeam.set(team.teamId, current);
    }
  }

  const rows: TeamGameTravelFatigueFeatureRow[] = [];
  for (const items of byTeam.values()) {
    const sorted = [...items].sort((left, right) => {
      const startDelta = left.startDate.getTime() - right.startDate.getTime();
      return startDelta !== 0 ? startDelta : left.game.id - right.game.id;
    });

    let roadTripGameNumber = 0;
    let homeStandGameNumber = 0;
    for (let index = 0; index < sorted.length; index += 1) {
      const item = sorted[index]!;
      const previous = sorted[index - 1] ?? null;
      const next = sorted[index + 1] ?? null;
      const venueTimezone =
        item.venueTeamId == null ? null : teamTimezonesById[item.venueTeamId] ?? null;
      const teamHomeTimezone = teamTimezonesById[item.teamId] ?? null;
      const previousVenueTimezone =
        previous?.venueTeamId == null ? null : teamTimezonesById[previous.venueTeamId] ?? null;
      const nextVenueTimezone =
        next?.venueTeamId == null ? null : teamTimezonesById[next.venueTeamId] ?? null;

      const localPuckDrop = venueTimezone ? localParts(item.startDate, venueTimezone) : null;
      const teamBodyClock = teamHomeTimezone ? localParts(item.startDate, teamHomeTimezone) : null;
      const localPuckDropHour = hourOfDay(localPuckDrop);
      const teamBodyClockPuckDropHour = hourOfDay(teamBodyClock);
      const bodyClockDeltaHours =
        localPuckDropHour != null && teamBodyClockPuckDropHour != null
          ? roundMetric(localPuckDropHour - teamBodyClockPuckDropHour)
          : null;

      const previousLocalDate =
        previous && previousVenueTimezone
          ? localParts(previous.startDate, previousVenueTimezone)?.date ?? previous.game.date
          : null;
      const restDays = previous
        ? restDaysBetween(previousLocalDate, localPuckDrop?.date ?? item.game.date)
        : null;
      const hoursSincePreviousGame = previous ? hoursBetween(previous.startDate, item.startDate) : null;
      const gamesInLast4Days = gamesSince(sorted, index, 96);
      const gamesInLast7Days = gamesSince(sorted, index, 168);
      const gamesInLast14Days = gamesSince(sorted, index, 336);

      if (item.isHome) {
        homeStandGameNumber += 1;
        roadTripGameNumber = 0;
      } else {
        roadTripGameNumber = previous && !previous.isHome ? roadTripGameNumber + 1 : 1;
        homeStandGameNumber = 0;
      }

      const currentOffset = venueTimezone ? timezoneOffsetHours(item.startDate, venueTimezone) : null;
      const previousOffset =
        previous && previousVenueTimezone
          ? timezoneOffsetHours(item.startDate, previousVenueTimezone)
          : null;
      const timezoneDelta =
        currentOffset != null && previousOffset != null
          ? roundMetric(currentOffset - previousOffset)
          : null;

      rows.push({
        travel_fatigue_version: version,
        season_id: item.game.seasonId,
        game_id: item.game.id,
        game_date: item.game.date,
        game_type: item.game.type ?? null,
        team_id: item.teamId,
        opponent_team_id: item.opponentTeamId,
        is_home: item.isHome,
        start_time_utc: item.game.startTime,
        venue_team_id: item.venueTeamId,
        venue_timezone: venueTimezone,
        venue_timezone_source: venueTimezone
          ? "home_team_inference"
          : "missing_home_team_timezone",
        team_home_timezone: teamHomeTimezone,
        local_puck_drop_date: localPuckDrop?.date ?? null,
        local_puck_drop_hour: localPuckDropHour,
        team_body_clock_puck_drop_hour: teamBodyClockPuckDropHour,
        body_clock_delta_hours: bodyClockDeltaHours,
        previous_game_id: previous?.game.id ?? null,
        previous_game_start_time_utc: previous?.game.startTime ?? null,
        previous_is_home: previous?.isHome ?? null,
        previous_venue_timezone: previousVenueTimezone,
        hours_since_previous_game: hoursSincePreviousGame,
        rest_days: restDays,
        is_back_to_back: restDays === 0 && (hoursSincePreviousGame ?? Number.POSITIVE_INFINITY) <= 36,
        games_in_last_4_days: gamesInLast4Days,
        games_in_last_7_days: gamesInLast7Days,
        games_in_last_14_days: gamesInLast14Days,
        is_three_in_four: gamesInLast4Days >= 3,
        road_trip_game_number: roadTripGameNumber,
        home_stand_game_number: homeStandGameNumber,
        timezone_delta_hours_from_previous_game: timezoneDelta,
        abs_timezone_delta_hours_from_previous_game:
          timezoneDelta == null ? null : Math.abs(timezoneDelta),
        travel_direction_from_previous_game: travelDirection(timezoneDelta),
        next_game_id: next?.game.id ?? null,
        next_game_start_time_utc: next?.game.startTime ?? null,
        next_is_home: next?.isHome ?? null,
        hours_until_next_game: next ? hoursBetween(item.startDate, next.startDate) : null,
        is_neutral_site_inferred: false,
        source_scope: "schedule_derived",
        feature_availability: "pregame_safe",
        provenance: sourceProvenance({
          version,
          generatedAt,
          timezoneSource: venueTimezone ? "home_team_inference" : "missing_home_team_timezone",
        }),
        updated_at: generatedAt,
      });
    }
  }

  return rows.sort((left, right) => {
    const gameDelta = left.game_id - right.game_id;
    return gameDelta !== 0 ? gameDelta : left.team_id - right.team_id;
  });
}
