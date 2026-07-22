# PRD: Codebase Cleanup & Warning Reduction

> **Implementation task list:** `tasks/TASKS/dead-code-cleanup/tasks-prd-cleanup-tasks.md`

## Objective
Reduce technical noise (lint warnings, repetitive code patterns) to improve developer velocity, build clarity, accessibility, and performance readiness before deeper feature work.

## Success Metrics
- 0 TypeScript build errors (current full no-emit check passes).
- ≥ 25% warning reduction inside each declared first-pass scope. The first current scope removes 5/5 Game Grid ARIA-role warnings (100%). The baseline-compatible directory invocation now covers 1,499 files with 127 warnings; the extension-complete JS/JSX/TS/TSX core covers 1,500 files with 129 warnings. The sole delta is `components/PoissonDistributionChart.jsx` with two raw-image warnings. Because the recorded 1,497-file pre-change snapshot used the directory invocation, only the stable five-to-zero ARIA cluster is presented as a like-for-like reduction.
- 100% elimination of `jsx-a11y/role-supports-aria-props` warnings without suppression (current core baseline: 5 → 0).
- Establish and directly verify a safe `OptimizedImage` fallback/dimension contract before further raw-image migration; NEW 22/23/25 remain open.
- Remove stale lint directives and document only genuinely intentional exhaustive-deps omissions with local evidence. The original NEW 21 four-directive cohort is complete; broader rule-policy/config/formatting follow-ups remain NEW 40–42.

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
   - Audit and repair the existing `components/common/OptimizedImage.tsx` wrapper before expanding it; caller error handlers currently can override fallback and no default-size contract exists.
   - Retain raw images whose source/domain/dimensions are unresolved, including Team Leaders, until NEW 25 is decided; prefer known-size local pilot images after wrapper proof.
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
- Current baseline and claim reconciliation, followed by correctness/accessibility warnings.
- Stale suppression cleanup and direct wrapper/fallback proof before additional image or hook batches.
- Bounded hook/image batches with exact pre/post evidence, followed by the separately decided lint/toolchain contract and integrated verification.

## Task Breakdown (Actionable Tickets)
1. a11y-switch-fix plus sortable-column semantics (DONE locally with direct shared-control and browser evidence)
2. stats-ref-cleanup adjustments (verified complete; the original stale disables are removed under NEW 21 and the image fallback remains NEW 23 work)
3. repair and directly test the existing OptimizedImage wrapper (OPEN — NEW 22)
4. pilot image replacements (PARTIAL — extracted homepage standings/injury/game logos are migrated; stats fallback and Team Leaders constraints remain NEW 23/25)
5. hook-deps-pass-1 (missing deps) + justifications
6. hook-deps-pass-2 (remove unnecessary deps)
7. annotate intentional suppressions
8. replace the deprecated/conflicting lint entrypoint and add a reproducible metrics path (OPEN — NEW 19/20)

### Progress Log
- 2025-09-11: Created wrapper `components/common/OptimizedImage.tsx` and migrated first `<img>` instance in `pages/index.tsx` (injury list). Added `lib/images.ts` util.
- 2025-09-11: Migrated standings table logos on `pages/index.tsx`; the then-current focused count moved from 33 to 32. This is historical evidence, not the current baseline.
- 2025-09-11: Migrated game card home/away logos on `pages/index.tsx` (additional reductions, tracking ongoing).
- 2025-09-11: Post game-card migration build: `@next/next/no-img-element` warnings down to 29 (from initial 33) – ~12% reduction on home page-focused subset.
- 2025-09-11: Migrated MobileTeamList logos to OptimizedImage; later audit found its explicit fallback path is missing and records remediation under NEW 23.
- 2025-09-11: The historical post-MobileTeamList snapshot reported 28 warnings versus its then-current 33-warning baseline; the authoritative current baseline is the 2026-07-21 measurement below.
- 2025-09-11: Refactored scroll timeout handling in stats page (removed scrollTimeoutRef; localized cleanup) to satisfy hook dependency warning gracefully.
- 2025-09-11: Hook pass: added missing dependency (selectedStats) to season data effect in goalies page.
 - 2025-09-11: Hook pass: moved FIRSTNAME_ALIASES to module scope in `pages/db/upsert-projections.tsx` eliminating missing-dep warning without expanding callback deps.
