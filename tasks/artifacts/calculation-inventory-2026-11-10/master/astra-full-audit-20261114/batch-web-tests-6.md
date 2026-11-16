# Web test source audit: batch 6

Target `89da739cb45d7d572ed59bfa0b209c79c5d99299`; worker Astra/high. All ten assigned test files read top-to-bottom from pinned Git blobs: **3,884 lines, 98 test declarations, 118 expanded literal cases, 404 additional function/method/callback nodes**. Working copies match every pinned blob. The accompanying TSV has one row per test declaration and every other function node, including mocks, fixture transformations and suite callbacks. Parameterized cases are expanded in the count, retained under their common test declaration in the TSV.

**Disposition:** test source audited; tests **not run**. No new application finding established. These are oracle and mock-boundary assessments, not independent runtime passes, production qualification, or full implementation audits of imported modules. Earlier source findings remain governed by their own reports. Source comments describing fixtures as stored/live or maths as proven are claims of the test author, not evidence newly collected here.

## 1. update-player-underlying-summaries.test.ts (1–657)

Eight test declarations / ten cases. Hoisted helpers and service-role DB calls are mocks; admin/audit wrappers bypassed (3–42). `finalityGamesChain` and main builders return fixed pages; most equality/date methods do not actually filter, while the default-type regression builder does honor type=2. `createMockApiContext` records status and payload. No provider or raw-summary computation is exercised by these source assertions.

- 201–217 uses fixed Date and real route admission to select FINAL and unknown-state older-than-eight-hours IDs, excluding LIVE and PPD. It asserts exact selected IDs, not finality metadata/fallback labels or pagination beyond one page.
- 220–250 pins one-game backfill options, count, status and response. 252–363 supplies legacy-v1 payload discovery and pins migrate=true/raw-cache-warm=false helper arguments. Despite its title, the migration/build helper is mocked; actual partition conversion and avoidance of raw rebuilding are not proved here.
- 365–394 pins explicit game refresh with migrate=false; 396–503 checks regular-season default selection, existing v2 coverage, no remaining game IDs and one warming call.
- 505–558 checks incremental window metadata, two IDs, rowsUpserted=2 and one warm. 560–635 partitions three IDs into [2,1], aggregates row count 3, emits catchUpCompleted=true and warms once. Only successful helper outcomes are supplied; partial/failure coverage is absent in this file, not a demonstrated false-success bug.
- 637–656 has three unique-key pagination cases (PBP game_id/event_id, shifts game_id/shift_id, raw payload game_id/id), asserting order calls and resulting set. One-row responses do not exercise multi-page tie boundaries or SQL ordering semantics.

## 2. update-power-play-combinations-game.test.ts (1–616)

Fifteen declarations / 21 cases. Fixture conversion helpers (`toEvents`, `toShifts`, `toRoster`, `tgs`, `game`, `teamRows`, `pptoi`, `clockOf`, `storedObjects`) preserve recorded scalar values; period/clock/shift inputs are literal fixture data (23–353), not fetched. Admin bypassed and audit options captured. The route builder and its imported arithmetic are real under this test source; DB reads/writes are injected via `storedDatabase` (472–502), whose eq/order methods do not filter or sort and whose RPC returns counts without implementing SQL.

- 363–385 asserts two available qualified clocks 297/126 seconds, exact official-reference classification, summed player PPTOI=skater_seconds, support at least 3×clock, per-player time≤clock, six-decimal PPTOI/clock share, five unit-1 skaters and goalie exclusion.
- 387–394 excludes three stale IDs and pins 26 remaining rows. Exact unchanged-row comparison is supplied later by the dry-run diff test (550–568), not solely by this test's title.
- 396–411 independently pins overtime team clock 284, skater seconds 1376, ten player totals and unit assignments; incomplete opposite-team support is unavailable/no player rows. 413–422 pins repaired 120-second clock, ten exact skater totals and 112/120=0.933333 share.
- 425–430 distinguishes verified zero as not_applicable with null skater seconds/no player rows. Seven mutations 432–458 cover official mismatch, missing official row/PBP/game-end/roster/roster player and insufficient shifts, with exact reason and empty rows. 460–463 duplicates shift rows and asserts unchanged union exposure; it tests full duplicate overlap, not every partial-overlap configuration.
- 518–547 gates writes off before reads/RPC, retains dry-run diff, and permits literal true. 550–568 spies on fetch, rejects network use, checks exact read-table set, zero writes/RPC, three stale deletions and 26 unchanged rows. 570–582 checks one named replacement RPC/version/two clock rows/26 players and returned count receipt. 584–590 checks error propagation and no row-by-row writes. **Mocked RPC cannot prove transactional rollback or database constraints**, including AFULL-SQL-04; those require the separate SQL evidence.
- 592–615 checks audit skip predicate for successful dry run versus write/failure and route dryRun forwarding. It does not write a real audit row. Env flag is set/deleted, not restored to a previously existing value; fetch spy restored only on the successful path. These are test-isolation limits, not application findings.

