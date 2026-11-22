# FORGE sandbox over a narrow PostgREST interface, Claude implementation lane, Nov 19

- **Scope.** TJ stopped the direct-login rollout over pgsodium `mask_role`. New design: exposed schema `forge_sandbox_api` (views and definer wrappers) and NOLOGIN role `forge_sandbox_api` granted to authenticator, with a pre-minted 24 h JWT. Capture only on master `dbe6a9e33`, with zero shared-module edits and production flags. Local disposable proof only; Chef applies anything in production.
- **Where.** Scratch clone, branch `chef/forge-sandbox-api`, ref `refs/rc/forge-sandbox-api-20261119`. Earlier lanes are kept:
  - `refs/rc/forge-sandbox-capture-20261119` (direct login, stopped)
  - `refs/rc/forge-sandbox-wip-20261119`
  - `refs/rc/forge-synthetic-get-20261119`
- **Checks.** `check_sandbox.py` exit 0 with PG15 and PostgREST 16.6:
  - GET 200 `capture_qualified` in 188 ms; duplicate GET 409 with no write.
  - All 148 route calls on the `forge_sandbox_api` profile.
  - Denial matrix 4xx, positive control 200.
  - Dump outside the sandbox identical; isolation `ok`; local production audit `ok`.
- **Gotchas.**
  - Master's capture transport refuses any profile other than `public`. The fix: the read client withholds the header, and `CaptureWiring.fetchImpl` re-pins `forge_sandbox_api`.
  - Mapping `service_role` to the owner made a migration revoke the owner's own rights, so it now maps to the API role and the grants are revoked privately.
- **Next.** TJ approval of the production change list in `SANDBOX-API-LOCAL.md`, then Chef.

## Live FORGE release package (same lane, later ticket)

- **Scope.** One approved, game-scoped live run (cron → capture GET → independent verdict → publish GET → both RSO readers), DB-fenced. Local and prod-schema-copy rehearsals only; nothing pushed.
- **Where.** Final release SHA 0e416721d (allowlist last; verifier 52126beb5 merged at e0e103c51, SQL 9673316c); both refs/rc/forge-live-release-* point there. Notes: forge-live-release-gates/FINAL-0e416721d.md, CONDITIONS.md, DELIVERABLE.md.
- **State.** Closure ca6534eb verified (243 modules, 0 findings). Live migration b546ea3e…; verifier migration 303e889a…. Real-verifier rehearsal exit 0. Full suite: same 27 pre-existing failures as master.
- **Gotchas.** Test fakes lacking `.is` (resume, runAdmission) — fixed. node-pg Date drops microseconds: pass timestamptz as text to the verifier, or it rejects with `cutoff_mismatch`. `migration-authority.json` is already 3 behind on master; this branch adds 2 more unregistered files.
- **Next.** Chef/TJ: approve allowlist commit, migrations, deploy; arm per LIVE-RELEASE.md.

## Writer gate / signed verdict (Track B + A integration), Nov 20 ~00:36Z

- **Shipped SHA (TJ-approved):** 294554a48 (= live release + execute_sql/CSV hardening + signed-verdict gate + Track A 4bce76f0c with prod key 469bc6093b6ffc11; allowlist last). Docs reconcile: 74a13233c (refs/rc/forge-live-release-*). Hardening ref: refs/rc/forge-writer-hardening-20261119.
- **Checks:** full suite 0 pass→fail vs master; typecheck, eslint, admission, both signed rehearsals green. Closure ca6534eb unchanged by the key pin.
- **Gotchas:** zsh `$F:r` modifier eats `:refs` (use `${F}:`); parallel heavy runs cause 5 s vitest timeouts; Track A Edge self-test needs its own bundle (in-process TSA re-pointing breaks it); fake NHL landing must match claim start to the microsecond.
- **Open:** record_signed_v1 DoS (service_role can pre-empt a signed row; fail-closed, accepted for tonight); execute_sql hardening optional, not applied; DB password rotation is defense in depth.