- 2026-07-21: Removed two pre-existing `supabase/.temp` CLI internal-state files from tracking while retaining their physical ignored local copies; official Supabase guidance identifies `.temp/` as non-committable local state.
- 2026-07-21: Corrected stale Playwright publication state by removing the four canonical generated `web/test-results` files from Git tracking while retaining their physical ignored local copies; exact-path review found no non-test consumer, `git ls-files web/test-results` is empty, and CI's separate ephemeral failure uploads remain unchanged.
- 2026-07-21: Completed the repository-wide Supabase CLI-state pass by untracking eleven additional duplicated `.temp` files across the nested Supabase and legacy web roots, adding the missing narrow web-root ignore rule, and retaining every physical local copy.
- 2026-07-21: Forward-untracked seven generated development/log/audit outputs and added exact ignore rules while retaining local copies. A value-free sensitivity review found no high-confidence or current local credential in the historical Yahoo log, so no history rewrite is warranted.
- 2026-07-21: Reconciled the current baseline using the installed ESLint 9 binary in explicit legacy-config/no-auto-fix mode because declared `next lint` is deprecated and conflicts with the enclosing config in the isolated checkout. The core `pages`/`components`/`lib` baseline is 0 errors/132 warnings across 1,497 files: 64 exhaustive-deps, 59 raw-image, five invalid ARIA-role, and four anonymous-default-export warnings. Strict representative lint additionally finds four unused directives.
- 2026-07-22: Dependency order is baseline/claim reconciliation → correctness/accessibility → stale suppression cleanup → wrapper/fallback proof → bounded image/hook batches → reproducible lint/toolchain contract → integrated verification. The first implementation scope was reordered ahead of hook/image candidates because all five correctness-class ARIA warnings shared one semantic repair. Native headers plus labeled actions, clipped/forced-colors focus, and render-safe parent state passed the initial gate. Final review registered and closed NEW 36–39 before publication: all three day-toggle views now use the stable `Include … games` on-state meaning, ascending/descending arrows match `aria-sort`, and both shared switch controls cancel repeated Enter/Space without extra callbacks. The corrected scope passes 2 files/6 focused tests, strict changed-scope lint at 0/0, full TypeScript, bundled-Node-24 Sass, Prettier, diff integrity, clean real-browser interaction from the unchanged layout/focus slice, and independent no-finding re-review. Fresh exact legacy-config/no-auto-fix reruns close NEW 44 with two explicit denominators: the baseline-compatible directory invocation is 1,499 files, 0 errors, and 127 warnings (64 hook dependencies, 59 raw images, four anonymous defaults, zero ARIA-role warnings), while the extension-complete JS/JSX/TS/TSX core is 1,500 files, 0 errors, and 129 warnings (64 hooks, 61 raw images, four anonymous defaults, zero ARIA). The only extension delta is `components/PoissonDistributionChart.jsx` and its two raw-image warnings. Because the directory denominator includes two zero-warning tests absent from its 1,497-file pre-change snapshot, only the stable five-to-zero ARIA cluster is compared like-for-like.
- 2026-07-22: NEW 21 removed exactly four behavior-neutral unused directives from homepage/stats/projections and retained the two active shift-chart hook suppressions with concrete mount-only/state-writing justifications. The four-page strict rerun has zero errors/unused directives and six unrelated warnings; one homepage regression and full TypeScript pass. A full core strict inventory expands the remaining rule-policy-dependent cohort to 37 directives, while `useVORPCalculations` adds two unused and four unknown-rule directives outside that denominator; these stay open under NEW 40/41. Direct Prettier checks expose pre-existing whole-file drift on the three legacy pages, retained separately under NEW 42 instead of creating formatting churn.
- 2026-07-22: Final publication review registered and closed NEW 43/44: historical checkpoint `36b3c38...` is labeled as historical scheduler/generated-state evidence rather than the latest B-CLEAN publication, and every current control distinguishes the 1,499-file/127-warning baseline-compatible invocation from the extension-complete 1,500-file/129-warning core audit.

## Acceptance Criteria
- Build passes with zero new errors
- Reproducible lint evidence reports exact pre/post file/rule/count and no reduction from broad ignores.
- Wrapper JSDoc, runtime fallback, error composition, and width/height-versus-fill contract agree and have direct tests.
- No functional behavior change (all pages still statically build)

## Open Questions
- Should we enforce migration of all `<img>` via a custom ESLint rule later? (Proposed follow-up)
- Any pages expected to remain legacy (skip modernization)?

## Approvals Needed
- Sign-off on wrapper API
- Confirmation on acceptable partial suppression strategy

---
Generated: 2025-09-11

## Hook Audit (Current 2026-07-21 Snapshot)
Tracking representative warnings to address or justify. The current core baseline has 64 exhaustive-deps warnings; this table is a bounded cohort, not the complete inventory.
| File (excerpt) | Line | Type | Action Plan |
|----------------|------|------|-------------|
| pages/db/upsert-projections.tsx | 248 | (resolved) | Moved FIRSTNAME_ALIASES to module scope; callback no longer needs dep |
| pages/goalies.js | current lint clean | resolved | `selectedStats` is present in the effect dependencies |
| pages/projections/index.tsx | 973 | unnecessary deps | Trim extras to only derived inputs |
| pages/shiftChart.js | 331/543/550/1099 | four missing-dependency warnings | Inspect actual closures; two nearby suppressions lack concrete justification |
| components/DraftDashboard/ProjectionsTable.tsx | 237/577/621/792/898/980 | six missing-dependency warnings | Move true constants to module scope and verify each state/helper dependency before editing |
| components/GameGrid/GameGrid.tsx | 295 | dependency mismatch | Remove unread `currentNumGamesPerDay`, include actually read `teams`, and test delayed team-map arrival |
| components/TeamScheduleCalendar/TeamScheduleCalendar.tsx | 722/1013 | two missing-helper warnings | Evaluate helper identity and recomputation cost; do not suppress speculatively |
| components/TeamDashboard/TeamDashboard.tsx | 1120 | complex state deps | Consider useReducer or include gated accessors |
| components/WiGO/NameSearchBar.tsx | current lint clean | resolved | Current filtered-player ownership no longer warns |
| components/WiGO/PerGameStatsTable.tsx | current lint clean | resolved | Current player identity dependencies no longer warn |

Next dependency-eligible local pass starts with NEW 22/23 wrapper/fallback correctness. NEW 20 remains a material package-manager/toolchain strategy checkpoint; NEW 40/41 depend on that lint-policy decision, and NEW 42 remains separately scoped formatting work.
