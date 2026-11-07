# 2026-11-04 Claude: BLSH personal baseline (decision 1)

## Scope
TJ decision 1 (tasks/artifacts/blsh-brief-decisions-2026-11-03/DECISIONS.md): weighted personal baseline, matching per-game/per-60 units, 2024-25 history export, chronological development evaluation.
Owned files: web/lib/buyLowSellHigh/{currentWindows,productionReference}{,.test}.ts, web/scripts/blsh/{export_db_history.py,baselineEvaluation.test.ts} (new), tasks/artifacts/blsh-baseline-2026-11-04/.

## Decisions (TJ pop-ups)
- DB read: 2024-25 only; 2025-26 stays an untouched reserve; 2026-27 baseline labelled incomplete.
- Current-season weight 1.0 (chosen after eval-01; beat a-priori 0.6 on every track). Frozen for the reserve test.

## Where
- Branch octoberBranch, commit db7a64c58. Report: tasks/artifacts/blsh-baseline-2026-11-04/REPORT.md.
- Data outside repo: /Users/tim/Documents/Claude/2026-11-04/blsh-baseline/ (capture-20242025, history-20242025 db-history.jsonl 3b4e6429..., eval-01, eval-02 EVALUATION.json 84d2f545..., arm-c-smoke.json).

## State / checks
- npm test -- lib/buyLowSellHigh scripts/blsh: 13 files passed, 3 skipped; 317 tests passed, 7 skipped (the eval file is opt-in; with its env set, 14 passed, 318 tests).
- npm run typecheck: exit 2, errors only in other lanes' files (currentProcessEvidence.server*.ts, components/blshTrade/fixtureEvidence.ts, player-cards/retainedBlsh.test.ts).
- eslint on owned files: clean.

## Next
- Codex: parser changes + repackaging (REPORT §7). Lists lane: map historyStatus/missingSeasons/insufficientHistory/comparisons (REPORT §6).
- Reserve test on 2025-26 needs TJ approval to read (REPORT §8).

## Gotchas
- grep of web/.env.local prints commented secrets; only extract variable names/values programmatically.
- Old all-or-nothing summarizeHistory makes arms A/B unusable once 2024-25 raw rows (22% null on-ice goals) enter the pool; arm C uses per-track rule.
- export_dev_history.py hash is pinned by currentDryRun.test.ts: do not edit it; sibling export_db_history.py instead.

## Follow-up ticket: decision-3 opportunity wiring (commit fc480f582)
- Slot.ppPoints (optional; absent = unavailable, so forecastEvaluation.test.ts's synthetic slots still type-check). Profile.opportunity from opportunity.ts over the baseline's games and weights; cohort = donor final-50 games by position, target excluded.
- Tests: PP promotion moves only the adjusted comparison; null window PP time makes it unavailable; baseline PP time excludes the window. 326 passed / 7 skipped; typecheck exit 2 (other lanes' files only).
