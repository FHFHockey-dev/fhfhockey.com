> **SUPERSEDED, Sun 2026-11-22 ~01:20Z.** TJ re-answered S0: do not adopt AWS or GCP. See **PROPOSAL-SUPABASE.md**.
> - This file is kept as the record of option A.
> - Its proof counts ("7/7, 54 PASS") describe the earlier run. `proof/out` now holds the combined 11/11 run, and the 7 option-A tests are unchanged and still pass.
> - Its S2b expectation, "`service_role` cannot read the Vault bearer", is now known to be **false by default**: Supabase grants `service_role` SELECT on Vault, and Y grants it `public.execute_sql`.

# BLSH v6 live pilot: managed Ed25519 signer (proposal and isolated proof)

Written Sat 2026-11-21 ~18:10 CST (Sun 00:10Z) by the managed-signer lane for BLSH Chef and TJ. **Proposal only. Nothing here is approved or provisioned.** No production key, KMS resource, Vercel or Supabase setting, env var, migration, push, build, arming or schedule was touched. I made no production reads.

## 1. Recommendation in one paragraph

Use **two AWS KMS Ed25519 keys** (`ECC_NIST_EDWARDS25519`, pure `ED25519_SHA_512` over `RAW` messages). Their key policies allow `kms:Sign` only to **one AWS Lambda, `blsh-signer`**, which runs the evidence policy and holds no key. Signing is allowed only in `RAW` mode and only inside a per-day `aws:CurrentTime` fence.

The **database pushes** the evidence to the Lambda from pg_cron, and the Lambda **derives every signed field itself** from three sources:
- TJ's mandate;
- that evidence, checked against the mandate;
- the public NHL schedule.

A DynamoDB conditional put makes each approval **one-shot**. The Lambda returns the envelope; pg_cron forwards it to the unchanged request-context route, or stores the official grant in Vault for the unchanged 12:45 dispatch.

The verifier code at Y is **unchanged**, and the local proof drives Y's real handlers end to end. Cost is **about $2.00 a month**. Custody lives in TJ's AWS account. No Vercel token and no Supabase service-role key can make it sign. The one weaker point is the trigger bearer, which is readable by SQL as `postgres` (§5). A bearer holder can at most get an approval over forged native IDs for the approved slate and deployment. Y's verifier refuses that approval before any claim (proved), but it burns that day's slot.

## 2. Verifier facts this must satisfy (read at Y `1efdfb436`)

- **Pure Ed25519.** Both handlers call `verify(null, bytes, key, sig)` with a raw 64-byte signature (`/^[A-Za-z0-9+/]{86}==$/`). The public key is one SPKI PEM block of at most 512 characters. The handlers do no key-ID or fingerprint check; the env public key *is* the identity.
- **Request-context signed bytes:** the UTF-8 JSON array `["fhfh.blsh.request-context-approval.v1", sourceDate, nativeRunId, nativeManifestSHA256, deploymentId, gitCommitSha]`, with no newline. It travels as a POST body of at most 1 KiB, `application/json`, and `{approval, signature}` with exact keys.
- **Official signed bytes:** `["fhfh.blsh.official-pilot-approval.v1", sourceDate, nativeRunId, nativeManifestSHA256, scheduleSHA256, deploymentId, gitCommitSha, gameIds]`. It travels as the base64 of the envelope bytes in header `x-blsh-official-grant`, read from Vault `blsh_official_grant_<slate>` by the 12:45 job.
- **Bound at the handler:**
  - `deploymentId === VERCEL_DEPLOYMENT_ID` and `gitCommitSha === VERCEL_GIT_COMMIT_SHA`;
  - the slate literal and the 12:45:00–12:45:59 slot (official);
  - `sourceDate` = ingress day − 1 (request-context).
- **Bound in the DB claim (official):**
  - `scheduleSHA256` must equal native object 6 (`schedule.raw.json`);
  - the native deployment must match;
  - the claim must fall inside the slot.

## 3. Options evaluated (official docs; details and URLs in §13)

