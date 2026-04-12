# PRD: Underlying Stats Landing Page Audit, Accuracy Remediation, and Strength of Schedule

## 1. Introduction / Overview

The `/underlying-stats` route is currently a team power rankings landing page, not a generic underlying-stats hub. It renders a table-first analytics surface with summary cards, supporting context modules, and a dominant rankings table.

This PRD covers a focused remediation and enhancement pass for that landing page only. The work has three goals:

1. restore data accuracy on the existing landing page
2. align the page layout and density more closely to the current FHFH data-page style system
3. add a new `Strength of Schedule` (`SoS`) metric to the rankings table

This PRD is both a product/UX request and an engineering remediation request.

Confirmed current issues:

- the page displays `trend10`, but the current stored snapshot data is zeroed for all teams
- the date selector is sourced from raw rows rather than distinct snapshot dates, which can truncate the list of available dates
- the upper page layout is looser than the intended table-first data-page archetype in `fhfh-styles.md`
- the landing page has no `SoS` metric yet

Important scope boundary:

- This PRD applies only to `/underlying-stats`
- `/underlying-stats/playerStats` is out of scope, except for read-only inspection if shared logic must be referenced

## 2. Goals

1. Restore accurate trend and snapshot-date behavior on `/underlying-stats`.
2. Add a clearly documented `SoS` metric to the landing-page table.
3. Ensure the `SoS` model uses an even split between:
   - a standings/record-based schedule-strength component
   - a composite predictive/context component derived from data already available in the repo or database
4. Keep the landing page visually consistent with `fhfh-styles.md`, `web/styles/vars.scss`, and `web/styles/_panel.scss`.
5. Preserve the page as a table-first analytics surface without expanding scope into `/underlying-stats/playerStats`.

## 3. User Stories

- As a fantasy or analytics user, I want the team rankings table to show correct trend values so I can trust movement signals.
- As a user comparing teams, I want the snapshot date selector to expose the actual available snapshots so I can review historical rankings.
- As a user scanning the rankings table, I want to see a defensible `SoS` metric so I can evaluate whether a team’s rating has been built against easier or harder opponents.
- As a user on mobile, I want the page to remain readable and table-first so the summary modules do not bury the primary data surface.
- As a developer maintaining the page, I want the landing-page data pipeline and formulas to be documented clearly so future changes do not silently drift from the intended model.

## 4. Functional Requirements

1. The system must limit all implementation work in this effort to the `/underlying-stats` landing page.
2. The system must not modify `/underlying-stats/playerStats` behavior, UI, routing, or data requirements as part of this effort.
3. The landing page must continue to render from:
   - `web/pages/underlying-stats/index.tsx`
   - `web/pages/underlying-stats/indexUS.module.scss`
   - the existing shared style system and supporting server/data logic
4. The system must audit the complete landing-page data path, including:
   - server-side page loading
   - client-side reload behavior for selected dates
   - `/api/team-ratings`
   - `web/lib/teamRatingsService.ts`
   - any upstream updater or SQL spec that determines the displayed fields
5. The system must restore accurate `trend10` values for the landing page.
6. The system must ensure `trend10` reflects the intended definition used by the page and supporting SQL spec: movement versus a recent baseline, not a hard-coded or silently zeroed fallback.
7. The landing page must not present `trend10` as meaningful if the underlying pipeline cannot support a valid value.
8. The system must fix snapshot-date loading so the page exposes distinct available snapshot dates rather than a truncated list caused by raw row limits.
9. The page must continue to default to the most recent valid snapshot date when no date query parameter is provided.
10. The page must continue to fall back safely if a requested date has no ratings payload.
11. The system must add a new table column for `Strength of Schedule` with the label `SoS`.
12. The `SoS` metric must be computed from two equally weighted components:
    - a standings/record-based component worth 50%
    - a predictive/context component worth 50%
13. The standings/record-based `SoS` component must use only data that is available in this repo or database at runtime.
14. The standings/record-based component must favor opponent-quality evidence such as:
    - opponent win percentage or points percentage
    - opponent goal differential when available
    - opponent-specific opponent-quality context if a trustworthy source already exists
15. The predictive/context `SoS` component must use only data that is available in this repo or database at runtime.
16. The predictive/context component should prefer existing team-strength or play-driving signals already used elsewhere in the landing-page ecosystem, such as:
    - team power score or its components
    - xGF/xGA style measures
    - pace or other available team-strength context
    - home/away context if available for the schedule path used
17. Optional contextual inputs such as rest disadvantage, home-rink differences, or expected goaltending quality may be included only if they can be supported from reliable in-repo or database sources without introducing speculative placeholders.
18. The system must document the final `SoS` formula in code comments or adjacent documentation in plain language.
19. The system must be explicit about which parts of the `SoS` formula are:
    - verified directly from available source data
    - inferred design choices based on the available data
