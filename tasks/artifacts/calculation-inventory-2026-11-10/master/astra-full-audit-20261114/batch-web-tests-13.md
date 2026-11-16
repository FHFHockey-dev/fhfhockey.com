# Web test source audit: batch 13

Target `89da739cb45d7d572ed59bfa0b209c79c5d99299`; Astra/high worker. Exact assignment resolved from the canonical ledger's pending `web/__tests__/` entries after `pages/start-chart.test.tsx`: **11 TSX tests plus two JSON fixtures**, not 13 code files plus fixtures. All 4,076 code lines read top-to-bottom from pinned Git blobs. Both one-line JSON files parsed completely and every leaf traversed, with all event/shift/roster/official-total rows structurally checked. All 13 working-copy files match the target bytes.

**Result:** no new reachable application finding established. Test source audited; runtime tests **not run**. AST inventory: 85 test declarations, 107 expanded literal parameterized cases, 412 other functions/methods/constructors/callbacks. Internal loops (e.g. six landing table families) remain one Vitest case and are described separately. TSV includes every such symbol plus each JSON top-level member and all 16 positional event columns per fixture. Assertions are evidence to assess, not acceptance by themselves.

## Stats pages

### pages/stats/game/[gameId].test.tsx, 1–92

Two cases. SWR is replaced by key-dispatched responses; router fixed to a valid game; Head/search mocked. `schedule` supplies same or differing provider IDs; `mockResponses` independently supplies right rail, not-started boxscore failure and schedule. Assertions require explicit FHFH prediction-unavailable copy, Market win probability label, sportsbook/time attribution, and BOS44%/NYR56% from +120/−135 same-book odds. Different provider IDs must suppress probabilities and show unavailable. These are concrete displayed odds/math and provenance-label oracles, not provider feed/freshness qualification; SWR transport/error handling is bypassed.

### pages/stats/index.test.tsx, 1–299

Eight declarations / eleven cases. `makeSkater`, `leaders`, goalie constants and empty/populated props construct already-ranked data. Next image/link simplified; MobileTeamList is a prop-observing stub, goalie chart/search and backend modules mocked. Four positions pin desktop/mobile leader identity and value, clear unrelated goalie data, then restore overall20 and SV .925. Goalie-only mode preserves goalie boards and selected tab; unavailable position gets em-dashes, not fabricated zeros. Keyboard radio wrap verifies focus and aria-checked. Logo error/blank abbreviation falls back to FHFH.png. Mobile 430px test verifies collapsed prop and no scroll listener, not real MobileTeamList layout. Qualifier known renders min4 GP and formatted18.3 mean team GP; unknown fixture supplies empty rate arrays and checks withholding copy. It **does not independently compute the qualifier** or prove that nonempty unknown-qualified rows are discarded. No server-fetch leaderboard calculation exercised.

### pages/statsGame.test.tsx, 1–240

Twenty declarations /39 cases. Real SWR with fresh Map per mount and retries/focus revalidation disabled; global fetch strictly dispatches synthetic boxscore/right-rail/schedule responses. `game`, `response`, `mount`, `settled`, `panel` isolate the fixtures and DOM regions. Six invalid/ambiguous IDs forbid fetch; SSR invalid→notFound and valid→empty props both avoid server request. HTTP200 failure envelope, three empty payloads, optional rail never resolving, rail503, partial box identity, both sources503, and wrong-game payload are distinguished. Wrong game must not trigger schedule fetch.

Eight state labels and boxscore-over-season-series precedence are pinned. Zero scores remain scores, not50% or winner; OVER result counts only with both scores; absent strength metrics do not create equal-width50% bars. Same-book American −150/+130 yields58/42%, decimal1.65/2.40 yields59/41%; started game, underround2.0/3.0 and undefined/invalid/+120junk/1/−0 suppress probabilities. Same-name players remain distinct by ID; zero counts render0 while unknown render dashes. This is materially broader transport/display admission coverage than the SWR-mocked file, still entirely fixture based and not browser/provider execution.

## Trends pages

### pages/trends/index.test.tsx, 1–389

