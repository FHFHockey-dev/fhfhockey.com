# BLSH v6: L7 sign-off and signer-custody steps (copy-paste)

Written 2026-11-20. These steps work for any capture date; nothing in them names the window. Part A runs on the Mac, in a throwaway clone. Part B runs in the approved off-Mac signer environment, except B6, which TJ does in the Vercel dashboard and on the Mac.

Nothing here pushes, deploys, arms, re-dates or writes to production. B6 stages two production environment variables and needs TJ's explicit approval at blocker 4. Every command below was run on 2026-11-20, Part B with throwaway keys that were then deleted.

## Part A. L7 sign-off (shared NST owner and L7 reviewer, about 20 minutes, 0 builds)

What is being signed off: `blsh-native-capture` becomes a direct NST start at 12:05Z. It makes 2 NST URLs, 22 s apart, with zero retries. The 12:20Z backup shares the route and the `blsh-native-capture` audit name and is not a separate start. The code is in commits `1a6e54239` and `26f7aec97` on `refs/rc/blsh-live-readiness-20261120`, against base `dbe6a9e33`.

**A1. Make a throwaway review clone.** Never use the canonical checkout, which has other owners' work, and never set `GIT_DIR`.

```bash
export L7="$(mktemp -d)/l7" && git clone -q --no-hardlinks /Users/tim/Code/fhfhockey.com "$L7"
```

```bash
cd "$L7" && git fetch -q /Users/tim/Code/fhfhockey.com refs/rc/blsh-live-readiness-20261120:refs/heads/l7-review refs/remotes/origin/master:refs/heads/release-base && git checkout -q l7-review
```

**A2. Read the registration diff (code and schedule only).**

```bash
git diff --stat dbe6a9e3312f24c9fb2565da754b92803663ad29 l7-review -- web tasks/TASKS
```

Expect exactly 8 files: 129 insertions and 10 deletions.
- `cron-schedule.md`
- `cron-audit-wrappers.test.ts`
- `combinedCronInventory.test.ts`
- `cronAuditCoverage.ts`
- `nstClassification.ts` and its test
- `nstCoordination.ts` and its test

```bash
git diff dbe6a9e3312f24c9fb2565da754b92803663ad29 l7-review -- web/lib/cron/nstCoordination.ts web/lib/cron/nstClassification.ts web/lib/cron/cronAuditCoverage.ts tasks/TASKS/cron-operations/cron-schedule.md
```

Confirm each of these:
1. `NST_ACTIVE_DIRECT_CRON_STARTS` gains one entry, `blsh-native-capture` at minute 725 (12:05). It is 130 min after the 09:55 job and 1,225 min before the next 08:30 job.
2. `DIRECT_REMOTE_NST_JOBS` gains `blsh-native-capture` only. The backup is not added.
3. `cron-schedule.md` gains JSON rows for jobs 404–407 and one schedule-floor NST note.
   - 404 and 405 POST to `/api/v1/db/blsh-native-capture`.
   - 406 and 407 are SQL.
   - The note says nothing else scheduled is direct NST from 11:07 to 12:07.
4. The scanner change only teaches `cronAuditCoverage.ts` to recognize `withOperationalRouteAuth(...)`. That wrapper is `adminOnly` outermost, plus `withCronJobAudit` unless `audit: false`.

**A3. Merge onto the current release base**, the way it would be integrated, and run the checks.

```bash
git -c user.name=L7 -c user.email=l7@localhost merge -q --no-edit release-base && git log --oneline -1
```

```bash
ln -s /Users/tim/Code/fhfhockey.com/web/node_modules web/node_modules && cd web
```

```bash
env -u GIT_DIR npx vitest run lib/cron __tests__/pages/api/v1/db/cron-audit-wrappers.test.ts __tests__/pages/api/v1/db/cron-report.test.ts __tests__/pages/api/v1/db/cron-auth-boundaries.test.ts scripts/vercel-ignore.test.ts lib/predictions/pipelineCronAlignment.test.ts
```

Expected: `Test Files 43 passed (43)`, `Tests 579 passed (579)`. These counts were measured against release base `aa49b6c5e`; a later base may add tests.

```bash
env -u GIT_DIR npm run typecheck; echo "typecheck exit=$?"
```

