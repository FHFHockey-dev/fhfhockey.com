# BEAST repair inventory for November 10

Status: preparation only. No production queries, writes, refreshes, deployment, push or commit were performed by this review. The latest instruction defers surgical repairs until tomorrow, after Claude is idle. Revalidate this November 9 evidence before acting.

## 1. Reconcile one missing NST player/game

- Exact identity: player `8479372`, game `2026020267`, date `2026-11-07`, season `20262027`.
- Audit found WGO participation (797 seconds total, 666 EV, 131 SH) but missing NST ALL/ES/5v5 datasets. All four 5v5 tables lack this player/date; 12 datasets across the three families were reported missing.
- First action: NST owner resolves source player identity and checks the exact game/source response. Repair only the missing verified source records. Do not manufacture zeros, guess an identity mapping, or use a broad source refresh as a substitute for diagnosis.
- Existing NST endpoint `overwrite=no` does **not** protect existing rows: it still upserts conflicts. A date/group refresh can rewrite other players. Any execution must have an exact source/table/identity scope and respect the shared NST request budget.
- Verify correct canonical player/game/date/season, complete nonnegative 5v5 numerators, positive TOI in seconds, and no duplicate identities. The local NST parser explicitly converts MM:SS or decimal minutes to seconds.
- Owner: existing NST source lane, coordinated by the release lead. Not executed.

## 2. Fill verified November 7 rolling gaps

- Audit snapshot: 432 WGO played skaters across 12 games versus 106 rolling players per strength, a deficit of 326. Exact allowlist is `rolling-gap-manifest.json` in this directory.
- The exported 326 identities were identified against ALL strength. Equal counts in 5v5/EV/PP/PK do not independently establish identical missing-player sets. Recheck each intended strength's exact keys before repairing it.
- First BEAST release scope: `rolling_player_game_metrics` and its `rolling_player_metric_support_payloads` companion, season `20262027`, date `2026-11-07`, strength `5v5`, only keys still absent from the verified allowlist. Existing rows are out of scope. Other strengths require their own reviewed missing-key/input manifest.
- 325 of the 326 candidates have rows in all four 5v5 NST tables. This proves row presence only. Earlier joins were player/date based; exact season, non-NULL fields, TOI and historical completeness still need verification. The remaining candidate is item 1.
- Preparation runner: `web/scripts/beast/prepareRollingGapRepair.ts`. It uses the existing rolling writer in `dryRunUpsert=true`, exactly one date/strength/player at a time, max 25 allowlisted players per batch and 220 seconds per batch. Start with one player. It captures hashed ranking/support payloads, not production writes.
- Before deriving, it rejects any existing primary or support key and validates WGO/game/season identity plus current NST 5v5 counts and TOI. After deriving, it checks exact output identities, six season BEAST component numerator/denominator pairs, clean diagnostics, unchanged input evidence and still-absent output keys. No write mode is implemented.
- The rolling writer reads historical games to build valid season/career windows, even for a one-day write scope. Its deadline is cooperative, not a strict query-count cap. It rewrites whole rows including TOI/support fields; there is no metric-family-only production option.
- TOI rebuild completion was corroborated in retained results. This clears that specific unfinished-rebuild concern, not general concurrent-writer safety. Confirm Claude and other relevant writers are idle and database connectivity is healthy before a controlled dry run. The serial audit stopped new reads after a connection timeout.
- Proposed eventual write: reviewed insert-only transaction for exact missing primary/support keys, with conflict refusal and rollback on either-table failure. No blanket delete, truncate, overwrite, unbounded recompute or pipeline-wide fan-out. The existing two-table upsert helper is **not** an atomic insert-only repair executor; prepare/review that narrow transaction separately before use.
- Verify zero missing expected 5v5 keys, unchanged pre-existing rows, one matching support row per newly inserted primary key, plausible GP/TOI, primary-source reconstruction for representative players, and complete six-component values or explicit genuine unavailable reasons. Read back uncertain outcomes before retrying.
- Owner: release lead appoints one serial data-repair executor after source owner handoff. Not executed; live payload preparation is also not run.

