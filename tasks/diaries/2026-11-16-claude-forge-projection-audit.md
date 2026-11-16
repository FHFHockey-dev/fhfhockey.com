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
- 15:10Z reconcile gate of `137d9db8a`:
  - typecheck 0, eslint 0 errors, CSS pure ok, closure `9944628e`;
  - full vitest 20,400 passed, 26 failed. 24 fail the same way on a master export (tests need `.git`) and all 7 of
    those files pass in the checkout (212). The NST budget test is a load flake that passes alone.
  - The stale homepage test (5 to 8 stories, per approved superstyle `8aaf71545`) was fixed in `bf8b6ef82`.
- 15:21Z TJ: "Push merge push octoberBranch and fix any errors or failures".
  - #456 merged as `9b3575f8a` (tree = candidate `16b5bb376`).
  - octoberBranch synced as `b698aae04` (tree = master) and pushed `8aaf71545..b698aae04`.
  - Verified: #456 built `fhfhockey` once (READY 15:31Z, aliased to fhfhockey.com) and 3 projects cancelled.
  - The octoberBranch push made no Vercel deployment and no GitHub status, deployment or check run.
- Open:
  - the five fix sessions (need TJ's chat go);
  - the RSO slowness measurement in TJ's Chrome (approved; TJ opens one RSO tab);
  - the reserve-flag runtime check;
  - Monday capture prep at 22:15Z (timer `bekr0zh24`).
- 17:10Z TJ in chat: "Start all five".
  - `blind/AUDIT.md` had gone to the archive by size in the cleanup; restored and committed as `b296d52af`, with a
    note in `ARCHIVE-2026-11-16.md`. Local only.
  - Five sessions started, sharing the checkout with exact file ownership:
    - `rso-injured-display` (local_90c376cd);
    - `forge-gate-guard` (local_572f150e): next.config check + H2 + cron-report alert;
    - `forge-pipeline-fix` (local_f5914a1e): C2, H1, M4, M5, L2;
    - `forge-read-paths` (local_b367174b): H3, H5, H6, L3, O1;
    - `forge-projection-math` (local_768a1460): H4, M3, L1. It commits only after my "capture closed" message.
  - Every lane is told:
    - the two verifier scripts and the allowlist are off-limits;
    - no prod reads or writes without TJ's pop-up;
    - focused tests only from 22:15Z to 03:00Z.
  - The pipeline and math lanes change the closure, so their release needs a re-verified allowlist entry (mine).
  - An untracked `web/lib/sources/zz-scratch-ducks-20261116.test.ts` appeared; it is not mine. Left alone.
- ~17:35Z TJ in chat: hold `RosterScheduleOptimizer.tsx` and its test, acknowledge the 11-15 Astra handback, record the
  exact files, check `retention.ts` separately, and preserve the October worktree.
  - The October worktree (detached `6e14053ff`) has uncommitted diffs from 10-11 in both held files and in
    `planningReproducibility.test.ts`. Read with `--no-optional-locks` only.
  - The handback lists `HANDBACK-PATHS.tsv` and `HANDBACK-RECORDS.tsv` had been archived by the cleanup; both are
    restored in place, untracked. The other 355 `master/**` records stay in the archive.
  - `retention.ts` has no transfer row. It sits under the Scout/Codex reservation and is covered by TJ's narrow
    carve-out. It is clean in every worktree and outside the closure.
  - The closure is now `8461033…`, since the pipeline lane's commits change it.
  - The ack and lease update are committed as `b9b220f61`. The RSO session was told; delivered.
- ~17:55Z carve-outs recorded here on TJ's pop-up instructions, relayed in his own words by the two lanes. The lease
  files stay unchanged.
  - Checked:
    - `git status` in the canonical checkout, and `--no-optional-locks` in every registered worktree: no diffs in any
      of the seven files.
    - Owner of record from `HANDBACK-PATHS.tsv`, acked in `b9b220f61`.
    - Lease JSONs, handoffs since 11-14, and diaries.
  - **Gate guard (`forge-gate-guard`)**, exact-file carve-out for the FORGE proof alert and the production build guard
    only:
    - CLEAR `web/pages/api/v1/db/cron-report.ts` and `web/__tests__/pages/api/v1/db/cron-report.test.ts`:
      - Rows 877 and 97 are "decide with TJ", and TJ chose return to Claude on 11-15. Owner at ack: Claude.
      - Codex `CODEX-NST-GOALIE-WRITER-20261101-REPORT` (active_exact_file_leases[46]) has been frozen and approval-pending
        since 11-01. Its baselines don't match, and four released commits have changed these files since (#434,
        `4aabe49ee`, `e86f903c0`, #446).
      - Its own 11-15 handback returns the paths, and Codex keeps none of the 37 shared.
      - Keep edits additive, so that frozen candidate can still rebase.
    - CLEAR `web/components/CronReportEmail/CronAuditEmail.tsx` and `web/__tests__/components/CronReportEmail/CronAuditEmail.test.tsx`:
      - Rows 169 and 75 return to Claude, with the same lease-46 note.
      - Astra's 11-14 assignment was a read-only review, handed back on 11-15.
    - CLEAR `web/next.config.js`:
      - It has no transfer row. The only claim is Claude's own idle PROV-GUARD (since 10-26); its last commit is
        `595ab13d9` (10-26, FORGE F1).
      - It is outside the closure and the Codex reservation patterns.
      - Add the guard only; leave the closure stamping as is.
    - TJ chose "fail" for production builds with no override. Every closure-changing release must therefore carry its
      verified allowlist entry in the same release, starting with the pipeline lane's new closure `8461033…`.
  - **Math (`forge-projection-math`)**, exact-file carve-out for H4, M3 and L1 only:
    - CLEAR `web/lib/projections/stages/skater-stage.ts` and `web/lib/projections/run-forge-projections.ts`.
    - Rows 590 and 581: owner at ack is Claude.
    - Claude lease 36 FORGE-RESERVE stays active and is not retired. Its reserve pass shipped in #430, and there is no
      pending reserve diff anywhere.
    - The last edits were the capture lane's trend-band reader (`bbb85af7b`, 11-15, integrated; nothing pending) and
      the idle load-split session (`9a312597e`).
    - TJ approved the isolated worktree (branch `chef/forge-projection-math`).
    - Nothing merges into octoberBranch until I confirm the capture closed and TJ approves the oracle re-record. I own
      the oracle: the lane hands me a pinned SHA plus a per-scenario expectation diff, and I bring both to TJ.
- ~18:05Z: the RSO lane reports TJ's direct pop-up approval to ship the injured-display fix to production as a scoped
  PR. TJ cleared `RosterScheduleOptimizer.tsx` (wiring only) and the `CandidateBrowser` prop.
  - I told the lane to run the release itself, gated like #455 and #456:
    - commit-tree on origin/master;
    - an export gate;
    - the closure must still be `9944628e`;
    - a `chef/` branch, then a squash merge;
    - 1 build and 3 cancels; a smoke test of at most 5 GETs.
  - It must not push or sync octoberBranch, and must merge by 21:45Z, or else wait until after the capture.
- 18:15Z: the math candidate is ready on `chef/forge-projection-math` at `d578bfe80`, in the worktree
  `/Users/tim/Code/fhfhockey-forge-math`, based on `3dc9ae1ba`. It is not merged or pushed.
  - Commits: L1 `95711cd2c`, M3 `ebfe8fb1d`, H4 `fb833ddb2`, then tests only.
  - Verified: it touches only `scenario-blending.ts`, `skater-stage.ts` and `run-forge-projections.ts`, plus tests.
    `reconcile.ts` is unchanged.
  - The hand-over is in the side-session notes folder (`forge-math-lane-handover-2026-11-16.md`, a per-player file,
    and `forge-math-probes/`).
  - Lane checks: `lib/projections` 1918 passed and 23 failed, all 23 oracle comparisons; typecheck 0.
  - **After the capture closes, bring TJ one pop-up:** the candidate plus the oracle diff. Flag these points:
    - Team goals move by up to ±0.005 and goalie win probability by ±0.0005, where TJ said "unchanged" (rounding of
      rescaled player rows).
    - L1 adds about 7 reads per game per run, about 140 for a 14-game slate.
    - The Utah 11-16 numbers are an illustrative range, not a replay. Sergachev 36.2 → about 27.5–30.2 min.
  - Then:
    - merge onto octoberBranch;
    - regenerate the diff on the merged tree;
    - re-record with `RECORD_FORGE_ORACLE=1`;
    - check against the lane's list;
    - rerun parity with recording off.
- 18:20Z: lane results, all on octoberBranch, not pushed; the commits were checked to exist.
  - **Pipeline:** C2 `a516725cd`, H1/M5 `3dc9ae1ba`, M4 `2f8d11dbc`, L2 `dd1f73575`, plus `a1235b83f`.
  - **Gate guard:** `114494bf7` and `b7f107043`. Production builds now stop on an unlisted closure or a missing SHA.
  - **Read paths:** `43a512348` and `dcca667fb`.
  - **RSO:** #457 is merged to master as `a093e4da3`. The follow-up `fcffe5777` (Best Fit exclusion) is on
    octoberBranch only, and the session is waiting on TJ.
  - **Math:** parked at `d578bfe80`.
  - **Start Chart filter:** L2 makes Start Chart's `.lte("updated_at", endOfTargetDate)` filter live, so I relayed
    the fix to the read-paths lane, which owns `start-chart.ts`. It must ship with L2.
  - **Next release:** pipeline, gate guard and read paths together. It needs a re-verified allowlist entry for the
    new closure (`8461033…` or later), because the gate guard fails an unlisted production build. It also needs TJ's
    push approval, and must merge by 21:45Z or wait until after the capture.
  - The math lane's two TJ-approved Utah reads went through `ro_sql.py` (log lines at 17:56Z; count 112).
- 18:35Z: RSO injured display is live.
  - #457 (`a093e4da3`) and #458 (`179befb34`, TJ asked for it in chat and approved it in a pop-up) are released.
  - Verified: origin/master is `179befb34`, and `dpl_3Ea6hJhC7cFK9gqwrkfBXm4A3gXS` is READY and aliased to
    fhfhockey.com.
  - The lane reports the other 3 projects cancelled each time and the smoke tests passed. Its lease is released.
  - octoberBranch is not synced. `9abf48330` and `fcffe5777` duplicate master; I sync at my next release.
  - Open design point for TJ before the reserve flip: a conditional (reserve) line stays uncounted even after Yahoo
    clears the player, because of the bridge's `allowedUses` rule, pinned in `planning.test.ts`.
- 18:45Z TJ: "Release by 21:45Z". This releases the pipeline, gate guard and read paths.
  - **Candidate files:** 36 files from the 10 lane commits. Since `b698aae04`, no foreign commit touches them, and
    master `179befb34` has the same bytes as `9b3575f8a` for them.
  - **C1 `43e9dcdcf`:** master plus the lane blobs. Verifier VERIFIED: closure `a6a3bb7a…`, 239 modules, 0 findings,
    scripts unchanged. Receipt sha256 `15676f4f…`.
  - **Allowlist entry:** committed on octoberBranch as `2ba720742`.
  - **C2 `8deee9383`:** C1 plus the allowlist entry, test row and receipt (parent C1, so a pushed chef branch keeps
    C1).
  - **Export gate:**
    - closure `a6a3bb7a`;
    - the build gate passes with a SHA and stops without one (`commit_sha_missing`);
    - eslint 0, typecheck 0;
    - full Vitest running.
  - TJ, mid-turn: Best Fit still ranked an Out player at #2 with zero gain. I relayed this to the RSO session with
    TJ's words: fix it for points and categories, add a regression test, and get TJ's pop-up before any push. Its
    release goes after mine.
- 19:10Z #459 is released.
  - **PR:** chef/forge-audit-fixes-20261116 → #459, merged as `adbd5ebba` (tree = C2 `8deee9383`). The branch push
    had no build or checks after 90 s.
  - **Vercel:** `dpl_ERYexrWt25PMTAWjGYvFGXWpkmAq` READY at about 19:03:40Z, aliased to fhfhockey.com, and the other 3
    projects CANCELED.
  - **Build log:** "FORGE build admission (VERCEL_ENV=production): closure a6a3bb7a… is verified; runs stamp
    adbd5ebba…".
  - **Gate:** typecheck 0; eslint 0; Vitest 20,509 passed and 25 failed in 8 files, none from the change:
    - six need `.git` and pass in the checkout (191 tests);
    - the ArticleReader test fails the same way on a master export (symlinked `node_modules`);
    - `requestBudget` is a load flake that passes alone.
  - **Smoke (3 sequential GETs, all 200, run `26373189`):**
    - `forge/players` returns 69 of 69 skaters (was 46), with no fallback;
    - Start Chart: 79 players, 2 games, goalie rows 4/2 and 2/2;
    - `forge/goalies`: 9 rows.
  - **Sync:** octoberBranch is synced locally with an ours-merge, `b46a22006`. The tree is unchanged, and all 32 files
    that differed already held master's bytes in their history. Not pushed.
  - **Unexplained push:** someone in this checkout pushed octoberBranch at 18:56:19Z (tip `8023296da`, an RSO lease
    commit). It made no Vercel deployment and no GitHub checks. I didn't make it; flagged to TJ.
  - The RSO session was told #459 is READY. Its Best Fit fix (`9fec8a527`) builds on `adbd5ebba` with TJ's approval.
- 19:20Z: #460 (RSO planner search, Out free agents) is live as `2b8651da8`, `dpl_2P2DYb2viF2KE1zT2TUwyUQ9TdUD` READY at
  19:11:14Z (verified).
  - Another session then released #461 (news lineup cards) as master `5ff5a2908`. It wasn't mine.
  - Its `linesCccIngestion.test.ts` change equals octoberBranch `010770ee7`. The merge-file conflict comes only from
    the unreleased team-matching commit `2786b0f0f`, and the `.ts` file merges cleanly to octoberBranch's version.
  - Re-synced octoberBranch locally with an ours-merge onto `5ff5a2908`; the tree is unchanged. Not pushed.
- Fix-phase notes: before adding injured players to the run, check whether team TOI or usage is shared across the
  projected roster (adding them would dilute healthy teammates). Check leases before touching RSO files.

## Blockers and approvals
- Fixes that touch production (migrations, cron or schedule changes, deploys, pushes) need TJ's own approval.
- The FORGE capture run tonight (candidate `bc13b523e`, a frozen export) is unaffected by local edits.

## Gotchas
- The advisor tool forwards the whole transcript, so it cannot be blinded. The blind pass is a fresh Fable agent.
