# FORGE Dashboard Source Surface Audit

Task: `1.1`
Date: `2026-03-14`

## Purpose

Audit the current FORGE, Trends, Start Chart, Underlying Stats, Placeholder, and Trends Sandbox surfaces and map their highest-value sections to the refreshed dashboard bands.

This is not a build plan yet. It is a source-value audit that answers:

1. which sections are actually useful to a fantasy hockey user
2. which sections are reusable
3. which sections should stay as drill-ins instead of being copied onto the dashboard

## Target Dashboard Bands

The refreshed dashboard should be organized around these bands:

1. Top Band
   - Tonight's Slate hero
   - Top Player Adds rail
2. Team Trend Context
3. Player Insight
   - Sustainable vs Unsustainable
   - Hot vs Cold
   - Trending Up vs Trending Down
4. Goalie and Risk
5. Supporting Navigation / Drill-ins

## Source Audit

### [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)

High-value sections:

- goalie game ticker / slate strip
- goalie confidence, volatility, and blowup risk badges
- starter confidence drivers
- uncertainty ranges
- quick projection context for skaters

Most valuable to fantasy users because:

- it is already close to a decision surface for starts
- it makes goalie uncertainty legible
- it links matchup context to actionable goalie choices

Best reuse target:

- Goalie and Risk band
- partial reuse for the top-band slate strip

Do not lift directly:

- the long card-wall layout
- the current full-page projection list structure
- the accuracy section as a hero element

### [trends/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/index.tsx)

High-value sections:

- player search
- CTPI pulse chart
- CTPI movers
- Team Power panel
- skater trend panels
- compact trend tabs and chart shells

Most valuable to fantasy users because:

- it connects team environment to player decisions
- it already has good drill-in behavior
- it provides strong trend framing for both teams and skaters

Best reuse target:

- Team Trend Context band
- supporting chart shells for the Player Insight band
- nav/search behavior

Do not lift directly:

- the current amount of simultaneous trend density
- the full two-mode dashboard layout as-is

### [start-chart.tsx](/Users/tim/Code/fhfhockey.com/web/pages/start-chart.tsx)

High-value sections:

- game strip
- matchup context
- goalie probability bars
- ownership filtering
- position grouping
- team pulse context

Most valuable to fantasy users because:

- it is the clearest slate-native fantasy surface
- it directly supports start/sit and stream decisions
- it already uses ownership as a practical fantasy constraint

Best reuse target:

- Tonight's Slate hero
- Top Player Adds rail
- limited reuse in Goalie and Risk band

Do not lift directly:

- the full multi-column per-position dump
- the page-scale filter layout

### [trends/player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/player/[playerId].tsx)

High-value sections:

- metric-family grouping
- rolling and baseline toggles
- sustained streak cards
- multi-metric chart

Most valuable to fantasy users because:

- it is the best current deep-dive tool for answering whether a player signal is real
- it organizes metrics into understandable families

Best reuse target:

- drill-in destination for sustainability and trend cards
- card interaction model inspiration

Do not lift directly:

- full detail onto the dashboard home
- chart complexity onto the main page

### [underlying-stats/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx)

High-value sections:

- top-team summary cards
- sub-ratings spotlight
- variance flag
- legend/formula framing

Most valuable to fantasy users because:

- it turns team environment into digestible, ranked context
- variance flagging is useful for identifying unstable team environments

Best reuse target:

- Team Trend Context band
- team-detail page

Do not lift directly:

- the full wide table onto the dashboard home

### [trends/placeholder.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/placeholder.tsx)

High-value sections:

- hero storytelling tone
- chart-card composition
- hot/cold rows with reasons
- chart plus movers pairing
- section framing for sustainability

Most valuable to fantasy users because:

- it is the strongest current example of packaging trend insight in a readable way
- it provides useful editorial framing without losing the stats-first posture

Best reuse target:

- Player Insight band composition
- card tone and labeling

