# WGO skater startDate query

- Scope: explain supported URLs for repairing skater data from 2026-09-27; source inspection only.
- Where: canonical checkout, octoberBranch at e24b43712; web/pages/api/v1/db/update-wgo-skaters.ts. Existing route and repository changes are owned by other work and preserved.
- Current: inspection complete. action=all&startDate=2026-09-27 processes inclusively through today or current season end; explicit startDate takes precedence over fullRefresh/latest-date logic. action=season supports inclusive startDate/endDate bounds within stored season metadata. Neither path exposes an automatic resume cursor. Only regular-season/playoff game types are fetched.
- Checks: inspected handler, date loop, latest-date lookup, game-type selection, and existing route diff. No tests required for this explanation; no ingestion or remote/database request executed and no application code changed.
- Outcome/next: deliver URL guidance with manual startDate advancement and the distinction between repairing older gaps and latest-date incremental updates. No implementation or execution pending.
- Blockers/approvals: none for inspection; production execution is outside this question.
- Gotcha: action=all defaults to the day after the latest stored date, so that default does not fill older gaps.
