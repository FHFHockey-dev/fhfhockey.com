# Daily paired Rankings reader proof

Branch `octoberBranch`, base `57a90dfa7`, with the local changes described below. The November 14 packet records the last deployed 775-skater pair and 23 Edmonton rows. This replay uses fictional skaters and a fail-closed in-memory database. The current production cutoff and cron execution remain unverified. [Historical receipt](../../rankings-acceptance-2026-11-14/first-marked-publish/PACKET.md)

## Replay

The real Rankings and composite builders read WGO appearances, exact player/date rolling rows and rolling window support. Both builds run with November 18 as the upper bound. The first set of inputs ends November 14 (A). A November 16 game (B) adds player 4 and changes player 1's inputs. Both writers independently derive November 16. Each Rankings window carries the full default metric set. Both matrix requests use the page URL builder, team resolver, normal cache expiry, durable reader and real composite join. Fetch is blocked throughout.

| Fixture state | Default matrix | EDM matrix |
| --- | --- | --- |
| Complete A | Nov 14, IDs 1/2/3 | Nov 14, IDs 1/3 |
| B retry leaves an extra goals-per-60 ID in last-20 | A, last-20 stays writing | A |
| B Rankings last-20 marker writing | A | A |
| Four complete B Rankings, composite substitutes ID 44 for 4 | A, composite write refused | A |
| Four complete B Rankings, composite upsert fails after writing its marker | A | A |
| B season composite upsert leaves a fifth stored ID | A, composite stays writing | A |
| Complete B composites, B last-20 marker writing | A | A |
| Complete B markers, B last-20 certifies a different population count | A | A |
| All five complete at B with the expected cohort | Nov 16, IDs 1/2/3/4 | Nov 16, IDs 1/3 |
| B Rankings republished later at the same cutoff | A until B composites publish again | A until B composites publish again |

Every read asserts durable Rankings source, each displayed skater's points cutoff, composite cutoff and MCM value. A has MCM scores of 0, 50 and 100 by ascending player ID. B has 100, 0, 33.33 and 66.67. Edmonton sees the same league composite values for its two players. The test advances the fixture clock by 31 seconds between reads.

## Publication checks and limits

- The marked 5v5 Rankings publisher compares each default metric's player IDs to the verified WGO/rolling source population in every marked window and rejects cross-window date differences before any write. It also requires exactly one row for each source skater and each default metric, then counts persisted rows under the same metric set and window key after each successful upsert. An extra row in any included metric keeps the window writing.
- The default all-skater 5v5 season composite publisher verifies four matching Rankings markers and checks the persisted points-per-60 player IDs in each window against its own candidate IDs. Each of the four sequential ID queries requests an exact database count and returns at most the candidate size (1,000 maximum). A truncated page, extra persisted IDs or a same-sized substitution blocks the write. A final count of stored rows at the actual composite key checks that a retry left no stale extra players. A cohort of 1,001 fails before marker or ID reads. Other strengths and non-season composite writes retain their original single-window prerequisite. Scoped composites retain their unmarked path.
- The reader requires all five marked surfaces to match on cutoff and skater count. It checks each marker's sample floors and database-confirmed counts. A Rankings rewrite completed after the composite validation began requires another composite publication. Team and other derivable 5v5 pools use that marked all-skater publication.
- A successful default refresh adds four exact count-only Rankings reads and one exact count-only composite read after upserts. Relative to the prior writers this is twelve extra database reads including the seven extra composite preflight reads. The five count-only reads return zero data rows.
- Marker rows carry counts and timestamps. Exact ID agreement depends on controlled writers, unique row keys, exact affected-row counts and serialized publication. Markers alone cannot attest direct edits or historical publications by older writers. Cache expiry and the partial-publication transition were exercised in one process with a fixture clock.
- The reader fetches up to 200 recent markers and the marker-era start. If the page fills and yields no usable marked date, one scalar database lookup through its oldest date (inclusive) can recover an older complete 5v5 pair. Concurrent metrics share that lookup for the lifetime of the cached page. Each metric still checks that its own rows exist on the returned date. With 41 newer partial dates, both points and goals returned the October 1 accepted date from one fallback RPC. The test supplies the scalar RPC response. Hosted query timing and cross-instance cache behavior remain unmeasured.
- After the two writers finish, the dispatcher calls `latest_ranking_publication_cutoff` to confirm the five complete markers resolve to the target date. This scalar result contains no player IDs. Canary closeout separately requires a counted physical ID comparison against the approved source cohort for every metric and window and the season composites, followed by the default and Edmonton reads after normal cache expiry. A page of displayed players verifies its joins only for those players. These production checks remain pending. [Canary closeout](RECEIPT.md) · [800-skater physical row and ID checks on the local fixture](cost-receipt.md)

## Verification

The targeted offline run passed 133 tests across seven files, including both API writer handlers. The four-test acceptance file passed again after adding normal cache expiry and a count-mismatch case. ESLint passed on the nine changed TypeScript files. The stale-row retry initially returned complete with an extra non-points ID. Both physical-count checks and A retention then passed in a focused rerun of 87 tests across five files. The final integrated web typecheck passed.

The final isolated review ran the commands below from `web/`. All 125 tests across the five named files passed, and ESLint passed for both reader files. Before sharing the fallback, the two-metric regression observed two identical RPCs. After the change it observed one.

```sh
npm test -- lib/rankings/entityMetricRankingReader.test.ts lib/rankings/__acceptance__/chef-live-findings.acceptance.test.ts lib/rankings/entityMetricRankingWriter.test.ts lib/rankings/skaterCompositeWriter.test.ts lib/rankings/dailyRankingPair.test.ts
./node_modules/.bin/eslint lib/rankings/entityMetricRankingReader.ts lib/rankings/entityMetricRankingReader.test.ts
```

## Scheduled pair preparation

The scheduled path loads verified WGO, latest rolling rows and support revisions once, with the Results Luck rolling fields included. It resolves player and team metadata once, then builds both outputs in memory. It compares the loaded player/game/date identities, rolling revisions and support revisions to the readiness receipt. All four windows and the season composite build must agree on the cutoff and expected IDs before the first publication marker is written.

The offline daily integration suite passed 10 tests. For three skaters it issued five preparation reads through the injected client, one each for WGO, rolling, support, players and teams. Its 204 Rankings rows and three composite rows matched the manual builds field for field, including Results Luck provenance for skaters whose latest game was before the cutoff. A missing source table, changed revision, missing player, unavailable metric or unscored composite build stopped before any publication write. When the second Rankings write failed or returned a short count, the first window remained complete, the other three remained writing, and composites received zero writes. A short season composite upsert was the final database operation and left its marker writing. The final two-file run passed 57 tests including the manual composite writer suite. Manual chunk splitting remains available. Scheduled writes use 100-row chunks with immediate failure, capped at 68,000 Rankings rows and 1,000 composite rows. The dispatcher's transport supplies the shared deadline and request cap.
