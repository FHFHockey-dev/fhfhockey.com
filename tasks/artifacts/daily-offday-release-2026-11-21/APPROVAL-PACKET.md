# Approval packet · daily off-day fix + Nov 21 recovery

Chef (Claude), drafted 17:58Z Nov 21 (11:58 CST). Each batch is a separate approval, covering only the exact action written. Before execution, Chef re-checks every precondition and records the result here.

## Shared preconditions (re-checked immediately before each batch)
- `origin/master` = `f47905d28718f6910d7acfa1471517c0235775de`; production = `dpl_9YQAY1gpwwe8XBa1qWDExzaGzevP` (READY).
- 0 open FORGE live runs; 0 `forge-live-%` cron jobs; job 408 off. The 0359 record (`f55203dc`) is terminal and untouched.
- The appearance-repair slot (18:10–18:15Z) has reported done in the mailbox, or its window has passed with no running transaction.
- The BLSH sandbox install (≥18:20Z) has reported reset, or has not started and is held.
- The mailbox note for each batch is posted before it starts.

## Batch A · recovery of 13 unstarted Nov 21 games (production write, no deploy)
- **Source:** `recovery/RECOVERY-PLAN.md` (sha `ae353f3e…`). Readers and resume key spot-checked by Chef.
- **Action:** `GET https://fhfhockey.com/api/v1/db/run-projection-v2?date=2026-11-21&gameIds=2026020360,2026020361,2026020362,2026020363,2026020364,2026020365,2026020366,2026020367,2026020368,2026020369,2026020370,2026020371,2026020372&maxDurationMs=210000`, cron-secret Bearer, no-store, sequential.
  - On a 207 `partial`: repeat the identical request, ≤3 calls in total. Read `forge_runs` before each retry.
- **Deadline:** start by **20:10Z (14:10 CT)** for 13 games. After that 0360 drops; do not edit `gameIds`.
- **Writes:** 1 `forge_runs` row (selected_games, 13 ids); about 470 player, 26 team and 26 goalie projection rows under that run_id. Nothing else.
- **Before-image (read-only):**
  - forge_runs 2026-11-21 = only `f55203dc` (succeeded);
  - 0 running rows;
  - projection row counts for 2026-11-21.
- **Stop:**
  - a preflight 422 (no `bypassPreflight`);
  - any `Rolling skater history read incomplete`;
  - `resume.runId:null` more than once;
  - a game within 20 min of puck drop at a resume call.
- **Known limits:**
  - VAN (0371) and SEA (0372) lack game 0357 derived rows (degraded, not blocked).
  - This is the first multi-game projection run since the `invalid_row` fix. A failure stops it with zero or partial rows under the new run only.
- **Acceptance (two sequential read-only GETs):**
  - Start Chart 2026-11-21: skaters for 0360–0372, with 0359 still from `f55203dc`.
  - Daily RSO: forecasts for the unstarted games, `withheld` 0.
  - DB: run `succeeded`, rows present for the 13 games.
- **Revert:** none in place. Withholding the run (status change) would be a separate approval.

## Batch B · release `096b78b62` (push + 1 build)
- **Action:** fast-forward push `origin/master` `f47905d28` → `096b78b622a72a8378b8f60c0c7704fc4e2fee41` (2 commits: `e2f8c6bc9` off-day check, `096b78b62` closure registration).
- **Order:** after Batch A finishes (or is declined).
- **Gates (Chef, clean export):**
  - Vitest 7 files / 335 pass; eslint 0; typecheck 0;
  - production build admission pass (closure `0446100e…`);
  - receipt `gates/GATES.json`.
- **Proof (offday-proof lane, receipt sha `6aa3e0a6…`):**
  - every stage after NST passes on a zero-game source date except stage 7;
  - stage 7 fails on game 0357's pending manifest, independent of the off-day;
  - nonempty control passes (11-19: identical 20 NST URLs on both trees, 0 fallback calls).
- **Expected Vercel effect:** 1 fhfhockey production build plus 3 canceled companion entries. Chef watches until READY, then a bounded smoke test: `/api/v1/runs/latest` 200 and the deployed SHA.
- **Rollback:** Vercel instant rollback to `dpl_9YQAY1gpwwe8XBa1qWDExzaGzevP`. No schema change.
- **Live acceptance:**
  - Nov 22 10:05Z: nonempty control. NST normal, no fallback call. Stage 7 is expected to pass (derived queue empty). `projection_execution` gets its first full-slate run since the `invalid_row` fix.
  - Nov 27 10:05Z: first live off-day, `verifiedOffDates [2026-11-26]`, 0 NST requests.
  - Unverified dates keep blocking at stage 2.

## Batch C · game 2026020357 manifest refresh (optional quality fix, not a Nov 22 blocker)
- **Verdict revised (offday-proof receipt v3 `df85badd…`; Chef checked `projectionDerivedQueue.ts:74-87`):** the derived build queues a date only when a game's relationship is current and its derived build is stale.
  - 0357's relationship is pending, so it never queues, and the other 11-19 games are built.
  - The queue at 18:01Z was empty, so **Nov 22's stage 7 should pass**.
  - Residual risk: any game with a pending relationship on a queued date fails that whole date.
- **Cause:** 0357's manifest pins shiftcharts snapshot v1 (raw 151701). The head moved to v2 (raw 153769) at 11-21 00:25Z, so the relationship build raises SHIFT_RELATIONSHIP_RAW_SNAPSHOT_STALE.
- **Effect:** SEA and VAN derived history lacks 0357, which degrades forecasts for 0371 and 0372.
- **Steps, if approved later (3 production writes, NHL API only, no NST):**
  1. `POST /api/v1/db/ingest-projection-inputs?startDate=2026-11-19&endDate=2026-11-19&resumeFromGameId=2026020357&maxGames=1`
  2. `POST /api/v1/db/shift-charts?gameId=2026020357`
     - Stop if it still skips with `projection_raw_snapshot_stale`.
  3. `POST /api/v1/db/build-projection-derived-v2?startDate=2026-11-19&gameId=2026020357`, or let the next scheduled build pick it up.
- **Not verified:** that step 1 re-pins the manifest to v2 (inferred from code).
- **Order:** if wanted today, run this before Batch A so 0371 and 0372 are recovered with it. Otherwise it is a later follow-up.

## Already done (no approval needed)
- 0359 is proven and closed (`READBACK-0359.json` sha `30f6e72b…`).
- `37a43ad9a` is withdrawn locally as `11bea873f` (not pushed).
