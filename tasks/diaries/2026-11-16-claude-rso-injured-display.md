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

- 18:00Z committed 9abf48330 (product, 18 files) + 4756fb99d (lease/diary). Screenshot PNGs are gitignored; kept in
  tasks/artifacts/rso-injured-display-2026-11-16/ locally. Candidate c9fb7d8a8 = origin/master 9b3575f8a tree + my
  18 blobs (diff verified). Export gate: closure 9944628e4582 (239 modules, 0 findings); vitest 57 files 1819 pass,
  1 load timeout (1000-player test) passed alone 182/182; eslint 0 errors; pure CSS ok. Typecheck: first run lacked
  repo-root supabase/ in export (46 errors, all x-timeline/fxtwitter imports); rerun with supabase/ waits on heavy lock.
- Vercel baseline: latest prod entries at 9b3575f8a (#456): fhfhockey READY dpl_6gGJpyunQTDoKjecNFGFDSjaryec; cms,
  functions-fhfhockey, fhfhockey.com CANCELED; web/functions projects never deploy. No PR-triggered GH workflows.
- Dev server :3171 stopped by exact PID.

- 18:01Z export typecheck (with supabase/) exit 0, 0 errors. Pushed c9fb7d8a8 -> origin chef/rso-injured-display;
  PR #457 (MERGEABLE/CLEAN, no PR checks). No Vercel deployment / GH status for the SHA at +10s, +30s.
- Smoke plan (<=5 sequential GETs): /roster-schedule-optimizer; its page chunk; webpack runtime; up to 2 dynamic
  chunks looking for "not counted while he's listed". Stop when found.

- 18:02:43Z +99s after push: no Vercel deployment, GH status or GH deployment for c9fb7d8a8.
- 18:03:06Z PR #457 squash-merged: master a093e4da3 (parent 9b3575f8a; tree 9d6038b6 == candidate tree; no AI lines).
  Deployments for a093e4da3: fhfhockey BUILDING dpl_C4ECsYnfF37sfq48wKqbRm9cbCc8; functions-fhfhockey + fhfhockey.com
  CANCELED; cms-fhfhockey building then ignored (GH status success). Watch loop on GH statuses (bounded 25 min).
- octoberBranch NOT pushed or synced (Chef syncs from released master at its next release).

- 18:07:50Z fhfhockey dpl_C4ECsYnfF37sfq48wKqbRm9cbCc8 READY (aliases fhfhockey.com, www); cms-fhfhockey,
  functions-fhfhockey, fhfhockey.com CANCELED; web/functions projects did not build.
- Smoke (4 of 5 GETs, sequential): /roster-schedule-optimizer 200 (title ok); page chunk 200; webpack runtime 200;
  chunk 2623.4d0fc341838feea8.js 200 contains every new string. Stopped.
- Scratch e2e spec deleted; export dir removed; lease RSO-INJURED-DISPLAY released.

## Next
Done. Open for Chef: relay the bridge finding (unconfirmed reserve line stays uncounted after Yahoo clears the player)
to the read-paths lane; sync octoberBranch from master a093e4da3 at the next release; live check with TJ's real
league (no Yahoo calls from this lane); cosmetic polish deferred (grid tag, duplicate value text on the Out card).

## Blockers / approvals
- None. Release done well before the 22:15Z capture window.
- Capture window 22:15Z–03:00Z: focused Vitest only.

## Gotchas
- contributionLedger marks Out game days "unknown" (no receipt); not my file, so roster row gets its own injured line.
