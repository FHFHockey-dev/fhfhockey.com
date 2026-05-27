# FORGE Dashboard Component Purpose Audit

Date reviewed: 2026-05-20

Scope:
- `web/pages/FORGE.tsx`
- `web/pages/forge/dashboard.tsx`
- `web/components/forge-dashboard/*`
- `web/pages/forge/player/[playerId].tsx`
- `web/pages/forge/team/[teamId].tsx`
- `web/lib/dashboard/forgeLinks.ts`

This document explains what each FORGE surface is trying to do, what it currently does well, where it is weak, what it communicates to the user, and how it fits into the broader Forecasting / Sustainability product umbrella.

## Product Framing

FORGE currently mixes two related but distinct jobs:

1. Forecasting
   - Predict what is likely to happen next.
   - Examples: projected player points, goalie start probabilities, game slate context, team power, matchup edge, waiver-add projection support.

2. Sustainability
   - Explain whether recent performance is trustworthy.
   - Examples: hot/cold skater trends, trust/fade calls, luck pressure, ownership movement, role/data guardrails.

The current dashboard is trying to be a command center for both. That is useful, but it also creates tension: some cards are "what should I do tonight?" while others are "is this signal real?" A refactor should make that distinction explicit.

## Component Inventory

| Area | Component | Primary Job | Umbrella |
| --- | --- | --- | --- |
| Core page | `FORGE.tsx` | Quick preview and routing hub | Forecasting + Sustainability |
| Core page | `forge/dashboard.tsx` | Full dashboard shell and filters | Forecasting + Sustainability |
| Landing panel | Tonight's Games | Fast slate preview | Forecasting |
| Landing panel | Best Waiver Adds | Fast add preview | Forecasting |
| Landing panel | Trust Or Fade | Fast sustainability preview | Sustainability |
| Navigation | `ForgeRouteNav` | Preserve FORGE route context | Infrastructure |
| Dashboard card | `TeamPowerCard` | Team strength and matchup environment | Forecasting |
| Dashboard card | `SlateStripCard` | Same-day games and likely starters | Forecasting |
| Dashboard card | `GoalieRiskCard` | Goalie start and blow-up risk | Forecasting |
| Dashboard card | `TopAddsRail` | Ranked waiver-add candidates | Forecasting |
| Dashboard card | `SustainabilityCard` | Trust/fade recent production | Sustainability |
| Dashboard card | `HotColdCard` | Current skater form and movement | Sustainability |
| Detail page | `forge/player/[playerId].tsx` | Player opportunity explanation | Forecasting + Sustainability bridge |
| Detail page | `forge/team/[teamId].tsx` | Team context explanation | Forecasting |
| Dormant card | `TopMoversCard` | Biggest team/skater movers | Sustainability |
| Utility | `forgeLinks.ts` | Context-safe route creation/parsing | Infrastructure |

## Core Pages

### 1. `web/pages/FORGE.tsx`

Line reference: `web/pages/FORGE.tsx:123`

#### Purpose

The FORGE landing page is the quick-read entry point. It gives the user a condensed snapshot of tonight's slate, waiver adds, and trust/fade player calls before sending them into deeper dashboard or detail routes.

#### What It Communicates

"Start here if you want the short version. These are the games that matter, the players worth adding, and the streaks worth trusting or fading."

#### What It Does Well

- Pulls multiple FORGE signals into one compact entry point.
- Avoids forcing the user into the heavier dashboard for every decision.
- Uses stale/nearest-available messaging when the requested date has no exact data.
- Routes users into the correct deeper surfaces: Start Chart, Dashboard, Player Detail, and Trends Player pages.
- Uses cached client fetches and request timeouts, which keeps the landing page from hanging indefinitely when one preview endpoint is slow.

#### What It Does Poorly

- The panels are inline inside the page rather than componentized, so the page is harder to reason about and harder to reuse.
- It duplicates some logic from dashboard cards, especially top-add ranking and sustainability previews.
- The landing page is not truly a product concept of its own yet. It is mostly a lightweight dashboard preview.
- The relationship between "FORGE Dashboard" as a landing title and `/forge/dashboard` as the actual dashboard can be confusing.
- If this page stays, it should either become a real "Quick Read" product or be folded into the main dashboard as a top summary band.

#### Forecasting / Sustainability Fit

This page straddles both umbrellas:
- Forecasting: Tonight's Games and Best Waiver Adds.
- Sustainability: Trust Or Fade.

