# FORGE Dashboard Sustainability Reconciliation

## Status

- `red`

## Scope Reconciled

- [SustainabilityCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SustainabilityCard.tsx)
- [trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/sustainability/trends.ts)
- [normalizers.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/normalizers.ts)
- [playerInsightContext.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerInsightContext.ts)
- [playerOwnership.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerOwnership.ts)

## Reconciliation Question

This audit asks whether the Sustainability card is faithfully turning source sustainability rows into:

- `Sustainable Risers`
- `Unsustainable Heaters`
- trustworthy / overheated explanation language
- ownership-band-filtered discovery rows

without silently distorting the meaning of the underlying metrics.

## Source To UI Mapping

The intended mapping is:

- `/api/v1/sustainability/trends?direction=cold`
  - source rows with lower `luck_pressure`
  - rendered as `Sustainable Risers`
- `/api/v1/sustainability/trends?direction=hot`
  - source rows with higher `luck_pressure`
  - rendered as `Unsustainable Heaters`

That mapping is implemented in [SustainabilityCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SustainabilityCard.tsx):

- `sustainableRows = coldRows.filter(...)`
- `riskRows = hotRows.filter(...)`

This part is reconciled correctly.

## What Reconciles Correctly

### 1. Direction semantics are honest

[trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/sustainability/trends.ts):

- sorts `hot` rows by descending `luck_pressure`
- sorts `cold` rows by ascending `luck_pressure`

[SustainabilityCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SustainabilityCard.tsx) then maps:

- `cold -> Sustainable Risers`
- `hot -> Unsustainable Heaters`

That means the main column split is not inverted or mislabeled.

### 2. The normalizer preserves the critical fields

[normalizeSustainabilityResponse(...)](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/normalizers.ts) preserves:

- `snapshot_date`
- `s_100`
- `luck_pressure`
- `z_shp`
- `z_oishp`
- `z_ipp`
- `z_ppshp`

So the card is not losing the core sustainability values during normalization.

### 3. Stale snapshot rendering is honest

When the route falls back from a requested date to an earlier snapshot, the card surfaces:

- `Showing nearest available snapshot (...)`

That does not fix the freshness failure, but it does mean the card is not pretending the stale snapshot is exact-date current.

## Where Reconciliation Breaks

### 1. Trust / heat badges use thresholds that do not match the live metric scale

[SustainabilityCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SustainabilityCard.tsx) labels badge strength through:

- `confidenceLabel(row.luck_pressure)`

with thresholds:

- `>= 1.25 => High`
- `>= 0.75 => Medium`
- else `Low`

But live route evidence already recorded in the health audit shows example values like:

- hot sample: `luck_pressure = 72.513657`
- cold sample: `luck_pressure = -19.301988`

Those magnitudes are far above the badge thresholds.

So the badge scale is not well calibrated to the actual output domain of `luck_pressure`. In practice this collapses too many rows into:

- `Trust High`
- `Heat High`

which makes the badge less meaningful than it appears.

### 2. Explanation text is deterministic, but it is not fully reconciled to the displayed trust score

[playerInsightContext.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerInsightContext.ts) derives the band text from `luck_pressure` magnitude and direction. That is coherent.

But the card also generates separate short reason text through:

- `getReasonText(...)`

which only looks at the largest absolute driver among:

- `z_shp`
- `z_oishp`
- `z_ipp`
- `z_ppshp`

This means the UI explanation stack is partially split:

- band title/detail from overall `luck_pressure`
- reason sentence from the single largest component
- badge strength from a separate threshold model

Those three layers are not contradictory, but they are not tightly reconciled either. The card reads more precise than it actually is.

### 3. Ownership-band filtering is still not trustworthy

[SustainabilityCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SustainabilityCard.tsx) filters rows with:

- `ownership != null && ownership >= ownershipMin && ownership <= ownershipMax`

But [playerOwnership.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerOwnership.ts) still derives Yahoo season labels that are misaligned with live ownership rows.

In the current live mismatch:

- the ownership request succeeds
- returned ownership is often `null`
- the filter remains active
- valid sustainability rows can be dropped silently

So the rendered `Sustainable Risers` and `Unsustainable Heaters` lists are not a trustworthy representation of the full eligible sustainability candidate pool.

### 4. Empty-state behavior can still misattribute the cause

The card shows:

- `No sustainability signals available for this date.`

when both filtered lists are empty.

But with the current ownership mismatch, “no signals” can actually mean:

- signals exist in the sustainability source
- but they were removed by null ownership values during discovery-band filtering

That is a reconciliation failure between the rendered message and the underlying source reality.

## Live Verdict By Layer

### Source metrics

- `yellow`
- route logic is coherent, but source freshness is already materially stale

### Normalizer

- `green`
- preserves the expected source fields without obvious distortion

### Explanation-language layer

- `yellow`
- coherent, but not tightly calibrated against the live output scale

### Ownership-band filtering

- `red`
- current live season mapping makes the discovery filter unreliable

### Final rendered card

- `red`
- the card is directionally honest, but the displayed trust/heat strength and filtered candidate pool are not reliable enough for a `yellow`

## Status Rationale

Why this is not `green`:

- ownership-band filtering is still misaligned with live Yahoo data
- trust/heat badge thresholds are not calibrated to the live `luck_pressure` scale

Why this is not `yellow`:

- the final rendered board can still suppress valid candidates silently
- the empty-state message can describe the wrong failure mode
- the badge layer implies precision that the current scale does not support

## Required Follow-Ups

- recalibrate `confidenceLabel(...)` against the real `luck_pressure` distribution instead of the current small fixed thresholds
- decide whether badge strength should be based on:
  - normalized percentiles
  - capped/standardized `luck_pressure`
  - or a separate explicit confidence field
- fix the Yahoo season mapping in [playerOwnership.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerOwnership.ts)
- make null-ownership filtering degradable instead of silently suppressing rows
- change the empty-state copy so it distinguishes:
  - no sustainability rows
  - no rows surviving the ownership band
  - ownership filter unavailable
