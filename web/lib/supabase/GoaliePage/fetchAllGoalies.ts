// lib/supabase/GoaliePage/fetchAllGoalies.ts

import supabase from "lib/supabase";
import { GoalieStatRaw } from "./types";

/**
 * Fetch all goalie stats for given week IDs with pagination.
 * @param weekIds Array of week IDs to fetch stats for.
 * @returns Promise resolving to an array of GoalieStatRaw.
 */
export async function fetchAllGoalies(
  weekIds: number[]
): Promise<GoalieStatRaw[]> {
  const batchSize = 1000;
  let from = 0;
  let to = batchSize - 1;
  let fetchMore = true;
  let allGoalies: GoalieStatRaw[] = [];

  while (fetchMore) {
    const { data, error } = await supabase
      .from("goalie_page_stats")
      .select("*")
      .in("week_id", weekIds)
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    if (data && data.length > 0) {
      allGoalies = allGoalies.concat(data);
      from += batchSize;
      to += batchSize;
      if (data.length < batchSize) {
        fetchMore = false;
      }
    } else {
      fetchMore = false;
    }
  }

  return allGoalies;
}
