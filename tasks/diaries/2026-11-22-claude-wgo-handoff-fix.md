# 2026-11-22 Claude: WGO handoff fix (daily FORGE pipeline)

## Scope
Local-only fix: a later scheduled fire verifies an abandoned `update-wgo-skaters` child for the exact
date and attempt, then completes `upstream_skater_sources` once without rerunning WGO. No prod reads
beyond the brief, no writes, pushes, builds or deploys. Chef = local_9996b7b8 (manual recovery is theirs).

## Where
- Worktree: /private/tmp/forge-wgo-handoff-20261122 (detached at 53f1929a1; node_modules symlinked)
- origin/master moved to 480bd5d71 (auth pages + records only; no closure overlap)
- Report: tasks/artifacts/wgo-handoff-fix-2026-11-22/

## Design (decided)
- Attempt token `<startMs>-<hex12>` sent as `pipelineAttempt` in the WGO query; the WGO route's own
  manual audit row stores `details.url`, job `update-all-wgo-skaters`.
- Marker rows under a separate pipeline_key `rolling_forge_child_handoff` (scope = run key) so the
  acceptance evaluator (exact stage set) and serving health never see them. Written only on abandon.
- Stage hold row stays exactly `stage_handoff_unconfirmed`; pickup = CAS from the exact hold revision.
- Pickup skips NST, WGO and the optional totals refresh (pg_cron 14 covers totals), completes the stage.
- No existing coded resolution path for review holds (comments only: "operator-authorized resumption").

## State / checks (readiness gate + digest; TJ decision via Chef)
- FINAL M′ a86a99898 on a9e08f854 (writer 4f362fed2, gate 169718455, reg after 7ee3612e); closure af8b8d11; admission PASS; FF. M 1b80214d1 and R 52c102849 superseded.
- Cut R 52c102849 on 480bd5d71 (writer 5d631d6db, gate af03a4c2c, reg); closure 49fb034d; admission PASS.
- Base conflict raised with Chef: master already holds #464 (= octoberBranch 558ea2fb4 minus 7ee3612e registration).
- Vitest 772 (M) / 771 (R) across 48 files; typecheck 0; eslint 0. 500-of-504 unaudited rewrite defers via digest.
- Rankings migration 20261122145409 is Rankings-owned, uncommitted, not in either cut.

## Next
- Chef picks M or R; TJ approves registration and combined release. Nothing pushed.

## Gotchas
- Digest gate makes FORGE depend on job 9 running on the new build: deploy before 07:30Z or the day defers.
- Daily acceptance compares the exact stage-row set: never add rows under `rolling_forge_pipeline`.
- `git checkout -- .` before patching: always save `git diff <base>` of the working tree first (done).
