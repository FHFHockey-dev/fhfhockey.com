# Local PostgreSQL test receipt

2026-10-29, final run completed before 13:37 UTC. PostgreSQL 15.19 Homebrew, fresh disposable cluster, private Unix socket, `listen_addresses=''`, synthetic rows and stub dependencies. No hosted connection.

Command from the canonical repository root:

```sh
python3 -I tasks/artifacts/supabase-access-audit-2026-10-29/review-candidate/run-isolated-tests.py
```

The first sandboxed attempt failed during `initdb`: `shmget ... Operation not permitted`. A subsequent approved unsandboxed run passed, then the fixture was strengthened to exercise actual upsert conflict updates and rerun successfully. The final run reported:

```text
PASS: legacy ACL, RLS, service behavior, PUBLIC function impact and rollback
PASS: real pending migration grants, RLS and synthetic service upserts  [broad defaults]
PASS: real pending migration grants, RLS and synthetic service upserts  [opt-in defaults]
PASS: all isolated fixture phases
stop isolated PostgreSQL: exit 0
Released own shared heavy lock
```

An independent `pg_ctl status` against the exact final data directory returned `no server running` (exit 3). The shared lock was absent at the subsequent observation; this is not a reservation. The stopped test cluster and log remain at `/tmp/fhfh-supabase-acl-audit-s13wdzjz`. Tests executed no production data or endpoints.

SHA-256 pins:

| File | SHA-256 |
| --- | --- |
| `supabase/migrations/20261026200000_rso_yahoo_past_lineups.sql` | `bec40282d7b923960d859160ebf079c848d19a8ab860968361ef936b650c1603` |
| `supabase/migrations/20261027090000_forge_reserve_projections.sql` | `1ca5816e835da899833499cc95d345a9253227ea176898c1ca2ba382fdd55da8` |
| `01-future-forge-grant.sql` | `c7c6e4c41d341a9d79293de8a44d2f714997cb0c5b9760bac53f097d4f1425b0` |
| `02-legacy-operational-tables.sql` | `2a4ac67b7b26641d1d070d29e76a5e01c03260b7d4e8b4b124b715c3bf847fe3` |
| `02-legacy-operational-tables-rollback.sql` | `fbd635e22601ccf5a9168ab7c6a26ca2ab6c05f4a4c1566c52c955e8b9b6ad32` |
| `03-legacy-acquire-lock-function.sql` | `93676c4af03cdce6a0e9794b4c492b039a87e091ecd9d944ce5f705d1e659852` |
| `03-legacy-acquire-lock-function-rollback.sql` | `0d5fd4ebc48a708fa22f61a296058e84644ba4de6f2852c3e62a42561429fc11` |
| `legacy-fixture.test.sql` | `8d1d51f8bd2ef8c5335c004d514f378e151b5ecb3913513a902f77f75e29acb3` |
| `future-fixture.test.sql` | `5ea29418eafe0ac0dc531d033dcef89439e7460848641101b0808a2b85a80bfc` |
| `run-isolated-tests.py` | `6fa5463c11b543fdaa66e0c7894960584f3201a0f0456b8ade591670ad51d548` |

The runner checks the two pending migration hashes before and after execution. It does not prove full migration history, hosted grants, PostgREST behavior or real JWT semantics.
