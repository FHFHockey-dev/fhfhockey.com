# Independent FHFH contribution audit — 2026-10-22

The highest-value action is to repair the historical evaluation cutoff before using the new reconstruction results to qualify another model release. Nine synthetic reproductions demonstrate correctness failures; four existing provider route assertions also fail on the shared local candidate. No critical authorization or private-data exposure was demonstrated in the inspected paths. This audit does not authorize implementation, publication, migration, rollback, or deployment.

The work shows substantial useful test coverage and appropriately documented release splits. The remaining problems concern evidence validity, incomplete data, and asynchronous state. They do not support a judgment about model-brand reliability.

## Boundary and provenance

- Source snapshot captured **2026-10-22 00:13:06 UTC** at `/Users/tim/Code/fhfhockey.com`, branch `octoberBranch`, HEAD **a811b0762ffe29006c3df7eaa4c19bf18deecda3**. `snapshot-start.json` hashes 3,562 source/configuration/diary/register files with SHA-256; `status-start.txt` records pre-existing dirty and untracked work. These are audit fingerprints, not an atomic Git commit. Later comparison found no changes to the fingerprinted files during the pass.
- The recorded release comparison is **origin/master 248df9923cfbd00705222bb8ad9126a169bf8773 (R20)**, following **3929c64224 (R19)**. Local `master` is stale at **457435eb3** from October 15 and was **not** used as the released-code baseline. No Git refs were changed or fetched. Production deployment identity was not independently inspected.
- Focused boundary: R11–R20 releases, **7baa91407 → 248df9923**, the unreleased FORGE inventory, and local stats/provider overlays. Named development inputs include `afa8cac9ba` (pipeline/RSO repair), `1bc536e8b7` (bridge Q9), `8cfaba0fc7` (ledger), `6767073ea3` (hydration, older October 11 dependency), `34a5588db2` (physical-event rescale), and `f9fee4fb04` (new reconstruction verdict). The large `b8fe1072ed` checkpoint is explicitly mixed ownership.
- Read: repository `AGENTS.md`, `mise-en-place.md`, Supabase security skill, local accessibility review skill; current handoff/master task list, Chef register, FORGE release inventory, reconstruction verdict/report, streamlining register and relevant Claude/Codex diaries. No raw session stores, secrets, environment files, live account data, or production APIs were inspected.
- Git commits are authored TJ. Claude-labeled handoffs establish workflow attribution for the pipeline/RSO/FORGE and stats slices; they do not independently establish which model wrote each line. Provider-sync changes are Codex-labeled concurrent work. The cutoff bug predates these contributions. Findings preserve these distinctions.
- Detailed hashes and release equality checks are in `finding-file-fingerprints.json`. Source numbers below refer to the pinned snapshot and matched active files, not a guarantee that later edits retain those line numbers.

## Prioritized findings

### A1 — P1: historical reconstruction admits target-game context

**Impact:** empirical release evidence can use the game's observed shot quality/on-ice environment to predict that same game. Shared leakage across paired arms does not establish an unbiased comparison; its interaction with a changed model can alter the measured effect.

**Evidence:** `web/lib/projections/queries/skater-queries.ts:562` uses `.lte("date", cutoffDate)` against `player_stats_unified`. The stage passes the target slate's `asOfDate` at `web/lib/projections/stages/skater-stage.ts:1953`. The canonical view is per-game data (`supabase/migrations/20260716112908_production_schema_baseline.sql:22793`, joined to NST by game date at `:23034`). The reconstruction calculation at `web/lib/projections/run-forge-projections.ts:578` calls that same stage against current stored rows; its transport fence prevents writes, not look-ahead. The context function is identical in R20. Git blame attributes the inclusive predicate to **c1113b62ffa (March 3)**, not the recent Claude work.

**Reproduction:** `temporal-cutoff.log`, synthetic `auditTemporalCutoff.test.ts`: prior-day context plus a target-day completed-game context; requesting the target date selects target-day `nstShotsPer60=99`, `nstIxgPer60=9`, and on-ice xGF 99. The strict-cutoff assertion fails. The existing context test at `skater-queries.test.ts:575` explicitly expects `lte` and never inserts a target-day row.

