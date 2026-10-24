# P05 R1 — ambiguous identity remains unavailable

Local correction complete; independent review pending. This bundle supersedes the original P05 route/client hashes only for the four files below. It does not assert release acceptance or broader ownership-trends identity correctness.

## Exact application inventory and behavior

- `web/pages/api/v1/transactions/ownership-snapshots.ts`: emits `unavailableReason: "ambiguous_identity"` when direct mapping or name fallback finds conflicting Yahoo identities.
- `web/lib/dashboard/playerOwnership.ts`: preserves that reason (also for duplicate snapshot rows) and forbids a trend result from promoting the rejected identity. Ownership, delta and evidence remain null; sparkline is empty. Ordinary missing-source snapshots retain the existing trend fallback.
- `web/__tests__/pages/api/v1/transactions/ownership-trends.test.ts`: actual snapshot handler + actual trend handler + `fetchOwnershipContextMap` regression, with ambiguous and unique mapping controls; updates existing ambiguity assertion for the reason.
- `web/lib/dashboard/playerOwnership.test.ts`: positive missing-source fallback control.

Before: NHL 12 maps to Yahoo 112 and 113; only 112 has enough history for a trend. The snapshot rejects the mapping, but the combined client returns 60% fresh ownership and +10 delta. After: the combined result remains unavailable. The unique mapping and missing-source controls still return 60% / +10. The trends implementation was not edited.

## Verification and pins

All checks ran offline in sanitized `/tmp` snapshots with Node v22.11.0/npm 10.9.0, synthetic `.invalid` configuration, and the preserved socket/HTTP(S)/fetch denial setup. No network, database, provider, NST or paid API request occurred.

- Red: **1 failed / 2 passed / 41 skipped**, reproducing 60 instead of null through both actual handlers and the client.
- Green: **44 passed** (35 route and 9 client tests).
- Scoped ESLint and TypeScript: **exit 0**, no diagnostics.
- Scoped canonical `git diff --check`: **exit 0**.

Exact sanitized commands, working directories, results and receipts are in `COMMANDS.json` and `red.log`, `green.log`, `lint.log`, `types.log`. The commands inside that wrapper are:

```sh
npm test -- --run --config audit.vitest.config.mts __tests__/pages/api/v1/transactions/ownership-trends.test.ts lib/dashboard/playerOwnership.test.ts
npm exec --offline -- eslint --report-unused-disable-directives-severity warn pages/api/v1/transactions/ownership-snapshots.ts lib/dashboard/playerOwnership.ts lib/dashboard/playerOwnership.test.ts __tests__/pages/api/v1/transactions/ownership-trends.test.ts
npm exec --offline -- tsc --noEmit -p audit-p05.tsconfig.json
```

`correction.patch` is the narrow delta from the original reviewed P05 candidate, not a reconstruction against a moving HEAD. `FILE-HASHES.json` records exact before/fixed files, tested snapshot/HEAD and handoff HEAD. `fixed-source.tar.gz` contains those four tested files. Their bytes also match the final pickup snapshot. The accepted A5/A10 hashes and unchanged trends implementation are dependency pins. From repository root:

```sh
shasum -a 256 -c tasks/artifacts/p05-ownership-2026-10-22/r1/SHA256SUMS
```

Existing dirty work and shared canonical registers were not edited. No commits, pushes, deployments, migrations, dependency changes, credentials or runner/process actions occurred. No denied, pending or uncertain tool action; review is the remaining step. Broader source authority, standalone trend callers, saved-state retention, hosted behavior and full-project/browser checks remain outside this correction.

Administrative inventory: this handoff, `COMMANDS.json`, `FILE-HASHES.json`, `SHA256SUMS`, `EVIDENCE-SHA256SUMS`, `correction.patch`, `fixed-source.tar.gz`, `audit-p05.tsconfig.json`, four logs; continued task diary at `tasks/diaries/2026-10-22-codex-p05-ownership.md` (excluded from release candidates).
