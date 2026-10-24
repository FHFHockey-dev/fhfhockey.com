# Shareable FHFH Player Cards Product Requirements Document

Status: TJ AUTHORIZED TASK GENERATION AND BOUNDED LOCAL IMPLEMENTATION on October 24, 2026. Proposed product defaults and the exact free/premium split below remain unapproved decisions, not blanket approvals.
Document date: October 24, 2026. Product owner and reviewer: TJ.
This is a cloud draft copy, not a file installed in TJ's local FHFH repository.
Review sequence: generate tasks, have the parent review the task list, then hand off bounded local work to one Sol worker in a new visible thread. Resolve each open product/source decision before enabling the feature behavior that depends on it; independent free-card and synthetic-preview work can proceed.
Authorization excludes production reads/writes, backfill, Git operations, dependency installation, new spend, deployment, permission changes, and edits to files owned by another active workstream without an explicit ownership transfer. A separately authorized diagnostic does not expand the card worker's authority.

## Introduction/Overview

Build easy-to-read FHFH skater cards that a fan can find, customize, and download as an image to share. Cards combine observed individual production, playing opportunity, on-ice context, and finishing/involvement statistics without treating those categories as interchangeable evidence of player quality.

TJ confirmed that public player search, basic cards, and PNG downloads are free. The default should be curated and readable, with optional metrics or additional cards rather than every statistic squeezed onto one image. Paid users should receive expanded advanced metrics and a side-by-side two-player comparison. The exact free/premium metric split and any other enhanced features are not decided.

The default period is each player's own last 5, 10, or 20 appearances at one common as-of cutoff. A shared calendar-date option must also be available. Each rankable metric shows its actual value, raw ordinal rank such as “42 of 812,” and percentile. The comparison pool includes all NHL players with a valid value under the same declared metric and period definition, without a minimum-TOI-qualified or position-only subset.

NST and WiGO are intended sources. Repository investigation has verified relevant stored metric contracts and identified reader/window defects. A separately approved single-player diagnostic confirmed concrete window/data inconsistencies, not league-wide completeness or reliable last-N output. The evidence and remaining checks are summarized in Technical Considerations. No uninspected route, export engine, or entitlement implementation is assumed. Observed cards must not depend on a FORGE prediction model.

## Goals

- Let an anonymous visitor find a skater and download a useful, clearly labeled card.
- Explain what the player did, their opportunity, and their on-ice environment without implying a forecast or automatic recommendation.
- Make short-window comparisons honest about actual games, exposure, date spans, missing values, and rank populations.
- Support free discovery while giving paid users meaningful additional analysis through existing entitlement planning.
- Produce reproducible, mobile-legible images with FHFH branding and required source attribution.

## User Stories

- As a fan, I want to search for a player and download a card without needing a paid account.
- As a fantasy manager, I want the player's own last 5, 10, or 20 appearances rather than assuming every player played the same recent dates.
- As a reader, I want the metric value, rank, percentile, games, and TOI so I can interpret the number in context.
- As a user, I want a short default card and optional deeper statistics without an unreadable wall of metrics.
- As a paid user, I want to compare two players side by side using clearly compatible definitions.
- As TJ, I want a recognizable FHFH export whose numbers and context match the page that generated it.

## Functional Requirements

### 1. Public discovery and access

1.1. Provide public skater search, a free curated card, and free PNG download. Do not require payment to complete this basic flow.
1.2. Resolve players through verified stable NHL identities. Handle duplicate names, team changes, absent portraits, no matches, and unavailable data without choosing the wrong player.
1.3. Offer optional metrics or extra card views through a readable selector. Clearly mark premium features before a user selects them; never show a fake working control.
1.4. Support premium advanced metrics and side-by-side two-player comparison. Final metric allocations, comparison export options, and other premium enhancements require TJ's review.
1.5. Reuse the established in-season monthly/season entitlement plan after verification. This feature must not introduce a new price, billing interval, checkout system, or subscription commitment.
1.6. Enforce premium access on data/API and export boundaries, not only in the UI. Public cached responses and image URLs must not accidentally expose gated data.

### 2. Periods and comparable samples

