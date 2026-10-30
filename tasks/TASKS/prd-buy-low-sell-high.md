# PRD: Buy Low / Sell High

Status: implementation plan; no implementation or release authorized by this document alone.
Date: October 15, 2026. Product owner: TJ Branson, FHFH.
Companion: `prd-sko-element.md`; shared interpretation and forecast contract owned there.
Implementation status (2026-10-18, sprint lane S-16): fixture-stage watchlists, market-reference comparability, trade comparison and device-local storage exist locally and are uncommitted (`web/lib/buyLowSellHigh/`, `web/components/buyLowSellHigh/`, `/buy-low-sell-high/preview`, which returns 404 in production builds). Legacy `web/pages/buyLowSellHigh.js` is unchanged. See `tasks/artifacts/sko-blsh-lane-2026-10-18/README.md`.

## 1. Introduction / Overview

Create a distinct stock-market-style fantasy hockey dashboard that helps managers investigate rebound and cooling candidates and compare a concrete trade against expected production. It consumes the same versioned FORGE forecasts and SKO/VuDu interpretation records as The Sko Element. It must distinguish a player's recent production, current outlook, opportunity volatility and the price represented by an actual trade or market reference.

A cold player is not automatically undervalued. A hot player may have earned a higher baseline through a promotion while still producing above it. The initial release includes rebound/cooling watchlists and manager-entered trade comparisons. An automated market-value feed is not a release prerequisite.

Owner decisions: default horizon is the next 10 scheduled team games, selectable 5 or 20; forwards and defensemen require separate reference classes; goalies use VuDu. Both this page and The Sko Element are end products. FORGE/RSO/Start Chart's usable forecast release retains priority.

## 2. Goals

- Let a manager identify why a player is on a rebound or cooling watchlist, including whether role changes support the new production level.
- Compare the expected category production of both sides of a manager-entered trade under the same scoring rules and explicit horizon.
- Show opportunity persistence/reversal, uncertainty and coverage alongside any value conclusion.
- Present only traceable market-value gaps, never infer price from ownership or recent performance alone.
- Reuse shared forecast and interpretation records without creating a parallel model, ingestion job or incompatible score.

## 3. User Stories

- As a manager, I want to distinguish an overextended scoring run from a supported promotion so I do not sell an improving player solely because his recent results may cool.
- As a manager, I want to inspect a cold player's opportunity and expected production before deciding that he is a bargain.
- As a manager, I want to enter the players I give and receive and compare projected category totals and points under my league rules.
- As a manager, I want to track a candidate with timestamps and see what changed since I first watched him.
- As a goalie owner, I want efficiency and expected workload shown separately, including start uncertainty and adverse role scenarios.

## 4. Functional Requirements

1. Provide a separate navigable page titled Buy Low / Sell High. The existing `web/pages/buyLowSellHigh.js` is a legacy entry point to reconcile before replacement. Preserve or redirect existing URLs deliberately; do not silently remove the old route.
2. Consume the companion's versioned interpretation contract. Every displayed forecast includes its as-of time, model/run identity, target, game IDs, horizon, units, coverage and permitted uses. Unsupported fields remain unavailable, never numerical zero. Preserve field-level conditional versus already-marginalized semantics; do not apply appearance/start/role probabilities again. Conditional inputs cannot silently become unconditional scheduled-team-game totals.
3. Default to the next 10 scheduled team games for each player's team; offer 5 and 20. Show the actual date span and expected appearances. Cross-team spans can differ: clearly label the default comparison as equal scheduled-game horizon. Offer a common-date-range comparison when all required per-game inputs exist; never silently switch bases.
4. Provide separate Rebound Watch and Cooling Watch views, plus watchlist management. Rank by a documented signed gap in a selected category or actual league points, with deterministic tie-breaking and explicit unknown/unranked placement. A 0 gap is not a stability guarantee.
5. Show player identity, current team, F/D/G class, recent comparable production, Expected Production, directional gap, outlook change, opportunity change, source freshness, observed flag duration and coverage. Do not label the baseline True Value.
6. Explain each watchlist inclusion using the shared model's supported evidence. Show process, conversion and opportunity changes separately. Explain overlap among IPP, on-ice shooting percentage and point production; do not count them as independent votes unless the model supports that treatment.
7. Show opportunity persistence/reversal scenarios when evidence supports them. A temporary PP1 promotion can support a high current forecast while carrying reversal risk. Unknown scenario probabilities stay unknown; arbitrary volatility penalties must not reduce expected production.
8. Display observed variability, forecast spread and uncertainty about the estimated mean distinctly. Only show intervals/probabilities supported by the producing model and validation. Missing uncertainty is labeled rather than invented. Trade/package intervals cannot be formed by summing quantiles or assuming independent players/categories without a justified joint model.
9. Include VuDu goalies in the page. Separate stopping efficiency from workload/start probability, team support and playing-time risk. Calculate aggregate SV% and GAA from the applicable count/minute totals, rather than averaging player or game ratios. Display scope limitations for ratio-of-expectations summaries.
10. Provide an explicit league configuration for points versus categories, scoring weights and applicable horizon. Reuse existing validated scoring utilities where safe. In categories mode, initially compare category vectors and directionality; do not claim a single overall winner without a defined utility and required roster/opponent context.
11. Allow the manager to enter players on Give and Receive sides of a proposed trade using canonical identities. Validate duplicate identities, both-side duplicates, missing projections, incompatible forecast versions/bases and empty sides. Permit multiple-player proposals but identify uneven roster counts.
12. Show projected category totals on each side and net difference. For a multi-player side, retain each player’s actual scheduled-game date span; do not present unequal calendar exposure as a common-week comparison. In points mode, apply the actual supplied scoring weights to category means. PPP bonuses are allowed when the league explicitly scores them. No arbitrary blend of sustainability indices substitutes for expected fantasy points.
13. Label a manager-entered proposal as an offer scenario, not proof another manager accepts it. If roster-slot, replacement-player or startable-game effects are missing, label results as raw projected production comparisons. Use RSO net startable value only through a supported integration with sufficient roster, eligibility, schedule and acquisition rules.
14. Support an explicit market reference record: source/type, supplied value or trade package, captured time, scoring/horizon scope, units, and confidence/limitations. Show a market gap only when comparable with expected value. Ownership/add rates may appear as popularity context, never as a trade price. Automated market sourcing remains a later optional integration with rights and source-quality review.
15. Save watchlists and draft comparisons locally in a versioned, user-visible storage format for the initial release. Make device-local scope clear, permit removal/reset, and avoid adding account-backed storage or provider permissions as a hidden prerequisite. Reuse an existing safe persistence abstraction where applicable; never reuse RSO's workspace keys.
16. Preserve immutable historical displayed observations with actual capture times when showing a value trend. Do not backfill historical alerts as if they were issued then, or render fabricated financial candlesticks, dollar prices or investment returns. Historical recomputations must be labeled retrospective and kept distinct.
17. Provide searchable/filterable rows for identity, team, position class, selected target/horizon and supported coverage. Keep essential warnings visible; put detailed methodology in accessible tooltip/popover or expandable content, usable by keyboard and touch.
18. Provide loading, empty, stale, partially covered, invalid-offer and unsupported states. A missing player must not silently disappear from a trade total; show the comparison as incomplete.
19. Keep all trade activity advisory. Do not submit Yahoo/Fantrax transactions, contact other managers or change a roster. No new credentials or provider synchronization is required for manual comparisons.
20. Use the shared interpretation's score sign, version and calibration status. No independently tuned market-page scoring formula. Market-reference changes may change a market comparison, but cannot mutate the underlying forecast or sustainability record.

