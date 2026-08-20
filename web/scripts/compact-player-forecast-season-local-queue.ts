import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.development.local" });

import { FANTASY_PROJECTION_SEASON_ID } from "../lib/fantasy-projections/contracts";
import { getServiceRoleClient } from "../lib/supabase/server";

function assertLocalOnly(): void {
  if (process.env.PLAYER_FORECAST_QUEUE_COMPACTION_CONFIRM !== "local-only") {
    throw new Error("PLAYER_FORECAST_QUEUE_COMPACTION_CONFIRM must equal local-only.");
  }
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(apiUrl)) {
    throw new Error("Season queue compaction is restricted to local Supabase.");
  }
}

async function main(): Promise<void> {
  assertLocalOnly();
  const client = getServiceRoleClient() as any;
  const results = [];
  for (const view of ["current", "ros"] as const) {
    const { data, error } = await client.rpc(
      "compact_player_forecast_season_queue",
      {
        p_season_id: FANTASY_PROJECTION_SEASON_ID,
        p_view_key: view,
        p_threshold: 32,
      },
    );
    if (error) throw error;
    results.push(data);
  }
  process.stdout.write(`${JSON.stringify({
    success: true,
    seasonId: FANTASY_PROJECTION_SEASON_ID,
    results,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

