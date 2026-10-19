# R5 byte manifest (2026-10-19, read at ~13:30 ET)

- Production: `ad93e2887` (R4). Candidate sources: `HEAD` = `b47c512fb` for U1–U3; working tree (`git hash-object`, read at the time above) for U4–U6 and `vercel.json`.
- Method: for every path, the prod blob was rebuilt locally as prod + the unit commit patch(es) (`git diff <c>^ <c> -- path`, applied in order U2 → U1 → U3), plus the HEAD→working-tree delta for U4–U6. **Unit-only = yes** means that rebuild equals the candidate blob byte for byte, so `git diff ad93e2887 <candidate> -- path` holds only R5-unit changes. **NO** means the candidate also carries unreleased hunks from the listed earlier octoberBranch commits. When the unit patch still applies cleanly to prod, "Unit-only blob" is the hash of that rebuild (reproduce it with `git diff <c>^ <c> -- path | git apply` on prod bytes; it is not in the object store). "hand-port" means the unit patch does not apply to prod as-is.
- 97 paths. Machine form: `manifest.json` (extra keys `unitOnly`, `unitOnlyBlob`, `extraCommits`; `vercel.json` has `pendingEdit`).
- Shared files carry several units; the unit column lists all of them, and the candidate blob is cumulative.
- No path is in the frozen FORGE list (`tasks/prd-forge-daily-pipeline.md` "v2 build ownership"). No S-1, shift-charts/HTML-fallback, homepage, NewsFeed, `start-chart.tsx` or `tasks/**` path is in the manifest.

## Per-unit tables

### U1

| Path | Prod blob | Candidate blob (src) | Unit-only? | Unit-only blob | Extra commits in candidate |
|---|---|---|---|---|---|
| `web/__tests__/pages/api/v1/forge/goalies.test.ts` | bd2900bc34 | 31effdbd9f (HEAD) | **NO** | 0123a01d48 | 317f8f57ee, 7f094c8e68 |
| `web/lib/draft-pro/api-tests/private-imports.test.ts` | 67eb16db2c | 492f5dbd36 (HEAD) | **NO** | hand-port | 317f8f57ee |
| `web/lib/draft-pro/privateImportTransport.test.ts` | 6fc70be6c2 | 87af22660e (HEAD) | **NO** | hand-port | 317f8f57ee |
| `web/lib/draft-pro/privateImportTransport.ts` | da6fb311b7 | fe06dfa55d (HEAD) | **NO** | hand-port | 317f8f57ee |
| `web/lib/draft-pro/requestError.ts` | new | ab30399057 (HEAD) | yes | ab30399057 | - |
| `web/lib/draft-pro/server.ts` | 6ca89cf630 | d5c19b5790 (HEAD) | yes | d5c19b5790 | - |
| `web/pages/api/v1/account/draft-pro/private-imports.ts` | 057695f04d | 84142feeb4 (HEAD) | **NO** | hand-port | 317f8f57ee |
| `web/pages/api/v1/account/draft-pro/private-imports/[uploadId]/chunks/[ordinal].ts` | 6b94375798 | 44ba226597 (HEAD) | **NO** | hand-port | 317f8f57ee |
| `web/pages/api/v1/account/draft-pro/private-imports/[uploadId]/stage.ts` | 82f2e91530 | 91fa221e75 (HEAD) | **NO** | hand-port | 317f8f57ee |
| `web/pages/api/v1/forge/goalies.ts` | 8c8465477f | afc9364c10 (HEAD) | **NO** | 3fafc008f7 | 317f8f57ee, 7f094c8e68 |

### U1+U3

| Path | Prod blob | Candidate blob (src) | Unit-only? | Unit-only blob | Extra commits in candidate |
|---|---|---|---|---|---|
| `web/__tests__/pages/api/v1/forge/players.test.ts` | 57e6b945be | e5cf97bb10 (HEAD) | **NO** | 27e214444d | 7f094c8e68 |
| `web/pages/api/v1/forge/players.ts` | c6065c764c | 8171df07bf (HEAD) | **NO** | hand-port | 7f094c8e68 |

