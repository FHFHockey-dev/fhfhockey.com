# BLSH v6 live pilot: a no-added-cost signer on Supabase (answer to TJ's re-answered S0)

Revised Sun 2026-11-22 ~00:35Z (Sat 18:35 CST; earlier revision times in this lane's notes ran ahead of the clock) by the managed-signer lane, after BLSH Chef's production R1 (`r1-hosted-20261122/R1-FINDINGS.md`) and this lane's names-only credential inventory (`e2-inventory/INVENTORY.md`).

**Proposal, isolated proof and inventory only. The pilot stays on HOLD.**
- **Production:** this lane changed nothing. The only production reads were Vercel environment-variable **names** and GitHub secret **names**, done at Chef's request.
- **Dropped:** AWS and GCP, as TJ asked.
- **Plans:** Vercel is on Pro (local record). The Supabase plan is not in local records, so the design is sized to Free-plan limits.

## 1. Answer first

**Recommendation: V1b + E2.**
- **V1b** is a Supabase Edge Function signer. It holds two per-candidate Ed25519 keys, generated inside Supabase and kept in the postgres-owned table `fhfh_internal.blsh_signer_secrets`.
- **E2** rotates the Supabase database password and removes the seven `POSTGRES_*` variables from Vercel production. It is the same step as the FORGE writer hardening's still-pending step 3 (`forge-writer-hardening-2026-11-19/WRITER-HARDENING.md` §4.3).
- The pilot stays on HOLD until E2 and setup are done.

**Exact next approval line, for TJ: S0-V1b+E2 (§8).** BLSH Chef can run the read-only **R1b** (§5) beforehand or in parallel.

**What production R1 changed:**

| Fact (R1, production) | Consequence |
|---|---|
| `public.execute_sql` is **already revoked** from `service_role` (ACL `{postgres=X/postgres}`, the Nov 19 FORGE hardening) | **E1 becomes repo reconciliation only.** Add a migration that matches production, and move the three script consumers. The repo's migrations `20260716112908` and `20260820013120` still grant it, so a re-apply would restore the grant. No production change is needed. |
| The only other dynamic-SQL definers `service_role` can run are `csv_create_table_v1` (narrow: it creates new `public` tables only) and `pgsodium.mask_role` (reviewed Nov 21) | Neither reaches `fhfh_internal`. The decision rule is not tripped. |
| `service_role` **can SELECT** `vault.decrypted_secrets` and `vault.secrets` (via `pgsodium_keyiduser`, granted by `supabase_admin`), and can run `vault.create_secret` and `vault.update_secret` | **V1 (keys in Vault) is out**, now confirmed on production. |
| **Vercel production for `fhfhockey` holds `POSTGRES_URL`, `POSTGRES_PASSWORD`, `POSTGRES_USER`, `POSTGRES_HOST`, `POSTGRES_DATABASE`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`** (the `postgres` owner) and `SUPABASE_JWT_SECRET` | **The verifying app's runtime environment holds the database-owner password.** Anyone who can read Vercel env, deploy, or run code in that deployment can read V1b's key table. **V1b and V2 are therefore not independent of the verifying app until E2.** My earlier §3 row "Vercel deploy credentials: no" was wrong. |

| | V1 (Vault) | **V1b (private table)** | V2 (no keys; permit) |
|---|---|---|---|
| Verifier at Y | unchanged | **unchanged** | changed (new candidate, all gates, new review) |
| The Vercel app (its `service_role`, `SUPABASE_JWT_SECRET`, the `POSTGRES_*` password, and who can read its env or deploy it) can produce an approval, **today** | **yes** | **yes** (via `POSTGRES_*`) | **yes** (via `POSTGRES_*`) |
| …**after E2** | **yes** (Vault grant) | **no**: proved for `service_role` and authenticator roles; the `postgres` password is gone from Vercel and rotated | **no** |
| Supabase project admins and DB-owner paths (§3), including the DB password on this Mac | yes | **yes** | yes |
| Key material | yes | yes, readable by the row above; deleted after the pilot | none |
| Approval stays a signature checked against keys only Vercel holds | yes | **yes** | no |
| Added cost | $0 | **$0** | $0 |

**The tradeoff, plainly.**
- **With E2:** V1b's approval is independent of the verifying app. It is **not** independent of Supabase project admins or database-owner paths. That set is:
  - org Owner, Administrator and Developer members;
  - Supabase access tokens, including the CLI and the **Supabase MCP connector in these agent sessions**;
  - the database password, which after E2 still lives in this Mac's `web/.env.local` for operator SQL;
  - Edge Function deployers;
  - Supabase staff.

  This is weaker than TJ's original separate custody, and it is the best any zero-cost option reaches.
- **Without E2:** **no zero-cost option preserves an approval independent of the verifying app.** The gate would catch bugs but not an app compromise, and I would not call it an independent approval.

## 2. Design of V1b

- **Flow:** pg_cron 12:35/12:41 → Edge Function `blsh-signer`, with body `{}` and the bearer from the private table. The function checks, in order: route, method, query and body, then **bearer**, then **mandate**, then **window**. Only then does it **pull** evidence from Postgres, read the key, check the key fingerprint against the mandate, reserve the one-shot ledger slot and sign the exact verifier bytes. pg_cron 12:36 then POSTs to the unchanged request-context route; 12:42 stores the grant in Vault; 12:45 runs the byte-identical reviewed SCHEDULE-ONCE command.
- **Keys:** generated inside Supabase by a one-shot keygen function that returns public data and `current_user` only, then is deleted. No private key is ever written to the Mac, `.env`, Git, chat or Vercel.
- **Mandate:** TJ's approval before ARM, set as an Edge Function secret. It pins the slate, games, READY deployment and SHA, windows and fingerprints.
- **`/selfcheck`:** never signs. It proves the runtime's privileges, including a rolled-back ledger insert and the key-to-mandate fingerprint match.
- **New in this revision:**
  - `AUTOMATE-ONCE-SUPABASE.sql` also refuses if **any role granted to `authenticator`** (which a `SUPABASE_JWT_SECRET`-minted token can assume) holds a privilege on the secrets table. This is proved.
  - `R1B-READONLY.sql` lists those roles.
- **Files:** `proof/signer/{blshSigner.mjs, supabaseSigner.mjs, supabase-edge-index.ts, supabase-keygen-index.ts}` and `proof/sql/{SIGNER-SECRETS-SETUP, AUTOMATE-ONCE-SUPABASE, CANCEL-SIGNER-STEPS, R1-READONLY, R1B-READONLY}.sql`.

## 3. Who can read or change V1b's keys and signer (corrected)

| Actor or credential | Today | After E2 | Basis |
|---|---|---|---|
| **Vercel `fhfhockey` production env, its deployers and env readers**: `POSTGRES_*` is the owner password | **Can read the keys and replace the signer's data** | **No:** the vars are removed, the password is rotated, and old deployments hold a dead value | R1 #7; inventory |
| `service_role` (the app's key; also in `web/.env.local` and `functions/.env.local`) | **No** on the key table (no grant; `execute_sql` revoked). **Yes** on Vault: it can read, create and update secrets | Same | R1 #1, #4; proof |
| `SUPABASE_JWT_SECRET` (Vercel production) | It mints PostgREST tokens only for roles granted to `authenticator` (`anon`, `authenticated`, `service_role`, plus any others R1b lists). **It reaches the key table only if one of those roles has a privilege on it, and the AUTOMATE preflight refuses that (proved).** It is not needed for V1b; its rotation is the FORGE hardening's separate Track A decision | Same | Proof; WRITER-HARDENING §3 |
| `anon`, `authenticated` | No | No | Proof |
| GitHub Actions | No DB secret (`X_BURNER_COOKIES`, `X_INGEST_SECRET` only) | No | Inventory |
| Other Vercel projects | No DB credential (only `SUPABASE_SERVICE_ROLE_KEY` in functions-fhfhockey and web) | No | Inventory |
| **`postgres` and every path that runs SQL as it**: dashboard SQL Editor (Owner/Admin/Developer), Management API, CLI, the Supabase MCP `execute_sql`, Edge Function deployers (they get `SUPABASE_DB_URL`), and **DB-password holders, which after E2 means only this Mac's `web/.env.local` and `web/scripts/.env`** | **Yes** | **Yes (accepted risk)** | Proof RESIDUAL; docs |
| `supabase_admin`, Supabase staff | Yes | Yes | Platform |

**Denial of service only (not forgery), after E2:**
- The Vercel app's `service_role` can create or update the Vault secret `blsh_official_grant_<slate>`:
  - **before 12:42** (pre-creating it): the 12:42 step refuses (`grant_shape_or_duplicate`);
  - **after 12:42** (overwriting it): the official route refuses the broken grant.
- Any login role can see the trigger bearer in `net.http_request_queue` for the milliseconds a request is pending. With the pull model, that only lets someone trigger the **genuine** approval early.

Moving the grant out of Vault would change the reviewed 12:45 command, so it is not proposed now.

## 4. E1: repo reconciliation (no production change)

- **Migration:** `revoke execute on function public.execute_sql(text) from service_role`. It matches production and stops a re-apply of `20260716112908` or `20260820013120` from restoring the grant.
- **Script moves:** `scripts/cron-audit-runner.ts`, `sql-refresh-validation.ts` and `sql-refresh-team-power-validation.ts`, which call it through `lib/cron/sqlRpcExecution.ts`, move to the operator session or to narrow RPCs. They already fail against production today.
- **Test:** update `lib/supabase/supportedBaselineMigration.test.ts`.
- **Scope:**
  - none of these files is in the FORGE closure (243 modules) or among the L7 files;
  - it can ride the re-dated pilot candidate;
  - owner: the migration-authority owner (TJ to name).
- **Not a blocker for the pilot's independence;** production is already correct.

## 5. E2: rotate the DB password and remove `POSTGRES_*` from Vercel

**Inventory (names only; `e2-inventory/INVENTORY.md`). Holders of the DB-owner password or URL:**
- **Vercel `fhfhockey` Production:** the 7 `POSTGRES_*` variables.
- **This Mac:**
  - `web/.env.local` `SUPABASE_DB_URL`, the operator path: `pgpool.sh` ×4 plus the BLSH, FORGE and DRM operator scripts and several `web/scripts/*`;
  - `web/scripts/.env` `SUPABASE_DB`, read by `audit-nhl-game-prediction-sources.ts`;
  - a stale recovery copy, `fhfhockey-workspace-recovery-2026-10-24/.../web/.env.local` `SUPABASE_DB_URL`.
- **None in:** GitHub Actions, other Vercel projects, shell profiles, or `~/.pgpass`.
- **`SUPABASE_DB_URL` is in no Vercel project,** so production direct-Postgres code already runs on its fallbacks.

**Blast radius:**
- **Production runtime:** none expected.
  - Nothing in the repository reads `POSTGRES_*` (this lane's grep and WRITER-HARDENING §3 agree).
  - PostgREST and supabase-js are key-based, and pg_cron and pg_net run inside the database, so all are unaffected.
- **Builds:** none. The removal takes effect at the next deployment (the pilot's keyed push), and the rotation kills the value baked into every old deployment.
- **Local operator tooling:** it breaks until `web/.env.local` and `web/scripts/.env` get the new value. That is one paste each, by TJ, never through chat.
- **Unknown:**
  - **Whether Supabase's Vercel integration is installed and syncing.** The `POSTGRES_*` + `SUPABASE_JWT_SECRET` set is that integration's signature. If it syncs, a reset might push the new password straight back into Vercel.
  - Whether Edge Functions' platform-injected `SUPABASE_DB_URL` follows a reset. S4's `/selfcheck` after E2 confirms it.
  - Any holder outside this Mac, the repo and Vercel.

**Order of operations (each step under S0-V1b+E2; TJ does the dashboard steps):**
1. **R1b, read-only.** Chef runs `proof/sql/R1B-READONLY.sql` (roles granted to `authenticator`; login roles) and lists Vercel integration configurations, names only. TJ checks Supabase Dashboard → Integrations → Vercel.
2. **If the Supabase↔Vercel integration syncs env for `fhfhockey`:** disconnect its env sync for that project, or remove the integration, first.
3. **Remove the 7 `POSTGRES_*` variables** from `fhfhockey` Production. `SUPABASE_JWT_SECRET` is optional for V1b and is the FORGE hardening's Track A decision. No redeploy.
4. **Reset the database password** (Supabase Dashboard → Database → Settings; Owner/Admin).
5. **Update the legitimate holders:** paste the new value into `web/.env.local` (`SUPABASE_DB_URL`) and `web/scripts/.env` (`SUPABASE_DB`). Optionally delete the stale recovery copy.
6. **Verify (read-only):**
   - the Vercel names list shows no `POSTGRES_*`;
   - one `select 1` through `pgpool.sh` with the new value succeeds;
   - later, S4 `/selfcheck` shows `currentUser=postgres` through the Edge Function.

**Estimated time:** about 30–45 min of TJ's dashboard time plus about 10 min of checks, with 0 builds. It also closes the FORGE writer gate's open "no DB password reachable from Vercel" condition.

## 6. V2 (analysed, not built or proven)

V2 has the same E2 dependency. A permit row replaces the signature: it is minted by pg_cron SQL and consumed inside `blsh_context_claim_v1` and `blsh_official_claim_v1`.
- **What it needs:** handler changes, a new migration that moves pinned hashes, a new candidate, all gates, line F for the new SHA, and a new independent review. L7 is unaffected.
- **What it gains:** no key material.
- **What it costs:** the signature gate disappears, plus about 1–2 days.

**Choose V2 only** if TJ wants zero key material and accepts the re-review.

## 7. Isolated proof (`proof/`; `./proof/run-proof.sh`, about 10 s, local)

**Result:** **11/11 tests, 91 PASS lines, 3 FINDING lines, 1 RESIDUAL line** (`proof/out/proof-log.txt`). The run covers the AWS design's 7 tests plus 4 V1b tests. They run against Y's real handlers and a disposable PostgreSQL 15.19 with Y's BLSH migrations and the pinned INSTALL/ARM/CANCEL SQL. Ed25519 is real; the secrets table and ledger are real Postgres.

**V1b: TJ's required evidence**

| TJ's ask | Proved by |
|---|---|
| Issues only for the approved slate, the exact READY deployment and SHA, the verified receipt and the windows | full timed hand-off: Y's handlers return `packet_complete_pending_review` for both routes; exactly 2 approvals |
| Refuses missing | missing receipt; missing bearer |
| Refuses mismatched | deployment; SHA; slate; a swapped key |
| Refuses expired | early and late request-context; late official |
| Refuses duplicates | repeat; a concurrent pair → exactly one |
| Stop switch | mandate disarmed; key deleted; DB cancel set |

**Also proved for V1b:**
- unauthenticated and out-of-window calls do no database work;
- `/selfcheck` returns 0 signatures and 0 ledger rows;
- `service_role`, `anon`, `authenticated` and **authenticator-granted roles** are refused on the key table;
- **FINDINGS:** Vault emulation (`service_role` keeps reading after the owner's REVOKE), and the `execute_sql` escalation plus its E1 fix (production already has E1);
- **RESIDUAL:** `postgres` reads the keys;
- `R1-READONLY.sql` and `R1B-READONLY.sql` run read-only locally.

**Not proven locally:**
- the real Edge runtime;
- real pg_cron and pg_net jitter;
- E2 itself;
- integration sync behaviour;
- the native capture.

## 8. Approval lines (each needs its own yes)

- **S0-V1b+E2 (TJ, NEXT):** "Adopt V1b with E2, as written in PROPOSAL-SUPABASE.md.
  - **Keys:** two per-candidate Ed25519 keys, generated inside Supabase into `fhfh_internal.blsh_signer_secrets` (not Vault).
  - **E2:** remove the seven `POSTGRES_*` variables from Vercel production and rotate the database password, updating only `web/.env.local` and `web/scripts/.env`. Disconnect the Supabase↔Vercel env sync first if R1b shows it.
  - **Accepted risk:** Supabase project admins and database-owner paths can read the keys and could forge approvals for the pinned deployment and slot until the keys are deleted. Those paths are Owner, Administrator and Developer members, access tokens including the Supabase MCP connector, the database password on this Mac, Edge Function deployers, and Supabase staff.
  - **Must not be able to:** the Vercel app, its env, deploy credentials, `service_role`, `SUPABASE_JWT_SECRET` and GitHub.
  - **Accepted DoS paths:** the Vault grant and the early trigger.
  - The pilot stays on hold until E2 and S1–S4 are done."
- **R1b (BLSH Chef; read-only; may run before S0):** `R1B-READONLY.sql`, plus the Vercel integration-configuration names. TJ looks at Supabase → Integrations.
- **E2:** steps 2–6 of §5.
- **E1:** repo reconciliation, riding the S5 candidate.
- **S1:** run `SIGNER-SECRETS-SETUP.sql` and insert the server-generated bearer.
- **S2:**
  1. Deploy the keygen function and invoke it once; expect `currentUser=postgres`.
  2. Record the fingerprints; the independent verifier recomputes them.
  3. Delete the keygen function.
- **S3:** deploy `blsh-signer` with `--no-verify-jwt` and the mandate `{"armed":false}`.
- **S4:**
  1. `/selfcheck`, after E2, to confirm the injected `SUPABASE_DB_URL` still works.
  2. The cron-owner pg_net, delete, Vault and cron checks.
  3. On pilot day, after AUTOMATE, `/selfcheck` again; evidence `ok`.
- **S5:**
  1. The re-dated candidate (plus E1), with the SQL re-dated and the proof rerun.
  2. Public keys staged at K1, before the keyed push.
  3. Line F.
- **S6 (per pilot day, before ARM):** the mandate, then AUTOMATE-ONCE-SUPABASE, then ARM.
- **S8 (after the pilot):**
  1. Disarm the mandate.
  2. Delete the keys.
  3. Drop the signer objects.
  4. Remove the public keys at the next approved deploy.

## 9. Stop switch, cost and earliest slate

**Stop switch (any one; no build):**
- mandate `"armed": false`;
- delete the key rows;
- `CANCEL-SIGNER-STEPS.sql` + the reviewed `CANCEL-OFFICIAL-ONCE.sql`, then `DISARM-ROLLBACK.sql` / `SWITCH-OFF.sql`;
- passive guards: windows, per-minute steps, the one-shot ledger, and no dispatch without upstream success.

**Cost: $0 added.**
- 1 Edge Function, with 2 signing plus 2–3 `/selfcheck` invocations per pilot day, against Free's 500k.
- Under 2 s CPU and ≤ 15 s wall time per request.
- pg_cron, pg_net and Vault are already in use.
- E2 needs 0 builds.
- Vercel gets no new project or build.

**Earliest slate:** the chain is S0-V1b+E2 and R1b on Sun 11-22 → E2 (about 1 h, Sun or Mon) → S1–S4 on Mon 11-23 → S5 re-dated candidate (plus E1), gates and line F on Tue 11-24 to Wed 11-25 → keyed push, INSTALL and S6.
- **Plan: the Nov 27 slate** (15 games, capture **Sat 2026-11-28 12:05Z / 06:05 CT**).
- **Nov 25** (capture Thu 11-26, Thanksgiving) is possible only if S0, R1b and E2 all land Sun 11-22 and S1–S4 land Mon 11-23. I would not plan on it.
- **Drop rule:** if E2, S4 or the S5 gates are not green by Thu 11-26 23:59 CT, move to the next slate after the 11-27 read (not yet read) without extending anything.

**If TJ declines E2:** no zero-cost option preserves independent approval.
- **Choose one:**
  - keep the pilot on hold;
  - run V1b as a **bug gate**, stating plainly that the app can forge approvals;
  - revisit external custody.

## 10. Sources

- **Production facts:** `r1-hosted-20261122/R1-FINDINGS.md`, `r1.out`, `r1-followup.out` (BLSH Chef).
- **Credential inventory:** `e2-inventory/` (this lane).
- **E2 background:** `forge-writer-hardening-2026-11-19/WRITER-HARDENING.md` §3–§4.
- **Official docs and source:**
  - Supabase: [Vault](https://supabase.com/docs/guides/database/vault), [access control](https://supabase.com/docs/guides/platform/access-control), [personal access tokens](https://supabase.com/docs/guides/platform/personal-access-tokens), [Postgres roles](https://supabase.com/docs/guides/database/postgres/roles), [Edge Function secrets](https://supabase.com/docs/guides/functions/secrets), [Edge Function auth](https://supabase.com/docs/guides/functions/auth), [scheduling functions](https://supabase.com/docs/guides/functions/schedule-functions), [Edge Function limits](https://supabase.com/docs/guides/functions/limits), [pricing](https://supabase.com/pricing), [Cron](https://supabase.com/docs/guides/cron), [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net);
  - Supabase source: [Vault grants (after-create.sql)](https://github.com/supabase/postgres/blob/develop/ansible/files/postgresql_extension_custom_scripts/supabase_vault/after-create.sql), [Edge Runtime Ed25519](https://github.com/supabase/edge-runtime/blob/main/ext/node/polyfills/internal/crypto/sig.ts);
  - PostgreSQL: [REVOKE](https://www.postgresql.org/docs/15/sql-revoke.html).
