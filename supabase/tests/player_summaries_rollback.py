#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for the player underlying-summary rollback.

Unix socket only, no hosted credentials, no network. Builds nhl_api_game_payloads_raw and the
snapshot-head table with production column definitions, installs the raw table's real triggers
(no-update, no-delete, writer-busy guard, projection lock, head advance) by extracting them from
the migrations, and drives the real planner (web/lib/underlying-stats/playerSummaryRollbackPlan.ts
via player_summaries_rollback_driver.mjs) through backup -> rebuild -> rollback. The reader check
runs the direct-PG summary query extracted verbatim from playerStatsLandingServer.ts.
Run: LC_ALL=C python3 -I supabase/tests/player_summaries_rollback.py
(needs Homebrew postgresql@15, psycopg2 and node >= 22.18 for type stripping).
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import psycopg2
import psycopg2.extras

ROOT = Path(__file__).resolve().parents[2]
BASELINE = ROOT / "supabase/migrations/20260716112908_production_schema_baseline.sql"
PROJECTION = ROOT / "supabase/migrations/20260720105524_add_projection_materialization_transactions.sql"
NORMALIZATION = ROOT / "supabase/migrations/20260722010355_add_transactional_gamecenter_normalization.sql"
LANDING_SERVER = ROOT / "web/lib/underlying-stats/playerStatsLandingServer.ts"
DRIVER = ROOT / "supabase/tests/player_summaries_rollback_driver.mjs"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55482
PREFIX = "derived://underlying-player-summary-v2/"
G1, G2 = 2026020087, 2026020088
checks = []

TABLES = """
create role anon; create role authenticated; create role service_role;
create table public.nhl_api_game_payloads_raw (
  id bigserial primary key, game_id bigint not null, endpoint text not null, season_id bigint,
  game_date date, source_url text not null, payload_hash text not null, payload jsonb not null,
  fetched_at timestamptz not null default now(), created_at timestamptz not null default now(),
  constraint nhl_api_game_payloads_raw_endpoint_check check (endpoint = any (array['play-by-play','boxscore','landing','shiftcharts'])),
  constraint nhl_api_game_payloads_raw_payload_hash_nonempty_chk check (btrim(payload_hash) <> ''),
  constraint nhl_api_game_payloads_raw_source_url_nonempty_chk check (btrim(source_url) <> ''),
  constraint nhl_api_game_payloads_raw_game_id_endpoint_payload_hash_key unique (game_id, endpoint, payload_hash));
create index nhl_api_game_payloads_raw_game_endpoint_idx on public.nhl_api_game_payloads_raw (game_id, endpoint, fetched_at desc);
"""


def check(name, ok, detail=""):
    checks.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""))


def extract(path, pattern):
    match = re.search(pattern, path.read_text(), re.S)
    if not match:
        raise SystemExit(f"could not find {pattern!r} in {path}")
    return match.group(0)


def trigger_sql():
    parts = [
        extract(BASELINE, r"CREATE FUNCTION public\.prevent_nhl_api_game_payloads_raw_mutation\(\).*?\$\$;\n"),
        extract(BASELINE, r"CREATE TRIGGER nhl_api_game_payloads_raw_no_update [^\n]*\n"),
        # Snapshot identity index, head table, both row functions and the three row triggers, as the migration defines them.
        extract(PROJECTION, r"create unique index nhl_api_game_payloads_raw_snapshot_identity_idx.*?;\n"),
        extract(PROJECTION, r"create table public\.nhl_api_game_payload_snapshot_heads \(.*?\n\);\n"),
        extract(PROJECTION, r"create or replace function public\.lock_nhl_api_game_payload_snapshot_insert\(\).*?\n\$\$;\n"),
        extract(PROJECTION, r"create or replace function public\.advance_nhl_api_game_payload_snapshot_head\(\).*?\n\$\$;\n"),
        extract(PROJECTION, r"create trigger nhl_api_game_payloads_raw_projection_lock.*?;\n"),
        extract(PROJECTION, r"create trigger nhl_api_game_payloads_raw_advance_snapshot_head.*?;\n"),
        extract(PROJECTION, r"create trigger nhl_api_game_payloads_raw_no_delete.*?;\n"),
        extract(NORMALIZATION, r"create or replace function public\.serialize_nhl_api_game_normalization_writes\(\).*?\n\$\$;\n"),
        extract(NORMALIZATION, r"create trigger nhl_api_game_payloads_raw_normalization_serialize.*?;\n"),
    ]
    return "\n".join(parts)