**Claim comparison:** `f9fee4fb04`, `hydration-recon-verdict.md:9` acknowledges current/backfilled data but calls paired comparisons “clean.” A shared-input replay and its three scorer tests do not establish temporal validity. The numerical extent of contamination in the 248 historical captures was **not** measured here; private captures were not read.

**Surgical scope:** make this per-game history read strictly precede the target date (or enforce a defensible timestamp/availability contract), add a target-day fixture, and audit the remaining reconstruction input cutoffs. Requalify from already captured inputs offline where possible; separate corrected evaluation from model changes.

**Confidence:** high for the executable leakage path; unknown magnitude in reported cohorts. **Release implication:** existing reconstruction numbers cannot alone qualify hydration/physical-event or further calibration releases. No automatic rollback recommendation follows from this audit.

### A2 — P2: a null newer skater line suppresses a valid exact-game line

**Impact:** RSO loses a usable forecast for today's game and can become schedule-only even though FORGE issued a complete exact-game projection.

**Evidence:** `web/lib/rosterScheduleData/forgeDailyBridge.ts:373–380`: the exact-game lookup sits inside `if (stale || stats)`. When a newer tomorrow row is not stale but its learned heads are incomplete, `stats` is null and the loop never reaches today's complete row. `skaterStats` rejects null G/A/SOG at `:237`.

**Reproduction:** `edgecases.log`, first test: complete today row + later-issued tomorrow row with null ES assists → **zero forecasts**, including none for today.

**Surgical scope:** iterate upcoming games and attempt exact-game admission independently, then gate only the re-aimed fallback on the latest complete line. Extend the existing bridge regression with the null-newer case.

**Confidence:** high. **Attribution/release:** Claude-labeled Q9 change `1bc536e8b7`, released in **8b99c22d2 (R17)**; file matches R20. The null-head policy itself is still partly unreleased. Production incidence is unverified; fix before expanding partial-head serving. This narrows the earlier claim that own-game rows always win.

### A3 — P2: ledger settlement confuses partial ingestion with DNP

**Impact:** actual output is fabricated as zero, dressed players become phantoms, and model error/calibration can be biased until a later correction. The three-day replay does not guarantee recovery if data arrives later.

**Evidence:** `web/lib/player-forecasts/servedForecastLedger.ts:164–176`: one actual row for a game/class makes every missing player DNP. The route at `web/pages/api/v1/db/forge-served-forecast-settle.ts:40–48` checks neither final game state nor a complete ingestion receipt. Missing and partially ingested players are indistinguishable.

**Reproduction:** `edgecases.log`, fourth test: only unrelated player 999's actual arrives for game 100; forecast player 11 becomes `dressed:false`, `act_fantasy_points:0`, with a settlement timestamp. Intended “still unknown” assertion fails.

**Surgical scope:** require finality and verified class/team ingestion completeness before inferring absence. Known actuals may settle individually while unproved absence remains null. Add partial-load and subsequent-recovery fixtures.

**Confidence:** high for missing-guard behavior; current production occurrence not tested. **Attribution/release:** Claude-labeled S-B `8cfaba0fc7`, **R19 3929c6422**, identical in R20. Correct before using the ledger as a model acceptance gate. Existing tests at `servedForecastLedger.test.ts:77` bless DNP from a one-player actual set, so they do not establish completeness.

### A4 — P2: ledger coverage omits players with no source row

**Impact:** the scoreboard overstates coverage, especially for debuting or otherwise entirely unprojected players.

**Evidence:** `servedForecastLedger.ts:115–151` emits rows only when a bridge/native forecast or naive history exists. `:213–223` derives the dressed denominator solely from those emitted ledger rows. Complete actuals for a player omitted from all sources never enter the denominator. This contradicts the S-B design's universe of all identified roster players and “share of dressed players who had a forecast.”

**Reproduction:** `coverage-universe.log`: two identified players both dress, only one has any forecast/history. Output is **dressed=1, covered=1, coverage=1**, rather than **2, 1, 0.5**.

**Surgical scope:** preserve an independent player-game universe/actual denominator and compute source coverage against it. Keep absence of a prediction separate from an actual zero. Changes belong in the ledger build/settle/score contract and its tests; choose storage representation during implementation.

**Confidence:** high. **Attribution/release:** S-B/R19, same file as R20. Scoreboard coverage is unsuitable as a qualification metric until corrected.

