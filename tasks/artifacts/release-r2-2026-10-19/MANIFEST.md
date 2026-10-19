# Release R2 byte manifest (2026-10-19)

Read-only analysis by a Sous lane for Chef. No git mutation, network, hosted DB access or test run happened. Every blob below comes from `git rev-parse <commit>:<path>`. Full 40-character blobs are in `manifest.json`.

**Base and candidate:**
- **Base:** production `master` = `457435eb3010c5b3dd92d2e1a46d9c75d851780a`.
- **Candidate bytes:** HEAD `317f8f57ee2527d480f930a25681f58d5ec3bd88` on `octoberBranch`. The working tree is clean for every path below; the only untracked file is `tasks/sprint-2026-10-18/CHEF-REGISTER-2026-10-19.md`.
- **Method:** a curated candidate on `457435eb`, per `NEXT-RELEASE-PLAN.md` §1. Never a merge.

**Totals:** 58 paths. 3 are new (`prodBlob = null`), 0 are deleted, and every path is under `web/`. No `tasks/`, `supabase/`, manifest, lockfile or `vercel.json` path is included.

## Method used for each check

- **Slice-clean:** I read the full `git diff 457435eb HEAD -- <path>` and confirmed that every hunk belongs to the unit. "Source commit" lists every commit that touched the path since `457435eb`. On these paths, `7f094c8e68` is net-neutral: the production blob equals the `ceceb407a` blob.
- **Dependency closure:** I resolved every `lib/`, `utils/`, `components/` and relative import, and every `vi.mock` target, in all 58 candidate files at HEAD. I then compared each target's blob on `457435eb` with its blob on HEAD. The only changed targets outside the candidate are listed per unit, with the reason each one is unnecessary.
- **Tests:** not run, because the rules for this lane forbid it. "Expected pass" rests on three facts:
  1. Chef's post-sprint full Vitest passed (979 files, 0 failures) on a tree where these files have exactly these bytes.
  2. Every module these tests import or mock has the same bytes in the candidate as at HEAD. The exceptions are the unchanged-import cases noted per unit.
  3. Each test diff contains only that unit's cases.

  Chef must still run the focused commands in the exported candidate.

---

## P1-a: P-G sustainability batch skip (first pass in `0de97e77d`, plus C01 hardening in `317f8f57e`)

| Path | Production blob | Candidate blob | Source commit(s) | Slice-clean | Notes |
|---|---|---|---|---|---|
| `web/lib/sustainability/incremental.ts` | `d551dff5f6ca` | `776b2f318d8b` | `0de97e77d`, `317f8f57e` | yes | The whole diff is P-G: per-batch, per-player cutoff detection |
| `web/lib/sustainability/incremental.test.ts` | `b6b063caf6c3` | `9ed7fb480952` | `0de97e77d`, `317f8f57e` | yes | C01's 13 tests |
| `web/pages/api/v1/sustainability/rebuild-score.ts` | `0ce693c27b13` | `5b87cb85a197` | `0de97e77d` | yes | **Required. COMMIT-PLAN C01 does not list it.** `detectSustainabilitySourceAdvance` changed signature from `(client)` to `(client, {snapshotDate, playerIds, windowCodes})`. This caller moves `loadPlayersForSnapshot`, `batchOffsets` and `windows` ahead of the skip check. If the old caller ships with the new `incremental.ts`, the batch check gets no `playerIds`, and type-checking fails |
| `web/__tests__/pages/api/v1/sustainability/rebuild-score.test.ts` | `48b0e83069af` | `252236a35802` | `0de97e77d` | yes | It adds the offset-250 batch case and the `force=true` bypass case |

**Dependency closure:**
- `lib/supabase/pagination` (`fetchAllSupabaseFilterChunks`, `DEFAULT_SUPABASE_FILTER_CHUNK_SIZE`) is unchanged and already exports both names on `457435eb`.
- `lib/sustainability/score.ts`, which writes `components.sourceCutoffs`, is unchanged.
- `rebuild-score.ts` imports `lib/cron/withCronJobAudit`, which changed for R1 (`0a0e7387` to `d604b720`). That import line is unchanged and the production version is compatible, so R1 is **not needed**. The test calls the unwrapped handler.

