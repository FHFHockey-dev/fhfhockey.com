# Owner decisions and evidence

October 1, 2026. Owner decisions are explicit in the current chat. Database evidence was obtained through read-only Supabase SELECTs. No production records were changed. These are current mutable database snapshots, not immutable original ingestion receipts.

## Decisions that clear approval questions

- Starter Board: always serve today's slate or the upcoming slate. Implemented locally: past requests clamp to today; no-game dates select the earliest later scheduled slate independent of projection availability. Page controls reject past dates and correct historical URLs. Upcoming notices and links use the applied slate. API/page/freshness tests: 67 passed; final page/WiGO tests: 34 passed; TypeScript and targeted lint passed; Chromium preview/form/link scenario passed at six widths. Broader recovery/manual acceptance and historical producer lineage remain open.
- WiGO: zero/zero DIFF displays `-`. Implemented in `web/components/WiGO/tableUtils.ts`, its existing regression and comparison help. Focused tableUtils run: 5 tests passed. Genuine numeric zero remains available independently of undefined percentage change.
- Rankings: provide a fantasy preset. Implemented locally using existing MCM and fantasy category columns, season/all-strength comparison and the catalog's 1 GP/600-second eligibility rules. Selected season and expert controls are preserved; applied settings survive URL restoration. Filter/URL/page tests: 25 passed; TypeScript passed; targeted lint passed with an existing image warning; Chromium keyboard/reload/disclosure/no-overflow scenario passed at all five widths. The basis disclosure avoids predictive reliability claims. Metric stability/evaluation and source-component coverage remain evidence gates, not new approval questions.
- News: approved to proceed with the consumer-contract work. Separate classifier lineage, source-time identity and release gates remain evidence questions.

## Exact news examples located

See [database evidence](database-evidence.json).

- Kevin He injury headline: item `<identifier redacted>`, tweet `2104976276528542197`, review item `<identifier redacted>`. Passage names Mathew Barzal; the linked subject is Kevin He (`8484864`). This directly establishes the current subject/passage mismatch. It does not establish the original writer version; current metadata/joins were updated October 1.
- Carson Soucy signing headline: item `<identifier redacted>`, tweet `2104996083462271476`, review item `<identifier redacted>`. Passage states the goal is to sign him and cap space must be determined. The signing headline therefore lacks completed-signing evidence. Metadata includes a signing phrase match, but `autoPublish=false` and `primaryRuleId=manual-review`; this snapshot alone cannot identify the publishing execution.

These exact IDs and passages can replace synthetic-only consumer regression inputs. Do not substitute the different Barzal post in the classification holdout for this record.

## WiGO and goalie source observations

- McDavid (`8478402`): NHL September 29 game `2026020004` has 1,371 total TOI seconds and 320 PP seconds; no matching September 29 NST row was returned. Four older selected dates have matching NST TOI. The current October 1 aggregate has nonzero L5/L10/L20 ATOI. This supports the source-gap failure class, but does not reproduce the historical displayed zero or certify which inputs produced that historical aggregate. No recompute was performed.
- Six current October 1 goalie rows have `start_probability=1` and `confirmed_status=false`; their game/team/player IDs and timestamps are captured. The table has no run/version column. These are current examples, not an authenticated match to the historical screenshot; historical producer attribution remains unresolved.

### WiGO source matching and database catalog follow-up

See [current source-catalog evidence](wigo-source-catalog-evidence.json). Read-only PostgreSQL catalog queries found no non-system SQL function definition containing `wigo_rates` and no non-internal trigger on that table. Nine matching cron entries were inspected through names, schedules, flags and command hashes only. Job 231 (`update-wigo-table-stats`) references `calculate-wigo-stats`; none of the matched commands mentions `wigo_rates`. This narrows the inspected paths but does not establish that no external/dynamic writer exists, identify deployed handler versions or prove a cron request completed its downstream work. Command bodies and credentials were not returned. The queried cron time-zone setting was unavailable; schedule strings are preserved without assigning a time zone.

The current NST scraper builds a single-date `gpfilt=gpdate` query and stores its URL date as `date_scraped`, alongside the supplied season. Its time parser converts MM:SS to seconds. These are inspected source contracts, not historical ingestion receipts. Live columns confirm NHL `game_id`/`season_id`/`date` and NST `season`/`date_scraped`; NST has no NHL game-ID column. Both NST all-strength tables enforce player/date uniqueness. For McDavid's current latest 20 NHL rows, one has no matching NST individual row, and the other matches have no unknown/mismatched seasons. This bounded current observation does not reproduce the original displayed-zero aggregate or certify population completeness.

The WiGO writer previously omitted season fields from the selected game logs and joined on date alone. It now selects existing season fields and joins the already player-scoped rows by season/date, rejecting missing/noninteger NST seasons. Missing or mismatched joins flow through the existing null/coverage safeguards. The latest-20 selection remains across seasons; it is not restricted to the current season, and no raw-unit conversion was changed.

The added wrong-season and missing-season cases failed before the join change. The complete existing writer file now passes 12 tests, including missing NHL season, wrong date and cross-season matches, plus prior complete/absent/partial/nonfinite/zero total TOI and separate PP coverage. Complete fixtures retain 5 goals/6,000 seconds→3 G/60, 5 games→20:00 ATOI and 2 PPP/600 PP seconds→12 PPP/60. TypeScript, targeted lint and scoped diff checks pass. Only mocked writes were exercised; no writer endpoint, recompute, database publish or deployment was triggered.

Tasks 4.1–4.3 remain open for overriding-producer lineage, actual aggregate window/coverage metadata, full metric-basis compatibility and historical/manual acceptance. Dot Scout was not listed among all pinned and the 50 returned recent chats in the renewed inspection; no chat was messaged.