2.1. Offer L5, L10, and L20 using each player's own appearances completed at or before one common as-of cutoff. Define an appearance from verified official GP/game identity, not a team fixture, scratch, or scheduled game.
2.2. Apply the same rule independently to every eligible player in the ranking pool. These players can have different first/last game dates; disclose this in the interface and export. Do not describe own-last-N cards as a shared calendar interval.
2.3. Also offer one inclusive start/end calendar-date range applied to every player. State the timezone and completed-game cutoff. Do not mix calendar-range values with own-last-N ranks.
2.4. Show selected N or dates, actual GP, selected-strength TOI, as-of timestamp, and the selected player's actual first/last included game dates. Two-player views must show each player's actual span and sample.
2.5. Proposed policy for TJ review: keep own-last-N windows inside the selected NHL season and do not silently borrow prior-season games. If a rookie has only three actual season appearances and all three are complete, show “3 of 5 appearances”; allow valid metrics into the pool with an incomplete-window warning and report that cohort in coverage. This is different from missing source rows: if five actual appearances exist but only three have data, do not relabel those three as the player's complete L5. Mark affected metrics incomplete/unavailable and withhold their ranks. Resolve this policy or a strict-complete-N alternative before enabling the affected observed-data rankings; synthetic implementation can make the alternatives explicit.
2.6. Proposed initial defaults are L10, All Strengths, and the selected regular season: a straightforward view of recent overall workload, not a claim that these are statistically optimal choices. Keep L5/L20, supported strength alternatives, and calendar mode available. A postponed, cancelled, or unfinished game must not be counted as a completed appearance.
2.7. Expose a strength only when its source coverage is verified; the All Strengths proposal is conditional on that verification. Label actual GP and TOI explicitly, including units and strength. If optional PP metrics are supported, group/label them as PP rather than mixing them invisibly into an All Strengths or 5v5 panel. Different-strength ATOI and rates need separate labels.
2.8. Distinguish the last included game cutoff from the data snapshot/capture timestamp. Historical cards using later corrected data are retrospective observed summaries; do not imply the numbers were known at that earlier cutoff or demonstrate leakage-free forecast evidence.

### 3. Metric catalog and interpretation

3.1. Establish a versioned metric registry before connecting a card to real data. Each metric needs a plain-language name, abbreviation, units, category, numerator/denominator or aggregation rule, strength state, season type, provider/field mapping, validity rule, precision, ranking rule, availability, and entitlement.
3.2. Evaluate the following requested metrics for the first catalog. An entry is a product requirement to verify, not a claim that the required source field or history exists today.

| Category | Requested metrics | Reading guidance |
| --- | --- | --- |
| Opportunity | ATOI | Average time on ice per appearance, with strength and GP denominator defined. |
| Individual activity and chance generation | SOG/60, iCF/60, iSCF/60, ixG/60 | The player's own shooting, attempts, chances, and expected-goal generation per 60 minutes. |
| On-ice context | CF/60, SCF/60, xG/60, xG% | Events/share while the player is on ice, not individual generation or isolated player impact. |
| Finishing and involvement | IPP, SH%, oiSH% | Observed scoring involvement and shooting conversion, not automatic evidence that higher is sustainably better. |

3.3. Verify whether on-ice CF/60, SCF/60, and xG/60 mean the for-team rates and use explicit labels such as “On-ice xGF/60” when confirmed. Verify what “xG%,” “IPP,” and “oiSH%” mean in the chosen source. Never resolve ambiguity by silently substituting a similarly named statistic.
3.4. Additional WiGO metrics may be optional when their source, meaning, and availability are verified. Do not promise every WiGO field or expand into predictions by default.
3.5. Proposed default-card selection for TJ review: ATOI; SOG/60, iSCF/60, ixG/60; on-ice xG/60 and xG%; SH% and IPP. Offer iCF/60, on-ice CF/60 and SCF/60, and oiSH% through optional metrics/extra cards. Review this selection alongside the paywall; keep meaningful advanced-stat discovery available free rather than automatically locking every advanced metric.
3.6. Keep the four categories visually separate. Use neutral interpretation for IPP, SH%, and oiSH%; do not label a high value “good,” predict regression with certainty, or produce a single unsupported player-quality score.
3.7. Preserve each provider's expected-goal event universe and model definition. Do not equate an unblocked-attempt xG model with on-net expected save percentage, or blend provider models without explicit compatible definitions.

### 4. Values and validity

4.1. Calculate period rates from pooled inputs: a per-60 rate is 60 × summed numerator / summed TOI in minutes. Do not average per-game rates. Aggregate percentages from their verified pooled numerator/denominator, not an unweighted average of game percentages.
4.2. ATOI must use summed eligible TOI / the declared GP denominator. Expected-goal values may be fractional. Use source-provided aggregates only after verifying their period, strength, and aggregation semantics.
4.3. A measured zero with a valid denominator is a value and belongs in the relevant pool. Missing/null/undefined fields, unknown coverage, and zero-denominator ratios are unavailable, not zero. Show a short reason and no rank/percentile for an invalid value.
4.4. Preserve full available canonical numeric precision for calculation and comparison; round only for display. Validate player/game joins, duplicate games, units, denominators, and provider freshness. Do not silently fill gaps, average incompatible providers, or substitute one metric for another.