### U2

| Path | Prod blob | Candidate blob (src) | Unit-only? | Unit-only blob | Extra commits in candidate |
|---|---|---|---|---|---|
| `web/__tests__/pages/api/Teams/nst-team-stats.route.test.ts` | e1e6ab538c | 09dfbb38ff (HEAD) | yes | 09dfbb38ff | - |
| `web/__tests__/pages/api/v1/db/update-wgo-goalies.test.ts` | 9815bb87d0 | ba4732f9cc (HEAD) | yes | ba4732f9cc | - |
| `web/__tests__/pages/api/v1/ml/update-predictions-sko.test.ts` | 689cc93192 | 86c95eac8f (HEAD) | yes | 86c95eac8f | - |
| `web/__tests__/pages/api/v1/season.test.ts` | 638867af17 | f7fb05a3ef (HEAD) | yes | f7fb05a3ef | - |
| `web/__tests__/pages/api/v1/trends/skater-power.test.ts` | 3f39cb9e04 | 20b0420aca (HEAD) | yes | 20b0420aca | - |
| `web/components/Admin/CronRouteRunner.test.ts` | new | 4fffbb41c6 (HEAD) | yes | 4fffbb41c6 | - |
| `web/components/Admin/CronRouteRunner.tsx` | new | 618504e702 (HEAD) | yes | 618504e702 | - |
| `web/components/PlayerStats/PlayerContextualStats.tsx` | 627c776605 | 177e706177 (HEAD) | yes | 177e706177 | - |
| `web/components/TeamStandingsChart/TeamStandingsChart.tsx` | d4ea82b965 | 2e18a56a0d (HEAD) | yes | 2e18a56a0d | - |
| `web/components/TeamStandingsChart/chartUtils.test.ts` | 774c62da07 | d743d6c35c (HEAD) | yes | d743d6c35c | - |
| `web/components/TeamStandingsChart/chartUtils.ts` | f4d08283c0 | 6c0bb3da2c (HEAD) | yes | 6c0bb3da2c | - |
| `web/components/WiGO/RateStatPercentiles.test.tsx` | 810f6d5687 | 3aff9c3b10 (HEAD) | yes | 3aff9c3b10 | - |
| `web/components/WiGO/RateStatPercentiles.tsx` | 33eb935086 | 10fe03f6a7 (HEAD) | yes | 10fe03f6a7 | - |
| `web/lib/NHL/server/index.test.ts` | 5ef7870077 | 29c82d92c6 (HEAD) | yes | 29c82d92c6 | - |
| `web/lib/cron/nhlOffSeason.test.ts` | new | c7ddd9fbb4 (HEAD) | yes | c7ddd9fbb4 | - |
| `web/lib/cron/nhlOffSeason.ts` | new | ca235fd37b (HEAD) | yes | ca235fd37b | - |
| `web/pages/api/Teams/nst-team-stats.ts` | 02665c4b0c | bf1235cd36 (HEAD) | yes | bf1235cd36 | - |
| `web/pages/api/v1/db/build-projection-derived-v2.ts` | 4b0cf108b7 | 0da194a354 (HEAD) | yes | 0da194a354 | - |
| `web/pages/api/v1/db/calculate-wigo-stats.ts` | b3320452ab | 3a92c89f44 (HEAD) | yes | 3a92c89f44 | - |
| `web/pages/api/v1/db/powerPlayTimeFrame.ts` | 9710ba5a45 | 99cae572c6 (HEAD) | yes | 99cae572c6 | - |
| `web/pages/api/v1/db/run-fetch-wgo-data.ts` | acd26928cb | 2bebbb07b9 (HEAD) | yes | 2bebbb07b9 | - |
| `web/pages/api/v1/db/run-projection-v2.ts` | a806fb86f3 | 7aee98e1dc (HEAD) | yes | 7aee98e1dc | - |
| `web/pages/api/v1/db/sustainability/rebuild-baselines.ts` | 156251a676 | 55326453fc (HEAD) | **NO** | 9b3a28e992 | 0de97e77d3 |
| `web/pages/api/v1/db/update-PbP.ts` | 5077db6e97 | fda429f35d (HEAD) | yes | fda429f35d | - |
| `web/pages/api/v1/db/update-game-goal-projections/index.ts` | 0d4886d361 | 42293a9be8 (HEAD) | yes | 42293a9be8 | - |
| `web/pages/api/v1/db/update-goalie-projections-v2.ts` | e109080baa | 2e340d7af0 (HEAD) | yes | 2e340d7af0 | - |
| `web/pages/api/v1/db/update-line-combinations/index.ts` | 3434ed8889 | 13c06de11a (HEAD) | yes | 13c06de11a | - |
| `web/pages/api/v1/db/update-lineup-deployment-tallies.ts` | be44479773 | 2ce50209db (HEAD) | yes | 2ce50209db | - |
| `web/pages/api/v1/db/update-nhl-edge-stats.ts` | d8d879f486 | bb4a0d6656 (HEAD) | yes | bb4a0d6656 | - |
| `web/pages/api/v1/db/update-nst-current-season.ts` | a5de0ff002 | 0e62d7e2de (HEAD) | yes | 0e62d7e2de | - |
| `web/pages/api/v1/db/update-nst-gamelog.ts` | 9fcb7ad572 | c16031ac47 (HEAD) | **NO** | hand-port | 7f094c8e68, 1ddef915d6, 406a47ae4d |
| `web/pages/api/v1/db/update-nst-goalies.ts` | 18be79e838 | 79941d58ea (HEAD) | yes | 79941d58ea | - |
| `web/pages/api/v1/db/update-player-trend-metrics.ts` | 336bac2b4d | a7e29a6b11 (HEAD) | yes | a7e29a6b11 | - |
| `web/pages/api/v1/db/update-player-underlying-stats.ts` | 8abbef8128 | 6d9f7b4a6c (HEAD) | **NO** | c14332900d | 0de97e77d3 |
| `web/pages/api/v1/db/update-power-play-combinations/index.ts` | ed9756aac1 | 402c270f7a (HEAD) | yes | 402c270f7a | - |
| `web/pages/api/v1/db/update-season-stats.ts` | 5a7a4b56e1 | 674a16ef08 (HEAD) | yes | 674a16ef08 | - |
| `web/pages/api/v1/db/update-shifts.ts` | 53670b0806 | 72db4c3173 (HEAD) | yes | 72db4c3173 | - |
| `web/pages/api/v1/db/update-sko-stats.ts` | 8ad6b33609 | a0cd5b7229 (HEAD) | yes | a0cd5b7229 | - |
| `web/pages/api/v1/db/update-standings-details/index.ts` | 1092500e22 | 21cba0840f (HEAD) | yes | 21cba0840f | - |
| `web/pages/api/v1/db/update-team-power-ratings.ts` | d56d1c57b4 | 08705b7be5 (HEAD) | yes | 08705b7be5 | - |
| `web/pages/api/v1/db/update-team-sos.ts` | d9e346f8e4 | d571513597 (HEAD) | yes | d571513597 | - |
| `web/pages/api/v1/db/update-team-yearly-summary.ts` | 15075e2e14 | 2c900b8552 (HEAD) | yes | 2c900b8552 | - |
| `web/pages/api/v1/db/update-wgo-averages.ts` | e0547f1b25 | f1876266ac (HEAD) | yes | f1876266ac | - |
| `web/pages/api/v1/db/update-wgo-goalie-totals.ts` | 1aa4b6ed14 | 71d34939ac (HEAD) | yes | 71d34939ac | - |
| `web/pages/api/v1/db/update-wgo-goalies.ts` | 93c37cb490 | d84e5997da (HEAD) | yes | d84e5997da | - |
| `web/pages/api/v1/db/update-wgo-skaters.ts` | bfae8deb8d | 1502615b7e (HEAD) | yes | 1502615b7e | - |
| `web/pages/api/v1/db/update-wgo-totals.ts` | 6a7e6377c8 | b8dd15a0e6 (HEAD) | yes | b8dd15a0e6 | - |
| `web/pages/api/v1/game-predictions/forecast.ts` | c9dc2c98d3 | 1ec1160016 (HEAD) | **NO** | hand-port | 317f8f57ee |
| `web/pages/api/v1/game-predictions/ingest-espn-odds.ts` | f9de43f291 | ac26f9124f (HEAD) | yes | ac26f9124f | - |
| `web/pages/api/v1/game-predictions/score.ts` | 285ff877f2 | e67c483578 (HEAD) | yes | e67c483578 | - |
| `web/pages/api/v1/ml/update-predictions-sko.ts` | e6a82be859 | e24056ebc8 (HEAD) | yes | e24056ebc8 | - |
| `web/pages/api/v1/season.ts` | c163e6a7d8 | 381178a0e5 (HEAD) | yes | 381178a0e5 | - |
| `web/pages/api/v1/sustainability/rebuild-priors.ts` | 82035d1209 | 12ac31c7d2 (HEAD) | yes | 12ac31c7d2 | - |
| `web/pages/api/v1/sustainability/rebuild-score.ts` | 5b87cb85a1 | 091608566d (HEAD) | yes | 091608566d | - |
| `web/pages/api/v1/sustainability/rebuild-trend-bands.ts` | a0aaa8fedf | a8950da781 (HEAD) | yes | a8950da781 | - |
| `web/pages/api/v1/sustainability/rebuild-window-z.ts` | 18e8172fe8 | 913b27e39c (HEAD) | yes | 913b27e39c | - |
| `web/pages/api/v1/trends/skater-power.ts` | 9e0ac082b8 | 7ee2a72a43 (HEAD) | yes | 7ee2a72a43 | - |
| `web/pages/db/index.tsx` | 89c8877421 | 06b23b1bc7 (HEAD) | yes | 06b23b1bc7 | - |

