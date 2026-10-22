# Local Yahoo/Fantrax sync paywall audit

Local implementation and mocked verification completed October 21, 2026. Nothing was committed, pushed, merged or deployed by this task. No production API/cron/provider requests, database writes, migrations, dependency/lockfile changes, or billing/catalog/credential changes were performed.

Checkout: `/Users/tim/Code/fhfhockey.com`, `octoberBranch`. Starting HEAD was `3c90d72b3df16ecd032361f71085c75f649691db`; another actor advanced HEAD to `7d717d2d04288d1413b2617f9550583158c7cfeb` during the task. The tracked trees at those two commits are identical (`git diff --name-only <start>..HEAD` is empty). Extensive pre-existing dirty/untracked work was preserved. The existing RSO component has unrelated dirty work; this task adds only its shared upsell import and disabled-sync message. Do not release the entire dirty checkout as this candidate.

## Behavior

- A single server adapter reuses existing in-season `rso_sync` grants and existing Draft Pro entitlement evaluation. It creates no grants. Verified monthly, season-pass, applicable Patreon, grandfathered and existing owner access are retained; an independently valid grant remains usable if the other grant source fails.
- Missing authentication returns 401; confirmed free/expired access returns 403; unverifiable access returns 503. Entitlement checks run before personal provider credentials, OAuth exchange, sync/import work, or cached premium player results. Unknown checks cannot authorize sync.
- The shared client lifecycle clears authority during verification, aborts stale account requests, rechecks at expiry/supporter verification deadlines and on focus/auth changes, and distinguishes sign-in, upgrade and transient failures. Sync controls are optional sections of otherwise free pages.
- Failed refreshes retain existing comparisons/plans. Disconnect, stop-and-continue-manually, manual file imports and free tools remain available. Existing server ownership filters and service-role RPC ownership boundaries remain in place.
- Upsells say **$4.99 monthly or a $24.99 season pass ending July 1, 2027**. No rolling annual subscription was introduced.

## UI inventory

| Page | Entry points and result |
| --- | --- |
| `/account` | Yahoo connect, refresh, roster load, imported team/default/settings handlers use shared access. Saved connection metadata can still load so disconnect remains usable after expiry. Manual league/team/profile editors remain free. |
| `/account` Fantrax panel | API discovery, linking, league selection and provider refresh require shared access. Existing account disconnect remains enabled. CSV/JSON/manual import remains free. |
| `/draft-dashboard` | Yahoo connect/account refresh/start/poll; Fantrax settings application/start/poll and personal player data require shared access. Hooks also block programmatic actions and automatic polling without access. Manual drafting, saved draft state and stop controls remain. Other Draft Pro features retain their existing gates. |
| `/start-chart` | Optional Yahoo daily comparison refresh requires shared access; public starter data and other page controls remain free. A failed refresh preserves the previous comparison. |
| `/game-grid/7-Day-Forecast`, `/game-grid/10-Day-Forecast` | `PlayerPickupTable` personal Yahoo league pool uses shared access. General candidates/global ownership remain free. `/game-grid` redirects to the 7-day view. |
| `/roster-schedule-optimizer` | Provider refresh and existing automatic provider refresh require shared sync access. Existing manual workspace, saved-plan/Undo/preservation behavior and independent paid save/upkeep capabilities remain. Legacy sync access adds only `rso_sync`, not unrelated capabilities. |

## Route and domain inventory

Paths in braces enumerate individual routes; `[id]` denotes a dynamic path segment. Existing rollout/provider-readiness restrictions remain in addition to premium access.

