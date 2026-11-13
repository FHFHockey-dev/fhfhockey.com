# Migration 149 approval packet (decision 152; Chef, 2026-11-13 ~20:09Z)

**State:** not applied; awaiting TJ's approval. PP share stays **off**.

This packet covers the migration only. The writer release, the refresh dry run, the refresh itself and serving PP share are each separate approvals, in that order. The migration comes first because the new writer calls `replace_power_play_game_v1`. The current production writer ignores the new columns and table, so applying first is safe.

## The file
| | |
|---|---|
| Path | `supabase/migrations/20261113220000_pp_team_game_clock.sql` (F11 `2bd7e37e1`) |
| sha256 | `ed7015782f62c16e48e6ccfaec2e81f496159db11595d6e517b63322f20976d3` |
| Shape | 262 lines. Header comments on lines 1–40, `begin;` on line 41 and `commit;` on line 262 (one transaction), with `lock_timeout 5s` and `statement_timeout 30s`. |
| Authority | order 149, `pending` (`migration-authority.json`). The baseline test currently expects 149 rows: 114 applied, 7 pending. |
| Proof | `supabase/tests/f11_pp_team_game_clock.py` on a throwaway PostgreSQL 15: RESULT OK, 28 checks, including an exact rollback |
| Rollback | `supabase/tests/f11_pp_team_game_clock_rollback.sql`: drops the function, the table and the two columns plus their CHECK. Player rows are untouched. Safe while the new writer is unreleased. |

## What it changes
1. `public."powerPlayCombinations"`:
   - adds the nullable `calculation_version text` and `computed_at timestamptz` columns, plus a CHECK that both are null or both are set;
   - **no existing value changes**; old rows stay null in both.
2. A new table, `public.pp_team_game_clock (game_id, team_id)`:
   - availability is one of `available`, `not_applicable` or `unavailable` (with a reason), plus clock, reference source, official and Penalty Summary seconds, audit counts, skater-seconds and the version stamp;
   - 7 constraints, including the FK to `games(id)`;
   - RLS on, with a `public_read` policy;
   - SELECT for anon and authenticated; full DML for service_role only.
3. A new function, `public.replace_power_play_game_v1(bigint, text, timestamptz, jsonb, jsonb)`:
   - SECURITY INVOKER with `search_path=''`;
   - EXECUTE for service_role only;
   - replaces one game's player rows and its two clock rows as one set, and refuses impossible payloads without capping them.

**Locks:**
- Adding the columns and CHECK takes **ACCESS EXCLUSIVE on `powerPlayCombinations`** while it scans to validate the CHECK. All existing rows are null, so the check passes; the hold lasts as long as one scan of the table.
- Creating the FK takes a brief **SHARE ROW EXCLUSIVE on `games`**.
- Both are bounded by the 5 s lock timeout and 30 s statement timeout. If either fires, the whole transaction rolls back.

## Safe window
- **Before tonight's games start** (by ~23:00Z), and away from the jobs that touch these tables:
  - update-stats-job runs `*/20` (:00, :20, :40);
  - update-line-combinations-job runs `*/25` (:00, :25, :50);
  - `powerPlayCombinations`' own writer, job 388, runs at 08:05Z, far away.
- **Apply only at minutes 06–18, 30–37 or 44–48 past the hour.**

## Preflight (one session, immediately before; any failure stops without applying)
1. **Window check:** as above.
2. **Load:** at most 5 other active queries, none longer than 10 s, 0 lock waits anywhere.
3. **Locks:** 0 locks held by other sessions on `powerPlayCombinations` or `games`.
4. **pg_cron:** no running run of jobs 1, 2 or 388.
5. **Not already applied, all must hold:**
   - no ledger row for `20261113220000`;
   - `powerPlayCombinations` has neither new column;
   - `to_regclass('public.pp_team_game_clock')` is null;
   - `replace_power_play_game_v1` has no overload.

   Anything present means partial or prior state: stop and reconcile.
6. **Baseline to record:** `powerPlayCombinations` `count(*)` and `max(created_at)` (N, D), plus `reltuples` and total size. `games` row estimate.
7. **File:** sha256 equals the value above, and the shape checks (lines 41 and 262) pass.

## Apply (atomic)
- One psql session through the session pooler with `ON_ERROR_STOP`.
- It runs file lines 1–261, inserts the ledger row `('20261113220000','pp_team_game_clock')`, then `commit;`. Schema change and ledger row commit together or not at all (the same method as migration 147).
- Wall-clock alarm: 120 s.

## Expected readback (catalog plus two counts, no payload reads)
| Check | Expect |
|---|---|
| Ledger | 1 row, `20261113220000` |
| New columns | `calculation_version text YES`, `computed_at timestamp with time zone YES` |
| `powerPlayCombinations` CHECK | `powerPlayCombinations_calculation_provenance_check` present |
| `pp_team_game_clock` constraints | `_availability_check`, `_counts_check`, `_game_id_fkey`, `_official_class_check`, `_pkey`, `_reference_source_check`, `_state_check` (7) |
| RLS | `relrowsecurity = t`; policy `public_read` (SELECT, anon and authenticated) |
| Table grants | anon SELECT; authenticated SELECT; service_role DELETE, INSERT, SELECT, UPDATE |
| Function | 1 overload; `prosecdef = f`; `proconfig = {search_path=""}`; EXECUTE anon f, authenticated f, service_role t |
| Existing data | `powerPlayCombinations` `count(*)` = N and `max(created_at)` = D (unchanged); `pp_team_game_clock` count = 0 |

## Stop conditions
- **Before apply:** outside the window, busy, any lock wait, a lock on either table, a job running, partial or prior state, sha or shape mismatch. Nothing is written.
- **During apply:** the lock or statement timeout fires, or any SQL error. The transaction rolls back (no schema change, no ledger row). Stop, run the readback to confirm nothing changed, and report. No retry without a fresh preflight and TJ's OK.
- **Uncertain outcome** (connection drop or alarm): reconcile from the live catalog and ledger before anything else. Never mark it applied from the script's exit alone.
- **Readback mismatch:** stop. Don't mark the authority applied or release the writer. Report the difference. Run the rollback only with TJ's OK.

## After success (same session record, no other action)
- Authority row 149 → `applied` with the receipt. Baseline test counts → 115 applied / 6 pending. Super-goal sentence: 115 applied.
- Then wait for **separate approval** of the writer and registry release (candidate prepared offline; see `RELEASE-NEXT-HANDOFF.md` §8).
