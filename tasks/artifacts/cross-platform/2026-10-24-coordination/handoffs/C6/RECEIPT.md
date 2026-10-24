# C6 receipt: documentation pointer correction (2026-10-24)

Base: octoberBranch @ 2a5092d37. Documentation only: no Git writes, app code, package, migration, ledger or manifest changes; no test suites run (none apply).

## Hashes (sha256)

| Doc | Before | After |
| --- | --- | --- |
| `tasks/tasks-README.md` | `28fc17b6954a2d78660555cabd8124c30816bf761dc444f7d143706b711f2497` | `a03ee0d0ed649dc543d6cbb08d9cf2f624e7827e74b36dea45f2a8f33b6253df` |
| `tasks/tasks-prd-in-season-trust-clarity-decision-workflow.md` | `e4fc2b9ecdd0ac93dc93636a4ab0520fd499774f377fd70d7f77a9070591478b` | unchanged (same hash) |

Patch: [C6-DOCS.patch](C6-DOCS.patch) (`git diff` against HEAD; 1 line changed, README line 10).

```diff
-- `web/components/WiGO/WigoComparisonMatrix.tsx` — Existing uncommitted wide-screen matrix; preserve and verify alongside the standard table.
+- `web/components/WiGO/WigoComparisonMatrix.tsx` — Existing wide-screen matrix (committed since `2d38d1da5`); preserve and verify alongside the standard table.
```

## Corrected pointer

README "Relevant Files" described `WigoComparisonMatrix.tsx` as "uncommitted". Evidence:
- `git ls-files --error-unmatch` confirms it is tracked; `git status --short` for `web/components/WiGO/` shows it clean.
- `git log --diff-filter=A` shows it added in `2d38d1da5` (2026-09-20, a day after the list was generated on 2026-09-19); last touched in `26f04ef88`.
- `git merge-base --is-ancestor 2d38d1da5 HEAD` succeeds.

The "preserve and verify alongside the standard table" requirement is kept. This is a status note on a component file, not a WiGO site link, so it is outside C4's navigation ownership; C4's receipt records `tasks/tasks-README.md` as untouched.

## Verified and left alone

Checked every pointer in both docs against the current tree:
- All 22 README and 8 PRD markdown links resolve (relative to each doc), including the WiGO plans 00–19 and `LIVE-EVIDENCE.md`.
- All 28 `owner-decisions-and-evidence.md#…` anchors in the PRD match a current heading (the evidence file has 43 headings).
- Every backticked or bare source/test/spec path resolves in the tree (full path, or basename where the doc names a file without its directory; `planning.ts` is ambiguous between `rosterScheduleOptimizer/` and `rosterScheduleData/` but both exist).
- README parent-to-plan mapping is exact (parent N → plan N-1, titles match); 20 parents / 93 subtasks, as the 2026-09-19 receipt says.
- PRD 4.1 "README 1.0/13.0/17.0 (source plans 00/12/16)" matches the README; the October 2 evidence file says this correction was already made.

Left alone (historical or unfinished scope, not stale pointers):
- Audit-time line-number citations (`newsFeed.ts:214,245,513`, `PlayerPickupTable.tsx:1854` …) in the PRD "Evidence/files" lines: dated audit evidence, not navigation pointers.
- README Notes line 21 ("working tree already contains layout changes, an 84-game pace change…"): dated 2026-09-19 context that already says it is not a completion claim. Not re-verified item by item; left as historical.
- PRD lines 22/94/168 (open policy questions, calendar-runner and FORGE-script type failures): superseded in place by line 57 and the October 2 "Whole-web TypeScript recovery" receipt, and the PRD text already says so. Historical receipts kept.
- PRD 2.1 and 1.0 "producer lineage unresolved": the October 2 receipts (Drive leads, stored goalie writer runs, News batch timing, deployment attribution) narrow candidate producers but state the gates stay open. Possible optional addition for Codex/owner: a link from 2.1 to "Stored goalie writer run receipts — October 2". It is an addition, not a correction of a stale pointer, so not made.
- PRD line-186 / line-102 advisories ("navigation/RSO files contain user changes"): not judged stale; many `web/` files are still dirty in the shared tree.

No diary retired, nothing untracked or deleted. WiGO site-link findings for C4: none arose.