| Option | Ed25519 pure, non-exportable? | Workload identity / policy scope | Where policy runs | Monthly cost (2 keys, ≤100 signs) | Verdict |
|---|---|---|---|---|---|
| **A. AWS KMS + AWS Lambda signer** (recommended) | **Yes:** `ECC_NIST_EDWARDS25519`, `ED25519_SHA_512` with `MessageType=RAW`, 1–4096-byte messages; key "never leaves AWS KMS unencrypted" | The key policy names the Lambda role; `kms:MessageType`, `kms:SigningAlgorithm` and `aws:CurrentTime` conditions; an explicit Deny for every other principal | The Lambda in TJ's AWS account, **outside the Vercel team and Supabase** | **≈ $2.00** ($1/key; Sign $0.15/10k; Lambda, DynamoDB and logs inside the free tier) | **Recommend** |
| B. AWS KMS + a separate Vercel project signer (Vercel OIDC → STS) | Yes (same keys) | Vercel OIDC `sub` = `owner:<team>:project:<name>:environment:production`. **There is no deployment claim**, so any production deploy of that project could sign. | A second Vercel project. Any Vercel team token holder (agents included) can deploy new policy code. | ≈ $2.00, plus a 7th Vercel project touched by every push | Viable, weaker custody |
| C. GCP Cloud KMS `EC_SIGN_ED25519` + Cloud Run function | Yes (PureEdDSA, SOFTWARE only). Max data size undocumented. | Workload Identity Federation / service account; `roles/cloudkms.signer` on one key | Cloud Run in a GCP project | **≈ $0.12** | Equivalent alternative, more moving parts |
| D. Vercel KMS (`@vercel/kms`) | **No.** The REST create-issuer enum is RS/PS/ES only (`EdDSA` appears only on the CLI page; treat it as unavailable). Beta. | Project + environment grant; **no deployment pin** | Inside the calling project, which is the verifying app | ≈ $0 | Not eligible |
| E. Supabase Edge Function + Vault | **No.** Vault decrypts for privileged roles, and the project root key can be exported. | Supabase service role | Supabase | ≈ $0 | Not eligible |
| E′. Supabase Edge Function + AWS KMS | Yes | No documented workload identity, so it needs a long-lived AWS access key in Supabase secrets | Supabase; Supabase token holders can redeploy | ≈ $2.00 | Not recommended |

**Key question: where the evidence policy runs.** Under D, and under any design where fhfhockey calls KMS, **the same app that verifies would decide what to sign**. That fails the requirement. A and B separate them. A is the cleaner separation: the policy code, the keys and the mandate all sit in TJ's AWS account, where no agent holds credentials, while the verifying app (Vercel) and the evidence store (Supabase) can only *ask*.

## 4. Design (option A)

```
12:05  pg_cron 404 → fhfhockey native route (unchanged) → native receipt rows in Supabase
12:35  pg_cron  rc_sign        → net.http_post(Lambda /request-context, body = evidence built IN Postgres, Bearer from Vault)
                                  Lambda: mandate ✓ window ✓ evidence ✓ key fingerprint ✓ reserve ✓ → KMS Sign → envelope
12:36  pg_cron  rc_post        → read + DELETE the Lambda response row → net.http_post(fhfhockey /api/v1/db/blsh-request-context, envelope)
                                  (Y's handler verifies, claims, writes the context packet; ≤225 s)
12:41  pg_cron  official_sign  → net.http_post(Lambda /official, evidence incl. context runs)
                                  Lambda: + context complete ✓ RC issued for same receipt ✓ public NHL slate = mandate ✓ → KMS Sign
12:42  pg_cron  official_store → read + DELETE the response row → vault.create_secret(grantBase64, 'blsh_official_grant_<slate>')
12:45  pg_cron  official       → the reviewed SCHEDULE-ONCE command, byte-identical → GET fhfhockey official route (unchanged)
```

- **The signer has no message input.** Each route takes only the evidence document, and any extra member, query string, unknown route, GET, duplicate JSON key or wrong bearer is refused (proved). It signs only the two verifier formats.
  - **From TJ's mandate:** slate, game IDs, deployment, SHA, window and key.
  - **From the pushed evidence:** native run ID, manifest hash and schedule hash. These are checked for internal consistency and against the mandate, but **the signer cannot see Storage**. So a caller holding the Vault bearer could submit self-consistent forged values and receive an approval over them.
  - The proof shows that case: Y's request-context handler then refuses with `native_source_unverified` before any claim. An official grant over forged hashes would likewise fail the DB claim's native and schedule binding. The forgery is therefore a **denial of service** (the one-shot slot is burned), not a usable approval for anything else.
