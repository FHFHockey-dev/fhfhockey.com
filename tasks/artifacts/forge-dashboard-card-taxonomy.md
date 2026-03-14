# FORGE Dashboard Card Taxonomy

Task: `1.3`
Date: `2026-03-14`

## Purpose

Define the core card families for the refreshed FORGE dashboard so implementation does not drift into one generic card shape trying to do every job.

This taxonomy establishes:

- what each card family is for
- what data it must show
- what it may show
- what interaction it supports
- how it behaves in stale, empty, and mobile contexts

## Card Families

The refreshed dashboard should use distinct card families, not a single shared player-card template with minor cosmetic changes.

Primary card families:

1. Projection / Opportunity Card
2. Sustainability Signal Card
3. Streak / Trend Card

Related supporting families:

4. Team Context Card
5. Goalie Risk Card
6. Slate Matchup Tile

The first three are the strict scope of this sub-task. The supporting families are included because the player-card families need a shared context language.

## 1. Projection / Opportunity Card

### Purpose

Answer:

- should I add or stream this player now
- is this player relevant tonight or this week
- how available is this player in fantasy leagues

### Typical placement

- Top Player Adds rail
- secondary add / streamer boards
- FORGE landing page preview

### Must show

1. player identity
   - headshot
   - full name
   - team
   - position
2. opportunity context
   - `Tonight` or `This Week` mode
   - opponent or schedule context
   - games remaining or schedule leverage where relevant
3. ownership context
   - current ownership
   - recent ownership sparkline
4. trend context
   - recent trend-strength score or rank
5. quick fantasy summary
   - brief projection or opportunity label

### May show

- small sustainability badge
- matchup quality label
- special-teams opportunity hint
- role/deployment hint

### Must not become

- a deep sustainability explainer card
- a long-form stat table
- a generic clone of the player trend page

### Primary interactions

1. primary click
   - open the player destination best suited to actionability and near-term context
2. secondary interaction
   - reveal quick ownership / schedule details
3. contextual interaction
   - respect ownership slider and `Tonight` / `This Week` toggle immediately

### Default state rules

- Top Adds uses `25%` to `75%` ownership by default
- ownership sparkline default lookback is `5` days
- the card should rank well when recent trend strength is strong and ownership is still low enough to matter

### Empty / stale behavior

- if projection context is unavailable but ownership and trend context exist, show a degraded card with a warning
- if player availability cannot be determined, the card should still render with an explicit missing-context label

### Mobile behavior

- keep compact vertical stack
- preserve headshot, ownership, and one-line opportunity summary
- hide low-priority metadata before removing the core actionability fields

## 2. Sustainability Signal Card

### Purpose

Answer:

- is this player’s recent performance trustworthy
- is the breakout real
- is the heater unsupported by underlying process

### Typical placement

- Sustainable vs Unsustainable section
- sustainability preview on the FORGE landing page

### Must show

1. player identity
   - headshot
   - name
   - team
   - position
2. signal classification
   - sustainable riser
   - unsustainable heater
   - or similar trust-state label
3. core evidence summary
   - one short reason sentence
4. sustainability evidence
   - elasticity or trend-band signal
   - trust/fade badge

### May show

- one compact support metric
- recent ownership note
- recent opportunity context

### Must not become

- a streak card
- a projection card
- a full player-detail page embedded into the dashboard

### Primary interactions

1. primary click
   - open the player destination best suited to explaining why the signal is real or fake-hot
2. secondary interaction
   - reveal a compact evidence drawer or tooltip if needed

### Default state rules

- the section must open on sustainable risers and unsustainable heaters
- the card should communicate trust state faster than it communicates raw numbers

### Empty / stale behavior

- stale cards may render if the latest trustworthy signal is still useful, but the card must visibly warn that the signal is not fully current
- if trust classification cannot be established, do not fake confidence with neutral styling alone

### Mobile behavior

- this family remains expanded by default on mobile
- reason text must remain visible without requiring expansion

## 3. Streak / Trend Card

### Purpose

Answer:

- who is heating up
- who is cooling off
- who is trending up or down in the short term

### Typical placement

- Hot vs Cold section
- Trending Up vs Trending Down section

### Must show

1. player identity
   - headshot
   - name
   - team
   - position
2. trend label
   - hot
   - cold
   - trending up
   - trending down
3. short explanation
   - concise reason grounded in movement, not generic praise
4. compact visual support
   - sparkline or tiny movement indicator

### May show

- ownership percentage
- recent delta label
- one context stat

### Must not become

- a sustainability verdict by itself
- a projection card
- a dense chart module

### Primary interactions

1. primary click
   - open the player destination best suited to trend drill-in
2. secondary interaction
   - switch between hot/cold and trending up/down sets through tabs, not through card expansion

### Default state rules

- trend cards should move quickly and scan quickly
- reason text should be shorter than sustainability cards
- movement visual should support the story without requiring a full chart

### Empty / stale behavior

- stale trend cards may remain visible with warning if movement is still directionally useful
- if the movement series is missing, the card should not pretend to be trend-backed

### Mobile behavior

- preserve the short reason and one movement visual
- keep these cards collapsible behind their section tab/accordion when not prioritized

## Supporting Families

### 4. Team Context Card

Purpose:

- explain the environment around a player or matchup

Must show:

- team identity
- team power
- CTPI or momentum
- matchup strength
- variance or instability cue

Interaction:

- click through to dedicated team detail

### 5. Goalie Risk Card

Purpose:

- make high-leverage goalie decisions legible

Must show:

- goalie identity
- start probability
- risk / volatility
- confidence drivers
- matchup context

Interaction:

- click into a goalie-aware detail destination or relevant slate detail

### 6. Slate Matchup Tile

Purpose:

- anchor the dashboard in the active slate

Must show:

- matchup identity
- team logos
- goalie bars or slate indicators
- quick click-through to deeper views

Interaction:

- open game, team, or start-chart drill-ins depending on click target

## Cross-Family Rules

### Visual hierarchy

1. Projection cards emphasize actionability.
2. Sustainability cards emphasize trust.
3. Trend cards emphasize movement.

### Data hierarchy

1. Projection cards may include limited trust context.
2. Sustainability cards may include limited opportunity context.
3. Trend cards may include limited ownership context.

But:

- no card family should absorb the full job of another family

### Ranking logic implications

1. Projection cards can rank by opportunity usefulness.
2. Sustainability cards rank by trust/fade significance.
3. Trend cards rank by movement significance.

### Click-routing implications

This taxonomy implies card-type-specific routing:

- projection / opportunity cards may route to a different destination than trust-oriented cards
- sustainability cards should favor the route that best explains signal quality
- streak / trend cards should favor the route that best explains recent movement

The exact route mapping belongs in task `1.5`, but this taxonomy requires that routing differ by card family.

## Recommended Component Families

The implementation should converge toward:

1. `PlayerOpportunityCard`
2. `PlayerSustainabilityCard`
3. `PlayerTrendCard`
4. `TeamContextCard`
5. `GoalieRiskCard`
6. `SlateMatchupTile`

These may share small internal atoms, but they should not collapse into one universal card API.

## Conclusion

The dashboard should not be built from one catch-all player card.

It needs:

- one card family for actionability
- one card family for trust
- one card family for short-term movement

That separation is necessary if the page is going to answer both:

- who can I use
- who can I trust
