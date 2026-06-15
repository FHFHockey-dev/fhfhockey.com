# PRD: Date Range Matrix (DRM) Refactor

Generated: 2025-09-12 13:27:53 UTC

## Overview
The DRM visualizes player-to-player time-on-ice relationships for a team over a date range. This refactor unifies data fetching and derivation into a single hook and separates rendering into a presentational component, reducing drift and simplifying future changes.

## Goals
- One data source of truth for DRM (raw shifts or aggregated inputs)
- Stable API (team abbreviation in, presentational props out)
- Easier to validate, test, and optimize
- Preserve current functionality with minimal UI changes

## Scope
- Add unified data hook to power DRM for both sources (raw and aggregated)
- Create a presentational, props-only DRMV (view) component
- Wire `web/pages/drm.tsx` to use the hook and view
- Refactor specialized component to use the unified hook (`DateRangeMatrixForGames`)

## Architecture
- Hook: `useDateRangeMatrixData(teamAbbreviation, startDate, endDate, mode, source, aggregatedData?)`
  - Returns: `{ loading, teamId, teamName, roster, toiData, homeAwayInfo, playerATOI, lines, pairs }`
  - `source: 'raw'` → uses `getTOIDataForGames` from Supabase `shift_charts`
  - `source: 'aggregated'` → maps existing aggregated rows to `PlayerData`
  - Computes `lines` and `pairs` via `calculateLinesAndPairs` consistently in both paths
- View: `DateRangeMatrixView` → thin wrapper around `DateRangeMatrixInternal`
  - Renders grid given props, no fetching/derivation inside
- Page: `web/pages/drm.tsx`
  - Calls `useDateRangeMatrixData` with `source: 'aggregated'`
  - Renders `DateRangeMatrixView` with results
- Specialized: `DateRangeMatrixForGames`
  - Simplified; now calls unified hook with `source: 'raw'`

## Updated Files
- `web/components/DateRangeMatrix/useDateRangeMatrixData.ts` (new)
- `web/components/DateRangeMatrix/DateRangeMatrixView.tsx` (new)
- `web/pages/drm.tsx` (updated to use hook + view)
- `web/components/DateRangeMatrix/DateRangeMatrixForGames.tsx` (refactored to hook)

## API Contracts
- Input (hook):
  - `teamAbbreviation: string` (canonical identifier)
  - `startDate, endDate: YYYY-MM-DD`
  - `mode: 'line-combination' | 'full-roster' | 'total-toi'`
  - `source: 'raw' | 'aggregated'`
  - `aggregatedData?: any[]` (only required for aggregated)
- Output (hook):
  - `loading, teamId, teamName, roster, toiData, homeAwayInfo, playerATOI, lines, pairs`
- View component props mirror hook result values (minus `homeAwayInfo` optional)

## UI/UX & Styling
- Current DRM page uses custom styles (`drm.module.scss`). To align with site-wide design:
  - Typography: apply site typography scale and consistent font weights
  - Spacing: use standard spacing tokens for paddings, grid gaps, margins
  - Colors: inject theme variables (primary/secondary/accent) via CSS vars and reference shared palette in `styles/`
  - Buttons/toggles: replace ad-hoc styles with reusable button/select components used elsewhere
  - Responsiveness: ensure grid and header scale on small screens; add horizontal scroll affordance
  - Accessibility: increase contrast for matrix cells; add aria labels/tooltips; ensure keyboard focus styles are visible
  - Loading/empty states: standardized skeletons/placeholders

Deliverables for UI polish (follow-up tasks):
- Replace local button styles with shared `Button` component
- Replace `Select` usage with shared select wrapper (consistent spacing, focus)
- Normalize header layout to match page headers (logo size, title casing)
- Audit CSS variables used in DRM and map to global variables in `web/styles/vars.scss`

## Newly Discovered Issues (2025-09-12)

- DatePicker clipping within controls panel:
  - The `react-datepicker` popper gets clipped due to `overflow: hidden` on the panel container. Fix: set `overflow: visible` on the datepicker group and apply a high z-index to `.react-datepicker-popper`, or use `withPortal` to render outside the flow. We’ll do both for robustness.

- Preference for dual team selectors:
  - Keep both the horizontal team navbar (TeamSelect) and the physical dropdown (TeamDropdown) on the DRM page for different workflows. Ensure both are present and accessible.

- Maximum update depth exceeded in DRMPage:
  - Cause: Passing a non-memoized `aggregatedData` (via `Object.values(...)`) to `useDateRangeMatrixData` causes the hook’s effect dependency to change on every render, creating a render loop.
  - Fix: Memoize the `aggregatedData` that’s passed to the hook with `useMemo(() => Object.values(...), [seasonType, regularSeasonData, playoffData])`. Also ensure the hook’s effect list is stable and only recomputes when the actual data changes.

## Action Items (Hotfixes)

- Restore `TeamDropdown` alongside `TeamSelect` on DRM page (both paths available).
- Update datepicker container styles to `overflow: visible` and add `.react-datepicker-popper { z-index: 10000 }`.
- Pass `withPortal` to `DatePicker` to avoid clipping within overflow contexts.
- Memoize `aggregatedData` object array before passing into `useDateRangeMatrixData` to stop infinite re-renders.

## Performance Considerations
- Memoize heavy transforms (`calculateLinesAndPairs`, roster mapping)
- Avoid re-renders by stabilizing prop identities and using `useMemo`
- Consider virtualization for large rosters (if row/col > ~30)
- Defer non-critical logs and dev-only computations

## Risks & Mitigations
- Data parity between sources: use a temporary QA toggle (query param) to compare raw vs aggregated outputs
- Dynamic imports or edge cases: keep hook boundary minimal and typed; add guards for missing data

## Rollout Plan
1) Ship unified hook + view (done)
2) Validate parity with existing outputs on key teams and date ranges
3) Optional: enable `?drm-source=raw` QA toggle for internal verification
4) Remove specialized component if unused (or keep as thin wrapper)
5) UI polish tasks to align with site design

## Appendix: Re-run/Dev Notes
- Types: `cd web && npx tsc -p tsconfig.json --noEmit`
- Dead code scan: see `tasks/prd-dead-code-report.md`
- Inventory: see `tasks/prd-file-inventory.md`