- **Evidence is pushed by the database, not pulled.** A pull would need a Supabase credential in the signer: the service-role key, or a custom-role JWT minted with the project JWT secret. Both are broader than the signer needs, so the signer holds **no Supabase credential**. The evidence is built inside Postgres by `fhfh_internal.blsh_signer_evidence_<slate>()`, which runs as the cron owner, and is sent with a bearer stored in Vault and the Lambda environment.
- **What "independently verified" means here.** The table below says, for each fact, who asserts it. The signer does not re-hash Storage bytes; Y's handler and the DB custody functions already do that, and the proof runs them for real.

| Fact the signer checks | Source | Independent of the verifying app? |
|---|---|---|
| Slate date, game IDs, READY deployment ID, SHA, windows, key fingerprints | TJ's mandate (Lambda config, TJ's AWS account) | **Yes** |
| Deployment pin | `public.blsh_pilot_<capture>` written by INSTALL (TJ line), equal to the mandate | **Yes** (DB operator, not the app) |
| Native run exists, complete, unpruned, claimed 12:05–12:07, closed before 12:35, deployment binding | `blsh_capture_runs`, written by the app's native route through service-role RPCs; the claim is gated by the INSTALL trigger (pin and time) | App-asserted. Claim time and deployment are **DB-enforced**. |
| 20-object index, storage sizes, object 20 = manifest hash | `blsh_context_source_v1` | App-asserted, **DB-enforced** consistency |
| `scheduleSHA256` | Object 6 hash in the index | App-asserted (the DB claim binds the same value) |
| Every game on the slate final, regular season, set = mandate | **Public NHL schedule fetched by the Lambda** | **Yes (third party)** |
| Context run complete for the same native receipt; no official run yet | `blsh_context_runs`, `blsh_official_runs` | App-asserted, **DB-enforced** |
| One approval per kind and slate, request-context before official | Signer's own DynamoDB ledger | **Yes** |
| Time | Lambda clock + KMS key-policy fence (AWS); the DB clock must agree within 30 s | **Yes** |

## 5. Custody change (exact)

| | Before (CUSTODY.md, Part B) | After (this proposal) |
|---|---|---|
| Private keys | TJ generates two keypairs with `openssl` on an off-Mac machine he would have to own; the `.key` files live there | Generated **inside AWS KMS** (`ECC_NIST_EDWARDS25519`) in TJ's AWS account. Non-exportable; no human or machine ever holds them. |
| Who can sign | Whoever holds the `.key` files | Only the IAM role `blsh-signer-lambda`, only `RAW`/`ED25519_SHA_512`, only inside the per-day fence. An explicit Deny covers every other principal, TJ's admin included. Changing that needs a key-policy edit, which CloudTrail logs. |
| Decision to sign | TJ by hand at 06:35 CT, after checking the native packet | `blsh-signer` policy code, sha256-pinned, against TJ's mandate. **No in-window human action.** |
| TJ's approval before ARM | Implicit in being the signer | Explicit: paste the mandate (slate, games, deployment, SHA, windows, fingerprints) into the Lambda and set the key-policy fence, **before ARM**, then the AUTOMATE-ONCE + ARM lines |
| Public keys and fingerprints | `.pub` files → `verify-approval-public-key.mjs` → Vercel | `kms get-public-key` (DER) → PEM → the **same** checker and fingerprint rule (sha256 of the 44-byte SPKI DER) → the same Vercel variables |
| Official grant to Vault | DB operator by hand, 12:35–12:44:59 | pg_cron step `official_store` at 12:42 |
| Never in Vercel env, `.env`, Git, logs, chat | `.key` files | **Holds trivially:** private keys never exist outside KMS. The signer logs decision codes and hashes only (proved). |

