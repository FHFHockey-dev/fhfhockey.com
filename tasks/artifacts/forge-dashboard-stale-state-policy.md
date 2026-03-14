# FORGE Dashboard Stale-State Policy

Task: `1.6`
Date: `2026-03-14`

## Purpose

Document section-specific stale-data behavior and warning treatment for the refreshed FORGE dashboard so implementation does not improvise different rules per component.

This policy is based on the current known data surfaces:

- [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx)
- [start-chart.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/start-chart.ts)
- [forge/players.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/forge/players.ts)
- [forge/goalies.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/forge/goalies.ts)
- [ownership-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-trends.ts)
- [team-ratings.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/team-ratings.ts)

The dashboard should prefer showing stale-but-labeled data over hiding useful context, but not all sections have the same tolerance.

## Status Model

Each dashboard section should resolve to one of four states:

1. `current`
   - selected date and resolved date match
   - no freshness warning
2. `fallback`
   - section is showing a prior valid snapshot instead of the requested one
   - visible warning required
3. `degraded`
   - some supporting data is stale or missing, but the section still has enough value to render
   - visible warning required
4. `blocked`
   - the section cannot present a trustworthy or useful view
   - render a blocked-state card with explanation

The product answer selected earlier was effectively:

- show stale data with warning when possible

This policy makes “when possible” explicit per section.

## Global Rules

### Rule 1: Date mismatch must be visible

If a section resolves to a different date than the selected date, the section must expose:

- the resolved date
- a warning label

The page may also show a global drift banner summarizing the mismatched sections, but the section itself still needs local warning context.

### Rule 2: Section-local warnings beat silent fallback

Do not silently substitute previous data for:

- slate
- goalie
- Top Adds
- sustainability

If fallback happens, the section must say so.

### Rule 3: Supporting-data failure does not always block the section

If a section’s primary payload is available but a supporting signal is stale or missing, prefer:

- render degraded
- show warning copy
- suppress only the missing sub-element

### Rule 4: Missing freshness metadata is not acceptable long-term

Every dashboard section adapter should expose:

- `requestedDate`
- `resolvedDate` or equivalent
- `freshnessState`
- optional `warningReason`

If the underlying route does not currently provide enough freshness metadata, the dashboard adapter layer should synthesize the minimal state and the gap should be tracked for follow-up.

## Section Policy Matrix

### 1. Top Command Band

#### 1A. Tonight's Slate hero

Primary source:

- [start-chart.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/start-chart.ts)

Known freshness signal:

- `dateUsed`

Allowed states:

- `current`
- `fallback`
- `blocked`

Policy:

- if `dateUsed === selectedDate`, render normally
- if `dateUsed !== selectedDate` but a valid fallback slate exists, render the slate with a visible warning chip such as `Using {dateUsed}`
- if no usable games or related slate data exist, render a blocked-state card

Do not use:

- silent fallback

Why:

- the top band anchors the whole page
- silent date drift at the hero level would mislead the user immediately

#### 1B. Top Player Adds rail

Primary sources:

- trend and/or projection sources
- `yahoo_players`
- ownership trend data

Allowed states:

- `current`
- `fallback`
- `degraded`
- `blocked`

Policy:

- if player opportunity context resolves for the selected mode and date, render normally
- if player opportunity data falls back to a previous valid date, render with a local warning
- if ownership sparkline data is stale or missing but current ownership exists, render degraded:
  - keep the card
  - suppress or downgrade the sparkline
  - show ownership-warning copy if needed
- if trend/projection inputs are not trustworthy enough to rank adds, block the section

Why:

- fantasy utility still exists if ownership sparkline is stale
- fantasy utility does not exist if the add ranking itself is untrustworthy

### 2. Team Trend Context

Primary sources:

- team ratings
- CTPI
- matchup / schedule context

Allowed states:

- `current`
- `fallback`
- `degraded`

Policy:

- if team context uses the selected date or a clearly labeled nearby valid snapshot, render it
- if CTPI or momentum context is stale but team power is valid, render degraded and label the missing or stale sub-signal
- if variance warning cannot be computed, do not block the section; drop that sub-element and render degraded

Why:

- team context is valuable even when one supporting signal lags
- it is a contextual band, not the sole decision surface

### 3. Sustainable vs Unsustainable

Primary sources:

- sustainability trend-band and signal logic

Allowed states:

- `current`
- `fallback`
- `degraded`
- `blocked`

