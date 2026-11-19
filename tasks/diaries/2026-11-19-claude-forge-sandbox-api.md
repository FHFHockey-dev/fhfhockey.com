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
