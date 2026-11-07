# Proposed local review composition — Claude Git custodian

Chef `01a1a86a-6dc1-72ae-a9c9-f29e9367c020` selects **all 69 accepted paths in 14 groups** for the proposed **LOCAL review composition**. Core 41 and optional 28 are descriptive independence/dependency labels; **no routine group-selection decision is left to TJ**.

To: Claude Git custodian `1e668672`. Coordination/routing custodian: `01a16e4f-a250-727a-aeb5-2e42da87500f`.

Checkout: `/Users/tim/Code/fhfhockey.com`. Branch: `octoberBranch`. Exact base: **`5f6b4e7a3a893000fe31cc6928cd8736b56e5d39`**, reverified during the final refresh. All69 selected SHA256 pins match their accepted receipts; selected base blobs/new-file absence were checked against that base. `COMPOSITION-REQUEST.json` contains complete hashes, base identities, evidence pins and dependency details. Request digest: `082de6c92af34208a3c8e0a36f959b93eab21674e8c589635e3c52f292e78f29`.

This packet is ready for custody/composition review. It is **not a final candidate commit or release approval**. Exact resulting-candidate verification and inherited-base review remain required. L3 has not staged, committed, changed refs, run application checks or sent this request externally. No push/deploy/build/production/migration action is granted.

## Core — 41 selected paths

### RSO-CORRECTNESS — 17 paths

- `web/lib/rosterScheduleOptimizer/planning.ts`
- `web/lib/rosterScheduleOptimizer/planningTimeline.ts`
- `web/lib/rosterScheduleOptimizer/lineupGaps.ts`
- `web/lib/rosterScheduleOptimizer/healthyReserves.ts`
- `web/lib/integrations/yahoo/rosterPlanning.ts`
- `web/components/RosterScheduleOptimizer/HealthyReserveAlert.tsx`
- `web/lib/rosterScheduleOptimizer/planning.test.ts`
- `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts`
- `web/lib/rosterScheduleOptimizer/contributionLedger.test.ts`
- `web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts`
- `web/lib/rosterScheduleOptimizer/healthyReserves.test.ts`
- `web/lib/rosterScheduleOptimizer/lineupGaps.test.ts`
- `web/lib/rosterScheduleOptimizer/refreshForecastInputs.test.ts`
- `web/lib/integrations/yahoo/rosterPlanning.test.ts`
- `web/components/RosterScheduleOptimizer/HealthyReserveAlert.test.tsx`
- `web/lib/player-forecasts/contributions.test.ts`
- `web/e2e/roster-schedule-optimizer.spec.ts`

### FORGE-OBSERVED-COUNTS — 4 paths

- `web/lib/forge-v2/contracts.ts`
- `web/lib/forge-v2/evaluation.ts`
- `web/lib/forge-v2/model.ts`
- `web/lib/forge-v2/evaluation.test.ts`

### L2-YAHOO-AUDIT-TEST — 1 paths

- `web/__tests__/pages/api/internal/yahoo-live-draft.test.ts`

### L2-SAVED-SNAPSHOT-PARSER — 2 paths

- `web/lib/buyLowSellHigh/researchSnapshot.ts`
- `web/lib/buyLowSellHigh/researchSnapshot.test.ts`

### L2-BLSH-SKO-VUDU-AUDIT — 15 paths

- `web/lib/buyLowSellHigh/displayProfile.ts`
- `web/lib/buyLowSellHigh/displayProfile.test.ts`
- `web/lib/player-cards/retainedBlsh.ts`
- `web/lib/player-cards/retainedBlsh.test.ts`
- `web/components/buyLowSellHigh/BlshPlayerDetail.tsx`
- `web/lib/skoElement/contract.ts`
- `web/lib/skoElement/interpret.ts`
- `web/lib/skoElement/interpret.test.ts`
- `web/components/skoElement/SkoElementPreview.tsx`
- `web/components/skoElement/SkoElementPreview.test.tsx`
- `web/lib/sko/gap.ts`
- `web/lib/sko/gap.test.ts`
- `web/lib/buyLowSellHigh/market.ts`
- `web/lib/buyLowSellHigh/market.test.ts`
- `web/lib/buyLowSellHigh/supportGap.test.ts`

### L2-CLOSED-PROCESS-EVIDENCE — 2 paths

- `web/lib/buyLowSellHigh/currentProcessEvidence.server.ts`
- `web/lib/buyLowSellHigh/currentProcessEvidence.server.test.ts`

