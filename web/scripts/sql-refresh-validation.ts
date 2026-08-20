import { createClient } from "@supabase/supabase-js";
import { executeSqlRpcWithRetry } from "lib/cron/sqlRpcExecution";

import {
  formatSqlRefreshEntrypointError,
  loadSqlRefreshConfiguration,
} from "./sql-refresh-config";

const jobs = [
  { name: 'goalie_stats_unified', sql: 'REFRESH MATERIALIZED VIEW goalie_stats_unified;' },
  { name: 'yahoo_nhl_player_map_mat', sql: 'REFRESH MATERIALIZED VIEW yahoo_nhl_player_map_mat;' },
  { name: 'refresh_team_power_ratings', sql: `WITH s AS ( SELECT * FROM public.seasons ORDER BY id DESC LIMIT 1 ) SELECT public.refresh_team_power_ratings((SELECT startDate FROM s), LEAST((now() AT TIME ZONE ''UTC'')::date, (SELECT endDate FROM s)));` },
  { name: 'player_totals_unified', sql: 'REFRESH MATERIALIZED VIEW player_totals_unified;' }
];

export async function runSqlRefreshValidation() {
  const { supabaseUrl, serviceRoleKey } = loadSqlRefreshConfiguration();
  const client = createClient(supabaseUrl, serviceRoleKey);
  const results = [] as unknown[];
  for (const job of jobs) {
    const started = Date.now();
    const result = await executeSqlRpcWithRetry({ client, sqlText: job.sql, maxAttempts: 3 });
    results.push({
      name: job.name,
      durationMs: Date.now() - started,
      ok: result.ok,
      attempts: result.ok ? result.attempts : result.failure.attempts,
      notes: result.notes,
      failure: result.ok ? null : {
        message: result.failure.message,
        classification: result.failure.classification,
        statusCode: result.failure.statusCode,
        detail: result.failure.detail
      }
    });
  }
  console.log(JSON.stringify(results, null, 2));
}

if (require.main === module) {
  void runSqlRefreshValidation().catch((error) => {
    console.error(formatSqlRefreshEntrypointError(error));
    process.exitCode = 1;
  });
}
