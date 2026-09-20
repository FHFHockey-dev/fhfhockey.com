# 01 — Page header, search and selection

Status: planned; source inspection completed, implementation pending. Priority/dependencies: P2; depends on 00 context.

## Scope and evidence

Name search debounces 300 ms, queries players.fullName with ilike and limits to 10. Selection seeds player-detail cache and writes playerId to the URL. Header includes WiGO identity, selected-player thumbnail/name/team/position and Clear.

- [NameSearchBar.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/NameSearchBar.tsx)
- [WigoDashboardSections.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/WigoDashboardSections.tsx)
- [useWigoPlayerDashboard.ts](/Users/tim/Code/fhfhockey.com/web/hooks/useWigoPlayerDashboard.ts)

## Distinct implementation plan

1. Trace search→player record→headshot lookup→cache→URL. Check duplicate names, diacritics, traded/inactive players, unsupported goalie selection and invalid URL IDs. Numeric IDs should be finite valid player IDs, not merely parseable numbers.

2. Ensure keyboard navigation, Enter/Escape, focus and Clear produce consistent selection in all sections. Surface player-detail errors currently returned by the hook but not consumed by the page.

3. Measure search request volume before changing debounce or fields; share results between responsive instances and avoid fetching the selected player name again. Keep search separate from expensive statistics loading.

## Verification and acceptance

Extend NameSearchBar.test.tsx and useWigoPlayerDashboard.test.tsx for selection, clear, deep links, errors and keyboard behavior. Acceptance: the visible name and all data always belong to the same selected ID; all header controls remain reachable.

Before changing code, read [the audit scope and shared completion standard](README.md). Preserve other components and existing user changes. Live production validation and performance measurements are not implied by this source review.
