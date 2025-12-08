import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, ".env.local") });
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
  const { data, error } = await supabase.from("pbp_games").select("*").limit(1);

  if (error) {
    console.error("Error fetching pbp_games:", error);
  } else {
    console.log(
      "pbp_games columns:",
      data.length > 0 ? Object.keys(data[0]) : "Table empty"
    );
  }
}

checkTable();
