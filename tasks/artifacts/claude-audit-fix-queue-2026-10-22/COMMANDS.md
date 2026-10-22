# Offline audit reproduction

All original sources are pinned under `snapshot/`. Installed dependencies are reused through a node_modules symlink. No ignored environment files are present in the snapshot. The custom Vitest config limits worker concurrency and caches only under this audit folder. A Node preload rejects network sockets and HTTP(S); the extra setup rejects unmocked fetch.

Run from `/tmp/fhfh-claude-audit-20261022/snapshot/web` with Node 22.11.0 on PATH:

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin HOME=/tmp/fhfh-claude-audit-20261022/home TMPDIR=/tmp NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key NODE_OPTIONS='--require /tmp/fhfh-claude-audit-20261022/offline.cjs' npm test -- --run --config audit.vitest.config.mts lib/auditEdgecases.test.ts lib/auditStatsAsync.test.tsx lib/auditTemporalCutoff.test.ts
```

This audit-only command is expected to fail nine desired-behavior assertions against the pinned source. It does not alter the canonical repository. Each existing-suite log starts with the exact npm test file arguments that were actually run:

- `core-tests.log`: 8 files, 409 pass / 1 skip.
- `neighbor-tests.log`: 15 files, 450 pass / 4 failures.
- `model-tests.log`: 6 files, 234 pass / 1 audit-fixture ENOENT.
- `inventory-retest.log`: the missing referenced inventory was copied and hashed, then only that case was rerun; pass. The other 67 cases are filtered skips, not new skipped test evidence.

Synthetic finding receipts:

- `edgecases.log`: A2, A7, A5, A3, A6 respectively (five desired assertions fail).
- `coverage-universe.log`: A4 only (one fails; five filtered skips).
- `stats-async.log`: A8, A9 (two fail).
- `temporal-cutoff.log`: A1 (one fails).

The final six-test version of auditEdgecases includes the separately added coverage case. Its earlier five-case receipt remains valid; no previously run case was changed.

Pin files: `snapshot-start.json`, `status-start.txt`, `finding-file-fingerprints.json`, `supporting-doc-fingerprints.json`, `snapshot-end.json`, and `audit-files-sha256.json`. The source manifest hashes the original source files before any audit-only harness files were added. Audit-only files are listed separately in audit-files-sha256.json.
