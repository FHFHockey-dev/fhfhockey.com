# FORGE independent witness, Track A (signed verdicts): local candidate, November 19–20, 2026

**Status:** local only. Nothing was pushed, deployed, keyed or applied, and production (where `forge-witness-verifier.sql` 9673316c is applied but inert) is unchanged.

## Why

The FORGE writer can reach everything in the database:
- Vercel production env holds `POSTGRES_URL` (user `postgres`) and `SUPABASE_JWT_SECRET`.
- `service_role` can EXECUTE `public.execute_sql`, a postgres-owned SECURITY DEFINER.
- Old deployments keep their env.

So database grants, triggers and tables cannot stop the writer. The verdict has to be **tamper-evident** under a key the writer cannot reach.

## Design

**Witness.** The Supabase Edge Function `forge-witness-verify` in project `fyhftlxokyjtpndbkfse`.
- Its Ed25519 private key exists only as the Edge secret `FORGE_WITNESS_SIGNING_KEY`. It is never in Vercel, the database, Vault, argv or chat.
- For each armed game it:
  1. reads the committed claim (`forge_witness_api.signed_evidence_v1`, service role, Data API);
  2. takes the start time, date, teams and state from the **NHL's public schedule** (`api-web.nhle.com/v1/gamecenter/{id}/landing`), never from the database, whose `games.startTime` the writer could move to shift T−60;
  3. verifies exactly as before (`reviewWitnessEvidence`): bytes → raw and canonical hashes, game, claim, release, cutoff, statement, and the DigiCert token under the released `digicert-g4-v1` pin;
  4. uses its own clock as "now";
  5. signs canonical JSON `{version, keyId, claimId, gameId, policyId, rawSha256, canonicalSha256, tsaTokenSha256, statementSha256, inputCutoff, verdict, reason, verifiedAt, officialStart, deadline = officialStart − 60 min, release}`;
  6. stores `(payload, signature)` with `forge_witness_api.record_signed_v1`, one per game.
- An unreachable or malformed NHL response decides nothing; the next fire retries.
- **Self-test before judging (`witnessSelfTest.ts`).** On every invocation, before any database call, it:
  - verifies DigiCert's real probe token (public, embedded) under the pinned `digicert-g4-v1` trust;
  - round-trips a packet through gzip and canonical JSON;
  - signs then verifies with its Ed25519 key, and checks that a forged message fails.
  - If any check fails it answers 503 `self_test_failed` and judges nothing. A runtime whose X.509, gzip or Ed25519 differed from Node's would otherwise sign genuine claims as `token_invalid` forever.
  - Every response carries `selfTest`, so the deploy smoke test proves the Deno runtime.

**Code.** `web/lib/projections/pregameCapture/witnessEdgeCore.ts` is bundled reproducibly into `supabase/functions/forge-witness-verify/core.bundle.js` by `build-edge-bundle.mjs --check`.
- `release` (now `ac4e3c94520083dbef87f5acd7b9e0c2f0ad0de1985f3e3339d51821148f021a`) is the sha256 over the bundle's 14 input files. `bundle-manifest.json` lists them.
- The bundle imports only `node:buffer`, `node:crypto` and `node:zlib`. Signing uses WebCrypto.

**Trust root.** `web/lib/projections/pregameCapture/witnessSigningKeys.ts` holds the pinned public keys.
- It pins exactly one key; any other key fails closed:
  - keyId **`469bc6093b6ffc11`**
  - public key (base64url raw) `VYVqYwX4rW-wgYtCc5PAvWrXZy8RAc06E6U96R3eGc4`
  - public-key sha256 `469bc6093b6ffc1193818639185de8fb4781fe43965f9ee292b0e62d16b11a47`
- The key was generated on 2026-11-20 at about 00:23Z on TJ's Mac, with TJ's approval, at Chef's request.
- The private key was written once as `FORGE_WITNESS_SIGNING_KEY=<pkcs8 base64>` to a 0600 file in this session's scratchpad (`witness-key/forge-witness-signing-key.env`, in a 0700 folder). It was never printed and is outside the repository.
- Reading the file back derives the pinned public key.
- At deploy Chef pipes the file to `supabase secrets set --project-ref fyhftlxokyjtpndbkfse --env-file /dev/stdin` and then deletes it.
- Nothing stored in the database is trusted.

**Gate (release code).** `signedVerdict.ts`, through `checkSignedVerdict` / `assertSignedVerdict`, accepts only when all of these hold:
- the signature verifies under a pinned key;
- the payload is canonical;
- the verdict is `accepted`;
- `verifiedAt ≤ deadline`, with `deadline = officialStart − 60`;
- the claim, game and all three hashes equal what the caller expects (the custody being published).

The publish route and readers (live lane) call it after reading `forge_witness_api.signed_verdict_v1(claim)` through the Data API as service_role (supabase-js; anon is refused). The SQL form `forge_witness.signed_verdict_v1` is also available.

