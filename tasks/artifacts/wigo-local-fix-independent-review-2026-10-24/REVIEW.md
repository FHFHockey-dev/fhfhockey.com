# WiGO local-fix independent review — 2026-10-24

**ACCEPT WITH LIMITS** for the exact four-file local candidate below. No new defect was found in the requested boundary. **75/75 offline tests passed** (58 owner cases and 17 independent controls); scoped ESLint passed. All **46 recorded source, dependency, protected and evidence pins** remained unchanged. All eight baseline/candidate copies also match their supplied hashes. This accepts the local fixes for parent consideration; it does not establish a repaired production aggregate or authorize execution/deployment.

## Exact candidate

| Canonical file | Accepted candidate SHA-256 |
| --- | --- |
| `web/pages/api/v1/db/calculate-wigo-stats.ts` | `f438eb129e1f70dd0691151916e78a8ea2225412ec63847ce93e334bc9ee9fa6` |
| `web/utils/fetchWigoPlayerStats.ts` | `7a253deedaa1c30593e944afbd84679087df235dd7fa16204810f2379b60414f` |
| `web/__tests__/pages/api/v1/db/calculate-wigo-stats.test.ts` | `a065e5ea2a93f2fc93efd93ae90a6e2c72b733566e74597135ef94010815c198` |
| `web/utils/fetchWigoPlayerStats.test.ts` | `ed73a729821cac9579c5bcb877988c048496d7b3e39b6bec6ee6c63fc06d24e1` |

The four canonical files equal the frozen `local-fix/candidate/` files. A fresh unified diff against `local-fix/baseline/` exactly equals `WIGO-DATA-FIX.patch`, SHA-256 **`a63ef5a4e6dde4ee1255661a612f01b79a4e4306c5822f8d4fe078f89fbb394e`**. It changes only these four files. Before hashes, protected inputs and retained diagnostic/log pins are in [PINS.start.json](PINS.start.json); final comparison is [PINS.end.json](PINS.end.json). No Git inspection or mutation was used.

## Verified behavior

- The NHL frame filters `games_played=1` before ordering and limiting to 20. The independent control with 21 newer scratches and five valid appearances still produces GP=5. Zero shots/goals and zero NST numerators stay valid zeros when exposure exists.
- Unique safe-integer regular-season game IDs must agree with a consecutive-year season ID. Owner cases cover missing/duplicate/playoff/mismatched identities; additional controls reject a string ID, fractional ID, malformed consecutive-year season and negative season before publication.
- NST reads now use the selected NHL seasons and dates with no independent latest-20 limit. The join still uses the exact **season/date pair**. Independent wrong-season Cartesian matches and another player's poisonous values cannot supply the selected frame's TOI/ratios. Input arrays/rows are frozen and unchanged after execution.
- Owner Kucherov-shaped controls pass with seven intervening NST postseason-shaped dates, both with and without October 5. L5 remains supported; an absent October 5 keeps L10/L20 dependent metrics null while NHL counts remain available. The independent null/absent ixG control leaves supported ATOI, SOG and on-ice inputs intact; observed ixG=0 remains 0.
- All six source result errors stop the affected player before output batching. In addition to owner's null-data error cases, six independent **data plus error** cases and a rejected NST promise return 500 with no captured writes. These are synthetic first-player failures; no transactional rollback of earlier published batches is claimed.
- Recent rate values and support come from `wigo_recent`. A frozen reader input with throwing accessors on legacy recent-rate keys confirms those keys are never read. Recent points and zero goals/PP rates survive, while historical LY/STD legacy precedence remains. Missing recent snapshots and infinite recent rates cannot be revived by finite legacy values. Reader inputs remain unchanged.

These observations exercise the real exported builder/reader with synthetic query transports. Independent builder controls replace auth/audit/off-season wrappers to isolate the math/data boundary; original owner route cases retain the existing admin middleware with a synthetic cron credential and mocked clients. This review makes no auth, deployed query-plan, browser or live data acceptance claim.

