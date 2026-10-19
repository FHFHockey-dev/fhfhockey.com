# FORGE v1 publish hold (2026-10-19): target-scope fix

**Status:** patches only. Nothing in the real checkout was edited outside this folder. Nothing was committed or pushed, and no network, hosted DB, Vercel, NST or Yahoo call was made.

**Apply after 2026-10-20 17:00Z.** The patches edit frozen run files. Chef integrates.

## Decision and final apply order

**Decision (TJ, 2026-10-19), as relayed by Chef:**
- Option (a): serve only players with participation targets.
- The standing approval covers the narrowed issuance.
- Apply after 10-20 17:00Z.

**Apply order** (from the repository root; run `git apply --check` on each first):

| # | Patch | sha256 |
|---|---|---|
| 1 | `tasks/artifacts/forge-v2-integration-2026-10-18/01-kernel-export.patch` | `37150f8291d7bcfe1562a1de6887fa545fd948ce632a9488287cfc17f1a23d05` |
| 2 | `tasks/artifacts/forge-v2-integration-2026-10-18/02-integration-rebased.patch` | `3d1e2b0a5d388a31c8a948f63322a25feb6ee6aebcdc68a899231e355868752f` |
| 3 | `tasks/artifacts/forge-v2-integration-2026-10-18/03-v2-composition-new-files.patch` | `806ef0ec035e34ccad64723d1a1679e9a9e29bc1afacc617b3dbe5de0694c539` |
| 4 | `tasks/artifacts/forge-v2-integration-2026-10-18/04-v2-driver-wiring.patch` | `9a1ebfc8caadc4a15e5420724f71ed4aff9f0be9bb7a1b244ceb6a39add1c795` |
| 5 | `01b-means-only-target-scope-on-v2-01-04.patch` (v1 rule plus `outputs` narrowing, on top of 04) | `1f8c9100eccc12cc1c0886773865107acac40cbff3cadc8b7f1904c3960fb060` |
| 6 | `03b-v2-inputs-means-only-filter.patch` (the same rule in `inputs-v2`) | `4f6aa8e62e0d6c6d22dbdeb93e0d7626d16a479dc3d23d6ce3909a60be0e8e8f` |
| 7 | `02-daily-dry-run-publish-dry.patch` | `40f86cf18022825ab8b95e541d6ff2cde6fa1c24f8e2eab40f0d6b2b547c2b13` |

- **Do not combine 01 and 01b.** `01-means-only-target-scope.patch` (`5d0a6bb381941b2727447e4ee1bfc6fc008149e2f6bd3bb308b7ee0401e2cbc5`) is for applying the v1 fix without v2. It is not part of this order.
- **To roll back,** run `git apply -R` in reverse order (7 → 1).
- **Live command changes:**
  - v1 `outputs` needs `--standing-approval-ref tj-standing-approval-2026-10-17:forge-daily` when any means-only player exists.
  - v2 `outputs-v2` already passes its approval ref.

**Verified on 2026-10-19, in a clean `git archive HEAD` copy (`865cbbf12`):**
- All 7 patches pass `git apply --check` and then `git apply`, in that order.
- The README's 21-file focused Vitest list: **21 files, 983 passed, 7 skipped, 0 failed.**
- Full `tsc --noEmit` (with `--max-old-space-size=12288`): exit 0.
- ESLint on `forge-daily-v2.ts`: 0.
- Replays: v2 gives **`dry_run`** and the v1 replay of Oct 19 gives **`dry_run`** (see "Receipts").

### What 03b does, and B1

- **What it does.**
  - In `inputs-v2`, it applies `excludeMeansOnlyNatives` to the fresh means (`nativeSelection` and `additionalNativeObservations`), using the universe players as the roster.
  - This is the same rule as v1: keep a mean only when today's participation inputs have a target with the same `(playerId, nhlPlayerId, teamId, rosterRevision)`.
  - The step sits after both coverage gates and before `buildDailyMaterializationRequestV2`.
  - It writes `means.meansOnlyExcluded` to `coverage.json` and the count to the stage result.
  - `outputs-v2` then builds bundles and standing-approval policy rows only for the served means. A policy left with no inputs is not issued.
- **B1 (lost templates).**
  - In the frozen branch, `assertParticipationCoverage(…, lostTemplates)` runs before the filter. It fails `participation_template_lost:<n>` for any universe member that had a retained template but whose identity or roster revision changed.
  - So a lost template still **stops the run**; it does not silently drop that player's means.
  - The filter removes only players who **never** had a template, which are reported, not gated. It also removes, in the rolling branch, players whose coverage rows passed the gate but who have no target of the same identity.
  - The order is shown in the code. No CLI-level test asserts it, because v2 review N4 (CLI tests) is still open.

## The hold, restated

On 2026-10-19 the publish dry run held with `native_target_scope_mismatch` (LEDGER §13).

