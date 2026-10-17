# G1-auth-draftranker findings (read-only audit, HEAD ceceb407a, 2026-10-17)

## (a) Coverage

- Completed (`[x]`) rows in group: 202 auth-user-settings-platform rows (208 total, 6 open: 17.0-17.3, 46.0, 51.0) + 10 launch-runbook rows + 57 tasks-prd-draft-ranker rows = 269 source rows, plus master 3.19, 5.7.17, 6.3. Master 3.1 is correctly open (17.x, 46.0, 51.0 remain open).
- Audited in depth: 62 rows (the 3 master rows, ~36 auth rows, 10 runbook rows, ~13 DR rows or row groups). Selection: (1) the master rows; (2) all P0/P1-tagged rows (36.0, 43.0, 45.0, 48.0, DR-084, DR-085); (3) rows whose owning code changed after completion (Patreon/Draft Pro 2026-09-07, ESPN/Fantrax 2026-08-16, big commit 7f094c8e6 touching reset-password, uncommitted adminOnlyMiddleware/corsProxy); (4) a spread of foundational rows (RLS, auth context, header, callback/reset, service-role client).
- Production (`457435eb`) vs HEAD: `git diff 457435eb HEAD` is empty for every Draft Ranker, account API, Patreon, auth page, auth context, adminOnlyMiddleware, requireApiUser and supabase client path. So everything below about HEAD is also production behaviour. `supabase/` differs only by 3 unrelated new migrations.
- `accepted_base_overwritten` (path-ledger) has no entries for this group. Only 2 AUTH-workstream paths appear (`web/lib/in-season/commerce.ts` + test, pure date helpers, no auth logic). The only 7f094c8e6 change in this group is `web/pages/auth/reset-password.tsx` (form-error/aria change). It reads correctly and is covered by `__tests__/pages/auth/reset-password.test.tsx` (passed).
- Important structural fact: the active `supabase/migrations/` chain is a 2026-07-16 schema baseline (commit a803c19f7, `20260716112908_production_schema_baseline.sql`, public schema only). All auth/Draft Ranker historical migrations live under `supabase/migration-archive/pre-baseline-20260716/`. Many "migration" rows were completed before the squash and cite paths that moved.
- Ledger line = 569 + ordinal for the auth source. For tasks-prd-draft-ranker it is 5751 + ordinal. For launch-runbook it is 5738 + ordinal.

## (b) Verdict table