Its best role is as a pre-dashboard triage surface: a fast scan that answers "what should I look at first?"

#### Distilled Summary

`FORGE.tsx` is a quick-read router. It is useful as a preview layer, but it should not own business logic long term. If FORGE is refactored, its preview panels should become standalone components or be replaced by a first-screen summary module in the dashboard.

### 2. `web/pages/forge/dashboard.tsx`

Line reference: `web/pages/forge/dashboard.tsx:22`

#### Purpose

The FORGE dashboard is the main control center. It owns the global filters, page shell, shared route state, and component composition for the full fantasy hockey decision workflow.

#### What It Communicates

"Choose a date, team, and position, then use the cards below to make lineup, waiver, goalie, and team-context decisions."

#### What It Does Well

- Centralizes date, team, and position filters.
- Keeps route query params synchronized with dashboard state.
- Provides a coherent structure for the main decision cards.
- Separates team/game/add cards from player insight cards.
- Includes ownership filters for the player insight band, which supports deeper league-context tuning.

#### What It Does Poorly

- It has become a composition-heavy page with a lot of state and layout responsibility.
- Filter scope is uneven. Date/team/position affect some cards differently, and ownership is split between global insight controls and local Top Adds controls.
- It does not clearly distinguish Forecasting cards from Sustainability cards in the UI architecture.
- The page title/subtitle still frame the dashboard broadly instead of prioritizing the user's likely workflow: Start Chart, Waivers, Goalies, Team Trends, Player Trends.
- It imports many cards directly and leaves orchestration, route sync, and layout all in one file.

#### Forecasting / Sustainability Fit

This is the umbrella container for both:
- Forecasting: TeamPowerCard, SlateStripCard, GoalieRiskCard, TopAddsRail.
- Sustainability: SustainabilityCard, HotColdCard.

The dashboard should probably become a more explicit "Forecasting Command Center" with a clearly labeled "Sustainability Signals" section.

#### Distilled Summary

`dashboard.tsx` is the real FORGE product surface. It works as a functional shell, but it needs stronger information architecture. A refactor should separate page shell, filter state, and card layout from the individual analytics modules.

## Landing Page Inline Panels

### 3. Tonight's Games Panel

Line reference: `web/pages/FORGE.tsx:429`

#### Purpose

Shows up to three games for the selected date with likely away/home goalie probabilities and a route into `/start-chart`.

#### What It Communicates

"These are the games on the slate, and these are the likely goalie starts worth checking."

#### What It Does Well

- Gives fast game context without loading the full Start Chart.
- Makes goalie probability the main slate signal.
- Handles fallback date messaging when the requested date differs from the available slate.
- Uses team abbreviations and simple matchup rows that are easy to scan.

#### What It Does Poorly

- It is called "Tonight's Games," but its main decision value is goalie-start context.
- It does not surface skater start recommendations, so it is not a true Start Chart preview.
- It only shows three games, which may underserve heavy slate nights.
- It is inline rather than a reusable card.

#### Forecasting / Sustainability Fit

Pure Forecasting. It predicts same-day game and goalie context.

#### Distilled Summary

This is a slate teaser. It should either be renamed around goalie starts or expanded into a real Start Chart preview with position rankings.

### 4. Best Waiver Adds Panel

Line reference: `web/pages/FORGE.tsx:486`

#### Purpose

Ranks a small set of waiver-add candidates by combining player projections with ownership trend data.

#### What It Communicates

"These are the most actionable players to add right now based on projection, availability, and demand."

#### What It Does Well

- Combines projection and ownership instead of showing raw projected points only.
- Filters to a useful ownership range so the panel is actionable.
- Links directly to FORGE player detail pages.
- Shows ownership, five-day movement, and add score in a compact row.

#### What It Does Poorly

- It duplicates core Top Adds logic from `TopAddsRail`.
- The default 25-75 ownership range may not fit all league depths.
- The add score may not be self-explanatory to casual users.
- It does not show why a player was ranked unless the user clicks deeper.

#### Forecasting / Sustainability Fit

Mostly Forecasting, with a small Sustainability input:
- Forecasting: projected fantasy output.
- Sustainability-adjacent: ownership trend/demand as a confidence signal.

#### Distilled Summary

This panel is a useful quick waiver preview, but it should share a reusable data/model layer with `TopAddsRail` instead of rebuilding the same candidate merge inline.

### 5. Trust Or Fade Panel