- **The gate.** `nativeBaselineCadence.ts:91-95` requires every seasonal-rate source to match a target on `playerId`, `nhlPlayerId`, `teamId` and `rosterRevision`.
- **Where targets come from.** Only two places:
  - participation-bundle entries (`entry.input.scope`);
  - game-bound sources (`gameId != null`). The contribution store allows those only for the SOG policy (`contributionStore.ts:129-135`).
- **The 9 players with no target.** 8769, 9392, 9806, 9936, 10134, 10590 and 10637 (skaters, 9 sources each), plus 9682 and 10622 (goalies, 6 each): 75 sources in all.
  - They have native means in the Oct 16 reviewed bundles.
  - They have no participation template in the retained request (`participationInputs`), so `buildDailyParticipationInputs` never builds a target for them.
  - They are not in `inputs/coverage.json`.
- **A hidden constraint.** Each Oct 16 evaluation policy is `owner_approved` against a `candidateInputHash` over **all** of its bundle's sources (`contributionStore.ts:66-84`, `validPolicy` at 190).
  - Dropping any source therefore breaks the policy binding, unless a new policy row is issued for the narrowed candidate.
  - 5 of the 6 policies contain means-only players. `native-goalie-appearance-summary-win-rates-v1` holds only 9682.

## Options considered (TJ chose (a) on 2026-10-19)

That choice decides between the two options below. The patch here implements (a). (b) is not built.

| | (a) Emit sources only for players with participation targets | (b) Emit explicit game-bound targets for means-only players |
|---|---|---|
| Who is served | 9 fewer players today. Their means are not issued until they have a participation target; they come back on their own when one appears (the filter is by target, not a list) | All 67 players with means |
| What changes | `inputs` drops their native selections, so neither the materialization nor `outputs` carry them. `outputs` narrows each affected bundle and issues a policy row for the narrowed candidate, citing the standing approval | A new target source is needed. Either: (b1) new frozen-window participation inputs for the 9, with their Sep 29–Oct 13 appearance labels, which the retained request does not hold; or (b2) a new target-only row kind, which needs gate, publication-kind, loader and consumer changes in `nativeBaselineCadence.ts` and `nativeBaselinePublication.ts` (patch 02 of v2 also edits the latter) |
| Approvals | New policy rows cite `tj-standing-approval-2026-10-17:forge-daily`, scoped to the day's candidate hash, the way the standing approval describes. The policy version, terms and means are unchanged (outputs still checks each reproduced mean against the Oct 16 source). **TJ or Chef should confirm that the standing approval covers a v1 issuance narrowed this way**, since v1 used to re-cite the Oct 16 rows. A new reviewer approval is needed (new plan hash) | (b1) widens the participation population of an approved method, and (b2) is a new method; both go to TJ. Also +180 participation entries; any nulls among them count against the 100-null gate, which is already at its bound, so a gate exception would also go to TJ |
| Consumer impact | None new. Every served player has a participation target, as the gate intends | Means with no participation probability. How consumers handle that is **unverified** |
| Size and risk | 3 frozen files (+56 −16 lines, plus 2 tests), verified offline today | Large; not feasible before the method window closes 2026-10-27 04:00Z without new acquisition |
| Later | After Oct 27, rolling-14d participation (approved; flag `rollingFirstIssuance`) can give some of these players targets naturally. (a) then serves them with no further change | |

**Recommendation: (a)** if TJ is content not to serve means-only players until they have participation. It is small and reversible, keeps every approved method and mean unchanged, and passes the gate offline at today's clocks. If TJ wants them served, (b) is a separate method-level project; (a) can still ship meanwhile.

## Files

