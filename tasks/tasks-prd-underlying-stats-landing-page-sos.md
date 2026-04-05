## Relevant Files

- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-landing-page-data-path-audit.md` - Task `1.1` audit artifact tracing the landing-page SSR, API, service, and render-time field origins.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-trend10-verification.md` - Task `1.2` verification artifact comparing the documented `trend10` definition to live stored and served values.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-trend10-root-cause.md` - Task `1.3` root-cause artifact showing that all-zero trends come from upstream row-history logic plus carry-forward flattening.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-trend-fallback-implementation.md` - Task `1.4` implementation artifact documenting the landing-page-only trend repair path, its formula, and verification results.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-snapshot-date-loading.md` - Task `1.5` artifact documenting the distinct snapshot-date pagination strategy and the SSR verification result.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-snapshot-fallback-resolution.md` - Task `1.6` artifact documenting the shared fallback resolver and the verified SSR/API resolved-date behavior.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-sos-source-inventory.md` - Task `2.1` artifact inventorying the actual standings, schedule, predictive, and legacy SoS data sources available for the landing page.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-sos-standings-component.md` - Task `2.2` artifact defining the standings-based half of `SoS`, including the direct and indirect opponent-quality inputs and the normalization method.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-sos-predictive-component.md` - Task `2.3` artifact defining the predictive/context half of `SoS` from current snapshot opponent Power Scores and documenting why additional component fields were not promoted into the core formula.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-sos-optional-context-decision.md` - Task `2.4` artifact deciding which optional schedule/context adjustments are excluded from the shipped core `SoS` formula and why.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-sos-final-formula.md` - Task `2.5` artifact documenting the full shipped `SoS` formula, assumptions, exclusions, and the line between verified sources and implementation choices.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-sos-helper-implementation.md` - Task `3.1` artifact documenting the landing-page-only SoS helper, its exact inputs, normalization behavior, and the targeted synthetic and live-snapshot verification results.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-sos-data-path-extension.md` - Task `3.2` artifact documenting the landing-page row-type extension, the merged `trend10 + sos` fetch path, and the targeted unit and live data-path verification.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-sos-table-column.md` - Task `3.3` artifact documenting the landing-page table-column insertion, the current `SoS` render convention, and the scope-safe verification results.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-sos-display-conventions.md` - Task `3.4` artifact documenting the final `SoS` scan treatment, why the table remains sorted by `Power`, and the targeted verification results.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-sos-copy-update.md` - Task `3.5` artifact documenting the landing-page legend, header, summary, and table-copy updates for the shipped `SoS` formula and repaired trend wording.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-layout-audit-4-1.md` - Task `4.1` audit artifact documenting the rendered current-state layout issues against the table-heavy/data-page rules in `fhfh-styles.md`.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-top-layout-tightening-4-2.md` - Task `4.2` artifact documenting the SCSS-only density and visual-order changes that move the table surface earlier without changing page markup.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-copy-tightening-4-3.md` - Task `4.3` artifact documenting the header, legend, and support-copy compression for a more operational table-first page tone.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-sos-fit-4-4.md` - Task `4.4` artifact documenting the table-width and cell-density adjustments that keep the added `SoS` column usable across desktop and mobile/tablet layouts.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-token-cleanup-4-5.md` - Task `4.5` artifact documenting the shared-token cleanup for compact table padding and badge spacing in the landing-page SCSS.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-targeted-tests-5-1.md` - Task `5.1` artifact documenting the focused date-loading, trend, `SoS`, and landing-page render/update test coverage.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-data-checks-5-2.md` - Task `5.2` artifact documenting the live snapshot checks for summary-card selection, table ordering, `Power`, `SoS`, `Trend`, and badge-threshold correctness.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-render-check-5-3.md` - Task `5.3` artifact documenting the live mobile render verification, the served desktop route check, and the explicit desktop screenshot limitation.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-playerstats-scope-check-5-4.md` - Task `5.4` artifact documenting the landing-page-only file diff, the isolation check against `/underlying-stats/playerStats`, and the targeted `playerStats` regression test pass.
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/underlying-stats-final-verification-notes-5-5.md` - Task `5.5` artifact documenting the final verified behaviors, shipped assumptions, intentionally excluded `SoS` inputs, residual risks, and the final full-suite test pass.
- `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx` - Main landing-page route, SSR date loading, table rendering, summary cards, and metric copy.
- `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/indexUS.module.scss` - Landing-page-specific layout and table styling that must stay aligned to the FHFH style system.
- `/Users/tim/Code/fhfhockey.com/web/pages/statsPlaceholder.tsx` - Legacy placeholder page showing the older standings-only SoS approach and its OWP-style assumptions.
- `/Users/tim/Code/fhfhockey.com/web/pages/api/team-ratings.ts` - API route that serves landing-page ratings payloads for date changes.
- `/Users/tim/Code/fhfhockey.com/web/pages/api/underlying-stats/team-ratings.ts` - Landing-page-only API route that serves repaired team ratings without changing shared consumers.
- `/Users/tim/Code/fhfhockey.com/web/lib/teamRatingsService.ts` - Server-side ratings fetcher and mapping layer for `team_power_ratings_daily`.
- `/Users/tim/Code/fhfhockey.com/web/lib/teamRatingsService.test.ts` - Existing service tests that should be extended for distinct date handling, trend integrity, and any added SoS payload fields.
- `/Users/tim/Code/fhfhockey.com/web/lib/dashboard/teamContext.ts` - Shared power-score computation used to rank teams on the landing page.
- `/Users/tim/Code/fhfhockey.com/web/lib/dashboard/teamContext.test.ts` - Existing shared metric tests that may need coverage if shared ranking logic or helpers expand.
- `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/availableSnapshotDates.ts` - Landing-page helper that pages through raw ratings rows until it collects the requested number of distinct snapshot dates.
- `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/availableSnapshotDates.test.ts` - Unit tests for distinct snapshot-date pagination and source exhaustion behavior.
- `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamLandingRatings.ts` - Landing-page-only helper that overlays repaired `trend10` values derived from actual game-history snapshots.
- `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamLandingRatings.test.ts` - Unit tests for landing-page trend reconstruction from actual played-game history.
- `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamScheduleStrength.ts` - Suggested new helper module for landing-page-only SoS computation so schedule logic stays isolated from unrelated pages.
- `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamScheduleStrength.test.ts` - Unit tests for the SoS formula, weighting, and edge-case behavior.
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchPowerRankings.js` - Legacy power-rankings pipeline containing an older SoS helper that relies on `power_rankings_store`.
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchSoSgameLog.js` - Legacy SoS ingestion path that populates `sos_standings` from NHL standings and club schedules.
- `/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-team-power-ratings.ts` - Upstream ratings updater that appears to drive the current `trend10` behavior and may require remediation or documentation updates.
- `/Users/tim/Code/fhfhockey.com/web/rules/power-ratings-tables.md` - Source-of-truth SQL documentation for the intended ratings and trend formulas.
- `/Users/tim/Code/fhfhockey.com/fhfh-styles.md` - Canonical styling guidance for the page archetype and density targets.
- `/Users/tim/Code/fhfhockey.com/web/styles/vars.scss` - Shared tokens for spacing, color, typography, and borders.
- `/Users/tim/Code/fhfhockey.com/web/styles/_panel.scss` - Shared panel anatomy used to keep the page within the current design system.

