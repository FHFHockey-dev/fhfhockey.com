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

**Code.** `web/lib/projections/pregameCapture/witnessEdgeCore.ts` is bundled reproducibly into `supabase/functions/forge-witness-verify/core.bundle.js` by `build-edge-bundle.mjs --check`.
- `release` is the sha256 over the bundle's 13 input files. `bundle-manifest.json` lists them.
- The bundle imports only `node:buffer`, `node:crypto` and `node:zlib`. Signing uses WebCrypto.

**Trust root.** `web/lib/projections/pregameCapture/witnessSigningKeys.ts` holds the pinned public keys.
- It is EMPTY in this commit, so everything fails closed.
- Nothing stored in the database is trusted.

**Gate (release code).** `signedVerdict.ts`, through `checkSignedVerdict` / `assertSignedVerdict`, accepts only when all of these hold:
- the signature verifies under a pinned key;
- the payload is canonical;
- the verdict is `accepted`;
- `verifiedAt ≤ deadline`, with `deadline = officialStart − 60`;
- the claim, game and all three hashes equal what the caller expects (the custody being published).

The publish route and readers (live lane) call it after reading `forge_witness.signed_verdict_v1(claim)` as service_role.

**Offline audit.** `export-signed-verdicts.sql` is read-only. It exports the stored verdict plus the custody hashes as they are now, with raw recomputed from the stored packet. `audit-signed-verdicts.ts` checks them with the pinned key and exits 0 only if every game passes.

**Database checks are defense in depth only.** `postgres` can drop triggers and replace functions, so no database-side check, including a pgsodium one, can be the gate.

## SQL delta: `forge-witness-signed.sql` (sha256 `dad95b43e0912ce9f8c401f383c27c97f986e4fdcd2a7c64765c20e8a4d2e6e1`)

It applies on top of 9673316c, as `postgres`, and refuses a second apply.
- `forge_witness.signed_verdicts`: `(claim_id pk, game_id unique, payload, signature, key_id, recorded_at)`, immutable triggers, RLS, owned by `forge_witness_owner`.
- `forge_witness_api.signed_pending_v1()`, `signed_evidence_v1(game)` and `record_signed_v1(payload, signature)`: service_role only. `record_signed_v1` checks shape and that the payload names an armed game's claim; it never checks the signature.
- `forge_witness.signed_verdict_v1(claim)`: service_role and postgres.
- `forge_witness.signed_status_v1(game)`: postgres only.

## Local proof (`check_signed.py`, exit 0; [SIGNED-LOCAL-PROOF.json](SIGNED-LOCAL-PROOF.json))

The database is PostgreSQL 15.19 restored from `prod-roles-20261119.sql` and `prod-schema-grants-20261119.sql`.
- The bootstrap superuser is `supabase_admin`, so `postgres` is non-superuser with CREATEROLE and BYPASSRLS, and `service_role` can EXECUTE `execute_sql`, as in production.
- The restore produced 161 errors, all from Supabase-managed schemas and extensions absent locally (`auth`, `cron`, `pg_trgm`, …).
- The one local adaptation: `authenticator`'s `session_preload_libraries` (supautils) was reset so PostgREST 16.6 can log in.

| Check | Result |
| --- | --- |
| Install | The delta applied **as postgres**; a second apply refuses; the owner role has no members afterwards. |
| Witness (committed bundle under Node 22, PostgREST as service_role, fixture NHL schedule and TSA) | good **accepted**; tampered token **rejected:token_invalid**; official start ≠ claim start **rejected:schedule_changed**; NHL unavailable: **no verdict**; run after T−60 **rejected:verification_late**. A second run creates no rows. Traffic: 16 calls as `service_role@forge_witness_api`, 8 to NHL, nothing else. |
| Gate before attacks | Accepted only for the accepted verdicts. Rejected verdicts get `verdict_rejected`; a missing one gets `verdict_missing`. |
| Plain service_role insert | 42501 |
| Writer attacks, each of which **succeeds in the database** | As postgres, after `grant forge_witness_owner to postgres`: forge an "accepted" with the pinned key id and the attacker's signature; flip a rejected verdict to accepted; replay a genuine verdict onto another claim; delete a genuine verdict. As service_role through `execute_sql`: swap the committed packet under an accepted verdict; forge with the attacker's own key id. |
| Gate after attacks | `signature_invalid`, `signature_invalid`, `binding_mismatch`, `verdict_missing`, `binding_mismatch`, `key_unpinned`. The **untouched verdict still passes**. |
| Offline audit (pinned key) | Only the untouched game passes; every other game fails with the reason above. |
| Offline audit (release default, nothing pinned) | All fail, exit 2. |
| Private key in the database | none |