def reader_sql():
    """The direct-PG partition read in fetchPlayerStatsSummaryPayloadRowsViaPg, verbatim."""
    sql = extract(LANDING_SERVER, r"select game_id, payload, fetched_at, source_url\s+from public\.nhl_api_game_payloads_raw\s+"
                  r"where endpoint = \$1\s+and source_url = any\(\$2::text\[\]\)\s+and game_id = any\(\$3::bigint\[\]\)\s+"
                  r"order by game_id asc, fetched_at desc")
    return sql.replace("$1", "%(endpoint)s").replace("$2", "%(urls)s").replace("$3", "%(games)s")


def driver(payload):
    result = subprocess.run(["node", "--no-warnings", str(DRIVER)], input=json.dumps(payload), capture_output=True, text=True, cwd=ROOT)
    if result.returncode != 0:
        raise SystemExit(f"driver failed: {result.stderr}")
    return json.loads(result.stdout)


def url(strength, game):
    return f"{PREFIX}individual/{strength}/{game}"


def payload(game, generated_at, value):
    return {"version": 1, "generatedAt": generated_at, "game": {"id": game, "seasonId": 20262027}, "rows": [{"value": value}]}


def insert(cur, rows, conflict=""):
    """One multi-row INSERT statement, as PostgREST issues it."""
    values = [(r["game_id"], r["endpoint"], 20262027, "2026-10-12", r["source_url"], r["payload_hash"],
               json.dumps(r["payload"]), r["fetched_at"]) for r in rows]
    psycopg2.extras.execute_values(cur, "insert into public.nhl_api_game_payloads_raw (game_id, endpoint, season_id, game_date, source_url, payload_hash, payload, fetched_at) values %s" + conflict, values,
                                   template="(%s, %s, %s, %s, %s, %s, %s::jsonb, %s::timestamptz)", page_size=1000)
    return cur.rowcount


def all_rows(cur, with_payload):
    cols = "id, game_id, endpoint, season_id, game_date::text, source_url, payload_hash, payload, fetched_at::text, created_at::text" if with_payload else "id, game_id, source_url, fetched_at::text, payload_hash"
    cur.execute(f"select {cols} from public.nhl_api_game_payloads_raw where endpoint = 'landing' and source_url like %s order by id", (PREFIX + "%",))
    names = [d[0] for d in cur.description]
    return [dict(zip(names, row)) for row in cur.fetchall()]


def reader_view(cur, urls):
    """Per partition: what readers serve (first row per game of the verbatim reader query)."""
    view = {}
    for source_url in urls:
        game = int(source_url.rsplit("/", 1)[1])
        cur.execute(reader_sql(), {"endpoint": "landing", "urls": [source_url], "games": [game]})
        rows = cur.fetchall()
        if rows:
            view[source_url] = rows[0][1]["rows"]
    return view


