# Slice03 R1 — pending outcomes budget correction

2026-10-24. Parent explicitly transferred the affected slice03 lease for S03-R1 after independent CHANGES REQUIRED. Canonical `octoberBranch`, HEAD `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`.

Exact application edits: `web/lib/forge-testing-grounds/runnerContracts.ts`, `memoryRunStore.ts`, `boundedWorker.test.ts`. Remaining slice03 source, all original packets/reviewer evidence, and slice04 are read-only. New exact artifacts here: `OWNERSHIP.md`, `HANDOFF.md`, `EVIDENCE.json`, `checks.log`, `r1.vitest.config.mts` plus config-generated local test cache. Existing task diary continues.

Bounded correction: charge accepted `pending_outcomes` only to an independent outcome-check counter and refund that claim's provisional computation attempt. Preserve genuine execution/failure budgets, delay, deadline, cancellation, lease fencing and sealing. Add optional positive integer `maxOutcomeChecksPerUnit`; legacy v1 manifests omit it unchanged and use their frozen `maxExecutionsPerUnit` as a separate availability-check cap. No old shape is rejected, no default field is inserted into the immutable plan/hash, and no unlimited polling is introduced. Reaching the availability cap stops operationally with `outcome_check_budget` while failed coverage stays zero and unavailable coverage stays pending.

Check budget: original unchanged S03-R1 reproducer and adjacent pending-run-deadline control; original owner runner file plus a few focused pending/computation/failure/cancellation regressions; scoped static checks only. Do not rerun unrelated review/timestamp/UI suites. No shared edits, live calls, servers, browser/build resources, migrations, paid work or Git operations.