Expected: `typecheck exit=0`. This takes a few minutes. Read the exit code: plain `npx tsc` can run out of memory and look clean.

**A4. Record the sign-off.** Append this block to the BLSH section of the coordination mailbox, `tasks/artifacts/cross-platform/2026-10-24-coordination/CODEX-TO-CLAUDE.md`, with the angle-bracket fields filled in:

```text
## BLSH-L7-SIGNOFF-<YYYYMMDD> · <HH:MM> UTC
L7 reviewer <name> and shared NST owner <name> reviewed refs/rc/blsh-live-readiness-20261120 (<full SHA>), the registration diff from dbe6a9e33, and its merge onto release base <full SHA>.
Vitest <files>/<files> files, <tests>/<tests> tests passed; npm run typecheck exit 0.
Registration: blsh-native-capture is a direct NST start at 12:05Z, 2 URLs 22 s apart, zero retries; the 12:20Z backup is not a separate start.
Signed off for integration in the single keyed BLSH release only. Day-of NST clearance (blocker 9) is separate and still owed.
```

**A5. TJ's approval line** (copy, answer yes or no):

> I approve integrating the BLSH L7 registration from `refs/rc/blsh-live-readiness-20261120` into master on its own, as part of the single keyed BLSH release push. No FORGE bundling, and no push under this approval.

**A6. Clean up.**

```bash
cd / && rm -rf "$(dirname "$L7")"
```

## Part B. Signer custody (TJ off-Mac, then the independent verifier, then TJ in Vercel)

Two Ed25519 keypairs, one per variable; never reuse one key for both. The `.key` files never leave the signer environment. They never go to Vercel, Git, chat, a diary, a log, Vault, cron or this Mac. Only `.pub` files and fingerprints travel.

**B0. Put the checker on the signer machine.** It is a public script with no secrets. On the Mac:

```bash
mkdir -p ~/blsh-verify && git -C /Users/tim/Code/fhfhockey.com show refs/rc/blsh-live-readiness-20261120:tasks/artifacts/blsh-pilot-readiness-2026-11-14/live-readiness-2026-11-19/verify-approval-public-key.mjs > ~/blsh-verify/verify-approval-public-key.mjs
```

On the signer machine, create the private folder first:

```bash
umask 077 && mkdir -p ~/blsh-keys
```

Copy `~/blsh-verify/verify-approval-public-key.mjs` from the Mac into `~/blsh-keys/` on the signer machine by any means. Then check its hash there. On Linux:

```bash
cd ~/blsh-keys && sha256sum verify-approval-public-key.mjs
```

On macOS:

```bash
cd ~/blsh-keys && shasum -a 256 verify-approval-public-key.mjs
```

It must print `6118ac842e25e33de6fb3df4d74cb28f5173d896e835f5add23adc22daa7d98e`. Stop on any other value.

**B1. Check the tools on the signer machine.**

```bash
openssl version; node --version
```

OpenSSL must be 3.x; `-rawin` signing needs it, and LibreSSL will not do. Node must be v22.

**B2. Generate both keypairs.** Run on the signer machine. `umask 077` makes the new files readable only by you.

```bash
umask 077 && cd ~/blsh-keys && openssl genpkey -algorithm ed25519 -out blsh-request-context.key && openssl pkey -in blsh-request-context.key -pubout -out blsh-request-context.pub
```

```bash
umask 077 && cd ~/blsh-keys && openssl genpkey -algorithm ed25519 -out blsh-official.key && openssl pkey -in blsh-official.key -pubout -out blsh-official.pub
```

```bash
ls -l
```

All four key files must show `-rw-------`.

**B3. Check each public key and record its fingerprint.** Still in `~/blsh-keys`:

```bash
node verify-approval-public-key.mjs --name BLSH_REQUEST_CONTEXT_APPROVAL_PUBLIC_KEY --file blsh-request-context.pub
```

```bash
node verify-approval-public-key.mjs --name BLSH_OFFICIAL_PILOT_APPROVAL_PUBLIC_KEY --file blsh-official.pub
```

Each must print `ACCEPTED by the handler rule: Ed25519 SPKI PEM, 44-byte DER, canonical=true` and a `fingerprint sha256:<64 hex>` line. Cross-check each with OpenSSL:

```bash
openssl pkey -pubin -in blsh-request-context.pub -outform DER | sha256sum
```

```bash
openssl pkey -pubin -in blsh-official.pub -outform DER | sha256sum
```

On macOS, use `shasum -a 256` in place of `sha256sum`. Each hex value must equal the fingerprint the script printed.

**B4. Prove each pair works.** This uses a dummy message, not an approval.

```bash
openssl pkey -in blsh-official.key -pubout | cmp - blsh-official.pub && openssl pkey -in blsh-request-context.key -pubout | cmp - blsh-request-context.pub && echo PAIRS_MATCH
```

```bash
printf 'custody-smoke-test' > smoke.bin && openssl pkeyutl -sign -inkey blsh-official.key -rawin -in smoke.bin -out smoke.sig && openssl pkeyutl -verify -pubin -inkey blsh-official.pub -rawin -in smoke.bin -sigfile smoke.sig && rm smoke.bin smoke.sig
```

Expected: `PAIRS_MATCH`, then `Signature Verified Successfully`.

**Custody record.** TJ keeps this off-Mac. Only the fingerprints may also appear in receipts.

| Variable | Fingerprint | Generated (UTC) | Verified by, at (UTC) |
| --- | --- | --- | --- |
| `BLSH_REQUEST_CONTEXT_APPROVAL_PUBLIC_KEY` | `sha256:` | | |
| `BLSH_OFFICIAL_PILOT_APPROVAL_PUBLIC_KEY` | `sha256:` | | |

**B5. Independent verifier.** This is a different person from the signer. They receive only the two `.pub` files, the checker from B0 (hash checked as in B0) and the two recorded fingerprints.

```bash
node verify-approval-public-key.mjs --name BLSH_REQUEST_CONTEXT_APPROVAL_PUBLIC_KEY --file blsh-request-context.pub --expect sha256:<recorded request-context fingerprint>
```

```bash
node verify-approval-public-key.mjs --name BLSH_OFFICIAL_PILOT_APPROVAL_PUBLIC_KEY --file blsh-official.pub --expect sha256:<recorded official fingerprint>
```

Both must print `ACCEPTED` and `MATCHES the custody-recorded fingerprint`, with exit 0. Then repeat the two OpenSSL one-liners from B3. Any mismatch stops the pilot.

**B6. Stage on Vercel.** Do this only under blocker 4's approval: after the last pre-freeze production push is READY and before the single keyed push. Staging earlier would put the keys into whatever build runs next.

1. In the Vercel dashboard, open the `fhfhockey` project, then Settings, then Environment Variables, then Add.
   - Key: `BLSH_REQUEST_CONTEXT_APPROVAL_PUBLIC_KEY`.
   - Value: paste the whole text of `blsh-request-context.pub`, with real line breaks and no quotes.
   - Environment: **Production** only.
2. **Check: Sensitive must be off.** A public key is not secret, and a Sensitive value cannot be read back in step 4. If the team policy forces Sensitive on, stop and ask TJ before going further.
3. Repeat steps 1 and 2 for `BLSH_OFFICIAL_PILOT_APPROVAL_PUBLIC_KEY` with `blsh-official.pub`.
4. Read back each stored value. Open the variable in the dashboard, copy its value, and on the Mac run the matching command:

```bash
pbpaste | node ~/blsh-verify/verify-approval-public-key.mjs --name BLSH_REQUEST_CONTEXT_APPROVAL_PUBLIC_KEY --stdin --expect sha256:<recorded request-context fingerprint>
```

```bash
pbpaste | node ~/blsh-verify/verify-approval-public-key.mjs --name BLSH_OFFICIAL_PILOT_APPROVAL_PUBLIC_KEY --stdin --expect sha256:<recorded official fingerprint>
```

Each must print `ACCEPTED` and `MATCHES`, with exit 0. The checker refuses any private key with exit 3 and never echoes its input. Never use `vercel env pull`: it writes every production secret to disk.

**What follows B6.** The one keyed push (blocker 4), then a readback of the new READY deployment ID and Git SHA. Grants are signed only against that deployment, in the window, per [CUSTODY.md](../live-readiness-2026-11-19/CUSTODY.md) step 6. If a key may have been exposed, follow CUSTODY.md step 7.
