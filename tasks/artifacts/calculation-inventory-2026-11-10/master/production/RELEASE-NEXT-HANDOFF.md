# Next release handoff: goalie item 1 (prepared 2026-11-13 ~19:35Z, Chef)

**State:** checklist only. Nothing is built, pushed or merged. The push and the merge each need TJ's pop-up.

The current base is master `ed2002161` (#438).

## 1. Scope
| | Commit | Files | Why |
|---|---|---|---|
| **Include** | Codex item 1 `fc34b053a` | `web/pages/api/v1/db/update-goalie-projections-v2.ts`, `web/__tests__/pages/api/v1/db/update-goalie-projections-v2.test.ts` | TJ: ready for a candidate. Doesn't wait on item 6. |
| **Include** | records since #438 | `tasks/` only, with diaries reset to master's | The local record commits ride with this release |
| Exclude (restore master's version) | item 2 `284f99045` | `run-projection-accuracy.ts` + test | Issuance contract is separate (TJ) |
| Exclude | item 6 `c89ff5d24` | `update-stats/[gameId].ts`, `gameStatsCompleteness.ts`, `transactionalGameStatsPersistence.ts` + 3 tests | DB-first approval; Codex is vetting the patch and migration state |
| Exclude | F11 Part A `db0310fa3` | `web/utils/getPowerPlayBlocks.ts` + test, `ppPenaltySummaryRegistry.ts` | Inert (no production caller of `buildTeamPpClock`); ships with the PP-share decision |

- **No migrations.** Item 6's `20261113190000` (authority order 147) stays pending and unapplied; its inert SQL already shipped in #437.
- **Unreleased app files on octoberBranch** (verified 19:25Z) are exactly the 13 files of those four commits. There are no uncommitted web changes (only `web/next-env.d.ts`, which isn't part of any release).

## 2. What item 1 changes (Chef read of the diff)
- **Pregame inputs only:** the season and L10 start shares and the rate stats use games strictly before the target date (`<`, was `<=`). The historical team identity also comes from before the date.
- **GSAA baseline:** the constant `.900` is replaced by `getSeasonLeagueSavePct(gameDate)`. That function was already on master (`lib/projections/goalie/leagueSavePct.ts`): this season's league save % before the date, blended with last season's through a 20,000-shot prior, with a labelled fallback. It's memoized per run and as-of date.
- **Labelling:** `start_prob` stays the raw L10 start share, now labelled as such, and the response's observability gains `startProbabilityBasis` and the baselines used.
- **Runtime:** cron 364 runs at 09:30Z with `{}`. It resumes from the last projected date up to today, so it usually covers 1–2 dates. That's 1–2 baseline loads of about 4 × 1,000-row pages of `forge_goalie_game` each. Bounded.
- **Checked here:** 26/26 focused tests pass (`env -u GIT_DIR npm test`). The import closure is on master.

## 3. Confirm with Codex (via TJ) before building
1. **Is `fc34b053a` final for item 1?** The mailbox entry still reads "HOLD pending baseline qualification and runtime bounds", and there's no newer commit.
2. **Baseline nulls:** master's `leagueSavePct.ts` uses `Number(row.goals_allowed)`, so a null `goals_allowed` with shots counts as 0 goals, which inflates save %. If Codex's shared baseline fix is ready, add that commit to this candidate. Otherwise, ship with the caveat recorded.
3. **The FORGE interaction is intended:** tomorrow's 09:30Z write feeds the 10:05Z FORGE run (`goalieStarterMixtures` reads `goalie_start_projections`). Releasing today means tomorrow's FORGE reserve-row readback sees item 1's inputs.

## 4. Build (template: the #433–#438 candidates)
1. Start from the octoberBranch HEAD tree. With `GIT_INDEX_FILE` on a temp index (never `GIT_DIR`), restore master's version of `tasks/diaries/` and of the 11 excluded files above.
2. Run `git commit-tree` on master `ed2002161` with a plain message and no AI attribution.
3. Check the candidate diff against master: it contains the 2 item 1 files plus `tasks/` records, and nothing else under `web/`, `functions/`, `supabase/` or `cms/`.

## 5. Gate (clean `git archive` export; `$TMPDIR/gate-final.sh` adapted)
- Vitest full: re-run any failure alone. The known export-only failures are ArticleReader, the native* offline CLIs, the BLSH bootstrap, the pytest git-pin tests and git-dependent files, and requestBudget is a load flake.
- `npm run typecheck`: read the exit code.
- ESLint on the 2 changed web files.
- CSS pure check: n/a (no `.module.scss` changes).
- pytest: 217.
- **Item 1 fail-first:** with the master writer and the new test, the 3 fail-first tests must fail; with the candidate, all 26 pass.

## 6. Push, merge, watch (one TJ pop-up: "Push and merge")
1. Inventory the 4 linked Vercel projects. Expect 1 fhfhockey build plus 3 cancels: no `functions/` change.
2. Push `chef/release-2026-11-13-goalie-item1`, then a 90 s no-build check through the GitHub API.
3. Open the PR, squash-merge, and confirm the merge tree equals the candidate.
4. Watch the GitHub statuses until settled.
5. **Smoke:** 5 sequential read-only GETs, stopping on the first non-2xx. Never call the cron writer for QA. `/`, `/start-chart`, `/forge/command-center`, `/underlying-stats`, `/lines`.
6. Ours-merge octoberBranch (tree unchanged), push, and run the no-build check.

## 7. After release
- **Cron 364's first write, 2026-11-14 09:30Z.** Read back the newest `goalie_start_projections` rows:
  - row count;
  - `start_prob` in [0, 1];
  - GSAA consistent with a ~.90 league baseline;
  - the audit row's `startProbabilityBasis` = `l10_start_share`.

  Keep this separate from the 10:05Z and 10:15Z readbacks, but note the FORGE dependency (§3.3).
- Records: a PRODUCTION-QUEUE entry and the debrief release list.

## 8. Item 6 (separate candidate; doesn't block item 1)
1. Codex vets the patch and confirms the migration state.
   - The authority row shows 147 pending.
   - The live catalog has no apply. Recheck read-only at that time.
2. **DB-first:** apply `20261113190000` singly through the session pooler (its own TJ pop-up), with a ledger row and the authority update.
3. Then release `c89ff5d24` plus the reader fixes together, with their own gate and pop-up.
   - Readers: Splits and season bootstrap (no known conflict), the Lines utilities (F8 claims released to Codex in `d9123ac86`) and DRM (a regression test).
   - The migration stays held until those readers pass together.
