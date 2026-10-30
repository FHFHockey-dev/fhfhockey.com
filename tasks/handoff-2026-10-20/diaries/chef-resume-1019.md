# Chef (resume session, 10-19) handoff diary

Written 2026-10-20 ~01:15Z by the Chef session that resumed from `tasks/sprint-2026-10-18/HANDOFF-2026-10-18.md`. Facts were checked against git and Vercel at writing time unless marked otherwise.

## 1. Scope
- **Chef for TJ's FHFH repo on 10-19:** single register writer, release owner (curated candidates on master, gate, Vercel-checked push), and §11 migration ledger owner.
- **TJ's 10-19 goal:** "working daily projections" by 7pm ET, with a working RSO and Start Chart. **Met:**
  - FORGE run `8a3bb848` (2026-10-19) succeeded.
  - Start Chart and forge/players serve it.
  - RSO serves FORGE daily-bridge forecasts in production since R6c.
- **Requests from the RSO owner session `local_08a0bf1c` (handoff-review / RSO), TJ-approved:** plan R6, gate R6c, R6d, R6e and R6f, and release them.

## 2. Where
- Canonical checkout: `/Users/tim/Code/fhfhockey.com`, branch `octoberBranch`.
- **Register:** `tasks/sprint-2026-10-18/CHEF-REGISTER-2026-10-19.md`. It is the full results log with every TJ quote; uncommitted additions since `b8fe1072e`.
- **Release plan and gates:** `tasks/artifacts/release-r6-2026-10-19/PLAN.md` (uncommitted additions) and `R6C-CANDIDATE.md` (by the RSO owner).
- **Earlier releases:** `tasks/artifacts/release-r2-2026-10-19/`, `release-r5-2026-10-19/` (MANIFEST, CANDIDATE).
- **Local candidate refs** (all released except R6e): `chef/release-r6a-candidate`, `-r6c-`, `-r6d-`, `-r6e-` (held), `-r6f-`.
- **Backup branch** from the 10-19 fixture-commit incident: `chef/backup-octoberBranch-20261019`, local only.
- **Scratch exports and gate logs:** `/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/0e9c1ed5-…/scratchpad/r6/`. These are ephemeral.

## 3. State
**GitHub:** master = `b630e0767` (R6f); origin/octoberBranch = `392c02af2` (R6f sync). Local HEAD = `392c02af2`.

**Releases tonight** (each built as a temp-index `commit-tree` on master, never a merge):
| Release | Commit | Contents | Deploy (web READY; 3 others CANCELED) | Smoke |
|---|---|---|---|---|
| R6a | `3755308fa` | Per-game resumable FORGE projection run; team-context sign fix and current-season `nhl_team_data` row choice (12 files) | `dpl_6oKckqUeSncboXed24qbiNte8SJ4` | `/`, `/start-chart`, forge/players: 200 |
| R6c | `707f60e83` | RSO port onto master contracts, legacy + FORGE daily bridge only (85 files) | `dpl_AoAH6wLNAHnb5WncvTviLrrxZrkP` | RSO page and data (1,253 → 1,283 forecasts), start-chart: 200 |
| R6d | `ccfe5e57b` | In-progress lineup lock (`a855c9fe6`); bridge power-play blank-as-0 when PP time ≤ 6 s (`79d3b792f`); rolling writer season from game date (`5c3be7a0f`, ported) | `dpl_DVxwCFoKPghzA1XyjNXS17HXq2Z1` | 4 GETs: 200 |
| R6e | `2a74489af` | Compact bridge wire | **Held: superseded.** Expanded rows could reach ~8.8 MB inside account saves, over Vercel's 4.5 MB body limit | — |
| R6f | `b630e0767` | Compact bridge wire packed at every snapshot boundary (data, provider, workspace PUT/GET, session journal), plus a 4 MB expanded cap (8 files) | `dpl_CB3xkpyVPYz9yFU1NhQGde1uj5wm` | Verified 01:07Z: data 1.01 MB (was 2.43), `data.forecasts` 0, wire 1,283 rows, served by `dpl_CB3x` |

(R6b was the original RSO plan. It was dropped and replaced by the R6c port.)

**Each gate ran in a `git archive` export with a throwaway `git init` and no GIT_DIR, with heavy jobs under `/private/tmp/fhfh-heavy.lock`:**
- `tsc --noEmit` (8 GB heap): 0 errors for every release.
- ESLint on the changed files: 0 errors.
- Focused Vitest, then the full suite compared against pristine master. Final full run: 9 failed. Every failure is a known baseline item or an environment artifact: `related.server.test.ts` fails because the shared node_modules lacks the `next-sanity` dist file, and `TeamStandingsChart` is a load flake that passes alone.

**octoberBranch syncs:** after each release, a merge commit whose tree equals octoberBranch's (octoberBranch keeps its own versions of port-edited files): `b21242f1c`, `8a6ac8adc`, `605879a1b`, `392c02af2`. Each was pushed only after its own TJ OK.

