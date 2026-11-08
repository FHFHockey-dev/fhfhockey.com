# VORP S4a receipt: tidy alternatives (RSO-ALT-TIDY)

Lane `RSO-ALT-TIDY` (Claude, 2026-10-29). Follows S1 (`../S1/RECEIPT.md`, Limitations 3–4) and finding 2 of `../WALKTHROUGH-2026-10-29.md`. Local edits and offline tests only: no commit, push, deploy, production or Yahoo access, migration, Next dev server or `GIT_DIR`. Every leased file matched its lease baseline sha256 before editing. `RosterScheduleOptimizer.tsx` and `CandidateCard.tsx` are untouched, and no prop change is needed.

Primary recommendations, `plan.chains`, `plan.recommended`, Best Fit ranking and weekly numbers are unchanged (harness below).

## 1. Calmer Best Fit alternative lines (`CandidateBrowser.tsx`)

**Rule (`alternativeShown`).** A different-drop alternative is shown as a line under its card only when it is materially relevant:

- it has **more Net AGP** than the card's representative plan; or
- in a points league where the representative's Net Pts is known, its **Net Pts is within the larger of 1 point and 10% of the representative's** (alternative ≥ representative − max(1, 0.1·|representative|)). An alternative with more Net Pts always qualifies.

The same rule applies under both sorts, "By projected points" and "By more starts". Category leagues show no Net Pts, so there only more Net AGP shows the line. The same holds when the representative's Net Pts is unknown (schedule-only comparisons).

Every other alternative sits in a collapsed **"Other drop"** disclosure under the card: a native `<details>`/`<summary>`, so it works with Tab, Enter and Space and is announced as expandable. It holds the same line, with the same text and `aria-label`. Category leagues still never show Net Pts.

Why one rule and not one per sort: a first cut also showed equal-AGP alternatives under "By more starts". On the fixtures that still showed 306 of 313 lines in that sort, because many drops tie on games. Keying relevance to Net Pts, as the brief proposed, calms both sorts.

Unchanged: the alternative's numbers are its own certified plan; cards rank by the representative alone; no re-ranking.

New style: `.otherDrop` in `CandidateCard.module.scss`, with a 24 px summary, or 44 px at ≤ 1100 px. It passes the CSS-modules pure check.

**Fixture counts.** These come from the harness wrapping `candidatePlanMetrics` in the engine test files: 74 calls, 40 with any alternative. Each call's candidates are counted per sort. Before S4 every alternative was a line.

| Sort | Alternatives | Before S4: line / collapsed | After S4: line / collapsed |
| --- | --- | --- | --- |
| By projected points | 309 | 309 / 0 | **90 / 219** |
| By more starts | 313 | 313 / 0 | **88 / 225** |

## 2. Streaming alternatives cover both goals (`streamingChain.ts`, `StreamingItinerary.tsx`)

**Rule.**
- Up to `ALTERNATIVE_DROPS = 3` alternatives are kept by the active objective, exactly as in S1: the best certified chain per initial-drop set the offered chains don't start with.
- Then, among certified chains whose initial drops differ from the offered chains, the best by the *other* objective is added, if no kept alternative starts with the same drops. Under "Most starts" the other objective is points, then games; under "Best projected points" it is games, then points. The goalie-minimum precedence is the same in both.
- It is drawn from chains already built and certified, so there is no extra search or evaluation.
- Each alternative now carries `wins: ("games" | "points")[]`: the goal or goals it is the best different-drop chain for. A kept alternative that is also the other goal's best gets both, and nothing is added.
- `alternativesTruncated` is now the number of different-drop sets not shown.
- Types: `StreamingGoal` and `StreamingAlternative = StreamingChain & { wins }` in `streamingChain.ts`. `planningTypes.ts` is outside the lease. The streaming plan is not persisted in any schema.

**Picker.**
- Labels read `Alternative · most starts · drop <name> · +n AGP`. A points winner adds its projected FPts: `Alternative · best points · drop <name> · +n AGP · +p FPts`. One that wins both reads `· best points, most starts ·`, with the active goal first.
- Choosing an alternative still shows the S1 note, plus "Of the other first drops, it is the best for starts|points|points and starts."
- Never marked "suggested".

