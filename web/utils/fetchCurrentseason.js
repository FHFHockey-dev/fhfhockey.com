// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\utils\fetchCurrentseason.js

import fetch from "node-fetch";

async function fetchCurrentSeason() {
  console.log("Fetching current season...");
  const response = await fetch(
    "https://api.nhle.com/stats/rest/en/season?sort=%5B%7B%22property%22:%22id%22,%22direction%22:%22DESC%22%7D%5D"
  );
  const data = await response.json();
  console.log("Season data:", data);

  const currentSeason = data.data[0];
  const previousSeason = data.data[1];
  const now = new Date();
  const startDate = new Date(currentSeason.startDate);
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
      endDate: previousSeason.regularSeasonEndDate,
      playoffsStartDate: new Date(previousSeason.regularSeasonEndDate).setDate(
        new Date(previousSeason.regularSeasonEndDate).getDate() + 1
      ),
      playoffsEndDate: new Date(previousSeason.endDate),
    };
  } else {
    return {
      id: currentSeason.id,
      startDate: currentSeason.startDate,
      endDate: currentSeason.regularSeasonEndDate,
      playoffsStartDate,
      playoffsEndDate,
    };
  }
}

// Use ES Modules export
export { fetchCurrentSeason };
