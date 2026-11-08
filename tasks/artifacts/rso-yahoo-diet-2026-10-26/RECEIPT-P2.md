# RECEIPT-P2: RSO Yahoo diet, Phase 2 (lane RSO-YAHOO-DIET-P2)

Implements TJ's decisions D2, D3, D4 (migration file only), D5, D6 and D8 (TJ-DECISIONS-RECORDED.md). D1 is kept as decided: the full discovery scan stays, and only its cadence changes.
- Nothing is committed.
- No Yahoo, DB or production calls; no deploys; no GIT_DIR.
- The migration is **not applied**.

## Server flag (D7)

**`RSO_YAHOO_DIET=1`** turns everything on. It's off by default: unset or any other value keeps today's behaviour exactly. Every existing suite passes unchanged with the flag off.
- The flag is read on the server in `web/lib/integrations/yahoo/yahooIdentity.ts` (`rsoYahooDietEnabled`).
- The client learns it from `yahooDiet: true` in the provider snapshot response.

## What each step does, and Yahoo reads saved

Baseline: one snapshot is 6 base reads + 58 discovery pages (+0–13 elapsed days). Auto-upkeep runs one snapshot every 5 minutes per visible tab, about 768 reads an hour per tab.

| Step | Decision | Change | Yahoo reads saved |
|---|---|---|---|
| 0 | D8 | `yahooIdentity.ts`: one two-way-unique resolver over verified `fhfh_player_external_identities` (context `yahoo:game:{gameKey}:season:{yyyy}`, `season_id`, `verification_status = verified`). It replaces the `yahoo_nhl_player_map_read` reads in `rosterPlanning.ts`, `planningConfirmations.ts` and `starterBoard.ts`; Start Chart then maps to NHL ids through verified, unmerged `fhfh_player_identities`. The legacy rule is preserved verbatim as `legacyYahooIdentities` for the flag-off path. `compareYahooIdentityMaps` is the comparison harness. | 0 (DB-side change) |
| 1 | D2 | Route: `provider.ts` passes `refresh` through; only `"manual"` bypasses the caches, and an absent or any other value is `"auto"`. Server: principal-scoped, process-local caches (`planningCache.ts`). Every auto snapshot reads today's roster (when its 2-minute window has passed) and league_rosters. The full discovery scan is reused for 15 minutes unless league_rosters show any ownership change. Scoreboard, league week and the weekly counter are reused for 30 minutes; the counter re-reads on any ownership change. Each cached fact is judged fresh against its own read time and carries its `asOf` in limitations and evidence. Client: a single-tab upkeep lease in localStorage (`upkeepLease.ts`), used only when the server reports the flag; the provider request now says `refresh: "auto"` or `"manual"`. | Upkeep tick: 1–2 reads instead of 64. Per open hour: about 12×2 + 4×58 + 2×3 ≈ **262** (from ≈768). A second visible tab adds 0 timed reads. |
| 2 | D3 | Settings reused per (principal, league) for 6 hours, in RSO and Start Chart. The roster freshness check no longer depends on the cached settings' age; a limitation names the settings read time. | −1 per snapshot and per Start Chart load inside the window |
| 3 | D5 | Today's roster is shared between the snapshot, the goalie confirmation read and Start Chart while it's inside the existing 2-minute window (the same `Date`/`Age` arithmetic). Confirmations skip Yahoo when a roster read from the last 15 minutes shows no goalie whose team plays today. Absent marks stay unknown, as when Yahoo omits them. | Confirmations: one per plan edit becomes at most one per 2 minutes, and 0 on days no rostered goalie plays |
| 4 | D6 | `yahooInferredAcquisitionTiming` (starterBoard.ts) is shared by Start Chart and RSO: daily league + `weekly_deadline` intraday means same-day, tomorrow means next-day, anything else is unknown. RSO labels it twice: as evidence `acquisitionTiming` (source "Inferred from Yahoo weekly deadline") and in the limitation "Add timing is inferred from Yahoo's weekly deadline (…); change it in League rules if your league differs." `providerRules.ts`: a timing carrying that evidence yields to a manager override, and the label is then dropped. An explicit provider timing keeps today's precedence. | 0 |
| 5 | D4 | Migration `supabase/migrations/20261026200000_rso_yahoo_past_lineups.sql` (**not applied**): private table keyed (user, team, date), player keys and slots only, RLS on, no policies, grants to service_role only, `purge_rso_yahoo_past_lineups(season)` for the season-end purge. Code path behind the flag: read stored days first; store a day only after a fully verified Yahoo read; a missing table or failed read falls back to Yahoo. | −(elapsed days already stored) per snapshot, up to 13, once applied |