## Exact checks and retained failures

Node **v22.11.0**, npm **10.9.0**, Vitest **3.2.7**; working directory `web/`. No `GIT_DIR`. Both checks acquired `/private/tmp/fhfh-heavy.lock` only while absent, then released their own lock. No test server or production client was created. Browser/auth imports fail closed in the reviewer harness, query clients are mocked, and `fetch` throws.

```text
npm test -- --run --config ../tasks/artifacts/wigo-local-fix-independent-review-2026-10-24/review.vitest.config.mts --maxWorkers=1 --no-file-parallelism
exit 0: 3 files, 75 passed (58 owner + 17 independent), 1.039 s command wall time

npx --no-install eslint pages/api/v1/db/calculate-wigo-stats.ts utils/fetchWigoPlayerStats.ts __tests__/pages/api/v1/db/calculate-wigo-stats.test.ts utils/fetchWigoPlayerStats.test.ts
exit 0, 1.522 s command wall time
```

[COMMANDS.json](COMMANDS.json) records argv/environment/timing; [offline-tests.log](offline-tests.log), [scoped-lint.log](scoped-lint.log), [independent-controls.test.ts](independent-controls.test.ts) and [run-checks.py](run-checks.py) permit reproduction. No independent test failed and no check was blocked.

The owner's whole-web command `NODE_OPTIONS=--max-old-space-size=8192 npx --no-install tsc --noEmit --incremental false` remains **failed**, exit 2, with Buffer/BinaryLike errors at `lib/sources/tweetLunaReview.test.ts:192` and `scripts/review-ifttt-luna.ts:22`. The same two paths/errors are reported in the earlier C4 receipt. Those files are outside this patch; this reviewer did not repeat the broad command or assert a whole-web TypeScript pass.

Original owner evidence is preserved by hash: `red-tests.log` (17 failed / 41 passed), `green-tests-1.log` (57 passed / 1 floating-point assertion failure), final 58-pass log, lint and failed TypeScript records. The intermediate `2.3999999999999995` versus `2.4` assertion was changed to approximate numeric comparison while the missing-source null assertion remains exact. The original ten-case offline results and both production diagnostic receipts are unchanged.

## Remaining production gates and limits

The retained authorized diagnosis records two sequential read-only SELECTs, 68 rows, and no third query. It supports the following distinction: Kucherov's stored L5 is null despite currently matched inputs; October 5 is absent from both current-season NST selections; six older L20 dates were displaced from the former top-20 NST selection, rather than proved absent from the underlying tables. No `wigo_rates` row existed for this player, so the legacy override fix is a separate defect and does not explain his observed nulls through that table. The diagnosis does not establish source-arrival versus compute chronology.

1. Parent must accept/integrate the candidate and separately authorize any release. Local code changes have not repaired persisted `wigo_recent` values.
2. A re-materialization needs a reviewed bounded execution path and explicit execution approval. This route still enumerates all non-goalie player IDs; it is not a single-player refresh. Earlier batches can already have committed if a later player fails. Existing upsert-error logging and broad-job behavior are unchanged; no atomic job or global no-write guarantee is accepted.
3. October 5 ingestion/backfill remains separate and unapproved. Do not manufacture its NST numerator or substitute NHL TOI under the current source contract. The six older dates do not justify a broader backfill without further authorized evidence.
4. Cross-season regular-season last-N behavior remains deliberate. This patch does not implement the new player-card season/cohort/cutoff/publication contract, fix the separate historical STD fallback, or prove population-wide compatibility with stricter identity checks. Invalid legacy identities can now stop this broad route, as disclosed by its owner.

Writes in this review are confined to this reviewer packet and its diary. No application changes, live reads/writes, refresh/backfill, credentials/configuration, browser/server, Git operations, dependencies or deployment were performed. No new workers were created. Scout retains acceptance and execution authority.
