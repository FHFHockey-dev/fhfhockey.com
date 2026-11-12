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
import { wigoPositionGroup, type WigoPositionGroup } from "./calculateWigoRatings";

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
    for (const type of ["offense", "defense"] as const) {
      if (!RATING_WEIGHTS[strength]?.[type]?.length) continue;
      const tableName = TABLE_MAP[strength][type];
      tableIdentifiers.push({ strength, type, tableName });
      fetchPromises.push(fetchPaginatedData<PlayerStrengthStats>(
        tableName as keyof Database["public"]["Tables"],
        type === "offense" ? offenseSelectColumns : defenseSelectColumns,
        { column: "season", value: seasonId }
      ));
    }
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

/**
 * Forward/defense group per skater for the season, from WGO season totals (the NST
 * percentile tables carry no position). Special-teams cohorts rank F and D apart
 * (decision 81); a skater missing here has an unknown position and stays unranked.
 */
export async function fetchSkaterPositionGroups(
  seasonId: number
): Promise<Map<number, WigoPositionGroup>> {
  const rows = await fetchPaginatedData<{ player_id: number | null; position_code: string | null }>(
    "wgo_skater_stats_totals",
    "player_id, position_code",
    { column: "season", value: String(seasonId) }
  );
  const groups = new Map<number, WigoPositionGroup>();
  const conflicted = new Set<number>();
  for (const row of rows) {
    const id = Number(row.player_id);
    const group = wigoPositionGroup(row.position_code);
    if (!Number.isFinite(id) || group === null || conflicted.has(id)) continue;
    const known = groups.get(id);
    // Two rows that disagree on F/D leave the position unknown rather than picking one.
    if (known && known !== group) {
      groups.delete(id);
      conflicted.add(id);
    } else {
      groups.set(id, group);
    }
  }
  return groups;
}
