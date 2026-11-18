#!/usr/bin/env bash
# PGBIN=/opt/homebrew/opt/postgresql@15/bin bash supabase/tests/rankings_publication_readiness.sh [--benchmark]
set -euo pipefail
cd "$(dirname "$0")/../.."

pgbin=${PGBIN:-$(pg_config --bindir)}
scratch=$(mktemp -d /tmp/rankings-readiness-pg.XXXXXX)
trap '"$pgbin/pg_ctl" -D "$scratch/data" -m fast stop >/dev/null 2>&1 || true; rm -rf "$scratch"' EXIT
"$pgbin/initdb" -D "$scratch/data" -A trust -U postgres --no-locale >/dev/null
"$pgbin/pg_ctl" -D "$scratch/data" -o "-c listen_addresses='' -k $scratch" -l "$scratch/postgres.log" -w start >/dev/null

# Pull the relevant source definitions from the actual checked-in migrations so
# disposable tests do not guess column types or accidentally grant extra reads.
python3 - <<'PY' > "$scratch/schema.sql"
from pathlib import Path
import re

migrations = Path("supabase/migrations")
baseline = (migrations / "20260716112908_production_schema_baseline.sql").read_text()
projection = (migrations / "20260720105524_add_projection_materialization_transactions.sql").read_text()
game_state = (migrations / "20261113180000_games_game_state.sql").read_text()
audit_index = (migrations / "20261106233000_cron_job_audit_report_index.sql").read_text()
tables = (
    "games", "nhl_api_game_payloads_raw", "cron_job_audit", "wgo_skater_stats",
    "entity_metric_rankings", "nst_gamelog_5v5_counts", "nst_gamelog_5v5_counts_oi",
    "rolling_player_game_metrics", "rolling_player_metric_support_payloads",
)
print("create role anon; create role authenticated; create role service_role bypassrls;")
print("create role fixture_owner; grant create, usage on schema public to fixture_owner;")
print("alter default privileges for role fixture_owner grant execute on functions to anon, authenticated;")

for table in tables:
    print(re.search(rf"CREATE TABLE public\.{table} \(.*?\n\);", baseline, re.S)[0])
    for constraint in re.findall(
        rf"ALTER TABLE ONLY public\.{table}\n    ADD CONSTRAINT [^;]+;", baseline
    ):
        if " FOREIGN KEY " not in constraint:
            print(constraint)
    print(re.search(rf"GRANT [^;]+ ON TABLE public\.{table} TO service_role;", baseline)[0])

for table in ("nst_gamelog_5v5_counts", "nst_gamelog_5v5_counts_oi"):
    print(re.search(rf"ALTER TABLE public\.{table} ALTER COLUMN id ADD GENERATED[^;]+;", baseline)[0])

for statement in re.findall(r"alter table public\.games\b[^;]+;", game_state, re.I):
    print(statement)

print(re.search(r"create unique index nhl_api_game_payloads_raw_snapshot_identity_idx[^;]+;", projection)[0])
for table in ("nhl_api_game_payload_snapshot_heads", "projection_pipeline_state"):
    print(re.search(rf"create table public\.{table} \(.*?\n\);", projection, re.S)[0])
    print(re.search(rf"grant select, insert, update on table public\.{table}\s+to service_role;", projection)[0])

for name in (
    "idx_games_date", "idx_entity_metric_rankings_lookup", "idx_rpgm_latest_snapshot_lookup",
    "idx_rpgm_player_date", "idx_nst_gamelog_5v5_counts_season", "idx_nst_gamelog_5v5_counts_oi_season",
    "wgo_skater_stats_date_idx", "nhl_api_game_payloads_raw_season_date_idx",
):
    print(re.search(rf"CREATE INDEX {name} [^;]+;", baseline)[0])
print(re.search(r"^create index if not exists cron_job_audit_run_time_idx[^;]+;", audit_index, re.M)[0])
print("set role fixture_owner;")
PY

psql=("$pgbin/psql" -X -q -v VERBOSITY=terse -v ON_ERROR_STOP=1 -h "$scratch" -U postgres)
migration=supabase/migrations/20261118151903_rankings_publication_readiness.sql
fixture=supabase/tests/rankings_publication_readiness.sql
"${psql[@]}" -f "$scratch/schema.sql" -f "$migration" -c 'reset role' -f "$fixture"
echo "Rankings source readiness fixture passed."

if [[ ${1:-} == --benchmark ]]; then
  # Keep the production-shaped fixture rows and add a season-sized older
  # cohort. Extract the inner query to expose the plan hidden by PL/pgSQL.
  python3 - "$fixture" "$migration" <<'PY' > "$scratch/benchmark.sql"
from pathlib import Path
import re
import sys

print(Path(sys.argv[1]).read_text().split("do $$", 1)[0])
print("""
insert into public.wgo_skater_stats
  (id, player_id, player_name, date, games_played, season_id, game_id, toi_per_game_5v5)
select 1000+i*100+j, i, 'Fixture ' || i, '2026-09-25'::date+j, 1, 20262027, 2026020000+j, 700
from generate_series(100, 1046) i cross join generate_series(1, 50) j;
insert into public.entity_metric_rankings
  (entity_type, entity_id, season_id, snapshot_date, window_type, window_semantics, strength_state,
   metric_key, peer_group_type, peer_group_key)
select 'skater', i, 20262027, '2026-11-14', 'season', 'season_to_date', '5v5',
  'points_per_60', 'all_skaters', 'all' from generate_series(100, 1046) i;
insert into public.rolling_player_game_metrics (player_id, game_date, game_id, season, strength_state, updated_at)
select player_id, date, game_id, season_id, '5v5', '2026-11-15 10:00Z'
from public.wgo_skater_stats where player_id >= 100;
insert into public.rolling_player_metric_support_payloads
  (player_id, game_date, game_id, season, strength_state, updated_at, support_payload)
select player_id, game_date, game_id, season, strength_state, updated_at,
  '{"windowCountSupport":{"version":"rolling-player-window-counts-v1"}}'
from public.rolling_player_game_metrics where player_id >= 100;
analyze;
set local role service_role;
\\timing on
with receipt as (select public.read_rankings_publication_readiness(20262027, '2026-11-14', '2026-11-17') as data)
select data->>'status' as status, jsonb_array_length(data->'expectedRollingSources') as cohort,
  length(data::text) as bytes from receipt;
""")
body = Path(sys.argv[2]).read_text().split("  with calendar", 1)[1].split("  into receipt", 1)[0]
args = {
    "p_season": "20262027", "p_last_served": "date '2026-11-14'", "p_cutoff": "date '2026-11-17'",
    "season_start": "date '2026-09-01'", "season_year": "2026",
}
plan = re.sub(r"\b(?:" + "|".join(args) + r")\b", lambda match: args[match[0]], "with calendar" + body + " from detail;")
print("explain (analyze, buffers) " + plan + "\nrollback;")
PY
  "${psql[@]}" -f "$scratch/benchmark.sql"
fi