## 3. update-power-play-combinations.test.ts (1–600)

Twenty-three declarations / 29 cases. Per-game updater is mocked; real module exports retained, real audit wrapper imported only in audit tests with audit insert mocked. Offseason/admin wrappers are bypassed. Games query double accepts gte/lte/in/order/limit without enforcing them (66–88), so requested SQL filtering cannot be inferred from fixtures alone.

- 102–231 pins date-range and explicit-ID processing, partial failure status500 with processed1/failed1, and FUT/PRE skip status200 with processed0/skipped2. Skip success is an explicit contract here.
- 248–301 checks >cap refusal before per-game work (and before DB read for explicit IDs), at-cap success and actual async peak concurrency against exported MAX_CONCURRENT_GAMES. Limits imported from implementation mean the test would follow a changed constant; the separately literal invalid value `5` and message/title retain some independent boundary evidence.
- 303–315 sums keptUnproven 2+1=3. `summaryFor` (318–337) builds clock/player/diff structures; its `inserted` array is always empty even when its parameter is nonzero, but all supplied scenarios use inserted=0. **Inserted-count aggregation is unexercised**, not currently an observed failing test.
- 339–437 pins two-argument nightly writer calls/default concurrency/response keys; dryRun argument propagation and combined totals 2 games/4 clocks/21 players/deleted2/updated1/unchanged20; concurrency1 peak; invalid 0/5/1.5/two; and dry-run cap.
- 448–495 invokes the real audit wrapper: successful complete dry run suppresses insert, failed dry run retains failure, write retains success. Direct predicate mutations reject skipped/missing game, absent dryRun and false success. 508–563 records disabled writes as audited skip with no game reads; literal true runs, false/1/TRUE/empty keep off. 566–578 failure leaves only successful game in dry-run output; 581–599 requires IDs or date range.

No actual clock math, DB replacement, authorization enforcement or database audit durability is established by this orchestration file. Env service-role key is blanked in setup and flag later deleted; tests were not executed in this audit.

## 4. update-sko-stats.test.ts (1–464)

Sixteen declarations/cases; imports real helper exports, injected client doubles for writes/reads. No route/provider execution performed by this review.

- 17–73 checks truthy flags, empty/current snapshot date windows and continuation when any family has a full page.
- 75–144 independent diagnostics oracle deduplicates discovered IDs 3/1/1/2 to 3, missing family associations1, ageDays2 and exact write counters; aggregate preserves empty-date count1 and attempted3/upserted2/partial=true.
- 146–226 pins exact 28-column projection, identity/date/season, TOI2400, SOG/60=20×3600/2400=30 and per-game IPP null. 228–314 strips unsupported columns and asserts one write attempt per call plus rejection on schema error; SQL atomicity is outside mocked upsert.
- `ippRow`/`game` helpers drive 335–377: no per-game IPP, pooled multi-game points2/on-ice GF4→50; single-game, numerator>denominator, missing GF component, missing points and zero denominator each return null with exact reason. The test directly calls pooledSkoIpp, so it demonstrates the helper's intended oracle, not that every consuming route uses it.
- `shift`/`goal` fixtures and 403–414 pin end-inclusive/start-exclusive goal attribution, empty-shift and missing event-time unknown, and SO exclusion. 416–436 preserves report row, permits zero only from positive TOI with confirmed 0-for/0-against, and rejects nonzero/missing shifts or missing TOI. 438–462 records date/event-type filters, present-player zero/missing-player null and empty-ID short circuit. The read double records filters but returns entire tables, and has no truncation/error fixture; complete stored support/provider reconciliation is not proved.

## 5. update-stats-game-rows.test.ts (1–103)

Six declarations / twelve cases; fetchWithCache mocked, actual row builders imported. Skater factory supplies genuine observed zero values and 15-minute TOI. 31–53 verifies missing faceoffs/PP/SH TOI become null while reported total TOI stays 15:00. Five malformed/missing goalie values (60–68) become null; 70–78 preserves reported zero clock and both ratio separator forms. Team/report helpers (80–84) permit orientation checks; fetch rejection and three missing/malformed HTML cases stay unknown, while 96–102 preserves right-rail zero without fetch, selects away HTML zero and falls back from malformed home right-rail to 04:12. This pins row shaping and fallback selection, not persistence acceptance or production HTML variation.

