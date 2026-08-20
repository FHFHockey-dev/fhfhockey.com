import { createClient } from "@supabase/supabase-js";
import { executeSqlRpcWithRetry } from "lib/cron/sqlRpcExecution";

import {
  formatSqlRefreshEntrypointError,
  loadSqlRefreshConfiguration,
} from "./sql-refresh-config";

const sql = `SELECT public.refresh_team_power_ratings(
  (SELECT "startDate" FROM public.seasons ORDER BY id DESC LIMIT 1),
  LEAST(
    (now() AT TIME ZONE 'UTC')::date,
    (SELECT "endDate" FROM public.seasons ORDER BY id DESC LIMIT 1)
  )
);`;

export async function runTeamPowerSqlRefreshValidation() {
  const { supabaseUrl, serviceRoleKey } = loadSqlRefreshConfiguration();
  const client = createClient(supabaseUrl, serviceRoleKey);
  const started = Date.now();
  const result = await executeSqlRpcWithRetry({ client, sqlText: sql, maxAttempts: 3 });
  console.log(JSON.stringify({ durationMs: Date.now() - started, result }, null, 2));
}

if (require.main === module) {
  void runTeamPowerSqlRefreshValidation().catch((error) => {
    console.error(formatSqlRefreshEntrypointError(error));
    process.exitCode = 1;
  });
}
