# FORGE Dashboard Component Health Scoring Model

## Purpose

This artifact defines the authoritative scoring model for the FORGE dashboard component-health audit.

It standardizes:

- what `green`, `yellow`, and `red` mean
- what evidence is required before assigning a status
- how partial failures should downgrade a component
- what acceptance checks must be satisfied before a component can be considered healthy

This model exists to prevent later audit passes from using inconsistent judgment.

## Status Definitions

### Green

Use `green` only when the component is operationally trustworthy.

A component may be marked `green` only if:

1. the source chain is known
2. the refresh or cron ownership is known and acceptable
3. the freshness state is known
4. the UI meaning matches the underlying data
5. degraded behavior is either not needed or is implemented safely
6. the component has a practical observability or verification path
7. the evidence is current enough to support the verdict

### Yellow

Use `yellow` when the component is usable but not yet fully trustworthy.

Common `yellow` cases:

1. the component usually works but one part of the refresh chain is weak or undocumented
2. the component is accurate in normal cases but has unverified fallback behavior
3. the component has mixed-cadence sources that can drift
4. the component depends on manual checking or weak observability
5. the UI is likely correct, but source-to-UI reconciliation is incomplete
6. degraded behavior is present but not well-proven

### Red

Use `red` when the component should not be considered reliable.

Common `red` cases:

1. freshness ownership is unknown or clearly broken
2. the serving API is mismatched to what the UI claims to show
3. source-to-UI reconciliation fails or cannot be performed
4. degraded or fallback behavior can silently mislead the user
5. the component depends on stale or broken upstream sources with no safe warning treatment
6. there is no meaningful evidence that the component is currently accurate

## Evidence Requirements

Every final component verdict must include evidence across the same categories.

Required evidence categories:

1. `rendering surface`
   - the exact component or route being judged
2. `serving contract`
   - the API route or routes feeding the surface
3. `source contract`
   - the underlying tables or authoritative datasets
4. `freshness ownership`
   - the cron jobs or refresh jobs that keep the sources current
5. `runtime expectation`
   - known runtime budget or operational expectation for the refresh chain
6. `degraded behavior`
   - what happens when the API or upstream data is stale, partial, or missing
7. `observability`
   - tests, scripts, route checks, invariants, or direct inspection paths
8. `reconciliation`
   - how the UI can be compared against raw API output and authoritative source data
9. `status rationale`
   - short explanation for the assigned color

If one of these categories is missing, the component cannot be `green`.

## Downgrade Rules

These rules keep the status model strict and consistent.

### Automatic downgrade to Yellow

Downgrade to at least `yellow` if any of the following is true:

1. cron ownership exists, but the exact dependency chain is only partially documented
2. freshness appears acceptable, but no explicit verification path exists
3. source-to-UI reconciliation exists only at the API layer and not all the way to authoritative source data
4. the component depends on mixed-cadence sources and the drift policy is not explicitly validated
5. degraded-state behavior exists but is not clearly safe

### Automatic downgrade to Red

Downgrade to `red` if any of the following is true:

1. the component’s freshness depends on undocumented manual reruns
2. a source feed is known to be stale or broken and the UI can still look current
3. the component silently coerces missing data into misleading values
4. API output and rendered meaning are materially different
5. a required reconciliation path does not exist
6. the component lacks any reliable way to prove that it is displaying the intended data

## Generic Acceptance Checks

Every component must pass these generic checks before it can be `green`.

1. `component intent check`
   - The audit can state, in one sentence, what the component is supposed to show.
2. `route ownership check`
   - The audit can name the page or route responsible for the component.
3. `API ownership check`
   - The audit can name the serving API route or routes.
4. `source-table check`
   - The audit can name the primary authoritative source tables or datasets.
5. `cron-chain check`
   - The audit can name the scheduled jobs that keep those sources current.
6. `freshness-state check`
   - The audit can determine whether the component is current, fallback, degraded, or blocked.
7. `runtime-budget check`
   - The audit can state whether the refresh path has an acceptable runtime expectation or needs follow-up.
8. `degraded-behavior check`
   - The audit can describe what the UI does when the data is stale, partial, or unavailable.
9. `observability check`
   - The audit can identify at least one reliable verification path.
10. `reconciliation check`
    - The audit can compare the rendered output to API output and, where needed, to source data.
11. `status justification check`
    - The final color can be defended using evidence rather than intuition.