Unit tests in `witnessEdgeCore.test.ts` (12): accepted path; forged, altered, replayed, unpinned, missing, non-canonical, truncated and late verdicts; official schedule mismatch and unavailability; a fixture token under the DigiCert pin; config refusals; key id derivation.

Gates:
- typecheck: exit 0.
- eslint: 0 errors.
- vitest (`__tests__/pages/api/v1/db`, `lib/projections/pregameCapture`, admission, releases): 97 files, 1759 passed.
- FORGE producer closure: unchanged (`78655939…`).
- Bundle `--check`: reproducible.
- Keygen `--dry-run`: OK.

NHL field check: one public read-only GET of game 2026020356's landing returned `startTimeUTC 2026-11-20T02:00:00Z`, `gameDate 2026-11-19`, `FUT` / `OK`, COL (21) vs ANA (24). These are the fields and shapes the core expects.

## Deploy steps (each needs TJ's approval; Chef applies)

1. **SQL:** apply `forge-witness-signed.sql` as postgres; sha256 above. `forge_witness_api` must be in the Data API exposed schemas.
2. **Key** (TJ, logged in to the Supabase CLI): `node tasks/artifacts/forge-witness-signed-2026-11-19/witness_signing_keygen.mjs --project-ref fyhftlxokyjtpndbkfse`.
   - It generates the pair and pipes `FORGE_WITNESS_SIGNING_KEY=…` to `supabase secrets set --env-file /dev/stdin`, so it never appears in argv, disk or chat.
   - It prints only `keyId` and the public key, and pins the public key in `witnessSigningKeys.ts`.
3. **Rebuild** the bundle with `node tasks/artifacts/forge-witness-signed-2026-11-19/build-edge-bundle.mjs`; the keys file is an input, so the release id changes. Commit the keys file, bundle and manifest.
4. **Deploy:** `supabase functions deploy forge-witness-verify --project-ref fyhftlxokyjtpndbkfse` from the repo root (`verify_jwt = true` in `supabase/config.toml`).
   - **Smoke test (also the Deno runtime check):** POST with the anon key and expect `{"status":"idle"}`, with `release` equal to the manifest and `keyId` equal to the pinned id.
5. **Live lane:** the publish route and readers call `assertSignedVerdict(await signed_verdict_v1(claim), {claimId, gameId, raw, canonical, tokenSha})`. Deploy the release that pins the key.
6. **Arm per game:** `psql -v game=… -v schedule='m-m h d M *' -v anon_key="$ANON" [-v max_fires=3] -f arm-signed-verify.sql`. Fire after the qualified capture and at least 3 min before the official T−60.
7. **Afterwards:** run `export-signed-verdicts.sql`, then `audit-signed-verdicts.ts` (exit 0 required), then `disarm-signed-verify.sql`.

## Limits

- **Deno not run locally.** The bundle ran under Node 22 using only WebCrypto Ed25519, fetch and `node:buffer`/`crypto`/`zlib`. Step 4's smoke test is the first Deno run; `ed25519Signer` and the TSA verify are the parts to watch.
- **Team ids.** The NHL landing gives NHL team ids. If FHFH's `home_team_id`/`away_team_id` ever differed from them, the verifier would reject with `game_binding` (fail closed, never a false accept).
- **Tamper-evident, not tamper-proof.** A postgres-level writer can still insert a publication row directly. It cannot make one pass the release gate, the readers or the audit, which is where the pinned key lives.
- **Unauthenticated triggering.** Anyone with the anon key can invoke the function. That confers nothing: it only verifies the truth and signs it.
