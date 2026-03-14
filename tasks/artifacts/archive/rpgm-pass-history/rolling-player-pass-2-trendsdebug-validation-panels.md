# Rolling Player Pass-2 `trendsDebug.tsx` Validation Panels

## Purpose

This artifact records the UI panel work completed for task `4.5`.

The page now exposes the required pass-2 validation panels as actual inspection surfaces driven by the read-only validation payload and the focused row selectors added in task `4.4`.

## Implemented Panels

### Freshness banner

The page now shows:

- readiness status
- source-tail reference date
- stored row count
- recomputed row count
- blocker list
- caution list
- next recommended action

### Stored value panel

The page now shows:

- selected metric / field
- canonical field
- canonical stored value
- legacy alias values when present

### Formula panel

The page now shows:

- selected metric family
- current formula string
- support fields tied to the selected metric
- legacy aliases tied to the selected metric

Current note:

- formula text is implemented from a targeted formula map plus family-level fallbacks

### Source-input panel

The page now shows the focused-row source inputs as structured JSON for:

- WGO row
- NST counts row
- NST rates row
- NST on-ice row
- PP context row
- line-context row

### Rolling-window membership panel

The page now shows derived row membership for:

- `last3`
- `last5`
- `last10`
- `last20`

Each window currently lists:

- member game dates
- selected metric value for each member row

### Availability denominator panel

The page now shows focused-row availability and participation support fields, including:

- season counters
- rolling `lastN` denominator fields
- rolling `lastN` availability fields

### Numerator / denominator panel

The page now shows selected support fields from the focused row for the chosen metric.

This is now the main support-field inspection surface for ratio and weighted-rate validation until copy helpers are added.

### Source precedence / fallback panel

The page now shows focused-row source-context flags for:

- counts source presence
- rates source presence
- on-ice source presence
- resolved TOI source
- fallback TOI seed

### TOI trust panel

The page now shows:

- counts TOI
- on-ice TOI
- rates TOI/GP
- fallback TOI seconds
- TOI trust tier
- WGO normalization state

### PP context panel

The page now shows:

- builder-row presence
- PP-unit trust flag
- builder PPTOI
- builder PP share
- WGO PP TOI and WGO PP share fallback fields

### Line context panel

The page now shows:

- line-source presence
- trusted assignment flag
- line slot
- line position group
- stored line fields

### Diagnostics panel

The page now shows:

- coverage warning count
- unknown game ID count
- suspicious issue count
- JSON view of:
  - coverage
  - derived-window completeness
  - suspicious-output summary

### Stored-vs-reconstructed diff panel

The page now shows:

- stored row key
- recomputed row key
- stored metric value
- recomputed metric value
- focused metric diff

## Additional Page Outcome

The old sustainability sandbox remains available as a secondary card, but the primary result surface is now the rolling validation console.

## Known Limits Left For Later `4.x` Tasks

- formula rendering is sufficient for inspection but not yet copy-helper-ready
- source-input and diagnostics panels currently use compact JSON for dense evidence blocks
- rolling-window membership is derived in-page from row history rather than a dedicated backend window payload
- no copy helpers yet
- no dedicated page test coverage yet
