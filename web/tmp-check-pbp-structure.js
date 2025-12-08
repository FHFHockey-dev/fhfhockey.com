async function Fetch(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  return response.json();
}

async function checkPbP() {
  const gameId = 2025020461; // Use a valid game ID
  const url = `https://api-web.nhle.com/v1/gamecenter/${gameId}/play-by-play`;
  try {
    const data = await Fetch(url);
    console.log(Object.keys(data));
    console.log("Away Team:", data.awayTeam);
    console.log("Home Team:", data.homeTeam);
    console.log("Venue:", data.venue);
    console.log("ID:", data.id);
  } catch (error) {
    console.error("Error fetching PbP:", error);
  }
}

checkPbP();
