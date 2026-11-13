# Next release handoff: goalie item 1 (updated 2026-11-13 ~19:30Z, Chef)

**State:** candidate built and gated locally. **Not pushed or merged.** The push and the merge need TJ's pop-up.
- **Candidate:** `7a3a69ef4daea93e3fb62da00b7973fe263552ea`, tree `4e64689e698fbc514c7e74783fc6611c930bce82`.
- **Parent:** master `ed2002161` (#438).

## 1. Scope (TJ, 2026-11-13)
`fc34b053a` isn't final on its own. Item 1 is the goalie writer and its test, plus the shared `leagueSavePct` helper and its test, taken from Astra's follow-up `0e8d377ae`.

That follow-up also touches item 2, so it was **not** cherry-picked whole. It lives in a separate clone, `/private/tmp/fhfh-goalie-items-1-2-20261113`, branch `chef/goalie-items-1-2`: `ed2002161` → `0658e8da4` (item 1, identical to `fc34b053a`) → `8ca9e6762` (item 2) → `0e8d377ae`. Its objects were fetched into this repo, and no ref was created.

| | Files (all at their `0e8d377ae` blob) |
|---|---|
| **In** | `web/pages/api/v1/db/update-goalie-projections-v2.ts`, `web/__tests__/pages/api/v1/db/update-goalie-projections-v2.test.ts`, `web/lib/projections/goalie/leagueSavePct.ts`, `web/lib/projections/goalie/leagueSavePct.test.ts` |
| **In** | `tasks/` records equal to octoberBranch, with diaries kept at master's |
| **Out** | `run-projection-accuracy` (item 2, both `8ca9e6762` and its `0e8d377ae` part); item 6 `c89ff5d24`; any migration; F11's registry `db0310fa3` |

Checked:
- The candidate's app diff against master is exactly those 4 files, each matching its `0e8d377ae` blob.
- `tasks/` equals octoberBranch apart from diaries, and no diary differs from master.
- No migration is included. Item 6's `20261113190000` (authority 147) stays pending and unapplied.

## 2. What it changes
**Writer** (cron 364, 09:30Z daily, body `{}`):
- Start shares and rates use only games before the target date, and historical identity also comes from before it.
- GSAA uses the season league save % instead of `.900`; when the baseline is a fallback, GSAA is null rather than a guess. `projected_gsaa_per_60` is nullable.
- `start_probability` stays the raw L10 start share, now labelled as such.
- `limit` must be 1–30 (default 30) and all cutoffs are primed in one bounded scan.

**Shared helper** (`leagueSavePct.ts`):
- Only complete, valid goals/shots pairs count: a null goals-allowed is no longer a shutout, and GA > SA is excluded. Excluded rows are counted and reported.
- If the scan hits its 12,000-row bound, it falls back to the labelled prior instead of using a partial sample. At most 30 dates come from one scan.
- `SeasonLeagueSavePct` gains `excludedRows` and `sampleComplete`.
- **It's also read by FORGE:** `stages/goalie-stage.ts:188` and `stages/skater-stage.ts:1960`. So releasing it can change FORGE's league save % input whenever `forge_goalie_game` has incomplete or invalid goals/shots pairs. That's independent of the 09:30Z write.
  - **Measured 2026-11-13 ~19:33Z** (TJ "Run the one count"): one guarded aggregate SELECT after the `pg_stat_activity` check (1 active, not busy). The window was 2025-07-01 to 2026-11-14, **2,764 rows**, far under the 12,000-row bound.
  - **Every row is a valid pair:** 0 null goals-allowed with shots, 0 null shots, 0 goals above shots and 0 negative values. The old and new helpers give identical sums: current season SA 16,983 / GA 1,850, previous season SA 57,742 / GA 6,029.
  - **So the helper doesn't change FORGE's league save % as of 2026-11-14:** the blended value is about .8935 under both. A future incomplete row would now be excluded and counted, instead of becoming a shutout.

## 3. Gate on the exact candidate (clean `git archive` export, `$TMPDIR/gate-item1`)
- **Focused Vitest: 313 passed, 10 files.** The writer has 33 tests, and the helper and its consumers are covered: `leagueSavePct`, `goalieOutcomes`, `goaliePipeline`, `startChartPipeline`, `module-imports`, `runProjectionV2.alignedConversion`, `run-forge-projections.resume`, `nativeInputEligibility`, `nativeGoalAccounting`.
- **Typecheck:** `npm run typecheck`, exit 0.
- **ESLint** on the 4 files: exit 0, no errors.
- **Full gate** (TJ "Full gate, then ask", ~19:34Z):
  - **Vitest:** 19,865 passed. The one failing file is `scripts/blsh/nativeProcessCaptureBootstrap.test.ts` (16 tests), a known export-only failure; it passes 32/32 in the checkout.
  - **pytest:** 213 passed. The 4 git-pin tests that fail in the export pass 4/4 in the checkout.
  - The BLSH scripts and `modeling/` are identical to master.
- **CSS check:** n/a (no `.module.scss` changes).

## 4. Push, merge, watch (one TJ pop-up: "Push and merge")
1. Inventory the 4 linked Vercel projects. Expect 1 fhfhockey build plus 3 cancels: no `functions/` change.
2. Push `7a3a69ef4` as `chef/release-2026-11-13-goalie-item1`, then a 90 s no-build check through the GitHub API.
3. Open the PR, squash-merge, and confirm the merge tree equals `4e64689e6`.
4. Watch the GitHub statuses until settled. **Record the deployed SHA and the time it went live.**
5. **Smoke:** 5 sequential read-only GETs, stopping on the first non-2xx: `/`, `/start-chart`, `/forge/command-center`, `/underlying-stats`, `/lines`. Never call the cron writer or any FORGE route for QA.
6. Ours-merge octoberBranch (tree unchanged), push, and run the no-build check.

## 5. After release (no manual reruns or refreshes)
- **Tomorrow's 09:30Z goalie write is a possible input change to the 10:05Z FORGE run, not a confirmed one.**
  - If #439 is live before 09:30Z, record the deployed SHA.
  - After the 10:05Z run, verify read-only which `goalie_start_projections` rows FORGE actually consumed: the run's recorded inputs against those rows' `updated_at` and cron 364's audit row.
  - Also check which league save % baseline FORGE used (source, excluded rows).
- **Keep that separate from verifying the first FORGE reserve rows** (10:05Z) and cron 283's v4 power write (10:15Z).
- Cron 364's own readback: the newest rows' count, `start_probability` in [0, 1], null GSAA only on a fallback baseline, and the audit's `startProbabilityBasis` = `l10_start_share`.
- Records: a PRODUCTION-QUEUE entry and the debrief release list.

## 6. Item 6 (separate candidate; doesn't block item 1)
1. Codex vets the patch and confirms the migration state.
   - The authority row shows 147 pending.
   - At that time, recheck read-only that the live catalog has no apply.
2. **DB-first:** apply `20261113190000` singly through the session pooler (its own TJ pop-up), with a ledger row and the authority update.
3. Then release `c89ff5d24` plus the reader fixes together, with their own gate and pop-up.
   - Readers: Splits and season bootstrap (no known conflict), the Lines utilities (F8 claims released to Codex in `d9123ac86`) and DRM (a regression test).
   - The migration stays held until those readers pass together.

## 7. Item 6 app candidate (built 2026-11-13 ~19:55Z on #439)
- **Candidate `2681a05bc2d83506999fd0ff44a9ac4199b80e56`** on master `a448842d1` (#439). It takes the composed candidate `a36a878c5`, not `c89ff5d24` alone (TJ).
- **Contents:**
  - all 16 app files from `ed2002161..a36a878c5`, each identical to its `a36a878c5` blob: the readers (`6eaddbddd`: Splits server, surface, page and test; season bootstrap; Lines utilities and test; DateRangeMatrix test; the native-input test) and the nullable writer (`a36a878c5`; its writer files equal `c89ff5d24`'s);
  - the baseline migration test at `d9ac09ca2`, which counts 147 as applied;
  - `tasks/` records, with diaries at master's.
- **Out:** F11's migration `20261113220000` and its writer (no `supabase/` change at all), item 2, and the PP clock registry. The migration needs no rerun: 147 was applied at 19:45:17Z.
- **Gate** (clean export, `$TMPDIR/gate-item6`):
  - 209 focused tests across the 11 affected files;
  - typecheck 0; ESLint 0; no `.scss` changes;
  - full Vitest 19,901 passed. requestBudget is a load flake and passes 21/21 on its own; the BLSH bootstrap file is export-only and unchanged from master.
  - pytest 213; the 4 export-only git-pin tests are unchanged from master.
- **Release** (TJ pop-up): 1 fhfhockey build plus 3 cancels expected. Smoke: `/`, `/splits`, `/lines`, `/lines/EDM`, `/drm`.
- **After release:** the next scheduled `update-stats-job` (*/20) run writes through the nullable writer. Read back read-only that new rows hold null only where the source is unknown, and that readers show those values as unavailable. No manual cron run or refresh.

## 8. Decision 152 writer + registry candidate (prepared offline 2026-11-13 ~20:10Z; not for release yet)
- **Candidate `3244bc944b7850691826dbf915d0df56dff37336`** on master `70ad65546` (#440).
- **Contents:** 9 files at their octoberBranch blobs:
  - F11 Part A `db0310fa3`: `getPowerPlayBlocks.ts` and its test, `ppPenaltySummaryRegistry.ts`;
  - F11 `2bd7e37e1`: the writer `update-power-play-combinations/[gameId].ts` and its test, migration `20261113220000` (inert file), its proof and rollback, and the baseline test at 149 rows (114 applied / 7 pending);
  - records, with diaries at master's.
- **Out:** item 2.
- **Gate** (`$TMPDIR/gate-pp`):
  - 133 focused tests, plus 267 tests for the route, cron and pipeline;
  - typecheck 0; ESLint 0;
  - PG proof RESULT OK;
  - full Vitest 19,887 passed. The failures are all known and outside this candidate's files: ArticleReader and BLSH are export-only and pass in the checkout (34/34); requestBudget is a load flake and passes 21/21 alone.
  - pytest 213 (the 4 export-only git-pin tests).
- **To be rebuilt before release approval:**
  1. F11's batch-route dry-run and concurrency change, plus the refresh runner (in progress);
  2. after migration 149 is applied: authority row 149 applied, baseline test 115/6.
- **Order** (each its own approval):
  1. the migration (`pp-clock-validation-2026-11-13/MIGRATION-149-PACKET.md`);
  2. this release;
  3. the dry run, whose diff goes to TJ;
  4. the refresh (`PP-REFRESH-PLAN.md`);
  5. readbacks;
  6. TJ's decision to serve PP share.
