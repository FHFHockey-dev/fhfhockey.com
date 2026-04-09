import { Database } from "lib/supabase/database-generated.types";
import {
  PlayerStrengthStats,
  RawStatsCollection,
  Strength
} from "components/WiGO/types";
import {
  RATING_WEIGHTS,
  getOffenseStatsUsedInWeights,
  getDefenseStatsUsedInWeights
} from "components/WiGO/ratingWeights";
import { fetchPaginatedData } from "./fetchWigoPlayerStats";

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
  const offenseStatsSet = getOffenseStatsUsedInWeights(RATING_WEIGHTS);
  const defenseStatsSet = getDefenseStatsUsedInWeights(RATING_WEIGHTS);

  const offenseSelectColumns = Array.from(offenseStatsSet).join(", ");
  const defenseSelectColumns = Array.from(defenseStatsSet).join(", ");

  const fetchPromises: Promise<PlayerStrengthStats[]>[] = [];
  const strengths: Strength[] = ["as", "es", "pp", "pk"];
  const tableIdentifiers: {
    strength: Strength;
    type: "offense" | "defense";
    tableName: string;
  }[] = [];

  strengths.forEach((strength) => {
    const offenseTable = TABLE_MAP[strength].offense;
    const defenseTable = TABLE_MAP[strength].defense;

    tableIdentifiers.push({
      strength,
      type: "offense",
      tableName: offenseTable
    });
    fetchPromises.push(
      fetchPaginatedData<PlayerStrengthStats>(
        offenseTable as keyof Database["public"]["Tables"],
        offenseSelectColumns,
        { column: "season", value: seasonId }
      )
    );

    tableIdentifiers.push({
      strength,
      type: "defense",
      tableName: defenseTable
    });
    fetchPromises.push(
      fetchPaginatedData<PlayerStrengthStats>(
        defenseTable as keyof Database["public"]["Tables"],
        defenseSelectColumns,
        { column: "season", value: seasonId }
      )
    );
  });

  try {
    const results = await Promise.all(fetchPromises);
    const structuredData: RawStatsCollection = {};

    results.forEach((data, index) => {
      const { strength, type } = tableIdentifiers[index];

      if (!structuredData[strength]) {
        structuredData[strength] = {
          offense: [],
          defense: []
        };
      }

      structuredData[strength]![type] = data;
    });

    return structuredData;
  } catch (error) {
    console.error(
      `[fetchRawStats] Error fetching raw stats data for season ${seasonId}:`,
      error
    );
    throw error;
  }
}