def main():
    tmp = Path(tempfile.mkdtemp(prefix="psrollback-"))
    data, sock = tmp / "data", tmp / "sock"
    sock.mkdir()
    env = {k: v for k, v in os.environ.items() if k in ("PATH", "HOME", "USER", "TMPDIR")}
    env.update({"LC_ALL": "C", "LANG": "C", "TZ": "UTC"})
    subprocess.run([str(PG / "initdb"), "-D", str(data), "-A", "trust", "-U", "postgres", "--no-locale", "-E", "UTF8"], env=env, check=True, capture_output=True)
    subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-l", str(data / "log"), "-o", f"-p {PORT} -k {sock} -h ''", "-w", "start"], env=env, check=True, capture_output=True)
    try:
        conn = psycopg2.connect(host=str(sock), port=PORT, user="postgres", dbname="postgres", options="-c timezone=UTC")
        with conn.cursor() as cur:
            cur.execute(TABLES)
            cur.execute(trigger_sql())
            cur.execute("select tgname from pg_trigger where tgrelid = 'public.nhl_api_game_payloads_raw'::regclass and not tgisinternal order by 1")
            triggers = [r[0] for r in cur.fetchall()]
        conn.commit()
        check("raw table carries the five production triggers", triggers == sorted([
            "nhl_api_game_payloads_raw_advance_snapshot_head", "nhl_api_game_payloads_raw_no_delete",
            "nhl_api_game_payloads_raw_no_update", "nhl_api_game_payloads_raw_normalization_serialize",
            "nhl_api_game_payloads_raw_projection_lock"]), str(triggers))

        # Pre-rebuild state: an older version plus the effective row per partition.
        seed = [
            {"game_id": G1, "endpoint": "landing", "source_url": url("allStrengths", G1), "payload_hash": "v0", "payload": payload(G1, "2026-10-01T00:00:00Z", 0), "fetched_at": "2026-10-01T00:00:00Z"},
            {"game_id": G1, "endpoint": "landing", "source_url": url("allStrengths", G1), "payload_hash": "old-1", "payload": payload(G1, "2026-10-12T04:00:00.123456Z", 1), "fetched_at": "2026-10-12T04:00:00.123456Z"},
            {"game_id": G1, "endpoint": "landing", "source_url": url("fiveOnFive", G1), "payload_hash": "old-2", "payload": payload(G1, "2026-10-12T04:00:00.123456Z", 2), "fetched_at": "2026-10-12T04:00:00.123456Z"},
            {"game_id": G2, "endpoint": "landing", "source_url": url("allStrengths", G2), "payload_hash": "old-3", "payload": payload(G2, "2026-10-12T04:00:00.123456Z", 3), "fetched_at": "2026-10-12T04:00:00.123456Z"},
        ]
        with conn.cursor() as cur:
            insert(cur, seed)
        conn.commit()
        partitions = [url("allStrengths", G1), url("fiveOnFive", G1), url("allStrengths", G2), url("powerPlay", G2)]
        with conn.cursor() as cur:
            before = reader_view(cur, partitions)
            backup = driver({"op": "backup", "gameIds": [G1, G2], "rows": all_rows(cur, True), "createdAt": "2026-11-09T12:00:00.000Z"})
        check("backup holds the effective row per partition, not older versions",
              [p["payload_hash"] for p in backup["manifest"]["partitions"]] == ["old-1", "old-3", "old-2"], str(backup["manifest"]["partitions"]))

        # Immutability: rollback cannot delete or update the rebuild rows.
        for statement, label in (("delete from public.nhl_api_game_payloads_raw where payload_hash = 'old-1'", "delete"),
                                 ("update public.nhl_api_game_payloads_raw set fetched_at = now() where payload_hash = 'old-1'", "update")):
            try:
                with conn.cursor() as cur:
                    cur.execute(statement)
                conn.commit()
                check(f"{label} is refused", False)
            except psycopg2.Error as error:
                conn.rollback()
                check(f"{label} is refused", "rows are immutable" in str(error), str(error).strip())

        # The rebuild: two partitions change, one untouched, one new partition (25-row statement shape).
        rebuild_at = "2026-11-09T10:00:00.654321Z"
        with conn.cursor() as cur:
            insert(cur, [
                {"game_id": G1, "endpoint": "landing", "source_url": url("allStrengths", G1), "payload_hash": "new-1", "payload": payload(G1, rebuild_at, 10), "fetched_at": rebuild_at},
                {"game_id": G2, "endpoint": "landing", "source_url": url("allStrengths", G2), "payload_hash": "new-3", "payload": payload(G2, rebuild_at, 30), "fetched_at": rebuild_at},
                {"game_id": G2, "endpoint": "landing", "source_url": url("powerPlay", G2), "payload_hash": "new-4", "payload": payload(G2, rebuild_at, 40), "fetched_at": rebuild_at},
            ], " on conflict on constraint nhl_api_game_payloads_raw_game_id_endpoint_payload_hash_key do nothing")
        conn.commit()
        with conn.cursor() as cur:
            rebuilt = reader_view(cur, partitions)
        check("readers serve the rebuild", rebuilt[url("allStrengths", G1)] == [{"value": 10}] and rebuilt[url("powerPlay", G2)] == [{"value": 40}], str(rebuilt))

        # Naive rollback: re-insert the backed-up row as-is (what the writer's upsert would do).
        with conn.cursor() as cur:
            old = json.loads(backup["rowsText"].splitlines()[0])
            naive = insert(cur, [{**old, "fetched_at": "2026-11-09T11:00:00Z"}], " on conflict on constraint nhl_api_game_payloads_raw_game_id_endpoint_payload_hash_key do nothing")
            naive_view = reader_view(cur, partitions)
            cur.execute("select payload_hash from public.nhl_api_game_payload_snapshot_heads where game_id = %s and endpoint = 'landing'", (G1,))
            naive_head = cur.fetchone()[0]
        conn.commit()
        check("naive same-hash re-insert writes nothing and readers keep the rebuild",
              naive == 0 and naive_view[url("allStrengths", G1)] == [{"value": 10}], f"rows={naive}")
        check("…though the projection lock still repoints the game's landing head to the old row", naive_head == "old-1", naive_head)

        # A plain INSERT of a duplicate hash fails loudly (the rollback script never upserts).
        try:
            with conn.cursor() as cur:
                insert(cur, [{**old, "fetched_at": "2026-11-09T11:00:00Z"}])
            conn.commit()
            check("plain insert of an existing hash raises a unique violation", False)
        except psycopg2.errors.UniqueViolation:
            conn.rollback()
            check("plain insert of an existing hash raises a unique violation", True)

        # Planner on the real state.
        with conn.cursor() as cur:
            current = all_rows(cur, False)
        planned = driver({"op": "plan", "rowsText": backup["rowsText"], "manifest": backup["manifest"], "currentRows": current,
                          "nowMs": 0})  # clock behind the data: rollbackAt must still beat every head
        plan = planned["plan"]
        check("plan restores 2, keeps 1 unchanged, reports the rebuild-only partition",
              (plan["restoreCount"], plan["unchangedCount"], [p["source_url"] for p in plan["newPartitions"]]) == (2, 1, [url("powerPlay", G2)]), str(plan))
        check("rollbackAt is strictly after the newest head", planned["rollbackAt"] == "2026-11-09T10:00:00.655Z", planned["rollbackAt"])

        # Writer-busy guard: another session holds the direct-writer lock.
        holder = psycopg2.connect(host=str(sock), port=PORT, user="postgres", dbname="postgres")
        with holder.cursor() as hcur:
            hcur.execute("select pg_advisory_xact_lock(hashtextextended('fhfh:normalization-direct-writer', 0))")
        try:
            with conn.cursor() as cur:
                insert(cur, planned["rows"])
            conn.commit()
            check("rollback insert hits NHL_NORMALIZATION_WRITER_BUSY while another writer is active", False)
        except psycopg2.Error as error:
            conn.rollback()
            check("rollback insert hits NHL_NORMALIZATION_WRITER_BUSY while another writer is active", "NHL_NORMALIZATION_WRITER_BUSY" in str(error), str(error).strip())
        holder.rollback()
        holder.close()

        # Apply: one statement (<= 25 rows) under every trigger.
        with conn.cursor() as cur:
            inserted = insert(cur, planned["rows"])
        conn.commit()
        with conn.cursor() as cur:
            after = reader_view(cur, partitions)
            readback = driver({"op": "readback", "rows": planned["rows"], "currentRows": all_rows(cur, False)})
            cur.execute("select count(*) from public.nhl_api_game_payloads_raw")
            total = cur.fetchone()[0]
            cur.execute("select h.payload_hash from public.nhl_api_game_payload_snapshot_heads h where h.game_id = %s and h.endpoint = 'landing'", (G2,))
            g2_head = cur.fetchone()[0]
        check("rollback inserted one row per restored partition", inserted == 2 and total == 9, f"inserted={inserted} total={total}")
        check("readers serve the pre-rebuild content for every backed-up partition",
              all(after[u] == before[u] for u in before), json.dumps({"before": before, "after": after}))
        check("the rebuild-only partition stays visible (documented limit)", after[url("powerPlay", G2)] == [{"value": 40}])
        check("readback finds every partition at the row the rollback wrote", readback["mismatches"] == [], str(readback))
        check("snapshot head for the game advances to the rollback row", g2_head in {r["payload_hash"] for r in planned["rows"]}, g2_head)

        # Second plan after rollback: nothing left to restore without receipts is still detectable.
        with conn.cursor() as cur:
            again = driver({"op": "plan", "rowsText": backup["rowsText"], "manifest": backup["manifest"], "currentRows": all_rows(cur, False), "nowMs": 0})
        check("a re-plan without receipts would restore again (receipts make resume idempotent)", again["plan"]["restoreCount"] == 2)
        conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
        shutil.rmtree(tmp, ignore_errors=True)
    failed = [c for c in checks if not c[1]]
    print(f"{len(checks) - len(failed)}/{len(checks)} checks passed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
