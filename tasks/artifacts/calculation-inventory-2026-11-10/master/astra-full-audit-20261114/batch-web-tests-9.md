# Bounded audit: web API tests, batch 9

Target: `89da739cb45d7d572ed59bfa0b209c79c5d99299`. Worker `readfirst_lanes`, verified Astra/high. Chef owns canonical ledger, acceptance and findings.

## Outcome and boundary

All eight assigned files were read fully, top to bottom in path order: **5,458 lines**. No assigned sections remain unread. Every file matches both the target Git blob and checkout. The TSV inventories **646 function-like definitions, including 146 test declarations, plus 15 top-level fixtures/constants = 661 rows**. Parameterized and opt-in tests are counted as declarations, not expanded/passed cases. No exact normalized test-body duplicate groups were found.

**No new confirmed defect.** The tests contain substantial concrete arithmetic and rejection oracles. Coverage limitations below do not by themselves establish implementation defects. Batch4's settlement-finality candidate is unchanged; no new writer/admission evidence was sought.

`audited` in the TSV means the test/helper source was reviewed. It does not mean that a test passed, the source implementation is correct, a stored claim was independently qualified, or the full reader chain was audited. No Vitest, application import, browser, HTTP, provider, database, training or production execution occurred. No application/test edits. Only local Git blob reads, TypeScript AST inventory and artifact validation were run.

## Pin/read manifest

All paths below begin `web/__tests__/pages/api/v1/`; each was read from line 1 through the listed final line. Target copies are in `/tmp/astra-web-tests-9/`.

| File | Lines | Bytes | Target SHA-256 | Functions / test declarations |
|---|---:|---:|---|---:|
| `start-chart.test.ts` | 2851 | 138764 | `88592991d369fa7aff7c179b3704c75ffc07e37d20d0bf6c6fdce76e09fabf0f` | 319 / 79 |
| `sustainability/trend-bands-values.test.ts` | 312 | 12100 | `7090fcaf36332528b0f6c798fb6227843a4fd5c0ad6c1a0787a1a204d6f11c4c` | 48 / 9 |
| `sustainability/trends-coverage.test.ts` | 143 | 4070 | `829c9a7790fb81637b8025c9b2f273a205f9e4c5a3600dab4a339f6196ebbdd5` | 19 / 2 |
| `transactions/ownership-trends.test.ts` | 559 | 26735 | `148e8a607e98bee2b21af1b7012f0443fffac0374c681944b75edd124fac015a` | 85 / 24 |
| `trends/player-trends.test.ts` | 267 | 7696 | `cb86139455e06976ce0eb708fd69d9550913ec916db6ddc26a7780cd80e3387b` | 37 / 9 |
| `trends/skater-power.test.ts` | 743 | 20763 | `53429a917dd624b3a040a4953333ec1b28cdc73ddf8be1a6360edd285894aa34` | 64 / 14 |
| `trends/team-ctpi.test.ts` | 382 | 10592 | `28e1e01ed154822a2bde5b706174e0b1e08a5bd7b81f25d62b1bcd03cd34293a` | 44 / 5 |
| `trends/team-sos.test.ts` | 201 | 7339 | `69d34145e7c47bbb51d195706cb79189dbadef16c32aa7ce67e0233d8490cb82` | 30 / 4 |

## Contracts and assertions

Prior governing owner decisions/rules and lane records were reused: explicit missingness, same-grain numerators/denominators, original issuance/cutoff/expiry, per-target permission, conditional versus unconditional meaning, stable identity and scope, no invented forecast qualification. Particularly explicit local anchors are decision34 (completed-prior-season usual-range baseline), decision26 (trend adjustment remains neutral pending validation), D10 (tied midrank percentile), and decision146 (SOS headline points percentage). Test references below are source evidence, not runtime receipts.

### start-chart.test.ts — 1–2851