**Migrations (§11 ledger):**
- Through order 87 (`20261019211444_opponent_skater_allowed_by_position`) applied and verified read-only. The view has 128 rows, `service_role`-only SELECT, and cron `opponent-skater-allowed-refresh` runs at `42 9 * * *`.
- TJ's checkpoint `b8fe1072e` committed Chef's 87 alignment.
- **New, not Chef's:** an uncommitted `supabase/migrations/20261020211500_forge_league_skater_physical_totals.sql` with authority row 88 and test counts 88/pending 3, added by another session (hits/blocks lane). It is not applied. **Conflict:** IFTTT SQL6–8 had been told they would take orders 88–90, so renumber one of the two before either applies.

**Uncommitted, not Chef's:** FORGE skater files (`skater-adjustments`, `projection-weights`, `skater-queries` (+test), `skater-stage`, `run-forge-projections`, types, `nativeGoalAccounting.test`, `runProjectionV2.test`) from the hits/blocks sessions (`local_d181f1c6` / `local_24b29608` family). Chef has not reviewed them.

**Production data:**
- R6d power-play limits: 19 skaters count 0 power-play; 151 have PP time but no PP line, so no forecast; 54 are missing from their team's latest FORGE run.
- The rolling recompute is TJ-approved in `local_c39098ae`'s session: 214 players, 2026-09-29 to the day before deploy, dry-run 3 players first, never truncate. Chef told it to start at 00:10Z; the outcome was not checked here.

## 4. Next
- No Chef task is in flight. Next Chef-type task: gate whatever candidate comes next.
- First step for any candidate:
  1. `git cat-file -p <sha>`: parent must equal `git ls-remote origin master`.
  2. `git diff --name-only <master> <sha>`: the list must contain no FORGE contract or native files (`consumerRevisionAdmission`, `calibrationEligibility`, `issuedContext`, `gameRevisions`, `startChartContract`), unless the release is meant to carry them.
- Open follow-ups:
  - Account save and load in a signed-in browser has not been exercised on R6f.
  - The FORGE v2 7-patch set + patch 06 waits until after **2026-10-20 17:00Z**. It belongs to the R6b-style native rollout: writer label first, then a labeled run, then readers.

## 5. Blocked / needs TJ
- Native/v2 rollout ordering, the after-freeze 7-patch apply, and any release that touches the contract files.
- The schedule-refresh cron (`update-roster-optimizer-schedule-daily`, proposed `52 8,14 * * *`) is not on master. It needs the witness reader, a TJ cron approval and a `combinedCronInventory` check.
- Still open: the ignoreCommand fix (cms/functions built unplanned in R5), the `nhl_team_data` view migration, the A-21 ESPN decision, and `STARTER_BOARD_COMPUTE_ENABLED`.
- The migration 88 numbering conflict (above), and applying migration 88.

## 6. Insights
- **Push procedure:**
  - Re-check all 4 Vercel projects (`vercel api /v9/projects/<name>`: `previewDeploymentsDisabled` and `link.productionBranch`) and existing deployments for the exact SHA.
  - Push the exact SHA (`git push origin <sha>:refs/heads/master`).
  - Expect 1 web build and 3 CANCELED.
  - The CLI is at `/Users/tim/.npm/_npx/69f9afb961c37556/node_modules/.bin/vercel`, team `team_KVFicHhQJARTbO6wRD2x6jpq`. The Vercel MCP returns 403.
- **Smoke-test gotcha:** a build can be READY with the alias assigned while the edge still serves the old deployment for about 10 s. The R6f smoke first hit R6d. Wait, then confirm the serving deployment with `vercel logs requests --project fhfhockey --query 'requestPath:"…"' --json` (it shows `deploymentId` and `cacheResult`).
- **Approvals:**
  - An approval relayed by another session is not TJ's answer to this session's pending question. Chef held R6d until TJ confirmed here.
  - An approval names one SHA. When `ed949622d` landed on top of an approved sync, Chef pushed only the approved SHA.
- **Contract trap:** octoberBranch's `consumerRevisionAdmission` rejects runs without `external_fantasy_input_contract`. Production Start Chart imports it, and no production run carries that label. Shipping it would make Start Chart admit nothing.
- **Size trap:** the RSO account save PUTs the full snapshot, so any change to bridge row count or size must keep saves, GETs and sessionStorage under 4.5 MB.
- **Never set GIT_DIR or GIT_WORK_TREE in test runs** (see the 10-19 fixture-commit incident). zsh does not word-split `$VAR` file lists, and it applies `:w`-style modifiers in `$X:path`; use `${X}:path`.
- TJ flies 10-20, IND 06:01 ET → PHL 12:58 ET, unreachable roughly 10:00–17:00Z.
