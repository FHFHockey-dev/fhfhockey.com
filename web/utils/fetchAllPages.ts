// /Users/tim/Desktop/fhfhockey.com/web/utils/fetchAllPages.ts

import { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { SupabaseClient } from "@supabase/supabase-js";
import supabase from "lib/supabase";

// Define a generic type for the query builder
type SupabaseQueryBuilder = PostgrestFilterBuilder<any, any, any[], any>;

const SUPABASE_PAGE_SIZE = 1000;

// --- PERFORMANCE CACHE ---
interface CacheEntry<T> {
  data: T[];
  timestamp: number;
  queryKey: string;
}

class QueryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes cache

  generateKey(query: string, filters: any): string {
    return `${query}_${JSON.stringify(filters)}`;
  }

  get<T>(key: string): T[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T[];
  }

  set<T>(key: string, data: T[], queryKey: string): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      queryKey
    });
  }

  clear(): void {
    this.cache.clear();
  }

  // Clear cache entries for specific table
  clearTable(tableName: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.queryKey.includes(tableName)) {
        this.cache.delete(key);
      }
    }
  }
}

const queryCache = new QueryCache();

/**
 * Enhanced fetchAllPages with caching and performance optimizations
 */
export async function fetchAllPages<T = any>(
  queryBuilder: SupabaseQueryBuilder,
  options: {
    useCache?: boolean;
    cacheKey?: string;
    onProgress?: (progress: { loaded: number; total?: number }) => void;
  } = {}
): Promise<T[]> {
  const { useCache = true, cacheKey, onProgress } = options;

  // Generate cache key if caching enabled
  let cacheKeyFinal = "";
  if (useCache) {
    cacheKeyFinal =
      cacheKey ||
      queryCache.generateKey(
        queryBuilder.toString(),
        (queryBuilder as any)._url || "unknown"
      );

    const cached = queryCache.get<T>(cacheKeyFinal);
    if (cached) {
      console.log(`Cache hit for query: ${cacheKeyFinal.substring(0, 50)}...`);
      onProgress?.({ loaded: cached.length, total: cached.length });
      return cached;
    }
  }

  let allData: T[] = [];
  let currentPage = 0;
  let moreDataAvailable = true;
  let estimatedTotal: number | undefined;

  console.log("Starting optimized fetchAllPages...");

  while (moreDataAvailable) {
    const from = currentPage * SUPABASE_PAGE_SIZE;
    const to = from + SUPABASE_PAGE_SIZE - 1;

    console.log(`Fetching page ${currentPage + 1} (rows ${from} to ${to})...`);

    // Clone the query builder to avoid modifying the original
    const pageQuery = queryBuilder.range(from, to);

    try {
      const { data, error, count } = await pageQuery;

      if (error) {
        console.error("Error fetching page:", error);
        // Don't cache failed queries
        throw error;
      }

      if (data && data.length > 0) {
        console.log(`Fetched ${data.length} rows for page ${currentPage + 1}.`);
        allData = allData.concat(data as T[]);

        // Update progress with better estimation
        if (count !== null && !estimatedTotal) {
          estimatedTotal = count;
        }

        onProgress?.({
          loaded: allData.length,
          total: estimatedTotal
        });
      } else {
        console.log(`No data found for page ${currentPage + 1}.`);
      }

      // Check if we need to fetch more data
      if (!data || data.length < SUPABASE_PAGE_SIZE) {
        moreDataAvailable = false;
        console.log("Last page fetched.");
      } else {
        currentPage++;
      }
    } catch (fetchError: any) {
      console.error(`Failed to fetch page ${currentPage + 1}:`, fetchError);
      throw fetchError;
    }
  }

  const finalCount = allData.length;
  console.log(`Enhanced fetchAllPages completed. Total rows: ${finalCount}`);

  // Cache successful results
  if (useCache && finalCount > 0) {
    queryCache.set(cacheKeyFinal, allData, queryBuilder.toString());
  }

  onProgress?.({ loaded: finalCount, total: finalCount });
  return allData;
}