Line reference: `web/pages/FORGE.tsx:539`

#### Purpose

Shows safer risers and fade candidates using sustainability trend data.

#### What It Communicates

"These recent streaks are not equal. Some look skill-backed; others look inflated by luck."

#### What It Does Well

- Separates "trust" and "fade" into an intuitive two-column decision.
- Uses luck pressure and trust score instead of raw recent points.
- Routes into player trend detail pages for deeper evidence.
- Gives the landing page a meaningful Sustainability element.

#### What It Does Poorly

- The underlying directions are unintuitive in code: cold sustainability rows become safer risers, hot rows become risk/fade rows.
- "Trust score" and "Luck risk" need clearer plain-English definitions.
- It is a preview only and may not show enough evidence to build confidence.
- It duplicates the conceptual role of `SustainabilityCard`.

#### Forecasting / Sustainability Fit

Pure Sustainability. It explains whether recent performance should be believed.

#### Distilled Summary

This is the clearest Sustainability preview on the landing page. It should remain conceptually, but should be backed by a reusable trust/fade component or shared model instead of inline page logic.

## Dashboard Components

### 6. `ForgeRouteNav`

Line reference: `web/components/forge-dashboard/ForgeRouteNav.tsx:88`

#### Purpose

Provides shared navigation across FORGE-adjacent routes while preserving route context.

#### What It Communicates

"You are inside the FORGE ecosystem, and these are the related surfaces you can move between without losing context."

#### What It Does Well

- Centralizes FORGE route links.
- Preserves date, mode, resolvedDate, team, and position context.
- Handles disabled team/player links when no valid context exists.
- Gives the ecosystem a sense of route family rather than isolated pages.

#### What It Does Poorly

- It exposes route names instead of workflow names.
- "Goalie Starts" points to `/start-chart`, but Start Chart is broader than goalies in user expectation.
- "Player Trends" routes outside `/forge`, which is valid but may feel like leaving the ecosystem.
- It is context plumbing and navigation mixed together.

#### Forecasting / Sustainability Fit

Infrastructure. It supports both umbrellas by keeping users inside the decision flow.

#### Distilled Summary

`ForgeRouteNav` is necessary connective tissue. In a refactor, it should use user-task labels rather than technical route labels: Dashboard, Start Chart, Waivers, Goalies, Team Trends, Player Trends.

### 7. `TeamPowerCard`

Line reference: `web/components/forge-dashboard/TeamPowerCard.tsx:92`

#### Purpose

Ranks teams by fantasy environment strength using team ratings, recent team form, and same-day matchup edge.

#### What It Communicates

"These are the strongest fantasy environments today, and these are the teams you may want to target or avoid."

#### What It Does Well

- Combines multiple team-level inputs: power rating, recent form, matchup edge, offense, defense, pace, special teams, and stability.
- Allows top/bottom views, which is useful for both targeting strong teams and attacking weak teams.
- Links team rows into team detail pages.
- Gives team context a real fantasy purpose instead of showing standings-style data.

#### What It Does Poorly

- CTPI/Form language is unclear. Users do not know what "Form" means unless it is explained.
- It may be doing too much in one card: team rankings, spotlights, table, CTPI, matchup edge, stability, sparklines.
- The distinction between "Power", "Form", and "Tonight" is not obvious.
- It is likely hard to scan for a user who only wants a quick lineup decision.

#### Forecasting / Sustainability Fit

Mainly Forecasting:
- Predicts favorable fantasy team environments.
- Uses recent-form signals, but the output is still about future team context.

It has a Sustainability-adjacent input because CTPI/Form tries to explain whether a team's recent strength is improving or declining.

#### Distilled Summary

`TeamPowerCard` is a valuable concept, but the user-facing language should be simplified. It should communicate "Team Trends" and "Team Power Rankings" more clearly, with CTPI hidden behind "Recent Team Form" or "Team Momentum."

### 8. `SlateStripCard`

Line reference: `web/components/forge-dashboard/SlateStripCard.tsx:141`

#### Purpose

Provides an interactive same-day game slate with selected-game matchup context, team ratings, likely goalie starters, and a link to the full Start Chart.

#### What It Communicates

"Here is tonight's slate. Pick a game to see team strength, goalie probabilities, and matchup edge."

#### What It Does Well

- Strongly supports same-day fantasy workflow.
- Lets the user focus one game while still seeing a rail of other games.
- Shows likely goalies and team rating context together.
- Handles team filtering well for narrowed team views.
- Gives a clear route to the full Start Chart.

