# FHFH In-Season Trust, Clarity, and Decision Workflow — audited PRD

Status: original source-level audit retained. Subsequent authorized local implementation and current evidence gates are tracked in [the execution plan](tasks-prd-in-season-trust-clarity-decision-workflow.md) and its October 1 decision/evidence receipt; the original audit's pending-policy notes below are historical.

Audit date: October 1, 2026. Source: the user-supplied October 1 PRD in this chat.

Repository baseline: `master`, HEAD `73af9d051`, **plus the current uncommitted working tree**.

Initiative: IST. Execution hierarchy: [tasks-prd-in-season-trust-clarity-decision-workflow.md](tasks-prd-in-season-trust-clarity-decision-workflow.md).

## Objective and boundary

Make existing in-season tools more trustworthy and easier to use together: identify changes, understand start/add decisions in league and schedule context, distinguish reliable information from uncertainty, and find the next useful action when inputs are missing. Correctness and useful supported results take precedence over new dashboards.

Included routes: `/`, `/start-chart`, `/roster-schedule-optimizer`, `/wigoCharts`, `/rankings`, `/game-grid/7-Day-Forecast`, and their directly relevant contracts/navigation. Preserve compact FHFH branding, positional colors, expert controls, connected/manual modes and existing entitlement boundaries.

Excluded: Draft Dashboard; pricing/access changes; new forecasting, trade, auction or dynasty engines; automatic roster transactions; notifications/sharing/multiple itineraries; broad redesign/framework changes; the separately approved player-resolution dropdown fix. Tweet identification/classification belongs to the separate PRD. No application code, migrations, production repair, deployments, merges or external tickets were authorized or performed here.

## Evidence standard and limitations

- **Defect** means a source-level failure demonstrated by code or a deterministic diagnostic. It does not establish deployed frequency or the cause of an individual historical row.
- **UX** means an improvement to existing functionality. **Implemented** means present in inspected local source; deployed parity is unverified. **Duplicate** means implement through an existing task, with this initiative adding acceptance coverage only. **Unresolved** requires additional records/runtime evidence before prescribing a fix.
- The supplied public browser observations at approximately 1180×757 are historical, signed-out evidence. This audit did not reproduce public pages, inspect an authenticated account, query production tables, or run mobile/browser QA. Screenshots and exact source record IDs were not supplied. Do not equate absent public data with missing authenticated functionality.
- The supplied Reddit research is qualitative context; its 12 discussions were not independently re-audited. No numerical satisfaction or impact claim follows from it.
- Existing modifications include RSO, forecasts, navigation and unrelated Draft/Shift Chart work. Their prior receipts are historical evidence, not tests run by this audit. Preserve them. No worker was dispatched: the runtime did not provide verifiable Chef model/effort settings required by `mise-en-place.md`.
- Read `AGENTS.md`, `mise-en-place.md` and `tasks/TASKS/rules/generate-tasks.mdc`. Applied the `better-writing`, `better-layout`, `better-accessibility` and `supabase` skills to bounded copy, acceptance and data-contract review. No holistic visual/accessibility approval is claimed.

## Existing-work reconciliation