**Focused tests:** `lib/sustainability/incremental.test.ts __tests__/pages/api/v1/sustainability/rebuild-score.test.ts`. Expected to pass.

**Excluded:** `tasks/TASKS/three-pillars-analytics/sustainability/tasks-prd-sustainability-barometer.md`, the doc C01 lists. It has no runtime effect and keeps `tasks/` off `master`. C01's 4th-cron and finalize-RPC proposals need TJ and are not in this unit.

## P1-b: P-H shift-charts namesake (Pettersson) fix (`0de97e77d`)

| Path | Production blob | Candidate blob | Source commit(s) | Slice-clean | Notes |
|---|---|---|---|---|---|
| `web/pages/api/v1/db/shift-charts.ts` | `f0bb1265bbbe` | `16e8a1034292` | `0de97e77d` | yes | +7/−2. It filters on name and calls `selectRelationshipYahooPosition`. `player_key` comes from the existing `select("*")` on `yahoo_positions` |
| `web/lib/projections/relationshipPlayerPosition.ts` | `37514a3e169b` | `a0c6d08a6850` | `0de97e77d` | yes | Additive only: a new type, a regex and `selectRelationshipYahooPosition` |
| `web/lib/projections/relationshipPlayerPosition.test.ts` | `b758fc0e4810` | `bf4e927fc8d8` | `0de97e77d` | yes | 3 new cases |
| `web/__tests__/pages/api/v1/db/shift-charts.audit.test.ts` | `22be391ab56c` | `506bc40b18ba` | `0de97e77d` | yes | 1 new same-team namesake case. The new imports (`gameLength`, `ingest/pbp`, `ingest/shifts`, `relationshipMaterialization`, `shiftChartRelationshipPayload`) all have the same bytes in production and at HEAD |

**Dependency closure:** `shift-charts.ts` imports `utils/adminOnlyMiddleware`, which SEC-1 changes. Its default-export signature is unchanged, so the two units are independent. No other import changed. `update-nhl-shift-charts.ts` does not read `yahoo_positions`, so it doesn't have the same bug.

**Focused tests:** `lib/projections/relationshipPlayerPosition.test.ts __tests__/pages/api/v1/db/shift-charts.audit.test.ts`. Expected to pass. The `shift-charts.queue` and `.transactional` tests are unchanged neighbours and are worth adding.

## SEC-1: security A (proxy redirect), B (admin relay) and admin role binding, plus C04

| Path | Production blob | Candidate blob | Source commit(s) | Slice-clean | Notes |
|---|---|---|---|---|---|
| `web/lib/NHL/corsProxy.ts` | `688f6f9df7f4` | `d403d45b36d5` | `0de97e77d` | yes | Equals the postimage of `1-proxy-redirect.patch` |
| `web/lib/NHL/corsProxy.test.ts` | `2d420e57d5a6` | `46ed01ed437f` | `0de97e77d` | yes | Patch 1 postimage |
| `web/__tests__/pages/api/cors.test.ts` | `df7a01526f01` | `e308d1912731` | `0de97e77d` | yes | Patch 1 postimage |
| `web/utils/adminOnlyMiddleware.ts` | `a0e860e37409` | `c8ac51a8b6dc` | `0de97e77d` | yes | Postimage of patch 2 followed by patch 3 |
| `web/__tests__/utils/adminOnlyMiddleware.test.ts` | `8bf17dc1f6bb` | `e129dd38b1e1` | `0de97e77d`, `317f8f57e` | yes | Equals patch 3's postimage `e129dd38`, **including** the C04 unverified-id 401 case. That case is the only `317f8f57e` delta: a `getUser` result carrying an id together with an error |
| `web/__tests__/pages/api/v1/db/cron-auth-boundaries.test.ts` | `56e4e8b5e478` | `e8d1b2787e58` | `0de97e77d` | yes | Patch 3 postimage |
| `web/__tests__/pages/api/v1/db/operational-route-auth.test.ts` | `006ed4a09f9f` | `dca6882a0d84` | `0de97e77d` | yes | Patch 3 postimage |

