// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\utils\fetchScheduleData.ts

import Fetch from "lib/cors-fetch";

export async function fetchScheduleData(teamAbbr: string, seasonId: number) {
  const url = `https://api-web.nhle.com/v1/club-schedule-season/${teamAbbr}/${seasonId}`;
  console.log("Fetching schedule data from URL:", url);
  const response = await Fetch(url);
  const data = await response.json();
  console.log("Schedule data:", data);
  return data.games;
}
