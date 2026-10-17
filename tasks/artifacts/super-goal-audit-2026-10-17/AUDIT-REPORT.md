# Super Goal completion audit — 2026-10-17

**What was audited:** `tasks/TASKS/super-goal/tasks-prd-fhfh-comprehensive-completion-audit-optimization.md`, the same file as `~/Downloads/…` (byte-identical).
- It holds 5,177 checkboxes: 5,104 marked done and 73 open.
- Of those, 5,011 rows are copied in from 76 source task lists, 138 are master tasks and 27 are master NEW-0xx findings.

**Tree audited:** octoberBranch `ceceb407a` plus about 100 uncommitted files from parallel sessions. Production is `457435eb`.

**Method.** Everything was offline and read-only. There were no database, Vercel or provider requests, and no code changes.

| Layer | Scope | Result |
|---|---|---|
| 1. Mechanical parity (`ledger_parity.py`) | All 5,011 copied rows vs their source files | **0 state mismatches.** 4,950 rows match by position or number, 58 were rewritten in the source, and 138 source rows are absent from the master (see §3) |
| 2. Cited evidence | 454 paths, 40 commit SHAs and 2 migrations named by done rows | 15 paths are missing (13 are files deliberately deleted in March 2026, 1 is a removed secret file, 1 was never at that path). 2 SHAs (`357d69c78`, `92cfab267`) are absent from the repo |
| 3. Full Vitest run | 958 files, 10,206 tests | **10,147 pass, 9 fail in 2 files** (§2.6) |
| 4. Deep verification | 9 Sonnet workers (high effort; Chef at xhigh), risk-selected rows | About 620 rows judged against current code, tests and production bytes. Findings: `findings/G*.md` |
| 5. Chef spot-checks | The 10 most severe worker claims | 10 of 10 confirmed in code |

The deep sample was chosen by risk: master parents, P0/P1 rows, rows whose code changed after completion, then a spread sample. So its contradiction rate overstates the error rate across all 5,104 done rows. It is a reliable list of real problems, not a statistical estimate.

## 1. Verdicts

| Group | Done rows | Judged | Verified | Contradicted | Regressed | Stale evidence | Needs prod read |
|---|---|---|---|---|---|---|---|
| G1 Auth, Draft Ranker | 269 + 3 master | ~62 | ~36 | 6 | 5 | 3 | ~12 |
| G2 Cron, NST, Lines, GDL | 431 + 5 | 67 | 36 | 8 | 7 | 9 | 7 |
| G3 Rankings, rolling metrics | 948 + 8 | 70 | 56 | 4 | 4 | 2 | 4 |
| G4 Underlying stats, site, style, Game Grid | 639 + 17 | ~75 | ~46 | 3 | 14 | 4 | 5 |
| G5a FORGE model, Start Chart | 364 + 7 | 58 | 28 | 5 | 10 | 12 | 3 |
| G5b FORGE dashboards, Command Center, Trends | 556 + 15 | 85 | 49 | 5 | 3 | 22 | 6 |
| G6 Sustainability, variance, sKO | 681 + 14 | ~109 | ~62 | 8 | 0 | ~20 | ~16 |
| G7 xG, game prediction | 596 + 11 | 56 | 30 | 5 | 0 | 11 | 10 |
| G8 Draft, Yahoo, cleanup, DRM | 473 + 8 | 45 (some cover clusters) | 24 | 2 | 1 | 11 | 7 |
| **Total** | **~5,000** | **~627** | **~367 (59%)** | **46** | **44** | **~94** | **~70** |

The worker files hold every row id, ledger line and file:line citation.

## 2. Problems, by severity

### P1: wrong in production now

1. **Sustainability scores cover only players 0–249 on every new-data day** (G2, G6; fix uncommitted).
   - `web/lib/sustainability/incremental.ts:34-68` is identical at HEAD and in production, and dates from `fbaf45caa` on 2026-07-23.
   - After the offset-0 call writes the new cutoff, the offset-250 and offset-500 calls return `source_already_processed`.
   - This contradicts 4.2 "B-SUST-BAR complete 95/95" and 5.7.27 "bounded/paginated readers and writers", plus barometer C0044, C0045, C0053 and C0090.
   - The fix in the working tree has one residual weakness: the batch counts as current once any one player's cutoff reaches the source date. The three offsets also cap coverage at 750 players.