### A5 — P2: historical Yahoo lineup points turn a missing weighted stat into zero

**Impact:** a displayed “actual” fantasy-point total is understated instead of unknown.

**Evidence:** `web/lib/integrations/yahoo/rosterPlanning.ts:79–82`, `Number(own[column] ?? 0)`. This is distinct from a verified non-participant legitimately scoring zero.

**Reproduction:** `edgecases.log`, third test: actual GOALS=2, HITS=null; both weights 1 → displayed **2 points**, rather than unknown.

**Surgical scope:** reject null/undefined/blank weighted fields before numeric conversion; retain zero only for valid numeric zero or independently established DNP. Add null-weighted versus zero-weight cases to the nearby test.

**Confidence:** high. **Attribution/release:** Claude-labeled past-lineup slice, **02de560f9 (R14)**; helper file equals R20. Correct before claiming recorded lineup points are complete.

### A6 — P2: late progress checkpoints hide expired killed leases

**Impact:** the claimed three-kill terminal protection can miss a killed invocation and allow repeated retries of a problematic tail.

**Evidence:** `web/lib/rollingForgePipelineRunState.ts:72–80` classifies a dead lease by `leaseExpiresAt - updatedAt > 60s`. Checkpoints retain a fixed absolute 270-second lease while updating `updated_at` (`run-rolling-forge-pipeline.ts:1382–1388`, similarly projection cursor `:1412`). A checkpoint after second 210 leaves at most 60 seconds, looking like a deliberate short handoff. The kill counter is reached only through that classifier (`:1268`).

**Reproduction:** `edgecases.log`, fifth test: in-flight checkpoint at +215s, fixed expiry +270s, inspected at +301s → **dead=false**. The “detect killed holder” assertion fails. An actual kill/hang after such a checkpoint was not simulated end to end.

**Surgical scope:** record explicit handoff versus in-flight ownership state rather than infer it from a shrinking time interval; test late checkpoints. Also make kill counting idempotent per expired lease before relying on it under concurrent retries.

**Confidence:** high for classifier misidentification, medium for operational frequency. **Attribution/release:** Claude-labeled repair `afa8cac9ba`, **5e4551c75 (R12)**; file matches R20. Reliability fix; no operational retry authorized here.

### A7 — P2: stats totals combine mismatched observed samples

**Impact:** partial rows produce precise but false season shares and per-game rates across TeamDashboard, Advanced L10 and strength cards.

**Evidence:** new `web/lib/stats/percentUnits.ts:39–48` skips missing values independently; `:105–136` and `:161–205` divide independently accumulated numerators/denominators or divide a partial sum by all games.

**Reproduction:** `edgecases.log`, second test: `(CF,CA)=(10,null),(10,10)` produces **66.7%**; PP goals/opportunities `(null,5),(1,5)` produces **10%**; shots/game `null,30` produces **15**. These are neither complete season totals nor ratios from a common observed sample.

**Surgical scope:** use matched samples per metric and disclose their exposure/coverage, or return null when season totals are incomplete. Keep legitimate 0/0 and zero-event games distinct from unknown fields. Add asymmetric-null and missing-exposure fixtures.

**Confidence:** high. **Attribution/release:** uncommitted Claude-labeled S01, SHA-256 `96e54378…`; not present in R20. Hold this local stats slice for correction; current tests cover all-null/zero cases but not asymmetric missingness.

### A8 — P2: a rate-limited goalie page becomes a silent complete chart

**Impact:** season shares and L10/L20/L30 windows use only the returned subset, potentially skipping recent games or an entire goalie, without visible incompleteness.

**Evidence:** `web/components/GoalieShareChart/index.tsx:216–218` returns null after a repeated 429; `:252–258` converts it to an empty page; `:267–273` publishes the combined remainder. Only a console warning mentions partial data.

**Reproduction:** `stats-async.log`: valid first page of 100, total=200; page 100 repeatedly 429s. The component publishes a **100-game, 100%** chart and no visible partial/unavailable message. No real provider requests ran.

**Surgical scope:** preserve page failure/completeness through aggregation; withhold incomplete windows or clearly label/retry the incomplete sample. Add a mocked component pagination-failure test, not only pure aggregation tests.