### U2+U3

| Path | Prod blob | Candidate blob (src) | Unit-only? | Unit-only blob | Extra commits in candidate |
|---|---|---|---|---|---|
| `web/pages/api/v1/db/run-projection-accuracy.ts` | 0edbaa6ac1 | 56bbfcb216 (HEAD) | **NO** | 569d29401e | 7f094c8e68 |
| `web/pages/api/v1/db/update-nst-team-daily.ts` | 9d2a746ca3 | e81128809d (HEAD) | yes | e81128809d | - |
| `web/pages/api/v1/db/update-rolling-player-averages.ts` | 7f139224d7 | 1c2fb5b26c (HEAD) | **NO** | 69ad80aceb | 317f8f57ee |
| `web/pages/api/v1/db/update-team-ctpi-daily.ts` | 1830e72dd3 | 367e79ff9d (HEAD) | yes | 367e79ff9d | - |

### U2+U3+U5

| Path | Prod blob | Candidate blob (src) | Unit-only? | Unit-only blob | Extra commits in candidate |
|---|---|---|---|---|---|
| `web/__tests__/pages/api/v1/db/cron-report.test.ts` | 658ee2e5a4 | 11fefac0aa (worktree) | **NO** | 6099684bb3 | 0de97e77d3, 26468a9fc9 |
| `web/pages/api/v1/db/cron-report.ts` | d56a3b16bc | a8f6ea7e0f (worktree) | **NO** | b3e0da2fd5 | 7f094c8e68, 26468a9fc9 |

