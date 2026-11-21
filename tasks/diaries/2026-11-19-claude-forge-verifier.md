# 2026-11-19 · Claude · FORGE independent verifier (witness) lane

**Scope:** automated off-writer verifier for FORGE pregame claims: own GET route, own NOLOGIN role and exposed schema,
immutable verdict receipts, publisher gate lookup, local PG15 + PostgREST 16.6 rehearsal. No production actions.

**Where:** scratch clone (session ee1d689a scratchpad `wv`), branch `chef/forge-witness-verifier` atop `66ce25aa3`;
fetched to canonical as `refs/rc/forge-witness-verifier-20261119`. Artifacts: `tasks/artifacts/forge-witness-verifier-2026-11-19/`.
Gate logs and failed-run receipts: shared notes folder `forge-witness-verifier-gates/`.

**Decisions**
- Roles `forge_witness_owner` (NOLOGIN, owns all, no members after install) and `forge_witness_api` (NOLOGIN, granted to authenticator).
- Private `forge_witness` (targets, verdicts, gate); exposed `forge_witness_api` (pending/evidence/record definers only).
- Owner reads the five custody tables directly. `games` / `roster_optimizer_team_games` have RLS (team games FORCE), so one
  installer-owned helper `forge_witness.schedule_v1` reads them; only the owner executes it. Not borrowing the writer's read_v1.
- Only definitive evidence failures write `rejected`; no terminal outcome / invisible schedule write nothing (retryable).
- DB copies hashes/cutoff/start/deadline from custody rows; client values are only compared. verified_at = DB clock.
- Route pins `digicert-g4-v1` in code. Rehearsal patches the profile object in-process only (sibling pattern).
- SQL lives under tasks/artifacts (not supabase/migrations) so no tooling can push it by accident.

**State:** done locally. Rehearsal exit 0 (runs 9–16; credential redesign at Chef/TJ gate: token in forge_witness.credentials, cron header, no Vercel env; run 12 after the review fixes: gate no-fallback, short team rows retryable, arm schedule check, stricter audit); typecheck 0; vitest 96 files/1745 passed; eslint 0 errors;
producer closure unchanged (78655939…), admission pass. Migration sha256 9673316c4e108f9ea8953603e7afd40009d62af828ae6eb21be2d2022651052a.
**Next:** Chef integrates `require_accepted_v1` into the live publish function (forge-get-adapter lane); TJ approves the
production change list in WITNESS-VERIFIER-LOCAL.md.
**Blockers / approvals:** none open in-lane. Chef (Nov 19) adopted this interface as canonical: the live publisher runs as service_role; Data API list public, graphql_public, storage, analytics, forge_witness_api.
Every production step needs TJ's approval.

**Gotchas**
- pg_dump emits a random `\restrict` nonce per run; strip it before comparing dumps.
- Fixture `roster_optimizer_team_games` ids were seeded explicitly; the id sequence is not advanced (clone with explicit ids).
- Audit SQL must not cast `'forge_witness'::regnamespace` before install (use to_regnamespace).
- pg returns bigint as a string; PostgREST returns it as a number.

## Track A — signed verdicts (Nov 19–20, TJ ticket via Chef)
- Why: prod Vercel env holds POSTGRES_URL (postgres) + SUPABASE_JWT_SECRET; service_role EXECUTEs public.execute_sql. DB grants
  cannot stop the writer, so verdicts are Ed25519-signed by an Edge Function whose key is only an Edge secret.
- Where: tasks/artifacts/forge-witness-signed-2026-11-19/, supabase/functions/forge-witness-verify/, lib signedVerdict.ts,
  witnessEdgeCore.ts, witnessSigningKeys.ts (EMPTY = fail closed). Delta SQL sha256 da786646…; bundle release ea9b9100….
- Decision: start/T−60 from the NHL API, not the DB (writer can move games.startTime). DB checks are defense only.
- State: check_signed.py exit 0 against prod schema+grants restore; all six writer attacks succeed in DB and are refused by
  gate and audit; untouched verdict passes. Gates green. Deno not run locally (deploy smoke test is the first Deno run).
- Gotchas: prod authenticator preloads supautils (reset locally for PostgREST); jsdom lacks AbortSignal.timeout (vitest
  needs `@vitest-environment node`); never `cat >` without a heredoc in this shell (it blocks on stdin).
- Next: TJ keygen (pins public key) → rebuild bundle → deploy function → live lane wires assertSignedVerdict → arm.
- Review fixes (00:20Z): runtime self-test before judging; Data API gate read; cron ops proven on prod restore; packet-size bench.
- 00:23Z: with TJ's pop-up approval, generated the production witness key (keyId 469bc6093b6ffc11); private key only in the scratchpad 0600 file witness-key/forge-witness-signing-key.env (outside repo); public key pinned; bundle release ac4e3c94….