**Fixtures and isolation.** Imports include real route/shared scoring, normalization, revision admission, planning, transport and policy code. The daily expectation reader, database, season lookup and team ratings are mocked. `createQueryBuilder:74–124` ignores most filters, sorting, limits and pagination; it merely records selected `eq`/`gt` calls and returns a resolver. This deliberately tests returned-row guards in some cases, but does not prove SQL predicates or paging. The external-proof fixture supplies synthetic approved observations. `dailyExpectationFixture:185–209` builds two fictional skaters with six baseline heads and missing PIM/TOI; `goalieExpectationFixture:219–229` adds synthetic participation. Released flags in these fixtures are explicitly engineering inputs, not public source qualification. Setup492–682 freezes the clock and injects one game/run, two Yahoo identities, goalie start-share and approved CTPI rows.

**Independent arithmetic and parsing, 232–489.** Competition ranking is pinned to `[1,1,3]` within eligible positions; a null goalie score has no rank. Duplicate-player game rows remain distinct with ranks `[1,2,2]`. xGA ease grades map `[2,3,3,4]` to `[0,50,50,100]`, ignore unknown and return50 for a singleton. TOI900+180seconds becomes18minutes; all-null, negative and >3900second input is unavailable. Previous-date logic handles March1→February28. Yahoo mapping selects exact slate team, collapses matching seasonal player suffixes and rejects unresolved conflicting identities. Ownership uses latest-on-or-before slate observation, rejects blank values/future-only data and retains true zero. Legacy/enriched response normalization preserves nulls and date/fallback metadata. These would detect ordinal-tie drift, seconds/minutes confusion, coercion of unknown to zero and future ownership leakage.

**Native reader/value permissions, 684–962.** No legacy DB/RPC read, invented run lineage or appearance probability is allowed. The fixed skater example has conditional fantasy points9.65 yet no comparable rank. Eastern midnight boundaries are explicit. No-game versus unmapped-team partial slate is distinct. The parity test749–798 checks two players × one game × eight heads across FORGE view decode, RSO transport+resolver, API and UI parse, including four missing PIM/TOI target entries with reasons. It is a shared-fixture consistency test: several consumers reuse the same builder and cannot independently validate its math.

Oversized responses return503/no-store. A missing default-scoring head makes total points null; an explicit blocks-only profile still scores2.5/5 and stays unranked when comparison is prohibited. Exact-game conditional SOG2.5 cannot leak into next date's cache, acquire sample size, participation or rank. Expected zero is retained; expected/conditional boards do not mix values from denied heads. Original two-second expiry bounds cache headers and reload. An all-unusable player is omitted while the game remains. Start-probability comparison requires that participation source's own permission, not unrelated wins permission; probability-only rows retain the participation expiry.

**Serving gates and proof selection, 964–1384.** Invalid/out-of-canary revisions withhold players without substituting legacy rows. Returned private/local/null-SHA raw runs are rejected. Two cases1006–1076 use a real Supabase query builder with a custom in-memory `fetch` to assert query serialization, status/SHA/horizon filters, candidate-limit20 and selected-limit1; no socket is needed by those fixtures. Their URL oracle partly imports `runHorizonFilter(1)`, so it verifies consistent serialization more directly than independent filter semantics. A newer h5 run cannot hide h1; disabled revision serving is independent of canary.

Malformed/missing captured receipts, issued contexts, roster/schedule identity, future cutoff, expiry and participation reject revisions consistently with RSO. News-read failure is unavailable without leaking internal text. Unapproved external-input contracts reject selected revisions. Missing ES/PP/PK heads never become complete goals/assists/FP totals; supported shots3.5 and PPpoints0.3 remain available. Legacy clean-run proof comes from the captured snapshot rather than run-start metrics; newer unproved runs do not hide the latest proved run, and proof-read error closes admission. Client `forecast_source` cannot override server source selection. Flagged fallback marks all rows; empty native source keeps games/no players. Cache keys include source kind/head revision and cannot outlive three-second catalog expiry.