**Offline audit.** `export-signed-verdicts.sql` is read-only. It exports the stored verdict plus the custody hashes as they are now, with raw recomputed from the stored packet. `audit-signed-verdicts.ts` checks them with the pinned key and exits 0 only if every game passes.

**Database checks are defense in depth only.** `postgres` can drop triggers and replace functions, so no database-side check, including a pgsodium one, can be the gate.

## SQL delta: `forge-witness-signed.sql` (sha256 `da786646bf2b826db5fa1533c0e0cf765322a2ff343eb103d79a552da3919811`)

It applies on top of 9673316c, as `postgres`, and refuses a second apply.
- `forge_witness.signed_verdicts`: `(claim_id pk, game_id unique, payload, signature, key_id, recorded_at)`, immutable triggers, RLS, owned by `forge_witness_owner`.
- `forge_witness_api.signed_pending_v1()`, `signed_evidence_v1(game)` and `record_signed_v1(payload, signature)`: service_role only. `record_signed_v1` checks shape and that the payload names an armed game's claim; it never checks the signature.
- `forge_witness_api.signed_verdict_v1(claim)` (Data API) and `forge_witness.signed_verdict_v1(claim)` (SQL): service_role, plus postgres for the SQL form.
- `forge_witness.signed_status_v1(game)`: postgres only.

## Local proof (`check_signed.py`, exit 0; [SIGNED-LOCAL-PROOF.json](SIGNED-LOCAL-PROOF.json))

The database is PostgreSQL 15.19 restored from `prod-roles-20261119.sql` and `prod-schema-grants-20261119.sql`.
- The bootstrap superuser is `supabase_admin`, so `postgres` is non-superuser with CREATEROLE and BYPASSRLS, and `service_role` can EXECUTE `execute_sql`, as in production.
- The restore produced 161 errors, all from Supabase-managed schemas and extensions absent locally (`auth`, `cron`, `pg_trgm`, …).
- The one local adaptation: `authenticator`'s `session_preload_libraries` (supautils) was reset so PostgREST 16.6 can log in.

| Check | Result |
| --- | --- |
| Install | The delta applied **as postgres**; a second apply refuses; the owner role has no members afterwards. |
| Witness (committed bundle under Node 22, PostgREST as service_role, fixture NHL schedule and TSA; self-test `{tsa, packet, signature}` all true) | good **accepted**; tampered token **rejected:token_invalid**; official start ≠ claim start **rejected:schedule_changed**; NHL unavailable: **no verdict**; run after T−60 **rejected:verification_late**. A second run creates no rows. Traffic: 16 calls as `service_role@forge_witness_api`, 8 to NHL, nothing else. |
| Gate before attacks | Accepted only for the accepted verdicts. Rejected verdicts get `verdict_rejected`; a missing one gets `verdict_missing`. |
| Plain service_role insert | 42501 |
| Writer attacks, each of which **succeeds in the database** | As postgres, after `grant forge_witness_owner to postgres`: forge an "accepted" with the pinned key id and the attacker's signature; flip a rejected verdict to accepted; replay a genuine verdict onto another claim; delete a genuine verdict. As service_role through `execute_sql`: swap the committed packet under an accepted verdict; forge with the attacker's own key id. |
| Gate after attacks | `signature_invalid`, `signature_invalid`, `binding_mismatch`, `verdict_missing`, `binding_mismatch`, `key_unpinned`. The **untouched verdict still passes**. |
| Offline audit (pinned key) | Only the untouched game passes; every other game fails with the reason above. |
| Offline audit (release default, nothing pinned) | All fail, exit 2. |
| Private key in the database | none |
| Gate read path | `POST /rpc/signed_verdict_v1` (Content-Profile `forge_witness_api`) with the service_role token returns the row, and the anon token is refused. This is the path the release code uses. |
| Cron ops (pg_cron/pg_net stand-ins on the prod restore, run as postgres) | Arm an armed-but-unsigned game with max_fires 2, which fires twice and then returns `fires_spent`, with the job unscheduled. The queued POST goes to `https://fyhftlxokyjtpndbkfse.supabase.co/functions/v1/forge-witness-verify`, carries `Bearer <anon key>` and body `{}`, and times out after 120 s. Arming a game that already has a signed verdict is refused. Disarm leaves the other job intact. |

Unit tests in `witnessEdgeCore.test.ts` (13, including the self-test passing under the pin and catching a broken signer or trust): accepted path; forged, altered, replayed, unpinned, missing, non-canonical, truncated and late verdicts; official schedule mismatch and unavailability; a fixture token under the DigiCert pin; config refusals; key id derivation.

Gates:
- typecheck: exit 0.
- eslint: 0 errors.
- vitest (`__tests__/pages/api/v1/db`, `lib/projections/pregameCapture`, admission, releases): 97 files, 1760 passed.
- The Track B harness (`check_witness.py`) was rerun and exits 0.
- FORGE producer closure: unchanged (`78655939…`).
- Bundle `--check`: reproducible.
- Keygen `--dry-run`: OK.