2. **`update-shift-charts` has failed 14 of 14 days** (G2, G8; fix uncommitted).
   - `web/pages/api/v1/db/shift-charts.ts:742` takes the first Yahoo row with a matching name. Two Elias Petterssons make it throw and abort the run.
   - This contradicts DRM NEW 48.0 and the relationship-position closure in 4.13.
3. **Rolling-metric fields the Trends page reads are pruned** (G3; needs a production read to confirm impact).
   - Since `a8e1f5495d` (2026-06-11), the writer nulls `*_avg_*`, `*_last3`, `*_all`, `*_3ya` and `*_career` in the wide table (`fetchRollingPlayerAverages.ts:392-403`) and moves them to a sidecar table that only FORGE reads.
   - The Trends player page still reads the wide row, so those windows render empty. `trendsDebug` reports false mismatches.
   - This contradicts 5.2.7 and rolling RB 4.6, PR 4.2 and PR 2.4.
4. **Release risk on octoberBranch only: the canonical FORGE readers would serve nothing over production runs** (G5a and G5b, found independently).
   - `7f094c8e6` makes `forge/players`, `forge/goalies`, `projections/*`, `apiHelpers` and the legacy Start Chart path require `external_fantasy_input_contract = excluded_from_native_inputs_v1`. Production runs never carry that label.
   - This contradicts 5.7.6 and 5.7.23 for the branch.
   - **Correction after the serving-fix session's check** (`forge-serving-release-review-2026-10-17/BLOCKERS.md`, "B1 side effect"): the release slice keeps `forge/players`, `forge/goalies`, `projections/*` and `requireLatestSucceededRunId` at production bytes, so a release leaves them unaffected. Only two things change:
     - The slice's legacy Start Chart gate (`start-chart.ts:911-913`) drops unlabelled runs, so Focused Slate, `/trends` projections, `SlateStripCard` and `TeamPowerCard` would render degraded.
     - Production `run-projection-accuracy` would return 422 daily.
   - Whether to serve unlabelled runs flagged as unverified instead is a decision for TJ.

### P2: claimed done, but wrong or unsafe

5. **The game-prediction forecast cron is active and reports success while writing nothing** (G7).
   - `web/vercel.json:91` runs it daily, and pg_cron jobs 383–387 are active.
   - With zero production model rows, `workflow.ts:756-784` refuses to persist, yet `forecast.ts:82` returns `success:true`.
   - This contradicts 5.7.9 and row 14.0, which call the cron inactive.
6. **The xG leakage fix doesn't gate promotion** (G7).
   - `missReasonBucket` and `isShortSideMiss` are blocked only in `lib/xg/baselineDataset.ts:239`. Approval eligibility and the artifact feature audit don't check them.
   - The approved pre-fix artifacts `cfg9bac2706` and `cfgf81a5112` stay eligible, and the champion was left unchanged.
   - This contradicts 5.7.12.
7. **Security boundaries that 6.3 records as closed** (G1, G2, G3, G5b):
   - `web/pages/api/createComment.ts` writes to Sanity with the privileged token, with no auth, validation or rate limit, and returns the raw error.
   - `web/pages/api/fetch_team_table.ts` is an unauthenticated proxy that spends the shared NST key and interpolates unvalidated query values into the URL (L112).
   - Browser roles hold full grants on `connected_accounts`, `external_*` and `provider_sync_runs`, so any user can insert a `connected_accounts` row and claim another person's Patreon or Yahoo identity.
   - The token-vault `private` schema exists only in `supabase/migration-archive/`, so a fresh migration replay breaks every token write.
   - Patreon now unlocks Draft Pro and in-season features (`lib/draft-pro/server.ts:22-33`), and ESPN and Fantrax credentials are now stored. Both may be intended product changes, but the "account-linking only, store no credentials" claims (27.3, 41.0, 42.0, 25.1, 26.1) are false and no approval is recorded.
   - Raw `error.message` still reaches clients on 500s from `trends/team-power`, `goalie-power`, `team-sos`, `player-trends`, `forge/runs/[runId]` and the contextual-rankings routes.
   - The IFTTT receivers accept the shared secret in the query string.
