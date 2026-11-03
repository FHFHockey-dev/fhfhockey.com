# BLSH brief decisions (TJ, 2026-11-03)

These answer the six "Where the brief itself needs decisions" questions from the BLSH/sKO/VuDu adversarial review. TJ answered each in a pop-up; the text under each heading is TJ's answer verbatim. These are product decisions. Implementation, validation and release each still need their own work and approvals.

## 1. Own baseline and players without enough history

> Use a recency-weighted personal baseline based on up to three completed seasons plus current-season games before the evaluated window. Start with 0.6/0.3/0.1 for the prior seasons, but define how current-season evidence is blended and weight appropriately for games or ice-time exposure. Treat the weights as provisional and test them against the 82-game and prior-season alternatives.
>
> Below approximately 20 personal games, withhold buy/sell direction and show cohort context with an insufficient-history label. Treat that cutoff as provisional; distinguish unavailable history from confirmed zero history. Keep the evaluated window and later games out of the baseline. Show meaningful role and opportunity changes alongside the established baseline, and compare per-game and per-60 metrics with matching baselines.

Settles: C2 (stale 2022-24 baseline) and extends H1 (the committed zero-history gate becomes a provisional ~20-game threshold). Still needed: the current-season blend rule and the exposure weighting, plus the comparison test against the 82-game and prior-season baselines.

## 2. Selectivity

> Use the eligible, ranked top-N approach: show the top 25 buy-low and top 25 sell-high candidates per position group, with the full ranked lists one click away. Do not force balanced, conflicting or insufficient evidence into either list; retain a neutral or withheld state as appropriate. Keep the 0.20 and 0.10 chance screens provisional until historical testing supports their use.

Settles: H2 (with the earlier eligibility rule: full 5-game window plus personal history) and L2 (separate F and D views).

## 3. Opportunity

> Show two comparisons side by side: production versus the player's established per-game baseline, and a separately labeled opportunity-adjusted comparison using current TOI and power-play usage where the inputs and method support it. Show the underlying TOI and PP changes and explain their possible impact. Do not automatically treat a promotion as sell-high or as proof that the new role will persist.
>
> When the comparisons disagree, show that conflict and its reason. Do not force a buy/sell direction when the evidence is genuinely balanced or the conflict prevents a defensible interpretation; otherwise allow a clearly explained, qualified direction. If an adjusted comparison cannot be supported, show it as unavailable rather than zero and retain the unadjusted evidence. Validate the adjustment and its assumptions separately.

Settles: H4. Still needed: a PP-usage adjustment method and its own validation.

## 4. Trade comparisons and forecasts

> Provide a separate trade comparison under the manager's league scoring. Where qualified FORGE forecasts are available, show the next 10 scheduled team games by default, with 5 and 20 as options, clearly labeled as forecasts with their uncertainty and participation assumptions. Show retrospective BLSH evidence alongside each player, distinctly from the forecast.
>
> If a forecast is unavailable or not qualified, say so and allow a clearly labeled retrospective comparison where useful; do not substitute zeros or present it as a forward estimate. An experimental forecast must be labeled as such. Forecast availability must not block the core BLSH lists. Future predictive additions to BLSH are allowed if independently validated and clearly distinguished from retrospective evidence.

Settles: the forecast-vs-retrospective conflict and part of H5. A forecast belongs to the trade view, labelled as such, and the BLSH gap stays retrospective. Relevant existing code: `web/lib/buyLowSellHigh/trade.ts` (`compareTrade`, unwired).

## 5. Combined assessment

> Lead with the gap under the manager's own league scoring, using FHFH Standard as the default. Show NHL points and Game Score as separate supporting tracks. Do not use equal weights as a validated headline merely for continuity.
>
> A combined retrospective assessment may be introduced when its purpose, weighting and interpretation are justified against the retrospective question it is meant to answer, with its component contributions visible. If it claims to improve forward-looking decisions, separately test it chronologically against the league-scoring track alone and appropriate simple baselines. Until those standards are met, keep the tracks separate and explain the evidence used for any ranking. Missing tracks must not silently become zeros.

Settles: M4. The headline becomes the league-scoring track, and the equal 1/3 composite stops being the headline.

## 6. Market value

> Prioritize integrating the Yahoo Trade Market and building a shared, league-aware trade-value pipeline that can serve BLSH, Trade Analyzer and Roster Autopsy (The last two being planned pages to be built in the future that are not implemented yet). Use observed Yahoo trades as market evidence alongside the pipeline's own player valuations; keep the two distinct and show the source, observation date and relevant league or trade context. Account for multi-player trades and other assets without assuming each player has an independently observed price.
>
> Validate source access, permitted use, player identity, coverage and data quality before presenting market conclusions. If the market source or a valuation input is unavailable, show that limitation rather than inventing a value. Manager-entered offers can supplement the evidence. Ownership and ADP are context, not trade prices. Plan the shared pipeline as a priority without assuming a particular formula or that all three products must release simultaneously.

Settles: the market-source question. Relevant existing code: the Yahoo Trade Market observation contract in `web/lib/player-cards/analysisEvidence.ts` (`TradeObservation`, `cardTradeContext`) and `compareMarketReference` in `web/lib/buyLowSellHigh/market.ts`. The first step is the access and permitted-use validation.
