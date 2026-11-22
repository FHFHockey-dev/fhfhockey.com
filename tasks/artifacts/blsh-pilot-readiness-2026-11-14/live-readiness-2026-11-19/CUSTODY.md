# BLSH v6 signer custody and public-key verification

> **Dated correction, 2026-11-21 23:02Z (BLSH Chef, owner of these docs per the pilot addendum §7). The pilot was re-dated (TJ R0, Nov 21). Where this file differs, this note wins:**
> - Live window: native 12:05Z, request-context 12:35Z and official 12:45Z on **2026-11-23**, for the **2026-11-22** slate (games 2026020373–2026020377). Line 3's 2026-11-22 / 2026-11-21 dates are retired.
> - Vault name: the official envelope goes to **`blsh_official_grant_20261122`** (line 53's `blsh_official_grant_20261121` is retired). The pinned `redate-20261123/SCHEDULE-ONCE.sql` (`33b1ead0…`) refuses any other name, and only inside 12:35:00–12:44:59Z on 2026-11-23.
> - Operator SQL for this window: `tasks/artifacts/blsh-replay-2026-11-20/live-pilot-20261121/redate-20261123/`. Do not use `live-readiness-2026-11-20/redate-20261122/`.

This applies to the first live window: native at 12:05Z, request-context at 12:35Z and official at 12:45Z on **2026-11-22**, for the 2026-11-21 slate. (Re-dated 2026-11-20 under TJ's packet 6.1 approval; the original window was 2026-11-21 for the empty 2026-11-20 slate.) TJ holds the real keys. Nobody else requests, receives or prints a private key. Every check in this lane used throwaway keys that were generated in memory or in a deleted temporary folder.

## What the handlers accept

Both handlers apply the same rule to their environment value: `approvalPublicKey()` in `requestContextHandler.ts` and `readGrant()` in `officialPilotHandler.ts`.

- The raw value is at most 512 characters.
- The trimmed value is one `-----BEGIN PUBLIC KEY-----` SPKI PEM block, with line breaks after the header and before the footer.
- `crypto.createPublicKey(raw)` succeeds.
- The key type is `public` and the algorithm is `ed25519`.

| Vercel production variable | Signs namespace | Bad key surfaces as |
| --- | --- | --- |
| `BLSH_REQUEST_CONTEXT_APPROVAL_PUBLIC_KEY` | `fhfh.blsh.request-context-approval.v1` | 503 `approval_public_key_invalid` at 12:35 |
| `BLSH_OFFICIAL_PILOT_APPROVAL_PUBLIC_KEY` | `fhfh.blsh.official-pilot-approval.v1` | 403 `approval_invalid`, only inside 12:45:00–12:45:59 |

A bad official key gives no earlier signal than that minute, so the local check below is the only early warning.

**Fingerprint.** `sha256:` followed by the lowercase hex SHA-256 of the key's 44-byte SPKI DER. Both sides compute the same value:
- `node verify-approval-public-key.mjs …` prints it.
- `openssl pkey -pubin -in <file>.pub -outform DER | shasum -a 256` gives the same value.

## Procedure

1. **Two keypairs, two custodians of record.** Use one Ed25519 keypair per variable. Do not reuse one key for both namespaces. Generate each in the approved off-Mac signer environment, under `umask 077`:
   - `openssl genpkey -algorithm ed25519 -out <name>.key`
   - `openssl pkey -in <name>.key -pubout -out <name>.pub`

   The `.key` never leaves that environment. It never goes to Vercel, Git, a cron command, Vault, the Master Task List, chat, a diary, a log or this Mac's checkout.
2. **Record fingerprints.** In the signer environment, run:
   - `node verify-approval-public-key.mjs --name <VAR> --file <name>.pub`

   TJ records the variable name, the fingerprint and the UTC time in the custody record. Only the fingerprint, never key material, may also appear in a receipt.
3. **Independent recomputation.** The independent verifier receives only the `.pub` file and runs:
   - `node verify-approval-public-key.mjs --name <VAR> --file <name>.pub --expect sha256:<recorded>`
   - the OpenSSL one-liner above

   Both must print the recorded fingerprint. A mismatch stops the pilot.
4. **Staging.** TJ pastes each `.pub` file's text, with real line breaks and no quotes, into the Vercel **production** variable of the same name. Do this before the single approved keyed deployment is built, so one build carries both keys. Then copy the stored value back from the Vercel dashboard into:
   - `node verify-approval-public-key.mjs --name <VAR> --stdin --expect sha256:<recorded>`

   It must print `ACCEPTED` and `MATCHES`. The script refuses and never echoes any input that contains `PRIVATE KEY` (exit 3). Do not use `vercel env pull`, because it writes every secret to disk.
5. **Deployment binding.** Sign only against the new READY deployment ID and its Git SHA, read back from Vercel after that deployment. Never sign against an earlier deployment ID. Any later production deployment voids the bound ID; see the release freeze in the receipt.
6. **Signing in the window.** The signer independently verifies the inputs from the exported native packet. They then write the exact UTF-8 bytes of the compact JSON array, with no newline, documented in `PILOT-APPROVAL.md` and asserted against the handlers by `verify-approval-public-key.mjs --selftest`. To sign:
   - `openssl pkeyutl -sign -inkey <name>.key -rawin -in approval.bin -out sig.bin` (64 bytes)

   Self-check with `openssl pkeyutl -verify -pubin -inkey <name>.pub -rawin -in approval.bin -sigfile sig.bin`.

   **Envelope.** `{"approval":{…},"signature":"<padded base64 of sig.bin>"}`:
   - The request-context envelope is the POST body, at most 1 KiB.
   - The official envelope is base64-encoded and stored in Vault as `blsh_official_grant_20261121` by the DB operator. The re-dated `SCHEDULE-ONCE.sql` refuses any other name.

   Neither full grant goes into general logs.
7. **Suspected exposure or loss.** Stop issuing grants. Run the disarm set: `DISARM-ROLLBACK.sql`, `CANCEL-OFFICIAL-ONCE.sql`, and `SWITCH-OFF.sql` if DISARM cannot commit. A key change needs a new approved deployment and new fingerprints. A grant signed by a replaced key fails closed at the handler.
8. **After the pilot.** Removing both public variables takes a separate approved deployment. TJ decides whether to destroy or archive the private keys and records that decision against the fingerprints.

## Local evidence (throwaway keys only)

- `node verify-approval-public-key.mjs --selftest` passed all 21 checks on Node 22.23.4, including the RSA-4096 length case.
- An OpenSSL-generated throwaway key gave the same fingerprint from both the script and `openssl pkey … | shasum -a 256`. A wrong `--expect` value exited 1. A private key file was refused with exit 3 and not echoed.
- [key-crosscheck.txt](key-crosscheck.txt) drove the real `requestContextHandler` and `officialPilotHandler`, using only invalid or fixture approvals and a fixture store with no network, with 14 key shapes. The script's verdict equalled both handlers' verdicts in every case. The test file was scratch-only and is not committed.
  - **Accepted (3):** canonical, trailing newline, CRLF.
  - **Rejected (11):** leading blank line, literal `\n`, quoted, header joined to body, two keys, 513 characters, PKCS#8 private, P-256, X25519, Ed448, RSA-2048.