| File | sha256 | What |
|---|---|---|
| `01-means-only-target-scope.patch` | `5d0a6bb3…2cbc5` | **Recommended (a), against current HEAD.** `nativeDailyPipeline.ts` (new `excludeMeansOnlyNatives`), `forge-daily.ts` (`inputs` applies it and reports `meansOnlyExcluded`; `outputs` takes an optional `--standing-approval-ref`), `nativeCadenceOutputPreparation.ts` (narrowed bundles and the policy rows), plus tests in `nativeDailyPipeline.test.ts` and `nativeBaselinePublication.test.ts` |
| `01b-means-only-target-scope-on-v2-01-04.patch` | `1f8c9100…fb060` | The same change, rebased onto v2 patches 01–04 (for use after them) |
| `03b-v2-inputs-means-only-filter.patch` | `4f6aa8e6…8e8f` | `forge-daily-v2.ts` only (+11 −4): the means-only rule in `inputs-v2`, on top of 01–04 + 01b |
| `replay-receipt-20261019-full-stack.json` | `f694ab13…dbd1` | The Oct 19 replay on the full stack (01–04, 01b, 03b, 02) |
| `v2-replay-20261021-publishdry-receipt-with-03b.json` | `3fabb04b…105e` | v2 replay with the publish dry run, full stack: `dry_run` |
| `02-daily-dry-run-publish-dry.patch` | `40f86cf1…2b13` | `daily-dry-run.ts` runs `publishObservedNativeBaselineCadence` (dryRun, no client) on the reviewed command after `validateCadenceCommand`, and logs `publishDry`. It passes `--standing-approval-ref`, so **apply it after 01** |
| `replay-20261019.ts` | see `SHA256SUMS` | Offline replay of today's run (control plus fix) |
| `replay-receipt-20261019.json` | `ff953c00…4848` | Replay on 01 alone |
| `replay-receipt-20261019-on-v2-stack.json` | `42d11953…cf5` | The same replay on v2 01–04 + 01b |
| `daily-dry-run-receipt-20261020.json` | `d444820b…61a8` | Patched `daily-dry-run.ts` (01 + 02), Oct 20 synthetic replay |
| `v2-replay-20261021-publishdry.ts`, `v2-replay-20261021-publishdry-receipt.json` | see `SHA256SUMS` | v2's own replay with a publish dry run added (see "v2 also holds") |

### What 01 does

1. **`inputs`.** `excludeMeansOnlyNatives(retained, participation.inputs)` keeps a native selection, an additional observation or an existing input only when today's participation inputs have a target with the same `(playerId, nhlPlayerId, teamId, rosterRevision)`. The dropped entries go into `coverage.json` as `meansOnlyExcluded`, and their count into the stage result. Their parents are no longer reached, so they drop as well.
2. **`outputs` (daily only).**
   - A reviewed source with no input today is allowed only when both hold:
     - `daily.standingApprovalRef` is set;
     - the source's player has no participation target in the proof.
   - Otherwise the stage still fails with `reviewed_source_without_input`. A targeted player can never lose means silently, and non-daily runs are unchanged.
   - A bundle that loses sources is narrowed: new `sourceCount`, `sourceWatermarks`, `rosterRevisions` and `evaluationPolicyId`. It also gets a new `owner_approved` policy row: the template's terms, the new `candidateInputHash`, `ownerApprovalRef` set to the standing approval, and `approvedAt` set to the issuance. That row carries metadata `subsetOfPolicy` and `meansOnlyPlayerIds`. Its pending review is bound to the new `policyHash`.
   - A bundle left with no sources is not issued.
   - Unchanged bundles still re-cite the Oct 16 policy, and the candidate-hash equality check still applies to them.
   - The receipt gains `meansOnlyExcluded: { sources, playerIds }`.
3. **The publish gate itself is unchanged.**

**Live command change:** `outputs` needs `--standing-approval-ref tj-standing-approval-2026-10-17:forge-daily` when means-only players exist. Without it, `outputs` stops with `reviewed_source_without_input`, before review rather than at publish.

## Receipts

### Patch checks (against the real checkout, 2026-10-19)

- `git apply --check` passes for `01-means-only-target-scope.patch` and `02-daily-dry-run-publish-dry.patch`.
- `01b` does not apply to HEAD. That is expected: it needs v2 01–04 first.

### Scratch copy

The scratch copy is `git archive HEAD` (`865cbbf12`) of `web/` and `daily-dry-run.ts`, with `web/node_modules` symlinked.

| Check | Result |
|---|---|
| Vitest, `nativeBaselinePublication.test.ts` and `nativeDailyPipeline.test.ts`, with 01 | **79 passed**, 0 failed (2 new tests) |
| Vitest, the same 2 files plus `nativeDailyPipelineV2.test.ts`, on v2 01–04 + 01b | **89 passed**, 0 failed |
| Full `npx tsc --noEmit` with 01 | Exit 0. The first attempt ran out of memory (exit 134); it was re-run with `--max-old-space-size=12288` |
| ESLint, the 5 changed files | 0 problems |

New tests:
- **Outputs:** a means-only source is refused without the standing ref, and refused on the non-daily path. With the ref, it is dropped and a policy is issued for the narrowed candidate, bound to the review. After a synthetic review, `validateCadenceCommand` admits the plan.
- **Inputs:** the filter keeps only targeted identities, including a roster-revision mismatch, and does not mutate its input.

### Offline replay of 2026-10-19 (`replay-20261019.ts`)

The replay runs at today's clocks: closure 11:53:48.782Z, issuance 12:00:33.671Z, review 12:03:57Z, publish 12:04:26.231Z. It made 0 network requests and 0 DB writes.

