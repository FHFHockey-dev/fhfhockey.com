# FORGE Dashboard Trend Movement Reconciliation

## Status

- `red`

## Scope Reconciled

- [HotColdCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/HotColdCard.tsx)
- [skater-power.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/trends/skater-power.ts)
- [normalizers.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/normalizers.ts)
- [playerInsightContext.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerInsightContext.ts)
- [playerOwnership.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerOwnership.ts)

## Reconciliation Question

This audit asks whether Hot / Cold and Trending Up / Down are faithfully representing:

- raw skater-power category rankings
- normalized trend-band labels
- short-term explanation language
- ownership-band filtering

without implying stronger source authority than the payload actually provides.

## What Reconciles Correctly

### 1. The short-term product semantics are honest

[HotColdCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/HotColdCard.tsx) clearly frames the surface as:

- `Short-term only`
- not a sustainability replacement

[playerInsightContext.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerInsightContext.ts) supports that cleanly through:

- `describePlayerSignalFrame("shortTerm")`
- `describeTrendBand("hotCold", ...)`
- `describeTrendBand("movement", ...)`

The UI language is aligned with the intended meaning.

### 2. The tab split is coherent

The card derives two companion views from the same normalized payload:

- `hotCold`
  - sorted by `currentScore`
- `movement`
  - sorted by `movementScore`

This matches the intended product distinction:

- current form
- movement speed

### 3. The test coverage already protects the intended semantic framing

[dashboard.test.tsx](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/forge/dashboard.test.tsx) already verifies:

- `Hot / Cold`
- `Trending Up / Down`
- `Short-term only`
- explanatory copy that says movement does not replace sustainability
- trend-band labels like:
  - `Hot stretch`
  - `Cold stretch`
  - `Acceleration band`
  - `Slide band`

So the rendered language is not drifting silently from the intended UX.

## Where Reconciliation Breaks

### 1. The card renders a dashboard-owned composite, not a first-class API output

[skater-power.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/trends/skater-power.ts) returns category-level rankings and series.

[HotColdCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/HotColdCard.tsx) then constructs:

- `currentScore`
  - average of category percentiles
- `movementScore`
  - average of category deltas
- `currentDriver`
  - category with the largest distance from `50`
- `movementDriver`
  - category with the largest absolute movement delta

That composite logic is reasonable, but it is not a source-native contract exposed by the API.

So the UI is not rendering a simple authoritative field like:

- `hot_score`
- `cold_score`
- `movement_score`

It is rendering a local dashboard interpretation of multiple category rankings.

### 2. The displayed numeric scores are easy to over-read

The card displays:

- `currentScore` for Hot / Cold
- `movementScore` for Trending Up / Down

Those are dashboard-constructed aggregate values, not directly returned source metrics.

The result is directionally coherent, but the UI reads more source-authoritative than it really is.

### 3. Band labels are logically consistent but only loosely tied to the composite math

[describeTrendBand(...)](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerInsightContext.ts) uses:

- `>= 75` / `<= 25` for hot-cold percentile bands
- `>= 2` / `<= -2` for movement bands

That is logically consistent with the composite values the card builds.

But because the composite values are local averages across categories, the band labels are one more interpretive layer removed from the source rows.

### 4. Ownership-band filtering is still capable of silently suppressing valid rows

[HotColdCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/HotColdCard.tsx) filters on:

- `ownership != null && ownership >= ownershipMin && ownership <= ownershipMax`

and only disables the filter if the ownership request throws.

So the same failure mode seen in the sustainability surface remains here:

- ownership fetch succeeds structurally
- returned ownership is null because of the Yahoo season mismatch
- rows are silently filtered out
- the card can show:
  - `No player trend movement available for this filter.`

even when valid trend rows exist upstream.

### 5. The generated-date label still misstates source recency

The panel meta:

- `Skater 5G • {generatedDate}`

looks like a source-date label.

But as established in the freshness audit, `generatedDate` is derived from request-time `generatedAt`, not proven trend-source freshness.

That means the final rendered card can still present the wrong recency story while being internally consistent with its payload.

## Live Verdict By Layer

### Source API shape

- `yellow`
- category rankings and metadata are coherent, but freshness is unresolved

### Normalizer

- `green`
- preserves rankings, series, and metadata without obvious distortion

### Dashboard composite logic

- `yellow`
- internally coherent, but it is an interpretive aggregation rather than a first-class API contract

### Explanation language

- `green`
- clearly communicates short-term semantics

### Ownership-band filtering

- `red`
- null ownership can still suppress valid rows silently

### Final rendered card

- `red`
- because the UI is honest about being short-term, but not honest enough about freshness and filtered-candidate loss

## Status Rationale

Why this is not `green`:

- the visible rankings are dashboard composites, not source-native output fields
- the generated-date label still implies fresher source truth than the route proves
- ownership filtering remains unreliable in live data

Why this is not `yellow`:

- valid trend rows can still disappear without a correct explanation
- the final displayed recency cue is not trustworthy
- the rendered board still overstates the precision of its aggregate scores

## Required Follow-Ups

- decide whether Hot / Cold and Trending Up / Down should keep using dashboard-computed composite scores or move to explicit API-returned aggregate fields
- if the composite stays local, document that contract more explicitly in the API and audit artifacts
- fix the shared Yahoo season mapping in [playerOwnership.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerOwnership.ts)
- change the empty-state handling so it distinguishes:
  - no trend rows
  - no rows surviving ownership filters
  - ownership overlay unavailable
- stop presenting request-time `generatedDate` as if it were proven trend-source recency
