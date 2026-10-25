# 2026-10-25 Claude TG — FORGE Testing Grounds lane (taken over from Codex)

## Scope
- Lane TG in CLAUDE-LEASES.json (leases[17]): exactly the 25 handed files (web/lib/forge-testing-grounds/**, page, 3 API wrappers). Artifacts → tasks/artifacts/claude-lanes-2026-10-25/TG/.
- Task: state map (S01–S05 + R1s) and the next offline slice with tests. No Git, no live/DB/model calls, no servers.
- Hard gates untouched: runner activation, real captures, storage/durability/cost/retention, sealing trust, scientific/statistical/model, owner config/env, auth verification claims.

## Where
- octoberBranch, base head per lease ac98431aa. Sole checkout /Users/tim/Code/fhfhockey.com.
- Slice receipts live in the recovery checkout: /Users/tim/Code/fhfhockey-workspace-recovery-2026-10-24/clean-checkout-2026-10-25-1505/files/tasks/artifacts/forge-testing-grounds-2026-10-24/ (repo copies are empty dirs).

## Checkpoints
- 16:5x local: 25/25 lease pins matched baseline before any edit.
- Read handoffs S01, S01-R1, S02, S03, S03-R1, S04, S04-R1, S05, S05-R1 + S05/S05-R1 reviews, owner-config/activation handoffs.
- Next slice picked: S06 validated run-store → OwnerReadStore adapter (S05 review "read-adapter limitation": payloads passed through unvalidated). Default exported routes stay unwired (inert). Store gains owner-scoped `list` for reconnect/history.

- S06 implemented: runStore.ts, memoryRunStore.ts, runnerContracts.ts (export jsonValue), ownerRoutes.test.ts (+13). Namespace vitest 146/146, scoped tsc + eslint pass. Pins rechecked: 4 changed, 21 identical. RECEIPT.md written.

## Next
- Orchestrator reviews and commits. Candidate next slices: a durable-store contract test kit (same schema against any adapter); the preview showing a list/reconnect state from validated projections.

## Gotchas
- heavy lock: /private/tmp/fhfh-heavy.lock; never GIT_DIR.
