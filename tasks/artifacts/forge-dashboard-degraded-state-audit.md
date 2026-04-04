# FORGE Dashboard Degraded-State Audit

## Status

- `red`

## Goal

Confirm whether stale, fallback, degraded, and blocked states across the audited FORGE components are:

- explicit
- informative
- semantically safe

## Component Findings

### Slate

- current state: `red`
- good:
  - date fallback messaging exists
- unsafe:
  - stale or missing goalie context can render as an apparently current slate
  - users see missing goalie probabilities, not the real freshness problem

### Top Adds

- current state: `red`
- good:
  - projection fallback date can be surfaced
  - request failures do not necessarily blank the full dashboard
- unsafe:
  - null or mismatched ownership can silently suppress otherwise valid candidates
  - ownership-truncation and merge failures are not expressed as first-class degraded states

### Team Trend Context

- current state: `red`
- good:
  - some request failures surface local warnings
  - flat `trend10` can warn
- unsafe:
  - stale CTPI can still render as if current
  - current-looking ratings plus stale CTPI create a misleading mixed snapshot

### Sustainability

- current state: `red`
- good:
  - stale snapshot fallback is surfaced
- unsafe:
  - ownership-band filtering can silently remove valid rows when ownership is null
  - the empty state can describe “no signals” when the real failure is ownership suppression

### Trend Movement

- current state: `red`
- good:
  - short-term framing is explicit
  - goalie-only mode degrades cleanly
- unsafe:
  - freshness warnings depend on request-time metadata, not source recency
  - valid rows can still disappear behind null ownership without a correct explanation

### Goalie

- current state: `red`
- good:
  - fallback date is surfaced
  - the route carries richer diagnostics than most other surfaces
- unsafe:
  - partial-slate fallback can still look broadly usable
  - the UI does not clearly quantify the requested-vs-resolved coverage loss

### Landing Route

- current state: `red`
- good:
  - preview modules can fail independently
  - warnings and notices exist per panel
- unsafe:
  - no route-level mixed-date summary
  - a fallback-driven preview can still sit beside current previews under one “healthy enough” impression

### Team / Player Drill-Ins

- current state: `red`
- team route unsafe:
  - stale CTPI masked by current ratings date
- player route unsafe:
  - reduced score contract not disclosed clearly enough
  - context-dropping drill-ins weaken degraded-state honesty

## Repeated Failure Pattern

The same degraded-state pattern appears across the route family:

1. hard failure is usually handled
2. obvious empty response is usually handled
3. stale-but-present data is often **not** handled safely
4. mixed-cadence pages are almost never summarized at the page level

That means the product is generally better at saying “this request failed” than it is at saying “this page rendered, but one of the key data legs is stale enough that you should not trust it normally.”

## Overall Assessment

Degraded-state handling is `red`.

The codebase has visible warning patterns, but too many of them are still:

- source-specific instead of user-truthful
- panel-local instead of page-level
- request-failure oriented instead of mixed-cadence oriented

## Required Follow-Ups

- add first-class stale-but-present handling for CTPI, skater-power, and goalie coverage loss
- make ownership-suppression failure modes explicit instead of letting them look like genuine empty states
- add route-level mixed-date summaries where multiple sub-feeds can resolve to different effective dates
- distinguish partial coverage from true success in the goalie and slate families