| Surface | Enforcement / preservation |
| --- | --- |
| `GET /api/v1/account/provider-sync` | New authenticated, private/no-store shared entitlement status; verification failure is 503. |
| `POST /api/v1/account/yahoo/connect` | Shared guard before OAuth transaction/authorization request creation. |
| `GET /api/v1/account/yahoo/callback` | Validates/consumes browser-bound OAuth transaction, then checks its owner before code exchange, account/credential persistence or discovery. Denial/transient failure redirects with curated feedback. |
| `POST /api/v1/account/yahoo/refresh` | Domain guard in `runYahooManualRefresh`, also in `syncYahooDiscovery`, before provider work. |
| `POST /api/v1/account/yahoo/team-roster` | Guard in `loadYahooTeamRoster` before premium cache/provider reads; existing owned-team lookup remains. |
| `GET /api/v1/account/yahoo/pickup` | Shared guard; existing rate limit, owner-scoped context and no-store response retained. |
| `POST /api/v1/account/yahoo/starter-board` | Shared guard; strict body validation, owner-scoped context and rate limits retained. |
| `/api/v1/account/yahoo/draft-sessions` GET/POST; `/draft-sessions/[sessionId]` GET; `/draft-sessions/[sessionId]/poll` POST | Existing live-draft access path now uses shared entitlement logic, retaining feature/readiness/rollout checks. Existing owned-session checks remain. Saved-state GET retains its pre-existing access behavior; this task does not erase sessions. |
| `POST /api/v1/account/yahoo/draft-sessions/[sessionId]/stop`; `POST /api/v1/account/yahoo/disconnect` | Premium-independent stop/disconnect preserved, with authentication and ownership. |
| `POST /api/v1/account/fantrax/{discover,link,refresh,apply-settings}` | Shared guards inside domain functions; linked discovery checks before stored credentials. Provider import/reconfiguration through these paths is gated. |
| `/api/v1/account/fantrax/connections` GET | Saved owned connections read remains available; no provider sync. |
| `/api/v1/account/fantrax/connections/[accountId]` PATCH | Changing selected leagues requires premium before provider discovery. Label-only changes preserve existing behavior. |
| `/api/v1/account/fantrax/connections/[accountId]` DELETE | Disconnect remains premium-independent through the existing owner-scoped secure RPC. |
| `GET /api/v1/account/fantrax/player-data`; `GET /api/v1/draft-pro/fantrax-player-data` | Shared guard before premium cached/provider data. |
| `/api/v1/account/fantrax/import` GET/POST | Intentionally free: owned manual CSV/JSON data, not API/provider sync. Existing parsing, ownership and settings-conflict protections retained. |
| `/api/v1/account/fantrax/draft-sessions` GET/POST; `/draft-sessions/[sessionId]` GET; `/draft-sessions/[sessionId]/poll` POST | Start/poll use shared access in domain layer. Listing returns fail-closed eligibility; saved-session read retains ownership protections. Transient verification failure does not stop/overwrite the persisted session; confirmed loss stops further sync. |
| `POST /api/v1/account/fantrax/draft-sessions/[sessionId]/stop` | Premium-independent stop preserved. |
| `GET /api/v1/roster-schedule-optimizer/access` | Existing in-season capabilities retained; legacy premium fallback grants sync only; unverifiable access returns 503. |
| `POST /api/v1/roster-schedule-optimizer/provider` | Shared guard before owned provider work. Yahoo adapter retained. Fantrax still explicitly returns unsupported-adapter 409: no authoritative Fantrax RSO roster/availability integration was invented. |
| `/api/internal/fantrax-sync` → `runFantraxScheduledSync` → `syncAccountLeagues` | Rechecks each account's actual `user_id` before credentials/provider calls. Confirmed expired/free accounts are skipped without clearing retained data; verification failure counts as failure and does not fetch. |
| `/api/internal/yahoo-live-draft`, `scripts/yahoo-live-draft-worker.ts` → poll coordinator | Existing coordinator rechecks each session owner's shared entitlement before polling. Confirmed loss and transient errors retain distinct existing handling. |
| RSO client automatic refresh | Continues through the guarded provider route; current shared sync authority required. Existing additional auto-upkeep entitlement rules remain. |

## Deliberate exclusions

- Shared public NHL/ownership ingestion and platform-owned Yahoo credentials are not personal premium sync: `/api/v1/db/update-yahoo-players`, `/api/v1/db/update-yahoo-weeks`, `/api/v1/db/manual-refresh-yahoo-token`, `/api/internal/sync-yahoo-players-to-sheet`, ownership/trend snapshots and associated shared ingestion code were left unchanged.
- RSO public data/schedule and cached public Yahoo eligibility reads remain free. Manual RSO workspace and free manual draft/account tools are not gated as whole pages.
- ESPN manual import and unrelated integrations were not changed.
- Existing Fantrax settings/API and live-draft code is feature-gated; this audit does not certify provider readiness. Its RSO integration remains a placeholder.

## Verification

Executed locally with repository Node **22.11.0**, existing npm/dependencies, mocked provider/auth/DB fixtures, without `GIT_DIR`. Across the latest successful results for each selected file: **35 files / 636 tests passed**. This is the deduplicated set across focused invocations, not one full-suite run. [TEST-RESULTS.json](TEST-RESULTS.json) records each file's count and source log. Initial outdated mocks/timestamp/copy assertions were corrected and the affected files rerun successfully.

Coverage includes anonymous/free/verified monthly/season/expired/cancelled/explicit grace/Patreon/legacy grants, exact season cutoff, supporter staleness, unknown/failed checks, sign-in versus upgrade versus outage, supplied foreign user/account/team identifiers, direct API bypass denial, OAuth callback denial before exchange/persistence, scheduled sync skip/outage, disconnect availability, and manual plan/import preservation. The tests compose central entitlement tests with route denial/ownership tests; they are not every possible state crossed with every route.

Exact test commands (run from `web/`):

