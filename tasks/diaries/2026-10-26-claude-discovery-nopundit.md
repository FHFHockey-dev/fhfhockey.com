# Diary: DISCOVERY-NOPUNDIT (2026-10-26, Claude)

## Scope
Audit F3: remove the pundit `PROJECTIONS_*` count reads and their health metadata from Draft Rankings discovery. Add a structural guard for `lib/draft-ranker/**`. No commits (orchestrator commits). No DB/prod calls; never run the refresh route.

## Where
- Branch `octoberBranch`, canonical checkout. Lease DISCOVERY-NOPUNDIT: discoveryServer.ts, discoveryReadServer.ts, refresh-draft-ranker-discovery.ts, discovery.test.ts.
- Baseline hashes matched the lease at start.

## State
- Readers checked: discoveryReadServer.emptyMessage (handles missing projection rows: falls through), DraftDiscovery.tsx (counts health rows only), refresh route (uses projectionConsensus.length), RPC (needs arrays, <=100 health rows), cron-audit test mock. Plan: keep `projectionConsensus: []`, drop the nine `projection:*` health rows, note in sourceSummary.

- DONE: pundit reads removed from discoveryServer.ts; 2 tests added in discovery.test.ts. Draft-ranker vitest passed (84), adjacent suites passed (188), eslint clean, tsc exit 0 under the heavy lock. Receipt: tasks/artifacts/projection-table-audit-2026-10-26/DISCOVERY-RECEIPT.md (hashes inside).

## Next
Orchestrator reviews and commits. Retire this diary after the commit.

## Gotchas
- `rg --include=*.ts` style globs fail in zsh; use rg -g.
- Whole-project tsc runs out of memory on the default heap; use NODE_OPTIONS=--max-old-space-size=8192 (about 60s).
- discoveryServer.ts already had one prettier difference (line 178) before this change; I left it.