8. **Reads described as "complete and paginated" can skip or duplicate rows** (G3, G4, G5b). This contradicts 5.2, 5.3.2 and 6.2.
   - The team summary sort (`teamStatsQueries.ts:838`), `teamMatrix.ts` and `goalieMatrix.ts` don't break ties on a unique key, and `deploymentTiers.ts:489` has no order at all.
   - `goalie-power.ts` requests 2,000-row pages and stops at the first short page. If production keeps the 1,000-row limit set in `supabase/config.toml`, it stops after one page.
9. **FORGE values are made up** (G5a):
   - `forge/goalies.ts:438` turns a null win probability into 0, then normalizes win probabilities from starter weights.
   - `start-chart.ts:739` adds whichever parts are present, so partial goals, assists and PPP are scored as complete.
10. **`fullRefresh=true` defaults to `rpc_truncate`** even with `dryRunUpsert`, `maxPlayers` or `playerId` set, and has no confirmation step and no test (`fetchRollingPlayerAverages.ts:4224-4248`). It is admin-only. This contradicts 5.2.6.
11. **Cron inventory and report drift** (G2).
    - 58 pg_cron jobs are active live, against 55 in the schedule doc; jobs 394, 396 and 397 are missing from it. `vercel.json` has 27 crons, where the claims say 65 + 20.
    - The report email has 2 of its 5 specified sections, and its "Last Success" column covers only 24 hours.
    - Job 234 is now inactive, so EML C0005/C0007 and SCH C0042 are false.
12. **Clean-history claims have regressed on octoberBranch** (G8). `7f094c8e6` committed a 79 MB npm cache (482 files), Playwright output and `supabase/.temp` files. This matches release-ledger request C2.
13. **Other P2:**
    - The game-prediction feature set kept version v5 through two meaning changes (`5740289cc`, `f85167732`).
    - The sustainability `runAll` drift and quintile jobs 370–372 are inactive, so the claimed nightly drift check doesn't run.
    - Old tests that were claimed are missing: the TOI and shot reconciliation test, deleted in `7d72524715`; `MetricPopover`; and the goalie-power and team-sos API tests.

### P3 (abridged; see the worker files)

- **Interface removed after being marked done:**
  - Game Grid "Keep exploring" links (`f90bb13cd`) and WiGO links (`15caa26eac`).
  - The Underlying Stats landing modules (`25c89d795`; the owner has since superseded them).
  - Goalie and Start Chart pieces (`be1aaa0b06`, `25c89d795`).
  - The old FORGE dashboard, now a redirect, which several rows still call the "rollback route".
- **Stale counts in master text:**

  | Item | Master says | Actual |
  |---|---|---|
  | 4.9 | 60/72 | 65/72 |
  | 4.13 | 95/111 | 99/111 |
  | 3.14 / 3.15 / 3.16 | 228 / 170 / 47 | 231 / 171 / 48 |
  | 3.11 | 80/82 | 83/83 |
  | Runner length | 827 lines | 1,054 |
  | Coordinator budget | 270 s | 210 s |

- **Other:**
  - Raw colors in `PlayerPickupTable.module.scss`.
  - The 4WK shading changed in `fefefe006`.
  - The Draft SHA derivation and "session-local" wording are out of date.
  - About 85 rolling pass-2 artifacts were deleted.

### 2.6 The two failing test files

| File | Cause | Contradicts |
|---|---|---|
| `web/scripts/qualify-native-players-offline.test.ts` (8) | A real defect. The `7f094c8e6` admission gate (`consumerRevisionAdmission.ts:88`) rejects revisions without the external-input label, and the offline harness builds `inputProvenance` without it (`scripts/qualify-native-players-offline.ts:391`). Fix: copy the label from `captured.snapshot.inputProvenance` | The native-qualification claims |
| `web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts` (1) | The ops session's uncommitted `cron-schedule.md` edit marks job 234 inactive. The wrapper test still expects 47 auth findings (now 46). Not an auth regression | 5.1.1, 5.1.2 and DRM NEW 47.0 frozen counts |