### 5. Raw ranks and percentiles

5.1. For each rankable metric, show value with units, ordinal rank as “r of M,” and percentile. M is metric-specific: all NHL players with a valid value under that metric's declared eligibility, strength, season type, cutoff, and period mode. V1 skater metrics must not be narrowed to forwards, defensemen, a fantasy roster, current active rosters, a recency filter, or minimum-TOI/minimum-GP qualifiers. The incomplete-window policy in 2.5 is a separate decision, not permission for a hidden threshold.
5.2. Do not claim a league-wide rank until coverage for the full eligible population is verified. Track valid values, known undefined values such as zero-denominator ratios, and missing/incomplete source records separately. When source coverage is incomplete or unknown, show the value with “League rank unavailable: incomplete coverage.” Do not label a partial-source rank as an NHL rank.
5.3. Proposed numeric convention for TJ review: highest numeric value ranks first; competition ties use 1, 2, 2, 4. Let B be the number of valid values strictly below the player's value, E the number equal to it including the player, and M the valid population. Percentile = 100 × (B + 0.5 × E) / M. Compare unrounded values using the registry's canonical precision. Display precision must not manufacture ties.
5.4. This is an empirical midrank percentile of numeric magnitude, not a probability, forecast, confidence score, or “percent better” measure. Top and bottom values need not equal 100 and 0. Any future lower-is-better interpretation must be explicitly labeled, not silently reverse the numeric convention.
5.5. Explain ties and the percentile definition through accessible help. Show “T-2 of 4” where useful while preserving ordinal rank 2; a tie must not be broken by player name, team, or TOI.
5.6. Required hand-checkable fixtures: values [10, 8, 8, 2] yield ranks [1, 2, 2, 4] and percentiles [87.5, 50, 50, 12.5]. All tied values yield rank 1 and percentile 50; a one-player pool yields 1 of 1 and 50; an empty pool yields unavailable. Test valid zeros, invalid denominators, nulls, incomplete windows, and values that round alike but are not equal.

### 6. Card composition and PNG export

6.1. Keep a curated default readable. Extra metrics may create another card or replace selected rows; never shrink an unlimited metric list into illegible text.
6.2. Proposed base export is a square 1080 × 1080 PNG using verified FHFH charcoal/cyan styling. Confirm dimensions and default composition in design review. Controls, dropdowns, paywall prompts, and application navigation must not appear in the PNG.
6.3. Include player identity, team/position context, metric labels/units, values/ranks/percentiles where available, period mode, actual sample/span, strength, common as-of, FHFH branding, source attribution, and a concise pool/coverage definition. If metric-specific M differs, show it per metric. Essential context cannot exist only in a hover tooltip outside the image.
6.4. Export from the same versioned data snapshot and settings displayed in the preview. A refresh or source correction must not cause a silent preview/export mismatch. Preserve a reproducibility manifest containing source versions, included game IDs, definitions, pool identity/counts, settings, and render version; storage and retention are review decisions.
6.5. Provide clear loading, unavailable, stale-data, partial-metric, and failed-export states with safe retry. Never export a loading skeleton or fabricated live-looking values. Synthetic design examples must be labeled as examples.
6.6. Check provider redistribution/attribution rules and portrait/logo rights before public launch. This is a release gate, not permission to scrape, republish, or use unlicensed assets.

### 7. Two-player premium comparison

7.1. Let an entitled user select two skaters with one common cutoff, metric/strength definition, and period mode. Use the same league metric pool for both; do not recalculate ranks among only those two players.
7.2. In own-last-N mode, clearly show each player's separate actual dates, GP, and TOI. In calendar mode, apply the identical chosen dates. Explain incompatible/unavailable metrics instead of presenting false equivalence.
7.3. Compare categories and numeric differences without an automatic winner or fantasy recommendation. Whether a side-by-side PNG or multiple aligned exports belong in v1 is an open scope decision.

### 8. First-release acceptance checks

