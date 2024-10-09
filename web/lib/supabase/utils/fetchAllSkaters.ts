// lib/supabase/utils/fetchNonGoaliePlayers.ts

import supabase from "lib/supabase";

export async function fetchNonGoaliePlayerIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("players") //
    .select("id")
    .neq("position", "G"); // Exclude goalies

  if (error) {
    console.error("Error fetching non-goalie player IDs:", error);
    throw error;
  }

  return data.map((player) => player.id.toString());
}