With the flag on, the snapshot also reports `Yahoo reads this snapshot: N` in request-local diagnostics. The D7 window can measure real savings without a proxy.

## Offline resolver comparison (D8 precondition)

- **Not measurable offline:** both identity tables live only in Supabase. This lane is barred from DB reads, and the Supabase MCP isn't authenticated, so real agreement and coverage numbers don't exist yet.
- **Built and tested:** the harness (`compareYahooIdentityMaps`, `legacyYahooIdentities`, `uniqueVerifiedYahooIdentities`) on synthetic fixtures. It covers agreement, disagreement, one-side-only, ambiguity in either direction, foreign-game keys and bare numeric ids.
- **Before turning the flag on:** run the comparison on real rows. Use one bounded read-only query per table, plus the league's roster keys from the D7 window. Agreement, legacy-only and verified-only counts go in the window receipt. If verified coverage for the season context is thin, the flag would leave roster players "without unique canonical identity". That's safe, but it's a regression in usefulness.

## Checks

| Check | Result |
|---|---|
| Vitest: `lib/integrations`, `lib/rosterScheduleOptimizer`, `lib/rosterScheduleData`, `lib/projections`, RSO component tests (both folders), RSO API routes, Start Chart page + API (161 files), `TZ=UTC` | passed: 3,250 passed, 4 skipped, 2 files skipped |
| Same set, `TZ=America/New_York` | passed: 3,250 passed, 4 skipped |
| RSO component file after the lease-release fix | passed: 213/213 |
| Whole-project tsc under `/private/tmp/fhfh-heavy.lock` (noclobber, released by owner) with `node --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | passed, exit 0 |
| ESLint on all touched and new TS files (including providerRules, its test and provider.ts) | 0 errors. 6 warnings, all pre-existing `exhaustive-deps` warnings in RosterScheduleOptimizer.tsx; the one this lane added was fixed |
| Playwright `e2e/roster-schedule-optimizer.spec.ts`, `e2e/rso-continuity.spec.ts`, `e2e/start-chart.spec.ts` on isolated Next (:3100, `PLAYWRIGHT_ISOLATED_NEXT=1` from the config), under the heavy lock, `TZ=UTC` | passed: 73/73 (2.0 min). These specs run with the flag off (the default), so they confirm no regression, not the flag-on path. |
| Same E2E, `TZ=America/New_York` | passed: 73/73 (2.0 min); lock released |
| Re-run after the providerRules/provider.ts grants: whole tsc under the heavy lock, then E2E UTC + NY under the lock | tsc exit 0; E2E 73/73 and 73/73 |
| RSO component + `yahooDiet.test.ts` after the final ref-cleanup fix, UTC and NY | passed: 254/254 in each |

New tests:
- `yahooDiet.test.ts` (18): flag, resolver, cache windows, ownership signature, upkeep lease, timing inference, a 7-snapshot cadence test that counts Yahoo reads (7 → 1 → 2 → 3 → ownership change 3 → manual 7 → 6), D4 store/read, and a flag-off regression.
- `planningConfirmations.test.ts` (+3): verified-identity marks with one shared read, the no-goalie skip, and ambiguous identity left unmarked.
- `yahooDiet.test.ts` (+4 more): an absent or ambiguous weekly deadline (null, "1", "weekly") gives unknown with no label; a route test shows `"manual"` bypasses the settings and cadence caches while absent, `"auto"`, `"MANUAL"` or a non-string reuse them (7, 1, 7, 1, 1 reads).
- `providerRules.test.ts` (+4): inferred plus override gives the override and drops the label; inferred with no override stays inferred and labelled; explicit provider timing beats the override with a conflict; with no inference, timing stays unknown and the manager can fill it.
- RSO component (+1): the lease holder does upkeep, another tab waits, manual refreshes are marked, and the lease is released on hide.

Two defects were caught by these tests and fixed before this receipt:
1. The reverse identity lookup passed string ids to an integer column.
2. The lease was released on every refresh re-render.

## Open items (need the orchestrator or TJ)

1. ~~Manual-refresh bypass~~: done after the orchestrator granted `provider.ts`.
2. ~~D6 overridability~~: done after the orchestrator granted `providerRules.ts` and its test.
3. **Process-local caches.** On Vercel, savings depend on warm-instance reuse; a cold instance reads in full (correct, just costlier). Measure the real per-hour count in the D7 window from the `Yahoo reads this snapshot` diagnostic. A shared cache, if needed, is a later decision.
4. **Process notes.**
   - One early whole-project `npx tsc --noEmit` ran without taking the heavy lock (it found no errors in the touched files, then hit the default heap). Every later whole-project run took the lock.
   - An out-of-lease edit to `provider.ts` was reverted with `git checkout -- <file>`; that file held only this lane's edit.
5. **Migration.** Applying it needs TJ's separate approval. Scheduling the season-end purge as a pg_cron job is also separate.

## Hashes (sha256)

| File | sha256 |
|---|---|
| `web/lib/integrations/yahoo/yahooIdentity.ts` | `1019329b2ccc51a8df19ceec57b301bec9e7029b1dc6a87aad8e52931dc2f76c` |
| `web/lib/integrations/yahoo/planningCache.ts` | `012da3519715c41407f3096124c186943e428432cc1af4d546d8e3c6d03e1c95` |
| `web/lib/integrations/yahoo/rosterPlanning.ts` | `19660e49140612ac132862c33af371ec417d4b9bc0c2b854c483db4a3869898e` |
| `web/lib/integrations/yahoo/planningConfirmations.ts` | `78262e2a66d587e1243c969b4ed41c67ff542eb010b0b931bd8c224a06f0db7f` |
| `web/lib/integrations/yahoo/starterBoard.ts` | `076e75577553ebe58c279f8730a04444057ef2acb1c507e95302d543fe2874be` |
| `web/lib/rosterScheduleOptimizer/upkeepLease.ts` | `cfa5451cbc90c573b5249250bbfbd4342ad162a429ff296f7ff8d58542107892` |
| `web/lib/rosterScheduleOptimizer/providerRules.ts` | `e3774305d8f77d38966b64eda2c49c33789e9d9fd9fb66281389a77a8475cace` |
| `web/pages/api/v1/roster-schedule-optimizer/provider.ts` | `b4bcb961b9ae1f8bd27383b1f3bdf6f155b89ee643bd69f1c10fa02bfc5602b2` |
| `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx` | `10987845ebc8ca756c0cc466818ca2bda58c55e6540da7220b0fddda08c5a83c` |
| `web/lib/integrations/yahoo/yahooDiet.test.ts` | `a8c9fc809d05f617644bb24ae9d4c8b498b56d0aad7bc564a2a0acfa5c8eece7` |
| `web/lib/integrations/yahoo/planningConfirmations.test.ts` | `f3f602a0c5aa4808efc8e80f407448fd9ac69c892c49e9fdf8debebe619c1493` |
| `web/lib/rosterScheduleOptimizer/providerRules.test.ts` | `9f455696eb2ee57292c6a975f389f814e4ff1d9822633de594c53efffbaa34a6` |
| `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx` | `049324dd4a0354c0d1471ee7ec47ed437eead9b333d1253298570bcb6a8cb9e3` |
| `supabase/migrations/20261026200000_rso_yahoo_past_lineups.sql` | `bec40282d7b923960d859160ebf079c848d19a8ab860968361ef936b650c1603` |

Leased but unchanged (they match their lease baselines):

| File | sha256 |
|---|---|
| `web/lib/integrations/yahoo/rosterPlanning.test.ts` | `32deab9f0c1757623ad06db2ed348eb9a6fb1613cdec1bca4d2463da5de35410` |
| `web/lib/integrations/yahoo/providerClient.ts` | `8b9285f9f0803c85256d5e31db09f503582befff646e30c8798b06efe6636f67` |
| `web/lib/rosterScheduleOptimizer/dailyAcceptance.yahoo.test.ts` | `207007ae2c721d3c08fd276e39ed50cd2c480e94e2815a9a4914fd1189ba1886` |

Baselines for the edited leased files are in CLAUDE-LEASES.json (lane RSO-YAHOO-DIET-P2). RosterScheduleOptimizer.tsx and its test already carried earlier lanes' uncommitted edits at that baseline.
