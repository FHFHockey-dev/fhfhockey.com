// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\utils\fetchCurrentSeason.ts

import Fetch from "lib/cors-fetch";

export async function fetchCurrentSeason() {
  console.log("Fetching current season...");
  const response = await Fetch(
    "https://api.nhle.com/stats/rest/en/season?sort=%5B%7B%22property%22:%22id%22,%22direction%22:%22DESC%22%7D%5D"
  );
  const data = await response.json();
  console.log("Season data:", data);

  const currentSeason = data.data[0];
  const previousSeason = data.data[1];
  const now = new Date();
  const startDate = new Date(currentSeason.startDate);
  const endDate = new Date(currentSeason.regularSeasonEndDate);

  if (now < startDate || now > endDate) {
    return previousSeason.id;
  } else {
    return currentSeason.id;
  }
}