**Caller and optional-packet evidence, 1386–1554.** A-4 scans seven caller files for the endpoint literal and absence of `forecast_source`, then invokes the same API three times and normalizes bodies. It does not execute those caller components/fetchers or prove every caller parses its response. The claimed parity therefore has a lexical caller boundary plus a real normalization boundary.

The opt-in packet test1433–1554 verifies a supplied file's SHA, one future game, two distinct eligible skaters, one active slot, scope/identity/lineage, externally supplied expected stats/ranks/selected player, and unchanged packet bytes. It is skipped without `START_CHART_ACCEPTANCE_PACKET`; it was not run here and packet authenticity/issuance is expressly separate. The regular parity test can write a receipt to `START_CHART_PARITY_RECEIPT` when that environment variable is set (783–796). This optional filesystem side effect was identified and not invoked. Neither opt-in mechanism provides retained acceptance evidence merely by existing in source.

**Cross-consumer regression cases, 1556–2043.** Rejected duplicate sentinels cannot reenter via a shared admitted key. Wrong-team goalie starter identity must not change admitted team; that particular test asserts team only, not its probability/score. Overfull team goalie mass is rejected through `publicPlanningForecasts` in1585–1596; that test does not call the Start Chart API. Adjacent candidate-set API tests1711–1736 cover valid partial mass0.3/0.6→saves9/18, duplicate IDs and missing probability. Missing starter rows do not hide an admitted goalie. Expected score drives pagination, and full-slate ranks persist across page/cache requests; zero appearance yields score0/rank2 while missing target yields null/no rank.

Malformed horizon and incomplete/duplicate/stalled planning reads withhold forecasts. Stale unchanged schedule is explicitly degraded; excluded canary games remain in slate coverage. Conflicting skater identities/opponents withhold. Newer selected revision replaces old sentinel; POST private scoring cannot contaminate GET cache. Accepted news after original cutoff blocks until a newer cutoff/publication. Probability0/1 yields goals0/0.6. The crowded-day test1801–1868 first asserts production RSO review list empty and comparison/projected value unavailable, then injects a fictional review/binds fixture forecasts to compare goal-versus-shot selections; revocation closes it again. This proves conditional engineering behavior, not actual RSO approval.

Scalar participation mismatch, absent authoritative evidence, conditional-only and unknown participation all withhold output. A PPP-only packet preserves0.3 while all unsupported heads and default FP stay null; category scoring can rank that permitted head. A missing PK goal head leaves supported shots3.5 intact. Goalie start0.5 × conditional saves30 produces15 exactly once, while1.1 is rejected; conflicting legacy starter0.9/confirmed status cannot override the admitted0.5. Unproved prior revisions cannot become comparable history. Public provenance excludes private evidence/policy fields and does not fabricate validation counts. Custom scoring reuses shared forecasts but stays private/no-store; unsupported FACEOFFS_WON is422.

**Legacy context and API boundary, 2045–2851.** The recent-goals fixture2045–2063 admits scored4–2 and excludes0–0 PBP rows, checks season, and expects `nhl_final_scores`. It has no explicit game-state field and cannot prove all admitted scores are final; this is a test-coverage limit, not a new finality finding. The canonical run fixture2065–2208 pins weights3/2/1/0.2/0.2/0.25 and FP4.22 from goals0.6, assists0.6, PPpoints0.3, shots3.5, hits0.6, blocks0.4; eligible rank and lineage/query keys are checked. Goalie confirmed status yields1 while the source basis remains descriptive L10 start share. Compatibility labels and a 200-row synthetic payload budget are asserted, not production ownership or real payload load.

Bounded Yahoo RPC avoids serial history reads; absent-RPC fallback selects latest historical73, ignores future current99 and caches; unmapped optional Yahoo data preserves canonical player/unknown ownership. Unapproved CTPI rows hide; approved v1 cannot masquerade as served v2. Upcoming schedule fallback works without old projections; past requested date clamps to today. Scheduled slate with missing skaters stays partial, no eligible slate stays no-games, and a65-date workload caps cache at64 with no completed in-flight entries. Failed or empty weekly-volume reads both keep null rather than0. Invalid dates, positions, repeated parameters, page size201 and unavailable controls fail before data reads. Position pagination is deterministic and dependency errors expose only the stable public code.