### WiGO missing-count and rate-override follow-up

Recent NHL counters previously converted null to zero before aggregation. A missing numerator could therefore produce an apparently complete count or a rate based on a partial sum. The recent writer now preserves source nulls and requires every selected game to have finite inputs for each affected count, per-60 rate or ratio. Missing goals, points, shots, primary assists or PP points invalidate only their dependent metrics; missing PP percentage no longer becomes a partial-window average. Genuine zero remains zero, and separately covered PP seconds remain usable. Seasonal aggregation and raw units were not changed.

The reader also requires an available finite recent source rate before applying a legacy `wigo_rates` override, alongside the existing GP and denominator checks. Null/absent/nonfinite source rates remain unavailable across L5/L10/L20 even when an override supplies a number. This safeguard does not establish compatibility for a nonnull override from an unidentified producer.

Before the fix, five targeted negative cases failed: missing goals/PP points produced numeric rates, and null/absent/nonfinite recent rates were revived by an override. Existing writer and reader files now pass 20 tests each; the reader was checked again after strengthening its independently covered PP assertion. The existing percentile component file passes six tests. Targeted lint and scoped diff checks pass. TypeScript passes with `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`; the preceding default-heap run terminated with Node heap exhaustion.

The extended Chromium source-failure scenario passes at 1920×1080 and 390×844. Its fictional recent rows have missing points, zero goals, 20:00 ATOI and separately covered 11.25 PPP/60; a sentinel 999 rate override does not revive PTS/60. Desktop matrix and mobile comparison preserve the dash/zero distinction, and missing PTS/60 produces a dash DIFF. The browser caught a 20-pixel desktop overflow: the fixed last grid row was reduced from 396 to 376 pixels, and the empty percentile-cohort message now occupies the existing filter message area. All desktop coverage panels fit without overflowing elements, clipped table cells or text below 12 pixels in this scenario. These are consumer fixtures, not historical replay or live provider acceptance.

The separate existing “complete desktop matrix” scenario failed at its readiness assertion: the current 20262027 response reports “No rating data available for this player/season” instead of the expected “Offense” rating. It did not reach its complete populated-state layout checks or evidence-file writes; those checks are not claimed as passed. No retry or production data alteration was used to satisfy that assertion.

Only mocked writer mutations and read-only browser requests were exercised. No production writer endpoint, recompute, publish or deployment was triggered. Tasks 4.1–4.3 retain their source-lineage, aggregate-window, complete compatibility and historical/manual gates.

### WiGO populated-cohort and chart browser follow-up

The existing complete-desktop scenario previously stopped before its layout checks because the live 20262027 rating inputs were unavailable. It now intercepts NST percentile cohorts, selected-stat/NHL game logs and Game Score responses with explicitly fictional inputs, alongside its existing radar fixture. Player identity, aggregate/reference values, team drivers and schedule remain read-only live inputs. This separation exercises populated rating/chart controls without certifying that the production season is complete or that live aggregate and fictional game-log samples agree.

The unchanged acceptance assertions pass in Chromium: 37 headers (period plus all 36 metrics), eight rows (seven timeframes plus DIFF), 288 value cells, fixed selected-log geometry while changing metrics, all seven reference toggles, same-period comparison, TOI/PP controls, drag zoom/Shift-pan/reset on all three trend charts, all four percentile strengths, minimum-GP control, tooltips, cleared-player focus and keyboard-selected player replacement. All C01–C19 panels fit at 1920×1080, with no overflowing elements, clipped table cells, sub-12px rendered text/canvas labels, page errors or hydration/list warnings. This is one passing existing Playwright scenario, not a live-populated-data acceptance run.

The [current screenshot](wigo-populated-cohort-charts-fixture-1920x1080.png) was inspected and retained here. The test writes its screenshot into its own result directory and attaches its geometry measurements instead of overwriting older shared screenshots/measurement files. TypeScript passes with `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`; targeted ESLint and scoped diff checks pass. Historical inputs, live source completeness, native accessibility and the remaining 7.2 gates are unchanged.

## Rankings evidence

See [sample evidence](rankings-sample-evidence.json). Latest returned prior-season points snapshot is April 16, 2026: 776 skaters, season median 66 GP, minimum 1 GP, maximum 81 GP. All returned points rows are marked qualified, including one-game samples. No requested current-season/PP/MCM rows were returned at the latest selected snapshots. Do not describe this as complete season coverage or use existing qualification flags as stability validation.

`web/lib/rankings/metricDefinitions.ts` already defines `mcm_score` as a fantasy composite with component availability requirements and 1 GP/600-second minimums. Reuse that definition where supported; these minimums are existing eligibility rules, not demonstrated forecast reliability. A fantasy preset must disclose historical basis and unavailable components.

### Rankings secondary sample labels and native zoom

Native Chrome at 200% exposed remaining medium/high-confidence labels for one-/two-game skater samples in the comparison panel, plus unqualified sample tiers in the player snapshot. The existing sample formatter now explains the actual skater metric contract: medium meets selected minimums, high is at least twice both minimums, and low is below minimums or unavailable. Snapshot facts and comparison sample rows use the qualification flag rather than predicting reliability; null/nonfinite GP or TOI produces “Sample unavailable.” The same snapshot metric bullets and comparison source notes describe each metric's own tier. Goalie-specific sample/role wording and numerical calculation/filter behavior are unchanged.