Six cases. Dashboard hook injects computed percentile/rank/delta/value/sample/confidence/recency data. Recharts and goalie chart are visual stubs; team power score is mocked zero and Supabase returns empty. ResizeObserver/IntersectionObserver classes exercise deferred mounting only. Tests cover summary cards; no-history/source-update-unavailable; viewport callback unlocks goalie chart; valid SSR date; CAR/ANA supplied deltas +4.5/−3.2 and freshness date; aria-pressed line-highlight change; stale-date message/scoped retry; goalie sample10/high confidence/volatility5.7 and mixed19-day source gap with downgrade warning. **Rank, percentile, confidence, volatility, source-date gap and movement calculations are not independently verified** because precomputed by fixture. Recharts stubs mean chart coordinates/series geometry are not verified.

### pages/trends/placeholder.test.tsx, 1–128

One case. Mock fetch returns power/CTPI/SOS fixtures; all trend categories generated from production category config and two percentile points; Recharts simplified. Independent numeric formatting .62/.55→62.0%/55.0%, as-of title/copy, and neutral SOS classes are asserted. Offensive+2.10 remains elite and luck−1.80 poor, guarding the scope of the tone change. This tests visual classification of supplied values, not SOS/CTPI production formula or CSS contrast measurements.

### pages/trends/player/[playerId].test.tsx, 1–306

Three cases. Router fixes FORGE return context, career/last10/L30/finishing metrics. Supabase test builder slices supplied rows while eq/order ignore predicates; Recharts replaced. `isWriterPrunedField` and `splitLikeRollingWriter` manually simulate writer storage by nulling wide compatibility fields and putting them into a sidecar. First case verifies return URL/date, selected groups/metrics, baseline10.0%, no router rewrite, and requested field projection (no raw goals but career goals average). Second restores10% career baseline from sidecar and pins exact support payload select. This simulated writer contract can drift independently of the real writer; no actual writer is invoked.

Third case fixes Date, supplies versioned per-game count support and independently expects shooting=(1+2)/(4+5)→33.3%, PDO=3/20+37/40→1.075 with no percent sign and L30·2GP. Strong pooled-component/unit oracle; no DB support acquisition or incomplete-window/missing-sidecar regression here. Timer restoration uses finally.

## Underlying Stats pages

### pages/underlying-stats/index.test.tsx, 1–774

Eighteen cases. Real page/dashboard construction; `buildRating` supplies already-computed indices, tiers, SOS, narratives and series; `buildSnapshot` invokes the real dashboard aggregator. `jsonResponse`/global fetch simulate initial load and delayed requests. ResizeObserver supplies a fixed800×420 box; chart is not mocked here, but DOM tests do not establish real browser rendering or responsive pixels.

157–259 tests SSR/loading ghost, successful requested landing URL with AbortSignal, initial503/retry, URL history changes, abort of previous request, late ignored response, failure/reset to original snapshot and removal of historical query to latest. Importantly 200–230 resolves the aborted promise anyway and checks it cannot overwrite the newer VAN snapshot; this tests stale-result admission rather than relying solely on a mock abort.

261–348 pins navigation order/links, Power Leaders, v2 record-SOS 2:1 visible explanation and retrospective as-of label, table headers, percent55.8 and trend▲2.3. These labels do not independently prove their calculation. 350–365 keeps unknown PP tier as em-dash. 367–440 tests mixed versions v4 5v5, v3 all-situations, carried legacy dated August29 and unverified, then homogeneous header versus per-row labels; non-v4 rows cannot be labelled5v5. 442–488 checks independently opened/focusable metric details and formula copy. 490–514 keeps quadrant out of SSR and keyboard-switches chart/rankings. 516–611 date selection fetches once/shallow URL update;503 marks Failed and withholds leaders/table. 613–647 simple view hides advanced fields and sorts trend4.4 over1.2. 649–715 pins selected team across chart/table/link rail without hover replacing pin. 717–750 renders all14 supplied teams, and 753–773 keyboard focus returns from chart to rankings.

No newly proven rating/SOS calibration or hosted freshness. File-local teardown calls cleanup only (not unstubAllGlobals), so isolation relies partly on suite configuration; not executed by this audit.

### pages/underlying-stats/playerStats/index.test.tsx, 1–1100

Fifteen cases. Fetch fixture infers family from URL and returns supplied rows/pagination; `resolveFamily`, `buildMockLandingRow(s)` and fetch-call selector provide plumbing. Expanded chart is a prop-printing stub. Session storage cleared before/after; globals unstubbed. Most rows contain only identity, GP12, TOI987 and optional position, so they **cannot establish numerical table ranking or aggregate formula correctness**, even where test titles say sorted rows.