### Notes

- Unit tests should typically be placed alongside the code files they are testing.
- Use the repo’s existing Vitest-based targeted test flow rather than broad build steps when narrower verification is sufficient.
- `/underlying-stats/playerStats` is intentionally out of scope for implementation. Read-only inspection is allowed only if shared logic must be referenced.

## Tasks

- [x] 1.0 Audit and correct the landing-page data pipeline for trend accuracy and snapshot-date availability
  - [x] 1.1 Trace the full landing-page data path from `web/pages/underlying-stats/index.tsx` through `/api/team-ratings` and `web/lib/teamRatingsService.ts` to confirm where each displayed field originates.
  - [x] 1.2 Verify the intended `trend10` definition against `web/rules/power-ratings-tables.md` and compare it to the current stored values in `team_power_ratings_daily`.
  - [x] 1.3 Determine whether the current all-zero `trend10` values are caused by upstream data generation, stale carry-forward behavior, read-time mapping, or a combination of those factors.
  - [x] 1.4 Fix the trend path so the landing page receives a valid comparative trend value, or introduce a safe landing-page fallback computation if upstream correction is not sufficient on its own.
  - [x] 1.5 Replace the current raw-row-limited date loading approach with a distinct snapshot-date strategy so the selector exposes the actual available dates.
  - [x] 1.6 Preserve the existing “latest valid snapshot” fallback behavior for SSR and client-side date changes after the date-loading fix.
