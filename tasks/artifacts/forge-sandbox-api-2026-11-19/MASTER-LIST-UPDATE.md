# Paste-ready update for the FHFH Master Task List (Scout applies) · Nov 19, 2026

## F1/F3 → R1 · Off-Mac FORGE framework (FORGE/RSO entry)

**Nov 19 hosted sandbox run: PASSED for FORGE capture only.** Supabase Cron called the authenticated Next.js GET on Vercel, the same way WGO's update-wgo-skater-stats job is triggered. The GET ran master's existing v1 pregame capture against frozen synthetic fixture 2099020991 and finished in 5.6 s. No Mac was involved.

- **Chain.**
  - Cron job 409 `forge-sandbox-get-2099020991`: run 258726 `succeeded` at 21:31:00Z.
  - pg_net request 1811 sent an HTTP GET to https://fhfhockey.com/api/v1/db/forge-sandbox-run and got 200 at 21:31:00.6Z.
  - The route returned `succeeded / capture_qualified` and served release `02f0426d557e8e13c85e452759c1a1566285d950` (deployment `dpl_E59ktA1fyi4A2XDhyPe1UT5eoj4p`).
  - Claim `678c8fd3-fa19-4416-8130-e37dfbcf5372`: custody qualified, witness qualified, real DigiCert TSA stamp at 21:31:06Z.
  - Packet: 27,426 bytes, sha256 `f3472b61…`; canonical sha256 `75f4a873…`.
  - 131 reads covering 36 skaters, including 8471001.
  - App time 5,598 ms; DB time 5,583 ms.
  - The cron job unscheduled itself.
- **Evidence.**
  - Receipt: `tasks/artifacts/forge-sandbox-api-2026-11-19/HOSTED-RECEIPT-2099020991.json` (Claude local checkout).
  - Code: master `02f0426d5`.
- **Isolation.**
  - The narrow Data API schema `forge_sandbox_api` held 34 views and 13 wrappers. The private sandbox schemas were never exposed.
  - The API used a NOLOGIN role through a short-lived JWT. There was no direct login, no service role, and no signing secret in the app.
  - Data API checks:
    - The sandbox token could read the fixture.
    - The sandbox token got 403/406 on live tables, private schemas and storage.
    - Anonymous requests got 401; authenticated requests got 403.
  - No live write was attempted. Live flags were unchanged, and job 408 stayed off.
- **Cleanup verified.**
  - The cron job was disarmed.
  - Exposed schemas were restored to `public, graphql_public, storage, analytics`.
  - The sandbox schemas and roles were dropped, and the authenticator grant was revoked.
  - The Vercel token was removed.
- **Not covered.** Publication and both RSO readers were not run, so the expected 2.965 points at C#1 is unproven on hosted infrastructure. On master they need 13 modules from f886ddac that change live FORGE/RSO behaviour, which needs TJ's release decision. Separately, master's live projection compute (`runProjectionV2ForDate`) writes only through the module-level service-role client and cannot target a sandbox without shared-module edits.
- **Production security finding (open).**
  - `pgsodium.mask_role`, `update_mask` and related functions are SECURITY DEFINER, owned by supabase_admin, with PUBLIC EXECUTE. `mask_role` runs `GRANT ALL ON %I`, so any new LOGIN role could escalate.
  - Only Supabase can revoke this. A draft support request is at `tasks/artifacts/forge-sandbox-2026-11-19/SUPABASE-SUPPORT-REQUEST.md`; TJ sends it.
  - Create no new LOGIN roles until it is fixed.
- **Next blocker.** Decide whether to release the publication and reader modules to master. Without that, live acceptance gates stay as they are.

## B1–B4 · BLSH entry

**Nov 19: the sandbox v6 path passed; the first live capture is NO-GO with 12 ordered blockers.**

- **Sandbox (local disposable PG15, real v6 handlers and DB writes, fixture keys, test clock).**
  - Native capture at 12:05 completed (run `df32a9c2…`, 20 objects) and read back through `readNativeV6Ledger`.
  - A duplicate request returned `already_claimed` and wrote nothing.
  - The signed request-context stage then passed (run `c5de92d4…`, 8 objects). A tampered grant got 403, and a duplicate wrote nothing.
  - Ref `refs/rc/blsh-v6-sandbox-20261119` @ `a5c4f3462` (not pushed).
  - This is not a live capture.
- **Live readiness.**
  - L7 NST registration is done and tested: 2 URLs, 22 s apart, compliant with all four windows.
  - The custody procedure and key verifier are done; the selftest passed 21/21.
  - INSTALL/ARM/DISARM SQL was validated on PG15.
  - Ref `refs/rc/blsh-live-readiness-20261119` @ `26f7aec97` (not pushed).
- **Next blockers, in order.**
  1. L7 sign-off.
  2. TJ off-Mac Ed25519 keypairs and fingerprints.
  3. Part B receipts for the Nov 19 jobs 404/405.
  4. A keyed release: stage the public keys first, then one push.
  5. A release freeze until the Nov 21 window closes. This conflicts with any FORGE release after that point.
- **Live window.** Unchanged at Nov 21, 12:05–12:07Z.