**Note on scope.** In games-first mode the search only builds chains that add games (unchanged). So the points alternative there is the best-points chain among chains that add games. It is not a separate points search.

**Fixtures.**
- S1 points-first fixture: g3's six-start chain was fourth by points and truncated. It now follows as `["games"]`. Alternatives are d1+g3, d2+g3, d2 (points), then g3 (games), and the truncated count is 0.
- New D-drop fixture ("streaming alternatives cover both goals (VORP S4)"): one add, an open C slot for a 7-game C streamer, and five D drops that each lose 1–5 of their own games.
  - Most starts: the offer is dA (+6). Kept: dB, dD, dE (games). dF (+2 AGP, +3.45, best by points, last by starts) is added as `["points"]`.
  - Best points: the offer is dF. Kept: dE, dD, dB (points). dA is added as `["games"]`.
  - A sixth drop and a cheaper dA put dA inside the points top three. It is labelled with both goals, nothing is added, and 2 are truncated.

## 3. No-adds message in Best Fit (`CandidateBrowser.tsx`)

`noAddsRemain(snapshot)` decides from `snapshot.rules` alone, so no new prop is needed from `RosterScheduleOptimizer.tsx`. It is true when all of these hold:
- the acquisition cost is known and > 0;
- at least one acquisition period overlaps the planning window, from the later of `asOf` and the plan start to the end of the range's last local day;
- every overlapping period has a known allowance (`source` ≠ unknown, `remaining` ≠ null) below one add: `floor(remaining / cost) < 1`, the streaming plan's own test.

A reset inside the range that brings adds back makes it false.

When no fit is evaluated and it is true, Best Fit's status reads **"No adds remain this period; adds return when the period resets."** Otherwise the existing "Rankings appear once projections and schedules load." stays, including the real loading and unknown-rules cases. "Comparing free agents…" while loading is unchanged.

## Primary results are byte-identical (baseline `f3e95cf78`)

`run-primary-harness.sh` (this folder) is adapted from `../S1/run-primary-harness.sh`. It runs the working-tree `planning`, `streamingChain` and `candidatePlanMetrics` test files with the engine entry points wrapped. Each call runs the baseline engine and the working-tree engine on the same input and compares JSON text:
- streaming: everything except `alternatives` and `alternativesTruncated`;
- `planRoster`: everything except those two fields and `search.elapsedMs`;
- `candidatePlanMetrics`: the whole output.

```bash
tasks/artifacts/rso-wave2-2026-10-25/VORP/S4-ALT-TIDY/run-primary-harness.sh <empty scratch dir>
```

Result: 3 files and 237 tests passed under the wrappers.

```
buildStreamingChains calls 1 | primary mismatches 0 | chains mismatches 0 | recommended mismatches 0 | alternatives 0 -> 0 | truncated 0 -> 0 | other-goal-only alternatives added 0
planRoster calls 126 | primary mismatches 0 | chains mismatches 0 | recommended mismatches 0 | alternatives 58 -> 63 | truncated 14 -> 9 | other-goal-only alternatives added 5 | calls gaining one 5
candidatePlanMetrics calls 74 | primary mismatches 0
best fit points sort: alternatives 309 | before S4 shown 309, collapsed 0 | after S4 shown 90, collapsed 219
best fit schedule sort: alternatives 313 | before S4 shown 313, collapsed 0 | after S4 shown 88, collapsed 225
```

## Tests added or changed

- `CandidateBrowser.presentation.test.tsx`:
  - Three cards: within 1 point → line; 6 vs 10 with fewer AGP → collapsed `<details>` with an "Other drop" summary, closed by default, keeping its own numbers; 4 vs 10 but more AGP → line. Ranking is unchanged under both sorts.
  - Rule table: the 10% and 1-point margins, negative nets, unknown Net Pts, and category leagues.
  - `noAddsRemain` cases: spent, remaining, unknown, no cost, no periods, a reset inside the range, an ended period.
  - The status message flips between loading and no adds.