| Row | Ledger line | Verdict | Evidence | Note |
|---|---|---|---|---|
| 3.19 A-DRAFT-RANKER | master | VERIFIED (code/DB) + UNVERIFIABLE-OFFLINE (prod flags) | baseline: 21 draft tables RLS, 36 owner/deny policies, 20 functions all `SECURITY INVOKER` (18 service-only + 2 updated_at triggers), `authenticated` has SELECT only on owner tables (baseline l.43653-43679); `lib/draft-ranker/api.ts:129-153`; all 13 user routes call flag + `requireApiUser` + `assertDraftRankerRolloutAccess` | Rollout stage `authenticated`, staff/beta lists, secondary flags off are Vercel env state |
| 5.7.17 C-DYNAMIC-A-DRAFT-RANKER | master | VERIFIED | `pages/api/v1/db/*draft-ranker*` 500 bodies redacted (health l.~118, community l.133-140, discovery l.104-111); `lib/draft-ranker/export.ts:78-85`; tests `__tests__/pages/api/v1/db/draft-ranker-health.test.ts:172-210`, `lib/draft-ranker/export.test.ts:70` | "21/21 RLS tables / 36 policies / 18 functions" reproduced locally from the baseline. Live catalog proof is UNVERIFIABLE-OFFLINE |
| 6.3 security-boundary matrix | master | CONTRADICTED (partial) | matrix row "Entitlement": `lib/draft-pro/server.ts:22-33`, `lib/in-season/server.ts:52`, `lib/integrations/patreon/sync.ts:316` (Patreon grants Draft Pro + in-season). Row "no contradictory public writer": `web/pages/api/createComment.ts:1-29`. Row "secrets": ESPN/Fantrax credentials now stored (see C0126/C0131) | Other matrix rows hold: views security-invoker (`20260731035012_restrict_admin_metadata_views.sql`), all 270 baseline tables RLS-enabled, no permissive non-owner write policy, `public.users` select-own only (baseline l.40065), `adminOnlyMiddleware` fail-closed |
| C0005 1.4 | 574 | VERIFIED | baseline l.40169-43132: 9 tables x 4 owner policies, all `( SELECT auth.uid() )` | No repo SQL test for the active chain (migration tests read archive files). Prod parity UNVERIFIABLE |
| C0006 1.5 | 575 | REGRESSED | `private` schema is not created anywhere in `supabase/migrations/` (only `search_path ... 'private'` refs at baseline l.1328/5291). Original files only in `supabase/migration-archive/.../20260713055537_encrypt_connected_account_tokens_with_vault.sql` | Commit a803c19f7 (baseline squash 2026-07-16) dropped the token store from the replayable chain. README lists it as "archived; not replayed" |
| C0008 1.7 | 577 | VERIFIED | `database-generated.types.ts:48282, 48877` (secure token RPCs) and user tables present | |
| C0011 2.2 | 580 | VERIFIED | `contexts/AuthProviderContext/index.tsx:17-26, 192-219` | richer user shape incl. role |
| C0012 2.3 | 581 | VERIFIED | `pages/_app.tsx:95` | |
| C0014 2.5 | 583 | VERIFIED (no direct test) | `lib/user-settings/ensureUserRecords.ts:29-90`, handles 23505 | Only mocked in AuthProviderContext test; no unit test of the helper |
| C0022 3.6 | 591 | VERIFIED | `__tests__/components/Layout/Header.test.tsx:157,178,208,224,239` | |
| C0027 4.4 | 596 | VERIFIED | `pages/auth/callback.tsx`, `__tests__/pages/auth/callback.test.tsx:56-218` | |
| C0028 4.5 | 597 | VERIFIED | `pages/auth/reset-password.tsx`, test l.94-322 | 7f094c8e6 change reviewed, OK |
| C0031 4.8 | 600 | VERIFIED | `tasks/TASKS/auth-user-settings-platform/docs/auth-provider-manual-config.md` (190 lines) | |
| C0040 5.8 | 609 | VERIFIED | `pages/account/index.tsx:10-37`, `__tests__/pages/account/index.test.tsx:40-62` | |
| C0042 6.0 | 611 | REGRESSED (partial) | Active baseline has 10 composite `*_user_fk` constraints (baseline l.37939-39547); row claims eleven. 11th is `private.connected_account_tokens` composite FK, present only in archive `20260713060931_...sql` | Same root cause as C0006. Prod likely still has 11 (UNVERIFIABLE) |
| C0045 7.1 | 614 | REGRESSED (repo) / UNVERIFIABLE (prod) | as C0006; `public.upsert_connected_account_tokens_secure` (baseline l.5289) calls non-existent `private.upsert_connected_account_tokens` on a fresh replay | Every token writer (Yahoo/Fantrax/ESPN/Patreon) would fail on a fresh environment |
| C0047 8.1 | 616 | CONTRADICTED | API routes still `import supabase from "lib/supabase"` (browser client re-export): `pages/api/v1/sustainability/player/[playerId].ts:3`, `.../upcoming/[playerId].ts:3`, `.../leaderboard.ts:5` (+ `lib/sustainability/data.ts:1`, `utils/stats/nhlStatsFetch.ts:1`) | Anon-key public reads, low risk, but row says server/API imports were replaced |
| C0048 NEW 9.0 | 617 | UNVERIFIABLE-OFFLINE | Supabase dashboard / SMTP state | Check hosted Auth config (Dashboard -> Auth -> Email/SMTP/Templates) |
| C0066 NEW 12.2 | 635 | UNVERIFIABLE-OFFLINE | prod `information_schema.columns` for `private.connected_account_tokens` | See section (d) |
| C0069 NEW 13.2 | 638 | VERIFIED | `lib/supabase/server.ts:9-60`, `lib/supabase/server.test.ts:9,21` | Lazy, no public-key fallback |
| C0101 NEW 21.1 | 670 | VERIFIED | `lib/supabase/index.ts:14` | |
| C0111 NEW 28.1 | 680 | VERIFIED | `lib/supabase/client.ts:17-20`, `client.test.ts:16-33` | |
| C0112 NEW 28.2 | 681 | VERIFIED | `lib/supabase/public-client.ts:14-19` | no dedicated test |
| C0115 NEW 24.1 | 684 | VERIFIED + P3 note | callback uses PKCE + browser-binding transaction (`lib/integrations/yahoo/oauth.ts`, `callback.ts:79-97`) | `sanitizeYahooNextPath` (oauth.ts:55-60) allows `/\host`; Patreon's sanitizer blocks backslash |
| C0124 NEW 24.10 | 693 | VERIFIED (partial read) | `pages/api/v1/account/yahoo/team-roster.ts:19-30`, `requireApiUser`, `userId` passed to loader | Loader internals only skimmed; 500 path returns raw `error.message` |
| C0125 NEW 25.0 / C0126 NEW 25.1 | 694/695 | CONTRADICTED | Fantrax stores the user Secret ID in Vault: `supabase/migrations/20260814192101_fantrax_settings_first.sql:242-256`, `lib/integrations/fantrax/client.ts:263`. Row 25.1: "do not store Fantrax credentials" | Commit 89b47ffac / 3b24aeddb (2026-08/09). No newer owner decision found in tasks/ |
| C0130 NEW 26.0 / C0131 NEW 26.1 | 699/700 | CONTRADICTED | ESPN `SWID`+`espn_s2` cookies stored via `upsert_connected_account_tokens_secure`: `supabase/migrations/20260815023132_espn_fantasy_private_beta.sql:403-417`, `lib/integrations/espn/server.ts:171-201`. Row 26.1: "store no ESPN credentials/cookies" | Commit 89b47ffac (2026-08-16, in prod). `grep espn_s2 tasks/` finds nothing, so no recorded approval |
| C0135 NEW 27.1 | 704 | VERIFIED | `lib/integrations/patreon/oauth.ts:86-153`, `lib/integrations/patreon/oauth.test.ts:85`, `__tests__/pages/api/v1/account/patreon/routes.test.ts:114-158` | HMAC state, 15-min TTL, safe next. P3: not single-use / not browser-bound (Yahoo's is) |
| C0137 NEW 27.3 | 706 | CONTRADICTED | "explicit no-concrete-feature-mapping boundary": `lib/draft-pro/server.ts:22-33`, `lib/in-season/server.ts:52`, `sync.ts:316`, `sync.test.ts:60` ("verified Draft Pro source") | Commit 69b9d6a67 (2026-09-07) |
| C0140 NEW 29.1 | 709 | VERIFIED | `.gitignore:47`; `git ls-files` shows no `yahooAuth/token.json` | Tracked `web/.env.development`, `web/.env.production`, `web/.env.test`, `cms/.env.development` exist. Not inspected (access denied by tool policy). Confirm they hold only public values |
| C0149 NEW 31.1 | 718 | VERIFIED (repo) | baseline l.43514-43515 (REVOKE PUBLIC, GRANT service_role only) | Dependent on missing `private` schema, see C0006 |
| C0169 NEW 35.0 / C0171 NEW 35.2 | 738/740 | REGRESSED | Active chain no longer reproduces the auth/settings token layer (see C0006). README of archive concedes the exclusion | Row's goal "new environments do not depend on unregistered SQL" no longer true for tokens |
| C0173 NEW 36.0 / C0175 36.2 | 742/744 | VERIFIED (public tables) / UNVERIFIABLE (prod rollback probes) | 10 composite FKs baseline l.37939-39547; FK to `auth.users` ON DELETE CASCADE | |
| C0179 NEW 37.2 | 748 | VERIFIED | all 36 policies in scalar form (baseline) | |
| C0077 NEW 15.1 / C0090 NEW 18.2 | 646/659 | VERIFIED | `pages/auth/reset-password.tsx:157-232` handles code, token_hash, hash tokens; tests l.167-215 | PKCE migration (46.0) still open |
| C0158 NEW 33.1 | 727 | VERIFIED | `AuthProviderContext/index.tsx:101-110` publishes user before role lookup | |
| C0184 NEW 41.0 | 753 | CONTRADICTED | "grants no concrete FHFH feature": same code as C0137 | Owner decision of 2026-07-14 is superseded in code; no recorded new decision |
| C0185 NEW 42.0 | 754 | CONTRADICTED (scope claim) | "Patreon as account linking only ... without concrete feature grants" | Patreon now gates Draft Pro and in-season access |
| C0193 NEW 43.0 (P1) | 762 | VERIFIED | `components/account/PatreonConnectionPanel.tsx:64-71, 88, 154, 187, 229`; test l.105/140 | |
| C0195 NEW 45.0 / C0197 45.2 (P1) | 764/766 | VERIFIED | `lib/supabase/auth-callback-location.ts:100-150`; callback + reset set safe titles (callback.tsx:74, reset-password.tsx:131); tests `auth-callback-location.test.ts`, `callback.test.tsx:92,218`, `reset-password.test.tsx:185,236` | `sanitizeAuthReturnPath` also rejects `/\host` via origin check |
| C0202 NEW 47.1 | 771 | VERIFIED | `AuthProviderContext/index.tsx:82-90`, `browser-auth.ts:62-84`; `AuthProviderContext.test.tsx:207` | Sign-out is `scope:"local"` only. The remote refresh token is not revoked (P3) |
| C0205 NEW 48.0 (P1) | 774 | UNVERIFIABLE-OFFLINE | owner-confirmed password rotation | needs owner attestation |
| C0200 NEW 46.0 (open) / C0208 NEW 51.0 (open) | 769/777 | n/a open rows | | open state is correct |
| Runbook C0001 | 5739 | VERIFIED | focused DR suites pass in Chef's run (lib/draft-ranker/*.test.ts, DraftRanker component tests) | |
| Runbook C0002 | 5740 | STALE-EVIDENCE | local versions replaced by baseline 20260716112908; `tasks/TASKS/draft-ranker/release-manifest.md` cites `supabase/migrations/20260715050418_...` which no longer exists | Prod ledger must be re-read |
| Runbook C0003 | 5741 | VERIFIED (schema) / UNVERIFIABLE (advisors) | see 3.19 | |
| Runbook C0004 | 5742 | UNVERIFIABLE-OFFLINE | prod journey/deletion drills; FK cascade chain verified (baseline l.37395-37843) | |
| Runbook C0005 | 5743 | UNVERIFIABLE-OFFLINE | browser evidence | |
| Runbook C0006 | 5744 | VERIFIED | `lib/draft-ranker/communityRedTeam.test.ts` passed | |
| Runbook C0007 | 5745 | UNVERIFIABLE-OFFLINE | health report is prod data | |
| Runbook C0008 | 5746 | VERIFIED / minor STALE | one cited migration path missing (see C0002) | |
| Runbook C0009/C0010 | 5747/5748 | VERIFIED (documented) | runbook sections "Staff cohort operational record" | Owner approval is a recorded fact only |
| DR-010/011/012 (C0009-C0011) | 5760-5762 | STALE-EVIDENCE | migration tests read archive paths (`lib/supabase/fhfhDraftRankerOwnershipMigration.test.ts:6-12`); `dr-010/011/012-migration-review.md` cite `supabase/migrations/2026071...` paths that no longer exist | Outcome holds in baseline. DR tables, constraints and RLS verified |
| DR-013 (C0012) | 5763 | VERIFIED | `lib/draft-ranker/api.ts`, `__tests__/pages/api/v1/draft-ranker/index.test.ts` | |
| DR-020/021 (C0014/15) | 5765/5766 | VERIFIED | `server.ts:755-800` -> `reorder_draft_ranking` (owner-scoped `user_id = p_user_id`, op id + payload hash + expected version); migration tests (archive) | |
| DR-030..033 | 5770-5773 | VERIFIED | `placementEngine.test.ts`, `AssistedPlacementPanel.test.tsx`, `DraftPlayerSearch.test.tsx`; all queries filter `user_id` (`server.ts:44-52, 139-146, 473-495`) | |
| DR-040..043 | 5775-5778 | VERIFIED | `DraftContributionConsent.test.tsx`, `queue.test.ts`, `rateLimit.test.ts`, `pairwiseServer.test.ts`; DB-backed limits `enforce_draft_ranker_pairwise_rate_limit` | queue/respond routes gated by `isDraftRankerHomepageEnabled` |
| DR-050..052 | 5780-5782 | VERIFIED | `discovery.test.ts`, `DraftDiscovery.test.tsx`; route gated by discovery flag (`discovery.ts:31`) | |
| DR-060..063 | 5784-5787 | VERIFIED | `communityModel.test.ts`, `communityServer.test.ts`, `CommunityRankingsPage.test.tsx`; community route gated and aggregate-only (`community.ts:36-60`) | |
| DR-070 (C0038) | 5789 | VERIFIED + P3 | `export.ts`, `exportServer.ts:184-217` owner-scoped | export rate limit is per-instance memory (`exportRateLimit.ts:5-10`) |
| DR-071 (C0039) | 5790 | VERIFIED | `draft-ranker-health.test.ts:73-172`, exact-confirmation zod literals | |
| DR-072.x (C0040-C0046) | 5791-5797 | UNVERIFIABLE-OFFLINE | prod env `DRAFT_RANKER_ROLLOUT_STAGE=authenticated`, deployments `dpl_F6EpD...`, health audit rows | Code side of `authenticated` stage verified (`api.ts:171-176`) |
| DR-073 (C0047) | 5798 | VERIFIED (focused) / UNVERIFIABLE (browser, drills) | | |
| DR-080..083 (C0049-52) | 5800-5803 | VERIFIED | retirement rows, owner decision recorded | |
| DR-078/079 (C0054/55) | 5805/5806 | UNVERIFIABLE-OFFLINE / VERIFIED | `.env.development.local` is gitignored (`.gitignore:41`) | |
| DR-084 (C0056, P1) | 5807 | VERIFIED + P3 side effect | three catch blocks return fixed code/message | Input-validation errors (`parseAsOf`/`parseOperationId` throw inside `try`) now surface as generic 500 instead of 400 |
| DR-085 (C0057, P1) | 5808 | VERIFIED | `export.ts:78-85`, `export.test.ts:70-81` | Leading tab/CR alone (without a following trigger) is not neutralised (OWASP lists them) |

## (c) Top problems (ranked)

1. **P2: 6.3 matrix and 27.3/41.0/42.0 are false for Patreon entitlement.** The claim is "Patreon is account-linking-only, no concrete feature grant". Current code makes an active Patreon supporter row (`patreon_supporter`, `metadata.draft_pro_eligible=true`) unlock Draft Pro (`web/lib/draft-pro/server.ts:22-33, 49-60`) and in-season capabilities (`web/lib/in-season/server.ts:52-63`). `patreon/sync.ts:316` sets the flag and `sync.test.ts:60` asserts it. This came in via 69b9d6a67/e717c661d (2026-09-07). The browser cannot self-grant, because the restrictive policy `user_entitlements_draft_pro_service_only` (`20260909120000_...sql:29-32`) blocks `draft_pro` and `patreon_supporter` keys. But the documented product boundary and the security matrix "Entitlement" row are stale. A new owner decision and matrix update are needed.
2. **P2: Credentials are now stored for ESPN and Fantrax, contradicting 25.0/25.1/26.0/26.1 and the 6.3 "Secrets" row.** ESPN `SWID`/`espn_s2` session cookies (`20260815023132_espn_fantasy_private_beta.sql:403-417`, `lib/integrations/espn/server.ts:171-201`) and the Fantrax user Secret ID (`20260814192101_fantrax_settings_first.sql:242-256`) are written to the token vault. Row 26.1 says "store no ESPN credentials/cookies" and 25.1 says "do not store Fantrax credentials". No owner approval is recorded in `tasks/` (`grep espn_s2` returns nothing). Both shipped to production in 89b47ffac.
3. **P2: The replayable migration chain cannot create the token vault layer (1.5, 6.0, 7.1, 12.x, 31.1, 35.0, 35.2).** `private.connected_account_tokens`, `private.upsert/get_connected_account_tokens` and the 11th composite FK exist only in `supabase/migration-archive/pre-baseline-20260716/`. The active baseline (a803c19f7) only holds the public wrappers that call them. A fresh branch or disaster-recovery replay would have every token-writing flow (Yahoo, Fantrax, ESPN, Patreon) fail at runtime. The archive README treats this as "archived; not replayed" data, but it is schema, and row 35.0's stated goal is reproducible environments.
4. **P2: Unauthenticated privileged public writer, which 6.3 says does not exist.** `web/pages/api/createComment.ts:7-29` accepts any POST (no method check, auth, validation or rate limit). It writes arbitrary `postId`/`name`/`comment` into Sanity with `SANITY_API_TOKEN`, and returns the raw `error` object on failure. Unchanged in production. It is not covered by the matrix. Needs auth or captcha, a rate limit, a length limit, and no error echo.
5. **P2/P3: Browser roles keep write access to provider-linkage tables that only the server needs.** `authenticated` (and `anon`) hold ALL privileges, including TRUNCATE/TRIGGER, on `connected_accounts`, `external_leagues/teams`, `provider_sync_runs`, `user_entitlements`, `user_provider_preferences` (baseline l.43635-44659). The owner `insert_own` policies let any signed-in user insert a `connected_accounts` row, and `idx_connected_accounts_provider_user_id_unique` (baseline l.34074) then lets them squat another person's `(provider, provider_user_id)`. That makes the real owner's Patreon/Yahoo link fail with a 23505 conflict. The browser only SELECTs `connected_accounts` (`AccountSettingsPage.tsx:880,1025`). Tighten grants. A later migration revokes only `user_entitlements` keys.
6. **P3: 8.1 not fully done.** Three sustainability API routes plus `lib/sustainability/data.ts` and two utils still import the browser-client default (see C0047).
7. **P3: Small hardening gaps.**
   - Yahoo `sanitizeYahooNextPath` permits `/\evil.example` (`oauth.ts:55-60`). It is exploitable only against the user's own authenticated POST.
   - Patreon OAuth state is HMAC-only, replayable for 15 minutes and not browser-bound, unlike Yahoo's DB transaction.
   - 12 account routes return raw `error.message` on 500 (`pages/api/v1/account/**`, e.g. `team-roster.ts:46-52`, `patreon/index.ts`).
   - Sign-out is `scope:"local"` only.
   - `invokedByCron` uses non-constant-time `===` (`adminOnlyMiddleware.ts:68-75`).
   - The export limiter is per-instance memory.
8. **P3: `adminOnlyMiddleware` at HEAD/prod.**
   - The role lookup is not bound to the verified user id. It is safe only because `public.users` has a single select-own policy (baseline l.40065). The uncommitted diff adds `.eq("user_id", userId)`, a tunnel/forwarding guard and a test (`adminOnlyMiddleware.test.ts:290`).
   - Committed tests cover neither the 403 non-admin path nor the admin-success path (only cron, local-dev and 401). The uncommitted diff adds a test for the lookup binding.
   - The matrix says "exact cron bearer only", but `invokedByLocalDev` also admits loopback in `NODE_ENV=development`.
9. **Note: NHL CORS proxy at HEAD** uses `redirect: "error"` (`web/lib/NHL/corsProxy.ts`). The parser allows `schedule/standings/score/now` URLs, which NHL redirects, so those proxy calls fail at runtime in prod. The uncommitted diff (1-hop validated redirect) addresses this. SSRF controls (host allowlist, IPv4 block-list, checked socket lookup) are sound.
10. **Note: the known `cron-audit-wrappers.test.ts` failure (46 vs 47) comes from the uncommitted edit to `tasks/TASKS/cron-operations/cron-schedule.md`** (job 374 moved). The test parses that markdown. It is not a code regression.

## (d) UNVERIFIABLE-OFFLINE checks needed (all read-only)

1. Production catalog: `select column_name from information_schema.columns where table_schema='private' and table_name='connected_account_tokens'`. Expect `access_token_secret_id`/`refresh_token_secret_id` and no plaintext columns (rows 7.1, 12.2). Also `select count(*) from pg_constraint where conname like '%_user_fk'` (expect 11).
2. Production grants: `select grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name in ('connected_accounts','user_entitlements','external_leagues','external_teams','provider_sync_runs','user_provider_preferences') and grantee in ('anon','authenticated')` (problem 5), plus `pg_policies` for `user_entitlements` (restrictive policy present).
3. Production `supabase_migrations.schema_migrations` vs local versions (runbook C0002, 35.3).
4. Vercel project env read (names/values-redacted state): `DRAFT_RANKER_ENABLED`, `DRAFT_RANKER_ROLLOUT_STAGE=authenticated`, `DRAFT_RANKER_HOMEPAGE_ENABLED`, and that `DRAFT_RANKER_DISCOVERY_ENABLED`, `DRAFT_RANKER_COMMUNITY_CONTRIBUTION_ENABLED`, `COMMUNITY_DRAFT_RANKINGS_ENABLED` are unset or false, and beta allowlist is empty (rows DR-072.x, 3.19).
5. Supabase hosted Auth config (SMTP, templates with `RedirectTo`/`TokenHash`, redirect allow-list) for rows 9.x, 10.x, 14.x, 46.0.
6. Supabase advisors (security + performance) for the 21 Draft Ranker and 9 auth tables.
7. Confirm tracked env files (`web/.env.production`, `web/.env.development`, `web/.env.test`, `cms/.env.development`) contain only `NEXT_PUBLIC_*`-class values (name-only check by owner/Chef; I did not read them).
8. Vercel/Supabase logs for `/api/createComment` volume (problem 4) and Sanity `comment` document count.