Twelve new/strengthened targeted cases failed before the fix. The existing formatter, player-snapshot and page checks now pass 9/8/6 tests (23 total), covering one-game qualification, below-minimum inputs, missing/nonfinite counts, metric tier wording and the rendered comparison. TypeScript passes with the 8 GB heap setting; targeted ESLint passes with two existing image warnings; scoped diff checks pass.

See the [native zoom receipt](rankings-native-zoom-evidence.json), [preset-basis screenshot](rankings-native-zoom-200.png) and [one-game snapshot screenshot](rankings-native-zoom-sample-200.png). Chrome's native control explicitly reported 200%, with device pixel ratio changing from 2 to 4 and CSS viewport from 2056×1049 to 1028×524. Document width was 1020; no filter controls exceeded the viewport width. Enter activated the fantasy preset and its basis disclosure; the focused summary showed a rendered browser outline. After hot reload, Enter on the dedicated player-selection button displayed Evgeni Malkin's 1 GP, 18:22 TOI/G and “Meets selected minimums,” including the metric bullets. No broad low/medium/high-confidence GP claims or framework error overlay remained in the observed skater view. Rankings loaded real read-only data; the selected historical season and URL minimums were preserved. These observations do not validate dataset completeness or forecast reliability.

The local dev-server log also records fresh `/api/v1/contextual-rankings/snapshot` and `/comparison` requests returning HTTP 500 in the MCM/All context. No response error body was captured, so their cause is not established. Existing loaded matrix/fallback data and previous comparison data made the rendering checks possible; they are not evidence that every fresh request completed successfully. Live snapshot/comparison recovery remains unresolved.

Chrome zoom was restored to 100% (device pixel ratio 2), the task-created tab was closed and the task-created port-3100 dev server was stopped. This verifies one native Rankings rendering/control workflow; other surfaces' native zoom, screen readers, measured contrast, human first-time-user timing and real-account switching remain open. No production writes or deployment occurred.

The shared classification owner's latest [completion matrix](../../../lines-gdl-ingestion/audit/2026-10-01-classification-implementation.md) was inspected read-only. It records recovered original-author timestamps for its 11 seeds, recent zero-row caller receipts and bounded roster observations. Those are not immutable execution/source-time identity proof for the exact Kevin He/Soucy examples here. Its independent labels, temporal identity and deployed configuration gates remain open; no message was sent to that chat and no upstream acceptance was inferred.

## Coordination and remaining evidence
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
### Local News consumer contract and verification

The application adapter consumes the existing `metadata.interpretation` / `TweetPlayerEvent` contract rather than rerunning a classifier. Versioned event arrays with no unresolved entries must contain supported event kinds/states, positive canonical IDs, explicit full names in matching source evidence, supported modality/availability, and no review conflict. Malformed or unsupported payloads use a neutral source report. This conservative full-name check can abstain on alias-only passages; it does not certify source-time canonical ID accuracy or producer lineage.

NewsCard and homepage injury rows present each supported event as a **report**, retain observation labels, and use its subject rather than the first news-player join. Event team/time/timeline fields remain in the typed claim payload; public source context, publication and receipt timestamps remain separately displayed. Missing/unresolved claims have no subject profile link or inferred injury status. NewsCard displays the original blurb instead of an automated summary. The existing upstream event schema does not define transaction completion, so homepage transactions use neutral source reports and preserve the passage instead of inventing signing/trade certainty. Unsupported transaction binding remains unavailable.

Player news flags require a matching bound event ID; an unrelated join cannot generate a flag. Flags describe the event as a report, use sanitized source attribution, and never replace absent publication time with creation time. Existing lineup-grid handling and separately sourced roster injury records are retained.

Verification: helper/card tests 34 passed; homepage tests 14 passed, including the two captured current records. The prior combined run passed 47 tests before the final Soucy homepage regression was added. TypeScript and targeted lint passed. Chromium homepage provenance/keyboard expansion/no-overflow scenario passed at the five required widths. The browser scenario verifies access and geometry, not deployed writer parity or immutable historical replay. No producer changes, production repairs or releases were performed. News task parents remain open for the original immutable lineage, source-time identity and broader semantic/manual gates.