- `CandidateBrowser.integration.test.tsx`: the real solver with `remaining: 0` shows the no-adds status and no results. The existing unknown-timing test still shows the loading message.
- `streamingChain.test.ts`: the S1 expectations are updated (g3 is now shown as the most-starts alternative, and labels are checked). The S1 oracle compares without `wins`. The "only d2" case wins both goals. Three new D-drop tests cover the other-goal guarantee in each mode and the no-extra/truncated case.
- `StreamingItinerary.test.tsx`: the S1 label now carries "most starts". A new test checks goal labels, the FPts of a points alternative, the "both" label, the selection note and the alternative's own totals.

## Commands run (from `web/`) and results

| Command | Result |
| --- | --- |
| `npx vitest run components/RosterScheduleOptimizer/CandidateBrowser.presentation.test.tsx components/RosterScheduleOptimizer/CandidateBrowser.integration.test.tsx` | passed, 2 files, 31 tests |
| `npx vitest run lib/rosterScheduleOptimizer/streamingChain.test.ts` | passed, 26 tests |
| `npx vitest run __tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx` | passed, 12 tests |
| `npx vitest run lib/rosterScheduleOptimizer components/RosterScheduleOptimizer __tests__/components/RosterScheduleOptimizer` | passed, 46 files, 1,159 tests |
| `npx eslint --max-warnings 0` on the 7 touched TS/TSX files | passed, exit 0 |
| `node …/purecheck.cjs <web> components/RosterScheduleOptimizer/CandidateCard.module.scss` | PURE |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` under `/private/tmp/fhfh-heavy.lock` (free when taken, released after) | passed, exit 0 (no output) |
| `run-primary-harness.sh` (baseline `f3e95cf78`) | 0 primary mismatches; numbers above |

Not run: full `npm run lint`, the whole unit suite, Playwright, `npm run build`, and a live browser check. The walkthrough league has no adds left, so alternative lines cannot be seen live until a week with adds.

## Limitations

- The 10% / 1-point margin is a display heuristic, applied to the representative for the current sort. A collapsed alternative is one click away and never lost.
- The other-goal guarantee adds at most one alternative, and only when its initial drops are new. If the other goal's best chain shares its drops with a kept alternative (which is that drop's best by the active goal), that drop is shown once, labelled with the active goal.
- `StreamingItinerary.module.scss` is unchanged; the labels reuse existing classes.

## sha256 of touched files

```
0b4d5cde05a2843183fbae15157f7e7d3db36c8712113eb834eb5d09fa35a659  web/components/RosterScheduleOptimizer/CandidateBrowser.tsx
16e1b8023b952946407512105cffddf4cf7e214202590a0eb74eba854deac52d  web/components/RosterScheduleOptimizer/CandidateBrowser.presentation.test.tsx
2c225e008f8a0614664c406621ad6d8d5918334f90f92b95c93d605f124e1829  web/components/RosterScheduleOptimizer/CandidateBrowser.integration.test.tsx
d436a1ed502474a30499818252724758c21605f2483175df6a787ae253b56d85  web/components/RosterScheduleOptimizer/CandidateCard.module.scss
f736fecc327c471605916958432f98b34894b96b1240fd5e1a4e65e3aaee46f5  web/components/RosterScheduleOptimizer/StreamingItinerary.tsx
4ea116ee5dd08cd662e3087acb2cf06738febf6e176b6e4a073f346897634e15  web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx
df3f3475a881f49d805f6656dfffa7634d24c69c0bfe6278bedab186c8d71ec1  web/lib/rosterScheduleOptimizer/streamingChain.ts
649f39aab0a41888e641a21e76dd3cbb1a358e99dff3785d457cc59e3c299dbc  web/lib/rosterScheduleOptimizer/streamingChain.test.ts
9b9e365d7bbe3790c2679d2d0faf2f32a157347197c295812dfa049281cd9138  tasks/artifacts/rso-wave2-2026-10-25/VORP/S4-ALT-TIDY/run-primary-harness.sh
```

The diary `tasks/diaries/2026-10-29-claude-rso-alt-tidy.md` is updated after this receipt, so its hash is not listed here.