8.1. An anonymous visitor can search a supported player, read the free card, choose supported periods, and download a valid PNG on desktop and mobile.
8.2. Fixture calculations prove pooled rates/ratios, actual appearance windows, common cutoff, season/incomplete-window policy, valid-zero handling, metric-specific pools, ties, and percentile edge cases.
8.3. A verified real-data pilot reconciles selected players, period totals, source definitions, and league-pool coverage before any claim of live league-wide ranking. Missing coverage blocks the claim rather than the honest value display.
8.4. Preview/export values and context match one snapshot. Long names, large rank counts, unavailable rows, different date spans, and dense optional cards remain legible at mobile sharing size.
8.5. Direct unauthorized calls cannot retrieve gated metrics, comparisons, or premium exports; free endpoints remain usable. No paid material leaks through shared caches or public artifact access.
8.6. Source rights/attribution, metric mappings, window policy, ranking convention, and free/premium allocation receive explicit review before launch. A working fixture or mockup alone is not evidence of production data readiness.

## Non-Goals

- No goalie cards in the proposed skater v1; confirm goalies as a follow-on.
- No forecasts, FORGE projections, auto recommendations, a “buy/sell” label, or promised predictive accuracy.
- No automatic social posting, new billing system, new prices, or new subscription commitments.
- No production access/changes, deployment, new capture/backfill, or paid source/infrastructure work authorized by the bounded local implementation request.
- No silent repair of the separate WiGO L5/L10/L20 defect associated with player 8476453. Its resolution and trustworthy window data are a dependency for affected claims; no backfill is approved here.
- No position-only/minimum-TOI leaderboard substituted for the requested all-valid-player rank.

## Design Considerations

Use current FHFH components and branding after verification. Favor a recognizable player header and four clearly labeled metric groups over an unexplained radar chart or single composite grade. Percentile bars may support scanning, but actual values and raw ranks must remain readable without color.

Keep search and period controls simple, with a clear optional-metrics path and an understandable premium boundary. Use plain-language help for unfamiliar abbreviations. Support keyboard access, adequate contrast, touch-sized controls, and a text equivalent for visual indicators. Review both the live page and exported image at the size a reader will actually see on a phone.

## Technical Considerations

Complete repository/source discovery for reusable search, UI, identity mappings, ingestion, authentication, entitlement checks, and image export. Verified contracts below are useful starting points, not proof of live data readiness.

Separate observed-stat aggregation, metric definitions, ranking pools, presentation, and export. Cache against the full identity of cutoff, provider/data version, season/type, strength, period mode, policy, and metric. Own-last-N ranking requires a valid per-player window across the league, not just the selected player's record.

Verify whether retained source aggregates are sufficient for both own-last-N and arbitrary calendar dates. A player-page rolling summary alone does not establish every player's window, numerator/denominator availability, or historical completeness. If underlying records cannot support a requirement, expose the gap and obtain a scoped plan rather than inventing data.

Keep secrets and provider credentials server-side. Validate request inputs and enforce existing entitlement controls at all protected boundaries. Estimate aggregation/export latency, snapshot retention, source request limits, and operating cost before choosing architecture; do not introduce unapproved paid services or source load.

### Repository evidence and remaining verification

Read-only investigation on October 24, 2026 exercised actual-source aggregation/ranking functions against synthetic inputs: ten offline cases passed. A subsequent explicitly approved production diagnostic used two SELECTs returning 68 rows and made no writes. That bounded evidence applies to one player only. Neither activity authorizes the card worker to query production or perform repairs. Source references below identify the inspected files and lines; they are not claims that this cloud draft is installed in the local repository.