Do not lift directly:

- the placeholder page structure as a whole
- duplicated chart variants where one reusable shell would do

### [trendsSandbox.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsSandbox.tsx)

High-value sections:

- elasticity snapshot
- trend-band chart
- hot/cold streak chart concept
- sustainability framing

Most valuable to fantasy users because:

- it is closest to answering the main dashboard question: who is for real and who is fake hot
- it brings trust and signal quality into the UI

Best reuse target:

- Sustainable vs Unsustainable cards
- signal-quality logic and supporting chart concept

Do not lift directly:

- the experimental search-and-lab workflow
- the sandbox-style control density

### [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx)

High-value sections:

- shared date/team/position filter idea
- drift warning banner

Most valuable to fantasy users because:

- it already assumes one unified dashboard
- drift visibility is operationally useful

Best reuse target:

- shared control ideas
- section freshness warning behavior

Do not lift directly:

- the current modular six-card composition
- the current page hierarchy, which feels too disconnected

## Recommended Mapping

### Tonight's Slate hero

Use primarily:

- [start-chart.tsx](/Users/tim/Code/fhfhockey.com/web/pages/start-chart.tsx)
- [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)

Must include:

- matchup strip
- teams and game identity
- goalie start probabilities
- immediate slate context

### Top Player Adds rail

Use primarily:

- [start-chart.tsx](/Users/tim/Code/fhfhockey.com/web/pages/start-chart.tsx)
- [ownership-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-trends.ts)
- [TransactionTrends.tsx](/Users/tim/Code/fhfhockey.com/web/components/TransactionTrends/TransactionTrends.tsx)
- trend-ranking logic from [trends/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/index.tsx)

Must include:

- recent trend strength
- hard ownership gating
- ownership sparkline
- tonight versus this week framing

### Team Trend Context

Use primarily:

- [underlying-stats/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx)
- [trends/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/index.tsx)

Must include:

- team power
- CTPI
- matchup strength
- variance / sustainability warning

### Player Insight

Use primarily:

- [trendsSandbox.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsSandbox.tsx)
- [trends/placeholder.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/placeholder.tsx)
- [trends/player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/player/[playerId].tsx)

Must include:

- Sustainable vs Unsustainable
- Hot vs Cold
- Trending Up vs Trending Down
- short reason text
- drill-in to player detail

### Goalie and Risk

Use primarily:

- [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)
- [start-chart.tsx](/Users/tim/Code/fhfhockey.com/web/pages/start-chart.tsx)

Must include:

- starter probability
- risk / volatility
- confidence drivers
- matchup context

## Merge Candidates Identified By This Audit

1. Slate strip and goalie matchup strip should become one shared slate component family.
2. Team power summary, CTPI movers, and matchup context should become one team-context component family.
3. Sustainability, hot/cold, and trend movement should become one trend-signal component family with multiple modes, not separate unrelated implementations.
4. Ownership-aware player opportunity cards should merge projection, ownership, and trend context instead of splitting that logic across multiple pages.

## Sections That Should Stay As Drill-ins

These are valuable, but should not be fully reproduced on the home dashboard:

- full player trend chart lab in [trends/player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/player/[playerId].tsx)
- full start-chart position lists in [start-chart.tsx](/Users/tim/Code/fhfhockey.com/web/pages/start-chart.tsx)
- full team power table in [underlying-stats/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx)

## Conclusion

The best dashboard is not a restyled version of the current [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx).

It should instead combine:

- the slate clarity of [start-chart.tsx](/Users/tim/Code/fhfhockey.com/web/pages/start-chart.tsx)
- the goalie confidence detail of [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)
- the team-context strength of [trends/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/index.tsx) and [underlying-stats/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx)
- the readability of [trends/placeholder.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/placeholder.tsx)
- the trust framing of [trendsSandbox.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsSandbox.tsx)

That is the correct source map for the refreshed FORGE dashboard.