**Residual trust, stated plainly.**
- **AWS admin (custody root).** Anyone with admin rights in TJ's AWS account could change the Lambda code or the key policy, and so could sign other bytes inside the fence.
- **Trigger bearer (DoS only).** Anyone who can read `blsh_signer_trigger_secret` can call the signer with self-consistent forged evidence inside the window and burn that day's slot (§4). That includes SQL access as `postgres`, such as an operator or an agent session using a Supabase SQL tool. They cannot obtain an approval the verifier would accept for a different receipt, slate, deployment or slot. Setup line **S2b** checks that `service_role` (the Vercel app's key) cannot read it. Mitigations:
- root MFA;
- no IAM users or access keys for anyone else, agents included;
- CloudTrail event history (90 days, free) records `Sign`, `PutKeyPolicy` and `UpdateFunctionCode`;
- the Lambda's `CodeSha256` is pinned in the approval lines.

Even forged bytes are useful only for the one deployed verifier, slate and slot, because Y's handler pins those itself.

## 6. Setup (TJ in the AWS console and CloudShell, from the Mac's browser; no second computer). About 60–75 min once.

All steps use region **us-east-1**. CloudShell is a browser shell, so no local AWS credentials are needed. `<ACCT>` = TJ's account ID.

- **S1. Account guardrails.**
  1. Use or create an AWS account.
  2. Turn on root MFA.
  3. Create a $5 monthly budget alarm.
  4. Create no IAM users and no access keys.
- **S2. Resources.**
  1. **DynamoDB:** table `blsh-signer-issuance`, partition key `slot` (String), on-demand.
  2. **IAM role** `blsh-signer-lambda`. Trust `lambda.amazonaws.com`. Inline policy:
     - `kms:Sign` and `kms:GetPublicKey` on the two key ARNs;
     - `dynamodb:PutItem`, `UpdateItem` and `GetItem` on the table ARN;
     - the managed `AWSLambdaBasicExecutionRole`.
  3. **KMS keys:** two asymmetric keys, `SIGN_VERIFY`, key spec `ECC_NIST_EDWARDS25519`. Aliases `alias/blsh-request-context-v1` and `alias/blsh-official-pilot-v1`. Key policy (both keys; the fence starts *in the past*, so the keys are inert until S6):
     ```json
     {"Version":"2012-10-17","Statement":[
      {"Sid":"Admin","Effect":"Allow","Principal":{"AWS":"arn:aws:iam::<ACCT>:root"},"Action":"kms:*","Resource":"*"},
      {"Sid":"DenySignToAllButSigner","Effect":"Deny","Principal":"*","Action":"kms:Sign","Resource":"*",
       "Condition":{"ArnNotEquals":{"aws:PrincipalArn":"arn:aws:iam::<ACCT>:role/blsh-signer-lambda"}}},
      {"Sid":"SignerSignInFence","Effect":"Allow","Principal":{"AWS":"arn:aws:iam::<ACCT>:role/blsh-signer-lambda"},"Action":"kms:Sign","Resource":"*",
       "Condition":{"StringEquals":{"kms:MessageType":"RAW","kms:SigningAlgorithm":"ED25519_SHA_512"},
                    "DateGreaterThan":{"aws:CurrentTime":"2026-01-01T00:00:00Z"},"DateLessThan":{"aws:CurrentTime":"2026-01-01T00:00:01Z"}}},
      {"Sid":"SignerPublicKey","Effect":"Allow","Principal":{"AWS":"arn:aws:iam::<ACCT>:role/blsh-signer-lambda"},"Action":"kms:GetPublicKey","Resource":"*"}]}
     ```
  4. **Lambda** `blsh-signer`:
     - Node.js 22.x, arm64, 256 MB, timeout 10 s, role `blsh-signer-lambda`;
     - code = a zip of `blshSigner.mjs` + `lambda-index.mjs` (handler `lambda-index.handler`); record the console's `CodeSha256`;
     - function URL, auth `NONE`, no CORS;
     - env:
       - `BLSH_SIGNER_LEDGER_TABLE=blsh-signer-issuance`;
       - `BLSH_SIGNER_MANDATE={"armed":false}`, which is refused as `mandate_invalid`;
       - `BLSH_SIGNER_TRIGGER_SECRET` = 48 random characters from CloudShell `openssl rand -base64 36`.
  5. **Supabase Vault:** the DB operator creates `blsh_signer_trigger_secret` with the same value, under TJ's line. The trigger secret is a bearer, not a signing key. It travels by clipboard only, never chat.
  6. **S2b (production read, separate approval).** Confirm `service_role` has no read on `vault.decrypted_secrets`, for example `select has_table_privilege('service_role','vault.decrypted_secrets','select')` must return false. If it is true, the Vercel app could read the bearer: stop and redesign the bearer path.
