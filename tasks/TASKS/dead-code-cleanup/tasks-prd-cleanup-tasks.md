# Codebase Cleanup and Warning Reduction — Tasks

## Relevant Files

- `tasks/TASKS/dead-code-cleanup/prd-cleanup-tasks.md` - Source PRD, baseline warning goals, progress claims, and hook-audit examples.
- `web/package.json` - Authoritative lint/type/build/test commands and dependency versions.
- `web/components/common/OptimizedImage.tsx` - Existing image-wrapper claim to verify before further rollout.
- `web/lib/images.ts` - Shared image helper claim to verify.
- `web/pages/stats/index.tsx` - Stats ref/key cleanup scope.
- `web/pages/index.tsx` - Image-migration pilot and current pre-existing homepage changes.
- `web/components/DraftDashboard/ProjectionsTable.tsx` - Hook-dependency audit candidate.
- `web/components/GameGrid/GameGrid.tsx` - Hook/image audit candidate.
- `web/components/TeamScheduleCalendar/TeamScheduleCalendar.tsx` - Complex hook-dependency candidate.
- `web/components/TeamDashboard/TeamDashboard.tsx` - Complex state/dependency candidate with pre-existing changes.
- `web/components/WiGO/` - Targeted hook warning candidates.

### Notes

- This list repairs the missing task pair for the cleanup PRD.
- Re-measure the current baseline; the 2025 warning count and completed claims are not current evidence.
- Preserve the heavily dirty working tree and avoid cleanup edits overlapping active features until the relevant diff is understood.
- Do not add suppressions merely to reduce counts. Every suppression needs a local reason and evidence that dependencies are intentionally stable.
- Image migration is behavior/layout work, not a mechanical warning deletion; verify sizing, loading priority, remote domains, and CLS.

## Tasks

- [ ] 1.0 Establish current warning/error baseline and ownership
  - [ ] 1.1 Discover the repository's actual lint/type/build commands and run the narrowest baseline that reports file/rule/count without auto-fix.
  - [ ] 1.2 Record errors and warnings by rule/domain and separate pre-existing dirty-feature ownership from safe cleanup candidates.
  - [ ] 1.3 Verify the PRD's completed ARIA, key/ref, OptimizedImage, and prior hook claims against current code/tests.
  - [ ] 1.4 Select a low-risk first-pass scope capable of at least a 25% warning reduction in that scope without behavior changes.

- [ ] 2.0 Fix correctness and accessibility warnings first
  - [ ] 2.1 Fix invalid keys, refs, DOM attributes, roles, labels, and ARIA state using semantic behavior rather than suppression.
  - [ ] 2.2 Preserve refs needed by cleanup functions through stable local captures and verify lifecycle behavior.
  - [ ] 2.3 Add/update focused tests only for meaningful interaction or accessibility regressions.

- [ ] 3.0 Resolve React hook dependency warnings safely
  - [ ] 3.1 Inspect each missing dependency for stale-closure correctness; include, move, memoize, or restructure it based on actual data flow.
  - [ ] 3.2 Remove unnecessary dependencies only when they are not read and removal cannot leave stale derived state.
  - [ ] 3.3 Stabilize helpers/objects at the correct ownership boundary instead of wrapping everything in `useCallback`/`useMemo` mechanically.
  - [ ] 3.4 For intentional omissions, add the narrowest single-line disable plus a concrete local justification and regression/direct verification evidence.
  - [ ] 3.5 Verify no render loop, duplicate request, stale state, or lost cleanup is introduced.

- [ ] 4.0 Verify and complete the image optimization pilot
  - [ ] 4.1 Audit `OptimizedImage` API, fallback, dimensions/aspect ratio, alt behavior, priority/loading, error state, and Next image configuration.
  - [ ] 4.2 Verify already migrated homepage/standings/game/mobile logos against layout and network behavior.
  - [ ] 4.3 Migrate only the approved pilot Game Grid/Team Leaders/homepage occurrences that have known dimensions and no incompatible external source.
  - [ ] 4.4 Document when raw `<img>` remains intentional and defer broad migration until pilot evidence supports it.

- [ ] 5.0 Reduce repetitive low-risk noise without speculative refactors
  - [ ] 5.1 Consolidate truly duplicate warning patterns into existing helpers when ownership and behavior are identical.
  - [ ] 5.2 Remove dev-only logs or gate them explicitly; do not hide operational error context needed in production.
  - [ ] 5.3 Tune ESLint rules only when the rule is systematically incompatible with repository architecture and targeted fixes cannot express intent.
  - [ ] 5.4 Avoid data-fetch, caching, bundle, or component architecture rewrites in this initiative.

- [ ] 6.0 Verify results and document the reusable pattern
  - [ ] 6.1 Re-run scoped and repository lint/type checks and report exact pre/post errors and warnings by rule.
  - [ ] 6.2 Verify touched pages/components directly, including loading/error/responsive and image layout behavior.
  - [ ] 6.3 Confirm zero new errors and no warning-count improvement achieved solely by broad ignores.
  - [ ] 6.4 Update the source PRD, this list, Relevant Files, and master ledger with evidence and remaining follow-ups.

## NEW Tasks

- [ ] NEW 7.0 Append every verified warning cluster, unsafe suppression, behavior regression, ownership conflict, and broader follow-up discovered during execution here before closure.