#### What It Does Poorly

- It is not actually a Start Chart. It is a game/goalie slate card.
- The card can look like the main game context, while skater start/sit ranking lives elsewhere.
- It may compete with `GoalieRiskCard` for goalie-start attention.
- "Tonight's Games" undersells the amount of context in the card.

#### Forecasting / Sustainability Fit

Pure Forecasting. It is about expected same-day game and goalie context.

#### Distilled Summary

`SlateStripCard` is useful, but it should be positioned as "Tonight's Games" or "Game Slate." If a new dashboard needs a Start Chart, that should be a separate top-level module with player start rankings.

### 9. `GoalieRiskCard`

Line reference: `web/components/forge-dashboard/GoalieRiskCard.tsx:90`

#### Purpose

Ranks and explains goalie start calls, win/shutout odds, confidence, stability, and blow-up risk.

#### What It Communicates

"These are the likely goalie starters, and these are the ones safer or riskier to play."

#### What It Does Well

- Turns goalie projections into decision labels: confidence, stability, blow-up risk, recommendation.
- Shows key fantasy goalie stats without requiring the user to interpret raw model outputs.
- Includes confidence drivers like rest, recent starts, back-to-back pressure, and opponent adjustment.
- Supports team filtering.

#### What It Does Poorly

- It overlaps conceptually with SlateStripCard's likely goalie information.
- The table can feel more model/reporting oriented than actionable if the recommendation copy is weak.
- "Blow-up risk" is useful, but needs consistent thresholds and plain-English explanation.
- It does not yet feel like a goalie trend surface if the user expects historical goalie form.

#### Forecasting / Sustainability Fit

Forecasting:
- Predicts start probability and goalie outcomes.

Sustainability-adjacent:
- Volatility/stability tries to explain reliability, but the main job is still forward-looking goalie choice.

#### Distilled Summary

`GoalieRiskCard` is one of the strongest actionable cards. In a redesign, it should be the dedicated "Goalie Trends" or "Goalie Starts" module, with SlateStripCard handling only game context.

### 10. `TopAddsRail`

Line reference: `web/components/forge-dashboard/TopAddsRail.tsx:253`

#### Purpose

Ranks waiver-add candidates for tonight or the week by combining projection, ownership, demand, schedule context, and role/data risk.

#### What It Communicates

"These are the best available players to add, and here is why the model likes them."

#### What It Does Well

- Strong fantasy workflow fit.
- Supports tonight vs week modes.
- Includes ownership range controls for league depth.
- Uses schedule context in week mode, including games remaining and off-night value.
- Breaks down the score into demand, availability, projection, schedule, and risk.
- Links to player detail pages.

#### What It Does Poorly

- It has a lot of local state and data merging responsibility.
- It can be visually dense for a rail/card.
- Ownership controls exist here and also separately in the player insight band, which can create filter confusion.
- The add score formula needs a clear explanation for trust.
- Goalies are technically accepted by the position type, but the logic is primarily skater-add oriented.

#### Forecasting / Sustainability Fit

Mostly Forecasting:
- Projects near-term player value.
- Uses schedule and opportunity context to rank likely usefulness.

Sustainability-adjacent:
- Ownership movement and degraded role context help qualify the signal.

#### Distilled Summary

`TopAddsRail` is a core FORGE feature and should survive a redesign. It should probably become a full "Waiver Adds" module rather than a side rail, with clearer scoring language and shared ownership controls.

### 11. `SustainabilityCard`

Line reference: `web/components/forge-dashboard/SustainabilityCard.tsx:132`

#### Purpose

Splits recent player risers into trust candidates and fade candidates using sustainability, luck pressure, ownership context, and guardrail state.

#### What It Communicates

"Do not treat every hot streak the same. These players look more believable, and these players look more inflated."

#### What It Does Well

- Directly expresses the Sustainability umbrella.
- Uses plain fantasy actions: trust and fade.
- Adds ownership context so signals are league-relevant.
- Shows luck pressure and trend detail routing.
- Handles degraded role signals with "Check role" badges.

#### What It Does Poorly

- The naming can be confusing: "Trust Or Fade" is good, but `SustainabilityCard` is implementation language.
- The model details may still be opaque to users.
- Luck pressure, trust score, and sustainability band need clearer definitions.
- Missing ownership keeps rows visible, which is practical but may confuse users if filters seem inconsistent.

