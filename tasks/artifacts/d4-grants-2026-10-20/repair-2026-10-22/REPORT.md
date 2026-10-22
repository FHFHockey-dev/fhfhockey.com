# D4 local harness repair — October 22, 2026

Local implementation is ready for independent review. Fresh SQL runtime acceptance is blocked by
the current macOS sandbox. No migration bytes, canonical authority, application files, billing or
forecast implementation were changed. No existing database, credentials, network, installation,
hosted project, deployment or production endpoint was used.

## Change

- `harness.py` validates contiguous authority orders, unique canonical migration paths, every
  migration SHA-256, and the exact defaults/reviewed-grants pair at orders 89–90. Replay is
  1–88 → 89–90 → 91–97; later authority entries retain their position. A negative control omits
  only 89–90. It asserts the actual first-pass order before running assertions.
- Replay, bootstrap and test bytes are captured and hashed before cluster creation. Receipts
  bind those inputs. A new `--check` mode performs only the read-only hash/order preflight.
- `data_api_grants.sql` now matches the reviewed narrowing: 64 table-operation expectations,
  denied service EXECUTE on the unused promotion RPC, and sequence USAGE without SELECT.
  No browser expectation changed, and no privilege expectation expanded.
- Removed all reviewed-failure exemptions. Every `not ok` fails the run; receipts retain all
  failures, their counts and completion status. Failed execution returns a nonzero process status.
- Existing socket-only connection and minimal environment remain. The harness fails immediately
  if the shared heavy lock is occupied; commands have 60-second limits within a 300-second run
  budget. Shutdown has its own bounded checks. An uncertain shutdown preserves the owned cluster
  and lock instead of deleting them.
- `test_harness.py` covers current-chain ordering, hashes, negative-control omission, malformed
  migration pairs, historical receipt preservation and snapshot-only mode without starting a DB.

## Evidence

- **Passed:** 6 preflight regression tests; Python syntax checks; focused `git diff --check`.
- **Passed, offline:** 97 authority hashes match; all 76 table service expectations and 45 allowed
  RPCs match migration 90; the exact 66 changed expectations equal the 66 historical v7 failures.
- **Blocked:** [run-v9 receipt](../run-v9/receipt.json), before any bootstrap or migration SQL.
  Homebrew PostgreSQL 17.11 `initdb` failed with `could not create shared memory segment:
  Operation not permitted`, failing `shmget(..., size=56, ...)`. Receipt has `firstPassOrder: []`,
  `tests: {}`, `clusterStopped: true`, and `clusterRemoved: true`; the heavy lock was removed.
  The negative SQL run was not attempted because it requires the same denied initialization.
- [Verification and candidate hashes](verification.json), [full input hashes and order](preflight.json).
  The v9 receipt also binds the same harness and matrix hashes.

The failed operation was runtime sandbox enforcement, not an automatic approval-review rejection.
No escalation was attempted. The remaining environment need is permission for a **new disposable
Homebrew PostgreSQL cluster's shared-memory allocation and Unix socket**, with the same local-only
bounds. No existing DB access or hosted permission is needed for this replay. The binary reports
`shared_memory_type=mmap` as its default; changing only the main-memory setting does not establish
that the small denied shared-memory allocation is avoidable.

## Commands for the reviewer

From the repository root, read-only checks:

```sh
python3 -I tasks/artifacts/d4-grants-2026-10-20/test_harness.py
python3 -I tasks/artifacts/d4-grants-2026-10-20/harness.py v10 20261020224500_data_api_explicit_default_privileges.sql 20261020224600_data_api_reviewed_object_grants.sql --check
```

After resolving the local execution permission, use unused run IDs; preserve all existing receipts:

```sh
python3 -I tasks/artifacts/d4-grants-2026-10-20/harness.py v10 20261020224500_data_api_explicit_default_privileges.sql 20261020224600_data_api_reviewed_object_grants.sql
D4_NEGATIVE=1 python3 -I tasks/artifacts/d4-grants-2026-10-20/harness.py v11 20261020224500_data_api_explicit_default_privileges.sql 20261020224600_data_api_reviewed_object_grants.sql
```

Positive acceptance requires all four TAP suites green (expected current counts 1870, 34, 10, 205),
the existing workspace fixture exit 0, identical ACLs after reapplication, the exact canonical
first-pass order, and confirmed cleanup. The negative run should finish the intended chain and
tests, report D4 assertion failures, and exit 1; an initialization/replay error is not a successful
negative control. Do not interpret v9 as either a positive or negative SQL-test result.

PG15/platform-extension parity, real PostgREST/JWT acceptance and hosted catalog/application gates
remain separate D4 work. This repair does not authorize rollout, schedule-RPC implementation or
TJ's separate invoice/payment work.
