#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 benchmark for the FORGE trend-band reader (Claude pregame capture lane, TJ plan
2026-11-15). Offline only: never connects to a hosted database.

It builds a production-shaped copy of public.sustainability_trend_bands (same columns, primary key and both
secondary indexes, about 10-11M rows, about 380 B per row), shaped like the writer:
  * history mode: one snapshot per game date for each player, written per player (clustered by player);
  * the daily cron: snapshot_date = each calendar day for player_totals_unified rows 0-999 only (about 750
    players), written per run (clustered by date); players outside that set keep only history (hard-stale) or
    have no rows at all;
  * each snapshot: 15 metrics x 4 windows; a window with no known value is skipped; some metrics are absent;
  * churn: history re-upserts and daily re-runs leave new tuple versions, then a plain VACUUM.
Then it runs, per team, the OLD statement (what PostgREST sends for the reader's GET: limit=12000 capped by
max_rows to LIMIT 1000) and the NEW function from ../sql/forge_latest_trend_bands.sql, with EXPLAIN (ANALYZE,
BUFFERS) after a server restart (empty shared buffers; the OS cache cannot be dropped without sudo, so page
counts, not milliseconds, are the evidence). It exports both result sets as PostgREST-style JSON for the
Vitest comparison through the real TypeScript selection code.

Usage (from the repository root):
  LC_ALL=C /usr/local/bin/python3 -I <this file> init     # initdb + generate (about 10 min, about 7 GB)
  LC_ALL=C /usr/local/bin/python3 -I <this file> bench    # plans, page counts, exports
  LC_ALL=C /usr/local/bin/python3 -I <this file> stop | destroy
Data lives in $STB_BENCH_DIR (required; use the session scratchpad), never in the repository.
"""
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

import psycopg2

PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55542
HERE = Path(__file__).resolve().parent
FUNCTION_SQL = HERE.parent / "sql" / "forge_latest_trend_bands.sql"
OUT = HERE.parent / "results"
BASE = Path(os.environ.get("STB_BENCH_DIR", ""))
DATA = BASE / "data"
SOCK = Path(f"/tmp/stb-sock-{PORT}")  # Unix socket paths are limited to 103 bytes
LOG = BASE / "server.log"

AS_OF = "2026-11-14"
METRICS = ["shots_per_60", "icf_per_60", "ixg_per_60", "points_per_60_5v5", "pp_goals_per_60", "pp_points_per_60",
           "hits_per_60", "blocks_per_60", "ipp", "sh_pct", "on_ice_sh_pct", "on_ice_sv_pct", "pp_toi_pct", "pdo",
           "fantasy_score"]
WINDOWS = ["l3", "l5", "l10", "l20"]
# The reader's lists, in the order the TypeScript constants hold them (TREND_BAND_METRIC_PRIORITY,
# FORGE_TREND_ADJUSTMENT_WINDOW_PRIORITY); verified against the source by the Vitest comparison.
READER_METRICS = ["fantasy_score", "ixg_per_60", "shots_per_60", "points_per_60_5v5"]
READER_WINDOWS = ["l5", "l10"]
PLAYER0 = 8470000
EDGE0 = 8490000

DDL = """
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create table public.sustainability_trend_bands (
    player_id integer NOT NULL, season_id integer, snapshot_date date NOT NULL, metric_key text NOT NULL,
    window_code text NOT NULL, baseline numeric, ewma numeric, value numeric NOT NULL, ci_lower numeric NOT NULL,
    ci_upper numeric NOT NULL, n_eff numeric, prior_weight numeric, z_score numeric, percentile numeric,
    exposure numeric, distribution jsonb, computed_at timestamp with time zone DEFAULT now() NOT NULL
);
grant select on public.sustainability_trend_bands to service_role;
create function public.u(text) returns float8 language sql immutable parallel safe
  as $$ select (hashtext($1)::bigint & 2147483647)::float8 / 2147483647.0 $$;
