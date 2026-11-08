# Handoff diary: forge-v1-fix-native-targ (native_target_scope_mismatch publish hold)

> Compiled 2026-10-20 from the session transcript by the orchestrator's helper; not written by the session itself.

Session id: `local_582cd0e7-2c3b-4b01-9044-a2d272230224` ("FORGE v1: fix native_target_scope_mismatch hold"), idle, 600 messages over 2 tasks. Started by Chef `local_4317ea20` (chef-resume-1019). It started `apply-means-only-filter` (`local_50f8bd81`).

## 1. Scope
- The approved FORGE v1 daily live run of 2026-10-19 passed every gate and the independent review, but the publish dry run held deterministically with `native_target_scope_mismatch` (gate at `web/lib/player-forecasts/nativeBaselineCadence.ts:91-95`: every baseline source needs a target matching playerId, nhlPlayerId, teamId and rosterRevision). Nothing was published; no catalog head set. Run record: `tasks/artifacts/forge-continuation-2026-10-17/LEDGER.md` section 13.
- Cause: 9 "means-only" players (75 sources) have native means in the Oct 16 reviewed bundles but no participation template, so no target. The Oct 20 replay never exercised the publish gate (`daily-dry-run.ts` stopped at `validateCadenceCommand`).
- Task 1: prepare patches only (frozen files cannot be edited before 2026-10-20 17:00 UTC). Task 2 (Chef): TJ chose option (a); write patch 03b for FORGE v2 `inputs-v2`.

## 2. Where
- All in `tasks/artifacts/forge-target-scope-fix-2026-10-19/` (committed in `cc3be5c09` on octoberBranch; README and SHA256SUMS there): `01-means-only-target-scope.patch` (v1, against HEAD), `01b-...-on-v2-01-04.patch`, `02-daily-dry-run-publish-dry.patch`, `03b-v2-inputs-means-only-filter.patch`, `replay-20261019.ts`, `v2-replay-20261021-publishdry.ts`, and receipts.
- Competing v2 patch from the sibling session: `tasks/artifacts/forge-v2-target-scope-fix-2026-10-19/05-...patch` (see `apply-means-only-filter.md`).
- Hand-over note in the session's own notes folder (`side-session-notes/local_582cd0e7.../forge-v2-target-scope-fix-2026-10-19.md`).
- Run outputs live in the private FHFH-private folder outside the repo (not listed here).

## 3. State
- Patches are written and verified in a scratch tree only. NOT applied to the real checkout: `excludeMeansOnlyNatives` and `web/scripts/forge-daily-v2.ts` do not exist on octoberBranch (checked by the helper). The v2 integration patches 01-04 (`tasks/artifacts/forge-v2-integration-2026-10-18/`) are also not applied.
- Decision (TJ via Chef, 2026-10-19): option (a), serve only players that have participation targets; "the standing approval covers the narrowed issuance. Apply after 10-20 17:00Z." Option (b) (game-bound targets for means-only players) was not built.
- Final apply order (README): v2 01, 02, 03, 04, then `01b`, `03b`, `02-daily-dry-run`. Do not combine `01` and `01b` (01 is for applying v1 without v2).
- Verified on a clean `git archive` of `865cbbf12` (now behind HEAD `392c02af2`): all 7 patches `git apply --check` and apply in order; 21-file focused Vitest list 983 passed / 7 skipped / 0 failed; full `tsc --noEmit` exit 0 (first run ran out of memory, then passed with `--max-old-space-size=12288`); ESLint 0 on touched files.
- Replays (offline, no network or DB writes): control (Oct 19 reviewed command, unchanged) still holds with 75 unbound sources; with the patches the v1 Oct 19 replay and the v2 publish-dry replay both return `dry_run`, 0 unbound (v2: 84 rows, 505 sources, 100 nulls against a gate of 100). The closure was simulated, the review synthetic, the approval ref a placeholder.
- The unpatched v2 path also held (72 sources, same 9 players); `03b` fixes that (v1 `01b` does not reach v2's fresh-means branch).

## 4. Next
- Chef integrates after 2026-10-20 17:00 UTC. Re-run `git apply --check` on each patch first: HEAD has moved since `865cbbf12` and other sessions are editing `web/`.
- Chef to keep one of 03b or 05 and discard the other folder.

## 5. Blocked / needs TJ
- Blocked until the freeze lifts (2026-10-20 17:00 UTC); at compile time it is about 15:10 UTC.
- v1 live `outputs` needs `--standing-approval-ref tj-standing-approval-2026-10-17:forge-daily` whenever a means-only player exists, or it stops with `reviewed_source_without_input`. TJ/Chef should confirm the standing approval covers a v1 issuance narrowed this way; the 2026-10-19 relay says it does.
- A new reviewer approval is needed (new plan hash). The null gate sits exactly at its bound (100 of 100).
- The standing approval covers v1 runs with cutoffs until 2026-10-27 04:00Z (a later re-run date is allowed; after that it lapses).

## 6. Insights
- Each Oct 16 evaluation policy is `owner_approved` against a hash over ALL its bundle's sources, so dropping any source needs a new policy row for the narrowed set. 5 of 6 policies contain means-only players. Option (a) mints rows citing the standing approval.
- Review item B1 (lost templates): in the frozen branch `assertParticipationCoverage` runs before the filter, so a player who had a template and lost it still stops the run with `participation_template_lost`; no CLI-level test asserts that ordering (review item N4 still open).
- Overlap: v2 patch 04 and v1 patch 01 both edit `nativeCadenceOutputPreparation.ts`; whichever applies second fails, hence 01b.
- Means-only players return on their own once they gain a participation target (filter is by target, not a list); rolling-14d participation after Oct 27 may do that.
- Replays at `tasks/artifacts/<folder>/` import `../../../web`, so scripts must sit at that depth.