### U2+U4

| Path | Prod blob | Candidate blob (src) | Unit-only? | Unit-only blob | Extra commits in candidate |
|---|---|---|---|---|---|
| `web/pages/api/v1/db/run-rolling-forge-pipeline.ts` | 6445f4cb23 | d741c4e73b (worktree) | yes | d741c4e73b | - |

### U2+U6

| Path | Prod blob | Candidate blob (src) | Unit-only? | Unit-only blob | Extra commits in candidate |
|---|---|---|---|---|---|
| `web/pages/api/v1/db/ingest-projection-inputs.ts` | 94c7ef74e0 | 6316850937 (worktree) | yes | 6316850937 | - |

### U3

| Path | Prod blob | Candidate blob (src) | Unit-only? | Unit-only blob | Extra commits in candidate |
|---|---|---|---|---|---|
| `web/__tests__/pages/api/v1/db/run-projection-accuracy.test.ts` | cc561c916f | 3d2dd23cb2 (HEAD) | yes | 3d2dd23cb2 | - |
| `web/__tests__/pages/api/v1/db/sweep-gamecenter-normalization.test.ts` | 86bb6f0060 | 6f2c938c6a (HEAD) | yes | 6f2c938c6a | - |
| `web/__tests__/pages/api/v1/db/update-nst-team-daily.test.ts` | new | 38031e08fe (HEAD) | yes | 38031e08fe | - |
| `web/__tests__/pages/api/v1/db/update-rolling-player-averages.test.ts` | 106282a91d | ed599ca9ef (HEAD) | **NO** | 45440b5e8a | 317f8f57ee |
| `web/__tests__/pages/api/v1/db/update-team-ctpi-daily.test.ts` | new | ca182bb837 (HEAD) | yes | ca182bb837 | - |
| `web/lib/projections/modeledHeadTotals.test.ts` | new | 3055a080aa (HEAD) | yes | 3055a080aa | - |
| `web/lib/projections/modeledHeadTotals.ts` | new | 7e050e5f04 (HEAD) | yes | 7e050e5f04 | - |
| `web/lib/rollingPlayerDailyResume.ts` | new | d780913971 (HEAD) | yes | d780913971 | - |
| `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts` | 23aca37c1f | dc251a1748 (HEAD) | **NO** | hand-port | 317f8f57ee, 6e14053ff5 |
| `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` | 7330a8df73 | 431190dfd4 (HEAD) | **NO** | hand-port | 317f8f57ee, 6e14053ff5 |
| `web/lib/sustainability/incremental.test.ts` | 9ed7fb4809 | c8463d6443 (HEAD) | yes | c8463d6443 | - |
| `web/lib/sustainability/incremental.ts` | 776b2f318d | a08258971b (HEAD) | yes | a08258971b | - |
| `web/pages/api/v1/db/sweep-gamecenter-normalization.ts` | 8dac47aefb | 8bc416ddb2 (HEAD) | yes | 8bc416ddb2 | - |

