# FORGE Dashboard Section Blueprint

Task: `1.2`
Date: `2026-03-14`

## Purpose

Convert the dashboard PRD and source-surface audit into one explicit section blueprint for:

- desktop hierarchy
- mobile hierarchy
- top-band composition
- section responsibilities
- chart budget
- accordion behavior

This blueprint is the page-shape contract for the refreshed [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx).

## Primary Product Thesis

The dashboard is a one-page fantasy control surface with this priority order:

1. tonight's slate
2. top player adds
3. team environment
4. who is sustainable versus fake hot
5. goalie risk and confidence

The page should answer:

- what is happening tonight
- which players are actionable
- whether their trend is trustworthy
- whether the team environment supports the add

## Desktop Blueprint

### Band 1: Top Command Band

Layout:

- full-width top row
- dominant slate hero on the left / center
- fixed-width Top Player Adds rail on the right

Subsections:

1. Compact secondary nav
   - dashboard
   - trends
   - start chart
   - team detail access
   - FORGE landing
2. shared status / controls strip
   - active date
   - stale / drift warning
   - optional global team or position context when useful
3. Tonight's Slate hero
   - game strip
   - matchup identity
   - goalie start bars
   - quick matchup cues
4. Top Player Adds rail
   - `Tonight` / `This Week` toggle
   - ownership slider defaulting to `25%` to `75%`
   - ownership sparkline
   - recent trend strength
   - quick click-through

Why it exists:

- puts the active slate first
- makes opportunity visible immediately
- does not force the user to scroll before seeing actionable adds

### Band 2: Team Trend Context

Layout:

- full-width band beneath the command band
- `2` or `3` compact panels depending on screen width

Contents:

1. Team Power board
2. CTPI / momentum context
3. matchup strength and variance warning

Expected elements:

- top teams or matchup-relevant teams
- compact sub-ratings
- variance / sustainability warning
- team logo and click-through to team detail

Why it exists:

- converts team environment into a usable fantasy decision input
- gives context for whether a player add is supported by the situation

### Band 3: Player Insight Core

Layout:

- wide central band
- primary tabs across the section header

Tab sets:

1. `Sustainable` vs `Unsustainable`
2. `Hot` vs `Cold`
3. `Trending Up` vs `Trending Down`

Default first view:

- sustainable risers
- unsustainable heaters

Expected contents:

- distinct sustainability cards
- distinct streak / trend cards
- short reason text
- trust / fade framing
- click-through to the correct player destination by card type

Why it exists:

- this is the main answer to the dashboard’s thesis question:
  - who is for real
  - who is fake hot

### Band 4: Goalie and Risk

Layout:

- compact but prominent lower band
- should feel tied to the slate, not detached from it

Contents:

1. top goalie starts
2. start probability
3. risk / volatility
4. confidence drivers
5. matchup context

Why it exists:

- goalies are high-leverage fantasy decisions
- the user needs more than a simple start probability number

### Band 5: Supporting Compact Charts

Chart budget:

- maximum `2` to `3` compact charts visible on desktop at once

Recommended chart allocation:

1. CTPI or team pulse chart
2. ownership or player-trend support chart
3. one sustainability-support chart only if it earns the space

Rules:

- charts support decisions
- charts do not dominate the page
- if a card can communicate the insight faster, prefer the card

## Mobile Blueprint

### Mobile Order

1. top command controls
2. Tonight's Slate
3. Sustainable / Unsustainable
4. Top Player Adds
5. Goalie and Risk
6. Team Trend Context
7. heavier supporting charts and secondary tabs

### Mobile Expansion Rules

Expanded by default:

1. slate
2. sustainable / unsustainable
3. goalie section

Collapsed behind accordions by default:

- heavier charts
- secondary trend-state sections
- deeper team context tables or matrices

### Mobile Behavior Goals

- keep the same product model as desktop
- reduce simultaneous density
- preserve actionability first

## Section Responsibilities

### Tonight's Slate

Responsible for:

- orienting the user to the active night
- showing playable games and matchup context
- anchoring the rest of the dashboard

Must not try to do:

- full player-list browsing
- deep sustainability analysis

### Top Player Adds

Responsible for:

- actionable waiver / streamer opportunities
- ownership-aware ranking
- tonight versus weekly streaming choice

Must not try to do:

- every type of player trend story
- full player detail analysis

### Team Trend Context

Responsible for:

- explaining whether the environment supports the player opportunity
- highlighting strong and unstable team situations

Must not try to do:

- full team-detail depth on the home page

### Player Insight Core

Responsible for:

- real versus fake hot framing
- sustainability versus streak separation
- quick triage of player trust

Must not try to do:

- full multi-metric player lab behavior on the home page

### Goalie and Risk

Responsible for:

- high-confidence goalie start decisions
- downside awareness

Must not try to do:

- long-form model explanation

## Desktop Composition Ratios

Recommended relative weight:

- Band 1: largest and most visually dominant
- Band 2: compact but high-signal
- Band 3: largest analytical band
- Band 4: medium-size decision band
- Band 5: small supporting evidence band

The page should read as:

- slate first
- adds second
- context third
- trust analysis fourth

## Visual and Interaction Guidance

1. The page should feel like one instrument panel, not a sequence of unrelated cards.
2. Every band should contain obvious click targets into drill-ins.
3. Headshots should imply player drill-ins.
4. Team logos and team rows should imply team drill-ins.
5. Tab changes should switch insight lenses, not page modes.
6. The `Tonight` / `This Week` toggle should feel local to Top Player Adds, not global to the dashboard.

## Implementation Implications

This blueprint implies:

1. the current `forge/dashboard.tsx` grid should be replaced, not lightly adjusted
2. the dashboard needs section shells before detailed card build-out
3. the component plan should favor:
   - one slate family
   - one team-context family
   - one player-opportunity family
   - one trend-signal family
4. responsive behavior should be designed band-first, not card-first

## Conclusion

The refreshed FORGE dashboard should be built as a slate-first layered control surface:

- a dominant top band
- a strong team-context band
- a distinct player-insight core
- a dedicated goalie/risk band
- only a small supporting chart layer

That is the correct page blueprint for implementation.
