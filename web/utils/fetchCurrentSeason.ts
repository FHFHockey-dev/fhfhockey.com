// web/utils/fetchCurrentSeason.ts

import Fetch from "lib/cors-fetch";
import { toZonedTime } from "date-fns-tz";
import { parseISO } from "date-fns";

export interface SeasonInfo {
  id: number;
  startDate: string;
  regularSeasonEndDate: string;
  endDate: string;
  playoffsStartDate: number; // Timestamp
  playoffsEndDate: number; // Timestamp
  previousSeason?: SeasonInfo;
  nextSeason?: SeasonInfo;
  idPrev?: number;
  idTwo?: number;
}

// console marker removed for production noise reduction

export async function fetchCurrentSeason(): Promise<SeasonInfo> {
  console.log("Fetching current season...");

  const timeZone = "America/New_York";

  // Prefer our internal API (stable, backed by DB), then fall back to NHL API
  const isServer = typeof window === "undefined";
  const apiPath = "/api/v1/season";

  try {
    const base = isServer
      ? process.env.NEXT_PUBLIC_SITE_URL ||
        `http://localhost:${process.env.PORT || 3000}`
      : "";
    if (isServer && process.env.NODE_ENV !== "production") {
      console.log(`[season] GET ${base}${apiPath}`);
    }
    const res = await fetch(`${base}${apiPath}`);
    if (!res.ok) {
      let body = "";
      try {
        body = await res.text();
      } catch (_) {}
      throw new Error(
        `Internal API error ${res.status}${body ? ` – ${body.slice(0, 300)}` : ""}`
      );
    }
    const s = await res.json();

    const now = toZonedTime(new Date(), timeZone);
    const currentStart = toZonedTime(
      parseISO(s.regularSeasonStartDate),
      timeZone
    );
    const prevRegEnd = toZonedTime(
      parseISO(s.lastRegularSeasonEndDate),
      timeZone
    );

    // Helper to build SeasonInfo from fields
    const toSeasonInfo = (
      id: number,
      start: string,
      regEnd: string,
      end: string,
      idPrev?: number,
      idTwo?: number
    ): SeasonInfo => {
      const playoffsStart = toZonedTime(parseISO(regEnd), timeZone);
      playoffsStart.setDate(playoffsStart.getDate() + 1);
      const playoffsEnd = toZonedTime(parseISO(end), timeZone);
      return {
        id,
        startDate: start,
        regularSeasonEndDate: regEnd,
        endDate: end,
        playoffsStartDate: playoffsStart.getTime(),
        playoffsEndDate: playoffsEnd.getTime(),
        idPrev,
        idTwo
      } as SeasonInfo;
    };

    // If before current season start but after last season regular season end, use last season
    if (now < currentStart && now > prevRegEnd) {
      return toSeasonInfo(
        s.lastSeasonId,
        s.lastRegularSeasonStartDate,
        s.lastRegularSeasonEndDate,
        s.lastSeasonEndDate,
        undefined,
        s.seasonId
      );
    }

    return toSeasonInfo(
      s.seasonId,
      s.regularSeasonStartDate,
      s.regularSeasonEndDate,
      s.seasonEndDate,
      s.lastSeasonId,
      undefined
    );
  } catch (internalErr) {
    console.warn(
      "Internal season API failed, falling back to NHL API:",
      internalErr
    );

    // Fallback to NHL public endpoint (may be unstable)
    const response = await Fetch(
      "https://api.nhle.com/stats/rest/en/season?sort=%5B%7B%22property%22:%22id%22,%22direction%22:%22DESC%22%7D%5D"
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch season data: ${response.statusText}`);
    }
    const data = await response.json();
    const currentSeason = data.data[0];
    const previousSeason = data.data[1];
    // This is a bug, it's actually two seasons ago.
    // const nextSeason = data.data[2];

    const now = toZonedTime(new Date(), timeZone);
    const startDate = toZonedTime(parseISO(currentSeason.startDate), timeZone);
    const prevEndDate = toZonedTime(
      parseISO(previousSeason.regularSeasonEndDate),
      timeZone
    );

    const playoffsStartDate = toZonedTime(
      parseISO(currentSeason.regularSeasonEndDate),
      timeZone
    );
    playoffsStartDate.setDate(playoffsStartDate.getDate() + 1);
    const playoffsEndDate = toZonedTime(
      parseISO(currentSeason.endDate),
      timeZone
    );

    const prevPlayoffsStartDate = toZonedTime(
      parseISO(previousSeason.regularSeasonEndDate),
      timeZone
    );
    prevPlayoffsStartDate.setDate(prevPlayoffsStartDate.getDate() + 1);
    const prevPlayoffsEndDate = toZonedTime(
      parseISO(previousSeason.endDate),
      timeZone
    );

    if (now < startDate && now > prevEndDate) {
      return {
        id: previousSeason.id,
        startDate: previousSeason.startDate,
        regularSeasonEndDate: previousSeason.regularSeasonEndDate,
        endDate: previousSeason.endDate,
        playoffsStartDate: prevPlayoffsStartDate.getTime(),
        playoffsEndDate: prevPlayoffsEndDate.getTime(),
        previousSeason
      } as SeasonInfo;
    } else {
      return {
        id: currentSeason.id,
        startDate: currentSeason.startDate,
        regularSeasonEndDate: currentSeason.regularSeasonEndDate,
        endDate: currentSeason.endDate,
        playoffsStartDate: playoffsStartDate.getTime(),
        playoffsEndDate: playoffsEndDate.getTime(),
        idPrev: previousSeason.id
      } as SeasonInfo;
    }
  }
}
