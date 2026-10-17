# Independent review — known candidate pool and discovery ordering

Recorded 2026-10-16T01:40:51.089822+00:00.

**Verdict: ACCEPT the exact four-path local increment. No severity findings.** This is source/test acceptance for integration review, not authorization to release or make live/provider/account requests. No actual TJ browser/session, schedule inventory or saved-rule state was accessed by this reviewer.

## Exact accepted scope

Candidate manifest SHA-256: `5fc0eb7e5edf5bba41b1bf5ceb206a8b4bec243f79dc8569b675dfeb5fc32b72`.

Intake-relative patch SHA-256: `ec0ee6d3265239c74de4c61124e76756a49fb9961d060745e6e58e0302bc144b`.

```text
cb86658b8a3b3810311e872886741d2098e779ed6b9fd5c6639ab8aa6e6969aa  web/components/RosterScheduleOptimizer/CandidateBrowser.tsx
8000c9329446d17a5cfd203ef12625467dc84c4c54be94fa0e4da25ccb985cb4  web/components/RosterScheduleOptimizer/CandidateBrowser.presentation.test.tsx
9e3ead9f5d69ad918e2ad015465704c9416fc81c72b85fa3c928924ded25be93  web/components/RosterScheduleOptimizer/CandidateBrowser.integration.test.tsx
20990ac63fb31000545e591f9057b5b674a3c57dfc36d968e91f91c8080bc75d  web/lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts
```

Verified all four current pins, all four intake before copies and all six unchanged dependency pins. Applying every unified patch hunk in memory reconstructs the exact four current files. Only CandidateBrowser.tsx changes application runtime. The engine (`0be1217d...`), hook (`6f52be5a...`), card (`ddb6f575...`), main (`faee5d21...`), accepted provider observability (`709b5cba...`) and eligibility normalizer (`12fc3733...`) retain their exact intake hashes. No Git, source edit or shared-boundary mutation was used.

## Source/contract assessment

- `CandidateBrowser.tsx:57–87` counts the deduplicated, non-rostered discovery pool after the existing name/team/position filters. The four mutually exclusive buckets conserve the filtered count. Eligibility requires explicit verification, valid normalized positions and matching skater/goalie class; availability recognizes free_agent, manager_available and waivers, matching the unchanged engine's player availability check. A known waiver state still requires clearance for a legal plan.
- The visible matching/known/needs-verification denominator at lines141–142 addresses the earlier ambiguity. Find & filter distinguishes matching versus whole discovery pool, four input buckets, player facts versus schedule/timing/budget/locks/capacity requirements, and global bounded search selection. A known player's status does not assert a forecast, legal acquisition or retained plan. The existing partial-input reasons remain visible for discovery.
- `compareDiscovery` at lines33–35 orders both-known inputs first, then preserves upcoming-team-game/name/ID order within that group and the remaining discovery group. Lists at lines123–137 retain the previous point-supported and schedule-supported metric buckets and their comparators before unranked cards. By Team uses the metric comparator when a compared representative has an available net metric, otherwise the same discovery comparator. No new numerical score, ordinal for unknowns, net-gain inference or admission permission is introduced.
- Unknown rows remain in the same candidate array and filter controls. Search reaches them directly, and Show more retains expansion/reset behavior. The new test deliberately puts alphabetically earlier unknowns on a team with more upcoming games, then verifies known-first discovery and team-group ordering, searches the197unknown subset and expands it. Input objects are not mutated.
- The actual selected/eligible numbers come from metrics.search, rather than assuming every both-known player is engine-eligible. The unchanged engine independently filters player gates, then sorts by canonical ID and caps selection at40 before bounded proposal/evaluation work. Existing160default evaluations and12charged proposals per selected candidate remain. Timing/budget/legal-plan gates are subsequent checks; the new copy correctly says candidates passing player checks.
- The hook still receives only snapshot and calculation-intent dependencies. Browser search/team/position/Show more cannot expand or replace the worker selection. The new real-hook/structuredClone worker stand-in/actual-engine fixture sends851players (2owned+849candidates), searches known651 outside the selected40 and verifies the same single worker and single packet, explicit outside-set diagnostic, no select/add callbacks, immutable inputs and zero fetch/storage interactions. Native browser Worker construction/packaging and a real account remain unverified.

## Verification evidence and interpretation

Reused the inspected author logs and tests; no passing suite was repeated:

- Final nearest UI run:20presentation +3real-hook/clone-worker integration tests,23passed.
- Two new unchanged-engine cases passed in the retained initial run,34existing engine tests skipped. With synthetic scheduled games and explicit player gates,40known are selected,612known not selected and197unknown filtered. Missing timing/cost/periods yields40no_proposals; separately reviewed synthetic rules yields40evaluated states with retained legal options within the160evaluation bound. This is conditional fixture evidence, not a claim actual eligible count is652 or actual rules are complete.
- Scoped four-path ESLint exit0 with empty log; author whitespace check reported passed. No TypeScript/full compiler, build or browser run was made or inferred.
- Initial red presentation evidence is retained: the new coverage-label assertion failed before runtime changes, while its DOM shows the unknown card leading discovery. The same run's two engine cases already passed, so no engine regression or repair is invented.

The owner-relayed actual observation (849=652both-known+197neither;775unique accepted Yahoo keys=652catalog matches+123unmatched) motivated aggregate fixture sizes. This review did not independently acquire those session facts. The123unmatched Yahoo rows and197unknown local candidates remain separate populations; neither is synthesized into the other. Actual same-day timing/cost/remaining-allowance reports and unresolved reset timezone remain outside this presentation increment.

Exact artifact hashes:

```text
a5daaf25548d882738825ba7b1bf0a16dcb840db3c638729da555ba034f33355 HANDOFF.md
687644a718d5f1055b98f251d596708f71dfeb5b9e4bca4355f91cfe5bd7a1b0 intake.json
906fb7ba6264048da5dc0ff82fd6f963ce42e697508eb80be7643736225d3d4c ui-tests.log
8a9444002930399338c38f6e28b346a3a20a04fc411439f8a2ba01dfe53f8be7 regression-before.log
f5a7abade5e48be25633e336019ab5a090b5db280abce8e5c31d964b6d7a0a8f integration-regression.log
317819e1cd3330caa1b987dbbf0a267fce50e1fd694dacde59fc7ccf3a94993d presentation-regression.log
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 lint.log
```

Remaining limits: source inclusion/release, actual selected-week freshness and acquisition-rule/reset evidence, real-account behavior and qualified forecast consumer readiness require their own evidence/authority. No live source/account/storage/database/provider request, compiler/build/browser/model execution, private outcome read or source edit occurred. Only this exclusive report was written. Actual runtime model/reasoning settings are not exposed and were not verified.
