# PRD: Codebase Cleanup & Warning Reduction

## Objective
Reduce technical noise (lint warnings, repetitive code patterns) to improve developer velocity, build clarity, accessibility, and performance readiness before deeper feature work.

## Success Metrics
- 0 TypeScript build errors (DONE – baseline maintained)
- ≥ 25% reduction in eslint warnings in first pass (focus scopes below)
- 100% elimination of ARIA misuse warnings (DONE for Switch)
- Establish pattern (helper + docs) for migrating `<img>` to `next/image` (pilot in 2–3 components)
- Document rationale for intentionally ignored exhaustive‑deps cases (comment blocks) – at least 5 high-noise instances annotated

## In Scope (Phase 1)
1. Fix incorrect or noisy keys/refs
   - Example: `team.id` -> `team.team_id` in `pages/stats/index.tsx` (DONE)
   - Ref cleanup pattern: copy ref.current to local inside effects where warned
2. Accessibility
   - Replace ARIA misuse (e.g., `aria-pressed` on role="switch") (DONE)
3. React hook dependency hygiene
   - Add missing deps where side-effect truly depends on them
   - For intentional omissions (stable functions, large recalculation cost) add inline comment: `// eslint-disable-next-line react-hooks/exhaustive-deps` + justification
4. Unnecessary deps removal
   - Convert useMemo/useCallback dependency arrays to minimal sets (avoid extra rerenders) where flagged as “unnecessary dependency”
5. Pilot `<Image />` migration
   - Create `components/common/OptimizedImage.tsx` wrapper with fallback & default sizes
   - Replace raw `<img>` in: `components/GameGrid/GameGrid.tsx` (one usage), `components/TeamLeaders.tsx` (one usage), and `pages/index.tsx` (first occurrence) to validate pattern
6. Introduce ESLint rule tuning (optional incremental)
   - Consider local disable for large data-mapping debug logs if performance unaffected
7. Ref cleanup warnings (Stats page) – ensure cleanup uses saved local variable; remove warnings.

## Out of Scope (Phase 1)
- Full migration of every `<img>` (defer after validating wrapper)
- Large refactors of data fetching logic or caching layers
- Performance audits / bundle splitting strategy

## Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Over-fixing hooks adds rerender churn | Perf regressions | Justify each added dep; measure diff if uncertain |
| Aggressive `<Image />` migration breaks layout | Visual regressions | Pilot small subset; diff snapshots manually |
| Wrapper adds TS friction | Slows adoption | Export simple prop interface that extends Next `ImageProps` |
| Lint rule churn causes merge conflicts | Context switching | Batch changes per area (stats page, components groups) |

## Phased Plan
- Day 0: Create PRD (this file), implement ref & ARIA fixes, add Image wrapper.
- Day 1: Apply pilot `<Image />` replacements, annotate 5–10 hook omissions, prune unnecessary deps.
- Day 2: Broader pattern rollout (if approved) & measure warning counts.

## Task Breakdown (Actionable Tickets)
1. a11y-switch-fix (DONE)
2. stats-ref-cleanup adjustments (IN PROGRESS)
3. add OptimizedImage wrapper (DONE)
4. pilot image replacements (PARTIAL – first injury table logo row migrated; next: standings + game cards)
5. hook-deps-pass-1 (missing deps) + justifications
6. hook-deps-pass-2 (remove unnecessary deps)
7. annotate intentional suppressions
8. metrics-report script (optional) to count warnings pre/post (`next lint --no-cache` parse)

### Progress Log
- 2025-09-11: Created wrapper `components/common/OptimizedImage.tsx` and migrated first `<img>` instance in `pages/index.tsx` (injury list). Added `lib/images.ts` util.
- 2025-09-11: Migrated standings table logos on `pages/index.tsx`; warning count reduced (pre:33 -> 32 after first, further reduction pending game card migration).
- 2025-09-11: Migrated standings table logos on `pages/index.tsx`; warning count reduced (pre:33 -> 32 after first).
- 2025-09-11: Migrated game card home/away logos on `pages/index.tsx` (additional reductions, tracking ongoing).
- 2025-09-11: Post game-card migration build: `@next/next/no-img-element` warnings down to 29 (from initial 33) – ~12% reduction on home page-focused subset.
- 2025-09-11: Migrated MobileTeamList logos to OptimizedImage (further reduction expected on next build).
- 2025-09-11: Post MobileTeamList migration build: warnings now 28 (down from 33 baseline; ~15% reduction overall so far).
- 2025-09-11: Refactored scroll timeout handling in stats page (removed scrollTimeoutRef; localized cleanup) to satisfy hook dependency warning gracefully.
- 2025-09-11: Hook pass: added missing dependency (selectedStats) to season data effect in goalies page.
 - 2025-09-11: Hook pass: moved FIRSTNAME_ALIASES to module scope in `pages/db/upsert-projections.tsx` eliminating missing-dep warning without expanding callback deps.

## Acceptance Criteria
- Build passes with zero new errors
- Lint after Phase 1 shows reduced warnings in touched files (manual tally in PR description)
- Wrapper documented in file header JSDoc with usage example
- No functional behavior change (all pages still statically build)

## Open Questions
- Should we enforce migration of all `<img>` via a custom ESLint rule later? (Proposed follow-up)
- Any pages expected to remain legacy (skip modernization)?

## Approvals Needed
- Sign-off on wrapper API
- Confirmation on acceptable partial suppression strategy

---
Generated: 2025-09-11

## Hook Audit (Initial Snapshot)
Tracking representative warnings to address or justify:
| File (excerpt) | Line | Type | Action Plan |
|----------------|------|------|-------------|
| pages/db/upsert-projections.tsx | 248 | (resolved) | Moved FIRSTNAME_ALIASES to module scope; callback no longer needs dep |
| pages/goalies.js | 265 | missing dep | Include selectedStats in effect deps |
| pages/projections/index.tsx | 973 | unnecessary deps | Trim extras to only derived inputs |
| pages/shiftChart.js | 331+ | missing deps (multiple) | Wrap functions in useCallback or move inside effect |
| components/DraftDashboard/ProjectionsTable.tsx | 371+ | missing getDisplayPos, etc. | Stabilize helpers with useCallback then include |
| components/GameGrid/GameGrid.tsx | 235 | unnecessary dep | Remove currentNumGamesPerDay if not referenced |
| components/TeamScheduleCalendar/TeamScheduleCalendar.tsx | 673 | missing complex deps | Evaluate cost; may justify suppression |
| components/TeamDashboard/TeamDashboard.tsx | 1120 | complex state deps | Consider useReducer or include gated accessors |
| components/WiGO/NameSearchBar.tsx | 151 | missing filteredPlayers.length | Add length or refactor to useMemo source |
| components/WiGO/PerGameStatsTable.tsx | 156 | missing playerId | Add dependency |

Next pass will implement top 5 low-risk fixes and document 3 justified suppressions.
