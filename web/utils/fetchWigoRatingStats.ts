// web/utils/fetchWigoRatingStats.ts (or similar file)

import supabase from "lib/supabase"; // Adjust path as needed
import { Database } from "lib/supabase/database-generated.types"; // Adjust path
import {
  PlayerStrengthStats,
  RawStatsCollection,
  Strength
  // RatingWeightsConfig // No longer needed directly here
} from "components/WiGO/types"; // Adjust path
import {
  RATING_WEIGHTS, // Keep weights import if needed elsewhere, otherwise remove
  getOffenseStatsUsedInWeights, // NEW HELPER
  getDefenseStatsUsedInWeights
} from "components/WiGO/ratingWeights"; // Adjust path
// Assuming fetchPaginatedData is in a separate file or imported correctly
import { fetchPaginatedData } from "./fetchWigoPlayerStats";

// Define the mapping from strength/type to actual table names
const TABLE_MAP: { [key in Strength]: { offense: string; defense: string } } = {
  as: {
    offense: "nst_percentile_as_offense",
    defense: "nst_percentile_as_defense"
  },
  es: {
    offense: "nst_percentile_es_offense",
    defense: "nst_percentile_es_defense"
  },
  pp: {
    offense: "nst_percentile_pp_offense",
    defense: "nst_percentile_pp_defense"
  },
  pk: {
    offense: "nst_percentile_pk_offense",
    defense: "nst_percentile_pk_defense"
  }
};

/**
 * Fetches all required raw player stats from the nst_percentile_* tables
 * for a specific season, based on the stats defined in the RATING_WEIGHTS config.
 * Uses separate select statements for offense and defense tables.
 *
 * @param seasonId The season year (e.g., 20232024)
 * @returns A Promise resolving to a RawStatsCollection object containing the fetched data.
 */
export async function fetchRawStatsForAllStrengths(
  seasonId: number
): Promise<RawStatsCollection> {
  console.log(
    `[fetchRawStats] Starting fetch for all strengths, season: ${seasonId}`
  );

  // 1. Determine required columns separately for offense and defense
  // It uses the RATING_WEIGHTS config imported from ratingsWeights.ts
  const offenseStatsSet = getOffenseStatsUsedInWeights(RATING_WEIGHTS);
  const defenseStatsSet = getDefenseStatsUsedInWeights(RATING_WEIGHTS);

  // Create comma-separated strings for the SELECT query
  const offenseSelectColumns = Array.from(offenseStatsSet).join(", ");
  const defenseSelectColumns = Array.from(defenseStatsSet).join(", ");

  console.log(
    `[fetchRawStats] Required Offense columns: ${offenseSelectColumns}`
  );
  console.log(
    `[fetchRawStats] Required Defense columns: ${defenseSelectColumns}`
  );

  // 2. Prepare fetch promises for all 8 tables, using the correct select string
  const fetchPromises: Promise<PlayerStrengthStats[]>[] = [];
  const strengths: Strength[] = ["as", "es", "pp", "pk"];
  // Keep track of which promise corresponds to which table/strength/type
  const tableIdentifiers: {
    strength: Strength;
    type: "offense" | "defense";
    tableName: string;
  }[] = [];

  strengths.forEach((strength) => {
    const offenseTable = TABLE_MAP[strength].offense;
    const defenseTable = TABLE_MAP[strength].defense;

    // Add offense table fetch promise (using offenseSelectColumns)
    tableIdentifiers.push({
      strength,
      type: "offense",
      tableName: offenseTable
    });
    fetchPromises.push(
      fetchPaginatedData<PlayerStrengthStats>( // Specify the expected return type
        offenseTable as keyof Database["public"]["Tables"],
        offenseSelectColumns, // Use offense-specific columns
        { column: "season", value: seasonId } // Filter by season
      )
    );

    // Add defense table fetch promise (using defenseSelectColumns)
    tableIdentifiers.push({
      strength,
      type: "defense",
      tableName: defenseTable
    });
    fetchPromises.push(
      fetchPaginatedData<PlayerStrengthStats>( // Specify the expected return type
        defenseTable as keyof Database["public"]["Tables"],
        defenseSelectColumns, // Use defense-specific columns
        { column: "season", value: seasonId } // Filter by season
      )
    );
  });

  // 3. Execute all fetches concurrently
  try {
    const results = await Promise.all(fetchPromises);
    console.log(`[fetchRawStats] Fetched data from ${results.length} tables.`);

    // 4. Structure the results into the RawStatsCollection
    const structuredData: RawStatsCollection = {};

    results.forEach((data, index) => {
      // Get the identifier corresponding to this result index
      const { strength, type } = tableIdentifiers[index];

      // Initialize strength object in the collection if it doesn't exist
      if (!structuredData[strength]) {
        structuredData[strength] = {
          offense: [],
          defense: []
        };
      }

      // Assign fetched data array to the correct place (offense or defense)
      // Use non-null assertion (!) as we initialize the structure above
      structuredData[strength]![type] = data;

      console.log(
        `[fetchRawStats] Processed ${data.length} rows for ${strength} ${type}.`
      );
    });

    console.log(
      `[fetchRawStats] Finished structuring data for season: ${seasonId}`
    );
    return structuredData; // Return the organized data
  } catch (error) {
    console.error(
      `[fetchRawStats] Error fetching raw stats data for season ${seasonId}:`,
      error
    );
    // Re-throw the error so the calling function (in the component) can handle it
    throw error;
  }
}
