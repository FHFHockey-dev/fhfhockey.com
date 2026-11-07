# RECEIPT: connected-account identity in the RSO Yahoo diet caches (lane RSO-YAHOO-DIET-P2, follow-up)

This fixes the RSO-FLAKE review finding. Before, the process-local Yahoo caches were keyed by FHFH user plus league or team key. After a disconnect, a reconnect to another Yahoo account, or a lost connection, they could be served until their TTL ran out (2 to 30 minutes, settings 6 hours) without re-checking access.

The work sits on top of 3795abb43 and is uncommitted:
- no git mutations, provider or production reads, migrations, flag changes or pushes;
- no GIT_DIR;
- `RosterScheduleOptimizer.tsx` and its test weren't touched (now RSO-FLAKE's).

## The fix

1. **Account generation in every key.** `yahooCacheAccount` (`planningCache.ts`) reads the `connected_accounts` row. This is a local Supabase read, not a provider read. It returns `"{account id}:{Yahoo user GUID}:{last_synced_at}"`. Every diet cache key now carries this value after the user id:
   - settings
   - today's roster
   - scoreboard, league week and weekly counter
   - the discovery scan
   - the in-memory past-day roster cache. That cache isn't behind the flag; with the flag off it now carries `team.connected_account_id`.

   Why each part:
   - Reconnecting to another Yahoo user updates the **same** account row (`callback.ts` → `upsertYahooConnectedAccount`), so the id alone isn't enough. The GUID changes.
   - Any reconnect or resync runs discovery, which rewrites `last_synced_at` (`discovery.ts:348–366`, `:596–612`). So even a same-user reconnect re-keys every cache.
2. **No connected account, no cache.** If the row is missing (disconnect deletes it), belongs to another user, isn't `status = "connected"` (for example `reauth_required`, `syncing` or `error`), or the lookup fails, the value is null. Then nothing is served from **or written to** any cache in that request, and every read goes to Yahoo, as with the flag off.
3. **A failed access check is never answered from cache.**
   - Snapshot: if any live read in the request is refused (`yahoo_access_denied` or `yahoo_reauth_required`), all of this principal's caches are purged (`forgetYahooReadsFor`). If anything in that request came from cache, the snapshot throws the access error instead of returning. League rosters are read live on every snapshot, so each request performs at least one live access check.
   - Start Chart: an access-refused availability page purges the caches and withholds a board built on a cached roster or settings.
   - Goalie confirmations: the cached roster is used only while the account check above passes. A refused live roster read already throws, as before.
   - Required reads (settings and today's roster), when made live, still throw as before.

A same-account cache hit still avoids the provider read. The cadence numbers from RECEIPT-P2 are unchanged.

## Files (uncommitted)

| File | sha256 at HEAD (3795abb43) | sha256 now |
|---|---|---|
| `web/lib/integrations/yahoo/planningCache.ts` | `012da3519715c41407f3096124c186943e428432cc1af4d546d8e3c6d03e1c95` | `14d360e34beb59640d6d3826021e872a7d24760232ab961a534286457c89c8b2` |
| `web/lib/integrations/yahoo/rosterPlanning.ts` | `19660e49140612ac132862c33af371ec417d4b9bc0c2b854c483db4a3869898e` | `5f778924ed4d3f0cd16a95169f0c1999b2c6f949ee1d1d3ff08b5b16b1d67c65` |
| `web/lib/integrations/yahoo/planningConfirmations.ts` | `78262e2a66d587e1243c969b4ed41c67ff542eb010b0b931bd8c224a06f0db7f` | `f10594218eb0a11be6098405055dc89cb1436993c97870fa1abb0ac09bec140f` |
| `web/lib/integrations/yahoo/starterBoard.ts` | `076e75577553ebe58c279f8730a04444057ef2acb1c507e95302d543fe2874be` | `5a0ccd508b65c0bf26b8e874b31a151a0c42085e043abe1ca9e0f6b0a4b8ed51` |
| `web/lib/integrations/yahoo/yahooDiet.test.ts` | `a8c9fc809d05f617644bb24ae9d4c8b498b56d0aad7bc564a2a0acfa5c8eece7` | `1a646c24c4ab4a25e0f74fc131f55b0bafbb7da563585f6158751b5bb780c451` |
| `web/lib/integrations/yahoo/planningConfirmations.test.ts` | `f3f602a0c5aa4808efc8e80f407448fd9ac69c892c49e9fdf8debebe619c1493` | `7898d8a332487bade572c350e9dc640307282051dd57dbc6d3539df93a9b42da` |

## Tests added

- `yahooDiet.test.ts`, account generation: the value is account plus GUID plus last sync. It's null for `reauth_required`, `syncing`, `error`, a missing row, a lookup error, or a row belonging to another user.
- `yahooDiet.test.ts`, snapshot across accounts. Yahoo reads per step:
  - account A cold, then a same-account hit: **7 → 1**
  - another Yahoo user on the same row (GUID change), then the same again: **7 → 1**
  - same-user reconnect (`last_synced_at` change): **7**
  - `reauth_required`, twice: **7, 7** (nothing written)
  - disconnected (row gone): **7**
- `yahooDiet.test.ts`, refused live read: league rosters returning `yahoo_access_denied` while settings and roster are cached makes the snapshot reject with `yahoo_access_denied`. The next request reads everything (**7**, purged), then caches again (**1**).
- `planningConfirmations.test.ts`:
  - A GUID change, then a reconnect, each force a fresh roster read.
  - The same account generation shares the read.
  - `reauth_required` reads live every time.
  - The existing D5 tests now provide a connected account.

Start Chart has no dedicated harness in this lane. It uses the same `yahooCacheAccount`, key layout and purge helper, and it's covered by type-check, lint and the existing Start Chart page and API suites.

## Checks

| Check | Result |
|---|---|
| `yahooDiet.test.ts` + `planningConfirmations.test.ts`, `TZ=UTC` and `TZ=America/New_York` | passed: 58/58 in each |
| Vitest: `lib/integrations`, `lib/rosterScheduleOptimizer`, `lib/rosterScheduleData`, `lib/projections`, RSO component tests (both folders), RSO API routes, Start Chart page + API (164 files), UTC and NY | passed: 3,333 passed, 4 skipped in each |
| ESLint on the 6 changed files | clean |
| Whole-project tsc under `/private/tmp/fhfh-heavy.lock` (noclobber, never stolen), `node --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | **exit 2: 10 errors, none in this lane's files.** All 10 are in another lane's uncommitted SocialShare work: `components/SocialShare/SocialShare.tsx` (3), `SocialShare.test.tsx` (1), `lib/socialShare/trends.test.ts` (5), `trendsFixture.ts` (1). `SocialShare.tsx`, `trends.ts`, `trendsFixture.ts` and `types.ts` show as modified in the working tree. Zero errors mention `integrations/yahoo`, `rosterScheduleOptimizer` or the RSO routes. The lock was taken at 16:12:59Z, only after RSO-MANUAL-F3 released it, and was released after the run. The tree-wide gate stays red until that lane's edits type-check. |
| E2E | not re-run. No browser code changed in this follow-up (server-side cache keys only) |
