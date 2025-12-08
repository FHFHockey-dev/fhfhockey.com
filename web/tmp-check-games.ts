import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, ".env.local") });
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGames() {
  const today = "2025-12-08";
  console.log(`Checking games for ${today}...`);

  const { data: games, error } = await supabase
    .from("games")
    .select("*")
    .eq("date", today);

  if (error) {
    console.error("Error fetching games:", error);
  } else {
    console.log(`Found ${games.length} games for ${today}`);
    if (games.length > 0) {
      console.log(games[0]);
    }
  }

  const { data: seasons, error: seasonError } = await supabase
    .from("seasons")
    .select("*")
    .eq("id", 20252026);

  if (seasonError) {
    console.error("Error fetching season:", seasonError);
  } else {
    console.log(`Found season 20252026:`, seasons);
  }
}

checkGames();
