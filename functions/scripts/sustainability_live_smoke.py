#!/usr/bin/env python
"""Live Sustainability Smoke Test

Purpose: Give you a fast, verifiable end‑to‑end run on REAL data + REAL tables
without any test fixtures so you can see actual sustainability scores being
computed & persisted.

What it does:
  1. Connects to Postgres via SUPABASE_DB_URL.
  2. Pulls a slice of recent player_game_stats rows for a target season
     (default: latest season it can infer by max(season_id)).
  3. Runs orchestrator with persistence + snapshot build (unless you toggle).
  4. Prints a concise summary: counts, snapshot thresholds, top scores.
  5. Optionally re-runs with snapshot reuse to prove determinism.

Usage examples:
  SUPABASE_DB_URL=postgres://... python -m scripts.sustainability_live_smoke --season-id 2025 --limit 500 --persist --build-snapshot --persist-snapshot

Flags:
  --season-id <int>      Season to target (if omitted attempts DB inference)
  --limit <int>          Max game rows to pull (default 300)
  --persist              Upsert barometers + snapshot (if flags specify)
  --build-snapshot       Build new snapshot (default True)
  --no-build-snapshot    Skip building snapshot
  --persist-snapshot     Save snapshot thresholds (if built) to distribution table
  --reuse-snapshot       Allow reuse path if build disabled (default True)
  --no-reuse-snapshot    Disable reuse
  --assign-tiers/--no-assign-tiers  Control quintile assignment (default on)
  --second-run           Perform an immediate second run (reuse scenario) to show stability
  --verbose              Print extra debug keys

Environment:
  SUPABASE_DB_URL must point to writable Postgres.
"""
from __future__ import annotations

import argparse
import json
import sys
from typing import List, Dict, Any, Optional, Tuple

from lib.sustainability.orchestrator import orchestrate_full_run
from lib.sustainability.config_loader import load_config
from lib.sustainability import db_adapter
import os


def infer_latest_season() -> Optional[int]:
    sql = "SELECT MAX(season_id) FROM player_game_stats"  # adjust if needed
    with db_adapter.get_conn() as conn:
        if conn is None:
            return None
        try:
            cur = conn.execute(sql)
            row = cur.fetchone()
            return row[0] if row and row[0] else None
        except Exception:
            return None