173–264 invalid date range blocks fetch and reset clears stale dates; switch to game range updates scope and strips date/team-game params. 266–323 empty-result copy and context-preserving detail URL/987s→16:27/GP12. 325–382 goalie namespace/controls/column labels, hidden heuristic xG and ordinal# rather than rank. 384–483 verifies demand-driven100+50 page load with unresolved second response, namespace and loading indicator. 485–579 preserves savePct descending when counts→rates. 581–685 serializes playoffs/PP/withinOne/byTeamGames5 across query and API. 687–725 goalie expanded chart receives gamesPlayed/goalie and keeps ordinal1.

727–819 skater100+50 page load also avoids automatic fetch and old Previous/Next navigation; presence of row150 does not independently prove stable ordering or deduplication. 821–915 seeds fresh cached total108 then network total908, checks page1 revalidation and subsequent row200; cache-key generation uses production helper (useful wiring, not independent serialization oracle). 917–940 renders query error/reset. 942–1014 loops six families, expected headers/position visibility and SplitGP under default5v5. 1016–1064 expands player chart with cfPct/player prop; no real chart math. 1066–1099 distinguishes pending12/12 goalie summaries from no-results. Error races, backend sort/correctness and complete goalie domain semantics not established by this file.

### pages/underlying-stats/teamStats/index.test.tsx, 1–353

Seven cases. Real default filter/serialization/path helpers create expected paths, with one hard-coded canonical season20262027 assertion. Global fetch supplies route readiness and one precomputed FLA row (GP10, points12, xgfPct .554, PDO101.2, xGF/60 2.45) or error/coverage state. `expectLastTeamLandingFetch` pins AbortSignal. Tests cover canonicalization before fetch; partial65/120 versus zero/120 summary coverage; default data route and hidden record columns under5v5; readable failure alert; rates query/hidden bucket xG and points; team-only advanced controls; sort-by-team query state. No actual numeric sort with multiple rows or aggregate rates oracle. Expected helper-generated paths could follow the same serialization defect; hard-coded field assertions provide separate constraints. Hard-coded default season without a file-local frozen clock may become time-sensitive. Local teardown only unstubs globals; cleanup convention outside file not inspected.

### pages/underlying-stats/xg/index.test.tsx, 1–154

Three cases. `createXgPayload` supplies player/team model rows and approved-model-looking metadata, `getXgFetchUrls` collects calls. Stub dispatch recognizes teams else players (no goalie scenario). Tests require exact default read API URL/window10/limit50/season20252026, displayed model version with no manual override, teams scope without any `/api/v1/db/` request, and null registry model/version→Unavailable. This proves intended client route selection and unavailable display for synthetic registry state, not server read-only behavior, registry authorization, calibration, or provider use. Created xG fields are fixture constants; no expected-goal computation oracle.

## PP cross-surface test and complete fixture audit

### ppShare/decision152CrossSurface.test.tsx, 1–241

Two cases. Real imports are writer builder, TOI-series helper, LinemateMatrix computation/view, ShiftChart model/Replay and PowerPlayCombos. Admin/audit/backend/season hooks mocked; rendering uses injected Supabase builder and fetch gate. No imported app module was executed by this audit.

`load` reads local JSON. `clock`, `writerInputs`, `nhlPlays`, `nhlShifts`, `skaterRoster`, `box`, `diagonal` reshape fixture data. `box` fabricates OFF/OK, zero scores, identity names and remaining clock0; shift IDs are generated by row position and type517 provenance is present only in fixture source text, not retained shift tuple fields. Therefore this is not a real provider-envelope replay. `writerInputs` intentionally omits scorer/shooter fields while `nhlPlays` forwards them. `surfaces` **regenerates** clocks/player rows through buildPowerPlayGameSet; the variable `stored` is not an independently captured persisted output. It feeds these rows to /api/toi helper and common gate, then compares alternate calculations. `renderPowerPlayCombos` consumes a call-ordered table queue; all filters ignore values, and any fetch returns the same serving-on gate, so DB scope/security/cache/freshness and gate-off behavior are untested.