#### Forecasting / Sustainability Fit

Pure Sustainability. This card is the main answer to "is this player signal real?"

#### Distilled Summary

`SustainabilityCard` is conceptually central to FORGE. It should be preserved, renamed in UI terms as "Trust/Fade," and supported with stronger explanatory copy and consistent ownership filter behavior.

### 12. `HotColdCard`

Line reference: `web/components/forge-dashboard/HotColdCard.tsx:140`

#### Purpose

Shows skaters who are currently hot/cold or moving fastest across recent shots, expected goals, ice time, and power-play role.

#### What It Communicates

"These players' recent form or role indicators are changing quickly."

#### What It Does Well

- Separates current form from fast movement.
- Uses multiple driver categories instead of relying only on fantasy points.
- Shows one compact sparkline per column for visual trend confirmation.
- Routes to player trend detail pages.
- Integrates ownership filtering so users can focus on relevant players.

#### What It Does Poorly

- It overlaps with `SustainabilityCard`; users may not know whether to trust Hot/Cold or Trust/Fade first.
- It is skater-only, which is handled with an empty goalie message but can still feel awkward in the global position filter.
- It may be perceived as a recommendation card when it is actually a signal/discovery card.
- "Hot/Cold" can sound like box-score chasing unless paired with the underlying driver explanation.

#### Forecasting / Sustainability Fit

Sustainability:
- It identifies signal movement and recent form.

Forecasting-adjacent:
- These signals may inform future starts/adds, but the card itself is not a projection.

#### Distilled Summary

`HotColdCard` is a discovery layer. It should feed users into Trust/Fade or Player Detail, not compete with those surfaces as a final recommendation.

## Detail / Drill-In Pages

### 13. `web/pages/forge/player/[playerId].tsx`

Line reference: `web/pages/forge/player/[playerId].tsx:80`

#### Purpose

Explains an individual waiver/add candidate with projection, ownership, add-score breakdown, team schedule context, and links to deeper views.

#### What It Communicates

"This is why this player appeared in the FORGE opportunity set, and these are the adjacent details you can inspect."

#### What It Does Well

- Gives the user a landing point from add cards instead of dumping them into generic trends.
- Combines projection, volume, ownership, and add model score.
- Shows upcoming schedule context.
- Preserves return routes and links to team/detail/start-chart/trends.

#### What It Does Poorly

- It is primarily opportunity/add focused, so it may not serve players clicked from Hot/Cold or Trust/Fade equally well.
- It does not deeply explain sustainability unless the user clicks into Trends.
- It duplicates scoring logic and route context logic.
- The page copy says what the page does, but it could be more user-action oriented.

#### Forecasting / Sustainability Fit

Bridge:
- Forecasting: projection, opportunity score, upcoming schedule.
- Sustainability: ownership trend and route into player trend detail.

#### Distilled Summary

The player detail page is useful as an explanation layer for add candidates. A refactor should decide whether this page is "Opportunity Detail" only or a universal FORGE player detail for projections plus sustainability.

### 14. `web/pages/forge/team/[teamId].tsx`

Line reference: `web/pages/forge/team/[teamId].tsx:54`

#### Purpose

Expands a team card into rating blend, recent form, matchup edge, sub-ratings, schedule, record, and adjacent route links.

#### What It Communicates

"This is the team-level context behind the dashboard's team ranking or matchup call."

#### What It Does Well

- Pulls team power, CTPI/form, matchup edge, and schedule into one detail page.
- Gives dashboard team clicks a useful destination.
- Includes adjacent routes: dashboard, start chart, trends, underlying stats.
- Handles missing team context with explicit messages.

#### What It Does Poorly

- CTPI is exposed as an acronym, which is not user-friendly.
- The page is still more context/reporting than decision-making.
- It does not clearly answer specific user questions like "should I stream players against this team?" or "is this team driving fantasy upside tonight?"
- Some route links leave the FORGE family, which is useful but may fragment the experience.

#### Forecasting / Sustainability Fit

Mainly Forecasting:
- Team power, matchup edge, and schedule predict future fantasy environment.

Sustainability-adjacent:
- CTPI/form tries to describe trend quality.

#### Distilled Summary

The team detail page is a useful drill-in but should be reframed around decisions: target, avoid, stream, or monitor. CTPI should be renamed to "Recent Team Form" or "Team Momentum."

## Dormant / Not Currently Used

### 15. `TopMoversCard`

Line reference: `web/components/forge-dashboard/TopMoversCard.tsx:39`

