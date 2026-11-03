# Yahoo real-account window: results, 2026-10-26 (production, TJ's Chrome via Claude in Chrome)

TJ chose by pop-up to run on production in his Chrome instead of a local dev server. Evidence below is counts, booleans and limitation strings only. Player names were scrubbed in the page before reading, and no league, team or player data is recorded.

## Environment blocker found first (pre-existing product bug)
- Chrome reported `navigator.onLine === false` while the network worked (`effectiveType 4g`, 10 Mbps). RSO skips its access check and data load when offline and then stalls on "Checking access for provider synchronization…" with an empty week grid. It reproduces on 538100d41 and on pre-release bd337d97a (RSO-FLAKE HANG-DIAGNOSIS.md), so it isn't a release-4 regression. It cleared only while TJ toggled DevTools network throttling, which fires an `online` event. **Product follow-up:** don't gate requests on navigator.onLine; show offline only on a real failure, and never leave "Checking access…" stuck.

## Budget overrun (stop rule triggered)
- When the online event fired, two RSO tabs in Claude's group (one stale, one fresh) each auto-loaded the connected workspace: access, provider snapshot, schedule, eligibility ×4, yahoo-current-data ×3 (one aborted).
- Discovery read **58 pages per snapshot** (plan estimate 3–20). Total Yahoo reads ≈ 2 × (6 + 58) + 3 ≈ **131**, above the approved 100 ceiling. No rate-limit, re-auth or access-denied errors. The window was stopped at once and the RSO tabs closed. R3 and R4 didn't run.
- Lessons: open exactly one RSO tab; budget discovery at ~58 pages per load for this league; confirmation reads happen automatically on open, so R2 can't be separated from R1 by user action.

## R1 evidence (one snapshot, from the loaded tab)
| Check | Observed | Expected | Result |
|---|---|---|---|
| Lineup mode | daily | daily league | ✅ |
| rules.acquisitionTiming | "unknown" | unknown | ✅ |
| Goalie minimum | required 3, credited 0, counts "unknown", penalty "unknown" | counting semantics unknown | ✅ |
| Roster | 19 entries; persisted fields only playerId and position | roster maps; no extra PII persisted | ✅ |
| Roster slots | C2 LW2 RW2 D4 UTIL1 G2 IR+2 bench4 | provider-derived | recorded |
| Scoring | points, 10 weights | — | recorded |
| **Y1** (rules:false names unverified facts) | Data health: "Yahoo does not report these league rules; confirm them in League rules: when an add takes effect (same-day or next-day); waiver mode and FAAB budget; the exact weekly add reset time (league-local midnight is assumed); how the goalie minimum…" | limitation names unverified facts | ✅ **fixed live** |
| Time zone | "Yahoo does not report a league time zone; planning uses America/New_York from Planning setup" | absent → explicit fallback | ✅ |
| (c) Discovery | 58 pages attempted, 58 returned, 56 accepted; 1384 rows, 1384 unique, 0 repeats; 5844 ms of 8000 ms; "Stopped: end of list" | complete, stop reason reported | ✅ |
| (c) Matching | 815 catalog matches, 569 unmatched; catalog 848 candidates: 815 both known, 33 neither known; "unseen players remain un[known]" | unseen stay unknown | ✅ |
| (f) Ownership | "Ownership unknown. Demand from other managers isn't checked." | ownership is context only, never addability | ✅ (ownership unknown in this snapshot) |
| (d) Weekly counter | not captured before the stop | — | not verified |
| R2 / R3 / R4 | not run (budget stop) | — | not verified |