```sh
npm test -- --run hooks/useDraftProAccess.test.tsx hooks/useYahooDraftSync.test.tsx hooks/useFantraxDraftSync.test.tsx lib/integrations/yahoo/refresh.test.ts lib/integrations/yahoo/teamRoster.test.ts lib/integrations/yahoo/liveDraftAccess.test.ts lib/integrations/yahoo/pickupApi.test.ts lib/integrations/fantrax/server.test.ts lib/integrations/fantrax/liveDraftServer.test.ts __tests__/pages/api/v1/account/yahoo __tests__/pages/api/v1/account/fantrax components/account/FantraxImportPanel.test.tsx __tests__/components/account/AccountSettingsPage.test.tsx lib/in-season/access.test.ts lib/in-season/commerce.test.ts
npm test -- --run lib/integrations/providerSyncAccess.test.ts lib/integrations/providerSyncPaywall.test.ts lib/integrations/yahoo/pickupApi.test.ts lib/integrations/yahoo/liveDraftApi.test.ts lib/integrations/fantrax/server.test.ts __tests__/pages/api/v1/account/yahoo/callback.test.ts hooks/useDraftProAccess.test.tsx __tests__/components/account/AccountSettingsPage.test.tsx
npm test -- --run lib/integrations/providerSyncAccess.test.ts lib/integrations/providerSyncPaywall.test.ts hooks/useDraftProAccess.test.tsx components/StarterBoardYahoo.test.tsx components/account/FantraxImportPanel.test.tsx __tests__/components/account/AccountSettingsPage.test.tsx lib/integrations/yahoo/liveDraftApi.test.ts lib/integrations/yahoo/liveDraftServer.test.ts lib/integrations/yahoo/pollCoordinator.test.ts lib/integrations/yahoo/discovery.test.ts lib/integrations/yahoo/oauth.test.ts lib/integrations/fantrax/manualImport.test.ts __tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx lib/in-season/workspaceRoutes.test.ts __tests__/pages/start-chart.test.tsx __tests__/pages/draft-dashboard.test.tsx
npm test -- --run __tests__/components/account/AccountSettingsPage.test.tsx
npm test -- --run lib/in-season/access.test.ts lib/in-season/commerce.test.ts lib/integrations/providerSyncAccess.test.ts lib/integrations/providerSyncPaywall.test.ts lib/integrations/fantrax/liveDraftServer.test.ts hooks/useYahooDraftSync.test.tsx hooks/useFantraxDraftSync.test.tsx
npm test -- --run components/StarterBoardYahoo.test.tsx __tests__/pages/start-chart.test.tsx __tests__/pages/draft-dashboard.test.tsx
npm test -- --run components/StarterBoardYahoo.test.tsx __tests__/pages/start-chart.test.tsx
npm test -- --run lib/integrations/providerSyncPaywall.test.ts
```

Run results in order: 180/181 (obsolete pickup mock); 97/98 (account fixture); 466/467 (account fixture); 23/23; 144/144; 79/81 (two changed copy expectations); 78/78; 49/49. The transient failures were local fixtures/assertions, corrected before handoff. An intermediate `npm test -- --run lib/integrations/providerSyncAccess.test.ts lib/integrations/providerSyncPaywall.test.ts lib/integrations/yahoo/pickupApi.test.ts` run passed 51/54 and exposed two ISO timestamp formatting expectations plus the pickup mock; all three files passed later.

Additional checks:

- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --incremental false`: **passed**, exit 0. Plain `npx tsc --noEmit --incremental false` initially exhausted the default heap; the larger-heap rerun passed. Final source edits after that typecheck were copy/import removal only; added endpoint tests passed Vitest and ESLint.
- Targeted `./node_modules/.bin/eslint --report-unused-disable-directives-severity warn <all changed TS/TSX paths relative to web/>`: **passed**, exit 0, 0 errors, 8 existing warnings (six RSO hook dependencies, one DraftDashboard useMemo dependency warning, one AccountSettings `<img>` warning). The exact argument list is [ESLINT-ARGS.json](ESLINT-ARGS.json). Subsequent copy/test edits also passed targeted ESLint without warnings.
- `git diff --check`: **passed**.
- No full production build, browser/Playwright run, live OAuth/provider test, production entitlement/configuration check or database/RLS execution was performed. UI assertions use rendered jsdom fixtures; server isolation checks use mocks and source review of existing secure RPC ownership clauses.

## Billing / release gaps requiring separate authorization

`web/lib/in-season/commerce.ts` already defines $4.99 monthly and $24.99 one-time season coverage ending **2027-07-01 04:00 UTC (July 1 midnight America/New_York)**. Monthly access ends immediately on cancellation; failure grace is capped at 48 hours and fewer than three failed attempts, with retry intent at 24/48 hours, all bounded by season end. These policies and existing Draft Pro/Patreon semantics were preserved. The guard honors stored verified coverage; it does not manufacture grace or run payment collection.

However, the implemented Stripe adapter remains **legacy Draft Pro $5.99 one-time** (`lib/integrations/stripe/config.ts`, checkout validation/payment mode). No implemented monthly/season checkout/fulfillment adapter was found. Existing commerce still marks proration arithmetic, proration rounding, refund treatment and post-cutoff collection as unresolved policies. This task does not make the advertised new plans purchasable or verify any production grants.

Separate approval is required for any billing implementation/catalog/configuration/fulfillment work and any deployment. No new migration is required for these guards when the existing entitlement tables/functions are present; production schema/configuration was not inspected. No approval action was denied or left with an uncertain execution outcome in this task. Billing changes were deliberately outside the authorized scope.

## Exact task-owned changed application/test files

The list below excludes pre-existing unrelated changes, this report/evidence, and the task diary. `CHANGED-FILES.json` is the machine-readable manifest. The RSO component is shared with pre-existing work as described above.

- `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx`
- `web/__tests__/components/account/AccountSettingsPage.test.tsx`
- `web/__tests__/pages/api/v1/account/fantrax/player-data.test.ts`
- `web/__tests__/pages/api/v1/account/yahoo/callback.test.ts`
- `web/__tests__/pages/api/v1/account/yahoo/connect.test.ts`
- `web/__tests__/pages/start-chart.test.tsx`
- `web/components/DraftDashboard/DraftDashboard.tsx`
- `web/components/DraftDashboard/FantraxLeagueSettingsPanel.tsx`
- `web/components/DraftDashboard/YahooLiveDraftPanel.tsx`
- `web/components/PlayerPickupTable/PlayerPickupTable.tsx`
- `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx`
- `web/components/StarterBoardYahoo.test.tsx`
- `web/components/StarterBoardYahoo.tsx`
- `web/components/account/AccountSettingsPage.tsx`
- `web/components/account/FantraxImportPanel.test.tsx`
- `web/components/account/FantraxImportPanel.tsx`
- `web/components/account/ProviderSyncNotice.tsx`
- `web/hooks/useAccountAccess.ts`
- `web/hooks/useDraftProAccess.test.tsx`
- `web/hooks/useDraftProAccess.ts`
- `web/hooks/useFantraxDraftSync.test.tsx`
- `web/hooks/useFantraxDraftSync.ts`
- `web/hooks/useProviderSyncAccess.ts`
- `web/hooks/useYahooDraftSync.test.tsx`
- `web/hooks/useYahooDraftSync.ts`
- `web/lib/in-season/access.test.ts`
- `web/lib/in-season/access.ts`
- `web/lib/in-season/server.ts`
- `web/lib/integrations/fantrax/http.ts`
- `web/lib/integrations/fantrax/liveDraftServer.test.ts`
- `web/lib/integrations/fantrax/liveDraftServer.ts`
- `web/lib/integrations/fantrax/server.test.ts`
- `web/lib/integrations/fantrax/server.ts`
- `web/lib/integrations/providerSyncAccess.test.ts`
- `web/lib/integrations/providerSyncAccess.ts`
- `web/lib/integrations/providerSyncAccessServer.ts`
- `web/lib/integrations/providerSyncPaywall.test.ts`
- `web/lib/integrations/yahoo/discovery.ts`
- `web/lib/integrations/yahoo/liveDraftAccess.ts`
- `web/lib/integrations/yahoo/liveDraftApi.test.ts`
- `web/lib/integrations/yahoo/pickupApi.test.ts`
- `web/lib/integrations/yahoo/refresh.ts`
- `web/lib/integrations/yahoo/teamRoster.test.ts`
- `web/lib/integrations/yahoo/teamRoster.ts`
- `web/pages/api/v1/account/fantrax/player-data.ts`
- `web/pages/api/v1/account/provider-sync.ts`
- `web/pages/api/v1/account/yahoo/callback.ts`
- `web/pages/api/v1/account/yahoo/connect.ts`
- `web/pages/api/v1/account/yahoo/pickup.ts`
- `web/pages/api/v1/account/yahoo/refresh.ts`
- `web/pages/api/v1/account/yahoo/starter-board.ts`
- `web/pages/api/v1/account/yahoo/team-roster.ts`
- `web/pages/api/v1/draft-pro/fantrax-player-data.ts`
- `web/pages/api/v1/roster-schedule-optimizer/access.ts`
- `web/pages/api/v1/roster-schedule-optimizer/provider.ts`

Task evidence files: `REPORT.md`, `CHANGED-FILES.json`, `ESLINT-ARGS.json`, `TEST-RESULTS.json`. Working diary retained for parent handoff at `tasks/diaries/2026-10-21-codex-provider-sync-paywall.md`; exclude it from any release candidate.