| | A. Control: today's `reviewed/cadence-command.json` (`b1a19fb8…`) and `materialize/stage.json` (`49d6d090…`), unchanged | B. Fix: today's `capture/receipts.json` (`e8d17cda…`) and the retained request (`44fd7762…`) through patched `inputs` and `outputs` |
|---|---|---|
| `validateCadenceCommand` | 104 rows | 88 rows |
| Sources without a target | 75 (the 9 players) | **0** |
| Publish dry run | **`held`, `native_target_scope_mismatch`** (identical to the live run) | **`dry_run`, no reasons**, slot `morning:2026-10-19`, 0 attempted writes |

**What B shows**
- `inputs`: `inputs_bound`, same cutoff 11:52:04.734Z, 1,260 participation inputs, 13 native selections excluded.
- Closure manifest: 1,328 items (today: 1,341).
- `outputs`: 68 native inputs, 509 sources, 100 nulls, 88 rows.
- The means are identical to today's minus the 9 players (`sourceId|mean|cutoffAt|expiresAt`).
- The 1,260 participation entries are identical to today's (`hash(input, receipt)`).
- Policies:
  - 4 new policy rows: current-appearance (468 sources), shutout (5), volume (20) and win (5);
  - 1 policy re-cited unchanged: prior-appearance (11 sources);
  - summary-win is not issued.

**Limits of the replay**
- **Why a rebuild.** A fix in `outputs` cannot change a plan that was already reviewed, so B rebuilds today's plan.
- **Stand-ins.**
  - **The closure is simulated** with the materializer's own planner (`prepareNativeInputMaterialization`) at today's closure instant. The real materialize stage is a hosted write.
  - **The review is synthetic.**
  - **The standing ref is a placeholder** (`replay:synthetic-standing-approval`).
- **What a real re-run needs:** the inputs, materialize, outputs, review and publish stages run on its date.

The same replay on v2 01–04 + 01b (`replay-receipt-20261019-on-v2-stack.json`) gives the same result: control held, fix `dry_run`, 0 sources without a target, and means and participation equal to today's.

### Patched `daily-dry-run.ts` (01 + 02; Oct 20 synthetic replay)

- `inputs`: 13 excluded.
- `outputs`: 88 rows, 509 sources, 100 nulls.
- Validation: reviewed 88, cadence 88.
- **`publishDry`: `dry_run`**, slot `morning:2026-10-20`.
- Participation is the same as Oct 16 for 1,152 entries, with 0 probability differences.
- 0 network requests, 0 DB writes.

## Coordination with FORGE v2 (01–04)

- **Overlap.**
  - Patch 04 and patch 01 both edit `nativeCadenceOutputPreparation.ts`: the doc comment, the `daily` type, the `reviewed_source_without_input` line and the receipt.
  - In either order, the second patch fails `git apply`.
  - `forge-daily.ts` merges cleanly (04 only appends dispatch lines).
  - 01–03 do not conflict.
- **Rebase.** Yes, if v2 lands first. Use `01b`, which is 01 rebased onto 01–04 with the conflicts resolved: the means-only check is skipped on v2's `freshMeans` branch, which builds its own sources. It is verified above (89 tests, replay `dry_run`).
  - If the v1 fix lands first, 04 needs the same 4 small hunk merges instead. A rebased 04 was not produced.
  - The final order is in "Decision and final apply order" at the top: 01–04, then 01b, 03b and 02.
- **v2 also holds at this gate (new finding).**
  - `v2-replay-20261021-publishdry.ts` is v2's `replay-20261021.ts` plus the publish dry run. It runs on v2 01–04 + 01b and gives **`held`, `native_target_scope_mismatch`**: 72 sources without a target, the same 9 players.
  - v2's replay also ran only `validateCadenceCommand`, so this was untested there as well.
  - 01b does not fix v2:
    - `inputs-v2` (`forge-daily-v2.ts`, from patch 03) selects fresh means for the whole universe;
    - the `freshMeans` branch issues every selected mean.
  - **Resolved by 03b**, which applies the same rule in `inputs-v2`.
- **v2 with 03b** (full stack; `v2-replay-20261021-publishdry-receipt-with-03b.json`):
  - `inputs-v2`: `inputs_bound`, 64 means selected, 10 selections excluded (players 8769, 9392, 9682, 9806, 9936, 10134, 10590, 10622 and 10637), 1,260 participation inputs.
  - `outputs-v2`: 84 rows, 64 native inputs, 505 sources, 100 nulls (20 withheld for conflicts; 100 gated against a bound of 100).
  - `validateCadenceCommand`: 84 rows. **Publish dry run: `dry_run`, 0 sources without a target.**
  - 0 network requests, 0 DB writes.
  - The stand-ins are those of v2's replay: the retained universe, re-stamped captures, and means with history through Oct 12.
- **v1 Oct 19 replay on the same stack** (`replay-receipt-20261019-full-stack.json`):
  - Control: `held`.
  - Fix: `dry_run`, 88 rows, 0 sources without a target.
  - Means and participation are equal to today's apart from the 9 players.