- **S3. Real-KMS probe (closes the gap the mock can't).** In CloudShell:
  1. Create a **third, disposable** Ed25519 key with a default policy.
  2. `aws kms sign --message-type RAW --signing-algorithm ED25519_SHA_512` on a fixed probe string.
  3. `get-public-key`, then verify with `openssl pkeyutl -verify -pubin -rawin` (OpenSSL 3) and with the repo checker under `node`, if CloudShell has Node 22; otherwise verify the base64 outputs on the Mac.
  4. Expect a 64-byte signature and a 44-byte DER key.
  5. `schedule-key-deletion --pending-window-in-days 7` (no charge while pending).
- **S4. Public keys.**
  1. `aws kms get-public-key` for both aliases.
  2. Convert each to PEM: `openssl pkey -pubin -inform DER -outform PEM`.
  3. Run `verify-approval-public-key.mjs --name … --file …` and record the fingerprints.
  4. The independent verifier recomputes them (Part B5, unchanged).
  5. Stage both in Vercel production **before** the keyed push (K1, unchanged; the keys bind at build).
- **S5. Candidate (lane work).** Re-date to the chosen slate: web literals, a new re-date migration, operator SQL including `AUTOMATE-ONCE.sql`/`CANCEL-SIGNER-STEPS.sql`, and `CUSTODY.md` + Part B rewritten for KMS. Rerun the PG15 suite and this proof on the re-dated SQL. Line F for the new SHA.
- **S6. Per pilot day, before ARM** (after the K2 READY readback and INSTALL). TJ:
  1. Pastes the mandate into `BLSH_SIGNER_MANDATE`, generated by Chef from the readback. Example:
     `{"version":"fhfh.blsh.signer-mandate.v1","armed":true,"sourceDate":"2026-11-25","captureDate":"2026-11-26","gameIds":[…14 ids…],"deploymentId":"dpl_…","gitCommitSha":"…","keys":{"requestContext":{"keyId":"alias/blsh-request-context-v1","fingerprint":"sha256:…"},"official":{"keyId":"alias/blsh-official-pilot-v1","fingerprint":"sha256:…"}},"windows":{"requestContext":["2026-11-26T12:35:00Z","2026-11-26T12:38:00Z"],"official":["2026-11-26T12:41:00Z","2026-11-26T12:44:00Z"]},"approvalRef":"TJ line S6 2026-11-25"}`
  2. Sets each key policy's fence to `12:35:00Z–12:45:00Z` on the capture day.
  3. Then the DB operator runs `AUTOMATE-ONCE.sql -v signer_url=…` and then `ARM.sql`.
- **S7. Live privilege and connectivity check, no signature (REQUIRED before the first S6; separate approval).**
  - **Why:** the proof ran every SQL step as a local superuser, but production `postgres` is not one, and the step function turns any error into `enqueue_failed`. A missing privilege would silently waste a slate.
  - **Who and how:** as the **cron job owner**, inside one transaction that is rolled back except for the HTTP call. Exercise exactly what the steps use:
    - `net.http_post` with a jsonb body and custom headers to `<signer_url>/request-context`, while the mandate is disarmed (expect HTTP 423 `mandate_invalid`);
    - read and `delete` of that row in `net._http_response`;
    - `vault.create_secret` on a throwaway name, then delete it;
    - `cron.schedule` / `cron.unschedule` of a no-op job.
  - **After the S6 paste**, before ARM: repeat the POST and expect `outside_signing_window`. That proves the armed mandate parses without signing.
  - **Cost:** about 2 Lambda calls and a handful of DB statements. The Lambda's decision log shows real pg_net body handling.
  - **Optional, no production request:** if Docker is available, the same check on a local Supabase stack (real pg_cron, pg_net and Vault) can come first.

## 7. Cost

| Item | Monthly |
|---|---|
| 2 × KMS asymmetric keys (prorated hourly; no charge while pending deletion) | $2.00 |
| KMS Sign / GetPublicKey (asymmetric, not free tier): ~4–10 calls per pilot day | < $0.01 |
| Probe key (S3), ~1 day and then pending deletion | < $0.05 once |
| Lambda: a few invocations (free tier 1M requests) | $0.00 |
| DynamoDB on-demand: a few items | $0.00 |
| CloudWatch Logs: a few KB | $0.00 |
| **Vercel** | **No new project and no extra build.** Public keys ride the same single keyed push as today. |
| **Supabase** | Existing pg_cron/pg_net; 4 extra one-shot jobs per pilot day |
| **Total** | **≈ $2.00/month** while the keys exist (GCP option C: ≈ $0.12) |

## 8. Stop switch (any one is sufficient; none needs a build)

1. **AWS KMS → both keys → Disable.** Immediate, subject to eventual consistency. KMS refuses use of a disabled key, so the signer refuses: `key_identity_mismatch` or `kms_unavailable` if `GetPublicKey` fails first, or `kms_sign_failed`. In the mock, `Sign` failed after the reserve and the slot stayed reserved; real KMS may refuse earlier, and S3 can check which. This works from a phone.
2. **Lambda `blsh-signer` → Throttle** (reserved concurrency 0, so the function URL fails), **or** set `"armed": false` in the mandate (`signer_disarmed`).
3. **Database:** `CANCEL-SIGNER-STEPS.sql` + reviewed `CANCEL-OFFICIAL-ONCE.sql`, then `DISARM-ROLLBACK.sql` / `SWITCH-OFF.sql` as today. Every pilot job is removed; jobs 404–408 are untouched; a rerun does nothing (proved).
4. **Passive:**
   - the key-policy fence closes at 12:45Z;
   - code-bounded windows (request-context ≤ 12:39, official ≤ 12:44:30);
   - each DB step acts only inside its own minute and never retries;
   - any refused or missing upstream step makes every later step a no-op, and the 12:45 job then finds no grant (`refused`). The proof shows this for a signer outage and for request-context still running at 12:41.

## 9. Timing and slack (capture day, Z)

| Step | Fires | Must finish by | Slack |
|---|---|---|---|
| Native (job 404) | 12:05 | closed before 12:35 (signer check) | ~28 min |
| rc_sign → Lambda (KMS + DynamoDB, plus cold start) | 12:35:00 | response before rc_post at 12:36:00 (pg_net timeout 15 s) | ~45 s |
| rc_post → request-context route (≤ 225 s work budget) | 12:36:00 | context complete before 12:41:00 | ≥ 75 s at the worst case |
| official_sign → Lambda (+ NHL schedule fetch, 5 s timeout) | 12:41:00 | response before 12:42:00 | ~45 s |
| official_store → Vault | 12:42:00 | before 12:45:00 | 3 min |
| official dispatch (reviewed command) | 12:45:00 | slot 12:45:00–12:45:59 | as today |

pg_cron start lag of more than about 60 s on any step causes `expired` → fail closed, with no official run. Real jitter is unmeasured; see S7.

## 10. Code and SQL changes the pilot candidate needs

- **`web/` (verifier): none for the signer.** The proof drives Y's unchanged `requestContextHandler` and `officialPilotHandler`. The request-context route accepted the KMS-signed envelope exactly as Postgres `jsonb::text` re-serialized it: 399 bytes, reordered and spaced. Only the existing **re-date literals** change for the new slate (out of this lane's scope).
- **`supabase/migrations`: none for the signer.** The evidence and step functions and their two tables are created in `fhfh_internal` by operator SQL (`AUTOMATE-ONCE.sql`), the same pattern as SCHEDULE-ONCE's dispatch table. A post-pilot cleanup SQL (drop the four objects) is a separate approval. The re-date still needs its own migration.
- **Operator SQL:**
  - `AUTOMATE-ONCE.sql` **replaces** the hand-run `SCHEDULE-ONCE.sql`. It is run once, after INSTALL and before ARM. Its 12:45 command is byte-identical to the reviewed `33b1ead0…` file, and the proof asserts this.
  - `CANCEL-SIGNER-STEPS.sql` **joins** the disarm set.
  - INSTALL, ARM, DISARM, CANCEL-OFFICIAL-ONCE and SWITCH-OFF are **unchanged**; their pins matched in this run (`out/live-sql-pins.txt`).
