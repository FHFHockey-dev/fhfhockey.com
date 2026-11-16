# Derived-build and WiGO writer routes

Two scope files, 1,822 lines, fully read at `89da739cb45d7d572ed59bfa0b209c79c5d99299`. Inventory and hashes are in the sibling TSV/manifest. `pages2-probe.cjs` runs exact AST helper bodies and the frozen handlers inside an isolated VM: every database, transport, provider, lifecycle and auth dependency is replaced by an inert finite double. No route is invoked over HTTP, and no real writes occur. Initial probe failed because a host-realm synthetic Error did not satisfy the VM's `instanceof Error`; sharing the Error constructor corrected that test harness mismatch. All counterexamples then passed. No supplied Vitest suite ran.

## AFULL-DEROUTE1-01 — P1: explicit single-game rebuild reports success when the game was skipped

- Location/claim: `web/pages/api/v1/db/build-projection-derived-v2.ts:436–445,477–488,535–568`; a requested exact game's rebuild should not claim successful completion without a verified output.
- Evidence/scenario: explicit game2026020065/date2026-10-08 exists in the synthetic schedule, but its manifest helper throws the recognized unavailable-manifest error. Exact handler returns HTTP200, `success:true`, `gamesVerified:0`, `nextStartDate:null`, and one skipped game. No preparation or persistence function is called.
- Cause: the per-date skip policy, useful for a scheduled multi-game slate, also applies to an explicit required game; skipped games do not affect success or the resume cursor.
- Suggested fix: treat an unavailable manifest for `gameId` as incomplete/failed with a resumable result, while retaining explicitly reported skips for normal multi-game processing. Pin exact-game missing-input and whole-slate partial cases.
- Readers/tests: bounded rebuild operators/production runners and rolling pipeline consumers. Existing route tests prove an absent schedule game fails and successful receipts count rows; they do not cover a present but manifest-unavailable exact game. No production receipt is declared wrong solely from this fixture.

## AFULL-WIGOW1-01 — P1: seasonal PP share uses GP-weighted ratios, unlike the window's PP-exposure definition

- Location/claim: `web/pages/api/v1/db/calculate-wigo-stats.ts:657–666` versus recent-window `:822–831,880–887`; rule26 and decision71/L4b require pooled player/team PP time over a common population.
- Evidence/scenario: exact `writePeriod` with two10-GP seasons, player PP seconds50/90 and provider shares0.5/0.1 returns `ca_pp_pct=0.3`. If those source shares represent the respective clock ratios, team exposures are100/900 and the pooled result is140/1000=0.14. Equal GP does not imply equal PP exposure. If the provider field instead means an average of game shares, the true pooled share cannot be recovered from this field and GP; the output still needs a distinct definition and label.
- Suggested fix: use qualified matched team/player clock totals; otherwise withhold or explicitly identify a provider average. Do not promote provider values to observed share. Add unequal-exposure season fixtures and compare seasonal/recent definitions.
- Readers/tests: `wigo_career` → WiGO PP% metadata/fraction adapter. Current reader qualification gates remain applicable, and no live observed-share display is asserted. The supplied seasonal test expects a GP-weighted mean, so it pins this inconsistent definition rather than disproving it. Earlier fixed recent pooling remains intact.

## AFULL-WIGOW1-02 — P1: missing WGO time permits unmatched NST exposure for WGO rates

- Location/claim: same writer `:511–515,559–584,628–643,648–652,737–738`; numerator and exposure must cover the same games.
- Evidence/scenario: WGO reports10 points/10 GP but no TOI; NST covers5 games/50 minutes. Aggregation retains NST minutes but WGO overrides the shared GP with10. Exact `writePeriod` accepts those50 minutes for all10 WGO points, yielding12 points/60 and5-minute ATOI. It cannot establish the10-game exposure; the mixed rate should be unavailable. The probe evaluates the resulting aggregate shape; the source aggregation visibly discards individual-NST GP as an independent coverage field.
- Suggested fix: retain source-specific GP/support and require matched games before a fallback, or keep WGO rates unknown when its exposure is missing. ATOI must use the GP corresponding to its actual minutes. Add seasonal mismatched-exposure and correctly matched fallback controls; existing IPP GP matching does not protect these rates.
- Readers/tests: WiGO seasonal/career count rates and ATOI; existing tests verify known WGO seconds and unmatched IPP, not this missing-WGO-time path. No actual production row was read.

