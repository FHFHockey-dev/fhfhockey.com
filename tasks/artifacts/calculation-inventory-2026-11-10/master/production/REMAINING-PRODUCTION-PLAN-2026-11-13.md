# Remaining production steps: verified plan, 2026-11-13

Sources:
- a read-only code inventory, with file:line references;
- bounded reads at ~05:45Z (read hygiene checked: 1 active query, none long-running).

Every write needs TJ's pop-up. Given two database hangs under sustained writes (11-12 15:43Z, 11-13 01:55Z):
- one writer at a time, with gaps between steps;
- no write overlaps the 08:00–08:20, 09:25–11:00 or 11:15–11:40 UTC cron windows;
- every runner checks DB load before each call and stops on a 504 or a slow call.

## Already handled, verify only
- **WiGO rebuild (queue 9).** The fixed writer is in master. `wigo_career` was last written 11-12 08:51, before #430, so pg_cron 231 at 08:50Z today is the rebuild. Verify: 7,845 rows, all `last_updated` after 08:50Z today, and that the run did not stop at its 200 s budget (207). If it did stop, rerun the route once (idempotent).
- **Pipeline check at 11:01Z:** the stage-2 fix, rolling for 11-12, and FORGE runs for today.

## Runnable now, in proposed order
1. **Index 124** (`20261109213000_line_source_observed_at_indexes.sql`): two small `(observed_at desc)` indexes (12 MB and 5 MB tables), applied as the file says (lock timeout 5 s, statement 60 s). Readback: `pg_indexes`, authority row and ledger row.
2. **Power ratings v3** (`update-team-power-ratings`, no dry run).
   - 2026-09-29 → 11-12, one day per call, ascending, 32 upserts per day, about 45 calls.
   - Today: 674 rows `legacy_unversioned` (09-29..10-22) and 766 rows v2 (10-19..11-12).
   - Readback: `calculation_version` counts.
   - Then confirm cron 283 (10:15Z) keeps writing v3.
3. **Rankings and composites (dry run first).**
   - `update-entity-metric-rankings`, then `update-skater-composite-ratings`, season 20262027. Default parameters, because custom min_gp or min_toi blocks publication.
   - The dry run reports `publication.ready`.
   - A publish (non-dry) is a separate approval: one atomic upsert of at most 1,000 rows.
   - The stored snapshot is v1 (11-07, 732 rows).
   - BEAST re-check on the new snapshot: 5v5 default view and the all-strength view.
4. **team_unit_toi rebuild (dry run first).**
   - Latest snapshot is 11-08 (38,549 rows, 292 games).
   - Write a new snapshot in `gameIds` batches of about 25, done off-peak so the matrix's "newest snapshot" isn't read half-built.
   - Readback: rows and games per snapshot.
   - The L8 Lines 5v5 switch is a code constant and needs a release.
5. **Trend-band history (dry run first; heaviest).**
   - `rebuild-trend-bands`: `history`, season 20262027, `start_date=2026-09-29` (the handover's 10-07 would leave 09-29..10-06 stale), `end_date=2026-11-12`, `game_limit=160`, and `dry=true` (the flag is named `dry`).
   - A dry call with `limit=10` measures rows and seconds per player. Up to about 1,100 jsonb rows per player, so live calls run small (about 10–25 players), with gaps.
   - 764 players by offset.
   - Writes upsert, then delete per player within the window.
6. **xG champion demotion (queue 3).**
   - Export the registry rows and per-model aggregate counts as a backup.
   - One transaction:
     `update nhl_xg_model_registry set is_active=false, is_champion=false, approval_status='retired', updated_at=now() where model_version='logistic_l2-s20252026-p1-st1-f1-cfg9bac2706' and prediction_type='shot_goal'`.
   - Then up to 5 served-reader checks; roll back by restoring the backed-up row.
   - The consumer pins are in master.
7. **Index 123** (`wgo_skater_stats` 2.2 GB): `set statement_timeout='15min'; create index concurrently if not exists idx_wgo_skater_stats_team_date on public.wgo_skater_stats (team_abbrev, date);`
   - Alone, outside a transaction, off-peak. A heavy I/O build: run it last and by itself.
   - Readback: `indisvalid` and `indisready`.
8. **Reserve projections (queue 11).**
   - Migration `20261027090000_forge_reserve_projections.sql` (authority 101): creates `forge_reserve_projections`, absent today.
   - Then the env flag `FORGE_RESERVE_PASS_ENABLED=true`. That needs a deployment; an env-only redeploy is canceled by the Ignored Build Step, so ship it with a release.

## Needs code before it can run
- CTPI v2: no production writer (`update-team-ctpi-daily` is still v1) and no publication migration.
- SOS v2: `computeDescriptiveSos` has no caller; `update-team-sos` is unchanged.
- Lines 5v5 (`LINES_FIVE_ON_FIVE_ENABLED`, code constant).
- Debrief §13 tickets.
