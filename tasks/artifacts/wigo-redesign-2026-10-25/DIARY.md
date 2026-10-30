# 2026-10-25 claude — WiGO charts audit + one-page redesign (diary)

## Scope
Audit web/pages/wigoCharts.tsx + components/WiGO/** + hooks/utils for data accuracy; redesign to a no-scroll
one-page dashboard (all components visible, 90% max width) at 1440/1280/1024 + documented narrow fallback.

## Where
- Snapshot: /private/tmp/fhfh-wigo-redesign/web (rsync of canonical web/ 15:24Z; node_modules symlinked); base copies in ../base/web.
- Outputs: /private/tmp/fhfh-claude-outbox/WIGO/ — RECEIPT.md, WIGO-ONE-PAGE.patch, AUDIT-REPORT.md, LAYOUT-PLAN.md, screenshots/, fixtures/.

## Log
- 15:24Z snapshot. 15:40Z audits A/B/C written. TJ pop-up: "No-scroll ≥1280". TJ direct: remove workflow links.
- 15:55–16:30Z built fit/flow grid, transposed matrix, compact panels; logic fixes B-01, B-02, B-09, A-04, C-06, DIFF width.
- 16:35Z patch frozen (32 files, verified 32/32, no canonical drift). Vitest 168/168, e2e 7/7, tsc 0, eslint 0, pure OK.
- 16:37Z :3150 stopped; heavy lock released 16:34Z (C3 holds it since 16:36:55Z).

- 16:38Z freeze lifted: lease WIGO (64 paths @2f2b432). 16:39Z applied 28 leased files to canonical (all == lease baselines; reader fix preserved). Canonical: vitest 182/182, tsc 0, eslint 0, pure OK, e2e 7/7 on canonical :3150 (isolated). Outputs moved here. C-17 recorded.
- 16:44Z slip: unquoted heredoc ran backticked words; killed at a stdin-waiting `patch -p1`; 28 hashes re-verified OK.

## Current state / next
Leased changes live in canonical (uncommitted; Codex commits). E2E paths approved and applied 16:46Z (fixture ids made fictional; e2e 7/7 on canonical). Done: awaiting C7 review + Codex commit of COMMIT-PATHS.txt.

## Gotcha (new)
- Always quote heredocs (`<<'EOF'`) when the body contains backticks. Open P1 data items listed in AUDIT-REPORT.md (writer/recompute ones are ask-first).

## Gotchas
- Base .wigoDashboardContent grid rows minmax(760px…) leak into flow mode unless overridden.
- Vitest in the snapshot must use vitest.snapshot.config.mts (cacheDir outside the symlinked canonical node_modules).
- Our pure check must use node_modules/postcss + next/dist/compiled/postcss-modules-local-by-default.