"""

# Value columns from one hash per row; distribution about 200 bytes of jsonb, as the writer stores.
VALUES = """
  round((abs(h %% 100000) / 10000.0)::numeric, 4) as baseline,
  round((abs((h >> 3) %% 100000) / 10000.0)::numeric, 4) as ewma,
  round((abs((h >> 5) %% 100000) / 10000.0)::numeric, 4) as value,
  round((abs((h >> 5) %% 100000) / 10000.0 - abs((h >> 9) %% 3000) / 1000.0)::numeric, 4) as ci_lower,
  round((abs((h >> 5) %% 100000) / 10000.0 + abs((h >> 11) %% 3000) / 1000.0)::numeric, 4) as ci_upper,
  round((abs((h >> 13) %% 2000) / 100.0)::numeric, 3) as n_eff,
  round((abs((h >> 2) %% 1000) / 1000.0)::numeric, 4) as prior_weight,
  round(((h %% 4000) / 1000.0)::numeric, 4) as z_score,
  round((abs((h >> 7) %% 1000) / 10.0)::numeric, 2) as percentile,
  round((abs((h >> 4) %% 90000) / 100.0)::numeric, 2) as exposure,
  jsonb_build_object('family', 'gamma', 'alpha', round((abs(h %% 977) / 13.0)::numeric, 6),
    'beta', round((abs(h %% 541) / 97.0)::numeric, 6), 'prior_alpha', round((abs(h %% 313) / 7.0)::numeric, 6),
    'prior_beta', round((abs(h %% 211) / 11.0)::numeric, 6), 'games', abs(h %% 40),
    'samples', jsonb_build_array(abs(h %% 101) / 10.0, abs(h %% 103) / 10.0, abs(h %% 107) / 10.0,
      abs(h %% 109) / 10.0, abs(h %% 113) / 10.0), 'version', 'bands-v3')
"""

# Omission rules shared by both phases. Worst cases for the per-key probe: players idx % 40 = 7 lose l5 on the
# reader's metrics for the last 60 days; idx % 40 = 9 never have l5 on them.
OMIT = """
  public.u(p.id || m.k || 'absent') >= 0.02
  and not (w.w = 'l3' and public.u(p.id || m.k || d.dt || 'l3') < 0.10)
  and not (w.w = 'l5' and m.k = any(%(reader)s) and (p.i %% 40 = 9 or (p.i %% 40 = 7 and d.dt >= date '2026-09-15')))
  and not (w.w = 'l5' and public.u(p.id || m.k || 'l5gap') < 0.04 and d.dt >= date '2026-10-15')
"""

HISTORY = """
insert into public.sustainability_trend_bands
select p.id, 20252026, d.dt, m.k, w.w, """ + VALUES + """, timestamptz '2026-04-20 11:18:00+00'
from generate_series(0, 1399) as gi(i)
cross join lateral (select gi.i as i, %(p0)s + gi.i as id) as p
cross join lateral (select (date '2025-10-07' + round(g.k * 2.2)::int + (p.i %% 3)) as dt
                    from generate_series(0, 81) as g(k)) as d
cross join unnest(%(metrics)s::text[]) as m(k)
cross join unnest(%(windows)s::text[]) as w(w)
cross join lateral (select hashtext(p.id || '|' || m.k || '|' || w.w || '|' || d.dt)::bigint as h) as hh
where """ + OMIT + """
order by p.id, d.dt, m.k, w.w
"""

DAILY = """
insert into public.sustainability_trend_bands
select p.id, 20262027, d.dt, m.k, w.w, """ + VALUES + """, ((d.dt + time '11:18') at time zone 'UTC')
from generate_series(date '2026-08-15', date '2026-11-15', interval '1 day') as dd(t)
cross join lateral (select dd.t::date as dt) as d
cross join generate_series(0, 749) as gi(i)
cross join lateral (select gi.i as i, %(p0)s + gi.i as id) as p
cross join unnest(%(metrics)s::text[]) as m(k)
cross join unnest(%(windows)s::text[]) as w(w)
cross join lateral (select hashtext(p.id || '|' || m.k || '|' || w.w || '|' || d.dt)::bigint as h) as hh
where """ + OMIT + """
  and (d.dt <= date '2026-11-14' or p.i < 50)
