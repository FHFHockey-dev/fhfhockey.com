## Relevant Files

- `web/lib/lines/` — game state, binding, evidence, reconciliation and persistence.
- `web/pages/api/v1/lines/projected.ts` — shared game/team response with legacy fallback.
- `web/components/LineCombinations/ProjectedLineups.tsx` — stable entry and observation rail.
- `supabase/migrations/` — additive private append-only storage.

### Notes

Approved contract: planning thread `01a0fccc-f785-731a-9bb7-a23d58caf0f2` and delegated implementation instruction. Main entry stays stable during play; accepted PP observations carry forward by unit with origin attribution. No ES IGA carry-forward or forecast eligibility changes. Screenshot transcripts reviewed by parent; timezone, authenticity and game binding remain separate gates.

Owner: this implementation task. Baseline diff/status/hashes saved in `/tmp/lines-snapshot-baseline/`. Existing classifier, identity and forecast work is preserved. No workers: runtime model/effort cannot be verified with available tools. Use focused additions and one gated processor hook. No commits, deployments, production writes, migration application or historical replay.

## Tasks

- [x] 1.0 Preserve baseline and review approved contract.
- [x] 2.0 Add game state, evidence binding and deterministic entry/PP reconciliation.
- [x] 3.0 Add immutable storage and gated capture hook (depends on 2).
- [x] 4.0 Integrate shared API and accessible Lines presentation (depends on 2/3).
- [x] 5.0 Run focused tests, SQL isolation checks, TypeScript/lint and browser checks; record limits in `tasks/TASKS/lines-gdl-ingestion/game-line-snapshots-local-handoff.md`.
