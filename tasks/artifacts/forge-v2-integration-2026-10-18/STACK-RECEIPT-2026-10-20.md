# Native FORGE stack receipt, 2026-10-20 (ticket NATIVE-N2)

**Status:** scratch only. Nothing was applied to the real checkout, and nothing was committed, staged or pushed there. No production, provider, Supabase or Vercel call was made. No publish, CAS, cron or env change.

## Base

- Scratch tree: `git archive 8c6dbfece web supabase migrations sql tasks/artifacts/forge-continuation-2026-10-17/daily-dry-run.ts`, then `git init`, with `web/node_modules` symlinked to the real checkout. `GIT_DIR` was never set.
- The real checkout's HEAD moved to `204232fc1` (Release R7 prep) during the run. All 31 files the stack touches still equal the scratch base in the working tree, so the receipt holds for `204232fc1` too. Re-check right before applying.

## The rebased patch: `02-integration-rebased-v2.patch`

| | sha256 |
|---|---|
| `02-integration-rebased.patch` (old, unchanged on disk) | `3d1e2b0a5d388a31c8a948f63322a25feb6ee6aebcdc68a899231e355868752f` |
| **`02-integration-rebased-v2.patch` (new)** | **`fd16ffd40d0938eeda48aed11725c65f29a9eedb8685d9a13f64f2627d24de5f`** |

- **What changed:** only the sections for `web/lib/rosterScheduleData/planning.ts` and `planning.test.ts`. The other 18 file sections are byte-identical to the old 02, in the same order.
- **Every `+` and `−` line is byte-identical to the old 02.** Only `index` lines, `@@` line numbers and context lines differ. Same totals: 20 files, +285 −61.
- **Why the old 02 failed:**
  - `planning.ts`: the `nativeCatalogHead` import was replaced by the `forecastServingSource` import (source selection), and `nativeCatalog.limitation` became `nativeLimitation`. Both were context lines next to 02's hunks.
  - `planning.test.ts`: the interim FORGE bridge test (`serves interim FORGE daily projections to RSO callers only…`) now sits between `publicOptions` and the catalog `it.each`. That moved one hunk's context, and every later hunk by 21 lines.
- **Kept from HEAD:** `selectForecastServingSource` / `nativeLimitation`, the interim bridge (`loadForgeDailyBridgeForecasts`, `bridged`, and the bridge test), and the injury and objective fields in `workspaceSchema.ts`. 02's `workspaceSchema.ts` hunk (3 rolling model versions added to the enum) applies to HEAD unchanged.
- **How:** in scratch, the two planning sections were applied with `patch --fuzz=3`. Every hunk landed at the intended site (checked by hand). Those two sections were then regenerated with `git diff` and spliced into a copy of 02.
- **Rolling catalog pins under source selection:** `forecastServingSource.ts` resolves pins through `resolveNativeCatalogEnvironment` and blanks them through `unavailableNativeCatalogEnvironment`. 02 extends both through `NATIVE_CATALOG_PIN_KEYS`, so no extra hunk was needed.

## Ordered stack: per-patch results (`git apply --check`, then `git apply`, each committed in the scratch repo)

| # | Patch | sha256 | Result |
|---|---|---|---|
| 1 | `forge-v2-integration-2026-10-18/01-kernel-export.patch` | `37150f8291d7bcfe1562a1de6887fa545fd948ce632a9488287cfc17f1a23d05` | PASS |
| 2 | `forge-v2-integration-2026-10-18/02-integration-rebased-v2.patch` | `fd16ffd40d0938eeda48aed11725c65f29a9eedb8685d9a13f64f2627d24de5f` | PASS |
| 3 | `forge-v2-integration-2026-10-18/03-v2-composition-new-files.patch` | `806ef0ec035e34ccad64723d1a1679e9a9e29bc1afacc617b3dbe5de0694c539` | PASS |
| 4 | `forge-v2-integration-2026-10-18/04-v2-driver-wiring.patch` | `9a1ebfc8caadc4a15e5420724f71ed4aff9f0be9bb7a1b244ceb6a39add1c795` | PASS |
| 5 | `forge-target-scope-fix-2026-10-19/01b-means-only-target-scope-on-v2-01-04.patch` | `1f8c9100eccc12cc1c0886773865107acac40cbff3cadc8b7f1904c3960fb060` | PASS |
| 6 | `forge-target-scope-fix-2026-10-19/03b-v2-inputs-means-only-filter.patch` | `4f6aa8e62e0d6c6d22dbdeb93e0d7626d16a479dc3d23d6ce3909a60be0e8e8f` | PASS |
| 7 | `forge-target-scope-fix-2026-10-19/02-daily-dry-run-publish-dry.patch` | `40f86cf18022825ab8b95e541d6ff2cde6fa1c24f8e2eab40f0d6b2b547c2b13` | PASS |
| 8 | `forge-v2-prerollout-gates-2026-10-19/06-v2-prerollout-gates.patch` | `6e24aaaaa05ee016585aa2c54ed8cb2c8c79c86809f6ee311308a10e5092766e` | PASS (code only; policy terms not decided, see below) |

