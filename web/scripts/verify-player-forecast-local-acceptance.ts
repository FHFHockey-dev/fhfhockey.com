import dotenv from "dotenv";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.development.local" });

type Check = { name: string; passed: boolean; detail: string };

function assertLocalOnly(): { databaseUrl: string; supabaseUrl: string; anonKey: string } {
  if (process.env.PLAYER_FORECAST_ACCEPTANCE_CONFIRM !== "local-only") {
    throw new Error("PLAYER_FORECAST_ACCEPTANCE_CONFIRM must equal local-only.");
  }
  const databaseUrl = process.env.PLAYER_FORECAST_DATABASE_URL?.trim() ?? "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY?.trim() ?? "";
  const localDatabase = /^postgres(?:ql)?:\/\/[^/]*@(127\.0\.0\.1|localhost)(:|\/)/.test(databaseUrl);
  const localApi = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(supabaseUrl);
  if (!localDatabase || !localApi || !anonKey) {
    throw new Error("Local database URL, local Supabase URL, and local anonymous key are required.");
  }
  return { databaseUrl, supabaseUrl, anonKey };
}

async function main(): Promise<void> {
  const target = assertLocalOnly();
  const client = new Client({ connectionString: target.databaseUrl });
  await client.connect();
  await client.query("begin read only");
  const checks: Check[] = [];
  const check = (name: string, passed: boolean, detail: string) => {
    checks.push({ name, passed, detail });
  };
  try {
    const migrations = await client.query<{ count: string }>(`
      select count(*)::text as count
      from supabase_migrations.schema_migrations
      where version in (
        '20260802163747', '20260804160500', '20260805001038', '20260805002036',
        '20260805003121'
      )
    `);
    check("forecast migrations", Number(migrations.rows[0]?.count) === 5, `${migrations.rows[0]?.count ?? 0}/5`);

    const tables = await client.query<{ total: string; rls: string; forced: string }>(`
      select count(*)::text as total,
             count(*) filter (where relrowsecurity)::text as rls,
             count(*) filter (where relforcerowsecurity)::text as forced
      from pg_catalog.pg_class
      where relnamespace = 'public'::regnamespace
        and relkind = 'r' and relname like 'player_forecast_%'
    `);
    const table = tables.rows[0];
    check(
      "service-only forced RLS",
      Number(table?.total) === 18 && Number(table?.rls) === 18 && Number(table?.forced) === 18,
      `${table?.total ?? 0} tables; ${table?.rls ?? 0} RLS; ${table?.forced ?? 0} forced`,
    );
    const grants = await client.query<{ count: string }>(`
      select count(*)::text as count from information_schema.role_table_grants
      where table_schema = 'public' and table_name like 'player_forecast_%'
        and grantee in ('anon', 'authenticated')
    `);
    check("no browser table grants", Number(grants.rows[0]?.count) === 0, `${grants.rows[0]?.count ?? 0} grants`);
    const featureFunctionGrants = await client.query<{ grantee: string }>(`
      select grantee from information_schema.routine_privileges
      where routine_schema = 'public'
        and routine_name = 'build_player_forecast_runtime_features'
        and privilege_type = 'EXECUTE'
      order by grantee
    `);
    check(
      "runtime feature RPC service-only",
      featureFunctionGrants.rows.every((row) => ["postgres", "service_role"].includes(row.grantee))
        && featureFunctionGrants.rows.some((row) => row.grantee === "service_role"),
      featureFunctionGrants.rows.map((row) => row.grantee).join(", "),
    );

    const anonymous = createClient(target.supabaseUrl, target.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anonymousProbe = await anonymous.from("player_forecast_outputs").select("id").limit(1);
    check("anonymous API denied", Boolean(anonymousProbe.error), anonymousProbe.error ? "denied" : "unexpected access");

    const cron = await client.query<{ jobname: string; schedule: string; active: boolean }>(`
      select jobname, schedule, active from cron.job
      where jobname like 'player-forecasts-%' order by jobname
    `);
    const expectedCron = new Map([
      ["player-forecasts-daily-seed", "0 10 * * *"],
      ["player-forecasts-queue-drain", "*/5 * * * *"],
      ["player-forecasts-settlement", "20 * * * *"],
    ]);
    check(
      "three active local cron jobs",
      cron.rows.length === 3 && cron.rows.every((row) => row.active && expectedCron.get(row.jobname) === row.schedule),
      cron.rows.map((row) => `${row.jobname}:${row.schedule}:${row.active}`).join(", "),
    );

    const triggers = await client.query<{ tgname: string }>(`
      select tgname from pg_catalog.pg_trigger
      where not tgisinternal and tgname in (
        'player_forecast_goalie_observation_enqueue',
        'player_forecast_lineup_observation_enqueue'
      ) order by tgname
    `);
    check("observation enqueue triggers", triggers.rows.length === 2, `${triggers.rows.length}/2`);

    const bucket = await client.query<{ public: boolean }>(`
      select public from storage.buckets where id = 'player-forecast-models'
    `);
    check("private artifact bucket", bucket.rows.length === 1 && bucket.rows[0]?.public === false, bucket.rows.length ? "private" : "missing");

    const artifact = await client.query<{
      id: string;
      evidence: Record<string, any>;
      object_count: string;
    }>(`
      select a.id, a.evidence,
             (select count(*)::text from storage.objects o
              where o.bucket_id = 'player-forecast-models'
                and o.name like a.model_key || '/%') as object_count
      from player_forecast_model_artifacts a
      where a.lifecycle_status = 'shadow'
      order by a.created_at desc limit 1
    `);
    const latestArtifact = artifact.rows[0];
    const receipt = latestArtifact?.evidence?.primaryReceipt;
    const evidence = latestArtifact?.evidence?.lockboxEvidence;
    const validationOnly = Boolean(
      latestArtifact?.evidence?.sourceArtifactChecksum
      && latestArtifact?.evidence?.payloadChecksum
      && latestArtifact?.evidence?.promotionEligible === false
      && receipt == null
      && evidence == null
      && Number(latestArtifact.object_count) >= 1
    );
    const receiptBound = Boolean(
      latestArtifact && receipt?.documentChecksum && receipt?.blobChecksum &&
      evidence?.documentChecksum && evidence?.blobChecksum && Number(latestArtifact.object_count) >= 3
    );
    check(
      "serving artifact evidence safeguards",
      receiptBound || validationOnly,
      latestArtifact ? `${latestArtifact.id}; ${latestArtifact.object_count} stored objects` : "missing",
    );

    const servingRun = await client.query<{
      model_artifact_id: string;
      status: string;
      outputs: string;
      identical_runs: string;
    }>(`
      select r.model_artifact_id, r.status, count(o.id)::text as outputs,
             (select count(*)::text from player_forecast_runs replay
              where replay.model_artifact_id = r.model_artifact_id
                and replay.game_id = r.game_id and replay.team_id = r.team_id
                and replay.source_high_watermark = r.source_high_watermark) as identical_runs
      from player_forecast_runs r
      join player_forecast_inference_queue q on q.id = r.queue_id
      left join player_forecast_outputs o on o.run_id = r.id
      where q.reason = 'local_serving_proof'
      group by r.id
      order by r.created_at desc limit 1
    `);
    const run = servingRun.rows[0];
    const expectedOutputs = validationOnly ? 4 : 14;
    check(
      "deterministic inference persistence",
      Boolean(
        run && run.status === "succeeded" && Number(run.outputs) === expectedOutputs &&
        Number(run.identical_runs) === 1 && run.model_artifact_id === latestArtifact?.id,
      ),
      run
        ? `${run.status}; ${run.outputs} outputs; ${run.identical_runs} identical runs; ${run.model_artifact_id}`
        : "missing",
    );

    const queue = await client.query<{ expired: string }>(`
      select count(*) filter (
        where status = 'running' and lease_expires_at <= now()
      )::text as expired from player_forecast_inference_queue
    `);
    check("no expired running lease", Number(queue.rows[0]?.expired) === 0, `${queue.rows[0]?.expired ?? 0} expired`);

    const conflicts = await client.query<{ conflicts: string; resolutions: string }>(`
      select
        (select count(*)::text from player_forecast_observation_conflicts) as conflicts,
        (select count(*)::text from player_forecast_conflict_resolutions) as resolutions
    `);
    check(
      "conflict and append-only resolution",
      Number(conflicts.rows[0]?.conflicts) > 0 && Number(conflicts.rows[0]?.resolutions) > 0,
      `${conflicts.rows[0]?.conflicts ?? 0} conflicts; ${conflicts.rows[0]?.resolutions ?? 0} resolutions`,
    );

    const settlement = await client.query<{ provisional: string; corrected: string; accountability: string }>(`
      select
        (select count(*)::text from player_forecast_outcome_revisions where finality = 'provisional') as provisional,
        (select count(*)::text from player_forecast_outcome_revisions where finality = 'corrected') as corrected,
        (select count(*)::text from player_forecast_accountability_revisions) as accountability
    `);
    check(
      "provisional and corrected settlement",
      Number(settlement.rows[0]?.provisional) > 0 && Number(settlement.rows[0]?.corrected) > 0,
      `${settlement.rows[0]?.provisional ?? 0} provisional; ${settlement.rows[0]?.corrected ?? 0} corrected`,
    );
    check(
      "aggregate accountability candle data",
      Number(settlement.rows[0]?.accountability) >= 3,
      `${settlement.rows[0]?.accountability ?? 0} checkpoint rows`,
    );

    const playerCandles = await client.query<{ count: string }>(`
      select count(*)::text as count from (
        select game_id, player_id, target_key
        from player_forecast_outputs
        group by game_id, player_id, target_key
        having count(*) >= 3
      ) candles
    `);
    check("player candlestick revision data", Number(playerCandles.rows[0]?.count) > 0, `${playerCandles.rows[0]?.count ?? 0} cohorts`);

    const cutoff = await client.query<{ post_start_evidence: string; leaking_runs: string }>(`
      select
        (select count(*)::text from player_forecast_goalie_start_observations
         where source_key = 'fixture-post-start') as post_start_evidence,
        (select count(*)::text from player_forecast_runs r join games g on g.id = r.game_id
         where r.cutoff_at >= g."startTime") as leaking_runs
    `);
    check(
      "post-start evidence retained without leakage",
      Number(cutoff.rows[0]?.post_start_evidence) > 0 && Number(cutoff.rows[0]?.leaking_runs) === 0,
      `${cutoff.rows[0]?.post_start_evidence ?? 0} retained; ${cutoff.rows[0]?.leaking_runs ?? 0} leaking runs`,
    );
  } finally {
    await client.query("rollback");
    await client.end();
  }

  const passed = checks.every((entry) => entry.passed);
  process.stdout.write(`${JSON.stringify({ success: passed, checks }, null, 2)}\n`);
  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Local acceptance verification failed."}\n`);
  process.exitCode = 1;
});