def fetch_recent_games(season_id: int, limit: int, table: str, fallback: bool = True) -> List[Dict[str, Any]]:
    """Fetch & normalize recent game rows from stats table (auto column mapping).

    Handles arbitrary table names (e.g. player_stats_unified) by introspecting column names
    and mapping them onto the pipeline's required logical fields. If required metrics are
    missing they are defaulted conservatively (zeros) and a notice is printed.
    """
    required_keys = [
        "player_id", "season_id", "position_code", "game_id", "game_date",
        "shots", "goals", "onice_goals_for", "onice_shots_for", "points", "ixg", "icf", "hdcf"
    ]
    with db_adapter.get_conn() as conn:
        if conn is None:
            return []
        try:
            # Introspect columns
            col_sql = """
                SELECT column_name FROM information_schema.columns
                WHERE table_schema='public' AND table_name=%(t)s
            """
            curc = conn.execute(col_sql, {"t": table})
            cols_existing = {r[0].lower() for r in curc.fetchall()}
            if not cols_existing:
                return []

            def pick(*cands):
                for c in cands:
                    if c and c.lower() in cols_existing:
                        return c
                return None

            mapping = {
                "player_id": pick("player_id", "playerid"),
                "season_id": pick("season_id", "season"),  # many tables use 'season'
                "position_code": pick("position_code", "position", "pos", "position_code"),
                "game_id": pick("game_id", "gameid", "gid", "id"),
                # Add common gamelog date columns: date_scraped, game_date, date
                "game_date": pick("game_date", "date", "game_date_time", "gamedate", "date_scraped"),
                "shots": pick("shots", "shots_on_goal", "sog"),
                "goals": pick("goals", "g"),
                # On-ice for events (broad heuristics)
                "onice_goals_for": pick("onice_goals_for", "on_ice_goals_for", "onice_gf", "on_ice_gf", "gf_onice", "gf_for_onice", "gf_team_onice", "gf"),
                "onice_shots_for": pick("onice_shots_for", "on_ice_shots_for", "onice_sf", "on_ice_sf", "sf_onice", "sf_for_onice", "sf_team_onice", "sf"),
                "points": pick("points", "pts", "total_points"),
                "ixg": pick("ixg", "ixg_total", "ixg_game", "ixg_for", "ixg_sum"),
                "icf": pick("icf", "corsi_for_individual", "individual_corsi_for", "cf_i", "icf_total"),
                "hdcf": pick("hdcf", "hdcf_individual", "individual_hdcf", "hdcf_i"),
            }
            missing_core = [k for k, v in mapping.items() if v is None and k in ("player_id", "season_id", "game_date")]
            if missing_core:
                print(f"[warn] Cannot map required identity columns: {missing_core}")
                return []

            # Build SELECT list with aliases
            select_parts = []
            for logical, physical in mapping.items():
                if physical is None:
                    # We'll fill later
                    continue
                if logical == "game_date":
                    select_parts.append(f"{physical}::text AS game_date")
                else:
                    select_parts.append(f"{physical} AS {logical}")

            # Minimal mandatory columns for filtering
            season_col = mapping["season_id"]
            date_col = mapping["game_date"].split(" AS ")[0] if " AS " in mapping.get("game_date", "") else mapping.get("game_date") or "game_date"

            sql = f"""
                SELECT {', '.join(select_parts)}
                FROM {table}
                WHERE {season_col} = %(season_id)s
                ORDER BY {date_col} DESC
                LIMIT %(limit)s
            """
            cur = conn.execute(sql, {"season_id": season_id, "limit": limit})
            fetched_cols = [d[0] for d in cur.description]
            raw_rows = [dict(zip(fetched_cols, r)) for r in cur.fetchall()]
            raw_rows = list(reversed(raw_rows))  # chronological

            if not raw_rows and fallback:
                # Use previous generic fallback scanning
                return []  # let caller handle empty diagnostics

            # Post-process fill defaults & derive metrics
            out: List[Dict[str, Any]] = []
            for r in raw_rows:
                o = {k: r.get(k) for k in fetched_cols}
                # Fill missing metrics with safe defaults / derivations
                if mapping.get("points") is None:
                    # derive points if goals + assists columns exist (try assists naming)
                    assists_col = pick("assists", "total_assists", "a")
                    if assists_col and assists_col in cols_existing and mapping.get("goals") in r:
                        try:
                            assists_val = r.get(assists_col)  # might not be selected
                            if assists_val is not None:
                                o["points"] = (r.get("goals") or 0) + assists_val
                        except Exception:
                            pass
                for metric, default in (("shots", 0), ("goals", 0), ("onice_goals_for", 0), ("onice_shots_for", 0), ("points", 0), ("ixg", 0.0), ("icf", 0), ("hdcf", 0)):
                    if metric not in o or o[metric] is None:
                        o[metric] = default
                out.append(o)

            print("[info] Column mapping used:")
            for k in required_keys:
                print(f"  {k}: {mapping.get(k)}{' (defaulted)' if mapping.get(k) is None else ''}")
            return out
        except Exception as e:
            print(f"[error] fetch_recent_games failed: {e}")
            return []


def diagnose_empty(table: str, season_id: int) -> None:
    """Provide rich diagnostics when no rows are fetched.

    Attempts to surface common mismatch issues:
      - Season column uses different name or TEXT format (e.g. '2024-25')
      - Season values present differ from requested integer
      - Table has data but date/season filters misapplied
    """
    print("\n[diagnose] Starting diagnostics for empty result...")
    try:
        with db_adapter.get_conn() as conn:
            if conn is None:
                print("[diagnose] No DB connection available.")
                return
            # List columns
            col_sql = """
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_schema='public' AND table_name=%(t)s
                ORDER BY ordinal_position
            """
            cur = conn.execute(col_sql, {"t": table})
            cols = cur.fetchall()
            if not cols:
                print(f"[diagnose] Table '{table}' not found in public schema.")
                return
            print(f"[diagnose] Columns ({len(cols)}): " + ", ".join(f"{c[0]}:{c[1]}" for c in cols))

            # Guess season column
            season_col = None
            for cand in ("season_id", "season", "seasonid"):
                if any(c[0].lower() == cand for c in cols):
                    season_col = cand
                    break
            if not season_col:
                print("[diagnose] No obvious season column (season_id/season/seasonid) found.")
            else:
                # Distinct sample of season values
                cur = conn.execute(f"SELECT {season_col}, COUNT(*) FROM {table} GROUP BY 1 ORDER BY 2 DESC LIMIT 12")
                season_vals = cur.fetchall()
                print(f"[diagnose] Top distinct {season_col} values (value,count): {season_vals}")
                # Try to coerce to ints & find nearest suggestions
                numeric_like = []
                for v, _cnt in season_vals:
                    try:
                        numeric_like.append(int(str(v).replace('-', '')[:4]))
                    except Exception:
                        pass
                if numeric_like:
                    suggestions = sorted(set(numeric_like))
                    print(f"[diagnose] Possible numeric season suggestions: {suggestions}")
                # Direct count for requested season using alternative comparisons
                if season_vals:
                    try:
                        cur = conn.execute(f"SELECT COUNT(*) FROM {table} WHERE {season_col} = %(s)s", {"s": season_id})
                        exact = cur.fetchone()[0]
                        print(f"[diagnose] Exact equality rows for {season_col}={season_id}: {exact}")
                    except Exception as e:
                        print(f"[diagnose] Equality count error: {e}")
                    # LIKE pattern attempt if season appears embedded
                    try:
                        cur = conn.execute(f"SELECT COUNT(*) FROM {table} WHERE CAST({season_col} AS TEXT) LIKE %(pat)s", {"pat": f"%{season_id}%"})
                        like_ct = cur.fetchone()[0]
                        print(f"[diagnose] LIKE '%{season_id}%' rows: {like_ct}")
                    except Exception as e:
                        print(f"[diagnose] LIKE pattern error: {e}")

            # Sample a couple raw rows (unfiltered) for inspection
            try:
                cur = conn.execute(f"SELECT * FROM {table} ORDER BY 1 DESC LIMIT 2")
                sample_cols = [d[0] for d in cur.description]
                sample_rows = [dict(zip(sample_cols, r)) for r in cur.fetchall()]
                print(f"[diagnose] Sample rows (latest 2): {json.dumps(sample_rows, default=str)[:1000]}")
            except Exception as e:
                print(f"[diagnose] Sample rows error: {e}")

            # Row count total
            try:
                cur = conn.execute(f"SELECT COUNT(*) FROM {table}")
                total = cur.fetchone()[0]
                print(f"[diagnose] Total rows in {table}: {total}")
            except Exception as e:
                print(f"[diagnose] Total count error: {e}")
    except Exception as outer:
        print(f"[diagnose] Unexpected diagnostic error: {outer}")


