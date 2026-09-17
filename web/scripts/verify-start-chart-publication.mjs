import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const container = process.argv[2];
if (!container || !/^[a-zA-Z0-9_-]+$/.test(container)) {
  throw new Error("Usage: node scripts/verify-start-chart-publication.mjs <local-postgres-container>");
}
const root = fileURLToPath(new URL("../../", import.meta.url));
const database = `start_chart_test_${Date.now()}`;
function run(args, input) {
  const result = spawnSync("docker", ["exec", "-i", container, ...args], {
    input, encoding: "utf8", timeout: 60_000, maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error(result.stderr || result.error?.message || "Docker command failed");
  return result.stdout;
}
// Only this newly created, empty database is modified or dropped. These minimal
// source tables match the columns read by the actual publication migration.
run(["createdb", "-U", "postgres", database]);
try {
  const fullSchema = process.argv.includes("--full-schema");
  let bootstrap = `
    create schema fhfh_internal;
    create function fhfh_internal.reject_player_forecast_mutation() returns trigger language plpgsql
      as $$ begin raise exception using errcode='55000',message='immutable'; end; $$;
    create table games(id bigint primary key, date date, type integer, "startTime" timestamptz, "homeTeamId" bigint, "awayTeamId" bigint);
    create table forge_runs(run_id uuid primary key default gen_random_uuid(), as_of_date date, status text, created_at timestamptz default now(), updated_at timestamptz default now(), metrics jsonb, git_sha text);
    create table player_forecast_source_observations(id uuid primary key, provider text, dataset_key text, entity_key text, payload jsonb, payload_hash text, available_at timestamptz);
    create table forge_player_projections(run_id uuid, game_id bigint, player_id bigint, team_id bigint, horizon_games int);
    create table forge_team_projections(run_id uuid, game_id bigint, team_id bigint, horizon_games int);
    create table forge_goalie_projections(run_id uuid, game_id bigint, goalie_id bigint, team_id bigint, horizon_games int);
    create table player_forecast_lineup_snapshots(id uuid primary key default gen_random_uuid(), game_id bigint, team_id bigint, accepted boolean, observed_at timestamptz, available_at timestamptz);
    create table player_forecast_goalie_start_observations(like player_forecast_lineup_snapshots including all);
    alter table player_forecast_goalie_start_observations add column metadata jsonb, add column player_id bigint, add column observation_status text;
    alter table player_forecast_goalie_start_observations add column raw_player_name text, add column confidence numeric(6,5),
      add column raw_status text, add column source_group text, add column source_key text, add column source_account text,
      add column source_capture_key text, add column source_url text, add column expires_at timestamptz, add column parser_version text;
    create unique index player_forecast_goalie_observations_capture_player_idx on player_forecast_goalie_start_observations
      (source_capture_key,team_id,coalesce(player_id,0),coalesce(raw_player_name,''));
    alter table player_forecast_lineup_snapshots
      add column source_group text, add column source_key text, add column source_account text,
      add column source_capture_key text, add column source_url text, add column classification text,
      add column expires_at timestamptz, add column completeness numeric(6,5), add column parser_version text,
      add column metadata jsonb, add unique(source_capture_key,team_id);
    create table player_forecast_lineup_assignments(id uuid primary key default gen_random_uuid(),
      snapshot_id uuid references player_forecast_lineup_snapshots(id), player_id bigint, raw_player_name text,
      unit_type text not null, unit_number smallint, slot_number smallint check(slot_number between 1 and 10),
      assignment_status text not null, unique nulls not distinct(snapshot_id,unit_type,unit_number,slot_number,player_id,raw_player_name));
    create table player_forecast_observation_conflicts(id uuid primary key default gen_random_uuid(),game_id bigint,team_id bigint);
    alter table player_forecast_observation_conflicts add column conflict_key text, add column conflict_version integer,
      add column conflict_type text, add column player_id bigint, add column detected_at timestamptz,
      add column source_high_watermark timestamptz, add column summary text, add column metadata jsonb,
      add unique(conflict_key,conflict_version);
    create table player_forecast_conflict_members(id uuid primary key default gen_random_uuid(),conflict_id uuid references player_forecast_observation_conflicts(id),
      observation_type text,observation_id uuid,position smallint,unique(conflict_id,observation_type,observation_id));
    create table player_forecast_conflict_resolutions(id uuid primary key default gen_random_uuid(),conflict_id uuid,resolved_at timestamptz,created_at timestamptz default now());
  `;
  if (fullSchema) {
    const schema = run(["pg_dump", "-U", "postgres", "--schema-only", "--no-owner", "--no-privileges",
      ...["public", "auth", "storage", "fhfh_internal", "extensions", "supabase_functions", "internal_stats"].map((name) => `--schema=${name}`), "postgres"])
      .replace("CREATE SCHEMA public;", "CREATE SCHEMA IF NOT EXISTS public;")
      .replace("CREATE SCHEMA extensions;", "CREATE SCHEMA IF NOT EXISTS extensions;");
    const cronShapes = run(["psql", "-U", "postgres", "-Atqc", `select 'create schema if not exists cron; ' || string_agg('create table cron.'||quote_ident(c.relname)||' ('||(select string_agg(quote_ident(a.attname)||' '||format_type(a.atttypid,a.atttypmod),',' order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)||');',' ') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='cron' and c.relkind='r'`]);
    bootstrap = `create schema extensions;
      create extension pgcrypto with schema extensions; create extension "uuid-ossp" with schema extensions;
      create extension pg_trgm with schema public; create extension unaccent with schema public;
      create extension http with schema extensions; create extension moddatetime with schema extensions;
      create extension pgjwt with schema extensions;` + cronShapes + schema;
  }
  run(["psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database], bootstrap
    + readFileSync(resolve(root, "supabase/migrations/20260916012353_starter_board_game_revisions.sql"), "utf8")
    + readFileSync(resolve(root, "supabase/migrations/20260916014510_starter_board_news_queue.sql"), "utf8")
    + readFileSync(resolve(root, "supabase/migrations/20260916023000_starter_board_release_control.sql"), "utf8")
    + readFileSync(resolve(root, "supabase/migrations/20260916044919_starter_board_atomic_lineup_capture.sql"), "utf8")
    + readFileSync(resolve(root, "supabase/migrations/20260916045842_starter_board_operational_reporting.sql"), "utf8")
    + readFileSync(resolve(root, "supabase/migrations/20260916052239_starter_board_validation_registry.sql"), "utf8")
    + readFileSync(resolve(root, "supabase/migrations/20260916060521_starter_board_atomic_goalie_capture.sql"), "utf8")
    + (fullSchema ? "" : readFileSync(resolve(root, "supabase/tests/starter_board_game_revisions.sql"), "utf8")));
  // Validate the private export's selected columns against the same migrated schema.
  run(["psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database], `
    select id,date,type,"homeTeamId","awayTeamId" from public.games limit 0;
    select game_id,revision_id,scheduled_start_at,frozen_at from public.forge_final_pregame_revisions limit 0;
    select id,game_id,run_id,input_snapshot_id,slate_date,decision_as_of,published_at,payload from public.forge_game_revisions limit 0;
    select id,provider,dataset_key,entity_key,available_at,payload_hash,payload from public.player_forecast_source_observations limit 0;
  `);
  console.log(fullSchema
    ? "PASS: migrations on complete application/auth/storage schema clone; existing ownership/ACLs omitted, cron table shapes mirrored without activation."
    : "PASS: publication, rollback/freeze, lease replacement/fencing, idempotency, supersession, immutability and access.");
} finally {
  run(["dropdb", "-U", "postgres", database]);
}
