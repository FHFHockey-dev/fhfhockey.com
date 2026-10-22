# D4 Data API grants — Claude diary (2026-10-20)

## Scope
Ticket D4 from Chef local_60e96358: review Codex's proposal
(`tasks/artifacts/codex-2026-10-20/sql-proposals/data-api-grants.sql`), write numbered
migration(s) + ledger rows, prove in a disposable local Postgres. No hosted calls, no
commits, Codex files read-only.

## Where
- Branch octoberBranch, HEAD e24b43712 at start. Shared checkout; other sessions active.
- Outputs (planned): `supabase/migrations/2026102023xxxx_*.sql`, ledger row(s) in
  `tasks/TASKS/repository-audit-remediation/migration-authority.json`, count bump in
  `web/lib/supabase/supportedBaselineMigration.test.ts`, my assertions in
  `supabase/tests/data_api_grants_claude.sql`, harness + receipt in
  `tasks/artifacts/d4-grants-2026-10-20/`.

## State / decisions
- 22:20Z: read handoff D4, Codex D4.md, proposal, 3 pgTAP files, ledger.
- Ledger orders must be contiguous (test asserts order = index+1; Chef register set the
  precedent twice). Ticket said "92+ unless the ledger says otherwise": the ledger rule
  wins, so take order 89 and IFTTT SQL6–8 move to 90–92. Timestamp must sort after
  20261020211500.
- No Docker runtime (no Docker.app/OrbStack). Harness = Homebrew PG17 initdb cluster on a
  Unix socket, with Supabase roles/auth stubs and stubbed missing extensions
  (http, pg_cron, pg_net, pgjwt, pgsodium, supabase_vault). pgTAP absent → minimal SQL
  shim of the functions Codex's tests use (no_plan, ok, throws_ok, results_eq, finish).
  Config PG major is 15; PG17 is a known deviation.
- /private/tmp/fhfh-heavy.lock was held by someone else at 22:19Z.

## Next
Build harness, replay chain, dump effective ACLs pre-migration; caller audit; write migration.

## Gotchas
- Upsert (ON CONFLICT DO UPDATE) needs UPDATE privilege: check before narrowing a table to
  SELECT/INSERT.

## Checkpoint 22:50Z
- Harness works: run-v5 replays bootstrap + all 88 ledger migrations on PG17.11 (socket only).
  Harness deviations, all receipted: 6 unavailable extensions stripped from the baseline;
  one PG17 view-md5 guard skipped (20260731040341); synthetic cron rows seeded before
  20260909161959 (asserts production jobs exist).
- Replay ACL facts: baseline defaults = ALL tables/sequences/functions to anon/auth/service
  for postgres in public. Of Codex's 76 tables, replay already matches target except service
  extras (TRUNCATE/REFERENCES/TRIGGER on draft_pro_*/in_season_*; plus UPDATE/DELETE on the
  six forge revision/board tables). All 46 RPCs already service-only in replay.
- Supabase announcement (fetched): roles anon/authenticated/service_role, public only,
  tables+sequences; functions/PUBLIC EXECUTE not handled by the platform.
- IFTTT SQL6–8 drafts grant explicitly (incl. service_role) → compatible with revoked defaults.
- Decision: two migrations so TJ can approve separately: 89 = 20261020224500 defaults
  (written); 90 = 20261020224600 reconcile reviewed objects (after caller audit). IFTTT → 91–93.
- Wrote supabase/tests/data_api_grants_claude.sql.

## Checkpoint 22:45Z local-18:40 (done)
- Caller audit (subagent) → narrowed Codex: provider ALL→SIUD (sync_runs SIU), Draft Pro to used
  ops, in_season_grants S / workspaces SIU, 3 forecast ALLs, champion_history + waivers S,
  promote RPC no grant, sequence USAGE only. Kept the RSO schedule browser SELECT (product call).
- Migration 90 written; ledger rows 89–90 (sha verified); test 88→90, pending 3→5; super-goal
  summary line updated (the test pins it).
- run-v7 PASSED (claude 205/205, defaults 34/34, RSO 10/10, Codex matrix 1804 + 66 reviewed
  deviations, idempotent reapply). run-v8 negative control fails as intended. Vitest
  supportedBaselineMigration 21/21. Deleted bring-up runs v1–v4, v6.
- Receipt + grant→caller list: tasks/artifacts/d4-grants-2026-10-20/README.md.
- Next: Chef review; TJ approval for any hosted apply (89 then 90). Nothing committed.
