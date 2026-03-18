# Forge Dashboard Player Insight Context Adaptation

## Scope

This artifact records the `4.3` adaptation pass that pulls the most useful contextual language from:

- `web/pages/trendsSandbox.tsx`
- `web/pages/trends/placeholder.tsx`

into dashboard-owned player insight components.

## What Was Adapted

### Expected-Band / Elasticity Framing

The dashboard now uses compact band language that mirrors the best part of the sandbox’s elasticity framing:

- `Inside expected band`
- `Leaning above baseline`
- `Pressing the upper band`
- `Outside expected band`

This keeps sustainability rows readable without turning the main dashboard into a formula-heavy validation surface.

### Trend-Band Labels

The companion trend card now uses short dashboard-owned labels adapted from the sandbox and placeholder editorial patterns:

- `Hot stretch`
- `Cold stretch`
- `Acceleration band`
- `Slide band`
- `Low movement band`

These labels are intentionally separate from sustainability labels. They describe momentum posture, not trust.

### Compact Momentum Sparks

`HotColdCard.tsx` now consumes normalized series data from the skater-trend payload and renders compact sparklines using the dashboard’s existing spark classes.

This preserves the useful “tiny visual cue” from the placeholder page without expanding the dashboard into a chart wall.

## Ownership Boundary

The shared owner for this language is now:

- `web/lib/dashboard/playerInsightContext.ts`

That helper is responsible for:

- tone resolution
- sustainability band copy
- trend-band copy

This prevents the JSX for `SustainabilityCard.tsx` and `HotColdCard.tsx` from drifting into different editorial vocabularies.

## Constraint Preserved

This pass did **not** collapse sustainability and movement into one semantic model.

The dashboard still treats:

- sustainability as trust / regression framing
- hot/cold and up/down as movement framing

That separation remains required by the PRD and by the fantasy-hockey workflow the dashboard is meant to support.
