# FORGE v2 pre-rollout gates, A-13 to A-18 (2026-10-19)

**Status:** patch only. It was built and tested in a scratch copy of `web/` outside the repo. Nothing in the real checkout was edited outside this folder. Nothing was committed or pushed, and no network, hosted DB, Vercel, NST or Yahoo call was made.

**Apply after 2026-10-20 17:00 UTC,** as the last patch of the v2 stack. It edits files that are frozen until then (`forge-daily.ts` and the stack's own new files).

The findings are in `../sprint-audit-2026-10-19/CROSS-CHECK-AUDIT.md` (A-13 to A-18).

## Apply order

Apply from the repository root. Run `git apply --check` on each patch first. This is the Chef register's final order (10-19 ~13:40Z) plus 06. `forge-v2-target-scope-fix-2026-10-19/05-…patch` is superseded by 03b and is **not** part of the order.

| # | Patch | sha256 |
|---|---|---|
| 1 | `tasks/artifacts/forge-v2-integration-2026-10-18/01-kernel-export.patch` | `37150f8291d7bcfe1562a1de6887fa545fd948ce632a9488287cfc17f1a23d05` |
| 2 | `tasks/artifacts/forge-v2-integration-2026-10-18/02-integration-rebased.patch` | `3d1e2b0a5d388a31c8a948f63322a25feb6ee6aebcdc68a899231e355868752f` |
| 3 | `tasks/artifacts/forge-v2-integration-2026-10-18/03-v2-composition-new-files.patch` | `806ef0ec035e34ccad64723d1a1679e9a9e29bc1afacc617b3dbe5de0694c539` |
| 4 | `tasks/artifacts/forge-v2-integration-2026-10-18/04-v2-driver-wiring.patch` | `9a1ebfc8caadc4a15e5420724f71ed4aff9f0be9bb7a1b244ceb6a39add1c795` |
| 5 | `tasks/artifacts/forge-target-scope-fix-2026-10-19/01b-means-only-target-scope-on-v2-01-04.patch` | `1f8c9100eccc12cc1c0886773865107acac40cbff3cadc8b7f1904c3960fb060` |
| 6 | `tasks/artifacts/forge-target-scope-fix-2026-10-19/03b-v2-inputs-means-only-filter.patch` | `4f6aa8e62e0d6c6d22dbdeb93e0d7626d16a479dc3d23d6ce3909a60be0e8e8f` |
| 7 | `tasks/artifacts/forge-target-scope-fix-2026-10-19/02-daily-dry-run-publish-dry.patch` | `40f86cf18022825ab8b95e541d6ff2cde6fa1c24f8e2eab40f0d6b2b547c2b13` |
| **8** | **`tasks/artifacts/forge-v2-prerollout-gates-2026-10-19/06-v2-prerollout-gates.patch`** | **`6e24aaaaa05ee016585aa2c54ed8cb2c8c79c86809f6ee311308a10e5092766e`** |

```bash
git apply --check tasks/artifacts/forge-v2-prerollout-gates-2026-10-19/06-v2-prerollout-gates.patch
```

To roll back, run `git apply -R` in reverse order, starting with 06.

## Base blobs

These are the blobs 06 expects: each file as it is after patches 1–7, cut from checkout HEAD `b47c512fb`. Re-check them right before applying, because other sessions may touch these files.

| Blob after 1–7 | File | Touched by the stack? |
|---|---|---|
| `752b903d2ba6863bdf6a1c04358589349b58c1b1` | `web/lib/player-forecasts/nativeDailyPipelineV2.test.ts` | new in 03 |
| `418b50cb5448a6fcc075b24365ca49362ea90e45` | `web/lib/player-forecasts/nativeDailyPipelineV2.ts` | new in 03 |
| `3f7835a92caf44ca3be52e468ac474a2807bdb55` | `web/lib/player-forecasts/nativeInputMaterialization.ts` | 02 (HEAD `907c4a4e…`) |
| (absent) | `web/scripts/forge-daily-v2.test.ts` | new in 06 |
| `ce1dd234866332dd1fcf642568f49124ea6b2d01` | `web/scripts/forge-daily-v2.ts` | new in 03, then 03b |
| `c424a3e05d3e442e2f116e6a4b34cecbfda5c548` | `web/scripts/forge-daily.ts` | 04, 01b (HEAD `f0df9311…`) |
| `78ccbdd7388e2a06282cf7df9f4a87df3f2d246f` | `web/scripts/native-means-capture.test.ts` | no; equals HEAD |
| `46ab8e4ba68a926e001c381e742d2157d43fef53` | `web/scripts/native-means-capture.ts` | no; equals HEAD |

## What 06 changes, by finding

8 files, +428 −22 lines. Of the added lines, 255 are tests, in 3 files (one of them new).

| Finding | Gate (failure reason) | Where |
|---|---|---|
| **A-13** | With `universeThresholds` on and no previous universe (`change` is null), `nativeDailyUniverse` stops with **`universe_previous_required`** instead of counting 0 additions | `nativeDailyPipelineV2.ts` `nativeDailyUniverse` |
| **A-14** | `inputs-v2` checks the participation input count against the materializer's bound before it binds a request: **`participation_inputs_exceed_materialization_bound:<n>`**. The bound is now one exported constant, `NATIVE_MATERIALIZATION_MAX_PARTICIPATION_INPUTS = 1500`, shared by the materializer. **The limit is not raised.** | `assertParticipationMaterializationBound`; `nativeInputMaterialization.ts:100` |
| **A-15** | **New stage `forge-daily capture-v2`** (plan-only unless `--execute true`). For a frozen-window date it uses v1's `dailyCapturePlan` unchanged. For a rolling date (New York date ≥ 2026-10-27), it fetches, in order: the window's schedule weeks (D-14 and D-7), the final window boxscores those weeks list for the **universe's** clubs (`rollingHistoryBoxscoreUrls` now has a caller), the weekly schedules from D, and then each universe club's official roster. Club abbreviations come from the captured schedules. Rosters and schedules use v1's collector; boxscores use the means collector's allowlist and budget (120 requests / 2 MB by default). It writes `receipts.json` with `version`, `method`, `date` and `weeks`. **The means CLI now reads the `universe.json` document** through the same `nativeDailyUniverse` gate (thresholds off, U3 still gates) | `nativeDailyRollingCapturePlan`, `nativeDailyCaptureMethod`; `forge-daily-v2.ts` `capture-v2`; `native-means-capture.ts` `universeOf` |
| **A-16** | `inputs-v2` restores v1's **`capture_differs_from_plan`**. The capture must hold exactly the planned URLs for the run's participation method: v1's plan for frozen; the rolling plan, rebuilt from the captured schedules, for rolling. When the capture records `weeks` (capture-v2), a dropped *last* week fails too. A capture from v1's `capture` is still accepted for the frozen method; its week count is derived as v1 did | `assertCaptureMatchesPlanV2` (`forge-daily-v2.ts`) |
| **A-17** | `inputs-v2` binds the fresh means with `assertFreshMeansBinding`: <br>• the means cutoff must fall on the run date (New York): **`means_cutoff_not_on_run_date`**;<br>• the means must come from a complete capture plan: **`means_plan_incomplete`**. `means assemble` now writes `plan: { status, inputHash, asOf, pendingRequests }` into `means.json`;<br>• the coverage set must equal the universe on `(playerId, nhlPlayerId, teamId)`: **`means_universe_conflict`** for extra or changed members, and **`means_coverage_differs_from_universe:<n>`** for missing ones.<br>An explicit ceiling, `--means-uncovered-ceiling N`, needs `--means-ceiling-approval-ref REF` (**`means_ceiling_requires_approval_ref`**); both are recorded in `coverage.json` | `nativeDailyPipelineV2.ts`; `forge-daily-v2.ts`; `native-means-capture.ts` |
| **A-18** | `NATIVE_DAILY_APPROVED_METHODS` now pins `standingApprovalRef: "tj-standing-approval-2026-10-17:forge-daily"` and a per-policy **terms hash** (`policyTerms`). It is the hash of `{ version, seasonId, policyVersion, allowedPublicUses (sorted) }`, the fields a fresh policy row carries over from its template.<br>• `outputs-v2` refuses any other `--approval-ref`: **`standing_approval_ref_not_pinned`**.<br>• Before preparation it refuses a second policy or review template for a pinned policy version: **`fresh_means_policy_template_ambiguous`**. It also refuses template terms that differ from the pin: **`fresh_means_policy_terms_not_approved:<policy>`**.<br>• After preparation, `assertStandingApprovalMethods` also checks each minted policy row's `ownerApprovalRef` and terms | `nativeDailyPipelineV2.ts`; `forge-daily-v2.ts` `outputs-v2` |

**Order inside `inputs-v2` after 06:**
1. capture complete;
2. season;
3. run date;
4. universe gates (A-13);
5. means binding (A-17);
6. means identity;
7. participation method;
8. **capture equals plan (A-16)**;
9. participation and its coverage gates;
10. **materialization bound (A-14)**;
11. means-only filter (03b);
12. bind the request.

Every new gate runs before anything is written.

## Which gate must land before which milestone

06 is one patch, so all six gates land together; it must be applied **before the first live v2 run**, the earliest milestone. By need:

| Milestone | Gates that must be in place | Why |
|---|---|---|
| **Before the first live v2 run** (the frozen-window method, from 2026-10-20 17:00Z) | **A-16, A-17, A-18**, plus the A-15 means-CLI change (the universe document, and `plan` in `means.json`) | Without A-16, a capture missing a week or roster is not detected. Without A-17, stale, partial or pending means bind silently. A-17's plan check needs `means assemble` to record the plan status. Without A-18, any approval string and unpinned or ambiguous templates mint policy rows |
| **Before enabling `universeThresholds`** | **A-13** | With the flag on and no `--previous`, the U5 growth gate fails open |
| **Before `rollingFirstIssuance` (Oct 27 run)** | **A-14, A-15 (`capture-v2` rolling plan)**, and the A-14 decision below | With the A-14 gate in place, a 62 skater / 7 goalie universe at horizon 20 (1,520 inputs) **stops at `inputs-v2`**. It no longer fails late at the hosted materializer, but the run still cannot proceed until TJ decides. Without A-15, nothing captures the window boxscores or the non-template clubs |

## Live command changes (after 06)

- **`outputs-v2`:** `--approval-ref tj-standing-approval-2026-10-17:forge-daily`, exactly.
- **`means assemble`:**
  - re-run it with the patched CLI, so `means.json` carries `plan`;
  - pass `--plan plan-final.json` from a capture whose plan is `complete`;
  - pass `--universe` as `universe.json` itself.
- **`inputs-v2`:**
  - `means.json` must be cut off on the run date;
  - an uncovered member needs `--means-uncovered-ceiling N --means-ceiling-approval-ref REF`.
- **Capture:**
  - `forge-daily capture-v2 --universe U --universe-sha256 H --date D [--weeks 8] [--retained R --retained-sha256 H] --out DIR [--execute true]`;
  - `--retained` is required for frozen dates only.
- **The offline replays need updating before they can be re-run on the stack with 06:**
  - `v2-replay-20261021-publishdry.ts` passes `--approval-ref replay:synthetic-standing-approval` and builds `means.json` without `plan`;
  - it now stops at `means_plan_incomplete`, and then at `standing_approval_ref_not_pinned`.
  - They were **not re-run** here, because they read `/Users/tim/Documents/FHFH-private`, which this session may not read.

## Checks (scratch copy, 2026-10-19)

**Scratch:**
- `git archive HEAD` (`b47c512fb`) of `web/` plus `tasks/artifacts/forge-continuation-2026-10-17/daily-dry-run.ts`, which patch 02 edits;
- a throwaway git repo, with `web/node_modules` symlinked;
- a second, fresh copy was used to verify the apply.

| Check | Result |
|---|---|
| Patches 1–7, `git apply --check` then `git apply`, in order | passed |
| 06, `git apply --check` then `git apply` on 1–7 | **passed** |
| New and updated tests **without** 06 (the 06 test files on the 1–7 tree) | **15 failed, 12 passed**: every new test failed and every existing one passed |
| The same 3 files **with** 06 | **27 passed** |
| Focused Vitest list below (22 files: the v2 README's 21 plus `scripts/forge-daily-v2.test.ts`) | **22 files passed; 998 passed, 7 skipped, 0 failed** |
| Full `tsc --noEmit` (`--max-old-space-size=12288`), stack plus 06 | **exit 0** |
| ESLint, the 8 changed files | **exit 0**, no output |
| Offline replays | **not run** (private data; see above) |

**New tests, one or more per gate:**

| Gate | Library test (`nativeDailyPipelineV2.test.ts`) | CLI test |
|---|---|---|
| A-13 | `requires a previous universe before enforcing the growth threshold` | `forge-daily-v2.test.ts` › inputs-v2: `universe_previous_required` |
| A-14 | `stops a rolling universe over the materializer's participation bound offline`: a synthetic 62×20 + 7×40 = 1,520 fails, and 1,500 passes | — (a CLI fixture of 1,520 real rolling inputs was not built; the check is called in `inputs-v2` right after participation) |
| A-15 | `plans the rolling capture from the universe's clubs …` | `forge-daily-v2.test.ts` › capture-v2: plan-only fetches nothing; execute fetches window → boxscores → future weeks → rosters, and the result matches the plan. `native-means-capture.test.ts`: the universe document is read, `means.json` records the plan status, and `universe_owned_incomplete` still gates |
| A-16 | — | `forge-daily-v2.test.ts`: frozen and rolling plan equality with a dropped roster, week (middle and last), boxscore, or the wrong method; inputs-v2 stops with `capture_differs_from_plan` |
| A-17 | `binds fresh means to the run date, a complete plan and the whole universe` | `forge-daily-v2.test.ts` › inputs-v2: stale cutoff, pending plan, partial coverage, and a ceiling without an approval ref |
| A-18 | `pins the standing-approval ref and each policy's terms, and refuses ambiguous templates` | `forge-daily-v2.test.ts` › outputs-v2: an unpinned ref, and duplicate templates |

One existing assertion changed: the U4 threshold test now supplies a previous-universe `change`, which A-13 requires.

### Focused Vitest list (run from `web/` after applying 1–8)

```bash
npm test -- lib/player-forecasts/nativeDailyPipelineV2.test.ts scripts/forge-daily-v2.test.ts scripts/native-means-capture.test.ts lib/player-forecasts/nativeDailyMeansCapture.test.ts lib/player-forecasts/nativeDailyPipeline.test.ts lib/player-forecasts/rollingWindowParticipation.test.ts lib/player-forecasts/rollingParticipationFrame.test.ts lib/player-forecasts/modeledSkaterParticipation.test.ts lib/player-forecasts/modeledGoalieParticipation.test.ts lib/player-forecasts/modeledSkaterParticipationStore.test.ts lib/player-forecasts/nativeBaselinePublication.test.ts lib/player-forecasts/contributions.test.ts lib/player-forecasts/planningContributions.test.ts lib/player-forecasts/gameExpectations.test.ts lib/rosterScheduleData/planning.test.ts lib/in-season/workspaceSchema.test.ts __tests__/pages/start-chart.test.tsx lib/player-forecasts/yahooUniverse.test.ts lib/player-forecasts/yahooUniverseCapture.test.ts scripts/forge-daily-universe.test.ts scripts/run-forge-local.test.ts scripts/qualify-native-players-offline.test.ts
```

```bash
NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit
```

Run both under `/private/tmp/fhfh-heavy.lock`. `qualify-native-players-offline.test.ts` needs a git repo; never set `GIT_DIR` to the real repo for it.

## Open decisions for TJ

1. **A-14: split the request or change the limit.** The gate stops the run; it does not resolve it. I recommend **(a), a split**.
   - **(a) Split into two materializations per run, skaters and goalies (recommended).**
     - The 1,500 bound is not the only limit near its edge. The frozen request is already 40.2 MB for 1,260 inputs against the 64 MiB request bound, and each rolling input embeds its own history.
     - So 1,520 rolling inputs probably press on the byte bound as well, and raising the count alone would likely fail there next.
     - The split needs `outputs-v2` to accept two closure proofs (or a merged proof), plus one more hosted materialization per day.
     - It is effort M, and has to be built and replayed before Oct 27.
   - **(b) Raise the limit,** for example to 2,000. This is only safe with a measured request size for a real rolling day under 64 MiB. It is a change to the materializer's bound, so it needs TJ's approval; 06 does not make it.
   - **(c) A shorter rolling horizon,** for example 18 games: 62×18 + 7×36 = 1,368. This changes the approved "next 20 scheduled team games", so it is a method-level decision.
2. **A-18: confirm the pinned terms.** The pins assume all 6 policies were approved on 2026-10-16 with uses `assignment, totals, comparison, conditionalTieBreak` (`forge-rso-completion-2026-10-15/native-use-policy-proposal.md`). I could not read the private templates file to compare them.
   - If the real templates differ, the first live `outputs-v2` stops with `fresh_means_policy_terms_not_approved:<policy>`. That is fail-closed.
   - Confirm the terms together with the 6 pinned definition hashes, which are still owed.
3. **A-17 ceiling.** Strict equality is the default.
   - Decide whether any standing ceiling is acceptable, for example for a universe above the means bound of 100 players.
   - Otherwise each use needs `--means-ceiling-approval-ref`.
4. **A-15 boxscore budget.**
   - A 14-day window for a league-wide universe is about 100 final games.
   - That is within the means collector's default of 120 requests / 2 MB, at the retained average of 14 KB per boxscore, but with little margin.
   - If it is exceeded, `capture-v2` stops before any boxscore request (`capture_budget_exceeded`).
   - Raising the budget, up to the 400 / 8 MB ceiling, would need an approval-ref flag like the means CLI's. 06 does not add one.
   - The means stage already fetches some of the same boxscores; sharing that cache is a later optimisation.

## Observations, not fixed here

- **The parent count is also near its bound.** The rolling frame adds 2 parents per boxscore, plus schedules and rosters, to the means parents (471 on Oct 21), against the materializer's 1,024-parent bound. `inputs-v2` does not pre-check it.
- **A shared code path.** `capture-v2` for a frozen date and v1's `capture` produce the same URLs; only capture-v2 records `weeks`.