The parser pair appears exactly once. Its complete installed file pins preserve the original audit changes and accepted parser overlay. The completed BLSH audit footprint totals 17 paths across the 15-path audit group plus this existing parser 2 group. The corrected process-evidence pair remains separate owner provenance.

Keep parser/card/display semantics together: researchSnapshot source/test, displayProfile source/test and retainedBlsh source/test form the six-file closure. Keep the sKO contract/interpreter/UI five-file subgroup together. VuDu shot-population and market guards retain their paired tests. The supportGap scorer is unchanged; its completed invariant regression is included. The minor VuDu team/date separator remains unresolved and is excluded from completion claims; it is not a data-adoption blocker.

## Optional independent groups — 28 selected paths

These groups are also selected by Chef. Their labels preserve independent review boundaries rather than ask for another scope choice.

### FORGE-HORIZON-OFFLINE — 4 paths

- `web/lib/forge-v2/horizonEvaluation.ts`
- `web/lib/forge-v2/horizonEvaluation.test.ts`
- `web/lib/forge-v2/horizonEvaluation.fixtures.ts`
- `web/scripts/forge-horizon-evaluate.ts`

### FORGE-LEDGER-OFFLINE — 2 paths

- `web/scripts/forge-ledger-evaluate.ts`
- `web/lib/player-forecasts/servedForecastLedger.test.ts`

### FORGE-JOINT-SAMPLER — 2 paths

- `web/lib/projections/uncertainty.ts`
- `web/lib/projections/uncertainty.test.ts`

### L4-OBSERVATION-ONLY — 3 paths

- `web/lib/tradeValue/contracts.ts`
- `web/lib/tradeValue/observationEvidence.ts`
- `web/lib/tradeValue/observationEvidence.test.ts`

### L5-STRUCTURAL-DIAGNOSIS — 5 paths

- `web/components/RosterAutopsy/RosterAutopsy.tsx`
- `web/components/RosterAutopsy/RosterAutopsy.module.scss`
- `web/components/RosterAutopsy/RosterAutopsy.test.tsx`
- `web/lib/rosterAutopsy/diagnosis.ts`
- `web/lib/rosterAutopsy/diagnosis.test.ts`

### FORGE-CAPTURE-BASELINES — 4 paths

- `web/lib/forge-v2/researchCapture.ts`
- `web/lib/forge-v2/researchBaselines.ts`
- `web/lib/forge-v2/data.test.ts`
- `web/lib/forge-v2/model.test.ts`

### L4-PROJECTED-LEAGUE-POINTS — 2 paths

- `web/lib/tradeValue/valuationComponents.ts`
- `web/lib/tradeValue/valuationComponents.test.ts`

### L5-MANUAL-ENTERED-OFFER-ANALYZER — 6 paths

- `web/pages/trade-analyzer.tsx`
- `web/components/TradeAnalyzer/TradeAnalyzer.tsx`
- `web/components/TradeAnalyzer/TradeAnalyzer.module.scss`
- `web/components/TradeAnalyzer/TradeAnalyzer.test.tsx`
- `web/lib/tradeAnalyzer/offer.ts`
- `web/lib/tradeAnalyzer/offer.test.ts`

## Dependency closure and accepted limits

- FORGE horizon test imports its runner, which imports fixtures: include all four selected files. Capture/baseline helpers depend on horizonEvaluation; their current model/data test additions import the helpers. All are selected, so this dependency is closed. The corrected capture selects issuance-origin anchors and rejects retention crossing an eligible first game, including absent forecasts. It adds no durable capture service or source admission. The joint sampler remains disabled in producers; no model activation or empirical qualification is implied.
- Ledger diagnostic and its test travel together; the serving ledger runtime is unchanged. It does not fabricate H10/H20 trajectories, missing counts or source corrections.
- L4 observation trio is unchanged. Projected-points pair imports its `Result` type and existing game-expectations/scoring contracts. Typed permission/forecast views are trusted input assertions, not independently authenticated admission. There is no production caller or combined trade value, roster impact, market price or acceptance model.
- L5 structural diagnosis and manual Analyzer use the selected observation contract types. Analyzer applies the complete two-team exchange, explicit total-player limits and selected drops. Dated legality, valuation, roster impact, market evidence and counterparty acceptance remain unavailable. No provider identity, persistence, transaction or shared-producer change is claimed.
- The saved BLSH snapshot remains pinned and untouched. No arm-C adoption, real goalie adapter/current-process source admission, fresh scoring or source collection is included. Preview/forecast-performance claims remain limited as recorded in their receipts.