### sustainability/trend-bands-values.test.ts — 1–312

Real POST route, band service/calculator, usual-range reader and FORGE adjustment helper; auth is identity-mocked, persistence methods do nothing, and fake `eq/lte/in/order` do not filter. Service calculations are exercised in source scenarios, while DB membership/authorization/write behavior remain outside these oracles.

- **108–140:** three shots/1080seconds gives10/60 with missing NST fallback; baseline200/72000seconds also10. Discounted exposure is `Σ exp(-ln2*g/5)*18` minutes, with usual range count15/exposure90/neutral/validatedfalse. Detects60× rate error and exposure-unit drift.
- **142–158:** altering older suffix games cannot alter newest-three window; zero shots yields unknown/no_window_exposure, not a fabricated shooting percentage.
- **160–178:** null NST count is excluded rather than zero: two0.6 counts/20minutes give1.8/60, covered2of3 with partial warning; all-null yields no band.
- **180–205:** 5v5 numerator pairs with5v5 TOI, not broad ES time. Adding300 ESseconds changes nothing; baseline/observed2 and query includes `toi_per_game_5v5`.
- **207–239:** baseline750 PPgoals/6000minutes=7.5/60;5goals/20minutes gives observed15 but central80% count interval1–5→rate3–15, tail between0.10/0.12 and neutral. Shrunk `band.value` is below observed;12goals is hot. This is a numerical synthetic distribution check, not empirical80% calibration.
- **241–270:** zero baseline with0for20 remains neutral; varying current-season totals cannot affect the usual range or completed-prior-season membership. No prior season gives unknown, never the same streak as baseline.
- **272–292:** IPP3points/2on-iceGF is rejected; two valid1/2 games yield0.5, coverage2/count2/exposure4. Missing baseline on-iceGF cannot fall back to ES-GF; baseline48/35>1 produces no band.
- **293–311:** doubled shot rate is descriptively hot while the current FORGE own-interval reader remains neutral/multiplier1. This tests the validation gate's consequence for that fixture, not scientific usefulness of the signal.

### sustainability/trends-coverage.test.ts — 1–143

Real route/guardrails; source scores, identities and history are mocked. `scoreRow` supplies numeric zeros plus explicit missing-input warnings, with synthetic `s_100=50`; this is not a score-calculation test. **94–123** drops all-missing row1, marks one-missing row2 provisional/degraded, and keeps complete row3 ready/ok. **125–142** excludes luck-only/no-skill row4. These detect promoting fallback-neutral50 or incomplete coverage to ready. They do not show score weight arithmetic, producer warning correctness, or actual snapshot freshness; the snapshot query always returns the same date.

### transactions/ownership-trends.test.ts — 1–559

Real trend/snapshot routes, metadata helpers and final client adapter; Supabase constructor is mocked. Most database mocks ignore sort/range; dedicated page fixtures implement slicing, while snapshot mock explicitly returns at most1000 and count. Synthetic environment values are set by tests; no actual client/network is constructed here.

