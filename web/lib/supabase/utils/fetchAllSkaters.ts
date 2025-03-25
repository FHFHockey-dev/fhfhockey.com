// lib/supabase/utils/fetchNonGoaliePlayers.ts

import supabase from "lib/supabase";

export async function fetchNonGoaliePlayerIds(): Promise<string[]> {
  let playerIds: string[] = [];
  let page = 0;
  const pageSize = 1000;
  let moreRecords = true;

  while (moreRecords) {
    const { data, error } = await supabase
      .from("players")
      .select("id")
      .neq("position", "G")
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error("Error fetching non-goalie player IDs:", error);
      throw error;
    }

    if (data) {
      playerIds.push(...data.map((player) => player.id.toString()));
      // If less than the page size, this was the last page.
      moreRecords = data.length === pageSize;
      page++;
    } else {
      moreRecords = false;
    }
  }

  return playerIds;
}
