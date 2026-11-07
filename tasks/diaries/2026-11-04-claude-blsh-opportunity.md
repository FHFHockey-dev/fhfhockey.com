# BLSH opportunity lane (decision 3), Claude, 2026-11-04

## Scope
Implement TJ decision 3 (`tasks/artifacts/blsh-brief-decisions-2026-11-03/DECISIONS.md`) as a new pure module
`web/lib/buyLowSellHigh/opportunity.ts` + `opportunity.test.ts`, offline validation, and
`tasks/artifacts/blsh-opportunity-2026-11-04/REPORT.md` (method, validation, coverage, 2026-10-28 list changes,
integration spec). Owned files: those only. No wiring into displayProfile/currentWindows.

## Where
- Branch `octoberBranch`, base HEAD f98d28dc7.
- Validation input: dev-history.jsonl (sha256 da32a473…, matches the snapshot `sourcePins.developmentHistory`)
  at `~/Documents/Codex/2026-10-27/task-3/current-refresh-20261029-01/dev-history-cache/` (read-only, python3 -I).
- Snapshot: `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json` (read-only).

## State / decisions
- Snapshot profiles carry per-game TOI/ES/PP current vs reference in `context.opportunity`, track observed and
  `referenceAtCurrentTOI`, and reference sourceIds (dev-history row ids) -> I can rebuild state-split rates.
- Dev rows carry `pp_points` but not PP goals; `Slot` lacks ppPoints (integration spec must ask for it).
- Method: two-state (PP vs non-PP) per-second rates. G+A split exact (PPP vs other points); FP split values a PP
  point at 3 + goal share (2 assist + 1 PPP bonus + 1 more if a goal); PP shots stay in the non-PP rate. GS: no split -> unavailable.

## Checkpoint (module + validation done)
- opportunity.ts/.test.ts written; `npm test -- lib/buyLowSellHigh/opportunity.test.ts` 18/18 passed.
- Validation (k=3600): the split removes most of the PP-change bias (FP >60 s PP: +1.39 total-TOI -> +0.44 split).
  Known weakness: small PP rises are over-adjusted (FP -0.31).
- Snapshot application via esbuild bundle of the real module: FP (a)/(b) available for 388/729.
- `npm run typecheck` exit 2, errors only in non-owned currentProcessEvidence.server(.test).ts and retainedBlsh.test.ts.

## Committed
145b9d297 (module, tests, artifact folder; this diary is left uncommitted). Hand-over note: side-session-notes/<parent>/blsh-opportunity.md.

## Next Then the lists/baseline lanes wire it in (spec in REPORT §6).

## Gotchas
- Never set GIT_DIR in tests; commit with `git commit -- <paths>`.
