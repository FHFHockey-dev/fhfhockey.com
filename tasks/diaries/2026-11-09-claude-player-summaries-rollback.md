# 2026-11-09 — player underlying-summaries rollback (code only)

## Scope
Tested backup + rollback for the player summary rebuild (`update-player-underlying-summaries`).
Code only: no production reads or writes in this session. Reports to Chef `local_c4e6c533`.

## Where
- Branch `octoberBranch`, checkout `/Users/tim/Code/fhfhockey.com`.
- Owned files: `web/lib/underlying-stats/playerSummaryRollback*.ts`, `web/scripts/player-summaries-{backup,rollback}.ts`,
  their tests, `supabase/tests/player_summaries_rollback.py` + driver `.mjs`, this diary.
- Not touched: `playerStatsSummaryRefresh.ts`, `teamStatsSummaryRefresh.ts`, the rebuild route (data-checks lane).

## Findings (design inputs)
- Write target: `nhl_api_game_payloads_raw`, endpoint `landing`, source_url `derived://underlying-player-summary-v2/<mode>/<strength>/[<scoreState>/]<gameId>`,
  `fetched_at = payload.generatedAt`, unique `(game_id, endpoint, payload_hash)`, upsert `ignoreDuplicates`.
- Readers: newest per (game, source_url) by `fetched_at desc` (Supabase path tiebreak `id asc`; PG path no tiebreak).
- Triggers: no-update, no-delete (immutable); BEFORE-statement `NHL_NORMALIZATION_WRITER_BUSY` guard; BEFORE-row
  projection lock that, on an exact (game, endpoint, hash) replay, moves the snapshot head to the OLD row and then
  ON CONFLICT DO NOTHING inserts nothing. So re-inserting the old payload unchanged is a no-op for readers.
- Rebuild only adds partitions; a partition new in the rebuild cannot be hidden by rollback (reported, not restored).

## Design
Backup = newest row per v2 partition for the scope (metadata read, then payloads by id in 25-id chunks), JSONL + manifest
with sha256. Rollback = re-insert each backed-up payload with `generatedAt`/`fetched_at` = rollbackAt (strictly newer
than every current head) and a fresh `payload_hash`; plan digest from dry-run must be passed to `--apply`; per-batch
CAS re-read of heads, 25-row inserts, readback that each partition's head is the inserted row.

## State / checks
- Implemented: plan module (pure, Node-loadable), store (Supabase I/O), backup + rollback scripts, tests, PG proof.
- Vitest: playerSummaryRollbackPlan (9), player-summaries-rollback scripts (6), playerStatsSummaryRefresh (11) — 26 pass.
- `npm run typecheck` exit 0; eslint on changed files exit 0. PG 15 proof 17/17.
- ts-node `--verify` on a local fixture backup works (no DB).
- Runbook: side-session-notes/<chef>/player-summaries-rollback-runbook.md.

## Checkpoint (2026-11-09, late; TJ's wifi ending)
- Code committed in fb964e2c2 on octoberBranch; Chef reports it shipped in #426. Nothing has been run against production.
- Production DB was unreachable from ~20:34 UTC; Chef ordered no production queries until it says the DB is back.
- Chef stated the untracked scripts broke typecheck, but that was stale: they were already committed, and a fresh `npm run typecheck` exited 0.

## Next (for TJ's next session)
- Follow the runbook at side-session-notes/local_c4e6c533-.../player-summaries-rollback-runbook.md (9 steps).
- Before step 1, confirm the DB is reachable and healthy again. Every production write needs TJ's own pop-up (the amnesty has ended).
- Order: backup and verify → baseline dry run (expect restore 0) → rebuild → check → only if needed, rollback dry run, then apply with `--expect-plan-sha256`.
- Status: paused, not finished. Keep this diary until the rebuild/rollback outcome is recorded.

## Gotchas
- Sweep-gamecenter-normalization treats `individual/allStrengths` marker fetched_at >= normalization completed_at as
  fresh, so rollback rows are sticky against the sweep.
- Repo @types/node lacks util.parseArgs; scripts use a small parseFlags.
- jsonb reorders keys, so sha256(JSON.stringify(readback payload)) != stored payload_hash; backup hashes its own file bytes.
