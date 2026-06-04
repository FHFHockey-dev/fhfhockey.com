// /Users/tim/Desktop/fhfhockey.com/web/utils/fetchAllPages.ts

import { fetchAllSupabasePages } from "lib/supabase/pagination";

// Use a broad type for the incoming query builder to avoid mismatched Postgrest generics
type SupabaseQueryBuilder = any;

/**
 * Fetches all pages of data for a given Supabase query.
 * @param queryBuilder The Supabase query builder instance configured with filters, selects, etc.
 * @returns A promise that resolves to an array containing all fetched rows.
 */
export async function fetchAllPages<T = any>(
  queryBuilder: SupabaseQueryBuilder
): Promise<T[]> {
  console.log("Starting fetchAllPages...");

  const allData = await fetchAllSupabasePages<T>(({ from, to, pageIndex }) => {
    console.log(`Fetching page ${pageIndex + 1} (rows ${from} to ${to})...`);
    return queryBuilder.range(from, to);
  });

  console.log(
    `fetchAllPages completed. Total rows fetched: ${allData.length}`
  );
  return allData;
}
