# FORGE v2 `inputs-v2` target-scope fix (2026-10-19)

**Status:** patch only. Prepared in a scratch tree. Nothing in the real checkout was edited outside this folder, and nothing was committed. No network, hosted DB, Vercel, NST or Yahoo call was made.

**Valid only if TJ chooses option (a)** in `../forge-target-scope-fix-2026-10-19/README.md`: means-only players are not served. **Apply after 2026-10-20 17:00Z**, on top of v2 01–04 and then 01b. Chef (local_4317ea20) integrates.

## The problem

The v2 path held at the publish gate with `native_target_scope_mismatch`. The evidence is `../forge-target-scope-fix-2026-10-19/v2-replay-20261021-publishdry-receipt.json`: 72 seasonal sources had no participation target, all from the same 9 players.

- 01b filters only v1's `inputs` stage.
- v2's `inputs-v2` (`web/scripts/forge-daily-v2.ts`) binds every fresh mean for the whole universe.
- The `freshMeans` branch of `outputs-v2` then issues every one of them.

## The change: `05-v2-inputs-means-only-target-scope.patch`

One file, `web/scripts/forge-daily-v2.ts` (+9 −5 lines).

1. Before `buildDailyMaterializationRequestV2`, `inputs-v2` runs `excludeMeansOnlyNatives` (from 01b) over the fresh means. Its roster is the day's universe rows, and its targets are the day's participation inputs. A mean is kept only when a target has the same `(playerId, nhlPlayerId, teamId, rosterRevision)`.
2. The kept observations go through `nativeMeansMaterializationPieces`, the same function that assembled the means. That rebuilds `nativeSelection`, `parents` and `requiredParents` for the kept players only, so parents reached only by excluded players drop out of the closure manifest.
3. The excluded `(playerId, policyVersion)` pairs are written to `coverage.json` as `meansOnlyExcluded`. Their count is added to the stage result.

**Nothing else changes.**
- `outputs-v2` and the publish gate are unchanged.
- v2 mints its own standing-approval policy rows for each day's candidate, so narrowing the means needs no extra policy handling (unlike v1's `outputs` in 01b).
- The filter works by target, not by a fixed list. A player comes back on their own once they have a participation target, for example under rolling participation after 2026-10-27.

**Interaction with v2 review finding B1 (lost templates):** a player whose frozen template is dropped would also lose their means here.

## Receipts

### Scratch tree

- Built from `git archive HEAD` (`865cbbf12`) of `web/`, with `web/node_modules` symlinked from the real checkout.
- These patches were applied in order with `git apply`, and each applied cleanly:

| Patch | sha256 |
|---|---|
| `01-kernel-export.patch` | `37150f82…3d05` |
| `02-integration-rebased.patch` | `3d1e2b0a…752f` |
| `03-v2-composition-new-files.patch` | `806ef0ec…c539` |
| `04-v2-driver-wiring.patch` | `9a1ebfc8…795` |
| `01b-means-only-target-scope-on-v2-01-04.patch` | `1f8c9100…b060` |

### Checks

| Check | Result |
|---|---|
| `git apply --check 05-…patch` on a clean v2 01–04 + 01b tree | **passed** |
| Vitest: `nativeDailyPipelineV2.test.ts`, `nativeDailyPipeline.test.ts` and `nativeBaselinePublication.test.ts` | **89 passed**, 0 failed (`vitest-focused.log`) |
| ESLint, `scripts/forge-daily-v2.ts` | 0 problems |
| `npx tsc --noEmit` | **not run** (it ran out of memory on the earlier attempt; the replay ran with `--transpile-only`) |
| New unit test | **none added**. `forge-daily-v2.ts` has no stage test to extend. The filter itself is covered by 01b's `excludeMeansOnlyNatives` test, and the stage is covered by the replay below |

### Publish-dry v2 replay

- **Script:** `../forge-target-scope-fix-2026-10-19/v2-replay-20261021-publishdry.ts`, unchanged (sha256 `0c279939…dde8`).
- **Data:** `P=/Users/tim/Documents/FHFH-private/forge-rso-completion-20261016-v1`.
- **Clocks:** 2026-10-21. All flags were off.
- **Receipt:** `v2-replay-20261021-publishdry-receipt-fixed.json`.

| | Control (v2 01–04 + 01b) | With 05 |
|---|---|---|
| `inputs-v2` | 74 selected, 471 parents | 74 selected, **10 excluded** (7 skaters, plus goalies 9682 and 10622), 469 parents |
| Closure manifest | 1,334 items | 1,324 items |
| `outputs-v2` | 74 native inputs, 577 sources, 94 rows | 64 native inputs, **505 sources**, 84 rows |
| Participation | 1,260 entries, 100 nulls | 1,260 entries, 100 nulls |
| Reviewed and cadence validation | 94 / 94 rows | 84 / 84 rows |
| **Publish dry run** | `held`, `native_target_scope_mismatch`, 72 unbound sources | **`dry_run`, no reasons, 0 unbound sources** |

The fixed run made 0 network requests and 0 DB writes.

**Equivalence** (`compare-control-vs-fixed.js`, run against the control plan from the earlier replay):
- The 505 fixed sources are exactly the control's 577 minus the 9 players. Each was compared on policy, identity, target, mean, `cutoffAt` and `expiresAt`.
- The 1,260 participation entries (scope, probability and reasons) are identical.
- The same 5 policies are issued in both runs.

**Replay limits:** the same stand-ins as v2's replay (retained universe, re-stamped capture, history through 2026-10-12). The review is synthetic and the closure is simulated.

## Files

| File | sha256 |
|---|---|
| `05-v2-inputs-means-only-target-scope.patch` | `77a57163967db183686190e428eec6fc5a93af2d0ec2d2ad47ad8a609b525ac5` |
| `v2-replay-20261021-publishdry-receipt-fixed.json` | `231efc1995cf080fdb49aa8beef4ca0e47dac95640e5a9252be458897f550c92` |
| `vitest-focused.log` | `44b6272df41b3a597fde7051d01d63d92a474f96d921212431e54cd698321098` |
| `compare-control-vs-fixed.js` | `ae3953ebc015d29bd70d809a9008d87c867c6f7a61238d6b13d4bb243f84c1c8` |

**Suggested order after the freeze:** v2 01–04, then 01b, then 05. `02-daily-dry-run-publish-dry.patch` (v1 only) can go in any order.
