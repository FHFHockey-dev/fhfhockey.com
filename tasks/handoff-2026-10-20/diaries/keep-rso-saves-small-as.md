# Handoff diary: Keep RSO saves small as projection coverage grows (2026-10-20)

## 1. Scope
- The task came from proposal `task_22a7cb03`, made in the RSO session. This session is its fork.
- The goal was to fix the expanded-size problem the Chef found in the held R6e candidate (`2a74489af`), then cut a new master release candidate.
- The cause: the compact bridge wire (`0654fafc4`) made the bridge budget count compact bytes. Rebuilt projections could then reach about 8.8 MB on the client and flow, full size, into three places:
  - workspace saves (4.5 MB request limit);
  - saved-workspace loads (4.5 MB response limit);
  - the preservation journal in sessionStorage (about 5 MB).

## 2. Where
- **octoberBranch commits:**
  - `0654fafc4`: compact wire for /data and /provider (pushed).
  - `b401c5f53`: this fix. Another session on this machine pushed it at 00:52Z, before TJ's "Send it" here; TJ then approved it.
- **Master release R6f:** `b630e0767`, built with a temp GIT_INDEX_FILE and commit-tree on `ccfe5e57b`. Deployment `dpl_CB3xkpyVPYz9yFU1NhQGde1uj5wm`, aliased at 01:05:01Z. It supersedes the held R6e.
- **Files changed (octoberBranch `b401c5f53`):**
  - `web/lib/rosterScheduleData/bridgeForecastWire.ts`
  - `web/lib/rosterScheduleData/forgeDailyBridge.ts` and its test
  - `web/pages/api/v1/roster-schedule-optimizer/workspace.ts`
  - `web/lib/in-season/workspaceRoutes.test.ts`
  - `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx`
- **Additional files in R6f only:** `web/pages/api/v1/roster-schedule-optimizer/data.ts` and `provider.ts`.
- **Record:** `rso-r6f-snapshot-size-2026-10-20.md` in the shared side-session-notes folder, with per-file blobs.

## 3. State
- **Done and released (R6f on master):**
  - `packPlanningSnapshots` / `unpackPlanningSnapshots` compact bridge rows inside every planning snapshot in a JSON value. A snapshot is packed only when every forecast rebuilds exactly, so unpacking restores the same order and content. If a packed snapshot can't be rebuilt in full, unpacking throws.
  - **Workspace route:** unpacks PUT bodies before any validation and packs every 200 response. The DB still stores and validates complete snapshots.
  - **RSO page:** packs saves and preservation requests, unpacks their responses, and keeps the preservation journal packed. The backup download stays full size.
  - **Bridge:** new `FORGE_DAILY_BRIDGE_EXPANDED_BYTE_BUDGET` of 4,000,000 bytes beside the 2.5 MB compact cap. Trimming happens at whichever cap is hit first; the expanded cap binds first.
- **Checks on octoberBranch:**
  - RSO, Yahoo, in-season and hooks suites: 84 files, 1,377 passed.
  - tsc: 0.
  - eslint: 0 errors, the 6 known exhaustive-deps warnings.
- **Checks on the master candidate export:**
  - The same suites: 82 files, 1,286 passed.
  - tsc: 0.
  - eslint: 0 errors.
- **Chef's checks:**
  - Focused tests: 1,264/1,264.
  - Full Vitest: 9 failed / 8,782 passed, the same failures as R6d.
  - Offline round trip on the real R6d response (1,283 rows): byte-identical; the save body went from 2.42 MB to 1.01 MB.
- **Production smoke (Chef, 01:07:39Z):** the RSO data route for 10-20..10-26 returned 200 at 1,011,282 B (2.43 MB on R6d). `data.forecasts` was 0, and `bridgeForecasts` carried 1,283 rows from 6 runs.
- **Not verified:**
  - account save and load in a signed-in browser;
  - preservation seal, verify and restore run live.

## 4. Next
- I have no further planned task.
- Suggested first step for whoever picks this up: in a signed-in RSO, save the workspace, reload it, and confirm the projections are back. Use the evidence export or the planning totals, and watch the PUT size in devtools; it should be about 1 MB, not about 2.5 MB.

## 5. Blocked / needs TJ
- The octoberBranch sync merge `392c02af2` (Chef) is local and unpushed; pushing it needs TJ's OK.
- The signed-in browser check above needs TJ, or a session using his browser.

## 6. Insights
- **Where snapshots live:**
  - localStorage (`fhfh:rso:workspace:v1…`) holds only the PlanningWorkspace, never a snapshot.
  - The sessionStorage preservation journal holds a backup with two snapshots: `remote.row.snapshot` and `provider.connected`.
- **Order matters for checksums.** Preservation checksums use `preservationJson`, which sorts object keys but keeps array order. That's why packing is all-or-nothing per snapshot and appends rows in their original order.
- **Master lacks octoberBranch's transport.** It has no `planningDataTransport` or `forecastServingSource`, so `data.ts` and the page's data fetch need port edits on master. Master's `workspaceRoutes.test.ts` also differs from octoberBranch: its imports start at the vitest line.
- **Old tabs.** Browser tabs loaded before a deploy ignore `bridgeForecasts` and packed snapshots until reloaded; they just see no bridge rows.
- **Coverage gap, separate from this fix.** It comes from the bridge's input data:
  - 151 skaters have projected PP time but blank PP heads in the octoberBranch-made 10-13..10-19 FORGE runs, and stay dropped.
  - 115 rows have blank ES heads.
  - Production FORGE runs on master code write full lines, so the gap heals as teams play.
- **Coordinate pushes.** A push of `b401c5f53` happened from another session before TJ's go here. Re-read origin before pushing and record who pushes.
- **Measured row sizes:** about 1,540 B per row full size and about 436 B compact. A full week is about 2,100–2,200 rows.