### U4

| Path | Prod blob | Candidate blob (src) | Unit-only? | Unit-only blob | Extra commits in candidate |
|---|---|---|---|---|---|
| `web/__tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts` | 3909ca2003 | 381d6f17aa (worktree) | yes | 381d6f17aa | - |
| `web/lib/rollingForgePipelineRunState.ts` | new | e1765914fa (worktree) | yes | e1765914fa | - |
| `web/vercel.json` | e271079e83 | e30da9ac8c (worktree) | yes | e30da9ac8c | - |

### U5

| Path | Prod blob | Candidate blob (src) | Unit-only? | Unit-only blob | Extra commits in candidate |
|---|---|---|---|---|---|
| `web/lib/cron/withCronJobAudit.test.ts` | 72c124476d | 81af8b7a07 (worktree) | **NO** | c10a4d7893 | 569245efd3 |
| `web/lib/cron/withCronJobAudit.ts` | 0a0e7387d2 | 60642cf2d2 (worktree) | **NO** | 4a7de85bf8 | 569245efd3 |

### U6

| Path | Prod blob | Candidate blob (src) | Unit-only? | Unit-only blob | Extra commits in candidate |
|---|---|---|---|---|---|
| `web/__tests__/pages/api/v1/db/ingest-projection-inputs.test.ts` | ea7c026f1f | bac2fadc40 (worktree) | yes | bac2fadc40 | - |

