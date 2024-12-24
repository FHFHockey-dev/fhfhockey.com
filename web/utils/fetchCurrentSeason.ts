// web/utils/fetchCurrentSeason.ts

import Fetch from "lib/cors-fetch";

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

console.log("fetchCurrentSeason.ts ///////////////////");

export async function fetchCurrentSeason(): Promise<SeasonInfo> {
  console.log("Fetching current season...");
  const response = await Fetch(
    "https://api.nhle.com/stats/rest/en/season?sort=%5B%7B%22property%22:%22id%22,%22direction%22:%22DESC%22%7D%5D"
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch season data: ${response.statusText}`);
  }

  const data = await response.json();
  // console.log("Season data:", data);

  const currentSeason = data.data[0];
  const previousSeason = data.data[1];
  const nextSeason = data.data[2];
  const now = new Date();
  const startDate = new Date(currentSeason.startDate);
  console.log("fetchCurrentSeason.ts Current season:", currentSeason);
  console.log("fetchCurrentSeason.ts Current Season Start Date:", startDate);
  const endDate = new Date(currentSeason.regularSeasonEndDate);
  const prevEndDate = new Date(previousSeason.regularSeasonEndDate);

  // Calculate playoff start and end dates
  const playoffsStartDate = new Date(currentSeason.regularSeasonEndDate);
  playoffsStartDate.setDate(playoffsStartDate.getDate() + 1);

  const playoffsEndDate = new Date(currentSeason.endDate);

  if (now < startDate && now > prevEndDate) {
    return {
      id: previousSeason.id,
      startDate: previousSeason.startDate,
      regularSeasonEndDate: previousSeason.regularSeasonEndDate, // Added
      endDate: previousSeason.regularSeasonEndDate,
      playoffsStartDate: playoffsStartDate.getTime(), // Convert to timestamp
      playoffsEndDate: playoffsEndDate.getTime(), // Convert to timestamp
      previousSeason,
      nextSeason
    };
  } else {
    return {
      id: currentSeason.id,
      startDate: currentSeason.startDate,
      regularSeasonEndDate: currentSeason.regularSeasonEndDate, // Added
      endDate: currentSeason.regularSeasonEndDate,
      playoffsStartDate: playoffsStartDate.getTime(), // Convert to timestamp
      playoffsEndDate: playoffsEndDate.getTime(), // Convert to timestamp
      idPrev: previousSeason.id,
      idTwo: nextSeason.id
    };
  }
}
