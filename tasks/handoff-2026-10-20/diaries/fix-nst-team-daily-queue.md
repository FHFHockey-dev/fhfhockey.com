# Handoff diary: fix-nst-team-daily-queue (finding A-12)

> Compiled 2026-10-20 from the session transcript by the orchestrator's helper; not written by the session itself.

Session id: `local_992071ae-cd72-42ee-b4eb-958ba27a79f1` ("Fix NST team-daily queue that stalls on no-game days"), idle, finished normally.

## 1. Scope
- Finding A-12 in `tasks/artifacts/sprint-audit-2026-10-19/CROSS-CHECK-AUDIT.md`. TJ was manually catching up NST team-daily data from 2026-09-29 to 2026-10-18, one date per call.
- Bug: incremental mode queued dates from the earliest dataset's latest date, inclusive. With more than 4 dates burst was off, only 1 date ran, that date was already complete and skipped, so the queue never advanced. Off days never become "complete", so one league-wide off day stalled the job. Production stuck after the June 2026 final; CTPI (`update-team-ctpi-daily`, job 279) then wrote 0 rows daily with `success:true`.
- Also: CTPI should report skip/warning, not plain success, when it writes 0 rows in season.

## 2. Where
- Files: `web/pages/api/v1/db/update-nst-team-daily.ts`, `web/pages/api/v1/db/update-team-ctpi-daily.ts`, and tests `web/__tests__/pages/api/v1/db/update-nst-team-daily.test.ts` (5 cases), `update-team-ctpi-daily.test.ts` (2 cases).
- Committed on `octoberBranch` in `b47c512fb` (10-19, "Fix six audit findings"). Released to production in R5 `bb21d5942`; `origin/master` (R6f `b630e0767`) contains `noGameDates` and CTPI `no_source_rows` (checked by the helper in git).
- Hand-over note: `~/Library/Application Support/Claude/side-session-notes/local_08a0bf1c-fda1-4d08-9f56-8ff961d00e41/nst-team-daily-queue-a12-2026-10-19.md`.

## 3. State
- Done and released (R5). Behaviour:
  - Incremental start = day after the latest stored date when complete; a partial date is re-fetched, only for missing tables.
  - Floor = season's first non-preseason game in `games`; falls back to `season.startDate` if no rows.
  - Dates with no scheduled games are dropped (`offDays`); if NST returns no team games (no team with GP = 1 in the all-strength table) the date goes in `noGameDates` after 1 request.
  - Per-run budget is requests, not dates: 10 paced, 18 burst. Complete dates cost nothing. Spacing stays 21 s; burst rules unchanged. Worst paced run about 189 s plus last fetch, under maxDuration 300.
  - CTPI 0-row run returns `outcome: "skipped"`, `reason: "no_source_rows"` plus `warnings`; cron-report flags it as no output.
- Checks at the time: 7 new Vitest cases pass (all 5 NST cases fail against the old route; pass under `TZ=UTC`); ESLint clean on touched files; full `tsc --noEmit` under the heavy lock exit 0. No cron, route or production request was made.

## 4. Next
- None stated. Session ended after the report.

## 5. Blocked / needs TJ
- TJ's manual catch-up: because of the pre-existing date shift (below), dates loaded with `?startDate=X&endDate=X` on Vercel may have landed on X-1. TJ should spot-check what was actually stored for 2026-09-29..10-18. This is inferred from a local `TZ=UTC` node check, not observed in production data (unverified).
- Reverse mode was left unfixed (follow-up).

## 6. Insights
- Pre-existing bug found: the old queue did `formatEstDate(parseISO("YYYY-MM-DD"))`. On a UTC host (Vercel) `2026-10-18` becomes `2026-10-17`. The fix counts dates as plain calendar strings in incremental and forward modes only. The reverse branch still uses `formatEstDate` on `origin/master` (lines around 556-564), so it may still shift (unverified).
- Trade-offs the session flagged: (1) the burst check now counts the queue after off days are dropped, so a backlog just over the 4-date line can burst where it used to be paced; (2) if NST is late with a date's data while a later date already has data, that date is passed over for good (old code stalled instead).
- The "no games" decision uses the `games` table (type null or not 1) and NST's own empty response; if the season has no `games` rows nothing is dropped.
- Off-season skipping was added earlier (`web/lib/cron/nhlOffSeason.ts`, `79492e495`, octoberBranch only; its release status is unverified), so this fix only covers in-season gaps.