## Flags

### F1. Out-of-unit hunks (unreleased earlier commits) in HEAD/worktree candidates: do not take these blobs as-is

| Path | Extra content (source commit) | Risk if shipped | Recommended action |
|---|---|---|---|
| `web/pages/api/v1/forge/players.ts`, `forge/goalies.ts` (+ both tests) | `FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT` provenance gate (`7f094c8e68`, `317f8f57ee`); goalies also null `proj_win_prob` handling and requestedRunId change | **High.** Prod's `calibrationEligibility.ts` does not export the constant (build break), and no prod writer records `metrics.input_provenance.external_fantasy_input_contract`, so the player fallback would skip every run and goalies would 422 | Hand-port only the A-02 hunks of `cc3be5c09` (age limit, scope sort, local-sha fence, resolved serving contract, goalie `status=succeeded` join) and the A-08 hunk of `b47c512fb` (`buildSkaterModeledHeadTotals`) onto prod bytes. goalies.ts has a clean unit-only rebuild (`3fafc008f`); players.ts needs a hand port |
| Draft-pro: `privateImportTransport.ts`, `private-imports.ts`, `chunks/[ordinal].ts`, `stage.ts`, and both tests | `317f8f57ee` first half of the same A-06 fix (typed 400s, fixed 500 redaction); `cc3be5c09` only swaps it to `DraftProRequestError` | Low: prod→HEAD is one coherent A-06 change. No dependency outside the manifest (`requestError.ts` and `server.ts` are included) | Take the HEAD blobs. A unit-only rebuild is impossible because `cc3be5c09` builds on `317f8f57ee` |
| `web/pages/api/v1/db/update-player-underlying-stats.ts` | Team-summary refresh via `teamStatsSummaryRefresh` (`0de97e77d3`) | Medium: new write path | Use the unit-only rebuild `c14332900` (wrapper only) |
| `web/pages/api/v1/db/sustainability/rebuild-baselines.ts` | `rowsUpserted`/`partialWrite` reporting (`0de97e77d3`) | Low | Unit-only rebuild `9b3a28e99` |
| `web/pages/api/v1/db/update-nst-gamelog.ts` | NST request-budget rewrite, new `lib/nst/requestBudget.ts` (`7f094c8e68`, `406a47ae4d`, `1ddef915d6`) | **High:** NST behavior plus a new file that is not in the manifest | Hand-port the 2-line off-season wrapper onto prod |
| `web/pages/api/v1/game-predictions/forecast.ts` | `summarizePredictionWindowOutcome` (`317f8f57ee`); missing from prod `workflow.ts` | **Build break** | Hand-port the wrapper onto prod |
| `web/pages/api/v1/db/update-rolling-player-averages.ts` (+ test) | `resolveRollingFullRefreshMode` guard (`317f8f57ee`); missing from prod `rollingPlayerOperationalPolicy.ts` | **Build break** | Unit-only rebuilds `69ad80ace` (route) / `45440b5e8` (test) |
| `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` (+ test) | Aligned-count support, new `lib/rollingPlayerCountSupport.ts`, `resolveRollingFullRefreshMode` (`6e14053ff5`, `317f8f57ee`) | **Build break**, plus a new stored field | Hand-port the A-05 hunks of `b47c512fb`. Hunk #5 (near `:3939`, `} catch (error) {`) rejects on prod; the others apply |
| `web/pages/api/v1/db/run-projection-accuracy.ts` | One error-message string (`7f094c8e68`) | Trivial | Unit-only rebuild `569d29401`, or accept |
| `web/pages/api/v1/db/cron-report.ts` (+ test) | `refresh-roster-optimizer-schedule` map entries, `gate` key part, and `responseOutcome` fallback (`7f094c8e68`, `26468a9fc9`); test residue from `0de97e77d3`, `26468a9fc9` | Low/medium: reads a `responseOutcome` that prod's `withCronJobAudit` does not write | Unit-only rebuilds `b3e0da2fd` (route) / `6099684bb` (test) |
| `web/lib/cron/withCronJobAudit.ts` (+ test) | Bounded `responseOutcome` retention (`569245efd3`, 10-11, never released) | Medium: changes every audited cron row | Unit-only rebuilds `4a7de85bf` / `c10a4d789` (prod + U5 delta only), or decide to ship `569245efd3` deliberately |

