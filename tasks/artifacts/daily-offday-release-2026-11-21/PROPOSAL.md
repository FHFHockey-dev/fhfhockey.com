# Daily off-day fix: one release and recovery proposal (Nov 21)

Chef (Claude), 17:35Z Nov 21 (11:35 CST). Status: **draft, two blockers open with Astra. Nothing is approved, pushed or run.**

## 1. Incident
- The Nov 21 daily run used source date Nov 20, which had 0 official NHL games (api-web schedule response sha `6ef91865…`).
- `update-nst-gamelog` returned `no_scheduled_games_unverified` with `missingScheduleDates [2026-11-20]` and 0 NST requests.
- `run-rolling-forge-pipeline` (scope `daily_incremental` / 2026-11-21) failed stage 2 `upstream_skater_sources` twice, then `attempts_exhausted` on all nine slots (10:05–10:55Z, deployment `dpl_9YQAY1gpwwe8XBa1qWDExzaGzevP`, sha `f47905d28`).
- 0 forecast runs and 0 H1 rows across the 14 games.
- At 11:06Z, Start Chart was `partial`: 66 goalie rows, 0 skaters, `scheduled_games_missing_projections`. Daily RSO had 0 forecasts.
- Source: Astra's readback `~/Documents/Codex/2026-11-20/forge-independent-production-audit/nov21-daily-readback.json`. These two GETs are the "before" state; do not rerun them.

## 2. The two candidates
| | Astra `096b78b62` (branch `chef/forge-daily-offday-20261121`) | Claude `37a43ad9a` (octoberBranch, local) |
|---|---|---|
| Evidence | Exact official schedule: one GET to `api-web.nhle.com/v1/schedule/<date>`, 5 s timeout. The day must be present once, with `numberOfGames === 0` and an empty `games` array. | Local `games` table: the date must be bracketed by regular-season games whose ids are adjacent. |
| Scope | Incremental mode, one explicit date, past and in the current season. Any other scope still blocks. | Any aperture. |
| Files | `update-nst-gamelog.ts` and its test, plus the closure registration and receipt. Pipeline and routeRunner unchanged: both already accept `skipped_no_completed_games` (`run-rolling-forge-pipeline.ts:482`, `routeRunner/core.ts:303`). | `update-nst-gamelog.ts`, the pipeline, `routeRunner/core.ts` (adds a new `skipped_no_scheduled_games` status), and 2 tests. |
| Release base | Fast-forward of `origin/master` `f47905d28` (2 commits) | Sits on top of unreleased octoberBranch work |
| Producer closure | Registered: `0446100e…`, receipt `9f4a1c96…`, build admission verified (Astra-reported; Astra also reports 129 NST, 113 pipeline and WGO, and 39 registry tests plus typecheck) | **Not registered** (changes closure modules) |
| Refusal tests | Schedule rows missing, nonempty slate, nonzero count with empty games, stalled body or deadline, lost audit acknowledgement, a blocked scope rechecked without advancing its cursor, and stored games that never use the fallback | One "unverified schedule still blocks" case |
| Replay (Astra-reported, not rerun by Chef) | Retained real-input replay of the incident passed: 0 NST requests, `verifiedOffDates [2026-11-20]`, coordinator marked the stage complete (WGO mocked) | None |

**Decision: Astra's `096b78b62` is the single release candidate.** `37a43ad9a` is withdrawn: reverted locally as `11bea873f`, its 5 files only, not pushed. **Owner (TJ, 17:40Z): Claude Chef is the single owner** of the release and of today's recovery prep. Astra was told by mailbox (CLAUDE-OFFDAY-OWNER-CORRECTION-20261121).

## 3. Status of the open items (17:55Z)
1. **Candidate gates: PASS.** On a clean export: Vitest 7 files / 335, eslint 0, typecheck 0, production build admission pass (closure `0446100e…`). Receipt: `gates/GATES.json`.
2. **Recovery mechanism: DONE.** `recovery/RECOVERY-PLAN.md` (sha `ae353f3e…`); Chef spot-checked the resume-key and reader rules. It is a single scoped `run-projection-v2` with no reset, no pipeline call and **no deploy dependency** (§5).
3. **Downstream stages on a zero-game source date: OPEN** (offday-proof lane, due 19:05Z).
4. **Nonempty control from real data: OPEN** (offday-proof lane, due 19:05Z).
5. **NEW RISK: stage 7 derived backlog.**
   - The standalone derived build failed at 10:25Z today: deferred 2026-11-19, game 2026020357 manifest incomplete.
   - The pipeline's `projection_derived_build` reads that same durable backlog. So **Nov 22's scheduled run may block at stage 7 even with the off-day fix.**
   - The off-day fix is necessary (it is the only way through stage 2 on Nov 27) but may not be sufficient for Nov 22.
   - The proof lane is checking this and the narrowest 0357 fix.

