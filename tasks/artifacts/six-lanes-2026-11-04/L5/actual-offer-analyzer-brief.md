# Actual-offer Trade Analyzer — bounded slice brief

2026-11-04 · L5 proposal for Chef review; planned page, no implementation or release claimed.

## Governing requirements

This is an entered-offer consumer slice of [Roster Autopsy FR6–FR9 and §7–9](../../../TASKS/prd-roster-autopsy.md) and [trade-value pipeline §2–3](../../trade-value-pipeline-2026-11-04/PLAN.md), not a competing trade-engine PRD. Existing `web/lib/buyLowSellHigh/trade.ts` compares raw production; its header explicitly excludes roster, replacement and acceptance logic. Preserve that boundary. L4 owns common observations, valuation and roster-impact contracts; L5 owns page presentation and offer validation only.

## First slice proposed

At `/trade-analyzer`, begin with **the offer you received or intend to make**, not generated ideas. Let a manager enter two named sides, giving/receiving assets, effective date, reviewed scoring/slot rules and each team's full before-roster. Manual input is sufficient; no connection required. Show ownership as manager-reported unless a qualified scoped source confirms it. Reuse compatible existing Autopsy/RSO input shapes through a read-only adapter; local Autopsy IDs are workspace IDs, not verified NHL/provider identities.

1. Validate a nonempty exchange, unique assets, correct side ownership, disjoint team rosters and explicit identity/eligibility. Do not silently move a similarly named player. Preserve draft picks, conditions and unknown assets; retain multi-side input intact but mark it outside the initial two-team evaluator.
2. Preview each complete after-roster after the whole exchange. Show outgoing/incoming players, total roster capacity, active/bench/reserve destinations and any required drop for **both** teams. Active-slot count alone is not total capacity. Unknown bench/reserve rules block a legality claim. A drop is manager-selected, cannot overlap exchanged/protected assets and has a visible cost; never auto-drop or invent a free agent to balance the trade. A two-for-one needing one drop remains unresolved until that team selects one or supplies verified free capacity.
3. Show separate statuses for offer validity, roster capacity/eligibility feasibility, dated lineup legality and impact completeness. A structurally valid roster is not evidence that a trade deadline, lock, processing delay, keeper/cap rule or provider transaction permits the trade.
4. Render L4's same-basis before/after impact for each team when supported: legal assignments, displaced starters, net usable games and points/category deltas, all including the chosen drop. Until that interface and consumer admission are frozen, show “Roster impact unavailable” with reasons. Structural before/after preview can proceed without forecasts or market data; do not recreate the shared impact engine to fill the gap.
5. Show raw package production/quality, league valuation and full-roster impact separately. No numeric winner when required components are missing. Categories show vectors and ratio primitives; mixed signs are tradeoffs. Weekly/unrecognized rules may show schedule/structural preview only. Never use `evaluateLaterImpact(..., { offlineFixture: true })` in the app; its app path currently blocks on an unaccepted contract.

The first grant should cover manual offer entry and structural/capacity preview under fully reviewed rules, plus explicit unavailable impact panels. It is an initial analyzer slice, not completion of the roster-aware predictive result.

## Evidence, guard and privacy behavior

Read L4's frozen interface only after Chef accepts it. Provisional PLAN names/paths are not installed APIs. Preserve its versions, reason codes, missingness, source/coverage and complete bundles. Observations are examples, never independent per-player prices. Picks remain visible while pick valuation and keeper/cap legality are unavailable. A plausibility guard may annotate an entered offer; it must not hide it. Weights/guard thresholds await L4 provenance/testing, not L5 defaults. Counterparty acceptance remains unknown even with positive modeled impact on both teams.

### Received L4 proposal and exact integration dependency

The concurrently created [L4 contracts.ts](../L4/contracts.ts) proposes `Asset`, `Observation` (`trade-observation-v1`), `Coverage` (`trade-coverage-v1`), `Valuation` (`league-valuation-v1`) and `RosterImpact` (`roster-impact-v1`). Reuse these asset/evidence semantics; do not author parallel shared types. `Result<T>` is available/unavailable with reasons; freshness is separate metadata, not a third invented contract status. `Observation` deliberately excludes manager-entered offers, so a page's local offer must never be inserted into observation counts.

Before numeric impact integration, Chef/L4 must freeze a compatible representation or approved adapter binding each of **two team results** to its team and before/after snapshot, reviewed rules/capacity, effective instant, common date range/objective and evidence revisions. Current `RosterImpact` has a single snapshot ID, scalar `productionChange`, player-ID consequences and `openSlots`; it does not specify per-day assignments/displaced starters, category/goalie ratio vectors, or whether `openSlots` means total roster capacity or active slots. Do not infer those semantics. `requiredDropIds` cannot substitute for the manager's selected drop and its cost. A versioned extension is needed only when those dependent results are implemented; first-slice structural preview keeps them explicitly unavailable.

No server persistence, auto-send, provider writes, scraping or external messages. Initial offers live only in page memory with clear reload behavior; a future private save requires a separate accepted retention/access design. Never put offers or league details into URLs, shared caches or analytics. This narrows the pipeline's proposed stored-offer stage explicitly.

## Exact proposed paths and checks

New: `web/pages/trade-analyzer.tsx`, `web/components/TradeAnalyzer/TradeAnalyzer.tsx`, `TradeAnalyzer.module.scss`, `TradeAnalyzer.test.tsx`, `web/lib/tradeAnalyzer/offer.ts`, `offer.test.ts`. No shared navigation/auth edits. `offer.ts` owns normalization, identity/ownership validation and explicit roster transformations; no valuation or solver implementation.

Tests: uneven exchange before/after with required drops on either side; missing capacity; duplicate/wrong-owner/unresolved identity; reserved player rules; pick/unknown asset retention; stale changed-input results; missing shared evidence; entered offer survives guard warning. Fixture component checks cover edit → preview → resolve drop → both rosters, keyboard and narrow-screen reading order. See [tasks](tasks-prd-actual-offer-analyzer.md).

## Material choices and dependencies

Chef/TJ acceptance is needed for two-team manual structural preview as the first slice, including in-memory-only state. Full impact waits for L4's accepted roster-impact contract, compatible RSO consumer use and qualified common-period data. Product name/route is proposed; no “fair trade” score, acceptance model, automatic candidate search, pick-price model or new provider integration is included.