## 6. update-team-ctpi-daily.test.ts (1–330)

Ten declarations/cases. Real materialization/calculation imported; Supabase/client/pagination/season and wrappers mocked. Builders record filter calls but return fixture tables without SQL filtering. `setGames`, `pooledFixture`, `writtenRows`, `byTeam` assemble and inspect records. Fake date fixed, resets/restores after each test.

- 144–182 pins v2 conflict identity, candidate-unapproved formula/input labels, today-only first issuance, luck null, cutoff-exclusive date, versioned reads and finite bounds (strictly 0–100).
- 184–194 uses deliberately unequal PP exposures: TOR's high ratio has 60s support versus five 600s zeros; MTL steady. Exact two-team special score −0.55/+0.55 and relative CTPI order distinguish pooled weighting from the former ratio mean. **Two-team z normalization makes this an ordering oracle rather than an exact pooled-rate magnitude oracle.** It does not independently qualify every component/cohort/calibration.
- 196–203 excludes same-day high-rate game. 205–246 feeds actual prior output provenance back as stored metadata, detects unchanged date, issues missing date, then replays on source watermark advance. 248–264 rejects explicit >31 dates/no write and clamps automatic catch-up to31 with omitted-range warning.
- 266–298 invalid calendar date rejects before season read; no source and <five games produce explicit skip/no write. 300–313 invalid team identities cannot affect scores. 315–329 duplicates one real materialized destination row through a spy and pins failure before first write.

Version identity and no-v1 rows are asserted at the payload boundary; database v1 freeze triggers/atomic upsert constraints remain separate SQL evidence. No upsert failure fixture appears here.

## 7. update-team-power-ratings.served.test.ts (1–150)

Two declarations/cases. Real rating calculations retained, fetchGameLogs/fetchWgoStats/fetchAllRatings and special-teams context retrieval mocked; all DB writes captured. `isoDay`/`buildLogs` generates 32×20 synthetic games with 3600-second support; `runFor` requires status200 and maps target-date rows.

112–121 moves unchanged per-team inputs between tonight/yesterday under different slate masks, requires all32 teams and identical offense/defense ratings to9 decimals. This is a meaningful invariance regression against slate-only baselines, **not independent absolute formula/calibration or every output dimension evidence**. 123–149 contradicts single-game PP percentages with mocked season-pooled ranks (T00 rank31→tier3, T01 rank1→tier1, T02 unknown→null PP/PK), proving source selection and null/tier wiring. Pooling itself is mocked; supplied percentages/ranks are not independently computed from exposure. Do not adopt the other file's broad comment that this file proves all real maths.

## 8. update-team-power-ratings.test.ts (1–581)

Ten declarations/cases. Synthetic `computeDailyPowerRatings` (57–78) composes mocked EWMA/final rating; real genuine-game grouping and special-teams tier helper retained. Most calculation primitives are replaced. Therefore this is route/window/provenance/trend orchestration evidence, not scoring-math verification.

171–281 checks method405/Allow, empty-table season-start expansion and explicit warning, smokeTest one date without season fetch, populated-table explicit range. 283–373 derives today/yesterday dynamically, checks repair then latest-source daily rerating/version/source-through labels and two writes. Dynamic current Date is not fixed in this file; imported offseason wrapper behavior may depend on surrounding suite setup. 375–460 fixes played-day offense values120/110/108/106/104 and expects trend10=13 (120 minus mean of prior four=107), excluding stale off-day snapshots. 462–501 checks exact150-day fetch window and invalid reversed range. 503–567 checks one-date dryRun, no upserts/backfill, two returned rows and unchanged legacy version/source-date for carried OTT; only the audit skip predicate is called. 569–580 rejects dryRun range/missing date before fetch/write. No real DB or full audit wrapper exercised.

## 9. update-team-sos.test.ts (1–263)

Six declarations/cases. Fixed run instant and explicit ET calendar adapter; Supabase/season/admin/offseason/audit wrappers mocked, fetch globally stubbed to club fixtures. Helpers build NHL shapes, legacy standings fixture, response/written-row lookups. Real SOS route computation operates on fixture schedules; no real requests were made.

