// utils/database/player-id-mapping.ts
// Task 1.6: Utility functions for mapping Yahoo player IDs to NHL API player IDs

import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Types for player mapping
export interface YahooNhlPlayerMapping {
  nhl_player_id: string;
  yahoo_player_id: string;
  nhl_player_name: string;
  yahoo_player_name: string;
  nhl_team_abbreviation: string;
  mapped_position: string;
  eligible_positions: string[];
  player_type: string;
}

export interface YahooPlayerDetails {
  player_key: string;
  player_id: string;
  full_name: string;
  display_position: string;
  eligible_positions: string[];
  editorial_team_abbreviation: string;
  percent_ownership: number;
  average_draft_pick: number;
  injury_note: string;
}

/**
 * Get NHL player ID from Yahoo player ID
 * @param yahooPlayerId - Yahoo player ID (string)
 * @returns NHL player ID (string) or null if not found
 */
export async function getNhlPlayerIdFromYahooId(
  yahooPlayerId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("yahoo_nhl_player_map_mat")
      .select("nhl_player_id")
      .eq("yahoo_player_id", yahooPlayerId)
      .single();

    if (error) {
      console.error("Error fetching NHL player ID:", error);
      return null;
    }

    return data?.nhl_player_id || null;
  } catch (error) {
    console.error("Error in getNhlPlayerIdFromYahooId:", error);
    return null;
  }
}

/**
 * Get Yahoo player ID from NHL player ID
 * @param nhlPlayerId - NHL player ID (string)
 * @returns Yahoo player ID (string) or null if not found
 */
export async function getYahooPlayerIdFromNhlId(
  nhlPlayerId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("yahoo_nhl_player_map_mat")
      .select("yahoo_player_id")
      .eq("nhl_player_id", nhlPlayerId)
      .single();

    if (error) {
      console.error("Error fetching Yahoo player ID:", error);
      return null;
    }

    return data?.yahoo_player_id || null;
  } catch (error) {
    console.error("Error in getYahooPlayerIdFromNhlId:", error);
    return null;
  }
}

/**
 * Get full player mapping information from NHL player ID
 * @param nhlPlayerId - NHL player ID (string)
 * @returns Player mapping object or null if not found
 */
export async function getPlayerMappingFromNhlId(
  nhlPlayerId: string
): Promise<YahooNhlPlayerMapping | null> {
  try {
    const { data, error } = await supabase
      .from("yahoo_nhl_player_map_mat")
      .select(
        `
        nhl_player_id,
        yahoo_player_id,
        nhl_player_name,
        yahoo_player_name,
        nhl_team_abbreviation,
        mapped_position,
        eligible_positions,
        player_type
      `
      )
      .eq("nhl_player_id", nhlPlayerId)
      .single();

    if (error) {
      console.error("Error fetching player mapping:", error);
      return null;
    }

    return data
      ? {
          nhl_player_id: data.nhl_player_id,
          yahoo_player_id: data.yahoo_player_id,
          nhl_player_name: data.nhl_player_name,
          yahoo_player_name: data.yahoo_player_name,
          nhl_team_abbreviation: data.nhl_team_abbreviation,
          mapped_position: data.mapped_position,
          eligible_positions: (data.eligible_positions as string[]) || [],
          player_type: data.player_type
        }
      : null;
  } catch (error) {
    console.error("Error in getPlayerMappingFromNhlId:", error);
    return null;
  }
}

/**
 * Get full player mapping information from Yahoo player ID
 * @param yahooPlayerId - Yahoo player ID (string)
 * @returns Player mapping object or null if not found
 */
export async function getPlayerMappingFromYahooId(
  yahooPlayerId: string
): Promise<YahooNhlPlayerMapping | null> {
  try {
    const { data, error } = await supabase
      .from("yahoo_nhl_player_map_mat")
      .select(
        `
        nhl_player_id,
        yahoo_player_id,
        nhl_player_name,
        yahoo_player_name,
        nhl_team_abbreviation,
        mapped_position,
        eligible_positions,
        player_type
      `
      )
      .eq("yahoo_player_id", yahooPlayerId)
      .single();

    if (error) {
      console.error("Error fetching player mapping:", error);
      return null;
    }

    return data
      ? {
          nhl_player_id: data.nhl_player_id,
          yahoo_player_id: data.yahoo_player_id,
          nhl_player_name: data.nhl_player_name,
          yahoo_player_name: data.yahoo_player_name,
          nhl_team_abbreviation: data.nhl_team_abbreviation,
          mapped_position: data.mapped_position,
          eligible_positions: (data.eligible_positions as string[]) || [],
          player_type: data.player_type
        }
      : null;
  } catch (error) {
    console.error("Error in getPlayerMappingFromYahooId:", error);
    return null;
  }
}