### F2. Excluded from the manifest: `web/pages/api/v1/start-chart.ts` and `web/__tests__/pages/api/v1/start-chart.test.ts`
- The HEAD blob imports the new `lib/player-forecasts/gameExpectationReader.ts` and `startChartFromGameExpectations`/`scoreStartChartPayload` (missing from prod `startChartContract.ts`). The working tree (`git hash-object` at read time differs from HEAD `cdedafd5c`) also imports S-1 `forecastServingSource.ts`. S-1 and unreleased game-expectation content are present.
- A-08 for Start Chart is still portable by hand. Prod `sumProjectionParts` (`:734`) sums partial heads with `?? 0`. Port it as: add `import { buildSkaterModeledHeadTotals } from "lib/projections/modeledHeadTotals"`, delete `sumProjectionParts`, and replace the four calls at prod `:1509-1527` with `const { goals, assists, shots, ppPoints } = buildSkaterModeledHeadTotals(projection);`. Check the test's `sumProjectionParts` import first. Without the port, Start Chart keeps partial-sum totals while FORGE players and accuracy use the null rule.

### F3. U1 `cc3be5c09` paths left out
- `web/__tests__/index.test.tsx`, `web/pages/index.tsx`, `web/components/TransactionTrends/TransactionTrends{,.test}.tsx` differ from prod but are not A-02/A-06. Not included.
- `shift-charts.ts`, `shift-charts.audit.test.ts`, `relationshipMaterialization{,.test}.ts`: HEAD already equals prod (shipped in R4).
- `tasks/**`: docs, excluded.

### F4. U2 `79492e495` notes
- All 66 web paths are included. The `TeamStandingsChart.tsx` candidate is **HEAD** (`2e18a56a0` = prod + U2 82-game hunk). The working-tree copy has unrelated unknown-owner edits; do not take it.
- `nhlOffSeason.ts` (new, `ca235fd37`) and its test are in the manifest. Its only imports are prod-identical (`lib/supabase/server`, generated types). It reads hosted `games` and `seasons` tables, which already exist. No migration.
- The wrapper hunks are clean on prod except `update-nst-gamelog.ts` and `forecast.ts` (F1).

### F5. Dependency closure (imports changed or new since prod and not in the manifest)
Only these imported symbols are missing from prod:
- `FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT` ← `lib/projections/calibrationEligibility.ts` (forge readers and tests; F1)
- `resolveRollingFullRefreshMode` ← `lib/rollingPlayerOperationalPolicy.ts` (rolling route and fetcher; F1)
- `summarizePredictionWindowOutcome` ← `lib/game-predictions/workflow.ts` (forecast.ts; F1)
- New files: `lib/nst/requestBudget.ts` (update-nst-gamelog), `lib/rollingPlayerCountSupport.ts` (fetcher and test)