NHL field check: one public read-only GET of game 2026020356's landing returned `startTimeUTC 2026-11-20T02:00:00Z`, `gameDate 2026-11-19`, `FUT` / `OK`, COL (21) vs ANA (24). These are the fields and shapes the core expects.

## Deploy and smoke commands

- **Deploy**, from the repository root: `supabase functions deploy forge-witness-verify --project-ref fyhftlxokyjtpndbkfse`.
  - It uploads `supabase/functions/forge-witness-verify/index.ts` and `core.bundle.js`.
  - Release `ac4e3c94…`; bundle sha256 in `bundle-manifest.json` (`8a280e31…`).
  - Run `node tasks/artifacts/forge-witness-signed-2026-11-19/build-edge-bundle.mjs --check` first.
- **verify_jwt = true.** The cron (`arm-signed-verify.sql`) invokes it with `net.http_post` to `https://fyhftlxokyjtpndbkfse.supabase.co/functions/v1/forge-witness-verify`, carrying `Authorization: Bearer <project anon key>` and body `{}`.
- **Deno smoke test**, local: `bash tasks/artifacts/forge-witness-signed-2026-11-19/deno-smoke.sh`.
  - It needs `brew install deno` and uses a throwaway key with no database.
  - Pass is `selfTest` all true. The status is `pending_unconfirmed`, because there is no database.

## Deploy steps (each needs TJ's approval; Chef applies)

1. **SQL:** apply `forge-witness-signed.sql` as postgres; sha256 above. `forge_witness_api` must be in the Data API exposed schemas.
2. **Key:** already generated and pinned (keyId `469bc6093b6ffc11`). Pipe the 0600 file to `supabase secrets set --env-file /dev/stdin`, then delete it. For a later rotation, run `witness_signing_keygen.mjs`:
   - It generates the pair and pipes `FORGE_WITNESS_SIGNING_KEY=…` to `supabase secrets set --env-file /dev/stdin`, so it never appears in argv, disk or chat.
   - It prints only `keyId` and the public key, and pins the public key in `witnessSigningKeys.ts`.
3. **Rebuild** (already done for this key) the bundle with `node tasks/artifacts/forge-witness-signed-2026-11-19/build-edge-bundle.mjs`; the keys file is an input, so the release id changes. Commit the keys file, bundle and manifest.
4. **Deploy:** `supabase functions deploy forge-witness-verify --project-ref fyhftlxokyjtpndbkfse` from the repo root (`verify_jwt = true` in `supabase/config.toml`).
   - **Smoke test (also the Deno runtime check):** POST with the anon key and expect `{"status":"idle"}`, with `release` equal to the manifest and `keyId` equal to the pinned id.
5. **Live lane:** the publish route and readers call `assertSignedVerdict(await signed_verdict_v1(claim), {claimId, gameId, raw, canonical, tokenSha})`. Deploy the release that pins the key.
6. **Arm per game:** `psql -v game=… -v schedule='m-m h d M *' -v anon_key="$ANON" [-v max_fires=3] -f arm-signed-verify.sql`. Fire after the qualified capture and at least 3 min before the official T−60.
7. **Afterwards:** run `export-signed-verdicts.sql`, then `audit-signed-verdicts.ts` (exit 0 required), then `disarm-signed-verify.sql`.

## Limits

- **No database signature trigger.** The pgsodium check TJ named is not included. `postgres` can drop any trigger or replace any function, so it could not be the gate. Its key literal would also live in the database, and pgsodium is not available locally to prove it. The gate is in release code and the audit.
- **Packet size against Edge limits is not yet checked for a live game.** Decode plus canonicalisation measured in Node:

  | Uncompressed packet | CPU | Heap |
  | --- | --- | --- |
  | ~4 MB | 0.07 s | 28 MB |
  | ~22 MB | 0.3 s | 77 MB |
  | ~67 MB | 1.3 s | 234 MB |

  Check a real artifact's `byte_length` against Supabase's Edge CPU and memory limits before arming.
- **One path per game.** If a Track B (unsigned) verdict exists for a game, `signed_evidence_v1` returns `decided` for it. Never run both verifiers for the same game.
- **Shared file touched.** `supabase/config.toml` gains a `[functions.forge-witness-verify] verify_jwt = true` block.

- **Deno not run locally.** The bundle ran under Node 22 using only WebCrypto Ed25519, fetch and `node:buffer`/`crypto`/`zlib`. Step 4's smoke test is the first Deno run; `ed25519Signer` and the TSA verify are the parts to watch.
- **Team ids.** The NHL landing gives NHL team ids. If FHFH's `home_team_id`/`away_team_id` ever differed from them, the verifier would reject with `game_binding` (fail closed, never a false accept).
- **Tamper-evident, not tamper-proof.** A postgres-level writer can still insert a publication row directly. It cannot make one pass the release gate, the readers or the audit, which is where the pinned key lives.
- **Unauthenticated triggering.** Anyone with the anon key can invoke the function. That confers nothing: it only verifies the truth and signs it.
