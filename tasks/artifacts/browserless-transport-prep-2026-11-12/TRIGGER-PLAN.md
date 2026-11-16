# Line-combo trigger quarantine — approval plan only

Status: not executed; no database reads or writes in this lane. Scout/TJ requested local preparation only. No migration is proposed or applied. Current trigger modes, installed function bodies and queued/in-flight work remain unknown.

The local authority is `supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:124`. It declares these three distinct AFTER INSERT ROW triggers on `public."lineCombinations"`:

| Trigger | Function | Proposed action |
| --- | --- | --- |
| `after_line_combo_insert` | `public.on_new_line_combo()` | Disable only this trigger after approval |
| `after_player_underlying_stats_insert` | `public.on_new_player_underlying_stats()` | Preserve exact definition and mode |
| `update_power_play_combinations_after_line_combo_insert` | `public.update_power_play_combinations()` | Preserve exact definition and mode |

The migration is source evidence, not proof of live state. Disabling the first trigger suppresses future screenshot/storage/Discord webhook dispatch from this insert trigger. It does not disable stats/power-play processing, cancel already queued HTTP work, stop requests already executing, block alternate callers, or secure/decommission the old Browserless host.

## Ownership and current-state gate

DRM owner `01a1d067-c22d-7c11-af65-28435ec7426e` confirmed the database window was returned to Claude; no DRM writer is running, but Claude's current activity is unverified. The owner supplied no live catalog evidence or clearance. See `manifest-ack-01a1d067-c22d-7c11-af65-28435ec7426e.md`. Scout must coordinate with Claude for a quiet bounded window before either the preflight or DDL. Never overlap the production re-normalization/repair window or treat the absence of a local process as database clearance.

1. Confirm the intended production project identity with Scout/Claude; no project is guessed in these files. Obtain an explicit catalog-read handoff. Request exactly one execution of `trigger-preflight.sql` (5-second statement limit, one table's catalogs, zero application rows or HTTP calls). Retain safe modes/OIDs/function names/definition fingerprints and server version only. Do not return trigger arguments or function body text; they can contain credentials.
2. Require exactly one target with public function `on_new_line_combo`, type 5 (AFTER INSERT ROW), zero trigger arguments, and the two adjacent trigger/function pairs above. Require a regular table with no parents or children. If the table/function/trigger topology differs, stop and amend the reviewed plan. Preserve every returned trigger, including any additional/internal triggers, not just the named three.
3. Record the target's original mode exactly: O, D, R or A. If already D, no disablement is needed; verify/record the state and do not claim this lane disabled it. Resolve project/server version, original mode, fingerprint and quiet window before asking for write approval.

## Bounded execution proposal — separate approval required

First release the two-file local handler guard through Scout's separately approved release process, with exact SHA/project/branch/build inventory and no Browserless replacement files. This catches later webhook arrivals, including previously queued requests after the new handler is serving. No active-webhook smoke is proposed. Existing in-flight invocations are not proven stopped.

Then request approval for one transaction running `trigger-set-mode-plan.sql` against the verified project, changing only `after_line_combo_insert` to D. Fill its fingerprint from the approved preflight and mode with D. The unfilled script deliberately fails closed. Its table lock is bounded to 2 seconds; statement timeout 10 seconds; idle transaction timeout 30 seconds. The operator must execute the entire script with stop-on-error and one transaction/connection; on any failure issue ROLLBACK and stop. Do not automatically retry a busy database.

The script locks only this table, rejects inheritance/partition topology, verifies the approved snapshot, checks all three identities, alters only the literal target trigger, and compares every trigger/function field afterward. Only the target mode may change. It emits fixed fields containing the original/new modes and before/after fingerprints. Capture these plus transaction success before describing disablement as complete. No table rows, functions, schedules, credentials, role settings, adjacent triggers or migration records change. The brief table lock can delay inserts, which is why explicit writer coordination is required.

After commit, run the same single catalog preflight once (separate 5-second budget): require target D, all other snapshot fields unchanged and exact emitted post-fingerprint. If uncertain/failing, stop; do not replay inserts or invoke endpoints. This is a maximum of two catalog reads and one targeted write transaction for an approved disablement, excluding a separately approved rollback. No provider calls, fixture inserts, heavy reads, queue drains or database row mutations are included.

## Rollback

Keep the original and post-disable snapshots/fingerprints with the approved receipt. Rollback needs Scout approval and a fresh quiet-window handoff: restoring the trigger resumes dispatch toward the old integration and may contradict quarantine. The handler can remain parked during a trigger rollback; restoring trigger dispatch alone does not resume screenshots/Discord while the guard remains deployed.

Use the same script with the saved **post-disable fingerprint** and exact original mode: O = ENABLE TRIGGER, R = ENABLE REPLICA TRIGGER, A = ENABLE ALWAYS TRIGGER, D = DISABLE TRIGGER (already disabled, normally no action). The script uses only these allowlisted SQL fragments and the same literal target. If any intervening trigger/function state differs, the fingerprint assertion aborts; do not substitute a new fingerprint merely to bypass drift. Re-review before proceeding. Verify the entire original snapshot after rollback using one catalog read; require adjacent stats/power-play modes and identities unchanged. Do not restore modes using ENABLE TRIGGER ALL/USER, session_replication_role, function edits, drops/recreates or schema replay.

Rollback of the application guard is a separate reviewed release action. It must not automatically restore the parked transport archive or re-enable the old path; both require explicit resumption approval. Historical requests skipped during quarantine are not replayed automatically.

## Verification and references

Local handler fixture/static results: `GUARD-CHECKS.json`. SQL scripts are reviewable preparation only and have not been parsed/executed by PostgreSQL. Live current-state evidence and SQL execution remain gates, not claimed passes. Separate review: `QUARANTINE-REVIEW.md`; final Chef pass corrected the DO block terminator and requested the bounded re-review.

PostgreSQL documents trigger modes and the targeted enable/disable operations in [pg_trigger](https://www.postgresql.org/docs/current/catalog-pg-trigger.html) and [ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html). The Supabase [changelog](https://supabase.com/changelog.md) was checked; no SDK/CLI changes are required for this catalog/DDL plan. Match documentation to the preflight server version before approval.