order by d.dt, p.id, m.k, w.w
"""

CHURN = [
    # History re-upserts (history mode re-writes every snapshot it computes) for 10% of players.
    "update public.sustainability_trend_bands set computed_at = computed_at + interval '200 days' "
    "where season_id = 20252026 and (player_id - %(p0)s) %% 10 = 3",
    # A daily re-run that re-upserted the last 7 days for 30% of the cron's players.
    "update public.sustainability_trend_bands set computed_at = computed_at + interval '1 hour' "
    "where snapshot_date between date '2026-11-08' and date '2026-11-14' and (player_id - %(p0)s) %% 10 in (1, 4, 8)",
]


def edge_rows():
    """Hand-made players for the selection edge cases, added after the bulk data (physically last)."""
    import datetime as dt
    as_of = dt.date.fromisoformat(AS_OF)
    rows = []

    def add(pid, day_offsets, combos, value=5.0, lo=4.0, hi=6.0, n_eff=6.0):
        for off in day_offsets:
            date = (as_of - dt.timedelta(days=off)).isoformat()
            for metric, window in combos:
                rows.append((pid, date, metric, window, value + off / 100.0, lo, hi, n_eff))

    all_reader = [(m, w) for m in READER_METRICS for w in READER_WINDOWS]
    fillers = [EDGE0 + i for i in range(11)]
    for pid in fillers:  # fresh every day for 30 days, all eight reader keys
        add(pid, range(0, 30), all_reader, value=7.0)
    e1, e2, e3, e4, e5, f1, b1 = (EDGE0 + 100 + i for i in range(7))
    add(e1, range(0, 30), all_reader, value=8.0)                      # equal-date ties: fantasy_score/l5 wins
    add(e2, range(0, 3), [c for c in all_reader if c != ("fantasy_score", "l5")], value=9.0)
    add(e2, range(3, 30), all_reader, value=9.0)                      # newest date lacks fantasy_score/l5
    add(e3, range(40, 70), all_reader, value=3.0)                     # hard-stale only
    # e4: no rows at all (missing)
    add(e5, range(10, 40), all_reader, value=6.5)                     # soft-stale: newest is 10 days old
    add(f1, [-1, -2], all_reader, value=99.0)                         # rows after as_of must be ignored
    add(f1, range(0, 30), all_reader, value=4.0)
    team = fillers + [e1, e2, e3, e4, e5, f1]
    return rows, team, b1


def connect(dbname="postgres"):
    return psycopg2.connect(host=str(SOCK), port=PORT, user="postgres", dbname=dbname)


def start():
    SOCK.mkdir(parents=True, exist_ok=True)
    subprocess.run([PG / "pg_ctl", "-D", DATA, "-l", LOG, "-w", "-o",
                    f"-p {PORT} -k {SOCK} -c listen_addresses= -c fsync=off -c synchronous_commit=off "
                    "-c full_page_writes=off -c shared_buffers=256MB -c maintenance_work_mem=2GB -c max_wal_size=32GB "
                    "-c autovacuum=off -c track_io_timing=on -c max_parallel_workers_per_gather=2", "start"],
                   check=True, capture_output=True)


def stop():
    if (DATA / "postmaster.pid").exists():
        subprocess.run([PG / "pg_ctl", "-D", DATA, "-m", "fast", "-w", "stop"], check=True, capture_output=True)


def restart():
    stop()
    start()


def init():
    if DATA.exists():
        sys.exit(f"{DATA} exists; run destroy first")
    BASE.mkdir(parents=True, exist_ok=True)
    subprocess.run([PG / "initdb", "-D", DATA, "-U", "postgres", "-A", "trust", "--no-sync"], check=True, capture_output=True)
    start()
    params = {"p0": PLAYER0, "metrics": METRICS, "windows": WINDOWS, "reader": READER_METRICS}
    conn = connect()
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(DDL)
    cur.execute("set work_mem = '1GB'")
    t0 = time.time()
    cur.execute(HISTORY, params)
    print(f"history rows {cur.rowcount} ({time.time() - t0:.0f}s)", flush=True)
    t0 = time.time()
    cur.execute(DAILY, params)
    print(f"daily rows {cur.rowcount} ({time.time() - t0:.0f}s)", flush=True)
    rows, team, b1 = edge_rows()
    cur.executemany("insert into public.sustainability_trend_bands (player_id, season_id, snapshot_date, metric_key, "
                    "window_code, value, ci_lower, ci_upper, n_eff) values (%s, 20262027, %s, %s, %s, %s, %s, %s, %s)", rows)
    t0 = time.time()
    cur.execute("alter table public.sustainability_trend_bands add constraint sustainability_trend_bands_pkey "
                "primary key (player_id, snapshot_date, metric_key, window_code)")
    cur.execute("create index idx_stb_player_metric on public.sustainability_trend_bands (player_id, metric_key, snapshot_date desc)")
    cur.execute("create index idx_stb_snapshot on public.sustainability_trend_bands (snapshot_date desc)")
    print(f"indexes ({time.time() - t0:.0f}s)", flush=True)
    for statement in CHURN:
        cur.execute(statement, params)
        print(f"churn rows {cur.rowcount}", flush=True)
    # B1 sits exactly on the edge team's cap boundary date, so the old LIMIT 1000 cuts its tied rows.
    boundary = boundary_date(cur, team)
    b1_rows = [(b1, boundary, m, w, 2.0, 1.0, 3.0, 5.0) for m in READER_METRICS for w in READER_WINDOWS]
    cur.executemany("insert into public.sustainability_trend_bands (player_id, season_id, snapshot_date, metric_key, "
                    "window_code, value, ci_lower, ci_upper, n_eff) values (%s, 20262027, %s, %s, %s, %s, %s, %s, %s)", b1_rows)
    cur.execute("vacuum public.sustainability_trend_bands")
    cur.execute("select pg_size_pretty(pg_total_relation_size('public.sustainability_trend_bands')), "
                "pg_size_pretty(pg_relation_size('public.sustainability_trend_bands')), count(*) from public.sustainability_trend_bands")
    print("total, heap, rows:", cur.fetchone(), flush=True)
    cur.execute(FUNCTION_SQL.read_text())
    conn.close()
    (BASE / "edge.json").write_text(json.dumps({"team": team + [b1], "b1": b1, "boundary": boundary}))


def boundary_date(cur, team):
    cur.execute("select snapshot_date::text from public.sustainability_trend_bands where player_id = any(%s) "
                "and metric_key = any(%s) and window_code = any(%s) and snapshot_date <= %s "
                "order by snapshot_date desc limit 1 offset 999", (team, READER_METRICS, READER_WINDOWS, AS_OF))
    return cur.fetchone()[0]


# ----- measurement -----

COLS = ["player_id", "snapshot_date", "metric_key", "window_code", "value", "ci_lower", "ci_upper", "n_eff"]
QCOLS = ", ".join(f'"public"."sustainability_trend_bands"."{c}"' for c in COLS)
T = '"public"."sustainability_trend_bands"'
# What PostgREST 12 runs for the reader's GET (in.(...) lists, lte, order=snapshot_date.desc, limit=12000 capped
# to max_rows = 1000). The order is the reader's only sort key, so ties on the boundary date are unspecified.
OLD_SOURCE = (f"SELECT {QCOLS} FROM {T} WHERE {T}.\"player_id\" = ANY ($1) AND {T}.\"metric_key\" = ANY ($2) "
              f"AND {T}.\"window_code\" = ANY ($3) AND {T}.\"snapshot_date\" <= $4 "
              f"ORDER BY {T}.\"snapshot_date\" DESC{{tie}} LIMIT 1000 OFFSET 0")
WRAP = ("WITH pgrst_source AS ({source}) SELECT null::bigint AS total_result_set, pg_catalog.count(_postgrest_t) AS page_total, "
        "coalesce(pg_catalog.json_agg(_postgrest_t), '[]') AS body FROM (SELECT * FROM pgrst_source) _postgrest_t")
NEW_SOURCE = ('SELECT pgrst_call.* FROM "public"."forge_latest_trend_bands"("p_player_ids" := $1, "p_metric_keys" := $2, '
              '"p_window_codes" := $3, "p_as_of" := $4) pgrst_call LIMIT 1000 OFFSET 0')
# Alternative probe for comparison only: per player, the newest eight eligible rows (all rows on the newest date).
ALT_SOURCE = (f"SELECT r.id AS player_id, x.snapshot_date, x.metric_key, x.window_code, x.value, x.ci_lower, x.ci_upper, x.n_eff "
              f"FROM unnest($1::integer[]) AS r(id) CROSS JOIN LATERAL (SELECT b.snapshot_date, b.metric_key, b.window_code, b.value, "
              f"b.ci_lower, b.ci_upper, b.n_eff FROM {T} AS b WHERE b.player_id = r.id AND b.metric_key = ANY ($2) "
              f"AND b.window_code = ANY ($3) AND b.snapshot_date <= $4 ORDER BY b.snapshot_date DESC LIMIT 8) AS x")
TYPES = "(integer[], text[], text[], date)"


def teams():
    def ids(idx):
        return [PLAYER0 + i for i in idx]
    ok = [i for i in range(750) if i % 40 not in (7, 9)]
    edge = json.loads((BASE / "edge.json").read_text())
    return {
        # 9 cron players (fresh), 6 history-only (hard-stale), 3 without rows: like the 2026-11-13 readback.
        "typical_a": ids(ok[3:300:33] + [760, 845, 930, 1012, 1101, 1250] + [1410, 1500, 1590]),
        "typical_b": ids(ok[17:700:76] + [771, 866, 954, 1043, 1188, 1333] + [1402, 1477, 1555]),
        "typical_c": ids(ok[40:720:75] + [799, 888, 977, 1066, 1155, 1244] + [1444, 1522, 1599]),
        "all_cron": ids(ok[5:720:40]),
        "worst_l5_gap_60d": ids([i for i in range(750) if i % 40 == 7][:18]),
        "worst_l5_never": ids([i for i in range(750) if i % 40 == 9][:18]),
        "edge": edge["team"],
    }


def args_for(team):
    return (team, READER_METRICS, READER_WINDOWS, AS_OF)


def buffers(plan):
    top = plan[0]["Plan"]
    return {"hit": top.get("Shared Hit Blocks", 0), "read": top.get("Shared Read Blocks", 0),
            "ms": round(plan[0]["Execution Time"], 1), "rows": top.get("Actual Rows")}


def explain(cur, source, team, generic):
    cur.execute("set plan_cache_mode = %s", ("force_generic_plan" if generic else "auto",))
    cur.execute("deallocate all")
    cur.execute(f"prepare q {TYPES} as " + WRAP.format(source=source))
    cur.execute("explain (analyze, buffers, format json) execute q (%s, %s, %s, %s)", args_for(team))
    return cur.fetchone()[0]


def nested_plans(conn):
    plans = [n for n in conn.notices if "Query Text" in n or "duration" in n]
    conn.notices.clear()
    return plans


def cold(source, team, generic=False, nested=False, setup=()):
    restart()
    conn = connect()
    cur = conn.cursor()
    if nested:
        cur.execute("load 'auto_explain'")
        for setting in ("auto_explain.log_min_duration = 0", "auto_explain.log_analyze = on", "auto_explain.log_buffers = on",
                        "auto_explain.log_nested_statements = on", "auto_explain.log_level = notice"):
            cur.execute("set " + setting)
    for statement in setup:
        cur.execute(statement)
    plan = explain(cur, source, team, generic)
    result = {"cold": buffers(plan)}
    result["warm"] = buffers(explain(cur, source, team, generic))
    if nested:
        result["nested"] = [n for n in conn.notices if "forge_latest_trend_bands" not in n or "Index" in n][-3:]
    result["plan"] = plan
    conn.rollback()
    conn.close()
    return result


def summary_line(name, result):
    c, w = result["cold"], result["warm"]
    return f"{name:<44} cold read={c['read']:>6} hit={c['hit']:>6} {c['ms']:>8.1f} ms | warm {w['ms']:>7.1f} ms rows={c['rows']}"


def export_rows(cur, team):
    out = {}
    for name, source in (("old_tie_asc", OLD_SOURCE.format(tie=', "metric_key" ASC, "window_code" ASC')),
                         ("old_tie_desc", OLD_SOURCE.format(tie=', "metric_key" DESC, "window_code" DESC')),
                         ("old_as_sent", OLD_SOURCE.format(tie="")), ("new", NEW_SOURCE)):
        cur.execute("deallocate all")
        cur.execute(f"prepare q {TYPES} as " + WRAP.format(source=source))
        cur.execute("execute q (%s, %s, %s, %s)", args_for(team))
        out[name] = cur.fetchone()[2]
    return out


def set_stats(cur, state):
    if state == "analyzed":
        cur.execute("analyze public.sustainability_trend_bands")
    else:
        cur.execute("delete from pg_statistic where starelid = 'public.sustainability_trend_bands'::regclass")


def bench():
    start() if not (DATA / "postmaster.pid").exists() else None
    OUT.mkdir(parents=True, exist_ok=True)
    all_teams = teams()
    report = {"as_of": AS_OF, "teams": all_teams, "runs": {}}
    lines = []
    conn = connect()
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("select count(*), pg_size_pretty(pg_relation_size('public.sustainability_trend_bands')), "
                "pg_size_pretty(pg_total_relation_size('public.sustainability_trend_bands')), "
                "(select reltuples::bigint from pg_class where oid = 'public.sustainability_trend_bands'::regclass) "
                "from public.sustainability_trend_bands")
    report["table"] = dict(zip(["rows", "heap", "total", "reltuples"], cur.fetchone()))
    cur.execute(FUNCTION_SQL.read_text())  # always measure the current candidate
    exports = {}
    for name, team in all_teams.items():
        exports[name] = {"playerIds": team, "asOf": AS_OF, **export_rows(cur, team)}
    conn.close()
    (OUT / "rows-by-team.json").write_text(json.dumps(exports, indent=1, sort_keys=True) + "\n")
    lines.append(f"table: {report['table']}")
    for state in ("analyzed", "no_stats"):
        conn = connect()
        conn.autocommit = True
        set_stats(conn.cursor(), state)
        conn.close()
        lines.append(f"\n== statistics: {state} ==")
        for name, team in all_teams.items():
            runs = {
                "old_custom": cold(OLD_SOURCE.format(tie=""), team),
                "old_generic": cold(OLD_SOURCE.format(tie=""), team, generic=True),
                "new_custom": cold(NEW_SOURCE, team, nested=True),
                "new_generic": cold(NEW_SOURCE, team, generic=True, nested=True),
                "alt_per_player_generic": cold(ALT_SOURCE, team, generic=True),
            }
            for label, setup in (("new_generic_pk_only", ("begin", "drop index public.idx_stb_player_metric")),
                                 ("new_generic_player_metric_only", ("begin", "alter table public.sustainability_trend_bands drop constraint sustainability_trend_bands_pkey"))):
                runs[label] = cold(NEW_SOURCE, team, generic=True, nested=True, setup=setup)
            report["runs"][f"{state}/{name}"] = runs
            for label, result in runs.items():
                lines.append(summary_line(f"{name}/{label}", result))
            print("\n".join(lines[-len(runs):]), flush=True)
    (OUT / "bench-report.json").write_text(json.dumps(report, indent=1, default=str) + "\n")
    (OUT / "bench-summary.txt").write_text("\n".join(lines) + "\n")
    print(f"wrote {OUT}")



FIXTURE = HERE.parents[4] / "web/lib/projections/queries/__fixtures__/trend-band-latest/bench-rows.json.gz"


def write_fixture():
    """Pack results/rows-by-team.json (the rows each statement returned) into the Vitest fixture."""
    import gzip
    exports = json.loads((OUT / "rows-by-team.json").read_text())

    def pack(rows):
        return [[r["player_id"], r["snapshot_date"], r["metric_key"], r["window_code"], r["value"], r["ci_lower"],
                 r["ci_upper"], r["n_eff"]] for r in rows]
    teams = {}
    for name, team in exports.items():
        sent = team["old_as_sent"]
        teams[name] = {"playerIds": team["playerIds"], "old_as_sent": pack(sent), "new": pack(team["new"]),
                       "boundary": min(r["snapshot_date"] for r in sent) if len(sent) == 1000 else None}
        if name == "edge":  # the team built to put a player on the boundary date; both tie orders kept
            teams[name].update(old_tie_asc=pack(team["old_tie_asc"]), old_tie_desc=pack(team["old_tie_desc"]))
    body = {"asOf": AS_OF, "readerMetrics": READER_METRICS, "readerWindows": READER_WINDOWS, "teams": teams}
    FIXTURE.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE.write_bytes(gzip.compress(json.dumps(body, separators=(",", ":"), sort_keys=True).encode(), mtime=0))
    print(f"wrote {FIXTURE} ({FIXTURE.stat().st_size} bytes)")


NARROW_INDEX = ("create index idx_stb_player_metric_window_date on public.sustainability_trend_bands "
                "(player_id, metric_key, window_code, snapshot_date desc)")


def bench_index():
    """The narrowest index for the per-key probe, measured in both statistics states, then dropped."""
    start() if not (DATA / "postmaster.pid").exists() else None
    conn = connect()
    conn.autocommit = True
    cur = conn.cursor()
    t0 = time.time()
    cur.execute(NARROW_INDEX)
    built = time.time() - t0
    cur.execute("select pg_size_pretty(pg_relation_size('public.idx_stb_player_metric_window_date')), "
                "pg_size_pretty(pg_relation_size('public.idx_stb_player_metric')), "
                "pg_size_pretty(pg_relation_size('public.sustainability_trend_bands_pkey'))")
    sizes = cur.fetchone()
    conn.close()
    lines = [f"narrow index: built {built:.1f}s locally; size {sizes[0]} (idx_stb_player_metric {sizes[1]}, pkey {sizes[2]})"]
    report = {"build_seconds": round(built, 1), "sizes": sizes, "runs": {}}
    try:
        for state in ("no_stats", "analyzed"):
            conn = connect()
            conn.autocommit = True
            set_stats(conn.cursor(), state)
            conn.close()
            lines.append(f"\n== with narrow index, statistics: {state} ==")
            for name, team in teams().items():
                result = cold(NEW_SOURCE, team, generic=True, nested=True)
                text = "\n".join(result.get("nested", []))
                used = sorted(set(part.split(" using ")[1].split()[0] for part in text.split("->") if " using " in part))
                report["runs"][f"{state}/{name}"] = {"cold": result["cold"], "warm": result["warm"], "indexes": used}
                lines.append(summary_line(f"{name}/new_generic", result) + f"  via {','.join(used)}")
                print(lines[-1], flush=True)
    finally:
        conn = connect()
        conn.autocommit = True
        conn.cursor().execute("drop index if exists public.idx_stb_player_metric_window_date")
        conn.close()
    (OUT / "bench-narrow-index.json").write_text(json.dumps(report, indent=1, default=str) + "\n")
    (OUT / "bench-narrow-index.txt").write_text("\n".join(lines) + "\n")



def proof():
    """Function contract on the benchmark database: refusals, grants, one row per key in byte order, nulls."""
    start() if not (DATA / "postmaster.pid").exists() else None
    conn = connect()
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(FUNCTION_SQL.read_text())
    failures = []

    def check(name, ok):
        print(("PASS " if ok else "FAIL ") + name)
        if not ok:
            failures.append(name)

    def refused(name, args, fragment, role="service_role"):
        try:
            cur.execute("begin")
            cur.execute(f"set local role {role}")
            cur.execute("select * from public.forge_latest_trend_bands(%s::integer[], %s::text[], %s::text[], %s::date)", args)
            check(name, False)
        except psycopg2.Error as error:
            check(name, fragment in str(error))
        finally:
            cur.execute("rollback")

    edge = json.loads((BASE / "edge.json").read_text())
    e1, e3, e4 = EDGE0 + 100, EDGE0 + 102, EDGE0 + 103
    ok = (edge["team"], READER_METRICS, READER_WINDOWS, AS_OF)
    refused("refuses a null as-of date", (edge["team"], READER_METRICS, READER_WINDOWS, None), "p_as_of is required")
    refused("refuses an empty player list", ([], READER_METRICS, READER_WINDOWS, AS_OF), "must be non-empty")
    refused("refuses a null element", ([e1, None], READER_METRICS, READER_WINDOWS, AS_OF), "must not be null")
    refused("refuses more than 1000 keys", (list(range(1, 127)), READER_METRICS, READER_WINDOWS, AS_OF), "1008 keys requested")
    refused("anon cannot execute", ok, "permission denied", role="anon")
    refused("authenticated cannot execute", ok, "permission denied", role="authenticated")
    cur.execute("begin")
    cur.execute("set local role service_role")
    cur.execute("select player_id, metric_key, window_code, snapshot_date::text, value from "
                "public.forge_latest_trend_bands(%s, %s, %s, %s::date)", ([e4, e3, e1, e1], READER_METRICS, READER_WINDOWS, AS_OF))
    rows = cur.fetchall()
    cur.execute("rollback")
    keys = [(r[0], r[1], r[2]) for r in rows]
    expected = [(p, m, w) for p in sorted({e1, e3, e4}) for m in sorted(READER_METRICS) for w in sorted(READER_WINDOWS)]
    check("one row per distinct key, ordered by player, metric, window in byte order", keys == expected)
    check("a player without rows gets null rows, not none", all(r[3] is None and r[4] is None for r in rows if r[0] == e4))
    check("a hard-stale player's rows come back with their dates", all(r[3] is not None and r[3] <= "2026-10-05" for r in rows if r[0] == e3))
    cur.execute("select max(snapshot_date)::text from public.forge_latest_trend_bands(%s, %s, %s, %s::date)",
                ([EDGE0 + 105], READER_METRICS, READER_WINDOWS, AS_OF))
    check("rows after the as-of date are ignored (F1 also has 2026-11-15/16 rows)", cur.fetchone()[0] == AS_OF)
    cur.execute("select provolatile, prosecdef, proconfig from pg_proc where proname = 'forge_latest_trend_bands'")
    volatile, definer, config = cur.fetchone()
    check("STABLE, SECURITY INVOKER, search_path pinned", volatile == "s" and not definer and config == ["search_path=pg_catalog"])
    conn.close()
    print(f"{'FAILED' if failures else 'OK'}: {len(failures)} failure(s)")
    sys.exit(1 if failures else 0)

if __name__ == "__main__":
    if not os.environ.get("STB_BENCH_DIR"):
        sys.exit("Set STB_BENCH_DIR to a scratch directory outside the repository")
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "init":
        init()
    elif command == "start":
        start()
    elif command == "stop":
        stop()
    elif command == "destroy":
        stop()
        shutil.rmtree(BASE)
    elif command == "bench-index":
        bench_index()
    elif command == "proof":
        proof()
    elif command == "fixture":
        write_fixture()
    elif command == "bench":
        bench()
    else:
        sys.exit("usage: init | start | stop | destroy | bench | bench-index | proof | fixture")