**Confidence:** high. **Attribution/release:** uncommitted Claude-labeled stats load-time slice; not R20. Correct before shipping the pagination refactor.

### A9 — P2: obsolete Shot Map requests overwrite the current cached team

**Impact:** switching A → B → A while B is pending can leave team A's page showing team B's shots indefinitely until another refresh/input change.

**Evidence:** `web/hooks/useShotData.ts:64–72` skips loading the cached A key, while `:249–256` lets B's stale request replace data/key/loading state. There is no request ownership/cancellation check. The new cache makes the A return skip a fresh request; the underlying cancellation weakness was already present.

**Reproduction:** `stats-async.log`: A fully loads; B waits; navigate back to A (cache hit); resolve B. Current visible team remains 1 but returned `eventownerteamid` is **2**.

**Surgical scope:** generation/key ownership check for every success/error/finally state update, effect cleanup, and keyed data or cancellation as appropriate. Add A→B→A and hidden-tab pending-request tests.

**Confidence:** high. **Attribution/release:** uncommitted Claude-labeled load-time cache change; not R20. Fix before releasing this stats slice.

### A10 — P2 integration gate: four existing Yahoo route tests no longer reach their intended behavior

**Impact:** current shared-tree verification does not establish provider cooldown propagation, curated errors, paid access, and authenticated identity forwarding through the updated route.

**Evidence:** local `web/pages/api/v1/roster-schedule-optimizer/provider.ts:15` now calls the shared provider-sync gate. `web/lib/integrations/yahoo/rosterPlanning.test.ts:10–16,37` still mocks the previous capability seam without `eligible:true` or the Draft Pro fallback. Tests at `:517,529,541,548` fail (503 instead of 429/502/403 and missing success). These tests passed on the old seam; this is not evidence of a production permission bypass.

**Receipt:** `neighbor-tests.log`, **4 failures**, while new central gate/paywall tests pass. The provider handoff's 35-file/636-test selected-set receipt is not a passing gate for every affected consumer.

**Surgical scope:** update this test's entitlement boundary to the new contract while preserving its original assertions; test allowed, denied, outage and foreign-owner cases. Do not weaken authorization to make the tests pass.

**Confidence:** high. **Attribution/release:** mixed integration boundary: released Claude-labeled adapter tests plus uncommitted **Codex-labeled** provider-sync work. Require this suite green for that local candidate; do not attribute it solely to Claude.

## Risks requiring evidence, separate from demonstrated failures

- **Hydration + hits/blocks candidate remains unfinished.** The latest pinned Claude diary (`2026-10-21-claude-forge-projection-audit.md:78`) says the combined `c` reconstruction is in progress and migration 88's RPC is rejected by the reconstruction fence, leaving league rescaling off. The older hydration-only verdict is on R18, predates R19's official PP usage, and reports SOG/HIT calibration regressions. It does not qualify the final combined candidate, with or without migration 88. Require its exact SHA/files/configuration, league-rescale behavior and corrected-cutoff evidence. No production migration status was checked.
- **Pairing and survivorship:** public scoreboard errors are pooled per source over each source's own known rows, not a paired comparison. Missing-head and missing-player samples differ. A suitable qualification gate needs identical player-games/target coverage and explicit phantom/uncovered accounting; do not compare the raw source MAEs as a controlled experiment.
- **Counterfactual inputs and multiple effects:** existing code combines rest, team environment, opponent-goalie and trends through several paths, and team reconciliation can cancel or redistribute adjustments. I inspected these connections but did not independently fit or quantify double counting. Keep the existing Q7/Q8/model holds; run a bounded attribution experiment before adding or removing multipliers.
- **Payload envelope:** provider.ts compacts forecasts but does not apply the full UTF-8 response budget used by the data/workspace routes. The earlier R6 handoff already records this gap. No oversized real provider snapshot was generated here; retain as an acknowledged risk, not a new measured production failure.

## Verification and positive evidence

All tests ran in the `/tmp` source copy using **Node 22.11.0 and npm**, existing installed dependencies, one worker, synthetic `.invalid` Supabase configuration and a network-denial preload. No ignored env files were copied. No dependency install, remote API request, database execution, application build, commit, push, or deployment occurred. Unchanged application sources were not edited. The administrative context diary was maintained separately during the review.