- **New non-web code:** `blshSigner.mjs` and `lambda-index.mjs`. Proposed home: a top-level `blsh-signer/` folder, outside every Vercel root directory. It is deployed only by TJ to Lambda and never by a Vercel build.
- **Docs:** `CUSTODY.md` and `STEPS-L7-AND-CUSTODY.md` Part B are rewritten for KMS custody (owner: BLSH Chef).
- **FORGE closure:** derived from the X receipt's module list (243 modules under `web/`). It contains **no BLSH module** and **no signer file**, so the signer cannot change the closure. Only the two L7 NST files are in it.
- **Line F:** any new commit still needs a registry entry and line F for its SHA, as it does today.
- **L7 (Astra):** covers `web/lib/cron/nstClassification*.ts` and `nstCoordination*.ts`, which the signer leaves untouched, so **L7 stays valid** while those four files are unchanged.

## 11. Earliest eligible slate (dependency chain; schedule read 11-21 19:51Z ends at 11-27)

| Slate (games) | Capture (Z / CT) | Needs, from TJ's S0 approval | Call |
|---|---|---|---|
| Nov 23 (7) | Tue 11-24 12:05Z / 06:05 | S1–S4 + candidate + push + INSTALL within ~30 h | **Too tight. Would rush.** |
| Nov 24 (1) | Wed 11-25 | Candidate by Tue; one game | Not worth a pilot |
| **Nov 25 (14)** | **Thu 11-26 12:05Z / 06:05 CT** (US Thanksgiving) | S0 Sun 11-22 · S1–S4 Mon 11-23 · S5 candidate + gates + line F Tue 11-24 · K1/K2 push Wed 11-25 · migration + INSTALL + S6 + AUTOMATE + ARM Wed evening | **Earliest eligible**, with about one day of slack per stage. TJ must be available Wed evening; nothing is needed in the window. |
| Nov 26 (0) | — | — | No slate |
| **Nov 27 (15)** | **Sat 11-28 12:05Z / 06:05 CT** | Same chain with about 2 more days | **Fallback, if any Nov 25 stage slips** |

