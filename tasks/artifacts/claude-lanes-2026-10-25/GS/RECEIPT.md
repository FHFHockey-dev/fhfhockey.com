# GS receipt: official starts in the Goalie Share chart (offline slice)

Lane GS took over Codex's frozen goalie-share packet (CODEX-20261025-086). This slice adds a historical **official starts per team game** count to the chart data layer and tooltip. It is null-safe and separate from appearance share. Nothing is committed; the orchestrator commits.

## Pins rechecked before editing

All six lease files matched their `CLAUDE-LEASES.json` GS `baseline_sha256` (and TRANSFER-MANIFEST `goalie_share`) at the start.

## Product choice

TJ answered by pop-up: **Tooltip line**. The pie stays as appearance share (relief included). The tooltip adds `Starts: X of Y team games`, or `Starts: Unavailable`. The intro text gained one sentence.

## Behaviour

- Source: the chart already reads NHL `stats/rest/en/goalie/summary?isGame=true`. That is the same endpoint whose `gamesStarted` the canonical writer `update-goalie-projections-v2.ts` uses. No new request was added.
- `GoalieGameRow.gamesStarted?: number | null` (optional; the provider field may be absent). `GoalieData.gamesStarted: number | null`.
- For each team and window (L10/L20/L30/Season over distinct team games), starts are counted only if every row in the window has a label of exactly `0` or `1`, and every team game in the window has exactly one starter. Otherwise **every** goalie on that team gets `null` for that window, because a missing or doubled starter can't be assigned to anyone.
- A relief appearance is a measured `0` start and still counts as an appearance. A traded goalie's starts stay with each club. A bad label outside the selected window does not withhold that window.
- No future probability, prior, shrinkage, calibration or model activation. `workloadEvidence.ts` and its test are unchanged; that seam stays dormant.

## Changed paths (SHA-256 after)

| Path | Baseline | After |
| --- | --- | --- |
| `web/lib/goalieWorkload.ts` | `d4cbf44f…7f6f` | `459fc3d6d3abf9baae19d63d2ee7d0a390c12597d5065bc4bd0fb226d8b84a1f` (5364 B) |
| `web/components/GoalieShareChart/index.tsx` | `1f3d4cdb…4b05` | `e6e8b8131a3076024aabe57d1b3ad6c68b289965bb779cbae45c567317849df4` (20675 B) |
| `web/components/GoalieShareChart/GoalieShareChart.test.ts` | `7010f8de…aff` | `cd1ac67f6610e6869cc5c9c5ac9b2c052d6eeb8ed3d8de7583a13624e75552d0` (6608 B) |
| `web/components/GoalieShareChart/GoalieShareChart.pagination.test.tsx` | `90b0c79a…0dda06` | `b4b814a4e6b7606a90f94cbb1126cd02fec585fc65a23c7039d86de09ed6ea88` (10270 B) |

Unchanged lease files: `web/lib/projections/goalie/workloadEvidence.ts` (`8d9ae620…7fa43`) and `workloadEvidence.test.ts` (`fcd83058…9c167`).

The patch for these four paths is `task-only.patch` (sha256 `3fd92b5f9ca4ff96e7e9af1920666660a51c8691336e3ffde86d823688eb1a70`), +88/−4.

## Tests added

- Positive: starter plus reliever gives starts `[2, 0]` over 2 team games and 3 appearances. Window-scoped counting: L10 gives `[6, 4]`, while a null label in game 1 withholds Season only. A traded goalie's starts stay per club.
- Negative (all six withhold every goalie's starts but keep appearances): a missing label, a null label, label `2`, label `0.5`, two starters in one game, and no starter in one game.
- Component: the tooltip shows `Starts: 1 of 1 team games` and `Starts: 0 of 1 team games` for starter and reliever. Unlabeled rows show `Starts: Unavailable`. The Doughnut mock now also captures `options`.

## Checks (Node 22.11.0, one worker, network blocked by `offline.cjs`, inert env, under `/private/tmp/fhfh-heavy.lock`, lock released)

| Check | Result |
| --- | --- |
| Vitest: the two chart test files plus `workloadEvidence.test.ts` | **Passed**: 47 tests in 3 files (`focused.log`) |
| Scoped `tsc --noEmit -p GS/tsconfig.json` (six lease files) | **Passed**, exit 0 (`tsc.log`). The first run failed on a test fixture type; that was fixed and rerun. |
| ESLint on the six lease files | **Passed**: 0 errors, 2 pre-existing `<img>` warnings (`eslint.log`) |
| Canonical consumer controls (rolling participation, goalie pipeline, RSO bridge, Start Chart) | Not run. No forecast or consumer module imports `goalieWorkload`; the only importers are this component and the Stats/Trends pages (default export). |
| Real NHL payload check that `gamesStarted` is present per game row | **Not run** (no live reads). It is inferred from the canonical writer's use of the same endpoint. If absent, the tooltip shows "Unavailable". It never shows a false zero. |
| Browser/visual Chart.js check, full suites, build | Not run |

## Still pending (unchanged from handover)

Authoritative starter/opportunity contract for FORGE, dated team/season/trade membership clocks, the null-to-zero prior coercion in projection stages (outside this lease), and held-out calibration. These need sources or files outside GS.