[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
### Fantasy component builder and PP read-path evidence

The existing composite publisher (`web/pages/api/v1/db/update-skater-composite-ratings.ts`) accepts ALL strength, defaults to 5v5, and defaults to `dryRun=true`. `web/README.md` documents it as not yet scheduled in the current inventory; that statement does not rule out an external/dynamic invocation. The pure exported `buildSkaterCompositeRatingRows` function was invoked locally instead of the audited publisher endpoint, with season 20252026, cutoff April 16, season window, ALL strength, all skaters/deployments, 1 GP / 600-second minimums and limit 1,000. A network guard allowed only GET/HEAD; no non-read request was attempted and no upsert/publisher/cron endpoint was called.

[Before the read fix](rankings-fantasy-composite-builder.json), the builder produced 776 rows, 717 finite MCM scores and 59 null scores. Each of the six non-PP MCM components had 717 finite percentiles. PP points/60 was unavailable for the entire context, so none of the scores contained all seven components. These are unpersisted descriptive outputs, not published availability, reliability or predictive evaluation.

Read-only [PP input queries](rankings-pp-input-evidence.json) established two distinct causes. The latest April 16 daily subset has 216 rows at each returned strength and no PP average inputs. However, some older latest-per-player rows do contain those inputs. The source reader's explicit `ROLLING_RANKING_SELECT_FIELDS` omitted both PP averages and every supported recent PP total, preventing the existing extractor from seeing any of them. `web/lib/rankings/rollingRankingSelectFields.ts` now selects the eight existing numerator/denominator fields for season/L5/L10/L20. The owning rolling writer already defines `pp_points` and `pp_toi_seconds` from its existing NHL-backed helpers; neither that writer nor stored rows were changed.

The existing query mock now projects selected columns for its populated rolling fixture, matching the relevant database behavior. Four added window cases failed before the fix (15 existing cases passed), then pass with the field selection. Each verifies 2 PPP / 600 PP seconds → 12 PPP/60; genuine zero remains zero; null numerator, null denominator and zero denominator remain unavailable; 599 seconds retains its calculable value with no eligible percentile. Query/aggregation/composite-writer checks **38 passed**. TypeScript, targeted ESLint and scoped diff checks pass. No application build or browser run was needed for this read-only field-selection change.

[After the read fix](rankings-fantasy-composite-builder-after-pp-select.json), the pure builder's PP surface is calculable and no source metric is globally unavailable. All 776/717/59 counts and the descriptive MCM score distribution remain unchanged, and PP still has **zero eligible percentiles** under the selected minimums. The exact consumer date scope (latest 200 scheduled-game rows, deduplicated/capped at 30 dates) returns 25 dates beginning March 22, 776 latest player rows, GP min/median/max **1/2/3**, 262 one-game rows and 717 total-TOI-qualified rows. Only 108 rows have PP average inputs; 59 have positive PP time, ranging from **1–275 seconds** after season extraction. None meets 600 PP seconds. The initial broader 30-rolling-date probe returned 785 rows; it is retained and explicitly distinguished from the served cohort. These ALL rolling samples cannot be described using the earlier published 5v5 GP distribution or certified as a complete historical season.

The guarded audit [script](rankings-fantasy-composite-read-only.ts) is retained for reproduction. Run from `web/` with `NODE_PATH=./node_modules:. ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node","target":"ES2022"}' ../tasks/TASKS/in-season-trust-clarity-decision-workflow/evidence/2026-10-01/rankings-fantasy-composite-read-only.ts /tmp/rankings-composite-builder.json`. Receipts record actual Node v22.11.0, request, timestamps, read counts and hashes of repository source files present in the module cache. Those hashes were captured at receipt completion, not by an immutable loader; the before/after source hash comparison differs only for `rollingRankingSelectFields.ts`. Both runs completed successfully (58,559/8,175 ms); these are local observations, not a controlled performance benchmark.

Remaining 5.1/5.3 gates: validate the historical ALL participation/window/source inputs and PP coverage; obtain metric-specific stability/evaluation evidence and the intended landing-purpose sign-off; then prepare any necessary bounded repair/publication package under its explicit approval gate. No thresholds, formula, preset strength/season, database rows, schema, production settings or deployment were changed. Missing published ALL MCM scores remain unavailable in the consumer. The eight-field read omission is locally resolved; source completeness and release acceptance remain open.

### Stored rolling history and one-player read-only validation

[Stored/source comparisons](rankings-stored-history-evidence.json) show that the earlier ALL GP range of 1–3 is an inconsistent stored aggregate, not proof that those players actually had only one to three historical appearances. Malkin's March 5 row stores GP 45, then March 16 and later rows store GP 1. Current source counts through his latest April 12 row contain 56 distinct game IDs with positive TOI. Independently bounded latest-row comparisons also find Draisaitl stored GP 1 versus 65 source games through March 15, and McDavid stored GP 2 versus 82 source games through April 16. Their PP points/time are present in every returned underlying source row. These three cases do not certify the full population or authenticate the original WiGO displayed-zero aggregate.

The existing `fetchRollingPlayerAverages.ts` already separates complete prior-history reads from requested output bounds: `buildPlayerHistoryReadOptions` deletes the requested start date; `isWithinRequestedWriteWindow` controls emitted rows after the accumulators have consumed prior games. No duplicate writer fix was made. The existing public validation helper was invoked for **Malkin / 20252026 / ALL / April 12 only**, with a GET/HEAD-only network guard. It loads the full game ledger and prior player history, but only the one requested player/date/strength may be emitted; the guard and output checks are retained in the [reproduction script](rankings-rolling-history-read-only.ts).

[Validation output](rankings-rolling-history-validation.json) returns exactly one row, game `2025021276`, with GP **56**, season TOI average **1056.5 seconds**, season points average **1.089286**, PP points average **0.392857** and PP time average **181.910714 seconds**. This validates the current local complete-history path against the current sources, without changing the stored row (GP 1, TOI average 1102 seconds and null PP averages). It does not identify the historical producer invocation or prove the deployed writer uses this code. Actual runtime was Node v22.11.0; the read-only validation completed in 4,045 ms with no non-read request attempted.

The PP denominator was independently reconciled to the inspected existing source priority: 50 source games have a nonnull `powerPlayCombinations.PPTOI`, six fall back to WGO PP time, and their selected sum is **10,187 seconds**. The dry-run average times 56 reproduces this within rounding precision. The WGO-only sum is **10,606 seconds** and must not replace the selected denominator silently. Diagnostic missing PP-context rows (three) differ from missing PPTOI fields/fallbacks (six); the returned diagnostic coverage-warning count is one. No PP priority or raw unit was changed.

The dry-run team denominator is **88**. Read-only schedule counts reconcile it to seven stored type-1 and 81 type-2 Pittsburgh games through April 12; the inspected ledger includes game types without filtering. This is another scope question to resolve before certifying availability/denominator completeness. The preview is not a publication-ready repair package: before values are projections rather than a full rollback backup, immutable producer/version evidence is missing, and the retained coverage/schedule-scope questions remain open.

Both JSON receipts validate; assertions confirm one correctly bounded output, GP 56 matching the current source count, no non-read requests and selected PP denominator agreement. No application code changed, so no application suite/build was run solely for this evidence. Reproduce from `web/` with the same Node/ts-node options documented in the prior section, using `../tasks/TASKS/in-season-trust-clarity-decision-workflow/evidence/2026-10-01/rankings-rolling-history-read-only.ts /tmp/rankings-rolling-history-validation.json`. Source hashes record file bytes at receipt completion, not immutable loader pins.

Tasks 5.1/5.3 retain their source/evaluation gates. Any stored-row repair or subsequent ALL composite publication requires its separate bounded, backed-up approval package; this read-only validation is not authorization. No main writer, writer/publisher endpoint, upsert, production mutation, deployment or formula/threshold change occurred.

[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
### Completion audit after local consumer QA

The previous goal turn made progress: a demonstrated RSO readiness defect was fixed and verified. The current turn adds exact author-original evidence and reconciles the classifier integration reference. The full objective remains **incomplete**. The task checkboxes below retain their original acceptance scope; current screenshots, mutable records or synthetic fixtures are not substituted for stronger gates.

| Task | Evidence and completion disposition |
| --- | --- |
| 1.1 | Existing typed contract and paused upstream plan are now linked/mapped above. Full upstream contract/source-time identity and release integration remain open. |
| 1.2 | Consumer safeguards, exact current database captures and both author originals are available. October 2 discovery identifies two stored publisher batches whose start timestamps exactly match the captured publication times; retained response literals include disabled inference and a prompt-version label. Explicit item-to-run binding, original deployed code/version and broader identity/semantic acceptance remain open. |
| 1.3 | Local sanitizer/attribution/timestamp tests and five-width/native keyboard receipts establish local acceptance. |
| 2.1 | Current API/source coverage and live slate receipts distinguish observed missing/stale/retrieval cases. October 2 read-only discovery adds four stored goalie-v2 POST audit receipts with reported updates 13/11/0/0 and a canonical-writer ownership declaration. Historical screenshot attribution, deployed version, immutable inputs and per-row run linkage remain open. |
| 2.2 | Today/upcoming policy, recovery fixtures and native live date/filter controls establish local acceptance. |
| 2.3 | Null rank, probability/confirmation/residual safeguards and their scoped checks establish local acceptance; historical producer proof stays with 2.1. |
| 3.1 | Loaded-schedule empty-roster prerequisite, readiness destinations, 19 component tests, five-width/browser and native manual setup establish local acceptance. Human first-use measurements remain under 7.2. |
| 3.2 | Input-review/wording regressions and native rules/schedule-only result establish local consumer acceptance. |
| 3.3 | Local retained intent/locks/protections and recalculation fixtures pass. Account switching cancels old provider requests, resets access and rejects stale provider/save results; mounted Chromium verifies these paths and clears the old save notice. October 2 retained-provider inputs now honor their read-only label until an explicit manual fork, preserving selected moves/protections/locks and restoring editing afterward. Adopted FE continuity/producer/release evidence and real-account parity remain open. |
| 4.1 | Current season/date source join, units and missing-input fixtures pass. Override producer and exact historical McDavid aggregate/input lineage remain open. |
| 4.2 | Missing numerator/denominator and legacy override safeguards plus zero/zero policy pass. Complete metric/window compatibility and authenticated source coverage remain open. |
| 4.3 | Actual GP, cross-season selection, units and unavailable date/coverage disclosure are visible. Stored aggregate window/cutoff/coverage metadata is still absent; current source reconstruction cannot prove original aggregate inputs. |
| 5.1 | Applied context/date/restrictions, read-only cutoff/composite reads and collapsed controls are verified. Dataset completeness and historical producer/version evidence remain open. |
| 5.2 | Metric-relative minimum explanations, unknown/tiny-sample regressions and native skater labels establish local acceptance. |
| 5.3 | Reproducible opt-in fantasy preset and component read-path fix are implemented/verified. Metric stability/evaluation and qualified component completeness remain open; no publication is authorized or implied. |
| 6.1 | Existing verified payload normalization tests and five-width rendering establish local acceptance; exact historical failing raw row remains unresolved. |
| 6.2 | Signed-out/live general-pool and fictional connected exclusion/availability/retry checks establish local consumer acceptance. Real Yahoo account parity remains under 7.2. |
| 6.3 | Strengthened clipping regressions, five-width controls and native 200% drawer/filter/reset checks establish local acceptance. |
| 7.1 | Supported route map and integrated fixture navigation/history verify local context transfer without replacing saved intent. |
| 7.2 | Per-surface geometry scenarios, integrated fixture flow at all five required viewport sizes and native zoom/control paths have recorded receipts. Starter Board's selected rendered status/recovery text pairs pass measured contrast on desktop/mobile; other surfaces and focus indicators have no contrast approval. Actual screen-reader speech, human first-use sample/timing, live-account switching and outstanding source/history/evaluation gates remain open. |

The remaining gates require particular evidence: immutable writer/source/run receipts for historical assertions; aggregate window/component and stability/evaluation contracts from their owning producers; authorized real-account access; and a declared human/screen-reader test. The known policy decisions are already resolved and need no repeated approval. Source verification here triggered no production write, classifier replay, deployment, external post or chat message. JSON parsing, exact passage comparison, timestamp conversion, screenshot signatures and scoped Markdown diff checks pass; application tests were not rerun solely for this evidence/documentation change.

### Integrated fixture workflow at all five required viewport sizes
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
[Not content-reviewed in segment23; body not copied.]
### Retained provider inputs enforce read-only until manual fork — October 2

The preceding mounted-switch screenshot showed retained provider roster inputs labeled read-only with no current account snapshot. The existing guard only covered an account snapshot or explicit saved view, leaving those retained roster controls editable. An extension of the existing account-switch component regression reproduced a Protect click clearing `protectedPlayerIds` and incrementing the intent revision while the read-only notice remained visible.

The guard now also covers a nonempty retained provider roster when synchronization is unavailable. Existing setup disabling, roster/candidate inert regions, edit guards and Undo disabling consume that same guard. Empty provider setup remains available; the free manual source remains editable. “Continue manually” uses the existing explicit fork and preserves selected intent, roster, protections and locks before allowing local edits. The component fixture contains a nonempty selected add/drop step, protected player and explicit lock; it verifies blocked edits before the fork and working Protect edits afterward.

Verification: the full component file passed **19 tests** (2.04 seconds total), then the strengthened nonempty-selected-move case passed **1 test with 18 unchanged tests skipped** (0.920 seconds). The existing connected Chromium scenario passed **1 test** (2.0 seconds total), verifying the actual disabled Source control and native roster `inert` property before the fork, then enabled controls, preserved workspace and a working Protect click afterward. Its first attempt used Playwright's disabled matcher on the fieldset itself: the error output showed a native `disabled` attribute, but the matcher classified that fieldset as enabled. The final assertions inspect that attribute and its actual form control. Targeted lint passes with four existing hook dependency warnings; the two final assertion/fixture edits each passed their narrower lint check. Scoped runtime/test/browser diff whitespace checks pass.

[October 2 structured evidence](../2026-10-02/retained-provider-readonly-evidence.json), [reproduced mutation](../2026-10-02/readonly-red.log), [component run](../2026-10-02/readonly-component.log), [nonempty intent run](../2026-10-02/readonly-selected-intent.log), [browser run](../2026-10-02/readonly-browser.log), [initial fieldset assertion](../2026-10-02/readonly-browser-fieldset-assertion.log) and [lint output](../2026-10-02/readonly-lint.log) retain exact outcomes. Compare [retained read-only inputs](../2026-10-02/retained-provider-readonly.png) with [manual editing after the explicit fork](../2026-10-02/manual-fork-editing.png). The latter captures editable inputs while worker analysis is pending; it does not certify a completed plan or fresh provider data. Captured page errors are empty. The owned port-3100 server was interrupted (exit 130), and the subsequent listener check was empty.

Whole-web TypeScript was not rerun for the single Boolean guard and assertion-only fixture expansion; its last separately owned calendar-runner failure remains recorded above. Real-account parity, producer/release evidence and human/screen-reader acceptance remain open. All sessions and responses are fictional/intercepted. No live account, provider mutation, database write, deployment, migration, recompute or forecast release was used.

### Whole-web TypeScript recovery and remaining acceptance audit — October 2

The separately owned calendar runner now converts the previously incompatible `Buffer` to `Uint8Array` at line 264. That concrete source change justified a fresh whole-web check. It then found two errors in this chat's expanded component fixture: Testing Library's `ByRoleOptions` does not support Playwright's `exact` option. The two checkbox queries now use anchored `/^Protect$/` name patterns. No runtime or producer code changed in this continuation.

Final `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` **passes** (exit 0), superseding the previous calendar-runner and new fixture typing failures. The affected account-switch/read-only/manual-fork test passes **1 test, 18 unchanged skipped** (1.01 seconds), and targeted lint passes. Scoped test diff whitespace passes. [Recovery receipt](../2026-10-02/completion-typecheck-recovery.json), [initial compiler errors](../2026-10-02/completion-types-initial.log), [successful compiler output](../2026-10-02/completion-types-final.log), [focused test](../2026-10-02/completion-account-test.log) and [lint](../2026-10-02/completion-account-lint.log) preserve these outcomes. The successful compiler/lint outputs are empty. Browser checks were not repeated for equivalent test name patterns.

The requirement matrix above still does not prove completion. The latest bounded snapshot of “Audit FHFH forecasting gaps” identifies an active in-progress turn working on durable budget grants/resume handling after its read-only scope inspector; that is a verified live dependency, not FE release acceptance. The paused classifier audit's current closure matrix retains independent source-time identity/labels, deployed configuration and original/correction authority gates. No classifier chat was resumed or messaged. Existing WiGO generated aggregate interfaces still expose update timestamps and counts without an aggregate window/source-revision contract; this code inspection was not a fresh database schema read and cannot recover old input dates.

Outstanding inputs remain immutable News/goalie/WiGO writer and source/run receipts, Rankings completeness/stability/component validation, adopted FE acceptance, real-account parity and declared human/screen-reader checks. The user has been asked for existing evidence locations/owners in addition to the earlier participant/screen-reader question. Existing owner policy decisions remain resolved. Compiler success does not substitute for any of these gates or authorize publication, production repair, deployment, recompute or migration; all remain separately scoped.

### Evidence needed to clear the remaining blockers — October 2

The requested Starter Board date policy, zero/zero DIFF policy, fantasy preset and News consumer approval are already recorded above. Both exact News author originals have been captured. The remaining gates require the following evidence; mutable present-day rows and additional UI fixtures cannot substitute for it.

| Gate | Evidence that would permit acceptance or a bounded next step |
| --- | --- |
| News 1.1/1.2 | Original input/output and writer run/version for items `<identifier redacted>` and `<identifier redacted>`; authoritative source-time subject binding and claim/certainty contract; separately owned classification acceptance. Author permalinks and current payloads are already available. |
| Starter Board 2.1 | Historical screenshot date plus game/team/goalie IDs, stored probability/status output and the producer run/version that emitted it. Current unconfirmed probability-1 rows show the failure class but do not identify the historical execution. |
| WiGO 4.1–4.3 | Actual `wigo_rates` producer and refresh owner; original McDavid aggregate/run and immutable selected NHL/NST inputs; metric units, included game identities/seasons, cutoff and numerator/denominator coverage for each window. Persisting this information for future runs needs a separately reviewed additive writer/schema contract. Old rows must continue to report unavailable provenance; a new metadata column would not recover their history. |
| Rankings 5.1/5.3 | Producer/version and complete-history reconciliation for the selected dataset; component-qualified cohort coverage; metric stability/evaluation report tied to the preset's season/strength/window/minimums. Existing 1 GP/600-second rules establish eligibility only. The one-player read-only reconstruction is available for diagnosis, not a population repair authorization. |
| RSO 3.3 and shared 7.2 | Adopted FE acceptance receipts, real-account refresh/save/reopen/switch results, a declared first-use participant/task/timing record and actual screen-reader speech/control results. Local fixture, zoom, geometry and compiler receipts are already recorded. |

The consolidated WiGO execution references were corrected to tasks 1.0/13.0/17.0; their source plan filenames remain 00/12/16. No acceptance checkbox was changed. No new schema, migration, writer call, recompute, deployment or production publication was attempted.

If evidence must be located outside this workspace, this request is ready to paste into ChatGPT or the owner's existing Scout chat. No Scout chat was identified in the inspected inventory, and no message has been sent.

```text
Objective: locate existing evidence needed to finish the FHFH in-season trust, clarity and decision workflow in /Users/tim/Code/fhfhockey.com. Ask for any missing files, excerpts, logs or configuration before recommending a solution.

Read tasks/tasks-prd-in-season-trust-clarity-decision-workflow.md and tasks/TASKS/in-season-trust-clarity-decision-workflow/evidence/2026-10-01/owner-decisions-and-evidence.md, especially the October 2 evidence checklist. Return exact artifact locations, owners, run IDs, timestamps and writer/deployment versions, and identify unsupported claims explicitly.

Settled decisions: Starter Board serves today or the upcoming slate; WiGO 0/0 DIFF is '-'; Rankings has an opt-in fantasy preset; News consumer work is approved. These behaviors have local verification. Full web TypeScript passes. Do not reopen these decisions.

Evidence already obtained: the Kevin He/Barzal mismatch and cap-dependent Soucy signing author originals, current read-only database captures, WiGO source-unit/season/date and missing-input regressions, native zoom/geometry and fixture account-switch receipts. A bounded catalog inspection found the recent WiGO cron reference but no literal wigo_rates function/trigger or matched cron command. Aggregate types lack stored window/cutoff/coverage provenance. Rankings stored ALL GP 1/1/2 disagrees with current source GP 56/65/82 for Malkin/Draisaitl/McDavid; a single-player read-only validation returned GP 56 without publishing. These observations do not establish historical writer executions or dataset completeness.

Find: (1) original News writer receipts and source-time identity/claim contract for item IDs <identifier redacted> and <identifier redacted>; (2) historical probability-100% goalie screenshot date/IDs and producer run/version; (3) wigo_rates producer/owner and original McDavid 8478402 aggregate with immutable NHL/NST inputs; (4) Rankings complete-history/component/stability validation reports; (5) adopted FE acceptance and existing real-account, human first-use and screen-reader results. If no artifact exists, identify the minimal bounded evidence collection needed and its owner rather than infer history from mutable current rows.

Constraints: preserve the shared dirty checkout; do not resume the paused classification chat or message other chats without authorization. Do not trigger writer endpoints, remote builds, deployment, production changes, migrations, backfills/recomputes or publication. No credentials or secret values are needed. Exact historical cases may remain explicitly unresolved at implementation sign-off; broader acceptance gates remain open. Distinguish an existing immutable receipt from a newly generated dry-run result or fixture.

Question: which exact existing artifacts clear each listed gate, which cannot be recovered, and what bounded read-only or human evidence collection is needed for the rest?
```

### Connected Drive producer leads — October 2

Read-only Google Drive discovery located the historical [FHFHockey.com Database Map](https://docs.google.com/spreadsheets/d/1CVV1UsI7866XJz9k9bp1AOOm66-TPtmHZXXTWRvSHP4/edit?usp=drivesdk), [Database Cron List](https://docs.google.com/spreadsheets/d/1WjIo8ZGZmXBQ89hElWkV_BgdqXdB_tkiKqdwiG6u_NE/edit?usp=drivesdk) and [WiGO design notes](https://docs.google.com/document/d/11nVaeBQ66F64JeHB0chcX9_QRVIXf5GRuyYMftvHkjY/edit?usp=drivesdk). Their last modifications are March 5, December 6 and February 8, 2025, respectively. The [normalized discovery receipt](../2026-10-02/drive-producer-leads.json) records exact IDs, bounded ranges, relevant rows and limitations. No Drive file was edited.

Cron-list row 20 names `update-wigo-table-stats` → `/api/v1/db/calculate-wigo-stats`, consistent with the already identified recent writer. The map and readable design text provide legacy context but do not identify `wigo_rates`; exact `wigo_rates` and `rolling_player_game_metrics` Drive searches returned no results. These bounded results do not establish that evidence is absent elsewhere.

Cron-list row 28 provides a more specific goalie lead: `update-goalie-projections-v2` → `/api/v1/db/update-goalie-projections-v2`, labeled 09:30 UTC. The current repository handler writes `goalie_start_projections` keyed by game/player, takes the player's starts over the last up to ten available team-log dates, assigns that fraction to `start_probability` and writes `confirmed_status=false`. It can therefore produce probability 1 without confirmation. The schedule label is consistent with the six previously captured October 1 rows at 09:30:06Z; this is an inference, not proof of execution or deployed version. No writer was called, and no calculation was changed.

The next bounded attribution check can target this named job and its original run/version receipts rather than an unidentified goalie producer. Historical screenshot attribution, WiGO override lineage, Rankings validation and human/account acceptance remain open. No task checkbox changed; historical documentation does not substitute for operational certification.

### Stored goalie writer run receipts — October 2

The [bounded read-only receipt](../2026-10-02/goalie-writer-run-receipts.json) now verifies live cron job 364, named `update-goalie-projections-v2`, active with schedule `30 9 * * *` and a command referencing the route. Its command is represented only by a hash. Four stored scheduled-command runs report `succeeded` for September 28–October 1; their SQL commands finish within about 21–37 milliseconds. This is command completion, not downstream API completion. Cron timezone was not established by this read.

Four separately stored `/api/v1/db/update-goalie-projections-v2` POST audits report HTTP 200, success and zero write failures. Their parsed responses report 13 updates on October 1, 11 on September 30 and zero on September 28–29. The responses identify `goalie-start-ownership-v1`, `goalie_start_projections` and this canonical single writer route. That decision version is a table ownership contract, not a deployed code/model version. The generic `rows_affected` and `rowsUpserted` audit fields are null; the numeric update counts come from the stored response, not a null-to-zero assumption.

The October 1 API audit time is 09:30:06.132961Z, consistent with the six previously captured unconfirmed probability-1 goalie rows created at 09:30:06.056162Z. This narrows current producer attribution beyond the historical Drive schedule, but there is no per-goalie run ID linking those rows to this receipt. The inspected audit fields carry no deployment/commit or immutable input revision, and the historical screenshot's date/IDs are still unavailable. No October 2 receipt was returned; no pending/failed-run state is inferred from that absence.

An initial nested-key query rejected JSON null `finalAudit` as a scalar. The corrected read inspects JSON types and parses the stored response string locally, retaining only the named numeric/status/ownership fields. Receipt JSON/source assertions and documentation validation are recorded with this continuation. No writer, cron trigger, production change or deployment ran. Task 2.1 remains open for its original historical/version and source-state acceptance; the completion matrix now acknowledges the newly located stored receipts.

### Exact News publication batch timing — October 2

The [stored batch receipt](../2026-10-02/news-publication-batch-receipts.json) records two `/api/v1/db/auto-news-feed-items` GET audits around the exact Barzal/Soucy publications. They report HTTP 200 and success, with `rows_affected=null`. Their audit timing starts are **2026-09-29T17:00:11.412Z** and **2026-09-29T18:30:11.336Z**, exactly matching the publication timestamps in the earlier two-item database capture. The stored batches finish about 170.403 and 124.229 seconds later. Timestamp equality is stronger candidate-batch attribution than simply matching the minute; it still is not a per-item execution link or proof of the original deployed code.

Both response strings contain 4,000 characters and cannot be parsed as complete JSON. The current audit helper explicitly truncates JSON to this limit. Safe scalar extraction finds `dryRun=false`, `inference.enabled=false`, configured model `openai/gpt-5.4-mini` and prompt version `2026-09-18.1`. The model label does not establish a model invocation when the captured inference switch is false. These are retained historical response literals, not a full effective configuration manifest or current classifier parity certification.

The two retained summaries respectively report 7 inserted/249 updated/2 published/5 assignments and 10 inserted/254 updated/5 published/6 assignments; each loaded 300 rows. These batch counters cannot identify the affected exact items or establish how many items were newly published. A grouped read covering both seven-minute publication windows finds no exact target item or relay tweet ID in any of the retained responses. The 4,000-character cap makes this negative evidence incomplete: later samples may have been discarded.

The current writer preserves existing `published_at` values and writes candidate publication time for newly published items. It cannot authenticate its September 29 deployment from current source alone. Original per-item outputs/input revisions, code/deployment identity and broader semantic acceptance remain open. The completion matrix now recognizes these candidate batch receipts; tasks 1.1/1.2 remain unchecked. The paused classification chat was not resumed or messaged, and no writer or cron was invoked.

### News request-to-deployment attribution check — October 2

The existing [batch receipt](../2026-10-02/news-publication-batch-receipts.json) now includes bounded Vercel attribution checks. Local project configuration identifies `fhfhockey` project `prj_LV0wbwH5gRjOsZlowzEFNGRuX7Lw` and its team. Grouped log reads for both publication windows returned HTTP 400. An ungrouped five-entry fallback reports `ExceedsBillingLimitError` before returning results; the connector's outer success flag does not change that explicit API failure. This is blocked log retrieval, not missing logs or confirmed retention expiry. No billing/configuration change was attempted.

Deployment metadata independently verifies production candidate `dpl_A37gcG8z62Ef8dSy6MV87KfwWZiJ`, branch `master`, commit `73af9d051ecc755dd3695f5265bf5837bbfc7a4e`, ready before both News batches. Its current aliases include `fhfhockey.com`. The bounded deployment-list page contains 13 entries and an older pagination cursor; it is not claimed exhaustive. No historical promotion/rollback/routing record or actual request-to-deployment link was returned. The candidate metadata therefore cannot close the original deployed-version gate.

Further request attribution needs an existing log export, deployment-linked request receipt or restored permitted log access. Retrying the same billing-limited query cannot supply that evidence. All News acceptance gates retain their previously documented per-item/source-time/semantic requirements; no code, publication or production deployment changed.
