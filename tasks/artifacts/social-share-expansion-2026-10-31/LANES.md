# Social Share expansion: lane plan (proposal)

**Dependency:** SS 1.0's commit. After it, all lanes can run in parallel on `octoberBranch` in the canonical checkout. Each owns exact paths, and no path appears twice.

## Rules for every lane

- Read [CONTRACT.md](CONTRACT.md) and [SOURCES.md](SOURCES.md). Build each post from fixtures first, then its bounded real read.
- Commit with explicit pathspecs. No production writes, migrations, provider calls, Vercel, or pushes.
- **Do not edit** `tasks/tasks-prd-social-share-expansion-2026-10-31.md`. Write your receipt to `tasks/artifacts/social-share-expansion-2026-10-31/lanes/<lane>.md`: subtasks done, evidence, real reads made, blockers. The lead updates the task file from the receipts.
- Log every real read in your receipt, in the [READ-RECEIPT](READ-RECEIPT.md) format, within TJ's bound: SELECT only, at most 50 sample rows per table. A loader that needs a larger runtime read needs a new approval.
- Do not edit `modules/contract.ts`, `modules/registry.ts`, `modules/server.ts`, `modules/shared/definitions.ts`, `skaterAppearances*`, `goalieLedger*`, `goalieInventory.ts`, `PostStudio.tsx`, `kit.tsx` or `SocialShare.*`. If one needs a change, message the lead.
- Run `npm test -- <your files>`, `npx tsc --noEmit`, eslint on your files, and the CSS-module pure check on your SCSS.
- **Browser runs are the lead's.** The isolated `.next-playwright` output can't be shared, so lanes write their E2E spec and may run `--list`. The lead runs them serially at 13.0.
- Keep your own diary under `tasks/diaries/`.

## Lanes

Paths are under `web/`. `<name>` files are the five-file set from CONTRACT §1. "Modules" lists the definition, test and optional sources in `lib/socialShare/modules/`, and the card in `components/SocialShare/modules/`.

| Lane | Parents | Modules | Exact write paths beyond the modules |
| --- | --- | --- | --- |
| **A. Trends** | 2.0, then 4.0 (sequence inside the lane) | `whatChanged`, `roleWatch` | `lib/socialShare/modules/lanes/trends.ts`; `e2e/social-share-trends.spec.ts` |
| **B. Skater boards** | 3.0, 7.0 | `bshBoard`, `categoryBlueprint`, `nightlyFloor` | `lib/socialShare/modules/lanes/skaterBoards.ts`; `e2e/social-share-skater-boards.spec.ts` |
| **C. Comparison** | 5.0 | `playerVsPlayer` | `lib/socialShare/modules/playerVsPlayer.candidates.json`; `lib/socialShare/modules/lanes/comparison.ts`; `tasks/artifacts/social-share-expansion-2026-10-31/SENTIMENT-ASSESSMENT.md`; `e2e/social-share-comparison.spec.ts` |
| **D. Schedule** | 6.0 | `offNightEdge` | `lib/socialShare/modules/lanes/schedule.ts`; `e2e/social-share-schedule.spec.ts` |
| **E. Crease and Category Counts** | 8.0, 9.0 | `creaseShift`, `goaliePeriod`, `goalieGsax` | `lib/socialShare/modules/shared/categoryCounts.ts` and test; `lib/socialShare/modules/lanes/creaseAndCategory.ts`; `e2e/social-share-crease-category.spec.ts` |
| **F. Goalie workload** | 10.0, 12.0 | `busyQuiet`, `goalieRescue`, `ratioImpact` | `lib/socialShare/modules/lanes/goalieWorkload.ts`; `e2e/social-share-goalie-workload.spec.ts` |
| **G. Inventory** | 11.0 | `riskyStarts`, `startSit` | `lib/socialShare/modules/shared/goalieInventory.sources.ts` and test; `lib/socialShare/modules/lanes/goalieInventory.ts`; `e2e/social-share-inventory.spec.ts` |
| **Lead** | 13.0 | | Task file, lane receipts' summary, final disposition, shared shell fixes |
| **Astra** | 13.0 audit | | One agreed audit report; read-only otherwise |

Read-only for everyone: `lib/goalieWorkload.ts`, `components/GoalieShareChart/**`, `components/GoaliePage/**`, `pages/trueGoalieValue.tsx`, `lib/projections/**`, `lib/player-cards/**`, `components/player-cards/**`, `components/WiGO/**`, `lib/socialShare/{trends,trendSources,mondayGrid,score,matchups,targets,players,playerSources}.ts`.

## Dependencies and order

| Needs | Before | Why |
| --- | --- | --- |
| SS 1.0 commit | Every lane | Seam and shared producers |
| 2.0 | 4.0, inside lane A | Same files and windows |
| Nothing new | B, C, D, F, G | They consume frozen producers. F uses `teamStartShare` directly, and consumes 9.0's labels only if it chooses to show them |
| 8.0 | 9.0, inside lane E | Both read the ledger; sequenced to keep one writer |
| G's `goalieInventory.sources.ts` | Player Cards PC 7.0 real data | Types are frozen now, so Codex can use fixtures immediately |
| All lanes' receipts | 13.0 | Integration, serial browser runs, freeze, Astra audit |

**Open decision for TJ:** how the post route may read `player_forecast_goalie_start_observations` (SOURCES, fact 3). Lane G does not wait for it.

**Recommended dispatch:** seven lanes at once. If that strains usage or review, start with B, E and G, which carry the most requirements, then A, D, F, C. TJ's real-input acceptance of each post stays separate from a lane being done.