## Evidence reused, with scopes preserved

| Slice | Existing accepted evidence |
|---|---|
| RSO | 61 RSO files / 1,517 tests; prior targeted lint and five synthetic Chromium cases. Live-league acceptance and unrelated style integration are outside that evidence. |
| FORGE |Latest broader provenance aggregate 320 tests / 17 files, TypeScript/lint; bounded issuance-origin follow-up 39 data/model tests and lint. Follow-up did not repeat full types/aggregate. Experimental sampler stays disabled. |
| BLSH/sKO/VuDu |Original audit 407 passed / 4 skipped with dated lint/local preview checks. Parser 74 canonical tests and process 87 focused checks are separate receipts; **do not sum overlapping totals**. Old compiler/Yahoo blockers are superseded by accepted corrections. |
| Yahoo test-only correction | 17 mocked tests and targeted lint/diff checks; runtime unchanged. |
| L4 |Observation 12 tests, lint/isolated types; projected-points 9 tests, lint and actual app ES2015 focused TypeScript check. No real trade/forecast admission or production caller. |
| L5 diagnosis | 26 tests, scoped types/lint/component compile; Chef-run 30 synthetic browser checks at 1440/390/320, keyboard/edit/reload/RTL/200% CSS zoom, no errors/external requests; desktop/390 screenshots inspected. |
| L5 Analyzer |Original 9 model tests and corrected 5 component tests, corrected scoped types/lint; Chef-run 34 recorded synthetic browser checks including compile/error checks at 1440/390/320, keyboard/drop/edit/reload/RTL/200% CSS zoom, no errors/external requests; desktop/mobile screenshots inspected. |

Both L5 browser runs verify isolated actual components/styles, **not the full Next app shell**. Pending-browser prose in the older implementation receipts is superseded by Chef acceptance and the pinned passing browser-result files. No fresh whole-tree application certificate is claimed. L3 reran no tests/types/lint/browser/build.

## Exclusions and preservation

**Only the exact69 selected paths are eligible.** Preserve every other staged/unstaged path and all future additions unless Chef separately accepts them. The JSON retains 112 excluded paths from the original inventory after removing accepted paths; it is a dated preservation aid, **not a regenerated whole-tree inventory** or an allowlist for new files.

- WiGO isolated proposal/new design work remains excluded.
- Luna remains **EXCLUDED pending parent independent review**, despite owner-reported review repairs and 48 synthetic tests/scoped types/lint. Latest parent-reported handoff SHA256 is `cd30e2e6f4274587bf581c4ceb0d0dd0d7566a9fa94bb4e90fd7c47e8e922606`. Its SQL is unapplied/assertions unexecuted, with no database proof. L3 did not inspect/hash/review Luna code or its receipt.
- All diaries, working receipts/manifests, browser fixtures/screenshots/harnesses and unrelated artifacts are evidence only and stay out of the application composition by default.
- Global/concurrent styles, layout/navigation/stats/roster changes, the separate RSO aria-controls hunk and `next-env.d.ts` remain excluded. The two selected L5 component stylesheet files belong only to their accepted groups.
- No new migration, schedule, source capture, production operation or activation is part of this request. The base inherited migration-authority metadata change still requires custodian/Chef inherited-scope review; this packet does not validate that a migration ran.

## Request to Claude Git custodian

Confirm exact base/index custody and safe selective composition of **all 69 Chef-selected paths**, preserving every excluded change. Inspect inherited committed scope and existing index state under your authority. If safe composition is blocked, return the **concrete conflicting path, index/base condition or pin mismatch** to Chef; do not reset, overwrite, silently substitute newer bytes or request routine group choices from TJ.

Within the custodian’s existing authorization, return the exact resulting local candidate SHA/selected blobs and preserved exclusions for Chef verification, or the precise remaining custody/inherited-base/composition blocker. No staging/commit authority transfers to L3 and no remote action is authorized.

**Routing blocker:** the parent send-message route returned thread-not-found despite durable read access. No direct Claude receipt has been obtained. This local packet and platform final report preserve the ready-to-route request; L3 has not retried or sent an external message.

L3 final checks: 69 accepted source SHA256/Git blobs match, exact base/branch and selected base identities match, group/path uniqueness and dependency closure recorded, evidence hashes pinned, request digest/Markdown coverage/JSON/whitespace validated. No Git/index/ref mutation or final candidate freeze performed.
