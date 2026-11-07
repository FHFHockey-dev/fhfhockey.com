# RSO-FLAKE diary (2026-10-25, Claude)
- Scope: deterministic fix for `releaseCache is not a function` in web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx (only owned file). No commit.
- Where: octoberBranch, canonical checkout. Receipt: tasks/artifacts/rso-wave1-2026-10-25/FLAKE/RECEIPT.md
- Finding: the eligibility fetch (hooks/useYahooEligibility.ts) is gated on `!!data`, which arrives via mocked executeRosterPlanning → setLoadedData → rerender. Provider fetch is an independent path. Test waits only for releaseProvider, then calls releaseCache → race.
- Next: reproduce under CPU stress / injected delay, then wait for both resolvers.
- Checkpoint: reproduced with an injected 80 ms /data delay (CPU stress alone: 6/6 pass). Fix = waitFor both resolvers. Post-fix: injected 5/5, whole file under 32 burners 5/5 (209), alone 209, eslint clean. sha bede9e5f…f32e. Receipt written.
- State: done, awaiting orchestrator commit. Retire this diary once committed.
