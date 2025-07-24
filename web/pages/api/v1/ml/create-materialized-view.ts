import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RefreshResponse {
  success: boolean;
  message: string;
  recordCount?: number;
  executionTime?: number;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RefreshResponse>
) {
  // Only allow POST requests for refresh operations
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed. Use POST to refresh materialized view."
    });
  }

  const startTime = Date.now();

  try {
    console.log("Starting materialized view refresh...");

    // Step 1: Drop existing materialized view if it exists
    const { error: dropError } = await supabase.rpc("execute_sql", {
      sql_statement:
        "DROP MATERIALIZED VIEW IF EXISTS player_stats_unified CASCADE;"
    });

    if (dropError) {
      console.error("Error dropping existing view:", dropError);
      return res.status(500).json({
        success: false,
        message: "Failed to drop existing materialized view",
        error: dropError.message
      });
    }

    // Step 2: Create minimal test materialized view to verify the infrastructure works
    const createViewSQL = `
      CREATE MATERIALIZED VIEW player_stats_unified AS
      SELECT 
          -- Primary Keys
          w.player_id,
          w.date,
          
          -- Foreign Keys  
          w.season_id,
          COALESCE(w.current_team_abbreviation, 'UNK') as team_abbreviation,
          
          -- Player Information
          w.player_name,
          w.position_code,
          w.shoots_catches,
          
          -- Core Game Statistics (from wgo_skater_stats)
          w.games_played,
          w.goals,
          w.assists, 
          w.points,
          w.shots,
          w.shooting_percentage,
          w.plus_minus,
          w.penalty_minutes,
          w.hits,
          w.blocked_shots,
          w.takeaways,
          w.giveaways,
          w.toi_per_game,
          w.pp_points,
          w.sh_points,
          w.fow_percentage,
          
          -- Placeholder for future NST data
          NULL::numeric as nst_ixg,
          NULL::numeric as nst_oi_cf_pct,
          NULL::numeric as nst_oi_shooting_pct,
          NULL::numeric as nst_oi_save_pct,
          NULL::numeric as nst_oi_pdo,
          
          -- Data Completeness Flags
          false as has_nst_counts,
          false as has_nst_counts_oi, 
          false as has_nst_rates,
          false as has_nst_rates_oi,
          
          -- ML-ready Features
          COALESCE(w.shots, 0) as shots_safe,
          COALESCE(w.shooting_percentage, 0) as shooting_pct_safe,
          0.5 as possession_pct_safe,
          
          -- Metadata
          CURRENT_TIMESTAMP as materialized_at

      FROM wgo_skater_stats w

      WHERE 
          w.games_played = 1
          AND w.date >= '2024-12-01'  -- Very recent data only
          AND w.date <= '2024-12-31'  -- December 2024
          AND w.player_id IS NOT NULL
          AND w.date IS NOT NULL

      ORDER BY w.player_id, w.date
      LIMIT 1000;  -- Small test dataset
    `;

    // Step 3: Create the materialized view
    const { error: createError } = await supabase.rpc("execute_sql", {
      sql_statement: createViewSQL
    });

    if (createError) {
      console.error("Error creating materialized view:", createError);
      return res.status(500).json({
        success: false,
        message: "Failed to create materialized view",
        error: createError.message
      });
    }

    // Step 4: Create indexes
    const indexSQL = `
      -- Create unique index on primary key columns
      CREATE UNIQUE INDEX IF NOT EXISTS idx_player_stats_unified_pk 
      ON player_stats_unified (player_id, date);

      -- Create indexes for common query patterns
      CREATE INDEX IF NOT EXISTS idx_player_stats_unified_player_season 
      ON player_stats_unified (player_id, season_id);

      CREATE INDEX IF NOT EXISTS idx_player_stats_unified_date 
      ON player_stats_unified (date);

      CREATE INDEX IF NOT EXISTS idx_player_stats_unified_season 
      ON player_stats_unified (season_id);

      CREATE INDEX IF NOT EXISTS idx_player_stats_unified_team_date 
      ON player_stats_unified (team_abbreviation, date);

      -- Create indexes for data completeness queries
      CREATE INDEX IF NOT EXISTS idx_player_stats_unified_nst_flags
      ON player_stats_unified (has_nst_counts, has_nst_counts_oi, has_nst_rates, has_nst_rates_oi);
    `;

    const { error: indexError } = await supabase.rpc("execute_sql", {
      sql_statement: indexSQL
    });

    if (indexError) {
      console.warn(
        "Warning: Some indexes may not have been created:",
        indexError
      );
    }

    // Step 5: Get record count for verification
    const { data: countData, error: countError } = await supabase
      .from("player_stats_unified")
      .select("*", { count: "exact", head: true });

    const recordCount = countData ? (countData as any).length : 0;

    if (countError) {
      console.warn("Could not get record count:", countError);
    }

    const executionTime = Date.now() - startTime;

    console.log(`Materialized view refresh completed in ${executionTime}ms`);
    console.log(`Records created: ${recordCount}`);

    return res.status(200).json({
      success: true,
      message: "Materialized view refreshed successfully",
      recordCount,
      executionTime
    });
  } catch (error: any) {
    console.error("Unexpected error during materialized view refresh:", error);

    const executionTime = Date.now() - startTime;

    return res.status(500).json({
      success: false,
      message: "Unexpected error occurred during refresh",
      error: error.message,
      executionTime
    });
  }
}