## 5. Non-Goals

- A second FORGE model, new data scraper, automatic trading or waiver submission.
- Claims of profitable trading, guaranteed reversals, calibrated streak probabilities or time-to-recovery without separate validation.
- Automated market pricing as an initial launch requirement; ownership as a price substitute.
- Full league/opponent-aware categorical trade optimization without the necessary inputs and validated utility.
- Reopening FORGE reserved evaluation blocks or tuning on previously unseen outcomes without the existing experiment owner's authorization.
- Production deployment, database migration, credentials, subscriptions or remote previews as a consequence of writing this plan.

## 6. Design Considerations

Use FHFH's dark graphite/charcoal theme, cyan accent, readable tabular figures and restrained favorable/adverse colors. Build a stock-market-style hierarchy around watchlists, expected-production movement and risk. This is an inspiration for information design, not financial-price imagery.

Desktop: compact summary/filter bar, sortable candidate list and expandable detail/trade comparison workspace. Mobile: focused list/detail/trade views with no required horizontal page scrolling. Do not copy desktop density by shrinking text. No final visual mockup has been approved for this page; use fixture-fed screenshots for a design checkpoint.

## 7. Technical Considerations

- Next.js Pages Router; retain repository's existing test and UI conventions.
- Current code audit is commit-pinned to `a8f58de6178e282acd3a71851c66f4a56b119f14`; newer local changes must be reconciled before editing.
- The Sko Element task pair owns shared interpretation contracts, as-of handling, F/D and VuDu semantics, score configuration and source adapters. This pair owns market/watchlist/trade view models and its page.
- Work in a fresh, add-only module namespace initially. Reuse verified source readers and visual components selectively; do not revive quarantined formulas.
- Fixture-fed UI work may proceed in parallel after the shared contract is agreed. Real-data integration waits for supported FORGE records. Independent work must have non-overlapping file ownership in the canonical checkout.
- Read-only serving should use existing batched data access; no per-row live external fetches. Verify cost and response size before enabling refresh.
- Persist only needed comparison data. No secret, token or imported account payload belongs in local watchlist records.

## 8. Success Metrics / Acceptance

- Every ranked fixture has an explanation, matching score sign, correct units and traceable run/source identity; unavailable inputs are never silently zero-filled.
- Deterministic tests cover hot-but-supported, hot-and-overextended, cold-with-improving-role, cold-with-declining-role, F/D IPP differences and goalie workload-versus-efficiency differences.
- Trade arithmetic matches independently calculated points/category fixtures, including missing heads, lower-is-better categories, uneven sides and ratio aggregation. Incomplete comparisons cannot display an unqualified winner.
- Both pages produce identical interpretation values from identical records, with tests preventing double application of appearance/start probabilities and conditional-to-unconditional relabeling. Market quote changes affect only market comparisons.
- One genuine supported skater and goalie trace is reviewed from source through serving/UI before claiming full real-data acceptance. Missing goalie support blocks that portion of acceptance, not honest fixture development.
- Keyboard/touch workflows, mobile overflow, persistence isolation, empty/stale states and user removal are verified with focused tests and actual screenshots.
- Future market or decision-value claims require a predeclared evaluation with appropriate baselines and held-out data. Unit tests and visually convincing charts are not evidence of predictive improvement.

## 9. Open Questions

Non-blocking: final route slug, final SKO acronym expansion and detailed visual mockup. Record decisions before public navigation changes.
Data-dependent: supported forecast categories, calibrated uncertainty, market-source rights and available genuine goalie coverage. These are validation gates, not permission to invent records.
Future: account-backed watchlists and automatic market data require a separately scoped proposal. Initial local storage/manual comparison remains the approved starting point.