Policy:

- if the sustainability snapshot is current, render normally
- if the latest available trust signal is older than requested but still coherent, render with a visible stale label
- if a player can still be classified but one support metric is missing, render degraded and keep the short reason honest
- if trust classification itself cannot be established, block the section instead of faking neutral certainty

Why:

- this section makes stronger claims than a simple ranking list
- trust-state claims must be guarded more tightly than team context

### 4. Hot vs Cold / Trending Up vs Trending Down

Primary sources:

- trend movement logic and sparkline context

Allowed states:

- `current`
- `fallback`
- `degraded`

Policy:

- if movement series is current, render normally
- if movement series is slightly stale but direction is still useful, render with warning
- if the sparkline or movement visual is missing but the ranked movement list exists, render degraded
- if the movement list itself cannot be generated, block only that tab state rather than the entire player insight module if another tab remains valid

Why:

- trend movement is useful even when not perfectly current
- tabs should degrade independently where possible

### 5. Goalie and Risk

Primary source:

- [forge/goalies.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/forge/goalies.ts)

Known freshness signals:

- `asOfDate`
- fallback metadata

Allowed states:

- `current`
- `fallback`
- `degraded`
- `blocked`

Policy:

- if `asOfDate === selectedDate`, render normally
- if the route resolves to a fallback run/date, render with a strong warning
- if calibration hints or some confidence-driver metadata are missing but the goalie probabilities are valid, render degraded
- if the section cannot establish trustworthy goalie start and risk context, block the section

Why:

- goalie decisions are high leverage
- start and risk data need stronger warning treatment than general team context

### 6. Landing Page Preview Cards

Primary source:

- aggregated preview adapters for the rebuilt `/FORGE`

Allowed states:

- `current`
- `fallback`
- `degraded`

Policy:

- preview cards may degrade more aggressively than the main dashboard
- if a preview has usable data but is stale, show the preview with warning and route users to the full dashboard
- only block the preview card if it has no meaningful content at all

Why:

- the landing page is a gateway
- it should remain useful even when previews are less complete than the main dashboard

## Visual Treatment Rules

### Current

- no warning chip
- no warning border

### Fallback

- warning chip near section title
- include resolved date in copy
- preserve full section rendering when useful

Suggested copy pattern:

- `Using latest available data from 2026-03-13`

### Degraded

- muted warning chip or inline note
- render available content
- suppress missing sub-elements instead of collapsing the whole section

Suggested copy pattern:

- `Ownership trend unavailable`
- `Variance signal unavailable`
- `Showing rankings without sparkline context`

### Blocked

- render dedicated blocked-state card
- explain why the section is unavailable
- provide next-step or alternate route when possible

Suggested copy pattern:

- `Goalie risk unavailable for this date`
- `No trustworthy sustainability snapshot is available`

## Metadata Requirements Per Section Adapter

Every section adapter should expose:

1. `requestedDate`
2. `resolvedDate`
3. `state`
4. `warningReason`
5. `generatedAt` or equivalent if available

Preferred shape:

```ts
type SectionFreshness = {
  requestedDate: string;
  resolvedDate: string | null;
  state: "current" | "fallback" | "degraded" | "blocked";
  warningReason: string | null;
  generatedAt?: string | null;
};
```

## Cross-Section Dashboard Behavior

### Global drift banner

Use when:

- one or more sections are in `fallback`

Banner should summarize only the sections with mismatched dates.

### No global hard-block

Do not block the entire dashboard because one section is blocked.

Instead:

- let sections fail independently
- keep the top-level dashboard usable if the remaining high-value sections still work

### Priority order under degradation

If multiple sections degrade at once, preserve:

1. slate
2. Top Adds
3. sustainability
4. goalie
5. team context

This ordering reflects the product thesis and should influence how aggressively sections try to render with warnings rather than disappear.

## Implementation Guidance

1. Freshness logic should live in section adapters or data hooks, not in scattered JSX conditionals.
2. Warning-chip UI should be shared so sections do not invent inconsistent stale states.
3. The current drift-banner behavior in [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx) should evolve into a generalized section-freshness model rather than stay module-specific.

## Conclusion

The dashboard should be tolerant of stale data, but not silent about it.

The practical rule is:

- fallback or degrade when the user still gets real value
- block only when the section would become misleading or empty

That keeps the dashboard useful without pretending all signals are equally fresh.