/**
 * Get Yahoo player details from player key
 * @param playerKey - Yahoo player key (e.g., "453.p.8477")
 * @returns Yahoo player details or null if not found
 */
export async function getYahooPlayerDetails(
  playerKey: string
): Promise<YahooPlayerDetails | null> {
  try {
    const { data, error } = await supabase
      .from("yahoo_players")
      .select(
        `
        player_key,
        player_id,
        full_name,
        display_position,
        eligible_positions,
        editorial_team_abbreviation,
        percent_ownership,
        average_draft_pick,
        injury_note
      `
      )
      .eq("player_key", playerKey)
      .single();

    if (error) {
      console.error("Error fetching Yahoo player details:", error);
      return null;
    }

    return data
      ? {
          player_key: data.player_key,
          player_id: data.player_id,
          full_name: data.full_name,
          display_position: data.display_position,
          eligible_positions: (data.eligible_positions as string[]) || [],
          editorial_team_abbreviation: data.editorial_team_abbreviation,
          percent_ownership: data.percent_ownership,
          average_draft_pick: data.average_draft_pick,
          injury_note: data.injury_note
        }
      : null;
  } catch (error) {
    console.error("Error in getYahooPlayerDetails:", error);
    return null;
  }
}

/**
 * Get multiple NHL player IDs from Yahoo player IDs (batch operation)
 * @param yahooPlayerIds - Array of Yahoo player IDs
 * @returns Map of Yahoo player ID to NHL player ID
 */
export async function batchGetNhlPlayerIds(
  yahooPlayerIds: string[]
): Promise<Map<string, string>> {
  const resultMap = new Map<string, string>();

  if (yahooPlayerIds.length === 0) {
    return resultMap;
  }

  try {
    const { data, error } = await supabase
      .from("yahoo_nhl_player_map_mat")
      .select("yahoo_player_id, nhl_player_id")
      .in("yahoo_player_id", yahooPlayerIds);

    if (error) {
      console.error("Error in batch fetch NHL player IDs:", error);
      return resultMap;
    }

    data?.forEach((row) => {
      if (row.yahoo_player_id && row.nhl_player_id) {
        resultMap.set(row.yahoo_player_id, row.nhl_player_id);
      }
    });

    return resultMap;
  } catch (error) {
    console.error("Error in batchGetNhlPlayerIds:", error);
    return resultMap;
  }
}

/**
 * Get multiple Yahoo player IDs from NHL player IDs (batch operation)
 * @param nhlPlayerIds - Array of NHL player IDs
 * @returns Map of NHL player ID to Yahoo player ID
 */
export async function batchGetYahooPlayerIds(
  nhlPlayerIds: string[]
): Promise<Map<string, string>> {
  const resultMap = new Map<string, string>();

  if (nhlPlayerIds.length === 0) {
    return resultMap;
  }

  try {
    const { data, error } = await supabase
      .from("yahoo_nhl_player_map_mat")
      .select("nhl_player_id, yahoo_player_id")
      .in("nhl_player_id", nhlPlayerIds);

    if (error) {
      console.error("Error in batch fetch Yahoo player IDs:", error);
      return resultMap;
    }

    data?.forEach((row) => {
      if (row.nhl_player_id && row.yahoo_player_id) {
        resultMap.set(row.nhl_player_id, row.yahoo_player_id);
      }
    });

    return resultMap;
  } catch (error) {
    console.error("Error in batchGetYahooPlayerIds:", error);
    return resultMap;
  }
}

/**
 * Get multiple player mappings (batch operation)
 * @param nhlPlayerIds - Array of NHL player IDs
 * @returns Array of player mapping objects
 */
