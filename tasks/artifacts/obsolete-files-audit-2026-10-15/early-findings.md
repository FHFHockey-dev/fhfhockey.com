# Read-only cleanup audit: early findings

Scope: canonical checkout `/Users/tim/Code/fhfhockey.com`, `octoberBranch`,
HEAD `a8f58de6178e282acd3a71851c66f4a56b119f14`. Only this report directory is
owned by this audit. RSO, GameGrid, FORGE, shared configuration and task registers
remain with their existing owners. Nothing has been deleted, archived, moved,
pruned, reset, committed, pushed or deployed.

## Concrete findings available now

1. **Do not repeat the previous cache estimate.** The eight roots moved on
   October 13 remain absent. Their 3,718,838,842 apparent bytes are already in
   the prior recovery manifest, not new reclaimable bytes. A same-volume Trash
   move did not free physical disk space.
2. **The largest tempting target is protected.**
   `web/.next-codex-reconcile` is a 4,924,499,784-byte repository mirror, including
   embedded history and potentially unique work. Prior instructions explicitly
   retain it. Its `.next-*` spelling does not make it a cache.
3. **Current caches have users.** `lsof` found Node PID 55797 writing
   `web/.next/trace` and editor PID 65987 holding both pytest-cache ignore files.
   The measured `web/.next` footprint is 1,460,822,979 bytes. Preserve it during
   the active sprint.
4. **Branch reconciliation remains recoverable.** All 193 recorded branch
   archive mappings still resolve to the original SHA. Current worktree metadata
   lists 104 bindings, including 76 missing/prunable paths. Prunable metadata is
   not authorization to delete branches or recovery history. `master` is 17
   commits behind `octoberBranch` by ancestry; neither is a disposable branch.
5. **The strongest source-retirement leads are small.** The five root helpers
   `patch_layout.js`, `find_templates.py`, `fix_templates.py`,
   `safe_properties.py`, and `update_game_page.py` total 32,739 bytes. No current
   import/npm/CI caller was found. The four game-page helpers have no remaining
   legacy transformation targets in the current page; the modern page uses CSS
   modules. `patch_layout.js` assumes a web-directory working directory although
   it lives at repository root. Manual-owner confirmation and historical
   references still gate retirement; do not execute the scripts to test this.
6. **Only one exact duplicate document pair is confirmed in the permitted
   source-document scan.** The two contextual-ranking
   `deep-research-report.md` files remain byte-identical at 28,167 bytes each.
   Both paths have document consumers. Consolidation must retain one authority
   and repair/preserve the other path's links before reclaiming one copy.
7. **Several old findings are already resolved or intentionally retained.**
   Game-detail module styles now share `_game-detail-shared.scss` and both
   wrappers have runtime importers. TeamLanding CSS is a 290-byte compatibility
   comment. `cms/README.md` explicitly archives Sanity v2 configuration in place.
   Those are not newly deletable duplicates.
8. **Literal-reference counts overstate asset candidates.** The initial scan's
   115 assets without a runtime literal includes dynamically selected team
   logos, the webmanifest's 192px icon, and font license texts. These require
   different dispositions; the full report will separate them.
9. **Task names are not reliable duplicate evidence.**
   `tasks/prd-game-grid-refactor.md` concerns `/shiftChart`; the newer GameGrid
   evolution work concerns a different surface. RSO consolidated documents
   explicitly preserve older requirements and open acceptance gates.

## Coverage and remaining work

The metadata scan covers 231,818 regular files and 288 symlinks, 10,699,787,591
apparent bytes, all 5,093 tracked paths, no unreadable paths and no missing
tracked files. Symlinks were not followed. File-body reads exclude credentials,
environment files, raw outcomes/training/evaluation data, held experiment data,
Git objects, dependencies and generated output. No raw FORGE artifacts were read.

The permitted source scan covers 3,542 files and 441 source documents. Static
reference and ownership classification is in progress; this is not a claim of
line-by-line semantic review of every file. Remaining work: asset family
adjudication, script/dead-code shortlist, task/document link checks, and a
nonoverlapping savings ledger with explicit owner gates. The parent owns the
06:56 UTC sprint checkpoint; this is an earlier evidence checkpoint.