Rule: if S3 (real-KMS probe) or the S5 gates are not green by **Tue 11-24 23:59 CT**, Nov 25 is dropped for Nov 27 without extending anything.

**Re-date estimate (out of scope here).** About 2–3 h mechanical, about 1 h of gates, plus about 30 min to re-date AUTOMATE/CANCEL-SIGNER-STEPS and rerun this proof. Fold Nov 25 and Nov 27 variants into one lane run so the fallback is ready.

## 12. Approval lines for TJ (each needs its own yes; nothing is pre-approved)

- **S0 Design.** Adopt option A: AWS KMS (2 × Ed25519) + Lambda `blsh-signer` + DynamoDB ledger, with the custody change in §5. The pilot stays on hold until S6.
- **S0b Transport choice.** Keep the request-context route **unchanged**, POST-only, and let pg_net send three POSTs: two to the signer, one to the route. The official route stays a GET. *Alternative:* change the request-context handler to accept a GET with a header. That is a verifier change needing new review and gates, so it is not recommended.
- **S1 + S2 AWS setup** as in §6, done by TJ. The Lambda `CodeSha256` and the two key fingerprints are recorded in the custody record.
- **S2b** One production read: `service_role` cannot read the Vault bearer.
- **S3 Real-KMS probe** on a disposable key. Required before S4.
- **S4 Public keys:** fingerprints recomputed by the independent verifier, then staged in Vercel production at K1.
- **S5 Candidate** for the Nov 25 slate (fallback Nov 27), with these SQL files re-dated and the proof rerun.
- **S6 Per-day arm:** mandate paste + key fence (TJ), then AUTOMATE-ONCE and ARM (DB operator).
- **S7 (required) Live privilege and connectivity check** as the cron owner (§6): pg_net POST, delete of the response row, `vault.create_secret`, `cron.schedule`/`unschedule`. Expect 423 while disarmed, and `outside_signing_window` after the S6 paste.
- **S8 After the pilot:**
  - mandate `armed:false`;
  - keys disabled, then scheduled for deletion or kept (TJ records the decision against the fingerprints);
  - Vercel public keys removed at the next approved deploy;
  - a separate approval for the `fhfh_internal` cleanup SQL.

## 13. Proof summary (`proof/`, see `proof/README.md` for the real-versus-stand-in table)

**7/7 tests, 54 PASS lines plus 1 FINDING** (`proof/out/proof-log.txt`).

