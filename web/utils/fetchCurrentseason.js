// web/utils/fetchCurrentSeason.js

import fetch from "node-fetch";
import Fetch from "lib/cors-fetch";

async function fetchCurrentSeason() {
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
  console.log("fetchCurrentSeason.js Current season:", currentSeason);
  console.log("fetchCurrentSeason.js Previous season:", previousSeason);
  const nextSeason = data.data[2];
  const now = new Date();
  const startDate = new Date(currentSeason.startDate);
  console.log("fetchCurrentSeason.js Current season:", currentSeason);
  console.log("fetchCurrentSeason.js Current Season Start Date:", startDate);

  const endDate = new Date(currentSeason.regularSeasonEndDate);
  const prevEndDate = new Date(previousSeason.regularSeasonEndDate);

  // Calculate playoff start and end dates
  const playoffsStartDate = new Date(currentSeason.regularSeasonEndDate);
  playoffsStartDate.setDate(playoffsStartDate.getDate() + 1);

  const playoffsEndDate = new Date(currentSeason.endDate);

  // Same logic as your TS file
  if (now < startDate && now > prevEndDate) {
    // We treat the previous season as "current" if today's date is between
    // last year's startDate and the new year's startDate.
    return {
      id: previousSeason.id,
      startDate: previousSeason.startDate,
      regularSeasonEndDate: previousSeason.regularSeasonEndDate,
      endDate: previousSeason.regularSeasonEndDate,
      playoffsStartDate: playoffsStartDate.getTime(),
      playoffsEndDate: playoffsEndDate.getTime(),
      previousSeason,
      nextSeason
    };
  } else {
    // Otherwise, use the real current season
    return {
      id: currentSeason.id,
      startDate: currentSeason.startDate,
      regularSeasonEndDate: currentSeason.regularSeasonEndDate,
      endDate: currentSeason.regularSeasonEndDate,
      playoffsStartDate: playoffsStartDate.getTime(),
      playoffsEndDate: playoffsEndDate.getTime(),
      // Provide idPrev and idTwo just like your TS version:
      idPrev: previousSeason.id,
      idTwo: nextSeason.id
    };
  }
}

// Export in ES Modules style
export { fetchCurrentSeason };
