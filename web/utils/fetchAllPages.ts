// /Users/tim/Desktop/fhfhockey.com/web/utils/fetchAllPages.ts

import supabase from "lib/supabase";

// Use a broad type for the incoming query builder to avoid mismatched Postgrest generics
type SupabaseQueryBuilder = any;

const SUPABASE_PAGE_SIZE = 1000; // Match your constant

/**
 * Fetches all pages of data for a given Supabase query.
 * @param queryBuilder The Supabase query builder instance configured with filters, selects, etc.
 * @returns A promise that resolves to an array containing all fetched rows.
 */
export async function fetchAllPages<T = any>(
  queryBuilder: SupabaseQueryBuilder
): Promise<T[]> {
  let allData: T[] = [];
  let currentPage = 0;
  let moreDataAvailable = true;

  console.log("Starting fetchAllPages...");

  while (moreDataAvailable) {
    const from = currentPage * SUPABASE_PAGE_SIZE;
    const to = from + SUPABASE_PAGE_SIZE - 1;

    console.log(
      `Workspaceing page ${currentPage + 1} (rows ${from} to ${to})...`
    );

    // Clone the query builder before applying range to avoid modifying the original
    // if it were somehow reused (though usually not an issue in this pattern)
    const pageQuery = queryBuilder.range(from, to);

    const { data, error, count } = await pageQuery; // Fetch the specific page

    if (error) {
      console.error("Error fetching page:", error);
      throw error; // Re-throw the error to be caught by the calling function
    }

    if (data && data.length > 0) {
      console.log(
        `Workspaceed ${data.length} rows for page ${currentPage + 1}.`
      );
      allData = allData.concat(data as T[]); // Add fetched data to the accumulator
    } else {
      console.log(`No data found for page ${currentPage + 1}.`);
    }

    // Check if we need to fetch more data
    if (!data || data.length < SUPABASE_PAGE_SIZE) {
      moreDataAvailable = false;
      console.log("Last page fetched.");
    } else {
      currentPage++; // Prepare for the next page
    }
  }

  console.log(
    `WorkspaceAllPages completed. Total rows fetched: ${allData.length}`
  );
  return allData;
}
