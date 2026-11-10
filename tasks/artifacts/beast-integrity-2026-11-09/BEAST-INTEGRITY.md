# BEAST/MCM integrity review and implementation

## Status

Local implementation is complete for the verified integrity defects below. Production is **not yet accuracy accepted or updated by this task**. No production database writes, migrations, refreshes, app requests, deployments, cron changes, pushes or commits were performed by this worker. The database audit owns live read/repair coordination. Existing published rows remain `contextual_composites_v1`; the local writer emits `contextual_composites_v2`.

Canonical checkout: `/Users/tim/Code/fhfhockey.com`, `octoberBranch`; starting HEAD `2797f114b996d950139c902008f68cf28763394a`. Existing UI/styling and other lane changes were preserved.

## Mathematical verdict

The declared score is a coherent bounded descriptive heuristic:

`0.45 * mean(top two RIFF percentiles) + 0.35 * max(scoring percentiles) + 0.20 * mean(all included percentiles)`.

RIFF = shots, hits, blocks per 60. Scoring = goals, primary assists, points per 60; PP points per 60 additionally belongs to ALL/PP source strengths. 5v5/EV/PK use the fixed six-component variant. Choosing the universe by strength implements the existing “PP where PP-capable” intent without silently dropping missing player inputs or mixing strengths.

For valid inputs, weights are nonnegative and sum to one, so scores lie in [0,100]. The function is coordinate-wise nondecreasing and symmetric within its RIFF and scoring groups. Gate order is BEAST+, BEAST, MCM, Watch. Gate comparisons now use the unrounded score; two-decimal display rounding can no longer promote a player just below 70, 80 or 88.

The current runtime percentile convention is **strictly worse qualified peers / (qualified peers - 1)**, times 100, rounded to three decimals. This is a valid strict-peer convention, not a tie-midrank convention: all-equal groups receive zero. Singletons currently receive 100 in the shared ranking calculator; the composite writer now requires at least three qualified peers before using a component. The independent publication check reconstructs percentiles and peer counts from each complete raw metric population, rather than accepting plausible in-range numbers on faith.

The score is **not itself a percentile**, an isolated NHL talent measure, or a calibrated forecast. Goals/primary assists/points/PP points overlap. Four flags do not prove four independent fantasy categories. Selecting the maximum scoring signal intentionally rewards one scoring strength, and rates do not guarantee high counting-stat volume. Rink/scorekeeper effects, tiny GP/TOI samples, role context and league-specific category weights remain relevant. Existing 45/35/20 weights and tier thresholds were preserved; no retrospective threshold fitting or unverified claim of predictive validity was introduced.

## Verified production evidence supplied by the serial database audit

Current season 20262027, latest composite snapshot 2026-11-07:

- 732 rows, only season/window_size=0, 5v5, all_skaters, v1.
- 731 non-null MCM scores. Tiers: 2 BEAST+, 30 BEAST, 48 MCM, 68 Watch, 584 no tier.
- Composite timestamps are 2026-11-09 02:59:24–29 UTC. That freshness is misleading as proof of input freshness: Nov 7 still has only 106 rolling players per strength versus 432 WGO-observed played skaters, leaving 326 without that day's rolling row.
- In the audit's bounded latest-per-player rolling sample, 753 5v5 rows all lack PP numerator/denominator. ALL has usable PP rates for 675 and zero/invalid PP denominators for 78. This supports structural strength selection, not imputing missing PP to zero.
- Latest 5v5 six ordinary numerators are null for players 8473419 (Oct 6) and 8477018 (Nov 7). The latter is the sole null composite MCM row. These are not assumed to be genuine zero performance.
- Audit independently reconstructed two persisted scores from their exported component percentiles: player 8477446 = 90.9507833333 -> 90.95 / BEAST+; player 8471215 = 61.5823333333 -> 61.58 / no tier. All flags matched. Both use six components, despite old JSON listing PP among live components. This validates those stored arithmetic results, **not primary-source rates, population completeness or freshness**.
- The defective legacy NST percentile views are not a direct source of the BEAST writer. Its lineage is rolling_player_game_metrics -> runtime contextual percentiles -> composite writer. Legacy percentile repair remains separately necessary for other consumers.

Detailed read-only evidence remains with the audit: current snapshot coverage, 5v5/ALL input coverage, two persisted samples and independent verification, and null-component occurrence files. No additional live queries were issued concurrently by this worker.

## Implemented changes

