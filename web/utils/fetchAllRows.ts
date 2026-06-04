import { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllSupabasePages } from "lib/supabase/pagination";

export async function fetchAllRows<T>(
  supabase: SupabaseClient,
  tableName: string,
  select: string = "*"
): Promise<T[]> {
  try {
    return await fetchAllSupabasePages<T>(({ from, to }) =>
      supabase
        .from(tableName)
        .select(select)
        .range(from, to) as any
    );
  } catch (error) {
    console.error(`Error fetching data from ${tableName}:`, error);
    return [];
  }
}
