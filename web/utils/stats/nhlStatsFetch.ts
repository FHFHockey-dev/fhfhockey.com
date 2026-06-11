import supabase from "lib/supabase";
import { fetchAllSupabasePages } from "lib/supabase/pagination";

export async function fetchAllGameLogRows(
  supabaseClient: typeof supabase,
  table: any,
  idField: string,
  playerIdNum: number,
  seasonField: string,
  selectedSeason: string | number,
  selectFields: string
): Promise<any[]> {
  try {
    return await fetchAllSupabasePages<any>(({ from, to }) =>
      supabaseClient
        .from(table)
        .select(selectFields)
        .eq(idField, playerIdNum)
        .eq(seasonField, selectedSeason)
        .order("date", { ascending: false })
        .range(from, to) as any
    );
  } catch (error) {
    console.error(`Error fetching data from ${table}:`, error);
    return [];
  }
}
