
## R8 follow-up (2026-10-20, Chef): resume must not cross the release fence
- F1 committed by Chef as a5b65d319. Hosted run c29b3307 carries git_sha 986144844. Master is now 986144844 (R7 live, includes F2 and TOI).
- Gap: claimResumableRun adopted any paused row in its scope (ec099f48, local:unknown, was finished by a later invocation).
- Choice: a mismatched paused row is skipped (the same rule as other-scope paused rows), neither failed nor treated as 409. Failing it would let localhost write status=failed onto hosted work; a 409 would let one stray local pause block the hosted cron for up to RUN_RESUME_MAX_AGE_MS (2h). The skipped row ages out through the existing stale cleanup.
- RED (octoberBranch): resume.test hosted-meets-local and local-meets-hosted fail; the two matching cases pass. GREEN: 6 files / 66 tests.
- Next: master export on 986144844, regenerate the patch, apply-check, guard, tests, tsc under the lock.
- Master export scratchpad/master-r8 (986144844, web tree d6111d15). The old F1 patch applied with 3-way, no conflicts. RED: 2 mismatch cases fail; GREEN: 26 files / 590 passed, 7 skipped.
- Patch regenerated on 986144844 (15 files, +351/−37, no external_fantasy strings); apply-check OK; guard PASS b4e972fbe. eslint clean. tsc running under the lock.
- tsc (master-r8, lock held then released): EXIT 0. DONE; handed to Chef, nothing committed.