20. The landing-page legend, help text, or supporting copy must be updated if the displayed formulas or metric descriptions are no longer accurate.
21. The page layout must remain readable after adding the `SoS` column.
22. The page styling must move closer to the FHFH data-page archetype by tightening the top section and preserving the table as the dominant surface.
23. The page must preserve the existing dark analytics styling language and shared panel/token system.
24. The system must not introduce a one-off local visual system that conflicts with `fhfh-styles.md`.
25. The system must verify the displayed landing-page values against the underlying source data with targeted checks, scripts, tests, or direct query validation.
26. The implementation must include targeted verification for:
    - accurate trend output
    - accurate snapshot-date availability
    - stable `SoS` computation
    - correct rendering of the added `SoS` column
27. The implementation must avoid broad or risky validation steps that could interfere with an active dev workflow when narrower verification is sufficient.

## 5. Non-Goals (Out of Scope)

- Redesigning `/underlying-stats/playerStats`
- Adding new features to `/underlying-stats/playerStats`
- Rebuilding the entire team power ratings system from scratch
- Introducing a brand-new site-wide table system outside the existing FHFH style framework
- Building a separate historical `SoS` dashboard, chart, or drill-down page
- Adding speculative `SoS` inputs that are not reliably available from current repo/database sources
- Expanding this effort into unrelated dashboard or trends pages unless shared logic must be fixed for the landing page to be correct

## 6. Design Considerations

- The page should be treated as a table-heavy data page under `fhfh-styles.md`, not as a hero-style landing page.
- The table must remain the dominant visual surface.
- The header and supporting modules should become denser and more operational.
- Mobile should preserve the primary table-first intent as much as possible.
- Existing shared style sources should be reused:
  - `web/styles/vars.scss`
  - `web/styles/_panel.scss`
  - `fhfh-styles.md`
- Primary landing-page files:
  - `web/pages/underlying-stats/index.tsx`
  - `web/pages/underlying-stats/indexUS.module.scss`

## 7. Technical Considerations

- Current landing-page data path:
  - `web/pages/underlying-stats/index.tsx`
  - `web/pages/api/team-ratings.ts`
  - `web/lib/teamRatingsService.ts`
  - `web/lib/dashboard/teamContext.ts`
- Current stored power snapshot source:
  - `team_power_ratings_daily`
- Current updater path that appears responsible for the stored trend behavior:
  - `web/pages/api/v1/db/update-team-power-ratings.ts`
- Current SQL/source-of-truth documentation for the intended ratings logic:
  - `web/rules/power-ratings-tables.md`
- The current page code fetches date options from `team_power_ratings_daily` using a raw date select and a row limit, which risks returning only a few unique snapshot days because each date has many team rows.
- Live audit evidence indicates `trend10` is currently zero for all teams in the stored snapshot payload, despite the page copy and SQL documentation implying a real comparative signal.
- The implementation should determine whether trend correctness is best restored by:
  - correcting upstream stored data generation
  - computing a reliable landing-page trend at read time
  - or both
- The `SoS` model should stay internally consistent with the landing page’s existing data model. If multiple possible data sources exist, prefer the source that best matches the page’s team-rating context rather than mixing unrelated models without explanation.
- Candidate `SoS` data sources that appear available and worth evaluating:
  - `team_power_ratings_daily`
  - `games`
  - `nhl_standings_details`
  - any trustworthy existing `sos_standings` usage, but only if it is current, explainable, and aligned with the landing-page model
- The final implementation should document why the chosen `SoS` formulation was preferred over other available formulations.

## 8. Success Metrics

- `trend10` on `/underlying-stats` is restored to an accurate, non-broken value path.
- The snapshot date selector exposes the correct distinct available dates for the landing page.
- The landing page ships with a documented `SoS` metric.
- The `SoS` metric is based on a 50/50 split between standings-based strength and predictive/context strength.
- The `SoS` column renders cleanly in the existing table on desktop and mobile-appropriate layouts.
- No user-facing changes are introduced to `/underlying-stats/playerStats`.

## 9. Open Questions

- Should `SoS` represent past schedule strength only, or should it represent the schedule strength associated with games already played as of the selected snapshot date? Current recommendation: tie it to games already played as of the selected snapshot date because the landing page is a snapshot of current team form and ranking.
- If a trustworthy opponent-opponent-strength source exists in current data, should it be included directly in the record-based half, or used only as a secondary adjustment? Current recommendation: include it only if the source is current and clearly explainable.
- If home/away context is available but rest or expected-goaltending context is incomplete, should the predictive/context half still ship? Current recommendation: yes, as long as the final formula documents which optional inputs were not available.
- If upstream stored trend data cannot be fixed immediately, should the landing page compute trend directly as an interim corrective measure? Current recommendation: yes, if that is the fastest path to accurate user-facing output and the behavior is documented clearly.
