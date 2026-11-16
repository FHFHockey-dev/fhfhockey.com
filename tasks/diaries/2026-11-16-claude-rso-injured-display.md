# 2026-11-16 · Claude · RSO injured (Out) player display

## Scope
TJ design: Yahoo Out (IR, IR-LT, IR-NR, O) players keep their projected values on screen, greyed / red injured
highlight with an "Injured · not counted" tag; values stay out of every total, lineup, streaming/BPA pick and
comparison; clearing the status counts the same value again (no projection reload). DTD stays counted, caution tag.
Display must cover normal lineup lines and FORGE reserve ("if he dresses") lines.

## Where
- Checkout /Users/tim/Code/fhfhockey.com on octoberBranch (base HEAD b296d52af). No branch/worktree.
- Owned: web/lib/rosterScheduleOptimizer/{planning,planningTypes,retention}.ts, web/components/RosterScheduleOptimizer/**, their tests.
- Not mine: forgeDailyBridge.ts, contributionLedger.ts, web/lib/projections/**.

## State / checks
- 17:09Z: oriented. Out players skipped at planning.ts:743-770 (plays never built). Forecasts for Out players are
  NOT dropped upstream (no injury filter in rosterScheduleData), so values exist in snapshot.forecasts.
- Reserve lines: stats unknown/zeroed, "if he dresses" line in forecast.conditionalStats, allowedUses none when
  participation unknown (bridgeForecastWire.ts). Lineup lines: stats = expectation.
- Leases: RSO-FLAKE (status active, covers components/RosterScheduleOptimizer/, pinned 10-26) and RSO-MANUAL (idle,
  covers planning.ts) look stale; asking TJ before edits.

- ~17:30Z TJ pop-up: narrow local carve-out (planning.ts, retention.ts, specific RSO components, streamingChain.ts + tests);
  old leases NOT released; IR-slot players unchanged (active/bench only); streaming pool filter approved with regression.
  Recorded lane RSO-INJURED-DISPLAY in CLAUDE-LEASES.json (uncommitted coordination edit).
- planningTypes.ts IS in the FORGE producer closure (goalie-stage -> starterBoardScoring -> type import), so it stays
  untouched; new types live in planning.ts.
- Before screenshots: scratch spec web/e2e/zz-scratch-rso-injured-20261116.spec.ts (untracked, delete at end), isolated
  dev server PID 64406 on :3171 (.next-playwright), shots in session scratchpad/shots/before-*.png.
- ~17:40Z planner done: injuredOutPointsReader + injuredOutWeek (display only), candidateHorizonPoints null for Out,
  streamingChain pool filter. Focused vitest: planning/retention/streamingChain/candidatePlanMetrics 294/294.
- Finding for Chef: an unconfirmed reserve line stays uncounted after Yahoo clears the player (bridge allowedUses none);
  pinned in planning.test.ts.

- ~17:45Z Chef relayed TJ hold on RosterScheduleOptimizer.tsx (+ test): October worktree has uncommitted diffs there.
- ~17:50Z TJ pop-up: land the wiring now (RSO.tsx wiring, CandidateBrowser prop, focused tests) and carry the fix to
  production through normal release checks; no temp edits; don't bundle; pause only for test failure, ownership
  conflict or release approval. Chef handed me the release with its #455/#456 gate (commit-tree on origin/master,
  clean export gate, closure 9944628e4582..., chef/rso-injured-display PR squash; no octoberBranch push/sync).
- 17:55Z UI done: grid bench/held cells show struck grey value (injuredFor), roster Pts struck + OUT chip, Best Fit
  card "not counted" + struck week value, by-player struck Pts + tag; DTD amber caution, counted. Grid row-2 tags
  dropped (no room). After screenshots in tasks/artifacts/rso-injured-display-2026-11-16/. Component tests 443 + new
  (grid 10, roster row 7, card 25) pass; pure-mode CSS check ok.

## Next
Commit locally, build candidate, export gate, PR, merge, verify deploy + smoke.

## Blockers / approvals
- Gate and merge by 21:45Z, else hold until after 03:00Z.
- Capture window 22:15Z–03:00Z: focused Vitest only.

## Gotchas
- contributionLedger marks Out game days "unknown" (no receipt); not my file, so roster row gets its own injured line.
