import { SupabaseClient } from "@supabase/supabase-js";

export async function fetchAllRows<T>(
  supabase: SupabaseClient,
  tableName: string,
  select: string = "*"
): Promise<T[]> {
  let allData: T[] = [];
  let hasMore = true;
  let page = 0;
  const pageSize = 1000; // Supabase maximum limit per request

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select(select)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error(`Error fetching data from ${tableName}:`, error);
      break;
    }

    if (data && data.length > 0) {
      allData = allData.concat(data as unknown as T[]); // Cast `data` to `unknown` first and then to `T[]`
      page += 1;
      if (data.length < pageSize) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  return allData;
}