**Notes:**
- The production blob equals the `ceceb407a` preimage that patches 1–3 were cut against, so HEAD bytes and patch replay give identical results. Use the HEAD blobs directly.
- `web/pages/api/cors/index.ts` is unchanged (`a581d89a`).
- **Dependency closure:** `node-fetch`, the `node:` builtins, `lib/supabase`, `lib/supabase/server` and `database-generated.types` are all unchanged.
- **Role binding:** it filters `.eq("user_id", userId)` on `public.users`. Production types show `users.user_id: string`, so no schema change is needed.
- **Excluded:** the `tasks/artifacts/security-candidates-2026-10-17/*` evidence, patches and README. They are evidence only, and C04's "deleted `candidate-{a,b}`" question is moot: both files are present at HEAD and are not release bytes.

**Focused tests:** `__tests__/pages/api/cors.test.ts lib/NHL/corsProxy.test.ts lib/cors-fetch.test.ts components/HomePage/useHomepageGames.test.tsx __tests__/utils/adminOnlyMiddleware.test.ts __tests__/pages/api/v1/db/operational-route-auth.test.ts __tests__/pages/api/v1/db/cron-auth-boundaries.test.ts __tests__/pages/api/v1/db/projection-materialization-auth.test.ts`.
- `cors-fetch`, `useHomepageGames` and `projection-materialization-auth` are unchanged since production and run at production bytes.
- S-08 recorded 280/280 passing on these exact bytes (`evidence/focused-green-s08.log`). Expected to pass.

## SEC-2: S-02 fixes C05–C09 (all from `317f8f57e`)

### C05: contextual-rankings stable errors plus the `rankings.tsx` fetcher

| Path | Production blob | Candidate blob | Slice-clean | Notes |
|---|---|---|---|---|
| `web/lib/rankings/apiErrorResponse.ts` | (new) | `ca1e5013d9ab` | yes | Imports `./rankingTypes` (unchanged, `d03f0aa0`) |
| `web/pages/api/v1/contextual-rankings.ts` | `edea0e94ebf6` | `44b18525b494` | yes | Only the error branch changes |
| `web/pages/api/v1/contextual-rankings/comparison.ts` | `1ba2146f8d03` | `634a70fea217` | yes | same |
| `web/pages/api/v1/contextual-rankings/deployment-tiers.ts` | `f7d4f0ca0fa5` | `28368bdf7988` | yes | same |
| `web/pages/api/v1/contextual-rankings/goalies.ts` | `932340f36752` | `c5a86c90f46a` | yes | same |
| `web/pages/api/v1/contextual-rankings/matrix.ts` | `5de2111000c6` | `7b9f7b85b9ed` | yes | same |
| `web/pages/api/v1/contextual-rankings/snapshot.ts` | `b4dacdf016ca` | `d81f023c302e` | yes | same |
| `web/pages/api/v1/contextual-rankings/splits.ts` | `840787f073d1` | `887da3371e6a` | yes | same |
| `web/pages/api/v1/contextual-rankings/teams.ts` | `0e05598464b7` | `60cceff05e08` | yes | same |
| `web/pages/api/v1/contextual-rankings/trending.ts` | `f4bead7e1ef9` | `c0d935a6dfd3` | yes | same |
| `web/pages/rankings.tsx` | `5de31973fb82` | `de521e75679f` | yes | Only the fetcher changes (+7/−4): it prefers `message`, then `error` |
| `web/__tests__/pages/api/v1/contextual-rankings.test.ts` | `36df98efd93a` | `b3fb88d7419c` | yes | 1 redaction case |
| `web/__tests__/pages/api/v1/contextual-rankings-comparison.test.ts` | `3a975c1341a4` | `f06f15a0e07a` | yes | Query-error passthrough and redaction cases |

