# Managed-signer proof (disposable, local only)

Run with `./run-proof.sh` (about 10 s). Nothing touches production, the canonical checkout's Git state, or any cloud account.
The runner `git archive`s Y `1efdfb4364dffa73a9c249f382dbfebe22ebbbd2` into `/private/tmp/blsh-signer-proof/y` and links the
canonical `web/node_modules` read-only. It copies `harness/managedSigner.proof.test.ts`, `signer/`, `harness/` and `sql/` into
that export, then runs Vitest on Node 22.23.4. It never sets `GIT_DIR`, and it never commits, checks out or creates a worktree.

Result of the recorded run: **14/14 tests passed, 106 PASS lines, 4 FINDING lines and 3 RESIDUAL lines** (`out/vitest.txt`, `out/proof-log.txt`).
- 7 tests cover the AWS design (PROPOSAL.md, superseded).
- 4 tests cover option V1b (PROPOSAL-SUPABASE.md). Their lines are prefixed `V1`.
- 3 tests cover the E2 boundary, the R2 cron/pg_net reach and the password rotation (E2-PLAN.md). Their lines are prefixed `E2`.
  - The pg_cron stub follows pg_cron 1.4.2 semantics: jobs are keyed on (jobname, username), the caller is recorded as the owner, a non-owner unschedule needs DELETE on `cron.job`, jobs run as their owner, and RLS policies apply.
  - The harness Postgres now also listens on loopback TCP with SCRAM passwords, so the rotation is tested for real through the `pg` client.

## What is real and what is a stand-in

| Piece | In the proof | Real in production |
|---|---|---|
| Request-context verifier | **Real.** Y's `createRequestContextHandler` behind a loopback `node:http` server, fed the exact bytes that Postgres `jsonb::text` produced | Same code, unchanged |
| Official verifier | **Real.** Y's `officialPilotHandler` behind loopback HTTP with Y's loopback TLS fixture for `api-web.nhle.com` (the same construction as `officialPilotHandler.testHelper.ts`) | Same code, unchanged |
| Approval byte layouts | **Real.** The signer's functions are asserted byte-equal to Y's `requestContextApprovalBytes` and `officialPilotApprovalBytes` | — |
| BLSH database | **Real PostgreSQL 15.19.** Y's six BLSH migrations, the pinned `INSTALL.sql` and `ARM.sql` (clock-shifted copies), the proposed `AUTOMATE-ONCE.sql`, `CANCEL-SIGNER-STEPS.sql` and the pinned `CANCEL-OFFICIAL-ONCE.sql` | Supabase production |
| Context custody functions | **Real.** `blsh_context_source_v1`, `blsh_context_claim_v1`, `blsh_context_object_v1` and `blsh_context_close_v1` | Same |
| Official claim | **Real.** `blsh_official_claim_v1`: slot, native binding, schedule hash and deployment | Same |
| Official objects and close | **In-memory stand-in.** The DB requires `acquisitionClass = vercel_direct_https`, and this run uses the loopback TLS fixture | Real RPCs |
| Native 12:05 capture | **Seeded.** Claimed through Y's real `blsh_capture_claim_v1` under INSTALL/ARM, then the packet rows are written in replica mode | Real capture (out of scope) |
| pg_cron | **Stub.** The real `cron.job` shape. The harness fires each job's stored command at its minute, on a simulated clock | pg_cron |
| pg_net | **Stub.** `net.http_post` stores `body::text`. A harness worker sends each request byte for byte and fills `net._http_response` | pg_net (body serialization to be confirmed in setup step S7) |
| Vault | **Stub table** plus `vault.create_secret` | Supabase Vault |
| AWS KMS | **Mock, a non-exportable stand-in** (`harness/mockKms.mjs`). Ed25519 keys exist only in memory in a closure, with no export accessor. The key policy is modelled: signer-role-only, `RAW` + `ED25519_SHA_512` only, an `aws:CurrentTime` fence and `DisableKey` | AWS KMS `ECC_NIST_EDWARDS25519` |
| DynamoDB ledger | **File-backed conditional put** (`createFileLedger`) | DynamoDB `PutItem` with `attribute_not_exists` |
| Lambda | **Loopback HTTP server** calling `signer/blshSigner.mjs` `createSigner().handle` | `signer/lambda-index.mjs` (not executed here) |
| V1b Edge Function | **Loopback HTTP server** calling `signer/supabaseSigner.mjs`. It talks to the database as `postgres` through psql, standing in for `SUPABASE_DB_URL`. Ed25519 is real `node:crypto`. The secrets table and ledger are real Postgres. | `signer/supabase-edge-index.ts` (Deno; not executed here) |
| V1b Vault grant behaviour | **Emulated.** `supabase_admin_emul` owns the objects and grants SELECT to `service_role`, and grants it to the non-superuser `project_postgres_emul` WITH GRANT OPTION, following Supabase's `after-create.sql` | The production grant state is checked by read-only line R1 |
| NHL public schedule | **Fixture function** | `https://api-web.nhle.com/v1/schedule/<date>` |
| Clock | **Simulated `Date.now`** at 2026-11-23. Postgres reads `fixture.at` through `fixture.wall_clock()` in the clock-shifted SQL copies | Real time |