- **56–154:**1001 rows require ranges0–999 and1000–1999 with season filter calls. The4438-row fixture hydrates histories exactly once, in nine ≤500-key chunks, zero history offsets, then restores original page order despite reversed returned chunks. Missing hydration fails instead of silently dropping a player. These detect truncation and repeated aggregate OFFSET work; they do not reproduce Postgres execution cost or stable sort under concurrent mutation.
- **156–205:** exact seasonal keys map477.p.112 and465.p.112 independently; duplicate/conflicting/malformed identities stay unresolved. F includes C/LW/RW; object metadata normalizes without `[object Object]`. Freshness is latest source timeline date, not request clock.
- **207–248:** same-day ADP takes latest79, invalid0 is excluded;100→80 is a+20 riser and100→120 is−20. Ownership50→52 is2 percentage points (`deltaPct=2`), distinct from relative-percent ADP movement.
- **265–284:** both routes redact internal exceptions to stable500 responses.
- **312–415:** concurrent3/5-day windows share source scans but produce deltas5/20, subsequent cache does not reread. Mapping census counts six seasonal source identities as2mapped/4unmapped independently of mover eligibility or display filters; it is not six distinct NHL players. Wrong-season/numeric-only keys cannot resolve a trend, and requested-season versus fallback census is explicit.
- **417–482:** snapshot exact seasonal key wins over same numeric suffix; intentional numeric legacy fallback is tested separately. Eighteen inputs distinguish true0/numeric decimal from null/blank/bool/exponent/hex/object/out-of-range/Infinity. Each last valid observation retains its own date, including0 before a newer invalid point. Unresolved NHL IDs are never reused as Yahoo IDs; conflicting map or name match yields ambiguous_identity/null.
- **484–526:**1001-row truncated snapshot fails closed;501-player request rejects before reads; duplicate IDs collapse; unique name fallback retains original observation date. Exactly500 players succeeds with one mapping plus one ownership query and all true zeros retained.
- **528–558:** mocked fetch calls both real handlers and the real client adapter. Even if trends has latest60/delta10, an authoritative ambiguous snapshot forces client ownership/delta unknown and clears sparkline. The unambiguous case retains60/10. This is an end-to-end in-process client/handler contract, not a browser/network/production check.

### trends/player-trends.test.ts — 1–267

Real normalizer/calculator and route; season and DB are mocked. All route DB queries return empty data, so successful rebuild199–221 proves authorized bounded empty handling, **not** successful upsert of nonempty metrics.

**82–88:** IDs12,16 deduplicate/filter invalid values, empty parser result remains unspecified; route case183–197 separately rejects an explicit empty player list. **95–131:** playoff TOI1203 remains seconds; shots/60=`4*3600/1203`, season average is arithmetic average with regular12, sample size2, TOI average1201.5seconds. Output emission starts in playoffs while regular-season accumulation persists. This directly catches the60× conversion regression but does not test every trend metric or whether another desired aggregation contract should be exposure-weighted.

**152–238:** missing auth configuration503, retired bearer401 before season read, wrong season/too-old start/too-old repair date/empty IDs400. Accepted fake clock March15 repair defaults writeFrom March8 while reading from season start, processes zero records. The test titled “missing or retired bearer” supplies only the retired value. Dependency details stay in mocked server diagnostics and out of public500. **247–266:** GET read errors likewise redact. These fixtures do not verify DB permissions, nonempty rebuild writes or the exact250/251-ID boundary.

### trends/skater-power.test.ts — 1–743

Real route with season/database mocked; fake dotenv prevents environment-file loading. `buildSupabaseMock:76–175` implements page slicing, records order/select, and optionally delays each query5ms to measure overlap. Other predicates are no-ops; every metric category sees the same rows. Tests of category count derived from `SKATER_TREND_CATEGORIES.length` verify fan-out consistency, not independently that the registry has the right categories.

**190–288:** materially stale source gets blocked/error/partial with source-date `generatedAt`; exact date gets requested_date/none/nonpartial. These check freshness semantics, not current production freshness. **290–407:**1001rows reach second page; order calls require date descending/playerID ascending, but mocked rows are not actually sorted. Independent categories overlap and only chosen rolling5 column is selected. **409–442:** twenty most recent values2…21 average11.5. **444–487:** returning12 points preserves full-history gp50/rank1 and starts visible gp39. **523–574:** metadata82 caps request100 to82; metadata84 permits84; unavailable season length preserves84 observed. **577–621:**60×82 fixture clamps limit50 and series1; serialized body≤280000bytes. No real-server performance claim follows.

