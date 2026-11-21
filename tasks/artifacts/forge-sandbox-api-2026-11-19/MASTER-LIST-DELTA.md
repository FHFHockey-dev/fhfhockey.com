# FHFH Master Task List: Nov 19 delta for Scout

Add these items. The hosted capture pass is already logged, so do not record it again.

## FORGE/RSO entry: evidence IDs for the logged capture pass

- Cron: job 409, run 258726.
- HTTP: pg_net request 1811, response 200.
- Release: deployment `dpl_E59ktA1fyi4A2XDhyPe1UT5eoj4p`, SHA `02f0426d557e8e13c85e452759c1a1566285d950`.
- Claim: `678c8fd3-fa19-4416-8130-e37dfbcf5372`.
- Packet: sha256 `f3472b61…`.
- Timestamp: DigiCert genTime 21:31:06Z.
- Receipt: `tasks/artifacts/forge-sandbox-api-2026-11-19/HOSTED-RECEIPT-2099020991.json` in Claude's local checkout.

## FORGE/RSO entry: new status

- **Publication and RSO hosted test: in progress today.** A candidate is being built from master `02f0426d5`. It goes to TJ as one consolidated decision covering the SHA, the shared-module changes, tests, temporary access, build impact and cleanup. The 13 f886ddac shared modules include live code (run-projection-v2, RSO planning, the public FORGE APIs), so a release needs TJ's approval. Nothing is pushed or armed under the capture-only approval.
- **Sandbox access pattern that works.**
  - A NOLOGIN role is granted to authenticator.
  - The exposed `forge_sandbox_api` schema contains only owner-owned views and SQL wrappers. The private sandbox schemas stay unexposed.
  - The JWT lasts 12 hours or less and is minted in the dashboard. No signing secret is stored in the app.
  - Retire it in this order: unexpose, then drop the schema, then remove the token.
- **Production security finding (open).**
  - `pgsodium.mask_role`, `update_mask` and related functions are SECURITY DEFINER, owned by supabase_admin, with PUBLIC EXECUTE. Any new LOGIN role could grant itself write access to live tables.
  - Only Supabase can revoke this. TJ sends the drafted support request.
  - Until it is fixed, create no LOGIN roles.
- **Branch state.** `octoberBranch` has a local merge of released master, `6d2b2748f`. It is not pushed and is not a release candidate.

## BLSH entry: new status

- **Sandbox v6 pass, Nov 19 (local disposable PostgreSQL 15, real handlers and DB writes, fixture keys, test clock).**
  - Native capture (20 objects) read back.
  - A duplicate returned `already_claimed` and wrote nothing.
  - The signed request-context stage passed. A tampered grant got 403.
  - Ref: `refs/rc/blsh-v6-sandbox-20261119` @ `a5c4f3462`.
  - This is not a live capture.
- **Live: NO-GO, 12 ordered blockers.** The receipt is at ref `refs/rc/blsh-live-readiness-20261119` @ `26f7aec97`, in `live-readiness-2026-11-19/RECEIPT.md`. The first blockers:
  1. L7 sign-off. The registration code and tests are done.
  2. TJ creates the two Ed25519 keypairs off-Mac.
  3. Part B receipts for jobs 404/405.
  4. A keyed release.
  5. A release freeze until the Nov 21 window closes. This conflicts with any FORGE release after that point.
- The live window is unchanged at Nov 21, 12:05–12:07Z.