## Component-Family Acceptance Checks

These family-specific checks supplement the generic checks above.

### Slate Context

Applicable surfaces:

- `SlateStripCard`
- FORGE slate preview

Additional acceptance checks:

1. matchup date and resolved date are correct
2. scheduled games shown in the UI match the Start Chart response
3. goalie probabilities and team ratings are not mislabeled or swapped
4. fallback-to-previous or fallback-to-latest behavior is visible and not silent
5. slate freshness can be traced to the start-chart refresh chain

### Player Opportunity

Applicable surfaces:

- `TopAddsRail`
- FORGE Top Adds preview
- FORGE player detail route

Additional acceptance checks:

1. displayed players match the filtered projection and ownership inputs
2. the ownership band is applied correctly
3. the ranking order matches the Top Adds scoring helper
4. week-mode or tonight-mode labeling matches the active logic
5. ownership sparkline and delta values reflect Yahoo ownership inputs accurately

### Team Context

Applicable surfaces:

- `TeamPowerCard`
- FORGE team detail route

Additional acceptance checks:

1. displayed team power values match the team-ratings API output
2. CTPI values and deltas match the CTPI API output
3. matchup edge values match the current slate-derived team-context logic
4. variance or warning states are not flattened or hidden incorrectly
5. mixed-source freshness risk is visible when relevant

### Sustainability

Applicable surfaces:

- `SustainabilityCard`
- FORGE sustainability preview

Additional acceptance checks:

1. displayed players match the sustainability source rows for the selected date and window
2. trust and overheated labels match the normalized component logic
3. ownership filtering does not distort the sustainability explanation
4. snapshot fallback behavior is visible when used
5. sustainability freshness can be traced to the jobs keeping the underlying scores current

### Trend Movement

Applicable surfaces:

- `HotColdCard`

Additional acceptance checks:

1. hot/cold and trending up/down tabs are using the intended skater-power categories
2. displayed rank order matches the normalized skater-power response
3. the UI does not present short-term movement as a sustainability verdict
4. ownership filtering is applied consistently
5. sparkline or movement context shown in the UI matches the series in the normalized payload

### Goalie Risk

Applicable surfaces:

- `GoalieRiskCard`

Additional acceptance checks:

1. displayed goalie rows match the FORGE goalie response for the resolved date
2. recommendation, confidence, and risk labels match the normalized goalie payload
3. starter-confidence drivers are derived from the intended uncertainty fields
4. no-goalie or no-games states are not mistaken for healthy data
5. goalie freshness can be traced to the projection and run-resolution chain

### Route Family

Applicable surfaces:

- `FORGE.tsx`
- `forge/team/[teamId].tsx`
- `forge/player/[playerId].tsx`

Additional acceptance checks:

1. preview routes do not contradict the deeper surfaces they link to
2. drill-in routes preserve the semantics promised by the originating dashboard card
3. route-level fallback or stale messages are visible where needed
4. nav and click routing do not send users into mismatched contexts

## Evidence Record Template

Every component’s final health record should use the same structure.

Suggested record fields:

- `component`
- `routeOwner`
- `apiRoutes`
- `sourceTables`
- `cronChain`
- `runtimeExpectation`
- `freshnessState`
- `degradedState`
- `observability`
- `reconciliationMethod`
- `status`
- `reasons`
- `requiredFollowUps`

## What Counts As Enough Evidence For Green

Minimum standard for `green`:

1. route and API ownership are explicit
2. source tables are explicit
3. cron ownership is explicit
4. freshness state is explicitly checked, not assumed
5. at least one reconciliation path has been executed or proven
6. degraded behavior has been reviewed and is safe
7. no automatic `red` conditions are present

If any one of those is missing, the component should stay `yellow` or `red`.

## What Must Be Deferred To The Remediation Backlog

If the audit uncovers any of the following, the issue must be recorded as a follow-up item rather than buried in the status note:

1. missing cron ownership
2. runtime budget uncertainty
3. silent fallback risk
4. weak or missing reconciliation path
5. missing tests or invariants
6. stale-source ambiguity
7. helper-layer drift risk

## Scoring Philosophy

The scoring model should bias toward trustworthiness, not optimism.

Practical rule:

- `green` means the component is safe to trust
- `yellow` means the component is usable but needs proof or cleanup
- `red` means the component should not be trusted without repair
