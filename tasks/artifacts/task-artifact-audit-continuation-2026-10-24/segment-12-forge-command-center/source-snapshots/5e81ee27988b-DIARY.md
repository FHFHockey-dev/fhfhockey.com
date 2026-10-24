# S-02 diary: audit security fixes (2026-10-18)

Status: **done locally, nothing committed.** Hosted migration and any release need TJ.

## Files (all uncommitted on octoberBranch)

- **createComment:** `web/pages/api/createComment.ts` and the new `web/__tests__/pages/api/createComment.test.ts`.
- **Public 500 redaction** (`{message, error: "<X>_UNAVAILABLE"}`):
  - Routes: `web/pages/api/v1/trends/{team-power,team-sos,player-trends}.ts` and `web/pages/api/v1/runs/[runId].ts`.
  - The 9 contextual-rankings routes, through the new `web/lib/rankings/apiErrorResponse.ts`.
  - `web/pages/rankings.tsx` fetcher, which now prefers `message`.
  - Tests: `trends/{team-power,player-trends,team-sos(new)}.test.ts`, `runs/detail.test.ts`, `contextual-rankings{,-comparison}.test.ts`.
- **goalie-power: handed to S-03.** I had already added a redaction hunk to `web/pages/api/v1/trends/goalie-power.ts` and created the untracked `web/__tests__/pages/api/v1/trends/goalie-power.test.ts` before the reassignment. Since then I haven't touched either. S-03 may keep or replace both.
- **Account route redaction** (11 routes). Clients render `error` as text, so these keep a fixed sentence in `error` and add `code: "<X>_UNAVAILABLE"`. Typed errors pass through only below 500.
  - Routes: `web/pages/api/v1/account/yahoo/{connect,disconnect,refresh,team-roster}.ts`, `account/{espn,fantrax}/import.ts`, `account/patreon/{index,connect,disconnect,refresh,callback}.ts`. The callback puts its message in the redirect URL; only Patreon 4xx text is kept there.
  - Tests: `__tests__/pages/api/v1/account/yahoo/{connect,disconnect,refresh,team-roster}.test.ts`, `account/{espn,fantrax}/import.test.ts`, `account/patreon/routes.test.ts`.
- **Yahoo next path:** `web/lib/integrations/yahoo/oauth.ts` and `oauth.test.ts`.
- **Migration:**
  - `supabase/migrations/20261018184229_restrict_provider_linkage_browser_writes.sql`, registered in `tasks/TASKS/repository-audit-remediation/migration-authority.json` as order 84, `pending`.
  - `web/lib/supabase/supportedBaselineMigration.test.ts` updated, plus one line in `tasks/TASKS/super-goal/super-goal-final-summary.md`.
  - Harness and receipt are in this folder (`provider-linkage-migration-pg-verify.py`, `provider-linkage-pg-result-v1.json`): 23/23 pass.

## Checks

- **Vitest (focused):**
  - trends, runs and all contextual-rankings: 64 tests.
  - createComment: 4. Yahoo oauth and connect: 5.
  - Baseline migration: 20, plus 3 neighbouring migration and cron files (66).
  - All 13 account test files: 49.
  - All passed.
- **ESLint:** 0 errors on every changed file. There are 3 existing `<img>` warnings in `rankings.tsx`.
- **tsc:**
  - First run: exit 2, with 4 errors, all in other lanes' files (`LeagueWeek.test.tsx`, `rollingPlayerValidationPayload.test.ts`, `ingest-projection-inputs.ts`, `sweep-gamecenter-normalization.ts`). None were in this lane.
  - Second run (behind the heavy lock, after the account changes): exit 2, with 2 errors, both in `pages/api/v1/db/ingest-projection-inputs.ts` (another lane's). None are in this lane's files.

## Not done / for Chef or TJ

- **Draft-pro private-import routes leak.** `account/draft-pro/private-imports.ts`, `private-imports/[uploadId]/stage.ts` and `.../chunks/[ordinal].ts` return any untyped error as a 400 with its raw `message` and `code`. Their test (`lib/draft-pro/api-tests/private-imports.test.ts`) is under S-13's `lib/draft-*`, so I left these for S-13 or a later lane.
- **TJ decisions:**
  - Apply the migration (hosted).
  - Choose a createComment abuse control: sign-in, captcha, moderation, or a shared-store rate limit.
  - Approve removing the unused `web/pages/api/fetch_team_table.ts` and its test.
- **Follow-ups seen, not fixed:**
  - `player-trends` POST still returns the raw message, but only to bearer-authorized callers.
  - `user_entitlements` and `user_provider_preferences` still grant anon and TRUNCATE.
  - `functions/api/fetch_team_table.py` has no caller check.
  - The Patreon callback echoes `?error=` query text into its redirect message.

## Tickets 3-4 (second Chef batch)

- **Token-vault replay gap (order 85):**
  - `supabase/migrations/20261018190022_restore_private_token_vault.sql` recreates the final production-ledger state of the private vault: schema, `private.connected_account_tokens` with Vault secret ids only, 6 indexes, the eleventh composite owner FK, the upsert/get/cleanup routines and trigger, and ACLs. It is guarded and replace-style and never touches token rows.
  - It is registered in `migration-authority.json` as order 85, `pending`, `security`.
  - `supportedBaselineMigration.test.ts` now expects 85 rows and 4 pending, and has a new content test (21 tests pass).
  - The summary line in `super-goal-final-summary.md` is updated to 85 records and four pending. That file is S-04's; it's a one-line, test-coupled change.
  - Harness `token-vault-migration-pg-verify.py`, receipt `token-vault-pg-result-v1.json`: 20/20 pass.
    - Before the migration a fresh replay fails token writes (3F000); after it, token writes work.
    - The fresh catalog equals a replay of the ledger files, including the private routine bodies.
    - A reapply over a populated vault leaves rows, secrets and catalog unchanged.
    - Vault is a stub, not Supabase Vault.
    - Parity omission: the ledger's `REVOKE ... ON SCHEMA/TABLE vault.*` statements were left out, because the provider owns Vault.
- **Q-02** (`Q-02-auth-entitlements-billing.md`): inventory, policy table with sources, decisions for TJ (Patreon grants, ESPN/Fantrax credentials, proration, refunds, post-cutoff collection, first-100 rule), isolation evidence, Stripe 18.5 test-mode and webhook design, acceptance matrix and rollback plan.
  - New tests: `web/lib/in-season/commerce.test.ts` "grant event order, duplicates and reactivation" (5 tests).
  - In-season, Stripe and Draft Pro access suites: 8 files, 164 tests, all passing.
- **Note:** the three draft-pro private-import routes listed above are now being edited by another session (S-13).

## Next command

```bash
cd web && npx vitest run __tests__/pages/api/createComment.test.ts __tests__/pages/api/v1/account __tests__/pages/api/v1/trends __tests__/pages/api/v1/runs __tests__/pages/api/v1/contextual-rankings lib/integrations/yahoo/oauth.test.ts lib/supabase/supportedBaselineMigration.test.ts lib/in-season
```