**Full hand-off, end to end:**
- native receipt (via Y's real claim RPC under the pinned INSTALL/ARM);
- 12:35 signer issues → 12:36 Y's request-context handler accepts the envelope **as Postgres re-serialized it** and completes the context packet in real PG;
- 12:41 signer issues → 12:42 Vault → 12:45 the byte-identical reviewed dispatch → Y's official handler returns `packet_complete_pending_review`, and the real `blsh_official_claim_v1` accepts the slot, native binding, schedule hash and deployment;
- exactly 2 KMS signatures; every job removed itself; no signer response row left; the signer log holds codes and hashes only.

**Refusals, each with zero signatures:**

| Category | Cases |
|---|---|
| Wrong slate | mandate dated for another slate; native run or receipt naming another slate inside a valid window; public slate mismatch; slate not final |
| Wrong SHA or deployment | three cases |
| Missing or unverified receipt | four cases, including Y's `blsh_context_source_v1` raising on a storage-size mismatch |
| Early or late window | request-context, official, and a mandate that widens the window |
| Conflicting evidence | five cases, plus stale evidence |
| Duplicates | duplicate after issuance; a concurrent pair → exactly one signature; crash between reserve and sign → stays refused |
| Arbitrary input | extra member, `/sign`, query, GET, duplicate JSON key, wrong bearer |
| Key identity | wrong key fingerprint |
| Stop switches | mandate disarmed, KMS disabled, DB cancel; a rerun is a no-op |
| Mock KMS | refuses the **verifying app's identity**, prehash mode, and signing outside the fence |
| Late paths fail closed | signer down; request-context still running at 12:41; a missed minute |
| AUTOMATE-ONCE registration | refuses after 12:05, a non-Lambda URL, and a second registration |

**FINDING (residual risk, §4/§5):** with the Vault bearer, self-consistent forged evidence gets an approval. Y's request-context handler refuses it (503 `native_source_unverified`, 0 context runs), but the legitimate request is then refused as `duplicate_request`. That is a denial of service, not forgery.

**Not proven locally:**
- real KMS output format (S3);
- production privileges of the cron owner (S7);
- real pg_net and pg_cron behaviour and jitter (S7);
- Lambda cold start;
- the native capture itself.

**Sources (official):**
- AWS: [KMS key specs](https://docs.aws.amazon.com/kms/latest/developerguide/symm-asymm-choose-key-spec.html), [Sign](https://docs.aws.amazon.com/kms/latest/APIReference/API_Sign.html), [EdDSA launch](https://aws.amazon.com/about-aws/whats-new/2025/11/aws-kms-edwards-curve-digital-signature-algorithm/), [GetPublicKey](https://docs.aws.amazon.com/kms/latest/APIReference/API_GetPublicKey.html), [KMS condition keys](https://docs.aws.amazon.com/kms/latest/developerguide/conditions-kms.html), [enabling and disabling keys](https://docs.aws.amazon.com/kms/latest/developerguide/enabling-keys.html), [deleting keys](https://docs.aws.amazon.com/kms/latest/developerguide/deleting-keys.html), [CloudTrail Sign](https://docs.aws.amazon.com/kms/latest/developerguide/ct-sign.html), [KMS pricing](https://aws.amazon.com/kms/pricing/).
- Vercel: [OIDC reference](https://vercel.com/docs/oidc/reference), [OIDC with AWS](https://vercel.com/docs/oidc/aws), [Vercel KMS](https://vercel.com/docs/kms), [KMS create-issuer API](https://vercel.com/docs/rest-api/sdk/kms/create-an-issuer), [KMS project grants](https://vercel.com/docs/kms/concepts/project-grants), [KMS pricing](https://vercel.com/docs/kms/pricing).
- GCP: [KMS algorithms](https://docs.cloud.google.com/kms/docs/algorithms), [KMS pricing](https://cloud.google.com/kms/pricing).
- Supabase: [Vault](https://supabase.com/docs/guides/database/vault).
- Facts the docs do not state, marked UNCONFIRMED in research:
  - AWS Ed25519 signature encoding (the launch post says 64 bytes; S3 confirms);
  - GCP maximum data size;
  - Lambda reserved concurrency of 1 on a new account (not relied on).
