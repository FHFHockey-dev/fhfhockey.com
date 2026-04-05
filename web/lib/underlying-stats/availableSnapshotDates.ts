import type { SupabaseClient } from "@supabase/supabase-js";
import supabaseServer from "../supabase/server";

const DEFAULT_DISTINCT_DATE_LIMIT = 90;
const SNAPSHOT_DATE_PAGE_SIZE = 128;

type SnapshotDateRow = {
  date: string | null;
};

const isNonEmptyDate = (value: string | null): value is string =>
  typeof value === "string" && value.length > 0;

export const fetchDistinctUnderlyingStatsSnapshotDates = async (
  limit = DEFAULT_DISTINCT_DATE_LIMIT,
  supabase: SupabaseClient = supabaseServer
): Promise<string[]> => {
  if (limit <= 0) {
    return [];
  }

  const distinctDates: string[] = [];
  const seenDates = new Set<string>();
  let offset = 0;

  while (distinctDates.length < limit) {
    const { data, error } = await supabase
      .from("team_power_ratings_daily")
      .select("date")
      .order("date", { ascending: false })
      .range(offset, offset + SNAPSHOT_DATE_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const rows = Array.isArray(data) ? (data as SnapshotDateRow[]) : [];

    rows
      .map((row) => row.date)
      .filter(isNonEmptyDate)
      .forEach((date) => {
        if (seenDates.has(date)) {
          return;
        }
        seenDates.add(date);
        distinctDates.push(date);
      });

    if (rows.length < SNAPSHOT_DATE_PAGE_SIZE) {
      break;
    }

    offset += SNAPSHOT_DATE_PAGE_SIZE;
  }

  return distinctDates.slice(0, limit);
};
