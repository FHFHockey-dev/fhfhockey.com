import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { executeSqlRpcWithRetry } from 'lib/cron/sqlRpcExecution';

dotenv.config({ path: '/Users/tim/Code/fhfhockey.com/web/.env.local' });
dotenv.config({ path: '/Users/tim/Code/fhfhockey.com/.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error('Missing Supabase credentials');
}
const client = createClient(url, key);

const jobs = [
  { name: 'goalie_stats_unified', sql: 'REFRESH MATERIALIZED VIEW goalie_stats_unified;' },
  { name: 'yahoo_nhl_player_map_mat', sql: 'REFRESH MATERIALIZED VIEW yahoo_nhl_player_map_mat;' },
  { name: 'refresh_team_power_ratings', sql: `WITH s AS ( SELECT * FROM public.seasons ORDER BY id DESC LIMIT 1 ) SELECT public.refresh_team_power_ratings((SELECT startDate FROM s), LEAST((now() AT TIME ZONE ''UTC'')::date, (SELECT endDate FROM s)));` },
  { name: 'player_totals_unified', sql: 'REFRESH MATERIALIZED VIEW player_totals_unified;' }
];

(async () => {
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
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
