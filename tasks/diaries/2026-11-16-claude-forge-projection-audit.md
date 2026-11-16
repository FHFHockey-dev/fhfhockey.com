# FORGE projection pipeline audit (Claude Chef, 2026-11-16)

## Scope
TJ: comprehensive audit, triage, diagnosis and fix of the FORGE player projection pipeline end to end, ending at the
RSO page. A blind investigator (Fable) audits first with no hints; TJ's own observations stay out of its brief. Then
the advisor (Fable, sees everything) compares the findings with TJ's observations, and fixes follow.

## Where
- Branch `octoberBranch`, base `8aaf71545`. Nothing committed yet for this task.
- Artifacts: `tasks/artifacts/forge-projection-audit-2026-11-16/` (`ro_sql.py`, `ro-sql-log.txt`, `blind/`).

## State
- 13:39Z `ro_sql.py` written and tested: 9 refusal cases refused (exit 9); one `select 1` read showed
  `transaction_read_only=on`, `statement_timeout=5s`. Caps: 10 statements per call, 150 in all, no reads at or after
  21:00Z (Monday capture prep at 22:15Z).
- 13:45Z advisor reviewed the approach: added `pg_stat*reset*` to the wrapper's refusals (tested). Blind Fable agent
  launched (general-purpose, background) with a symptom-free brief: stage map, population reconciliation, filters and
  normalisations, freshness, load path per page, empty and failure states, and master vs octoberBranch per finding.
  No dev server, tests, network or writes outside `blind/`; deadline 20:45Z.
- Next: when it reports, read `blind/AUDIT.md`, re-run its key queries, then bring the advisor three items: counts by
  reason of rostered players with no projection today, file:line of any availability filter, RSO request sequence.
- 14:22Z blind audit done (`blind/AUDIT.md`, 91 statements; no app files touched). Top items:
  - C1: allowlist gap; runs since 11-13 are withheld and the 11-09 lines expire about 11-17 10:16Z.
  - C2: pipeline stuck in `running` with no retake.
  - H1: one bad shift chart fails the day.
  - H3: a single-game run replaces the slate.
  - H4: a short pool inflates TOI.
  - H5: unpaginated `rosters` read.
- 14:35Z Chef re-checks in `CHEF-VERIFICATION.md`: C1 confirmed; no availability signal anywhere
  (`forge_roster_events` 0, `player_status_history` dead since 04-22); 23 skaters who dressed this season have no line
  across today's 4 teams. The capture writes only private RPCs (no H3 interaction).
- ~14:40Z TJ pop-up approvals:
  - C1: both hashes, release today;
  - injured: build the display now, flag after a runtime check;
  - other fixes: start sessions, math after the capture;
  - slowness: watch one production load in TJ's Chrome.
- start_session was refused: a turn started by an automated event can't start sessions, so TJ must ask in chat.
- Release snag: master's closure `9944628e` fails the verifier, with two unreviewed dynamic sites at
  `pregameCapture/transport.ts:196`. TJ chose "Reviewed site, re-verify all".
  - The reviewed-site entry is added to `web/scripts/forge-producer-closure.ts`, and the closure is still `9944628e`.
  - All 15 commits are being re-verified (13 listed plus `e1ab46318e` and `5c42cb14f`) into
    `tasks/artifacts/forge-release-reverification-2026-11-16/`.
  - The 11-13 run stamps are consistent: invocation counts match and every stamp is `ee5581d9` (`verify/rows-1113.json`).
- Next:
  - repoint all 13 entries' receipt and sha256 and add the 2 new entries, plus the test list;
  - vitest; replay the 7 rows through `externalInputProofByRun`;
  - commit; build the candidate on origin/master; gate it in an export;
  - push pop-up with the Vercel check, kept clear of 22:15–23:30Z.
  - Fallback receipt for ee5581d9-only: the old-walker receipt was removed; regenerate if needed.
- ~14:50Z re-verification: all 15 VERIFIED, 0 findings; every listed closure unchanged.
  - Committed on octoberBranch as `7b11a43cb` (3 code files + 15 receipts).
  - Local vitest: 16 files, 674 passed.
  - Replay: 7 of 7 runs from 11-13 are proven under the new list.
  - Candidate `3727c62f7` = master `5c42cb14f` + those 18 files, built with commit-tree. Export gate running
    (`bw3yc6un6`).
  - Codex mailbox note appended (uncommitted).
  - Vercel history: each master release = 1 fhfhockey build + 3 cancels; no previews.
- 15:00Z #455 merged as `23f8647bd`; Vercel 1 build READY 15:04:51Z plus 3 cancels.
  - Smoke test: start-chart for 11-16 serves run `26373189`, same-day, 79 players.
  - forge/players serves the same run but returns only 46 of 69 skaters, which confirms H5 (unpaginated rosters).
- TJ, in the push pop-up: "Fully reconcile and merge octoberBranch with master. All unstaged, uncommitted files are
  vetted and pushed. Remove bloat, screenshots, unnecessary json logs and other clutter."
  - Archived to `~/fhfh-artifact-archive/2026-11-16/` (MANIFEST.tsv, 2,779 rows):
    - 1,215 big or log untracked files, about 1.54 GB;
    - 1,242 unreferenced small JSON;
    - 322 tracked screenshots, committed in `2d01f38e8`.
  - Synced with master: `ee5f8428d`.
  - rebuild-score change vetted (9/9, eslint) and committed as `698b9ee00`.
  - `next-env.d.ts` reverted (generated churn).
  - Secrets scan of what was kept: 12 hits, all placeholders.
- Fix-phase notes: before adding injured players to the run, check whether team TOI or usage is shared across the
  projected roster (adding them would dilute healthy teammates). Check leases before touching RSO files.

## Blockers and approvals
- Fixes that touch production (migrations, cron or schedule changes, deploys, pushes) need TJ's own approval.
- The FORGE capture run tonight (candidate `bc13b523e`, a frozen export) is unaffected by local edits.

## Gotchas
- The advisor tool forwards the whole transcript, so it cannot be blinded. The blind pass is a fresh Fable agent.