**Dependency closure:**
- `deployment-tiers.ts`, `goalies.ts`, `teams.ts` and `rankings.tsx` import `lib/rankings/{deploymentTiers,goalieMatrix,teamMatrix}`. Those changed since production for C14 (S-03 tie-breaks), but their import lines are unchanged, so the production exports suffice. C14 is **not needed**.
- **Behaviour change:** a non-`ContextualRankingsQueryError` that carries its own `statusCode` now becomes a 500. Before, its status passed through. In `lib/rankings` only `ContextualRankingsQueryError` sets `statusCode`, so nothing realistic regresses.
- `__tests__/pages/rankings.test.tsx` (unchanged) feeds `{error: "..."}` with no `message`. The new fetcher still falls back to `error`, so that test should still pass. Add it to the focused set.

**Focused tests:** `__tests__/pages/api/v1/contextual-rankings.test.ts __tests__/pages/api/v1/contextual-rankings-comparison.test.ts __tests__/pages/rankings.test.tsx`.

### C06: Trends and runs 500 redaction

| Path | Production blob | Candidate blob | Slice-clean | Notes |
|---|---|---|---|---|
| `web/pages/api/v1/trends/team-power.ts` | `79e6140de584` | `9476e444bc1e` | yes | 1 line |
| `web/pages/api/v1/trends/team-sos.ts` | `99b34aade506` | `29b1ae33254f` | yes | 1 line |
| `web/pages/api/v1/trends/player-trends.ts` | `2791e505456c` | `1b12d2140696` | yes | +3/−1 |
| `web/pages/api/v1/runs/[runId].ts` | `0b121fe5b61a` | `a9e41116b9c5` | yes | +2/−1 |
| `web/__tests__/pages/api/v1/trends/team-power.test.ts` | `5cee4f6c92e8` | `dfb35109875c` | yes | |
| `web/__tests__/pages/api/v1/trends/team-sos.test.ts` | (new) | `4a0617b15e14` | yes | |
| `web/__tests__/pages/api/v1/trends/player-trends.test.ts` | `22b1c7e2f3fc` | `38e657eca786` | yes | The mock helper is restructured (−3 lines) only to support the new case |
| `web/__tests__/pages/api/v1/runs/detail.test.ts` | `a232627bb035` | `c29e211ed267` | yes | |

**Focused tests:** `__tests__/pages/api/v1/trends/team-power.test.ts __tests__/pages/api/v1/trends/team-sos.test.ts __tests__/pages/api/v1/trends/player-trends.test.ts __tests__/pages/api/v1/runs`.

Use explicit files rather than the `__tests__/pages/api/v1/trends` directory. The directory also contains `goalie-power.test.ts`, which is new since production and belongs to C15. It targets C15's `goalie-power.ts` bytes, so it would likely fail against production's version (not checked).

### C07: the 11 account-route 500s

| Path | Production blob | Candidate blob | Slice-clean |
|---|---|---|---|
| `web/pages/api/v1/account/yahoo/connect.ts` | `3432e7762b51` | `f154b74d8095` | yes |
| `web/pages/api/v1/account/yahoo/disconnect.ts` | `78f2328731c2` | `03196df64c95` | yes |
| `web/pages/api/v1/account/yahoo/refresh.ts` | `7138105c92ac` | `aba07cfe805a` | yes |
| `web/pages/api/v1/account/yahoo/team-roster.ts` | `470c726cacd3` | `1faf9753fc87` | yes |
| `web/pages/api/v1/account/espn/import.ts` | `e3284d13fc2a` | `7244a28f761f` | yes |
| `web/pages/api/v1/account/fantrax/import.ts` | `839e23356bdd` | `46cd3aeb9c40` | yes |
| `web/pages/api/v1/account/patreon/index.ts` | `0509f05c99f4` | `78b94cf358a6` | yes |
| `web/pages/api/v1/account/patreon/connect.ts` | `5f4121a92492` | `d03f58cebd0d` | yes |
| `web/pages/api/v1/account/patreon/disconnect.ts` | `fdf81bce29cf` | `b6629bf1846b` | yes |
| `web/pages/api/v1/account/patreon/refresh.ts` | `b0d40025c251` | `919a2c94b663` | yes |
| `web/pages/api/v1/account/patreon/callback.ts` | `69cfb3622fc2` | `cdf22070fccc` | yes |
| `web/__tests__/pages/api/v1/account/yahoo/connect.test.ts` | `f21fc8ad9b40` | `a0e8f328c90e` | yes |
| `web/__tests__/pages/api/v1/account/yahoo/disconnect.test.ts` | `78745cb15e2f` | `bf6ffad53d16` | yes |
| `web/__tests__/pages/api/v1/account/yahoo/refresh.test.ts` | `5928f4281505` | `f1348a98e097` | yes |
| `web/__tests__/pages/api/v1/account/yahoo/team-roster.test.ts` | `653a328c2ca4` | `d3e992afd3fa` | yes |
| `web/__tests__/pages/api/v1/account/espn/import.test.ts` | `30d501f13477` | `711ed71defe9` | yes |
| `web/__tests__/pages/api/v1/account/fantrax/import.test.ts` | `69ef5bdf8214` | `5c1f279c2ba2` | yes |
| `web/__tests__/pages/api/v1/account/patreon/routes.test.ts` | `9a08d6c94308` | `436106c1f080` | yes |