- Metric mappings: `update-nst-gamelog.ts:521,598,642,1408` supports the requested count/share contracts. Game-log TOI is seconds while seasonal TOI is minutes, so game-log per-60 calculation is `3600 × pooled count / pooled TOI seconds`. On-ice xGF/60 uses xGF/on-ice TOI; xG% is `100 × xGF / (xGF + xGA)`; IPP is `100 × individual points / on-ice GF`; SH% is `100 × goals / individual SOG`; oiSH% is `100 × on-ice GF / on-ice SOG`, always with matched coverage and strength. Registry validation must preserve these denominators and units.
- Ranking reuse needs changes: `20260716112908_production_schema_baseline.sql:18629` contains AS percentile fields, but schema presence is only a contract. `fetchWigoPercentiles.ts:13` omits xGF/60, IPP, SH%, and oiSH%; `RateStatPercentiles.tsx:306` applies an incompatible minimum-GP filter. `calculatePercentiles.ts:13` already supports the proposed same-pool midrank formula. Complete population coverage and literal all-position eligibility remain unverified, including NST's `pos=S` selection.
- Own-last-N data has known code-path risks: `fetchWigoPlayerStats.ts:256,374` can overwrite valid recent data with null/stale rates; `:336,609` can choose newest totals without restricting the requested season. `calculate-wigo-stats.ts:275` takes each source's latest 20 independently without a shared cutoff/season filter. These paths cannot establish this PRD's window semantics unchanged.
- Data-health handling is a dependency: `calculate-wigo-stats.ts:281,305,1300` can ignore read errors, write null aggregates, and return HTTP 200. At `:309,941,1100`, exact season/date NST joins can leave TOI-derived rates blank while counts remain. Successful HTTP status or a surviving count is not proof that a rate/window is valid. Operational repair remains separate from this PRD.
- Appearance construction can start from `fetchWigoPlayerStats.ts:888`: use unique game IDs, GP=1, apply cutoff before taking N, and keep an appearance even when PP TOI is zero. The inspected games schema at `20260716112908_production_schema_baseline.sql:9059` did not establish a final-game-state field; verify a reliable completion signal before using a game as completed.
- Expected-goal event universes still need source verification. FHFH's `xgDenominatorSemantics.ts:1` declares `fenwick_unblocked`; that does not prove NST uses the identical universe/model. Existing corrected historical records also do not establish what was known at an earlier date.
- Bounded live evidence for Nikita Kucherov (8476453), in the confirmed FHFH project: all five current L5 NHL/NST game rows matched, but stored WiGO values were null at the inspected 08:52 timestamp; the chronology/cause is not established. L10 matched 9 of 10, with an October 5 gap; independently selected NST L20 included seven post-regular-season dates that displaced the NHL frame, leaving 13 of 20 matches. No `wigo_rates` row existed for this player, so the rate-override code risk above is not the demonstrated cause here; current STD totals matched. Use this as evidence to require verified window alignment, never as proof of league coverage or a reason to blindly reuse current WiGO summaries. Diagnostic source: `tasks/artifacts/wigo-player-card-investigation-2026-10-24/production-diagnostic/REPORT.md` in the investigated local repository. Local code-fix approval is pending; no refresh/backfill is approved.

## Success Metrics

- All first-release acceptance checks pass with recorded evidence and no unexplained fixture failures.
- A new anonymous user can complete search-to-PNG without payment or assistance in a usability review; set a numerical time/latency target after measuring the prototype.
- Every displayed rank/percentile has a reproducible metric-specific population and verified coverage; every unavailable value has a reason.
- Every export preserves the preview's values, period, sample, strength, cutoff, attribution, and pool context.
- In usability review, readers can distinguish individual generation, opportunity, on-ice context, and finishing/involvement without treating percentile as a forecast.
- Track free-card use, PNG completion/failure rate, optional-metric discovery, and premium comparison use with privacy-appropriate existing analytics. Traffic, conversion, and revenue targets remain to be agreed, not fabricated launch guarantees.

## Open Questions

### Product decisions for TJ's review

Review these proposed defaults together with the draft. Existing confirmed choices remain in force; engineering facts below do not need to be guessed by TJ.

1. Approve or revise L10 and supported All Strengths as initial defaults, regular-season/skaters-only v1, and current-season-only windows with honestly known incomplete-N samples eligible when valid. Goalies are proposed as a follow-on.
2. Choose the curated free metric set, optional free discovery, and premium expansion. Confirm whether two-player comparison export ships in v1; the premium comparison itself is confirmed.
3. Approve or revise competition ranks and empirical midrank percentiles, plus the proposed 1080-square charcoal/cyan export. These are design/definition recommendations, not approved decisions.

### Engineering and source verification still needed

- Verify requested field mappings, pooled inputs, supported strengths, actual game coverage, complete league populations, and resolution of the separate WiGO window defect. None requires TJ to guess a technical fact.
- Verify reusable routes/components, monthly/season entitlement behavior, provider redistribution/attribution rules, and portrait/logo permissions.
- Recommend precise calendar/cutoff conventions, supported date limits, snapshot retention, performance targets, source-use limits, and operating cost for review before the affected real-data integration or operating changes. These do not block independent local fixture/UI work.

Authorization gate: task generation and bounded local implementation are authorized. The parent must review the task list before the new Sol handoff. Keep unapproved product choices configurable/proposal-labeled and disable dependent observed/premium behavior until resolved. Production access, repairs/backfill, Git operations, dependencies, spend, deployment, and permission changes need separate authority; current file leases and explicit ownership transfers remain authoritative.