## 3. Publish the corrected BEAST cohort

- Local v2 fixes preserve formula weights and thresholds while fixing missing-component reweighting, threshold rounding promotion, mixed cohorts/snapshots, incorrect percentiles and partial publication.
- Independent review found that the 200-game/30-date interactive loader could omit long-idle season participants. The implementation owner fixed publication to load all latest regular-season WGO identities and their exact rolling rows. It no longer borrows the interactive fallback population. Wide queries use 50 exact identities per batch with a URI-size regression test. Interactive serving remains unchanged.
- After items 1–2 and any later completed-game gaps are reconciled, choose an explicit completed-game cutoff. Prepare one exact release SHA containing accepted code; preserve unrelated local work. Follow the required linked-project build inventory before deployment.
- One intentional candidate dry run: `/api/v1/db/update-skater-composite-ratings?season=20262027&as_of_date=<verified-cutoff>&window=season&strength=5v5&position=all&deployment=all&min_gp=1&min_toi=300&limit=1000&dryRun=true`.
- This endpoint writes audit records even when dry-running, and the new population loader has not had live performance acceptance. Require verified source coverage, complete cohort, no truncation and ready publication. Inspect null reasons and tier counts.
- Capture existing exact composite keys for rollback, then one intentional publish for that cohort. Verify v2 provenance, counts, arithmetic/tier samples and the BEAST UI. Publication is one bulk upsert of at most 1000 rows; it does not delete other cohorts. Do not blindly repeat an uncertain network result.
- Owner: release integrator plus serial data-repair executor. Deployment/publish remain pending, not performed.

## 4. Prevent recurrence

- Diagnose why only 106 of 432 November 7 players were produced. Existing failed NST acknowledgements and one continued rolling receipt are evidence to investigate, not proof of the exact root cause.
- The direct rolling route computes freshness HTTP 422 **after** running the writer; rows may already exist. Never treat that status as proof that nothing was written.
- Track expected player/game identities and actual outputs, resume only missing identities, and verify complete inputs/rolling coverage before composite refresh. Do not use a global maximum timestamp as freshness evidence.
- There is no scheduled composite refresh in the current inventory. After the first accepted live cohort, design a bounded post-ingestion/post-rolling-success publication dependency with one owner, exact cutoff, receipt, budgets and stop-on-error behavior. Do not add an independent timer racing upstream jobs.

## Preparation verification and evidence

- Original BEAST six-file regression independently passed 88 tests. The implementation owner's updated full-cohort regression reports 92 passed; its current loader changes were reviewed independently.
- New preparation runner: 22 fixture tests and scoped lint passed. It exposes no production write dependency or CLI write mode. Final full repository TypeScript verification passed.
- Manifest has 326 unique player IDs and 12 game IDs. Derived from audit's exact message data; compact pair-array SHA256 `0583185408e068d574a731a6ef4920b5d48748ae74372198838150362ac2f013` independently matched.
- Original audit export identity: `libfile_d1718a1431008191bf6fc14595da7a8b`, version 0, SHA256 `b158ff9605675716d15e947a46319b916a01489a7ec5937b0846f3e15d4de977`. The local manifest is a derived operational file, not a replacement for that original item.

Preparation command, to use tomorrow only after owner/health checks, from `web/`:

```sh
NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/beast/prepareRollingGapRepair.ts --manifest ../tasks/artifacts/beast-integrity-2026-11-09/rolling-gap-manifest.json --offset 0 --count 1 --out ../tasks/artifacts/beast-integrity-2026-11-09/prepare-first-player.json
```

A `readyForReview=true` file is evidence for review, not permission or proof that publishing is safe. Do not launch all batches in parallel.