#### Purpose

Compares biggest team or skater improvers/decliners using CTPI and skater-power feeds.

#### What It Communicates

"These teams or skaters have moved the most recently."

#### What It Does Well

- Gives a simple improved/degraded lens.
- Supports both team and skater movement.
- Uses existing TopMovers visualization rather than inventing a new one.
- Could be useful as a compact trend-discovery card.

#### What It Does Poorly

- It is not imported by the current dashboard.
- It overlaps heavily with `HotColdCard`.
- The team lens depends on CTPI, which is not user-facing enough.
- It may add noise unless the dashboard has a clear "movement" section.

#### Forecasting / Sustainability Fit

Sustainability:
- It is about movement and signal change.

Forecasting-adjacent:
- Team movement can inform matchup/team targeting, but it is not a projection by itself.

#### Distilled Summary

`TopMoversCard` should either be retired or folded into `HotColdCard` / `Team Trends`. It is not currently essential enough to justify a separate dashboard card.

## Shared Utility

### 16. `web/lib/dashboard/forgeLinks.ts`

Line reference: `web/lib/dashboard/forgeLinks.ts:42`

#### Purpose

Builds and parses context-preserving FORGE URLs.

#### What It Communicates

Nothing directly. It enables the UI to communicate continuity by preserving date, mode, resolvedDate, team, position, origin, and return path.

#### What It Does Well

- Centralizes query construction.
- Guards date-only params and internal return paths.
- Prevents every component from manually constructing fragile URLs.
- Supports route continuity across dashboard, detail, start-chart, and trends surfaces.

#### What It Does Poorly

- It is a low-level utility with no strong typing around route-specific allowed params.
- It can preserve context that may not make sense for every destination.
- Route naming and workflow naming remain separate concerns.

#### Forecasting / Sustainability Fit

Infrastructure. It supports both umbrellas by keeping context intact as users move between views.

#### Distilled Summary

`forgeLinks.ts` is the route glue. It should remain, but a refactor could add route-specific builders for common workflows like dashboard, player detail, team detail, start chart, and trends player detail.

## CTPI / Team Form Note

The codebase describes CTPI as "Cumulative Team Power Index", but the implementation is better understood as a recent team form index.

It combines:
- Offense: expected goals, high-danger chances, goals.
- Defense: expected goals against, high-danger chances against, shot attempts against.
- Special teams: power-play expected goals and penalty-kill expected goals against.
- Goaltending: season and recent goals saved above expected.
- Luck/PDO.

The final score is scaled roughly onto 0-100 with `50 + 15 * raw`.

Recommendation:
- Do not show `CTPI` as a naked acronym in the dashboard.
- Use "Recent Team Form", "Team Momentum", or "Team Trend Score" in the UI.
- Keep CTPI as the internal metric name if it is already wired into data and tests.

## Refactor Implications

If FORGE is reimagined, the cleanest conceptual model is:

1. Start Chart
   - Player start/sit rankings by position for the selected date.
   - Primary umbrella: Forecasting.

2. Tonight's Games
   - Slate, matchup, likely goalies, and game environment.
   - Primary umbrella: Forecasting.

3. Waiver Adds
   - Add candidates by projection, ownership, demand, schedule, and risk.
   - Primary umbrella: Forecasting.

4. Goalie Trends / Goalie Starts
   - Start probability, win/shutout odds, stability, blow-up risk.
   - Primary umbrella: Forecasting.

5. Player Trends
   - Hot/cold, fast movers, role/deployment changes.
   - Primary umbrella: Sustainability.

6. Trust / Fade
   - Sustainability and luck-pressure interpretation.
   - Primary umbrella: Sustainability.

7. Team Trends
   - Recent team form, momentum, environment changes.
   - Primary umbrella: Sustainability feeding Forecasting.

8. Team Power Rankings
   - Current team fantasy environment rankings.
   - Primary umbrella: Forecasting.

## High-Level Recommendation

The current FORGE system has the right ingredients, but the dashboard needs a stronger product taxonomy.

Recommended user-facing grouping:

### Forecasting

- Start Chart
- Tonight's Games
- Waiver Adds
- Goalie Starts
- Team Power Rankings

### Sustainability

- Player Trends
- Hot/Cold Players
- Trust/Fade
- Team Trends

This would make the dashboard easier to understand because each module would answer one of two questions:

1. What is likely to happen next?
2. Can I trust what just happened?

