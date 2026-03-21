import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { executeSqlRpcWithRetry } from 'lib/cron/sqlRpcExecution';

dotenv.config({ path: '/Users/tim/Code/fhfhockey.com/web/.env.local' });
dotenv.config({ path: '/Users/tim/Code/fhfhockey.com/.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing Supabase credentials');
const client = createClient(url, key);

const sql = `SELECT public.refresh_team_power_ratings(
  (SELECT "startDate" FROM public.seasons ORDER BY id DESC LIMIT 1),
  LEAST(
    (now() AT TIME ZONE 'UTC')::date,
    (SELECT "endDate" FROM public.seasons ORDER BY id DESC LIMIT 1)
  )
);`;

(async () => {
  const started = Date.now();
  const result = await executeSqlRpcWithRetry({ client, sqlText: sql, maxAttempts: 3 });
  console.log(JSON.stringify({ durationMs: Date.now() - started, result }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