| Existing work | Relationship and disposition |
| --- | --- |
| [RSO task plan](tasks-prd-roster-schedule-optimizer.md), October 1 FE-01/02/03/07/08/09 reconciliation | Owns coverage, provenance, conditional/unconditional forecasts, schedule-capacity behavior, budgets, goalie requirements, bounded planning and retained-input reconciliation. Do not create another forecast/readiness engine. IST-C adds guided setup and focused continuity acceptance; producer gaps remain with FE tasks. |
| [WiGO tasks](tasks-README.md), especially 1.0, 12.0 and 16.0; [comparison audit](TASKS/wigo-charts-audit/12-comparison-table.md) and [TOI audit](TASKS/wigo-charts-audit/16-time-on-ice.md) | Own D1–D4 pipeline/units/window work. Add the October 1 missing-TOI reproducer and window metadata acceptance to those tasks when implementation is authorized. The older audit's recent per-60/PPTOI unit concerns are partly superseded by current code and a passing writer fixture; do not redo the repaired unit conversion. |
| [Starter Board plan](TASKS/forge-projections/v1/tasks-prd-start-chart.md) | Existing board, source coverage, scoring, provenance and date behavior. IST-B is a gap/recovery extension, not replacement. Shared forecast producer work stays with RSO FE and FORGE. |
| [Rankings PRD](TASKS/contextual-hockey-rankings/prd-contextual-hockey-rankings.md), [original tasks](TASKS/contextual-hockey-rankings/tasks-prd-contextual-hockey-rankings.md), [post-alignment tasks](TASKS/contextual-hockey-rankings/tasks-prd-rankings-post-alignment-gap-audit.md) | Purpose is contextual historical/role-relative intelligence with expert filters and reproducible URLs. IST-E narrows to explaining default dataset/sample semantics; no new rankings product or model. |
| [GDL ingestion tasks](TASKS/lines-gdl-ingestion/tasks-prd-gdl-suite-ingestion.md), [tweet release record](TASKS/lines-gdl-ingestion/TWEET-PIPELINE-RELEASE.md) | Existing roster-informed identities, evidence spans, typed injury/goalie events, attribution and review flow. Reuse these. The separately named identification/classification PRD was not located by filename/content search; its definitive path/version is an integration prerequisite, not grounds for a competing classifier. Existing ingestion work is related, not assumed to be the exact separate assignment. |
| [Game Grid refactor tasks](tasks-prd-game-grid-refactor.md) | Covers `web/pages/shiftChart.tsx` and replay/matrices. Despite its name, it does **not** resolve the schedule grid's pickup-table issue. Preserve this unrelated work. |

Read-only GitHub inspection returned eight open issues and zero open PRs. Relevant issue bodies were read; no tracker mutation occurred:

- [#145 WiGO Page](https://github.com/FHFHockey-dev/fhfhockey.com/issues/145) links an external Google document, whose contents were not inspected. Treat it as related umbrella work, not evidence of identical acceptance criteria.
- [#146 LAST 7 should be last 7 games](https://github.com/FHFHockey-dev/fhfhockey.com/issues/146) has no body. Potential window-semantics overlap; do not equate LAST 7 with WiGO L5/L10/L20 without resolving the affected surface.
- [#143 Database Issues](https://github.com/FHFHockey-dev/fhfhockey.com/issues/143) contains legacy cron/NST/Yahoo data requests. First 2,500 body characters inspected; no inference about current production health.
- [#95 Game Grid load speed](https://github.com/FHFHockey-dev/fhfhockey.com/issues/95) has no body; performance work is outside this correctness scope.
- [#91 Game Grid query gray-out](https://github.com/FHFHockey-dev/fhfhockey.com/issues/91) identifies `/game-grid/basic?startDate=2024-03-04&endDate=2024-03-10`; preserve date/filter behavior in navigation QA, without adding that independent bug to this backlog.
- [#104 Enhance stats table](https://github.com/FHFHockey-dev/fhfhockey.com/issues/104) concerns shift/play-by-play statistics, not this pickup serialization defect. The other two open issues are Goalie Page and Line Combinations layout shifts.

No open issue is an established exact duplicate of the new pickup rendering or homepage first-subject problem. Closed issues/PR history were not exhaustively searched; reconcile exact matches again before external ticket creation, which remains unauthorized.

## Audited paths and causal evidence

All paths below are repository-relative; line numbers refer to this audit's working tree. Implementation must recheck them against later edits.

### A — News identity, certainty and provenance

Trace: `web/pages/index.tsx:27` → `fetchNewsFeedItems` in `web/lib/newsFeed.ts:463` → published `news_feed_items` plus `news_feed_item_players` at `:513` → `web/components/NewsFeed/NewsCard.tsx:300` and `web/components/HomePage/HomepageStandingsInjuriesSection.tsx:152`. The inspected editor writer is `web/pages/api/v1/db/news-feed-items.ts:143–205` (item payload plus subject rows); automation supplies assignments in `web/lib/sources/tweetNewsAutomation.ts:337–355,601–647`. The complete active automated persistence path and deployed flags still need confirming for the exact examples.

- **Confirmed presentation risk:** transaction title picks the first linked `player_name` (`HomepageStandingsInjuriesSection.tsx:157`), independently of the displayed claim passage. `getHomepageTransactionAction` at `:83` ultimately maps category SIGNING to “signing” without a certainty field. Neither proves which layer produced Kevin He/Barzal or the tentative signing; obtain exact item/tweet IDs, payload and all subject joins first. A multi-subject title can be misleading even with correct upstream identities.
- **Confirmed attribution gap:** `firstOriginalHandle` (`newsFeed.ts:214`) rejects relay accounts and `i`, but otherwise accepts a nonempty handle. A literal `SOURCE_ACCOUNT` is not explicitly rejected there. `getPublicNewsSourceAttribution` (`:245`) prefixes the accepted value with `@`; this permits the reported placeholder path. It attempts original-source provenance and null URLs already, so extend that boundary rather than inventing a new source lookup.
- **Timestamp distinction:** storage has `observed_at`, `published_at`, `created_at` (`newsFeed.ts:13–32`). `NewsCard` props omit `observed_at` and its display uses publication then creation (`NewsCard.tsx:33–34,311`). Publication time cannot silently stand for observation time.
- **Existing safeguards:** `tweetNewsInference.test.ts:161` verifies negotiation language cannot publish as OFFICIAL SIGNING. Subject-specific evidence extraction exists for injury/return/goalie categories in `tweetNewsAutomation.ts:340`; this is not a general transaction claim-binding guarantee.
- Reusable contract candidates: `TweetInterpretation` in `web/lib/sources/tweetInterpretation.ts:5–23` carries units, evidence, unresolved identities, context and certainty; `TweetPlayerEvent` in `web/lib/sources/tweetPlayerEvents.ts:13–23` carries canonical subject, state, evidence offsets and availability. It currently covers injury/goalie kinds, not every transaction. `NewsFeedItemPlayer` has role but no typed claim/evidence binding. Reconcile with the separate PRD before designing the public adapter. Keep practice/deployment observations distinct from confirmed game availability.

### B — Starter Board coverage and ranking

Trace: `web/pages/start-chart.tsx` → `web/pages/api/v1/start-chart.ts:829–966` → `games`, succeeded `forge_runs`/`forge_player_projections`, `goalie_start_projections` and revision/news receipts → `web/lib/projections/startChartContract.ts` and scoring → page.

- `start-chart.tsx:652–689` displays selected date, model/run/input unavailable states and textual status. `:733–755` discloses requested/resolved fallback and partial coverage. The API has error/missing/partial/ready source states (`api/v1/start-chart.ts:1838`), covered/expected goalie teams (`:1804,2002,2108`) and unavailable metadata. Preserve these.
- API fallback is automatic when the requested schedule has zero games (`api/v1/start-chart.ts:1145`). It only chooses eligible same-season earlier data and labels requested/resolved dates. It is **disclosed**, not a silent substitution. A useful improvement is an explicit recovery choice that keeps the requested empty slate available, rather than adding an undisclosed default-date change. Projection absence on a scheduled slate takes the partial path.
- `web/lib/projections/starterBoardScoring.ts:48` returns null points if any nonzero-weight input is missing; `web/lib/projections/startChartFantasyScoring.ts:88–101` excludes nonfinite/null scores from positional ranks. This already prevents false zero/tied numeric projection ranks. Alternative goalie ordering is named in the page controls (`start-chart.tsx:851`).
- Goalies are explicitly “confirmed” or “projected” (`start-chart.tsx:251–256,1068`). `web/lib/projections/goalieStarterMixtures.ts:151–172` retains unresolved probability mass instead of normalizing incomplete candidates to 100%. This is already improved local behavior, including uncommitted changes; release parity is unknown.
- Legacy goalie-stage probability uses `computeStarterProbabilities` (`web/lib/projections/stages/goalie-stage.ts:398`); revision serving maps candidate starting probability (`web/lib/projections/gameRevisions.ts:55`). The observed six teams' 100% values cannot be attributed to either producer without run/row/version evidence. Do not recalculate or relabel them as confirmations based on the screenshot.
- Source retrieval failure is distinguishable from absence in the API. Board-wide pending/failed/unsupported/stale projection distinctions remain incomplete evidence: news pending rows and goalie staleness do not establish every model-run state. Only add states backed by authoritative run/coverage fields. “Page refresh · 30 seconds” is UI polling, not a model completion ETA.
- `start-chart.tsx:705` links to the **current** seven-day schedule and labels that current context for historical slates. This is not a date-preserving link; retain that truthful label if adding a selected-date alternative.

### C — RSO guided setup and retained intent

Trace: `web/pages/roster-schedule-optimizer.tsx` → `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx` → `/api/v1/roster-schedule-optimizer/data` (`web/pages/api/v1/roster-schedule-optimizer/data.ts:3`) → `web/lib/rosterScheduleData/planning.ts` → `web/hooks/useRosterPlanning.ts` → `web/lib/rosterScheduleOptimizer/planning.ts`. Workspace/rules/intent are owned by `workspace.ts`, `planningTypes.ts`, provider adapters and reconciliation; no second league-settings source is justified.

- “Search canonical player” is present (`RosterScheduleOptimizer.tsx:320`); nearby rule/forecast explanations and advanced `<details>` exist, but no compact, control-linked four-stage readiness path was identified in the component. This is a UX extension, not a missing optimizer.
- `workspace.ts:16` sets daily mode and default slots, but leaves acquisition timing/cost, scoring and goalie rules unknown. Distinguish proposed slot/mode assumptions from verified league rules during setup.
- `planning.ts:559–560,809–811` distinguishes schedule-capacity assignments, unavailable outcome and missing acquisition inputs. The current engine already supports a safe subset; reuse its result/limitations, not a competing legality implementation.
- Manual catalog reload retains intent (`RosterScheduleOptimizer.tsx:115`); provider refresh retains workspace inputs and creates a reconciliation proposal (`:190–191`). The visible notice says selected moves were kept (`:313`); `reconciliation.ts:3–52` returns suggested repairs for explicit acceptance. Existing daily/weekly, partial coverage and continuity fixtures must be extended only for uncovered cases.
- Existing forecast evidence UI and FE plan still have incomplete producer/lineage work. Guided setup may ship with honest schedule-only results; do not block it on an entire forecasting rewrite or claim projected recommendation readiness from local helpers alone.

### D — WiGO missing TOI, comparisons and windows

Trace: `web/pages/wigoCharts.tsx`/`web/hooks/useWigoPlayerDashboard.ts` → `web/utils/fetchWigoPlayerStats.ts:577` → `wigo_career`, `wigo_recent`, overriding `wigo_rates`, latest `wgo_skater_stats_totals` → normalization (`:366`) → `web/components/WiGO/tableUtils.ts:12` → `StatsTable.tsx` / `WigoComparisonMatrix.tsx`. Relevant writer: `web/pages/api/v1/db/calculate-wigo-stats.ts`.

- **Verified writer defect:** recent windows sum `game.nst_toi_all ?? 0` (`calculate-wigo-stats.ts:941`) and divide by **all** selected game count (`:994–997`). An absent NST TOI input becomes zero ATOI, or a partial sum divided by the full count. NHL PP seconds are summed separately (`:955,999–1002`), so nonzero PPTOI can coexist with zero derived total TOI. This explains a reproducible failure class, not the provenance of the observed McDavid row.
- Aggregate ATOI is minutes, normalized to seconds (`statMetadata.ts:100–107,354`); PPTOI aggregate is average seconds (`:165`). Null-aware fetch/formatting exists. `tableUtils.ts:34–83` suppresses null/missing values and infinite differences, but accepts fabricated zero as real and sets zero-versus-zero to 0%. A deterministic actual-helper diagnostic produced `00:00` and `-100` from zero ATOI versus 1,200 seconds. Carry missingness/coverage through the writer and reader rather than replacing zero by a guessed TOI value.
- **Superseded unit work:** current writer uses `calculatePer60FromSeconds` for recent rates (`:1037`) and average PP seconds; its existing test now covers those units across timeframes. Older comparison audit assertions about these conversions should not become new implementation tasks. Live NST units/row matching and incomplete coverage still need evidence.
- Writer retrieves latest logs by player with no season predicate (`:281–286`), then slices 5/10/20 games (`:928–935`). Actual GP is stored; source-date bounds and covered seasons are not conveyed by `TableAggregateData`/table headings. Windows may cross seasons. Explain actual samples and dates; do not impose a season restriction without the product decision.
- Existing audit already owns reconstruction, provider game matching and source precedence. Confirm the actual `wigo_rates` producer before changing values it can override. No writer GET endpoint was called: its GET executes writes.

### E — Rankings default intent and sample semantics

Trace: `web/pages/rankings.tsx` → `web/lib/rankings/rankingUrlState.ts` / filters → contextual-ranking/matrix API routes → `rankingQueries.ts`, `playerMatrix.ts`, metric registry and calculator → table/header/methodology. Historical contextual performance is the established purpose (original Rankings PRD §§1–2).

The metric-explorer API calls `buildSnapshotFirstContextualRankingsSurface` (`web/pages/api/v1/contextual-rankings.ts:2,24`); source metadata distinguishes `entity_metric_rankings` from `rolling_player_game_metrics` fallback (`rankingQueries.ts:735–746`). The default matrix imports both ranking surface readers (`playerMatrix.ts:18–19`) and also reads `rolling_player_game_metrics` and `skater_composite_ratings` (`:717,793`). Sample/freshness claims must name the source actually used, not a generic page timestamp.

- Defaults are 20252026, 5v5, min GP=1 and TOI=300 seconds (`rankingUrlState.ts:61–80`). The legacy explorer metric is goals/60; the default rankings matrix sort metric is points/60. Do not conflate the two or change the current season purely by date.
- **Verified interpretation risk:** `getSampleConfidence` (`rankingCalculator.ts:209–231`) measures multiples of selected minimum GP/TOI. One game with 1,200 seconds and minimums 1/300 returns “medium.” It is a minimum-relative sample label, not calibrated prediction confidence. `RankingsTable.tsx:206` renders it as “Medium sample”; other matrix paths have their own metric/sample contracts, so audit the actual displayed label before generalizing this formula to every panel.
- Current source also treats unknown GP/TOI as passing `sampleMeetsMinimums` (`rankingCalculator.ts:195–205`), and substitutes a multiple of 1 for missing values in confidence. Existing sources may filter these out; test this edge in the actual route before asserting a production defect. Unknown sample cannot warrant broad reliability copy.
- Season/strength/minimum controls, active metric context and URL serialization already exist. Proposed work is concise purpose/dataset freshness/sample explanation and an evidence-backed optional fantasy-use preset. A hard-coded season does not prove the previous season is the most complete; completeness rationale needs a read-only dataset comparison.

### F — Schedule Game Grid positions and candidate availability

Trace: `web/pages/game-grid/[mode].tsx` → `web/components/GameGrid/GameGrid.tsx:1670–1712` → `web/components/PlayerPickupTable/PlayerPickupTable.tsx:1854` → browser read view `yahoo_nhl_player_map_read` → unchecked `r.eligible_positions` (`:1964`) → first-position styling/filtering and `.join(', ')` (`:1227,1518`).

- **Verified rendering defect for supported malformed payload:** object elements stringify to `[object Object]`; a non-array value may also fail `.join`/filter operations. TypeScript's `string[]` annotation does not validate DB JSON. The diagnostic demonstrated object-array coercion. Normalize at the table's ingestion boundary and use the normalized result for display, filters and styling.
- Repo SQL view coalesces canonical Yahoo and legacy eligible positions without element normalization (`supabase/migrations/20260824152127_yahoo_live_draft_production_hardening.sql:629–645`). An inspected legacy writer (`web/lib/supabase/Upserts/Yahoo/yahooAPI.py:171–175`) normalizes a dict but does not normalize array elements. The exact deployed writer/view/version and raw failing row remain unresolved; fix the consumer safely without assuming a database migration/repair is required. This view is in root `supabase/migrations/`, not `web/supabase/migrations/`.
- Ownership cap applies when no league context exists (`PlayerPickupTable.tsx:2341`). Labels say “Best Available Players” (`:2821`), although an existing disclaimer explicitly says the general pool has no league availability applied (`:2857`). Keep the disclosure and correct the prominent label.
- Connected Yahoo context already exists. `web/lib/integrations/yahoo/pickup.ts:42–75` fails closed on incomplete roster responses and determines non-rostered players. Its context contains roster keys/time, **not waiver clearance or claim timing**. “Available in my league” (`PlayerPickupTable.tsx:2850`) establishes non-rostered status, not immediately addable free-agent status. Preserve existing injury/status fields; show waiver/unknown only when supported, otherwise say waiver status is unverified.
- Drawer has native button/expanded state already (`GameGrid.tsx:1680`). Desktop/mobile clipping was not observed here; test controls at 1180px and smaller widths before scheduling specific CSS repairs.

## Requirement disposition

Mixed classifications apply when a requirement includes implemented safeguards and an unresolved example. Every requirement is accounted for; no unchecked task implies the whole feature is absent.

| Requirement | Classification | Scope/next step |
| --- | --- | --- |
| A1 | Defect risk + unresolved example | First-subject title confirmed; locate exact wrong-player join/event before assigning upstream fault. IST-A. |
| A2 | Implemented safeguard + UX/unresolved | Inference rejects tentative official signing; public category/title needs event-state consumption. Separate classifier owns classification. |
| A3 | Defect + UX | Reject placeholder attribution; distinguish observation/publication time. Existing original-link/null handling retained. |
| A4 | Duplicate + unresolved integration | Existing identity/unresolved review contracts; consume safely, no token-name resolver rewrite. |
| A5 | Duplicate/integration | Reconcile separate PRD and existing interpretation/events/news metadata. |
| B1 | Implemented partly + unresolved | Loading/error/missing/partial/no-games and goalie freshness exist; establish authoritative unsupported/run states. |
| B2 | UX | Existing disclosures preserved; explicit useful recovery and requested-slate retention. |
| B3 | Implemented partly + UX | Existing team denominators/times; clarify source-specific coverage and polling versus publication. |
| B4 | Implemented locally + unresolved 100% examples | Forecast/confirmation labels and residual mass exist; verify raw producer/version. |
| B5 | Implemented | Null score and finite-only ranks; retain/exercise regressions and named probability ordering. |
| B6 | Implemented partly + UX | Preserve disclosures; static current-schedule link is labeled, not date-preserving. Audit destination support. |
| C1–C2 | UX | Compact readiness path with blocker-to-control actions on existing workspace. |
| C3 | Implemented core + duplicate/UX | Reuse schedule-only versus legal/outcome capability boundaries from FE-01/02. |
| C4 | UX | Familiar labels, point-of-use glossary; existing disclosure controls retained. |
| C5 | Implemented unknowns + UX | Confirm proposed slot/mode assumptions and material rules; never fabricate acquisition/scoring. |
| C6 | Implemented | Daily/weekly/locks/budgets/goalie/manual/connected modes preserved. |
| C7 | Implemented core + duplicate | Retained intent and proposal acceptance exist; extend uncovered manual/reload/provider scenarios under FE-07/09. |
| C8 | Implemented constraint | Preserve free/manual features and current sync/access boundaries; no entitlement changes. |
| D1 | Defect + duplicate | Recent missing TOI collapses to zero; existing WiGO pipeline plan owns repair. Exact McDavid record unresolved. |
| D2 | Implemented partly + defect consequence/decision | Nulls/infinite DIFF suppressed; missingness lost upstream; incompatible-window gate and zero/zero semantics need resolution. |
| D3 | UX + duplicate | Stored actual GP; add actual dates, seasons and metric coverage without falsely promising N games. |
| D4 | Implemented units partly + duplicate/UX | ATOI minutes→seconds and recent rates/PP units now tested; verify raw source contracts and explain denominators. |
| D5 | Implemented constraint | Keep dense tables/matrix and compact inline explanations. |
| E1 | Implemented intent + product decision | Historical contextual tool; no automatic current-season recommendation pivot. |
| E2 | Implemented filters + UX | Prominent applied context and trustworthy dataset cutoff, not page-fetch time. |
| E3 | UX/verified interpretation risk | Minimum-relative labels need explicit semantics; audit matrix-specific sources too. |
| E4 | UX/product decision | Document safeguard rationale/tradeoff before preset; expert controls remain. |
| E5 | Unresolved + UX | Hard-coded prior season verified; completeness rationale not established. |
| F1 | Defect | Runtime normalization for positions, shared by filtering/display. |
| F2 | Implemented partially + UX | Non-rostered Yahoo pool exists; general ownership pool and waiver status need truthful prominent labels. |
| F3 | Unresolved runtime + QA | Test current drawer/controls first; only repair demonstrated fit failures. |
| Shared layout/accessibility | Implemented patterns + unverified QA | Existing tabs/disclosures/semantic controls; no runtime contrast/focus/fit approval. |
| Shared context continuity | Implemented destinations + UX | Static workflow links and existing per-page URL state; add supported context only. |

## Baselines and verification actually performed

From `web/`, with installed dependencies, no installation/build/server/deployment:

```sh
npm test -- --run components/PlayerPickupTable/PlayerPickupTable.test.ts components/WiGO/tableUtils.test.ts components/WiGO/statMetadata.test.ts lib/rankings/rankingCalculator.test.ts components/NewsFeed/NewsCard.test.tsx __tests__/pages/start-chart.test.tsx
npm test -- --run lib/sources/tweetNewsInference.test.ts __tests__/pages/api/v1/db/calculate-wigo-stats.test.ts lib/rosterScheduleOptimizer/reconciliation.test.ts lib/rosterScheduleOptimizer/planning.test.ts
```

Passed: 6 files/59 tests and 4 files/65 tests, **124 tests total**. Dependency-failure logs and simulated writer “upserts” came from mocked fixtures, not production. These passing existing tests do not cover all newly identified gaps. No TypeScript/lint/build/browser suite was run for this documentation-only audit.

Reproduce the diagnostic without writes from `web/`:

```sh
NODE_PATH=. TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' node -r ts-node/register/transpile-only <<'NODE'
const {computeDiffColumn}=require('./components/WiGO/tableUtils');
const {getSampleConfidence}=require('./lib/rankings/rankingCalculator');
const {formatWigoStatValue}=require('./components/WiGO/statMetadata');
console.log({positions:[{position:'C'},{position:'LW'}].join(', '),
  missingToiSum:[null].reduce((sum,value)=>sum+(value??0),0),
  toi:formatWigoStatValue('ATOI',0),
  diff:computeDiffColumn([{label:'ATOI',L5:0,LY:1200}],'L5','LY')[0].DIFF,
  confidence:getSampleConfidence({gamesPlayed:1,toiSeconds:1200,minGp:1,minToiSeconds:300,minimumSampleMet:true})});
NODE
```

Observed: positions `[object Object], [object Object]`; missing TOI sum `0`; TOI `00:00`; difference `-100`; confidence `medium`. The reduction mirrors inspected writer logic; helpers are the actual repository exports. This does not independently execute the full writer with missing NST data.

Numerical improvement targets remain unset. Establish bounded baselines before implementation: exact-record wrong-entity adjudication in a labeled sample; unsupported missing-value incidents in fixture/live samples; unique slate game/team/player-target coverage at a recorded cutoff; first useful RSO schedule result time, confirmed-input completion and unresolved blockers for first-time manual users. Record sample method/size, cold versus returning users and schedule-only versus outcome-ready results. Do not call earlier FE diagnostics, the public eight-game observation, or 12 Reddit discussions population-level metrics.

## Owner decisions and evidence gates

1. Supply/link the separately approved identification/classification PRD and its authoritative event contract. The application adapter can be scoped now; changing classifier semantics is outside this plan.
2. Decide whether Starter Board should default to the requested empty slate with an opt-in earlier run, preserving the existing disclosed fallback as an explicit option. No silent date substitution or fabricated run availability.
3. Choose Rankings' primary landing purpose: retain historical contextual analysis (recommended from current PRD) or add a clearly named fantasy-use preset. Choose sample policy only after distribution/metric evidence; no arbitrary universal GP threshold.
4. Confirm WiGO recent windows are last N played games across seasons or deliberately season-bounded, and define zero-versus-zero DIFF as undefined or an explicitly documented convention. Display current inclusion truthfully while that decision is pending.
5. For exact-example sign-off, obtain original item/tweet/row IDs, source text, observation/publish cutoff, requested URL/filters and deployed run/model/flags. Missing evidence keeps those rows unresolved; it does not delay independent consumer protections.

These decisions gate only dependent implementation. The audit/planning deliverable does not require pausing for answers.

## Rollout, recovery and data separation

Application changes are proposed only. Use small independent changes for position normalization, attribution safety and null propagation; integrate news subject/certainty only against the agreed event contract. Reuse existing feature controls where available; do not add a new flag system. Preserve APIs, URLs, saved intent and entitlement boundaries; an old payload must degrade honestly until additive fields are available. Reverting presentation must not rewrite saved plans or source evidence.

Any historical correction is a **separate approval package**: exact affected IDs and provenance, before/after values, immutable source evidence, bounded dry-run diff, idempotency, recovery/backup and downstream invalidation review. UI fixes neither prove existing rows repaired nor authorize recomputation. No calls to writer GETs, remote migration push, non-dry-run backfill, accepted-news mutation or deployment belong to this handoff. Remote Vercel previews/builds also require explicit authorization.