161–208 pins team18 clock120, ten literal player seconds, /api/toi seconds/shares, matrix/shift diagonal times, available verdicts, exact unit members, legacy29 versus qualified120 interval, rendered matrix92.0%/8.0%, and Lines PP1 player identities. Positive Replay timeline is **not rendered/asserted** in this case; model interval comparison is narrower than the comment that every rendered surface agrees. 210–240 pins team55 zero clock as not_applicable, no stored players, null share/N/A status for each skater, zero matrix/model clocks, rendered matrix N/A (no0.0%), Replay N/A, and Lines N/A (noPP1). This is strong local consistency evidence for two scenarios, not production serving verification, actual persisted readback or full availability-state coverage.

### JSON contents, each full line1

Both fixtures have eleven top-level members: source, gameId, date, homeTeamId, awayTeamId, gameType, eventColumns, events, shifts, roster, teamGameStats. Exact16-column event header checked against the consuming positional adapter. Entire arrays and every scalar visited; duplicate JSON keys/non-finite constants rejected. No record was sampled in place of this structural pass.

|Fixture|Events×16|Shifts×5|Roster×3|Team totals×3|Numeric leaves|String leaves|Null leaves|
|---|---:|---:|---:|---:|---:|---:|---:|
|2026020038|352|735|40|2|5,178|1,828|2,449|
|2026020131|282|743|40|2|4,953|1,486|1,936|

Every event has integer IDs/order/period; all periods1–3 REG; time-in-period+remaining=1200 seconds; situation codes are four digits; owner team is one of the two teams or null; penalty strings and optional numeric references follow declared positional types. No duplicate event IDs/sort orders; sort order monotonic. Every shift has five integers, known roster player/team, period1–3 and0≤start<end≤1200; no duplicate shift tuple or zero duration. All referenced event player IDs are on the fixture roster; forty unique players and four goalies each. Exactly two official team rows have valid mm:ss and goals/opportunities strings. There is no retained per-row ingestion timestamp, export checksum/signature, revision ID or raw provider response in either fixture.

2026020038: date2026-10-04, home55/away20/type2; all three penalties are on55, including one at the final horn. Official55 row is00:00 and0/0; opposite20 is02:52 and1/2. No-PP team55 assertion is internally consistent. 2026020131: date2026-10-17, home18/away19/type2; team19 minor at08:11, penalty-shot assessment/goal at08:40, official team18 total02:00 and1/1; team19 total09:38 and1/5. The penalty-shot goal explains the regression distinction between29 seconds and full120 seconds under the already-governing decision.

Independent standard-library arithmetic, **not app imports**, clipped and unioned every team18 skater shift against asserted period1 [491,611]. It exactly recovered players/times112,111,110,110,109,11,10,10,9,8 (the same ID mapping as test168–169), total600 skater-seconds. Given the test's unit membership, PP1 mean552/5=110.4 and PP2 mean48/5=9.6; divided by120 gives92%/8%. This independently checks shift exposure and displayed split; it does not independently qualify the full event-derived clock engine or recover unit assignment logic. The zero fixture's penalties and official totals also checked internally.

Both source strings claim read-only stored-row exports on2026-11-13 and separately added shooter/scorer IDs. **Provenance remains author-recorded/unverified externally.** Complete traversal, target hashes and numerical consistency are not substitutes for an export receipt or provider reconciliation. Offline probe and detailed field statistics are in `/private/tmp/astra-web-tests-13/fixture-audit.py` and `fixture-audit.json`; results are retained in the TSV and this report.

## Verification and scope limits

All assigned source read; TypeScript AST syntax parse passed for11 TSX files including constructors; complete JSON schema/clock/identity traversal and independent arithmetic passed for both fixtures. Manifest target hashes/current byte equality and TSV seven-column/unique-symbol/file-coverage checks passed. No runtime tests, browser, app imports, DB, provider/network requests, source edits, commits or canonical integration performed. No newly inspected implementation context is counted as audited. Imported modules remain subject to their own source batches; mock-success cases do not close application findings.

## Recommended next bounded components batch (not started)

The first14 exact path-ordered scoped components paths total **2,221 lines** at target. Recommend this as the next bounded batch: one254-line audit-email renderer followed by the DateRangeMatrix display/coverage slice with its colocated tests/styles. Stop before the separate1,456-line fetchAggregatedData producer and1,407-line paired test, which fit better together in the following batch. Only scoped path membership and pinned byte/line counts were inspected for this recommendation; none of these component sources is audited here.

