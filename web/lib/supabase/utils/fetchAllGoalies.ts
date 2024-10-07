// lib/supabaseUtils.ts

import supabase from "lib/supabase";

// Define the structure for goalie data
interface Goalie {
  id: number;
  fullName: string;
  position: string;
}

export async function fetchAllGoalies(): Promise<Goalie[]> {
  const { data, error } = await supabase
    .from("players")
    .select("id, fullName, position")
    .eq("position", "G");

  if (error) {
    throw new Error(`Error fetching goalies: ${error.message}`);
  }

  return data as Goalie[];
}