## 3. Control-plane accuracy (the list itself)

- **The list stopped tracking work in August.** Its last dated overlays are 2026-08-04, with one each on 08-19 and 10-11. It has no rows for the native FORGE forecasts, the daily pipeline, the catalog head, the walk-forward experiment or the RSO/Start Chart work of Oct 13–17. That work is tracked in the handoff-pack inventory and `tasks/master-reconciliation-2026-10-17/REGISTER.md`.
- **It undercounts open work.** 80 source rows were added after the last sync, and 27 of them are open:

  | Source | Added | Open |
  |---|---|---|
  | Start Chart | 58 | 10 |
  | Projection model | 19 | 15 |
  | NST | 1 | 1 |
  | Prediction engine | 1 | 1 |
  | Cleanup | 1 | 0 |

  So the real open count is at least 100, not 73. A further 36 sKO notes/PRD rows were rewritten in their sources.
- **Two "verified complete" controls are now stale:**
  - 7.1 says every source/master section is exact, which no longer holds (see the two points above).
  - 6.5 cites an all-green suite (Aug 3: 642 files, 3,600 tests); the suite now has 9 failures.
- **NEW-004** (P0 Yahoo key rotation) is closed on the owner's recorded attestation (diary entry, July). Auth NEW 17.0–17.3 (Supabase, Resend, database, Google rotation) remains correctly open.
- **Master parents left open look correct:** 3.1–3.5, 4.1, 4.3, 4.9, 4.13, 5.7, 5.8, 6.0, 7.0, 7.5 and 7.6. Nothing marked open was found to be actually finished.

## 4. What needs a production read (all read-only; about 70 rows)

Consolidated from the worker files, section (d) of each:
- **SQL:**
  - distinct players per day in `sustainability_scores` since 10-01, which confirms P1-1
  - population of the Trends rolling fields, which confirms P1-3
  - count of `forge_runs` with the external-exclusion label, for P1-4
  - the full `cron.job` active set
  - game-prediction model rows
  - grants and RLS on the provider and ranking tables
  - the migration ledger (`20260725223034`, `20260728225806`, `20260729205048`, the three staged FORGE migrations)
  - the hosted `max_rows` setting
  - sKO, sustainability and NEW 15 receipts
- **Vercel:** current production deployment and runtime-error metadata, deployment records for the cited `dpl_…` ids, and env-var presence (names only, for example `PARLAY_API_KEY`).
- **Postgres logs:** `goals does not exist` in the last 7 days.

These need TJ's approval as a bounded batch: about 15 SQL reads plus a handful of Vercel metadata reads, with no application requests.

## 5. How current work maps to the list

| List item | Current work |
|---|---|
| 3.1 A-AUTH, 6.3 | Security-candidates review (SSRF proxy, admin Host, role lookup); G1's new findings belong here |
| 3.2 / 4.1 / 5.1 Cron, NST | Ops cron-health plans P-A to P-K; the job 374 change |
| 3.3 A-GDL | IFTTT R21/R22 guards; P0 IFTTT key rows NEW 13–18 still open |
| 4.2 / 4.3 Sustainability | Today's score-batch fix (P-G), uncommitted |
| 4.13 B-DRM | Today's shift-charts fix (P-H), uncommitted |
| 4.9 B-YAHOO | FORGE v2 Yahoo universe stage |
| 3.9 / 4.6 / 5.7.6 / 5.7.23 Projection V1, Start Chart | Native FORGE pipeline, serving blockers B1–B3/W1, the release-risk check above |
| 4.11 / 4.12 Cleanup | Repo audit (snackbar bundle); release-ledger C2 (cache) and C3 (worktrees) |
| Not in the list | FORGE native daily pipeline, walk-forward closure, RSO acceptance, Vesper, Scout |

## Files

- `ledger_parity.py`, `parity.json`, `evidence.json`: mechanical layers 1–2.
- `findings/G1…G8.md`: per-group row tables, problem write-ups and offline-check lists.
- Full Vitest JSON: in the session scratchpad (not committed).