|Path|Lines|
|---|---:|
|web/components/CronReportEmail/CronAuditEmail.tsx|254|
|web/components/DateRangeMatrix/DateRangeMatrixView.test.tsx|119|
|web/components/DateRangeMatrix/DateRangeMatrixView.tsx|87|
|web/components/DateRangeMatrix/GoalieCardDRM.tsx|87|
|web/components/DateRangeMatrix/LineHistory.module.scss|64|
|web/components/DateRangeMatrix/LineHistory.test.tsx|138|
|web/components/DateRangeMatrix/LineHistory.tsx|141|
|web/components/DateRangeMatrix/LinePairGrid.test.tsx|387|
|web/components/DateRangeMatrix/LinePairGrid.tsx|189|
|web/components/DateRangeMatrix/MatrixCoverage.tsx|23|
|web/components/DateRangeMatrix/ObservedUnits.tsx|52|
|web/components/DateRangeMatrix/PlayerCardDRM.tsx|84|
|web/components/DateRangeMatrix/diagnostics.ts|4|
|web/components/DateRangeMatrix/drm.module.scss|592|

## Pinned full-read manifest

|Path|Bytes|Full read/traversal range|SHA-256|Current bytes match|
|---|---:|---|---|---|
|`web/__tests__/pages/stats/game/[gameId].test.tsx`|2900|1–92|`7bebd3ed4af772773925aae65dd3a38f1dd9f1ff3588864c5d18a19bb5efb70e`|yes|
|`web/__tests__/pages/stats/index.test.tsx`|10202|1–299|`e4a7246687e4d85667ffcf777b5f8ba4944569d835eda479f9be00f7b8ef62d1`|yes|
|`web/__tests__/pages/statsGame.test.tsx`|12188|1–240|`0b86d27f6b3f7a28e1067088434df31fe65c699d2bafbf56deded41fa686a96c`|yes|
|`web/__tests__/pages/trends/index.test.tsx`|11777|1–389|`10eb778e56f6250c8e0c8d57b54c0b17f9fc566c2b7457121ca2141004dfcf4d`|yes|
|`web/__tests__/pages/trends/placeholder.test.tsx`|3720|1–128|`d351e62d928ec4ac70daee537a4276806149545af27ccadcebded1d5fb5235b5`|yes|
|`web/__tests__/pages/trends/player/[playerId].test.tsx`|9017|1–306|`43a1c040a6aa8a017284822cb2a5870835356473136088b640dd3bdddf1adf45`|yes|
|`web/__tests__/pages/underlying-stats/index.test.tsx`|29494|1–774|`bc4c2a06cb3c676a03677c967d4def5168e242412b28e0e0e221287a7daffdb0`|yes|
|`web/__tests__/pages/underlying-stats/playerStats/index.test.tsx`|33463|1–1100|`66312998240cfd026eb5b748c7e36b2ddec5c6a6acf62976ae2b2f3e7d22e235`|yes|
|`web/__tests__/pages/underlying-stats/teamStats/index.test.tsx`|11444|1–353|`9e5a894045e59a27addf7098730b16e2b07c857f4bee7b071fed573261854b74`|yes|
|`web/__tests__/pages/underlying-stats/xg/index.test.tsx`|4598|1–154|`80e6274da35c65137b3e7da6a41b43fecc46973c2015867bcc233189d3967eff`|yes|
|`web/__tests__/ppShare/decision152CrossSurface.test.tsx`|15866|1–241|`c364e0ae466363205bfc98b529c6d2da3e39cfe87bd6a98cde411e903a7ccf4e`|yes|
|`web/__tests__/ppShare/fixtures/2026020038.json`|50491|1–1|`d84045bacbaef88a26c1646f45c96325f32db6e448bb101b2527df61b8c1cd0c`|yes|
|`web/__tests__/ppShare/fixtures/2026020131.json`|44280|1–1|`dc8fd2ee8d9cf400e642dfd0d37436510db961a17ae51f84d15ef382bfe07704`|yes|

TSV: 551 data rows plus header: 85 test declarations, 412 other function nodes, 22 top-level JSON members and 32 event-column schema records. No implementation-context paths counted as audited. Component recommendation paths remain unaudited.
