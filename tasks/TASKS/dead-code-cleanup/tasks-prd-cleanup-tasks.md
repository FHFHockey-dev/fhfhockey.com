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
- [ ] NEW 8.0 **P1 Git-history dependency-cache contamination:** remove only accidental `.pnpm-store/**` and `.npm-cache/**` payloads from the four post-`3d6d5ca` `oh my` commits and the current index without losing any non-cache commit, staged, unstaged, or untracked goal work; rewrite the pushed branch only after explicit owner approval.
  - Read-only value-free evidence: the three pushed commits contain 29,819 cache files (~547 MiB raw) and the first also contains 181 legitimate non-cache paths; local HEAD adds 9,994 cache paths plus six legitimate control artifacts. No project/user credential exposure requiring rotation was found; seven npm debug logs expose only the local absolute user path. History rewrite remains pending.
  - [x] NEW 8.1 Freeze the old local/remote commit IDs and value-free path/blob manifests that exclude both cache roots, then prove the rewrite boundary starts after `3d6d5ca` without treating that base as a reset target. Evidence: frozen base `3d6d5ca`, remote lease `357d69c78`, old local head `4d738d18f`, verified 330 MiB rescue bundle, base-applicable 2.2 MiB binary non-cache patch, staged/unstaged/untracked path lists, and two retained untracked snapshots; the refreshed 413-file archive has no AppleDouble members and round-trips with zero path/type/size/hash mismatch (2026-07-15).
  - [x] NEW 8.2 Perform the cache-only rewrite in an isolated clone, retain every non-cache tree entry from all four commits (including the first commit's real source work and the local fourth commit's six control artifacts), and add root ignore rules for both cache directories. Evidence: isolated candidate `d3746815c` contains three commits after the untouched base, zero cache paths, the preserved 181-path remote delta plus six-path local control delta, and only a final two-rule `.gitignore` commit; no shared ref, index, worktree, or remote was mutated (2026-07-15).
  - [x] NEW 8.3 Compare pre/post non-cache manifests and commit/path inventories before any remote mutation; fail closed on any unexplained non-cache difference. Evidence: remote head versus rewritten first commit and old local head versus rewritten second commit each have zero non-cache path differences; the final candidate differs only by `.gitignore`, descends from `3d6d5ca`, has zero reachable cache paths and zero blobs over 100 MiB, and its isolated worktree is clean. The original untracked snapshot remains retained while a refreshed `COPYFILE_DISABLE=1` archive and 413-record SHA-256 sidecar preserve the newer task-document state (2026-07-15).
  - [x] NEW 8.4 After explicit approval, update `octoberBranch` with `--force-with-lease` against the recorded remote head, never an unguarded force push, and verify the two cache roots are absent from rewritten reachable history. Evidence: owner supplied the exact authorization; three stable pre-push fingerprints, a 422-file untracked round-trip, exact working-tree reconstruction, and dry-run lease validation passed. GitHub accepted only `357d69c78 -> d3746815c` under the exact lease; a fresh bare clone resolves to the candidate with zero reachable/current cache paths and zero blobs over 100 MiB (2026-07-15).
  - [ ] NEW 8.5 Reconcile the current worktree with the rewritten remote using an index-only/mixed operation that leaves working files untouched; prove all previously staged, unstaged, and untracked non-cache work remains present before optional local cache deletion. Current evidence: owner fetch updated `origin/octoberBranch` to `d3746815c` and correctly stopped at divergence without merging; automated mixed reset is blocked only because this execution sandbox cannot create `.git/index.lock`. The final 424-file untracked archive and tracked patch round-trip exactly; owner must run the one remaining `git reset --mixed origin/octoberBranch` metadata action (2026-07-15).
- [x] NEW 9.0 **P1 checkpoint-commit discipline:** require explicit-path staging and coherent verified checkpoint commits before switching initiatives or entering provider/production/migration/deployment/history-sensitive work; inspect unexpectedly large staged sets and exclude dependency caches, generated output, secrets, local metadata, and unrelated work. Evidence: governing `process-task-list.mdc` now defines the checkpoint cadence, large-stage stop condition, dirty-tree exception record, and recovery-manifest fallback (2026-07-15).