- [x] 2.0 Design the landing-page `SoS` model using a 50/50 split between standings-based strength and predictive/context strength
  - [x] 2.1 Inventory the schedule, standings, and team-strength inputs that are verifiably available from `games`, `team_power_ratings_daily`, `nhl_standings_details`, and any trustworthy existing SoS sources.
  - [x] 2.2 Define the standings-based 50% of `SoS`, including the exact opponent-quality inputs to use and how they are normalized.
  - [x] 2.3 Define the predictive/context 50% of `SoS`, prioritizing existing power-score and play-driving inputs that match the landing page’s team-rating model.
  - [x] 2.4 Decide whether optional context such as home/away, goal differential, or other opponent-strength adjustments is supported well enough to include without speculative placeholders.
  - [x] 2.5 Document the final formula in plain language, including what was directly verified from source data versus what is an implementation choice based on available inputs.

- [ ] NEW 7.0 Refresh `nhl_standings_details` ingestion so record/split fields like goal differential and home/road standings can be reconsidered later without snapshot staleness.
- [x] 3.0 Implement the `SoS` data path and add the `SoS` column to the `/underlying-stats` landing-page table
  - [x] 3.1 Add or extend a dedicated helper that computes landing-page `SoS` from the selected snapshot date and the verified source inputs.
  - [x] 3.2 Extend the landing-page server/data-fetching path so each team row includes the computed `SoS` value needed by the UI.
  - [x] 3.3 Add the `SoS` table column and rendering logic to `web/pages/underlying-stats/index.tsx` without altering `/underlying-stats/playerStats`.
  - [x] 3.4 Decide on the table formatting, sorting behavior, and display conventions for `SoS` so it scans cleanly next to the existing metrics.
  - [x] 3.5 Update the metric legend or explanatory copy so the page accurately describes the new `SoS` metric and any corrected trend behavior.
- [x] 4.0 Tighten the `/underlying-stats` landing-page layout and copy so it aligns with the FHFH table-heavy data-page style system
  - [x] 4.1 Review the rendered landing page against `fhfh-styles.md` and identify the specific header, spacing, and module-density changes needed to make the page more table-first.
  - [x] 4.2 Tighten the top-of-page layout in `web/pages/underlying-stats/indexUS.module.scss` so the summary and support modules do not push the table too far below the fold.
  - [x] 4.3 Adjust the header and legend copy in `web/pages/underlying-stats/index.tsx` so the page stays accurate, concise, and operational rather than editorial.
  - [x] 4.4 Ensure the added `SoS` column still fits within the table layout on desktop and remains usable in the current mobile/tablet responsive behavior.
  - [x] 4.5 Reuse shared tokens and panel patterns from `web/styles/vars.scss` and `web/styles/_panel.scss` instead of introducing new local one-off styles.
- [x] 5.0 Verify rendered output, data correctness, and scope safety for the landing-page-only change set
  - [x] 5.1 Add or update targeted unit tests for date loading, trend handling, and `SoS` computation.
  - [x] 5.2 Run targeted data checks against the underlying sources to confirm the displayed summary cards, table values, badges, and derived metrics match the intended formulas.
  - [x] 5.3 Perform a rendered verification pass on the live local `/underlying-stats` route for desktop and mobile layouts after the changes.
  - [x] 5.4 Confirm that no implementation changes altered `/underlying-stats/playerStats` behavior or shared logic beyond what was strictly required for the landing page.
  - [x] 5.5 Record final verification notes, assumptions, and any residual risks around optional `SoS` inputs that were intentionally excluded.

- [ ] NEW 6.0 Refresh or backfill affected `team_power_ratings_daily` snapshots after the trend logic is corrected so the landing page is not reading stale flattened history.
