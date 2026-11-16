# Ownership decision packet — TJ approved all 37 returns

Snapshot HEAD `2c1cd633d4e5f23ba75d7af53f4bf8a95dc3eafb`, local master `3c03df7dc815cc74aefbf19d5c5a16333985b1e5`. No Astra application commits or fixes. The frozen audit remains at 89da739cb.

TJ directly chose no Astra fixes and return of all 37 shared paths to Claude on 2026-11-15. Together with the 951 mandatory paths, all 988 return. Codex keeps none of these 37. Claude's capture precedence and Scout's excluded cron claims remain intact.

| # | Shared path | Approved disposition |
|---:|---|---|
| 1 | `web/__tests__/pages/api/v1/db/build-projection-derived-v2.test.ts` | Return to Claude — TJ approved |
| 2 | `web/__tests__/pages/api/v1/db/cron-report.test.ts` | Return to Claude — TJ approved |
| 3 | `web/__tests__/pages/api/v1/db/update-power-play-combinations-game.test.ts` | Return to Claude — TJ approved |
| 4 | `web/__tests__/pages/api/v1/db/update-stats-game-rows.test.ts` | Return to Claude — TJ approved |
| 5 | `web/__tests__/pages/api/v1/forge/goalies.test.ts` | Return to Claude — TJ approved |
| 6 | `web/__tests__/pages/start-chart.test.tsx` | Return to Claude — TJ approved |
| 7 | `web/__tests__/ppShare/decision152CrossSurface.test.tsx` | Return to Claude — TJ approved |
| 8 | `web/components/GameGrid/DateRangeTeamGrid.tsx` | Return to Claude — TJ approved |
| 9 | `web/components/GameGrid/SortableHeaders.test.tsx` | Return to Claude — TJ approved |
| 10 | `web/components/GameGrid/TeamRow.tsx` | Return to Claude — TJ approved |
| 11 | `web/components/GameGrid/utils/calcWeekScore.ts` | Return to Claude — TJ approved |
| 12 | `web/components/GameGrid/utils/scheduleSummary.test.ts` | Return to Claude — TJ approved |
| 13 | `web/components/GameGrid/utils/scheduleSummary.ts` | Return to Claude — TJ approved |
| 14 | `web/components/LineCombinations/__test__/utilities.test.ts` | Return to Claude — TJ approved |
| 15 | `web/components/LineCombinations/utilities.ts` | Return to Claude — TJ approved |
| 16 | `web/components/ShiftChart/Replay.test.tsx` | Return to Claude — TJ approved |
| 17 | `web/components/ShiftChart/Replay.tsx` | Return to Claude — TJ approved |
| 18 | `web/components/ShiftChart/model.ts` | Return to Claude — TJ approved |
| 19 | `web/lib/projections/ingest/shifts.test.ts` | Return to Claude — TJ approved |
| 20 | `web/lib/projections/ingest/shifts.ts` | Return to Claude — TJ approved |
| 21 | `web/lib/projections/penaltyClock.ts` | Return to Claude — TJ approved |
| 22 | `web/lib/projections/seasonBootstrap.ts` | Return to Claude — TJ approved |
| 23 | `web/lib/projections/startChartContract.ts` | Return to Claude — TJ approved |
| 24 | `web/lib/projections/startChartPipeline.test.ts` | Return to Claude — TJ approved |
| 25 | `web/lib/socialShare/modules/creaseShift.sources.ts` | Return to Claude — TJ approved |
| 26 | `web/lib/socialShare/types.ts` | Return to Claude — TJ approved |
| 27 | `web/lib/splits/splitsServer.test.ts` | Return to Claude — TJ approved |
| 28 | `web/lib/splits/splitsServer.ts` | Return to Claude — TJ approved |
| 29 | `web/lib/supabase/Upserts/nhlRawGamecenter.mjs` | Return to Claude — TJ approved |
| 30 | `web/lib/supabase/supportedBaselineMigration.test.ts` | Return to Claude — TJ approved |
| 31 | `web/pages/api/v1/db/cron-report.ts` | Return to Claude — TJ approved |
| 32 | `web/pages/api/v1/db/update-stats/[gameId].ts` | Return to Claude — TJ approved |
| 33 | `web/pages/api/v1/forge/goalies.ts` | Return to Claude — TJ approved |
| 34 | `web/pages/api/v1/start-chart.ts` | Return to Claude — TJ approved |
| 35 | `web/pages/start-chart.tsx` | Return to Claude — TJ approved |
| 36 | `web/utils/getPowerPlayBlocks.test.ts` | Return to Claude — TJ approved |
| 37 | `web/utils/getPowerPlayBlocks.ts` | Return to Claude — TJ approved |

## Per-path accounting and concurrent work

[988-row final accounting](HANDBACK-PATHS.tsv) gives audit commits, dirty state, per-path check evidence, local-master comparison and open findings. [Detailed evidence](HANDBACK-PATH-EVIDENCE.json) preserves the ledger's run/source-only/proposed-test distinctions; it is not a claim that every named test ran.

Dirty returned application paths at this snapshot:
- `web/pages/api/v1/sustainability/rebuild-score.ts` — concurrent work preserved; transfer explicitly, do not stage or revert.

The rebuild-score handler/test changes were specifically retained at TJ's direction in Claude's mailbox. They add failure metadata and do not fix partial-write atomicity. `web/next-env.d.ts` and unrelated Claude diaries/lease/mailbox changes remain untouched. No dirty path is represented as clean.

## Records and work to return

- `tasks/artifacts/calculation-inventory-2026-11-10/master/**`, including the audit report, ledger, local evidence and open finding register. Audit records remain local/uncommitted and are to be transferred explicitly as such; no audit commit or release is claimed.
- `tasks/TASKS/repository-audit-remediation/migration-authority.json`.
- `web/lib/supabase/supportedBaselineMigration.test.ts` (also one of the 37 shared paths; capture precedence already applies to its capture count pin).
- `tasks/TASKS/super-goal/super-goal-final-summary.md`.
- `tasks/tasks-fix-sprint-closeout-2026-11-13.md` and every open work item transferred by the release, plus this audit's unresolved findings/gates.
- Scout retains the one-entry `web/vercel.json` and `web/lib/cron/combinedCronInventory.test.ts` claims; other pre-existing Codex ownership excluded from the release is unchanged.

Production reads/restarts, migrations, deployments, rebuilds and capture execution remain separate direct-TJ approvals. Later capture commits are not a general hand-back; future policy installation is not approved. The direct decisions are complete; no Astra fixes are authorized. The final mailbox hand-back is the hand-off event; Astra then stops editing returned paths and awaits Claude's acknowledgement.

The [final record-path inventory](HANDBACK-RECORDS.tsv) lists current sprint records and the additional authority/closeout paths, with uncommitted artifacts explicitly marked for transfer. This administrative inventory is not additional source-audit coverage.

The local master ref above predates the audit baseline and is not release authority. Final per-path release comparison uses owner-reported #451 candidate `c0c5fe9b287096aeba51191586a87980e2b7e82f`; current deployment remains unverified.