**Alternative branch (05 in place of 03b), for the comparison only:**

| Patch | sha256 | Result |
|---|---|---|
| `forge-v2-target-scope-fix-2026-10-19/05-v2-inputs-means-only-target-scope.patch` on 1–5 | `77a57163967db183686190e428eec6fc5a93af2d0ec2d2ad47ad8a609b525ac5` | PASS |
| `02-daily-dry-run-publish-dry.patch` on 1–5 + 05 | `40f86cf1…2b13` | PASS |
| **`06-v2-prerollout-gates.patch` on 1–5 + 05 + 02dry** | `6e24aaaa…766e` | **FAIL**: `patch failed: web/scripts/forge-daily-v2.ts:1` |
| 05 on top of 03b | | FAIL (`forge-daily-v2.ts:9`). 03b and 05 are mutually exclusive |

**06 base blobs:** after patches 1–7, all 7 files 06 edits have exactly the blobs that `forge-v2-prerollout-gates-2026-10-19/README.md` lists. For example, `forge-daily-v2.ts` = `ce1dd234…` and `forge-daily.ts` = `c424a3e0…`. With 05 instead of 03b, `forge-daily-v2.ts` is `580decb6…`, which is why 06 fails there.

**Rollback:** `git apply -R` in reverse order (8 → 1), using `02-integration-rebased-v2.patch` for step 2.

## 03b vs 05: recommendation **keep 03b, drop 05**

| | 03b | 05 |
|---|---|---|
| Diff size | `forge-daily-v2.ts` only, +11 −4 | `forge-daily-v2.ts` only, +9 −5 |
| Rule | `excludeMeansOnlyNatives` over the fresh means, with the universe as the roster, after the coverage gates | The same, plus it rebuilds `nativeSelection`/`parents` with `nativeMeansMaterializationPieces` |
| Apply on 1–5 | PASS | PASS |
| **06 on top** | **PASS; 06's base blob for `forge-daily-v2.ts` is the 03b result** | **FAIL** |
| Gate order | 06's README orders the gates inside `inputs-v2` with 03b at step 11, after A-14 | Not modelled by 06 |
| Tests | No unit test of its own. After 06, `scripts/forge-daily-v2.test.ts` (new in 06) exercises `inputs-v2` on the 03b code | None. No test runs `inputs-v2` on the 05 code |
| Replay (v2 Oct 21, publish dry run, retained data) | `v2-replay-20261021-publishdry-receipt-with-03b.json`: **`dry_run`, 0 unbound sources**, 84 rows, 64 selected, 10 excluded, 1,260 participation inputs, 471 parents, 1,324 manifest items, request 37,958,615 B | `v2-replay-20261021-publishdry-receipt-fixed.json`: **`dry_run`, 0 unbound sources**, 84 rows, 10 excluded, 1,260 participation inputs, **469 parents**, 1,324 manifest items, request 37,940,913 B |
| Reporting | `nativeSelected` is the **served** count (64). `coverage.json` holds `means.meansOnlyExcluded` | `nativeSelected` still reports the **pre-filter** count (74). `meansOnlyExcluded` sits at the top level of `coverage.json` |
| B1 (lost templates) | The frozen `participation_template_lost` gate runs first, so a lost template stops the run | Same position. 05's README notes the risk but not the ordering |

**Why 03b.**
- 06 applies only on 03b.
- The Chef register order and 06's README already name 03b; 06's README calls 05 superseded.
- Both replays give the same publish result: `dry_run`, 84 rows, 1,324 manifest items.
- 03b reports the served count honestly.