| Batch | Existing test results | Receipt |
|---|---:|---|
| FORGE read/admission, bridge, continuation, ledger, Start Chart API/UI — 8 files | 409 passed, 1 skipped | `core-tests.log` |
| RSO/planning/workspace, stats, provider boundaries — 15 files | 450 passed, 4 failed | `neighbor-tests.log` |
| Model/accounting, official PP, rolling writer, reconstruction scorer — 6 files | 234 passed; 1 initial audit-copy fixture failure, subsequently passed in isolation | `model-tests.log`, `inventory-retest.log` |
| Deduplicated existing tests — 29 files | **1,094 passed, 4 failed, 1 skipped** | Above |
| New synthetic desired-behavior assertions — 3 audit-only files | **9 failed as described** | `edgecases.log`, `coverage-universe.log`, `stats-async.log`, `temporal-cutoff.log` |

The initial writer test ENOENT was caused by an inventory JSON omitted from my isolated copy, not a product defect. I copied and fingerprinted that referenced fixture, then reran only that case; it passed. Filtered-run skips are not added to the deduplicated totals.

Positive checks include local/off-release and h1 fencing; matched support identities, paginated rolling reads; workspace cross-owner denial/CAS/UTF-8 budgets; nullable and conditional expectation behavior; custom Start Chart scoring kept out of the shared GET cache; provider anonymous/free/outage denial; shared gate eligibility; official PP and physical-event accounting fixtures; rolling dropped-column identity/runtime preservation. No actionable accessibility finding was established in this data-focused pass; browser/assistive-technology behavior was not verified.

**Not tested:** live Supabase grants/RLS, real Yahoo/Fantrax authorization or payloads, payment behavior, production freshness/coverage/incidence, deployment identity, actual reconstruction cohort contamination or corrected model effect, full application suite, type-check/lint of the changing aggregate tree, browser/network/performance measurements, real accessibility flows, cron timing and post-kill side effects. Prior handoff type/lint/browser/backtest results are historical receipts, not new audit passes. Billing's separate review was not repeated.

## Snapshot drift, next actions, and handoff

`finding-file-fingerprints.json` records which finding files exactly match R20. The bridge, Yahoo helper, ledger and lease-state files do; the skater-context function matches R20 even though its surrounding file includes unreleased model work. Local stats and provider-route files do not match R20. No fingerprinted source changed during the captured review interval; final drift metadata records the exact ending refs and timestamp.

A later fixed-candidate pass remains necessary for the uncommitted **stats cluster** (`percentUnits`, TeamDashboard, AdvancedL10Metrics, GameStateAnalysis, GoalieShareChart, useShotData, statsPageFetch, player/team/index stats pages, PlayerRadarChart and tests), the **provider access cluster** (shared gates/hooks, provider/account routes and adapter tests), and the **hydration/physical-event export** under preparation outside this checkout. Inspection of pinned bytes does not certify these unfinished candidates or the entire octoberBranch delta.

Highest-value next actions:

1. Address A1 and requalify the exact combined FORGE candidate with strictly prior inputs before relying on the new backtest gates. Use existing captures offline where feasible; any new remote capture needs separate authorization.
2. Repair the small bridge/null and ledger-universe/completeness defects (A2–A4) with their focused fixtures; preserve truthful unknowns in Yahoo actual points (A5).
3. Fix the local stats null/sample and async failures (A7–A9), and repair the provider test seam (A10) before their candidate is accepted. Resolve the lease classifier (A6) with a late-checkpoint fixture; do not use production retries as QA.
4. Recheck only the changed candidate files and relevant suites at an exact reviewed SHA. No broad rewrite, billing re-audit, release, or operational execution is implied.

Optional enhancement: after the correctness fixes, expose observed-sample/forecast-coverage receipts in the affected stats and scoreboard views. This would help users distinguish a complete result from a partial one without introducing new forecasting features.

**Blockers/permissions:** none denied, pending, or uncertain. Live behavior and fixed combined-candidate qualification remain deliberately unverified under the read-only/offline scope. All useful evidence and runnable synthetic reproductions are in `/tmp/fhfh-claude-audit-20261022/`; `COMMANDS.md` documents the exact isolated test entry points.
