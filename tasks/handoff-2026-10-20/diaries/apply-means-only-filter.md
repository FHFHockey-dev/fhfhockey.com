# Handoff diary: apply-means-only-filter (means-only filter for FORGE v2 inputs-v2)

> Compiled 2026-10-20 from the session transcript by the orchestrator's helper; not written by the session itself.

Session id: `local_50f8bd81-8052-42d5-8214-1fffc76bca3d` ("Apply means-only filter to FORGE v2 inputs-v2"), idle, 174 messages. Started by `forge-v1-fix-native-targ` (`local_582cd0e7`), under Chef `local_4317ea20`.

## 1. Scope
- FORGE v2's `inputs-v2` stage (`web/scripts/forge-daily-v2.ts`, from patch 03 in `tasks/artifacts/forge-v2-integration-2026-10-18/`) held at the publish gate with `native_target_scope_mismatch`: 72 seasonal sources from 9 players without participation targets. v1 patch 01b does not cover v2's `freshMeans` branch.
- Task: prepare a patch (scratch copy only, no frozen-file edits, no commits, no network) so `inputs-v2` selects fresh native means only for players with a participation target of the same (playerId, nhlPlayerId, teamId, rosterRevision), e.g. via `excludeMeansOnlyNatives` from 01b. Valid only if TJ chose option (a) (means-only players not served). TJ did choose (a) on 2026-10-19.

## 2. Where
- Patch and receipts: `tasks/artifacts/forge-v2-target-scope-fix-2026-10-19/` (committed in `cc3be5c09`): `05-v2-inputs-means-only-target-scope.patch`, `README.md`, `compare-control-vs-fixed.js`, `v2-replay-20261021-publishdry-receipt-fixed.json`, `vitest-focused.log`.
- Note: `side-session-notes/local_582cd0e7-.../forge-v2-target-scope-fix-2026-10-19.md`.
- Scratch tree, patch and replay output are in the session's scratchpad (ephemeral): `/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/bddb964c-216a-4ced-bfdc-2f3704b4b30d/scratchpad/` (`tree/`, `03b.patch`, `v2-replay-fixed-out/`).

## 3. State
- Patch 05 is finished but NOT applied to the real checkout, and probably SUPERSEDED. Parent `forge-v1-fix-native-targ` was assigned the same patch by Chef (as `03b`) and asked this session to stop; this session had already finished, replied with its summary and stopped. Parent recommended its own 03b (verified through the full 7-patch apply order, 21-file Vitest 983 passed, full tsc exit 0) and left the choice to Chef; which one Chef keeps is unverified.
- What 05 does: one file, `web/scripts/forge-daily-v2.ts` (+9 -5). Before `buildDailyMaterializationRequestV2` it calls `excludeMeansOnlyNatives` on the fresh means (roster = the day's universe), then rebuilds `nativeSelection`, `parents` and `requiredParents` for the kept players with `nativeMeansMaterializationPieces`, so parents used only by dropped players leave the closure manifest. It writes `meansOnlyExcluded` to `coverage.json` and the stage result. `outputs-v2` and the publish gate are unchanged.
- Checks (scratch tree from HEAD `865cbbf12` + v2 01-04 + 01b): `git apply --check` passed; Vitest `nativeDailyPipelineV2`, `nativeDailyPipeline`, `nativeBaselinePublication` 89 passed; ESLint 0 problems; `tsc --noEmit` NOT run (earlier attempt ran out of memory; replay used `--transpile-only`); no new unit test (no stage test exists to extend).
- Replay at 2026-10-21 clocks: before, `held` with 72 unbound; with 05, `dry_run`, 0 unbound; 10 means selections excluded for the same 9 players, sources 577 to 505, rows 94 to 84; participation entries identical (1,260); no network or DB writes.

## 4. Next
- Nothing stated. If Chef prefers 05's cleaner result, the path is to port 05's one rebuild line into 03b (parent's suggestion), re-run the replay and the apply-order check.

## 5. Blocked / needs TJ
- Chef decision between 03b and 05; apply is blocked until 2026-10-20 17:00 UTC (frozen files). Re-run `git apply --check` first (HEAD is now `392c02af2`, not `865cbbf12`).

## 6. Insights
- Difference vs 03b (parent's comparison, unverified): both reach `dry_run` with 505 sources, 84 rows. 03b keeps 2 parents that only dropped players use (471 parents; 2 unused rows in the hosted materialize write); 05 rebuilds so they drop (469 parents). Neither affects served results.
- Replay scripts must sit at `tasks/artifacts/<folder>/` inside the scratch tree because they import `../../../web`.
- Limits (stand-ins): retained universe, history only through 2026-10-12, synthetic review, simulated closure.
- Review item B1 (lost templates): 05's README says a player who loses a frozen template would also lose their means under its rule. 03b's README says its filter runs after the lost-template gate, so such a player still fails `participation_template_lost`. Confirm which holds for whichever patch is kept.