**623–667:** six games shrink raw100 percentile to80 (`50+(100−50)*6/10`), mark low confidence and suppress previous rank/delta. **669–712:** `[5,5,9]` produces raw midrank percentiles25/25/100; equal values use deterministic IDs. The title/comment mention independence from input order, but the tied fixture itself is not rerun reversed. **714–742:** stable redacted error. Missing/NaN/raw duplicate dates or cross-category contamination are not covered by these inputs; absence of a case is not a defect claim.

### trends/team-ctpi.test.ts — 1–382

Real reader route; fake season/DB. **65–157:**1001 daily rows require two ranges; latest source dateFeb1 is distinct from request/computationFeb2, generatedAt derives from source date, coverage32teams/1001rows is partial because fallback. Fixtures deliberately repeat team/date rows for pagination, so this is not deduplication proof. **159–238:** candidate_unapproved rows hide, preserving trusted0/untrusted1 and explicit warnings; only `team_ctpi_daily` is read, with no formula recomputation. **240–339:** the mock enforces formula-version equality; approved v2 is selected with pregame label while unknown offense/luck stay null; explicit v1 selects historical formula and through-date label. **341–381:** unknown version3 rejects before query; internal failures redact.

The cutoff/formula/publication labels are reader assertions. They do not establish producer pregame exclusion, empirical validation, provenance authenticity, numeric CTPI formula or actual publication state. Full upstream and downstream implementation remains pending its assigned audit turn.

### trends/team-sos.test.ts — 1–201

Real route; mock enforces `eq`, sorts a selected key descending before limit, ignores explicit sort-direction options. **119–163:** latest v2Jan14 wins overJan13, v1 and v3 are excluded. Headline points% is independently pinned to `(0.65*30+0.45*50)/80=.525`→52.5, while win% is.475. Pending2 fixtures are disclosed and excluded from past count; zero future fixtures yields past.65 alone, but unknown future with50fixtures leaves combined null/rank last. Order is BBB,AAA,CCC. **165–170:** tied values ordered team alphabetically despite reversed fixture input. **172–180:** no v2 produces empty/not computed, never v1 fallback. **182–200:** stable redacted error.

“Final games only”, retrospective definition and cutoff are asserted labels on precomputed rows. No finality query, opponent aggregation, indirect-strength arithmetic or exact producer fixture weights are executed here. The weighted combination itself has a concrete independent oracle; the upstream meaning of its stored inputs still needs its own audit.

## Evidence limits worth preserving in integration

1. **No runtime pass receipt:** source assertions reviewed, no suite run. Optional packet test remains unexecuted/possibly skip-gated, not failed.
2. **Shared helper agreement is consistency:** Start Chart/RSO/FORGE parity often shares resolvers; fixed expected values supply independent arithmetic checks only where explicitly asserted. The lexical caller scan is not seven actual consumer executions.
3. **Labels do not prove provenance:** CTPI pregame cutoff, SOS final-games, recent-goals finality, synthetic approval and validation labels require producer/receipt evidence outside this batch.
4. **Mock database semantics are selective:** filter-call assertions and page slicing cannot establish production SQL ordering, completeness, RLS, atomicity or cost. Ownership's in-process client integration is stronger than a response fixture, but still wholly synthetic.
5. **No inferred finding from gaps:** wrong-team goalie test's team-only assertion, nonempty rebuild absence, derived registry expectations and untested reverse tie order are limitations only. No implementation source was additionally audited, and whole imported reader paths remain pending.

## Verification and handoff

`git show 89da739cb:<path>` materialized all eight target blobs; byte/hash equality against the checked-in target and current files was checked. `node /tmp/astra-web-tests-9/inventory.cjs` exited0 using Node standard libraries and the TypeScript parser, without application imports. The inventory is a separate completeness check after full manual source reading. TSV columns are exactly `path,symbol,kind,computes,verdict,finding_ids,test_that_pins_it`; repeated same-line anonymous names receive occurrence indices.

Final schema/count/unique-symbol/whitespace results are recorded in the diary after execution. Only the two assigned batch artifacts and our diary were written inside the repository. Chef retains canonical status and any later finding decision.