def parse_args(argv: List[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Live sustainability smoke run")
    p.add_argument("--season-id", type=int)
    p.add_argument("--limit", type=int, default=300)
    p.add_argument("--table", default="player_game_stats", help="Source table for per-game stats (e.g. player_stats_unified)")
    p.add_argument("--persist", action="store_true")
    p.add_argument("--build-snapshot", dest="build_snapshot", action="store_true", default=True)
    p.add_argument("--no-build-snapshot", dest="build_snapshot", action="store_false")
    p.add_argument("--persist-snapshot", action="store_true")
    p.add_argument("--reuse-snapshot", dest="reuse_snapshot", action="store_true", default=True)
    p.add_argument("--no-reuse-snapshot", dest="reuse_snapshot", action="store_false")
    p.add_argument("--assign-tiers", dest="assign_tiers", action="store_true", default=True)
    p.add_argument("--no-assign-tiers", dest="assign_tiers", action="store_false")
    p.add_argument("--second-run", action="store_true")
    p.add_argument("--verbose", action="store_true")
    p.add_argument("--diagnose", action="store_true", help="Force diagnostics output even if rows are found")
    p.add_argument("--composite-query", action="store_true", help="Use the full joined stats query (wgo + NST tables) instead of a raw table scan")
    return p.parse_args(argv)


def summarize_scores(windows_scored_count: int, snapshot_thresholds: Dict[str, float] | None, phases: Dict[str, Any]):
    snap_line = "no snapshot" if not snapshot_thresholds else \
        ", ".join(f"{k}={v:.3f}" for k, v in snapshot_thresholds.items())
    anomalies = phases.get("anomalies", {})
    return f"rows={windows_scored_count} snapshot=({snap_line}) anomalies(extreme={anomalies.get('extreme_raw_z')} clip_sat={anomalies.get('clip_saturation')})"


def main(argv: List[str]) -> int:
    args = parse_args(argv)
    # Early DSN visibility: help user if not exported
    if not os.getenv("SUPABASE_DB_URL"):
        print("[error] SUPABASE_DB_URL not in environment. Export it or prefix on same line:", file=sys.stderr)
        print("  export SUPABASE_DB_URL=postgresql://...", file=sys.stderr)
        print("  SUPABASE_DB_URL=postgresql://... python -m scripts.sustainability_live_smoke --season-id 2025", file=sys.stderr)
    season_id = args.season_id or infer_latest_season()
    if not season_id:
        print("Could not infer season id; supply --season-id", file=sys.stderr)
        return 2
    preferred_table = args.table

    def fetch_via_composite() -> List[Dict[str, Any]]:
        from lib.sustainability import db_adapter as _dba
        sql = f"""
            /* Composite sustainability game source */
            SELECT w.player_id,
                   w.date AS game_date,
                   w.season_id,
                   w.position_code,
                   COALESCE(w.shots, 0) AS shots,
                   COALESCE(w.goals, 0) AS goals,
                   COALESCE(nco.gf, w.es_goals_for, 0) AS onice_goals_for,
                   COALESCE(nco.sf, 0) AS onice_shots_for,
                   COALESCE(w.points, w.goals + w.assists, 0) AS points,
                   COALESCE(nc.ixg, 0.0) AS ixg,
                   COALESCE(nc.icf, 0) AS icf,
                   COALESCE(nc.hdcf, 0) AS hdcf
            FROM wgo_skater_stats w
              LEFT JOIN nst_gamelog_as_counts nc ON w.player_id = nc.player_id AND w.date = nc.date_scraped AND w.season_id = nc.season
              LEFT JOIN nst_gamelog_as_counts_oi nco ON w.player_id = nco.player_id AND w.date = nco.date_scraped AND w.season_id = nco.season
            WHERE w.games_played = 1
              AND w.season_id = %(season_id)s
              AND w.date IS NOT NULL
            ORDER BY w.date DESC, w.player_id
            LIMIT %(limit)s
        """
        with _dba.get_conn() as conn:
            if conn is None:
                return []
            try:
                cur = conn.execute(sql, {"season_id": season_id, "limit": args.limit})
                cols = [d[0] for d in cur.description]
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
                rows.reverse()  # chronological
                print(f"[info] Composite query returned {len(rows)} rows")
                return rows
            except Exception as e:
                print(f"[error] composite query failed: {e}")
                return []

    if args.composite_query:
        games = fetch_via_composite()
    else:
        games = fetch_recent_games(season_id, args.limit, preferred_table)
        if not games:
            # Probe existence of well-known gamelog tables and retry first that yields rows
            for candidate in ["player_game_stats", "nst_gamelog_es_counts", "nst_gamelog_as_counts", "skatersGameStats"]:
                if candidate == preferred_table:
                    continue
                cand_rows = fetch_recent_games(season_id, args.limit, candidate, fallback=False)
                if cand_rows:
                    print(f"[info] Fallback source '{candidate}' produced {len(cand_rows)} rows (original '{preferred_table}' empty).")
                    games = cand_rows
                    preferred_table = candidate
                    break
    if not games:
        print(f"No games fetched (empty result) using table '{args.table}'.", file=sys.stderr)
        print("Troubleshooting steps:")
        print("  1. Verify SUPABASE_DB_URL is exported (echo $SUPABASE_DB_URL).")
        print("  2. Confirm table exists or supply --table <name>.")
        print("  3. Inspect public tables: SELECT table_name FROM information_schema.tables WHERE table_schema='public';")
        print("  4. Ensure season id has data.")
        diagnose_empty(args.table, season_id)
        return 3
    elif args.diagnose:
        diagnose_empty(args.table, season_id)
    cfg = load_config()
    print(f"Loaded config model_version={cfg.model_version} hash={cfg.config_hash} weights={len(cfg.weights)} metrics")
    print(f"Fetched {len(games)} raw game rows (season {season_id})")

    print("-- First Run --")
    r1 = orchestrate_full_run(
        season_id=season_id,
        games=games,
        persist=args.persist,
        build_snapshot=args.build_snapshot,
        assign_tiers=args.assign_tiers,
        persist_snapshot=args.persist_snapshot,
        reuse_snapshot=args.reuse_snapshot,
        log_run=args.persist,  # log when persisting
    )
    d1 = r1.to_dict()
    print("Summary:", summarize_scores(r1.total_rows_scored, r1.snapshot_thresholds, d1["phases"]))
    if args.verbose:
        print(json.dumps(d1, indent=2))

    if args.second_run:
        print("\n-- Second Run (reuse path) --")
        r2 = orchestrate_full_run(
            season_id=season_id,
            games=games,
            persist=args.persist,
            build_snapshot=False if args.build_snapshot else args.build_snapshot,
            assign_tiers=args.assign_tiers,
            persist_snapshot=False,
            reuse_snapshot=args.reuse_snapshot,
        )
        d2 = r2.to_dict()
        print("Summary:", summarize_scores(r2.total_rows_scored, r2.snapshot_thresholds, d2["phases"]))
        if args.verbose:
            print(json.dumps(d2, indent=2))
        if r1.snapshot_thresholds and r2.snapshot_thresholds:
            stable = r1.snapshot_thresholds == r2.snapshot_thresholds
            print(f"Snapshot thresholds stable across runs: {stable}")

    if not args.persist:
        print("(Dry run: set --persist to write barometers & optionally snapshot.)")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main(sys.argv[1:]))