## 4. Release (separate approval, after item 3 passes)
- Push: fast-forward `origin/master` `f47905d28` → `096b78b622a72a8378b8f60c0c7704fc4e2fee41`, the exact SHA. Expected: 1 fhfhockey build plus 3 canceled companion entries.
- Preconditions: master unchanged; no FORGE run armed; the appearance-repair slot (18:10–18:15Z) and the BLSH sandbox install (≥18:20Z) confirmed finished and reset; a push-hold note posted in the mailbox.
- Order: **after the recovery** (§5), so recovery runs on a known production release and isn't racing a deploy.
- Rollback: Vercel instant rollback to `dpl_9YQAY1gpwwe8XBa1qWDExzaGzevP`. No schema change.

## 5. Recovery for today's slate (separate approval; see recovery/RECOVERY-PLAN.md)
- **Request:** `GET /api/v1/db/run-projection-v2?date=2026-11-21&gameIds=2026020360,2026020361,2026020362,2026020363,2026020364,2026020365,2026020366,2026020367,2026020368,2026020369,2026020370,2026020371,2026020372&maxDurationMs=210000`, with cron-secret Bearer and no-store, on current production `f47905d28`.
  - On a 207 `partial`: repeat the identical request, at most 3 calls in total.
  - Never change `gameIds`: that changes the scope key and starts a second run.
  - Before any retry, read `forge_runs` first.
- **Not included:** 0359, which started at 18:00Z. Its live record `f55203dc` is left untouched, and both readers keep serving it, because a selected-games run serves only its own games.
- **Games:** 13 recoverable if started by **20:10Z** (20 min before 0360 at 20:30Z). After that, 0360 drops, leaving 12.
- **Writes:** 1 new `forge_runs` row (selected_games) plus about 470 player, 26 team and 26 goalie projection rows under the new run_id only. No reset, no pipeline state change, no NST, and no upstream reruns (inputs present; Nov 19 rolling done; `invalid_row` census 0).
- **Known degradation:** VAN (0371) and SEA (0372) lack derived rows for game 0357.
- **Before-image (read-only):**
  - forge_runs for 2026-11-21 = exactly the live row;
  - 0 `running` rows;
  - projection row counts recorded;
  - deployed SHA has a registered closure.
- **Stop:**
  - preflight 422, with no `bypassPreflight`;
  - any `Rolling skater history read incomplete`;
  - a 207 with `resume.runId:null` more than once;
  - any game within 20 min of puck drop at a resume call.
- **Revert:** nothing is written in place. Marking the run non-succeeded would withhold it from readers; that is a separate approval.

## 6. Live acceptance
| When | Kind | Pass criteria |
|---|---|---|
| Recovery (today) | Recorded off-day slate | New run `succeeded` with `requested_game_ids` = the 13 and projection rows for each. Start Chart GET 2026-11-21: skaters for 0360–0372, and 0359 still from `f55203dc`. Daily RSO GET: forecasts for the unstarted games, `withheld` 0. Two sequential read-only GETs; "before" = Astra's 11:06Z readback. |
| First scheduled run after deploy (Nov 22 10:05Z) | Nonempty control (source Nov 21, 14 games) | NST plans and makes requests as before, with no schedule fallback call. Stages 2–8 complete, unless the stage-7 backlog (item 3.5) blocks; that is a separate known cause, not an off-day regression. Same two GETs show Nov 22 forecasts. |
| Nov 25 10:05Z | Low-count control (source Nov 24, 1 game) | Same as the nonempty control. |
| Nov 27 10:05Z | First live off-day (source Nov 26, 0 games) | `verifiedOffDates [2026-11-26]`, 0 NST requests, stage 2 complete, Nov 27 forecasts in both GETs. |
| Any day | Unverified date | If the schedule fetch fails, is not 200 or is malformed, the date stays in `missingScheduleDates` and stage 2 blocks, as on Nov 21. This is the expected refusal. |

## 7. Not in scope
No production change, deploy, push, cron change or manual route run without TJ's approval of the exact action.
