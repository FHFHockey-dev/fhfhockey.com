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

**State:** done locally. Rehearsal exit 0 (runs 9–12; run 12 after the review fixes: gate no-fallback, short team rows retryable, arm schedule check, stricter audit); typecheck 0; vitest 96 files/1745 passed; eslint 0 errors;
producer closure unchanged (78655939…), admission pass. Migration sha256 c0899971b04b09a4be20fabfc60b88265359941ae02065d8b60e05930d3ff4b7.
**Next:** Chef integrates `require_accepted_v1` into the live publish function (forge-get-adapter lane); TJ approves the
production change list in WITNESS-VERIFIER-LOCAL.md.
**Blockers / approvals:** which DB role runs the live publisher (asked Chef; default grant service_role + postgres).
Every production step needs TJ's approval.

**Gotchas**
- pg_dump emits a random `\restrict` nonce per run; strip it before comparing dumps.
- Fixture `roster_optimizer_team_games` ids were seeded explicitly; the id sequence is not advanced (clone with explicit ids).
- Audit SQL must not cast `'forge_witness'::regnamespace` before install (use to_regnamespace).
- pg returns bigint as a string; PostgREST returns it as a number.
