# FORGE independent verifier (automated witness): local candidate, November 19, 2026

**Status:** local, disposable rehearsal only. Nothing was pushed, and nothing in production changed: no migration, no
environment variable, no cron job, no deployment. Base: origin/master `66ce25aa3`.

## Purpose

TJ ruled on Nov 19 that an automated off-writer verifier may substitute for a named human witness once it passes an
isolation rehearsal. A DigiCert token alone does not count. This candidate is that verifier.

It runs apart from the FORGE writer:
- its own GET route, `/api/v1/db/forge-witness-verify`;
- its own one-shot cron job;
- its own NOLOGIN role, `forge_witness_api`, with a JWT of at most 12 h in `FORGE_WITNESS_API_TOKEN`.

It does not use a LOGIN role, the service role, or a signing secret in the app.

For each armed game the route:
1. reads the committed claim back from the database;
2. recomputes the raw and canonical digests from the stored bytes;
3. checks the game, claim, release and team bindings, and the stated input cutoff;
4. checks the witness statement;
5. re-verifies the retained RFC 3161 token against the released `digicert-g4-v1` pin (hardcoded; no env override);
6. checks the custody order and T−60, using the database clock only.

The database then re-checks everything it can on its own and stores an immutable verdict. Stored verdict fields
(witness verdict, outcome) are only preconditions; they never replace a check.

## Objects (`forge-witness-verifier.sql`, sha256 `c0899971b04b09a4be20fabfc60b88265359941ae02065d8b60e05930d3ff4b7`)

**Roles**
- `forge_witness_owner` (NOLOGIN) owns everything listed below.
  - Its only privileges outside its own schemas are USAGE on `forge_pregame_capture` and SELECT on its five custody tables.
  - It has no members after install: the installer's temporary membership is revoked in the same transaction.
- `forge_witness_api` (NOLOGIN) is granted to `authenticator`. It has USAGE on `forge_witness_api` and EXECUTE on that schema's three wrappers, and nothing else.

**`forge_witness` (private schema)**
- `targets`: armed games. Inserted only by `arm_v1`, which only the installer can execute. It refuses a game whose schedule the verifier cannot read (start plus both team rows).
- `verdicts`: the receipt.
  - Unique per claim and per game.
  - The update/delete/truncate triggers are ENABLE ALWAYS, and RLS is on.
  - Hashes, cutoff, start and deadline are copied from the custody rows, never from the caller.
  - `verified_at` is the DB clock at insert.
  - A CHECK requires `verified_at ≤ deadline_at` for an accepted verdict.
- `schedule_v1(game)` is the one helper owned by the installer. It reads `public.games`, `teams` and `roster_optimizer_team_games` (RLS; team games FORCE), and only the owner can execute it. An invisible games row or missing team rows fail closed, and nothing is stored.
- `publication_gate_v1(claim, raw, canonical, token_sha)` returns `{accepted, reason, verifiedAt, deadline}`.
  - `accepted` is true only for an accepted verdict on exactly that claim and those hashes, and only if the hashes still match the custody rows.
  - The verdict must be verified at or before `least(claimed start, current games.startTime) − 60 min`, recomputed from the claim rather than taken from the stored row. An invisible current start refuses; it never falls back to the claimed start.
  - `require_accepted_v1(...)` raises 42501 `witness_verdict_required` unless that holds.
  - Both are executable by `service_role` and the installer only.

**`forge_witness_api` (exposed schema; SQL definers)**
- `pending_v1()`: armed games without a verdict from the last 2 days, at most 16.
- `evidence_v1(game)`: status `not_armed`, `claim_missing`, `not_terminal`, `decided` or `ready` with the full evidence.
- `record_v1(...)`: records the verdict.
  - The database turns a client "accepted" into a stored rejection when any of its own checks fail: artifact, fence, outcome, witness, hashes, token digest, cutoff, schedule, custody order, witness bounds, or its own clock past T−60.
  - Operational gaps (no terminal outcome yet, schedule invisible) raise and store nothing, so they are retryable.
  - A repeat call returns the stored row with `created: false`.

## Rehearsal (`check_witness.py`, exit 0; [LOCAL-PROOF.json](LOCAL-PROOF.json))