1. Explicit fixed strength-specific component sets and v2 provenance. Every required component must be finite and within [0,100]. Missing blocks or another required input now yields unavailable MCM/tier, not a reweighted higher score. PP absence in a non-PP source is explicitly structural.
2. One batched contextual source resolution for all metrics, with no per-metric output limit. The publisher now pages all season-to-cutoff WGO identities and loads each player's exact latest regular-game rolling row, including long-idle players. Those same rows are ranked directly without the interactive loader's 200-game/30-date fallback or cache. Output limiting occurs only after joining the full population. Truncated cohorts cannot publish. Interactive serving behavior is unchanged and its recent-date population limit remains separate follow-up work.
3. Global and per-player snapshot consistency, sample qualification, minimum peer count, peer identity, duplicate-ID and independently reconstructed percentile checks. No clamping invalid source percentiles into plausible scores.
4. Lightweight per-player source date/update provenance is passed through rankingQueries/rankingTypes and persisted with each composite.
5. A bounded WGO-to-rolling coverage gate checks latest observed regular-season appearances, not a global maximum timestamp. It catches players missing entirely, outdated actual source versions, omitted unfiltered population members, missing identities, duplicates, read errors and exhausted budgets. It respects an explicit cutoff, season and strength and does not require injured/idle players to have played on the league's newest date.
6. Publisher blocks combined-filter and custom-sample variants whose identity is not represented in the durable uniqueness key. These remain possible dry-run analyses, but cannot overwrite a different population's published row.
7. Route returns HTTP 409 before any write if publication checks fail. Default remains dry run. A valid cohort is written in one bounded bulk upsert (maximum 1000 rows), rather than separate 250-row writes that could expose a partially updated cohort.

Coverage-check resource bounds: key-only WGO pages of 1000, maximum 60,000 rows / 60 queries; exact rolling player/date reads in batches of 50 identities (wide values only for their latest appearance), maximum 40 queries; sequential reads and a 60-second total abort deadline. These are explicit upper bounds, not measured production costs. Existing metadata/result-luck reads are additional; the separate recent-date rolling scan is bypassed for publication. A regression checks the wide select plus exact-identity filters fit below common 8 KiB request-URI limits. No live performance acceptance of this new gate has been run. A cutoff freezes the requested game window, not the database; if ingestion changes a source version during verification, fail and retry only after the ingestion pass settles.

## Verification

- Final focused regression run: **92 tests passed across six files** (writer, source coverage, ranking queries, route, methodology, ranking calculator). Fixture-only; no production database connection.
- Includes fixed component sets, all score gates, invalid/missing inputs, score bounds and monotonicity, two audit arithmetic samples, same-snapshot peer mismatches, individually stale sources, cache version mismatch, output truncation, raw-population percentile verification, >1000 source pagination, empty/error/duplicate sources, complete-population omissions, long-idle population loading, more than 40 distinct latest-appearance dates, bounded query URI size and one-statement/no-retry publishing.
- Final touched-file ESLint: **passed**.
- Initial v2 repository `npm run typecheck`: **passed**. After the reviewed cohort-loader repair, the full checkout reports one error in concurrently added, non-owned `web/scripts/beast/prepareRollingGapRepair.ts:251` (TS2352, `GenericStringError[]` cast to `Row[]`). No type errors were reported in the BEAST/loader files; the script owner has been notified.
- `git diff --check` passed.
- No full unit suite, build, browser run, hosted dry run, deployment, database publish or cron execution was performed. Focused checks are not a full production acceptance.

## Exact release path and remaining blockers

1. Audit owner finishes and verifies the bounded rolling-input repair, including the 326 Nov 7 played-player gaps and any underlying source gaps. Do not simply republish composites over stale rolling data. Do not convert missing required values into zeros.
2. Integrator reviews these local files and creates one exact release candidate SHA with the accepted Rankings changes. Follow repository Vercel project/build inventory and current-task deployment approval requirements. No deployment authority is implied by this report.
3. After upstream repair and ingestion settlement, authorize **one** bounded candidate dry run for the first supported slice:
   `/api/v1/db/update-skater-composite-ratings?season=20262027&as_of_date=YYYY-MM-DD&window=season&strength=5v5&position=all&deployment=all&min_gp=1&min_toi=300&limit=1000&dryRun=true`
   Choose the verified completed-game cutoff, not a stale assumed date. Require sourceCoverage.verified=true, publication.ready=true, no truncation, plausible complete cohort counts, and inspect null reasons and tier counts. This endpoint still incurs audit writes via its wrapper even in dry-run mode; it is not a generic read-only QA endpoint.
4. With approval for that exact cohort, save its existing rows as a rollback artifact, then perform one `dryRun=false` publish. Read back row counts, v2 methodology, source provenance, score/tier arithmetic and expected matrix cells. A network failure has uncertain write outcome: check before retry. The upsert overwrites the same unique keys and does not delete other cohorts or snapshots. Rollback is a separately approved restoration of captured rows, not blanket deletion.
5. Expand to ALL strength and rolling windows only after their required input/sample eligibility is accepted. PP variants require real PP TOI; zero PP TOI must not become a fake scoring percentile. Position/deployment/team variants and combined filters must not be silently substituted for all-skaters peers.
6. Reliable ongoing operation needs an explicitly approved post-ingestion/post-rolling-success publication dependency. Repository inventory has no scheduled composite refresh. Prepare one scope-limited job only after the above live gate, with cutoff, windows, strengths, peers, row/time budgets, audit receipt and stop-on-failure behavior. No schedule was installed in this task.

Remaining accuracy boundary: WGO is the observed participation reference, not independent proof that all official NHL participation or every historical input is present. Direct input-rate reconstruction against primary sources and out-of-sample fantasy calibration remain separate acceptance work. The publisher uses the exact latest regular-game rolling rows it loaded, not an independently cached recent-date cohort. This does not prove those underlying cumulative rates are intrinsically correct. Audit is separately checking game-type accumulation; preseason contamination was not established by this task.