**Not proven here:**
- that real AWS KMS returns a raw 64-byte pure-Ed25519 signature and DER SPKI (setup step S3 proves this with a disposable probe key);
- real pg_net's byte serialization and real pg_cron timing jitter (step S7);
- Lambda cold-start latency;
- the native capture itself.

## Files

- `signer/blshSigner.mjs`: the evidence policy and signing core (the proposed Lambda code).
- `signer/lambda-index.mjs`: the AWS adapter (KMS, DynamoDB, fetch). It is only syntax-checked here.
- `harness/mockKms.mjs`: the KMS stand-in and the file ledger.
- `harness/managedSigner.proof.test.ts`: the harness.
- `sql/AUTOMATE-ONCE.sql`: replaces the hand-run `SCHEDULE-ONCE.sql`. Its 12:45 command is byte-identical to the reviewed one, and the proof asserts this.
- `sql/CANCEL-SIGNER-STEPS.sql`: the new member of the disarm set.
- V1b files:
  - `signer/supabaseSigner.mjs`: the Supabase adapter, pull model, plus the in-Supabase keygen.
  - `signer/supabase-edge-index.ts`: the Edge Function entry.
  - `sql/SIGNER-SECRETS-SETUP.sql`: the private key table.
  - `sql/AUTOMATE-ONCE-SUPABASE.sql`: the V1b variant of AUTOMATE-ONCE. Its 12:45 command is still byte-identical to SCHEDULE-ONCE.
  - `signer/supabase-keygen-index.ts`: the one-shot keygen entry (Deno; not executed here).
  - `sql/R1-READONLY.sql`: the read-only production check. BLSH Chef ran it on production (`../r1-hosted-20261122/`); locally it ran only against the emulation (`out/r1-local-emulation.txt`).
  - `sql/R2-READONLY.sql`: E2's pre- and post-cutover readback (session counts, `service_role` cron/net reach, pg_cron health, terminate capability). It has been run only against the local emulation (`out/r2-local-emulation.txt`).
  - `sql/R1B-READONLY.sql`: the follow-up read-only check (roles granted to `authenticator`, and login roles). It has been run only against the local emulation (`out/r1b-local-emulation.txt`).
  - In the proof, `public.execute_sql` is recreated exactly as Y's migrations define and grant it.
- `out/`:
  - `vitest.txt`
  - `proof-log.txt`, one line per check
  - `signer-decisions.jsonl` (the AWS-design signer) and `supabase-signer-decisions.jsonl` (the V1b signer): decision codes and hashes only
  - `happy-ledger.json`
  - `live-sql-pins.txt`, the sha256 of the pinned live SQL that was used