174–198 pins past final BOS/CGY, pending PPD/LIVE, future CHI/BOS, ET snapshot date, descriptive-v2 label, conflict key and32 rows. 200–217 independently computes head-to-head-excluded win/points means (past0.5/0.625, future0.75/0.875) and proves flipping ANA–BOS result cannot change ANA past values. 219–225 pins exactly32 club-schedule calls and zero standings calls. 227–243 handles incomplete final/cancelled fixture with exact issue counts and actualEndTimesSupplied=false. 245–255 compares row keys to parsed migration column declarations; this is a useful shape check but reads the working-copy migration at runtime, not a pinned blob, and does not verify types/constraints. 257–262 refuses historical backfill without fetch/write. No adversarial provider failures or conflicting-finals fixture despite its counter being asserted zero.

## 10. upsert-csv.test.ts (1–120)

Two declarations/cases. `fakeSupabase` models exact equality and permissive substring ilike, records inserts and returns unconditional RPC success; `post` supplies numeric string rows and configured columns, bypasses auth/audit and silences console. 97–108 rejects prefix-only Matt/Mattias linkage, inserts exact Josh ID2, reports unmatched row0/reason and message while success=true. 110–119 resolves duplicate Sebastian Aho to D ID4 and reports blank-position duplicate row1 ambiguous. Partial import success with explicit unmatchedRows is the pinned contract, not automatically a false-success defect. Numeric coercion, dynamic table/RPC safety, SQL schema creation, malformed identities and DB-error behavior are not assessed by these two oracles. Console spies lack local restoration; this review did not run them.

## Verification and remaining scope

Read all assigned bytes; parsed ten source files with installed TypeScript AST only (no application/test imports executed); verified target-blob hashes/current-copy identity, declaration counts, every file represented and TSV shape/unique source-offset symbols. The parser was adjusted to unwrap `as const` arrays so the three pagination cases count correctly; no test source changed. All checks passed. No runtime tests, provider/network/DB access, source edits or commits performed.

No context-only implementation files newly inspected in this batch. Imported implementation modules, real provider/DB behavior, deployment state and production frequency remain outside this batch. Assertions are inventoried as evidence to assess, not acceptance by themselves.

## Full-read pinned manifest

|Path|Bytes|Full read range|SHA-256 at target|Working copy matches|
|---|---:|---|---|---|
|`web/__tests__/pages/api/v1/db/update-player-underlying-summaries.test.ts`|21458|1–657|`d03622aa29df12a16686c0ec4654ded8efac9edd6f87c563eb07999356ec2a7c`|yes|
|`web/__tests__/pages/api/v1/db/update-power-play-combinations-game.test.ts`|33139|1–616|`91e3aec6dc19bc31b629af649e7563fd320aa9e2e2c53a6e93c7e28946cbc5d9`|yes|
|`web/__tests__/pages/api/v1/db/update-power-play-combinations.test.ts`|21869|1–600|`88d85f1b04a40ccb56e6b7cc57241da16065e49d99ca60cf6eee3fb2b040218d`|yes|
|`web/__tests__/pages/api/v1/db/update-sko-stats.test.ts`|15727|1–464|`878a7b321c7cdecb9d1d5e1d0a5cca1aa943bfd90a3026fd98dfa0cd174ac4a4`|yes|
|`web/__tests__/pages/api/v1/db/update-stats-game-rows.test.ts`|4163|1–103|`520f0e52acec89e3b89ecbe8027c3a796de55dfaf810b805cb522669f0dece13`|yes|
|`web/__tests__/pages/api/v1/db/update-team-ctpi-daily.test.ts`|12207|1–330|`14e55d5b66bf842eb3d3aeef429e81a2ccb84dc0d8da5b1195a9d6af7f0f544e`|yes|
|`web/__tests__/pages/api/v1/db/update-team-power-ratings.served.test.ts`|5298|1–150|`597d36035849ab70450114965ced48b754bafdb4bdcc34ff7fedf50f6a26fbda`|yes|
|`web/__tests__/pages/api/v1/db/update-team-power-ratings.test.ts`|17126|1–581|`c55623eb38373d6f0d40aaa349efaa31546468a8662e66231e2b2a3d8fe30542`|yes|
|`web/__tests__/pages/api/v1/db/update-team-sos.test.ts`|11412|1–263|`685f2995e7b5546a7688ffcf53e462d53b170ec6eaad2e35dea09ebc59a936c6`|yes|
|`web/__tests__/pages/api/v1/db/upsert-csv.test.ts`|3835|1–120|`4eca4d105a0ee039acc95dcc2723c1973350711d4596237f0423904a37634f3e`|yes|

TSV: 502 rows plus header; 98 test-oracle rows and 404 other function nodes. No context-only rows. Every assigned file represented.