**Notes:**
- **Human text stays in `error`:** each response keeps human text in `error` and adds `code: "<X>_UNAVAILABLE"`, so the account UI that renders `error` keeps working.
- **Typed errors below 500 only:** typed errors pass their message through only when `statusCode < 500`.
- **Dependency closure:** `callback.ts` newly imports `PatreonApiError` from `lib/integrations/patreon/oauth`. That module is unchanged, and production `refresh.ts` already imports the same class. All other imports are unchanged.
- **Out of scope:** the `draft-pro/private-imports*` routes under `account/` also changed since production. They belong to C11 and are not part of this unit.

**Focused tests:** the 7 test files above. Pass them explicitly. The directory `__tests__/pages/api/v1/account` also picks up draft-pro tests, which may expect C11 bytes; I did not check that either way.

### C08: `createComment`, POST-only and validated

| Path | Production blob | Candidate blob | Slice-clean | Notes |
|---|---|---|---|---|
| `web/pages/api/createComment.ts` | `c6975461293c` | `ec6b6f0e5ca8` | yes | Adds a 405 for non-POST, a 400 `INVALID_COMMENT` and a redacted 500. Compatible with production `CommentForm.tsx`, which POSTs JSON `{name, comment, postId}` and shows `message` when `error` is set |
| `web/__tests__/pages/api/createComment.test.ts` | (new) | `206270570064` | yes | 4 tests |

**Dependency closure:** `lib/sanity/config.js` is unchanged.

**Needs TJ:** the abuse control (rate limiting, captcha or moderation) is explicitly TJ's decision and is **not** in these bytes. Shipping the validation now is still strictly safer than production.

### C09: Yahoo next-path