All four disappear when the unit-only/hand-port versions are used. Other changed imports still resolve against prod's exports: `cronInventory`, `nstBurstPlans`, `nst/client`, `sourceSnapshot` (frozen; prod bytes stay), `apiHelpers`, `run-forge-projections`, `shift-charts.ts`, `update-players.ts`, `rawSnapshotPersistence`, `shifts.ts`, `nhlRawGamecenter.mjs`. The `ingest-projection-inputs.ts` type imports `PlayByPlayPayload`/`ShiftChartsPayload` are identical to prod's.
- U4 `rollingForgePipelineRunState.ts` (new, `e1765914f`) imports `projectionPipelineState.ts` and `rollingForgePipeline.ts` (prod-identical, clean in the working tree) and a type from `rollingPlayerOperationalPolicy.ts` (present in prod).

### F6. Hosted / migration / vercel.json
- No R5 migration. `20261019180000_*` is excluded and untracked.
- U4 writes `projection_pipeline_state` rows with `pipeline_key='rolling_forge_pipeline'`, `scope_key='<mode>:<date>'` and `operation_key=<stage id>`. All match `projection_pipeline_key_check` (`20260720105524`). The table and lease RPCs already serve ingest in prod.
- U5 writes `cron_job_audit.status='continued'`. The column is `text NOT NULL` with no CHECK constraint in the baseline, so no migration is needed. Two readers are affected. `cron-report.ts` handles `continued` in U5. `rollingPlayerDailyResume.ts` (U3) reads `cron_job_audit` without filtering on status; it reads only `details.resumeCursor`, so `continued` rows are compatible.
- `web/vercel.json`: the working tree equals HEAD and prod (`e271079e8`). **The edit is not yet made.** It is one line, line 32 (`run-rolling-forge-pipeline?mode=daily_incremental…`): `"schedule": "5 10 * * *"` → `"schedule": "5-55/5 10 * * *"`. That pattern occurs once in the file. Post-edit blob: `e30da9ac8c0347a7a846366600e1f54698a6aab1`. No other `vercel.json` change.

### F7. U6 ingest
- Working-tree `ingest-projection-inputs.ts` = `63168509379af28e3849b12dc94596adda877a4d`, read at about 13:30. It is prod + U2 wrapper + U6 isolation only, with no HTML-fallback flag check yet. Re-hash before building; any change after this blob is the other session's work.

## Focused tests per unit
- U1: `__tests__/pages/api/v1/forge/players.test.ts`, `forge/goalies.test.ts`, `lib/draft-pro/api-tests/private-imports.test.ts`, `lib/draft-pro/privateImportTransport.test.ts`
- U2: `lib/cron/nhlOffSeason.test.ts`, `components/Admin/CronRouteRunner.test.ts`, `__tests__/pages/api/v1/season.test.ts`, `trends/skater-power.test.ts`, `components/TeamStandingsChart/chartUtils.test.ts`, `components/WiGO/RateStatPercentiles.test.tsx`, `lib/NHL/server/index.test.ts`, `__tests__/pages/api/Teams/nst-team-stats.route.test.ts`, `db/update-wgo-goalies.test.ts`, `ml/update-predictions-sko.test.ts`, `db/cron-report.test.ts`
- U3: `db/sweep-gamecenter-normalization.test.ts`, `db/update-rolling-player-averages.test.ts`, `lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`, `db/update-nst-team-daily.test.ts`, `db/update-team-ctpi-daily.test.ts`, `db/run-projection-accuracy.test.ts`, `lib/projections/modeledHeadTotals.test.ts`, `lib/sustainability/incremental.test.ts`, `db/cron-report.test.ts`, `forge/players.test.ts` (`start-chart.test.ts` only if F2 is ported)
- U4: `db/run-rolling-forge-pipeline.test.ts`
- U5: `lib/cron/withCronJobAudit.test.ts`, `db/cron-report.test.ts`
- U6: `db/ingest-projection-inputs.test.ts`
- Test files flagged in F1 carry tests for unshipped behavior. Pair each with its matching unit-only/hand-ported code version, or the tests will fail against R5 code.
