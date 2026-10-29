# 2026-10-29 · Claude · RSO upkeep stopgap + visible confirm gate

- **Scope:** Chef's ticket after TJ's 10-29 real-league test.
  - Diet-off Yahoo upkeep runs every 30 minutes and stops after 60 idle minutes.
  - "Confirm planning inputs" appears where Preview swap and Use this streaming plan are blocked.
  - Offline only; commit locally, no push.
- **Where:** `octoberBranch`.
  - `web/components/RosterScheduleOptimizer/{RosterScheduleOptimizer.tsx,.module.scss, StreamingItinerary.tsx,.module.scss, CandidateBrowser.tsx, CandidateCard.tsx}`
  - `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx`
  - receipt at `tasks/artifacts/rso-wave2-2026-10-25/UPKEEP-CONFIRM/RECEIPT.md`
- **State:** committed locally as `c3cf52629`, not pushed. RSO tests pass in UTC and New York (1072); tsc, eslint and the pure check pass.
- **Decisions:**
  - The stopgap is keyed to Yahoo plus the diet flag off; Fantrax stays at 5 minutes.
  - Idle is measured with `>=` 60 minutes, so the 60-minute tick is skipped.
  - A visibility return isn't interaction; window focus is.
- **Gotchas:**
  - `fireEvent.click` doesn't fire `pointerdown`, so tests send `pointerDown`/`keyDown` explicitly.
  - With two buttons named "Confirm planning inputs", tests scope to `#rso-rule-settings`.
- **Next:** Chef integrates and releases.
