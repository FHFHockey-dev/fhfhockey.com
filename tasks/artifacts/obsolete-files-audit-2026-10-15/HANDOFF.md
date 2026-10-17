# Audit handoff

Task: repository-wide obsolete-file/duplicate/generated/asset/dead-code audit.
Owner scope: only `tasks/artifacts/obsolete-files-audit-2026-10-15/`.
Canonical branch/HEAD: `octoberBranch` /
`a8f58de6178e282acd3a71851c66f4a56b119f14`.

**Delivered early:** filesystem inventory, tracked-file coverage, static import
and document/asset checks, preservation evidence, prioritized findings and an
exact savings ledger. **Not delivered or claimed:** authorization to delete,
proof of external/manual non-use, a full semantic review of raw data/evidence,
or a future 06:56 UTC status observation.

## Parent review sequence

1. Read [report.md](report.md), especially the preservation exclusions and the
   distinction between footprint and savings.
2. Verify the narrow candidates in [savings-ledger.json](savings-ledger.json)
   against current ownership before assigning implementation. None of the
   cleanup actions below was performed.
3. Keep RSO/GameGrid files, task registers, shared configuration, the mirror,
   historical worktrees and research/evidence trees with their existing owners.
4. Link this report from the parent's register if useful; this audit did not
   update that register or send any third-party message.

## Task-ready follow-ups, in useful order

| Ticket | Exact scope | Acceptance / gate |
| --- | --- | --- |
| CLEAN-01: retire one-off root helpers | `patch_layout.js`, `find_templates.py`, `fix_templates.py`, `safe_properties.py`, `update_game_page.py` | Confirm no operator still needs them; preserve history and any meaningful inventory links; remove only the approved paths. Do not execute source-mutating helpers. No remote build is needed for approval or verification. Potential 32,739 B. |
| CLEAN-02: remove obsolete navbar hook/mock | `web/hooks/useHideableNavbar.ts`; mock at `web/__tests__/components/Layout/Header.test.tsx:54` | Confirm the current Header owns behavior; remove the obsolete mock with the hook; run the existing Header test and appropriate narrow type/lint verification. Keep active Header implementation unchanged. Potential 1,946 B, excluding unknown mock-byte reduction. |
| CLEAN-03: consolidate identical rankings research | The two `contextual-hockey-rankings/{research,workstation}/deep-research-report.md` paths and exact consumers listed in `duplicate-documents.json` | Choose one canonical copy, migrate correct relative/root links and keep a supersession pointer where old paths matter. Verify byte equality again first. No task requirements or historical evidence may disappear. Upper bound 28,167 B before pointer overhead. |
| CLEAN-04: stop tracking generated CMS bootstrap | `cms/.sanity/runtime/app.js`, `cms/.sanity/runtime/index.html`; narrowly scoped ignore rule only after shared-config ownership clears | Verify local `sanity dev` regeneration with the owning CMS toolchain; preserve physical files and all Sanity v2 archive-in-place files. Untracking alone saves no local disk bytes. No production deployment/build. |
| CLEAN-05: review remaining tiny candidates | `web/utils/scrollTop.ts`, `web/debug-goalies.ts`, `fix_terminal.sh`, `web/npm` | Resolve operator/history/marker use; do not invoke the DB script. Preserve the modularization references for the terminal helper. Potential 1,132 B. |
| CLEAN-06: idle metadata cleanup | Exact ten `.DS_Store` paths plus `web/tsconfig.tsbuildinfo` from `savings-ledger.json` | New cleanup authorization and inactive-owner check; preserve active `.next` and pytest caches. No deletion during this read-only task. Potential 1,008,857 B logical. |
| REVIEW-01: asset ownership review | The 78 `owner-review-no-permitted-runtime-literal` rows in `asset-dispositions.json` | Ask the CMS/design/product owner about external embeds and manual uses; keep dynamic team logos, manifest icons and font licenses. Select exact files only after evidence. No projected saving yet. |
| REVIEW-02: stale instruction entry | `AGENTS.md` webhooks map/command lines | Parent serializes with the current editor; reconcile against recorded service retirement and the current README. Documentation-only, build-free; no code cleanup follows. |

No source-retirement permission is inferred from this table. Existing broader
task/PRD owner decisions and unfinished rows remain open; reuse the prior audit's
crosswalk instead of copying its 341 Archive labels into deletion tasks.

## 06:56 UTC checkpoint

This handoff was prepared before the deadline. At 06:56, the parent should report:

- Inventory/static audit delivered; **zero cleanup, deployment or production
  requests performed** by this lane.
- Latest observed branch/HEAD and timestamp, using `checkpoint-verification.json`
  and any newer parent evidence. Do not label the earlier snapshot as a 06:56
  observation.
- Completed coverage: all filesystem metadata, all tracked paths, permitted
  source/document graph and all public-asset dispositions. Limits: excluded
  sensitive/research bodies, manual/external/CMS use, and full runtime reachability.
- Unresolved: candidate-owner decisions, link-preserving consolidation, CMS
  regeneration proof, any concurrent changes since the saved hashes.

Safe read-only status check:

```sh
cd /Users/tim/Code/fhfhockey.com
git branch --show-current
git rev-parse HEAD
git status --short
```

Recheck only selected candidate hashes/reference changes if the parent proceeds;
do not rerun a full application suite or broad scan just to refresh a timestamp.
Do not prune the 76 missing worktree bindings or delete archive refs. All 193
branch archive mappings matched when checked; historical dirty worktree contents
remain intentionally uninspected.

## Operations and transfer

All audit processes finished. No audit server, background writer, child worker
or remote operation remains running. Application/editor processes observed in
the cache-use check belong to existing owners and were not stopped. The parent
may take ownership of this completed report directory after reading the handoff;
all other file ownership is unchanged. No shared task register was edited.
