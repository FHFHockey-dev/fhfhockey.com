# Capture FORGE inputs only when compute is on (R10) — claude, 2026-10-20/21
Scope: runner captures inputs / takes capture path / saves snapshot only when STARTER_BOARD_COMPUTE_ENABLED; capture=true+compute=false takes resumable claims. News intake untouched. No env change.
Where: octoberBranch tree (HEAD edd53b9da, F4 = 2c69193e4). Master base c2ed28384 (R9 not landed) + R9 FORGE-RELIABILITY-master.patch. Patch -> tasks/artifacts/release-r10-2026-10-21/CAPTURE-COMPUTE-ONLY-master.patch.
State: writing failing tests.
- Change: run-forge-projections.ts captureEnabled = captureFlag && computeEnabled (flag, not canary-scoped compute, so compute-on behaviour is unchanged). starterBoardFlags untouched; news intake untouched.
- Tests: resume test — capture on/compute off takes claim + pauses/resumes, no snapshot, no RPC (red first in both trees); compute on in scope -> reservation RPC + snapshot + publish (passes before/after); compute on outside canary -> old postRun cases. New starterBoardFlags.test.ts (contract news intake reads). octoberBranch 13 files 614/614 incl. news-intake tests.
- r10-export (c2ed28384 + R9 F4 patch): red->green; 9 files 267/268, the 1 fail = update-line-sources fixture under tasks/ not in export (env). Patch tasks/artifacts/release-r10-2026-10-21/CAPTURE-COMPUTE-ONLY-master.patch (3 files) REQUIRES R9 FORGE-RELIABILITY first. G1 guard (current manifest) PASS; check 4 clean. tsc running.
- r10-export tsc --noEmit exit 0, lock released, tree clean. DONE pending Chef; nothing committed.
