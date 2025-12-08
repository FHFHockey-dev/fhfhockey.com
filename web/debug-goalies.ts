import supabase from "./lib/supabase";

async function checkGoalies() {
  const date = "2025-12-06"; // Today
  console.log(`Checking games for ${date}...`);

  const { data: games } = await supabase
    .from("games")
    .select("id")
    .eq("date", date);

  console.log(`Found ${games?.length} games.`);
  if (!games || games.length === 0) return;

  const gameIds = games.map((g) => g.id);

  const { data: goalies, error } = await supabase
    .from("goalie_start_projections")
    .select("*")
    .in("game_id", gameIds);

  if (error) {
    console.error("Error fetching goalies:", error);
  } else {
    console.log(`Found ${goalies?.length} goalie projections.`);
    if (goalies && goalies.length > 0) {
      console.log("Sample goalie:", goalies[0]);
    }
  }
}

checkGoalies();
