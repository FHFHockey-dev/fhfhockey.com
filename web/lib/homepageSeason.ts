import { parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type { Season } from "lib/NHL/types";

/** Match the season choice used by fetchCurrentSeason, without HTTP to our own API. */
export function resolveHomepageSeason(season: Season, now = new Date()) {
  const zone = "America/New_York";
  const previous =
    toZonedTime(now, zone) < toZonedTime(parseISO(season.regularSeasonStartDate), zone) &&
    toZonedTime(now, zone) > toZonedTime(parseISO(season.lastRegularSeasonEndDate), zone);
  const startDate = previous ? season.lastRegularSeasonStartDate : season.regularSeasonStartDate;
  const endDate = previous ? season.lastSeasonEndDate : season.seasonEndDate;
  return {
    startDate,
    endDate,
    isOffseason: now < new Date(startDate) || now > new Date(endDate),
  };
}