export async function batchGetPlayerMappings(
  nhlPlayerIds: string[]
): Promise<YahooNhlPlayerMapping[]> {
  if (nhlPlayerIds.length === 0) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("yahoo_nhl_player_map_mat")
      .select(
        `
        nhl_player_id,
        yahoo_player_id,
        nhl_player_name,
        yahoo_player_name,
        nhl_team_abbreviation,
        mapped_position,
        eligible_positions,
        player_type
      `
      )
      .in("nhl_player_id", nhlPlayerIds);

    if (error) {
      console.error("Error in batch fetch player mappings:", error);
      return [];
    }

    return (
      data?.map((row) => ({
        nhl_player_id: row.nhl_player_id,
        yahoo_player_id: row.yahoo_player_id,
        nhl_player_name: row.nhl_player_name,
        yahoo_player_name: row.yahoo_player_name,
        nhl_team_abbreviation: row.nhl_team_abbreviation,
        mapped_position: row.mapped_position,
        eligible_positions: (row.eligible_positions as string[]) || [],
        player_type: row.player_type
      })) || []
    );
  } catch (error) {
    console.error("Error in batchGetPlayerMappings:", error);
    return [];
  }
}

/**
 * Check if a player mapping exists
 * @param nhlPlayerId - NHL player ID
 * @returns Boolean indicating if mapping exists
 */
export async function hasPlayerMapping(nhlPlayerId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("yahoo_nhl_player_map_mat")
      .select("nhl_player_id")
      .eq("nhl_player_id", nhlPlayerId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found"
      console.error("Error checking player mapping:", error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error("Error in hasPlayerMapping:", error);
    return false;
  }
}

/**
 * Get all player mappings for a specific team
 * @param teamAbbr - Team abbreviation (e.g., "TOR", "BOS")
 * @returns Array of player mapping objects for the team
 */
export async function getTeamPlayerMappings(
  teamAbbr: string
): Promise<YahooNhlPlayerMapping[]> {
  try {
    const { data, error } = await supabase
      .from("yahoo_nhl_player_map_mat")
      .select(
        `
        nhl_player_id,
        yahoo_player_id,
        nhl_player_name,
        yahoo_player_name,
        nhl_team_abbreviation,
        mapped_position,
        eligible_positions,
        player_type
      `
      )
      .eq("nhl_team_abbreviation", teamAbbr);

    if (error) {
      console.error("Error fetching team player mappings:", error);
      return [];
    }

    return (
      data?.map((row) => ({
        nhl_player_id: row.nhl_player_id,
        yahoo_player_id: row.yahoo_player_id,
        nhl_player_name: row.nhl_player_name,
        yahoo_player_name: row.yahoo_player_name,
        nhl_team_abbreviation: row.nhl_team_abbreviation,
        mapped_position: row.mapped_position,
        eligible_positions: (row.eligible_positions as string[]) || [],
        player_type: row.player_type
      })) || []
    );
  } catch (error) {
    console.error("Error in getTeamPlayerMappings:", error);
    return [];
  }
}

/**
 * Get all player mappings for a specific position
 * @param position - Position (e.g., "C", "LW", "RW", "D", "G")
 * @returns Array of player mapping objects for the position
 */
export async function getPositionPlayerMappings(
  position: string
): Promise<YahooNhlPlayerMapping[]> {
  try {
    const { data, error } = await supabase
      .from("yahoo_nhl_player_map_mat")
      .select(
        `
        nhl_player_id,
        yahoo_player_id,
        nhl_player_name,
        yahoo_player_name,
        nhl_team_abbreviation,
        mapped_position,
        eligible_positions,
        player_type
      `
      )
      .eq("mapped_position", position);

    if (error) {
      console.error("Error fetching position player mappings:", error);
      return [];
    }

    return (
      data?.map((row) => ({
        nhl_player_id: row.nhl_player_id,
        yahoo_player_id: row.yahoo_player_id,
        nhl_player_name: row.nhl_player_name,
        yahoo_player_name: row.yahoo_player_name,
        nhl_team_abbreviation: row.nhl_team_abbreviation,
        mapped_position: row.mapped_position,
        eligible_positions: (row.eligible_positions as string[]) || [],
        player_type: row.player_type
      })) || []
    );
  } catch (error) {
    console.error("Error in getPositionPlayerMappings:", error);
    return [];
  }
}
