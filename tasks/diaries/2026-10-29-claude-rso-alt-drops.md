# RSO-ALT-DROPS (VORP S1) — Claude diary

- Scope: S1 of tasks/artifacts/rso-wave2-2026-10-25/VORP/ASSESSMENT.md — keep best legal plan per distinct drop set (candidatePlanMetrics, planner beam, streaming chains); primary result byte-identical; alternatives may change.
- Where: octoberBranch, shared checkout, no commits (orchestrator commits). Lease RSO-ALT-DROPS.
- 2026-10-29 start: all 10 leased files match lease baseline sha256.
- Next: read engine files, design.
- Design (checkpoint): keep every existing output field as-is and add separate alternatives so primaries are identical by construction:
  - candidatePlanMetrics: `plans` and old dominance unchanged; new `alternatives` (best plan per dropped set, top 3 sets per sort, not already in plans) + `alternativesTruncated`; helper `candidateAlternativeForSort`.
  - planning: main beam/search untouched; pruned states with an unkept drop (BEAM_RESERVE=2 per depth/objective) get one more move in a post-pass capped at one phaseBudget, only when the main search finished in budget; results alternative-only. Alternatives list: index 0/1 unchanged; up to DISTINCT_DROP_SLOTS=2 later places go first to unseen drop sets; order kept. Limitation line "Beam reserve: …" discloses.
  - streamingChain: `chains`/`recommended` unchanged; new `alternatives` = best certified chain per initial-drop set not offered, top 3 (type StreamingPlanWithAlternatives in streamingChain.ts, since planningTypes.ts isn't leased).
- Existing 3 engine test files pass after the engine edits (223 tests).
- Gotcha: planningTypes.ts is outside the lease, so new fields ride on types declared in the leased files.
- Done (2026-10-29): engine + display + tests written; S1/RECEIPT.md and S1/run-primary-harness.sh in tasks/artifacts/rso-wave2-2026-10-25/VORP/S1/.
  - Checks: 5 touched suites 268/268; RSO folders 45 files 1,085/1,085; whole-project tsc exit 0 (needs --max-old-space-size=8192; heavy lock taken+released); scoped eslint clean.
  - Harness: 0 primary mismatches over 69 Best Fit / 111 planner / 1 streaming calls on the pre-S1 tests (and 74/123/1 with new tests).
- Gotchas: zsh treats `$REF:web` as a `:w` modifier — brace it; `open(p,'w').write(...open(p).read())` truncates first; vitest needs explicit resolve.alias (not vite-tsconfig-paths) for a scratch config.
- Next: orchestrator reviews and commits the 10 web files + S1/ (not this diary). No commit made here.
