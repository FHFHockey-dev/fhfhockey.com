import supabase from "lib/supabase";

export async function fetchAllGameLogRows(
  supabaseClient: typeof supabase,
  table: any,
  idField: string,
  playerIdNum: number,
  seasonField: string,
  selectedSeason: string | number,
  selectFields: string
): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let allRows: any[] = [];
  let from = 0;
  let to = PAGE_SIZE - 1;
  let keepFetching = true;

  while (keepFetching) {
    const { data, error } = await supabaseClient
      .from(table)
      .select(selectFields)
      .eq(idField, playerIdNum)
      .eq(seasonField, selectedSeason)
      .order("date", { ascending: false })
      .range(from, to);

    if (error) break;
    if (data && data.length > 0) {
      allRows = allRows.concat(data);
      if (data.length < PAGE_SIZE) {
        keepFetching = false;
      } else {
        from += PAGE_SIZE;
        to += PAGE_SIZE;
      }
    } else {
      keepFetching = false;
    }
  }
  return allRows;
}
