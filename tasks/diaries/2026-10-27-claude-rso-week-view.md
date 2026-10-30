# 2026-10-27 · Claude · RSO week view (full Mon–Sun display, Full week reset, collapsible Streaming Plan)

- **Scope:** Chef ticket. RSO always shows the whole matchup week; a "Full week" control resets a partial (Thursday) planning start; the Streaming Plan collapses (localStorage). UI files only; no lib/.
- **Where:** octoberBranch, base d46eb63a9. Files: RosterScheduleOptimizer.tsx/.module.scss, StreamingItinerary.*, SlotWeekGrid.tsx, tests.
- **Diagnosis (verified):** `dates` = datesBetween(context.startDate, endDate). TJ's saved workspace has context.startDate = Thu (written by cf6193abd's slider, before fe5eecd9b moved the slider to view state). planMin = max(rangeStart, today) so the slider can't reach Tue/Wed; "Back to today" only clears the view-state choice.
- **Plan:** `weekDates` = range widened to its matchup week (Yahoo weeks when loaded, else Mon–Sun) for display; `dates` stays the planning range. "Full week" clears the slider choice and, when the range starts after the week start, edits context to the week (one provider refresh, like Current week).
- **State:** done, committed 87d431d6f (local, not pushed). Receipt section appended to LAYOUT-SLIDER/RECEIPT.md.
- **Checks:** RSO suites in UTC and America/New_York (75 files, 1313 tests each); tsc under the heavy lock (rc 0); eslint (0 errors, 6 pre-existing warnings); CSS pure check on both touched scss.
- **Next:** Chef integrates/releases. TJ's local workspace: click "Full week" once (one provider refresh).
- **Gotchas:** collapsed Streaming Plan unmounts its body (RTL label queries see hidden nodes otherwise). Full week on a late range is a context change, so it can restore a stored workspace for the full-week key.