| Path | Production blob | Candidate blob | Slice-clean | Notes |
|---|---|---|---|---|
| `web/lib/integrations/yahoo/oauth.ts` | `363a8c765b88` | `34c92ff040de` | yes | Rejects `\` and control characters in `sanitizeYahooNextPath` |
| `web/lib/integrations/yahoo/oauth.test.ts` | `1ee4a0265f8a` | `5b0c2e6ba932` | yes | |

**Importers:** `account/yahoo/{callback,connect,refresh,team-roster}.ts`. `callback.ts` is unchanged, and its test (`__tests__/pages/api/v1/account/yahoo/callback.test.ts`, unchanged) is worth adding.

**Focused tests:** `lib/integrations/yahoo/oauth.test.ts __tests__/pages/api/v1/account/yahoo/connect.test.ts __tests__/pages/api/v1/account/yahoo/callback.test.ts`.

---

## Migration ordering (84 and 85)

**Recommendation:** ship R2 with **no** migration file and **no** `migration-authority.json` or `supportedBaselineMigration.test.ts` change. Neither migration is needed by production code or by the candidate. A hosted apply stays a separate ask-first decision (H2(c)).

### 84: `20261018184229_restrict_provider_linkage_browser_writes.sql`

What it does:
- On `connected_accounts`, `external_leagues`, `external_teams` and `provider_sync_runs`, it revokes every privilege from `public`, `anon` and `authenticated`.
- It re-grants `SELECT` to `authenticated`.
- It drops the owner insert, update and delete policies.

Browser access to these tables, on both `457435eb` and HEAD:
- `components/account/AccountSettingsPage.tsx` (lines 872–880 and 1025–1049): `select` only, with count or head queries and `select("*")`.
- `components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx`: `select` only, on `external_teams`.
- `user_provider_preferences`, the one browser-written table here, is untouched by 84.

Server access:
- Every write in `lib/integrations/{yahoo,espn,fantrax,patreon}/*` and `pages/api/v1/account/yahoo/{callback,disconnect}.ts` runs through the service-role client. The baseline grants `service_role` explicitly (baseline line 43637), so the revoke from `public` doesn't remove it.
- `requireApiUser` builds a user-token client only for `auth.getUser` and doesn't return it.
- No browser `.rpc(...)` touches these tables. `functions/` and `webhooks/` have no access to them.

So 84 **would not break** production or the candidate, and neither one needs it. Safe ordering: apply it after the R2 deploy, or independently. Code doesn't constrain the order.

### 85: `20261018190022_restore_private_token_vault.sql`

This restores `private.connected_account_tokens` and the three private routines. Those exist on hosted production but are missing from a fresh replay of the active chain. On hosted, it is meant to re-state identical definitions, using guarded and `create or replace` statements. **Caution:** if any hosted routine body differs from the file, `create or replace` overwrites it. Hosted parity is unproven; the PG harness used a Vault stub.

Neither production nor the candidate needs 85. It matters only for fresh or branch replays. Safe ordering: independent of R2, ideally on a Supabase branch first (S-02 acceptance A8).

### Authority clash (COMMIT-PLAN H2(b))

- **Current state:** HEAD's `migration-authority.json` assigns order 84 to the provider-linkage file and order 85 to the token-vault file. Production `master`'s authority ends at order 72. COMMIT-PLAN says IFTTT reserved entries 84–86 for SQL6–SQL8.
- **Unresolved:** I found no repository file outside COMMIT-PLAN that records the IFTTT reservation, so which side re-sequences is still open.
- **Do not land partway:** before any of this reaches `master`, the migration file, authority row, baseline test and `super-goal-final-summary.md` count line must land in one commit (H2(a)). Landing a migration on `master` without its authority row breaks `supportedBaselineMigration.test.ts`. Another reason to keep R2 migration-free.

---

## Needs TJ, or open questions

1. **createComment abuse control (C08):** TJ's decision and not in R2. The R2 bytes add validation only.
2. **C15 goalie-power redaction:** S-02's goalie-power 500 redaction was handed to S-03 and lives in C15. `pages/api/v1/trends/goalie-power.ts` is `+14/−4` across three changes: page size 2000 to 1000, in-flight cleanup in a `finally`, and the redaction. It is not in R2, so `/api/v1/trends/goalie-power` still returns `error.message` on a 500. It can't be sliced to the redaction alone without new bytes. Either add C15 whole (`goalie-power.ts` plus the new `__tests__/pages/api/v1/trends/goalie-power.test.ts`), or leave it for R3. This is Chef's or TJ's call.
3. **`rebuild-score.ts` and its test (P1-a):** COMMIT-PLAN C01 and §0 omit them, but `incremental.ts` cannot ship without them. They are included here.
4. **IFTTT 84–86 reservation:** the source is not found in the repository. The migration owner must re-sequence (H2(b)). This doesn't block R2.
5. **Migrations 84 and 85 hosted apply:** a separate ask-first decision. Hosted parity for 85 is unproven.
6. **Drop recommendations:** I recommend dropping no unit. Excluded on purpose: every `tasks/` doc and evidence path; R1 (`withCronJobAudit` and `cron-report`), which is compatible but not required; C14; and C11.