## AFULL-WIGOW1-03 — P1: equal-GP source rows make seasonal output depend on read order

- Location/claim: same writer `:536–552`; deterministic season selection must not depend on unspecified database order.
- Evidence/scenario: two same-season NST rows both GP5, ixG1 and ixG3. Exact `onePerSeason` returns1 in forward order and3 after reversal. The seasonal SELECT has no stable revision/freshness tie-break and does not select that metadata; only strictly greater GP replaces the first row.
- Suggested fix: define authoritative cumulative-row selection using identity/freshness, or reject ambiguous differing ties. Do not use a lexicographic arbitrary value choice. Pin equal-GP different-count rows and trade aliases, in addition to the existing higher-GP fixture.
- Readers/tests: all NST seasonal WiGO values; highest-GP unequal-row test passes but does not cover ties. Different returned values are reproduced locally; actual tie frequency remains unknown.

## AFULL-WIGOW1-04 — P1: budget-limited runs repeatedly start at the first player

- Location/claim: same writer `:180–221,285–289,1194–1209`; bounds and stop rules must have a usable resume path.
- Evidence/scenario: two synthetic active IDs1,2; processing player1 consumes201 seconds against the200-second budget. Two isolated handler evaluations both return207, processed1 and first-not-reached2; both flush only ID1's career/recent rows. Supplying `resumeFromPlayerId=2` has no effect because the handler reads no cursor parameter. Time is synthetic; no actual long wait or database write occurred.
- Suggested fix: add a bounded, validated resume cursor/persisted progress with explicit scope and completeness semantics, or a fair rotating queue. Keep partial-run failure visible and preserve successful writes. Pin repeated runs making progress and completion without skipping IDs.
- Readers/tests: nightly `wigo_career`/`wigo_recent` freshness. Reducing the candidate pool mitigates runtime but does not guarantee progress under slow dependencies. Existing budget test confirms accounting/flush, not subsequent continuation. Production starvation is not asserted without a receipt.

## Other reviewed behavior and retained limits

- Derived route573 lines: GET/POST admin/audit/off-season wrappers; query/body parsing; default oldest-ready queue capped3 dates; explicit range/chunk/resume handling; per-game input manifest → player → team → goalie → version-checked atomic persistence; dependent stages do not run after failure; receipt counters separate verified/logical/idempotent rows; explicit no-observed-goalie warning; failure retains its date and stages are classified. Source atomicity remains delegated to the already-audited persistence/RPC. No new database atomicity proof here.
- The derived runtime budget is checked between dates/games, not an abort deadline inside a game. `bypassMaxDuration` is an explicit admin option, and manual dates/chunks are not an approved production plan by themselves. Queue loading scans all complete-input status pages before selecting3 dates; no hosted query-cost qualification. Invalid/reversed date ranges can produce empty success; record as a validation gap rather than inventing actual wrong writes.
- WiGO1249 lines: active current/last-season candidate paging ordered player/season; per-player3 seasonal queries,20 appearance limit, regular-season ID/season consistency rejection, exact season/date NST matching; source errors throw; rejected frame withholds all player writes. Last20 appearance checks remain an alarm for unexpected game types rather than a data repair. It does not consult `games.game_state` directly; upstream row-finality remains a qualification boundary.
- Per-metric recent finite/coverage checks null incomplete count/rate families after aggregation; zero denominators remain null; WGO seconds and NST seasonal minutes are distinguished; recent PP share pools reconstructed exposure only when every share is positive/known; zero share cannot reconstruct a team clock and therefore remains unavailable. This is a provider proxy, not the new qualified PP store.
- Seasonal count means use one row per season, career excludes current season and3YA uses three prior start years; missing source families stay null. IPP explicitly requires equal WGO/on-ice GP, a weaker condition than verified same-game identity; no new claim of same-game proof. Negative/nonfinite seasonal inputs are not comprehensively validated; schema/source validation remains relevant.
- Batch200 writes are two independent upserts. The route reports each failed table and successful row counts, but cross-table atomicity is absent by design/source; supplied tests explicitly allow one table to succeed. Do not infer a coherent combined snapshot from a partial run. Pending in-memory batches can be lost on an earlier query exception; route fails instead of falsely counting them as committed. Timestamps are write time, not independently verified source freshness.

L4b's earlier recent-pooling/null/IPP fixes were rechecked, not reopened without new evidence. This batch adds only local audit artifacts and ledger entries. No fixes, migrations, providers, database queries, live pages or Claude changes.
