# CHEF -- Positional Weighting

## Problem and outcome

Draft Pro customers need to reduce defenseman valuations relative to forwards without editing league scoring or projections. Add independently saved position weights to Draft Pro settings. This work makes no assumption about the customer's purchase or refund decision.

## Requirements

- Add C, LW, RW, D, and G valuation weights under Scoring, in a separate Position weights (Draft Pro) section. Display percentages from 0–200%; 100% is neutral. Reset restores all positions to 100% without changing other settings or picks.
- Store optional `draftSettings.positionWeights` multipliers (0–2, default 1). Missing settings and legacy drafts are neutral. Reject malformed portable/saved values; defensively normalize browser state.
- Apply a player's multiplier once to the comparable draft value after points/proration or category scoring, before replacement metrics and tiers. Keep raw projections, displayed projected fantasy points, league scoring, source weights, and category boosts unchanged. Recommendations and value-based rankings consume the resulting metrics. Explicit projection/ADP sorts retain their existing meaning.
- Multipliers scale signed values, including negative category composites; a weight below 100% moves a negative composite toward zero. This follows multiplicative weighting, not an additive penalty. Replacement metrics are recomputed from the weighted pool.
- Resolve weights from the positions displayed by the selected Yahoo/Fantrax source, before forward grouping. Use existing eligibility normalization (F/FWD expands to C/LW/RW). Multi-eligible players receive the highest eligible multiplier once; missing/unsupported eligibility is neutral. Existing Fantrax loading/failure fallback follows the table's displayed Yahoo eligibility; unmatched Fantrax players have no eligible weight and remain neutral.
- Keep the existing roster/replacement eligibility contract unchanged. Position-source changes only determine the applicable new weight; all-neutral configuration must exactly reproduce existing valuation metrics and rankings.
- Gate effective weights and editing with existing Draft Pro eligibility. Free/expired access applies neutral weights without erasing saved choices. Pro users may edit weights during live sync just like category boosts.
- Persist in session resume, saved drafts, and v2/v3 bookmarks. Importing an old bookmark must reset the new setting to neutral, rather than inherit the current draft's weights.

## Acceptance and boundaries

Focused tests cover neutral identity, lower D weight, both league types, negative/zero scores, multi-eligibility, forward grouping, selected-source behavior, entitlement changes, proration, tiers, validation, reset, and persistence. Chef reviews all contributions and runs focused integration/type checks. No push, deployment, customer contact, payment action, schema migration, or unrelated changes.

## Inspection evidence

`buildPlayerValues` feeds both `useVORPCalculations` and `tierDashboardAdapter`. `DraftDashboard` already gates category boosts and sources, serializes complete settings, and handles live-sync-safe valuation edits. `tableAllPlayers` resolves source-selected eligibility separately from imported league/roster eligibility. `savedDrafts` and bookmark payloads retain settings objects; bookmark validation is shared by saved-draft serialization.