**05's one real advantage:** it drops 2 parents that only excluded players reach (−17.7 KB request). The closure manifest is the same 1,324 items either way. That saving is not worth rebasing 06. If the request-size margin (64 MiB) ever needs it, port 05's `nativeMeansMaterializationPieces` rebuild onto 03b as a separate small change.

**Replay caveat:** I did not re-run either replay. Both read `/Users/tim/Documents/FHFH-private`, and with 06 applied, both stop early at `means_plan_incomplete` and then `standing_approval_ref_not_pinned` (06 README). The numbers above come from the recorded receipts made on `865cbbf12` without 06. Re-running them on this stack needs the harness updates that 06's README lists.

## Patch 06: open questions for TJ (its terms are not treated as decided)

06 applies and its tests pass, but each gate below encodes a policy choice that TJ has not answered.

1. **A-14, participation-input limit.** The materializer accepts at most 1,500 participation inputs per request. A 62-skater, 7-goalie universe on the rolling method at 20 games is 1,520, so the Oct 27 run would stop at `inputs-v2`.
   - Which fix do you want?
     - (a) Two materializations per day, skaters and goalies (recommended in 06's README).
     - (b) A higher limit, for example 2,000, after measuring a real rolling day's size against the 64 MiB request bound.
     - (c) A shorter rolling horizon, for example 18 games. That changes the approved "next 20 games" method.
2. **A-15, boxscore budget.** A league-wide 14-day window is about 100 final games, against a default budget of 120 requests / 2 MB.
   - Is 120 / 2 MB the budget you approve?
   - If a day exceeds it, should the run just stop (`capture_budget_exceeded`, today's behavior)? Or do you want an approval-ref flag that allows up to 400 / 8 MB?
3. **A-17, means coverage.** By default, every universe member must have fresh means coverage, or the run stops.
   - Should exact coverage stay the rule?
   - Or do you approve a standing ceiling of N uncovered members, for example for a universe above the 100-player means bound?
   - If not, each exception needs its own `--means-ceiling-approval-ref`.
4. **A-18, pinned approval and policy terms.** 06 hard-codes the approval ref `tj-standing-approval-2026-10-17:forge-daily` and a terms hash for each of the 6 policies. Those hashes assume every policy was approved on 2026-10-16 with public uses assignment, totals, comparison and conditional tie-break. Nobody has checked them against the private templates file.
   - (a) Is that the exact ref `outputs-v2` should accept, and no other?
   - (b) Were all 6 policies approved with exactly those 4 uses?
   - (c) Can someone with access to the private templates file confirm the 6 pinned definition hashes and terms hashes (`NATIVE_DAILY_APPROVED_METHODS` in `nativeDailyPipelineV2.ts`)? If they differ, the first live `outputs-v2` stops with `fresh_means_policy_terms_not_approved:<policy>`. That fails closed.

## Checks on the stacked scratch tree (1–8, with 03b)

| Check | Result |
|---|---|
| `npx vitest run` with the ticket's list (`nativeDailyPipeline`, `nativeDailyMeansCapture`, `rollingWindowParticipation`, `rollingParticipationFrame`, `scripts/forge-daily-universe`, `rosterScheduleData/planning`, `in-season/workspaceSchema`, `forecastServingSource`, `rosterScheduleData/forgeDailyBridge`, `lib/rosterScheduleOptimizer/`) | **PASSED: 23 files, 735 tests, 0 failed** (7.8 s) |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`, under `/private/tmp/fhfh-heavy.lock` | **PASSED: exit 0, no diagnostics** (full project, `incremental: false`; 18:58:02Z–18:59:02Z) |
| ESLint | not run (not in the ticket) |
| Offline replays | not run (private data, and they need the harness updates listed above) |

The lock was taken at 2026-10-20T18:58:01Z (free by then; an earlier holder had it from 18:53Z) and released on exit. Logs: scratchpad `vitest-stack.log`, `tsc-stack.log` (empty).

## What this does not establish

- No publish, CAS, catalog head, readback or activation. N1's exit (an offline replay showing zero untargeted sources) is met only by the recorded pre-06 receipts, not by a run on this stack.
- G1 still applies. The rolling reader changes in 02v2 (`planning.ts` and the catalog-head pins) are reader-side. They must not reach master before the writer stamps (G1 manifest §4, step 2).