Run on PostgreSQL 15.19 and PostgREST 16.6, with `db-schemas=public,graphql_public,forge_witness_api`. The stand-in public schema is the sandbox rehearsal's populated fixture platform. `games`, `teams` and `roster_optimizer_team_games` carry production's RLS, so the owner cannot read them directly.

| Check | Result |
| --- | --- |
| Install | A second apply refuses. Outside the witness schemas the full dump differs only by `GRANT USAGE ON SCHEMA forge_pregame_capture` plus five `GRANT SELECT` to `forge_witness_owner`. The only new roles are `forge_witness_api` and `forge_witness_owner`, both NOLOGIN, no BYPASSRLS, no CREATEROLE. The only membership change is `authenticator` gaining `forge_witness_api`. The owner has no members. |
| Isolation audit | `prod-isolation-witness.sql` returns **ok** before install, after install and after the runs. It finds no receipt writers outside the owner, no writable exposed relations, no exposed definers outside the API schema, no owner-owned dynamic-SQL definer reachable by the writer (superuser- or CREATEROLE-owned ones would be listed for review), 4 ALWAYS triggers, and a schedule helper owner that bypasses RLS (otherwise the verdict is unsafe). |
| Writer | The real `runHostedPregameGame` ran as `service_role` (the live writer's credential): **qualified**, 1 TSA call, 147 REST calls, all `service_role@public`. |
| Verifier GET | **200**, ~40 ms. 42 REST calls in total, all `forge_witness_api` token on profile `forge_witness_api`. No other network traffic. |
| Real claim | **accepted**. `verifier_role = forge_witness_api`, release = HEAD, hashes equal custody, `deadline_at = scheduled_start − 60 min`, verified about 60 min before it. |
| Rejection matrix | Each synthetic claim has exactly one defect on its own cloned schedule. Results: **artifact_missing**; **game_binding** (packet names another game); **claim_binding**; **hash_mismatch** (stored canonical); **cutoff_mismatch**; **token_invalid** for a tampered token; **token_invalid** for a wrong-profile token (other TSA policy); **witness_late** (TSA bound after T−60); **verification_late** (verifier runs after T−60); **schedule_changed**. `claim_missing`, `not_terminal` and `schedule_unavailable` (team rows removed after arming) record nothing. The route's verdict and the database's verdict agree in every case. |
| Duplicates | A second GET creates nothing. A direct second `record_v1` returns the same row with `created:false`. In a parallel race of two GETs on a fresh claim, one records and one returns duplicate; there is 1 row. |
| Database re-checks | A client "accepted" after T−60 is stored as **rejected:verification_late**. A client "accepted" with a wrong canonical hash is stored as **rejected:hash_mismatch**. A claim not belonging to the armed game gets 400 and stores no row. |
| Publisher gate (as `service_role`) | The real claim with the exact hashes is **accepted**. Wrong canonical or token hash: `hash_mismatch`. Rejected claim: `verdict_rejected`. Unverified or unknown claim: `verdict_missing`. Superuser-forged accepted row with a lying deadline: `verified_late`. An accepted verdict whose games row then becomes invisible: `schedule_unavailable`. `require_accepted_v1` raises `42501 witness_verdict_required`. |
| SQL denials | 70 attempts as `service_role`, `anon`, `authenticated`, `authenticator` and `forge_witness_api` all failed with **42501**: insert, update, delete or truncate verdicts; disable triggers; drop; create objects in either schema; insert targets; call the private record or arm; call the API wrappers (non-witness roles); read custody (non-writer roles). The owner itself gets the immutable trigger on update, delete and truncate. |
| HTTP denials | `service_role`, `authenticated` and anon calling the witness RPCs: 403/401. `Accept-Profile` or `Content-Profile` `forge_witness`: 406. The witness token on `public.games` (read or write) and on public custody RPCs: 403. The witness token on `forge_witness`, `forge_pregame_capture`, `pgsodium` or `vault`: 406. Recording for an unarmed game: 403. Malformed verdict: 400. Positive control `pending_v1`: 200. |
| Cron ops | Arm, then two fires, then `fires_spent`, after which the job has unscheduled itself. No secret appears in `cron.job.command`; the bearer comes from Vault `cron_secret`. Readback shows the fires, the responses, the target and the gate. Re-arming a decided game is refused, and so is arming a game with no readable schedule. Disarm leaves the WGO job intact. |
| Reset (local only) | The schema-only dump outside returns to exactly its pre-install state; roles are restored. |

Unit tests:
- `independentVerdict.test.ts`: 34 tests. Every reason, the T−60 boundary, an invisible games row or team row (no verdict), a fixture token under the released DigiCert pin (rejected), and DigiCert's real probe token under that pin (accepted, the positive control).
- `forge-witness-verify.test.ts`: 17 tests. Method, params, cron auth, release pin, token role and lifetime, schema and credential, fail-closed, idle, not_terminal.

Gates (receipts are in the shared notes folder):
- `npm run typecheck`: exit 0.
- eslint on the new files: 0 errors.
- vitest on `__tests__/pages/api/v1/db`, `lib/projections/pregameCapture`, build admission and verified releases: 96 files, 1745 passed, 1 skipped.
- FORGE producer closure: unchanged at **`78655939…`** (already verified), so production build admission **passes** without a new entry.
- `npm run test:full`: 1471 files passed and 4 failed; 21063 tests passed and 22 failed.
  - 21 of the failures fail identically on an untouched `66ce25aa3` clone: `nstBypassGuard`, `supportedBaselineMigration`, and 19 in `blsh/nativeProcessCaptureBootstrap`. They are pre-existing and outside this lane.
  - The other, `nst/requestBudget`, timed out at 5 s under load and passes on its own (21/21).
  - None touch the verifier.

Retry log (TJ's rule): runs 1–8 failed on harness issues, each diagnosed, fixed and rerun on the same inputs:
1. The pre-install audit cast a missing schema.
2. The audit output parse.
3. The cloned schedule ids.
4. A parameter type.
5. A bigint-as-string comparison.
6. The readback `set_config` line.
7–8. The pg_dump `\restrict` nonce.

Run 9 passed. Runs 10 and 11 reran after type fixes. A review then found two product gaps, both fixed and covered by new cases:
- The gate's `least()` fell back to the claimed start when the games row was invisible. It now refuses.
- Fewer than two team-status rows became an immutable `schedule_changed` rejection. They are now `schedule_unavailable`: no row, retryable.

At the same time, arm now requires a readable schedule, and the audit now also flags CREATEROLE-owned dynamic definers and an installer that cannot bypass RLS. Run 12 passed on that code.

## Production change list (for TJ's approval; Chef applies)

1. **Audit:** run `prod-isolation-witness.sql` (read-only) before and after. Expect `verdict` ok (or review items only) and `installer.bypassrls = true`.
2. **Database:** apply `forge-witness-verifier.sql` as `postgres` (sha above).
3. **Data API:** add `forge_witness_api` to the exposed schemas.
4. **Publisher:** the live `forge_pregame_publish_v1` (forge-get-adapter lane) calls `perform forge_witness.require_accepted_v1(claim, raw, canonical, token_sha)` inside its transaction. If the publisher runs as a role other than service_role or postgres, grant EXECUTE to it.
5. **Vercel `fhfhockey`, production:** `FORGE_WITNESS_API_TOKEN` via `witness_token_setup.py --hours 11` (stdin only; at most 12 h).
6. **Deploy** a master that contains this route.
7. **Arm per game:** `arm-witness-verify.sql -v game=… -v schedule='m-m h d M *' [-v max_fires≤3]`. Choose minutes after the capture's qualified outcome and at least 3 min before T−60.
8. **Afterwards:** `readback-witness-verify.sql`, then `disarm-witness-verify.sql`.

Receipts stay; `reset-witness-local.sql` is for disposable databases only.

## Limits

- This is local evidence. The hosted Vercel runtime, the real Data API gateway and a real DigiCert token on a live claim still need the isolated hosted run.
- The owner role itself can still disable its triggers. It has no members, so only someone able to grant themselves that role (the project owner) can do this. Superusers are out of scope.
