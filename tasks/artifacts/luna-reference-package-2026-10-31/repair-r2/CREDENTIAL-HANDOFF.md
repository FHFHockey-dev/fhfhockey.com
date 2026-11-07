# Credential policy amendment — owner-selected non-expiring evaluation key

**Current stop:** the parent reports an unrelated browser snapshot captured an open API-key dialog containing a secret; its identity is unconfirmed. Do not inspect that secret or use the saved evaluation key. Paid/key use is blocked until TJ explicitly confirms the active evaluation key was not the exposed key, or that it has been replaced after the exposed key was revoked. This worker has not read or used any key, made paid calls, or retried a credential action. Prior save confirmation below is historical and does not clear this stop.

TJ explicitly chose a non-expiring restricted evaluation key on October 31: “I have the key set to expire never. We can use it throughout testing, I will rotate it once we are ready to go to production with it.” This supersedes the earlier local 24-hour expiry proposal in the [preflight](../PAID-EVALUATION-PREFLIGHT.md) and [R1 guide](../repair-r1/CREDENTIAL-HANDOFF.md). That duration was a task preflight choice, not a platform security requirement. The owner can change it; no hard platform/security rule is waived.

The key is restricted to the previously specified FHFHockey organization / FHFH IFTTT project permissions: `api.responses.read`, `api.responses.write`, `api.decisions.write`. No broader permissions, billing changes or hosted configuration are authorized here. Non-expiring access does not extend a spending approval, clear an uncertain ledger outcome, remove a kill switch, or activate a worker. The frozen batch still has its own expiry, aggregate cap, 20-call cap and zero-retry limit.

## User-operated entry and loading

Destination remains `/Users/tim/Code/fhfhockey.com/web/.env.local`; variable is exactly `OPENAI_API_KEY`. TJ subsequently confirmed: “the OPENAI_API_KEY is generated, and saved in my .env.local”. The saved-key prerequisite is therefore owner-confirmed. This worker has not opened the file's secret contents, authenticated with the new key or independently inspected its permissions. Preserve other local settings and keep the file user-readable only (0600). Do not send the key value in chat, screenshots, command arguments or artifacts.

The file was verified Git-ignored/untracked in R1. The existing [manual CLI](../../../../web/scripts/review-ifttt-luna.ts) reads `process.env.OPENAI_API_KEY` after admission; it does not load `.env.local` itself. A later reviewed invocation needs explicit Node `--env-file=/Users/tim/Code/fhfhockey.com/web/.env.local` before the script, or an approved inherited environment. An already-exported stale value takes precedence over the file, so use an unset `OPENAI_API_KEY` when explicitly loading it. Saving the file alone starts no evaluation and changes no hosted configuration through this CLI.

## Verified rotation gate before production

The evaluation key must **not** be reused for production. Before any separately authorized production transition, its owner/reviewer must retain a non-secret rotation receipt showing:

1. The exact old evaluation key identified by dashboard key ID/name and a masked suffix, with dashboard-confirmed revoked/deleted status and verification time. A plan to rotate or removal from a file is not revocation evidence.
2. A separately authorized replacement credential in the intended production organization/project, with reviewed minimum permissions and confirmed destination; record only non-secret metadata and verification time.
3. The old evaluation value removed from local evaluation configuration/inherited sessions, and the authorized destination/process refreshed to use the replacement. Never retain either secret in the receipt or repository artifacts.
4. Explicit authorization for the exact production release/activation. Rotation by itself authorizes neither deployment nor production dispatch.

Until that receipt is verified, the production gate remains closed. There is no automated credential revoker or new production gate implementation in this package; this is a required release/handoff condition. Current gate status: **pending, not verified**. No revocation, rotation, key creation or credential read was performed by this worker.

## Current paid-testing prerequisites

No paid calls until the credential-exposure stop above is explicitly cleared by TJ and the repaired package passes independent re-review. **TJ previously confirmed the key was saved; it has not been used by this worker.** Current promotional headroom/concurrent spending, actual organization/project scope and the authoritative ledger continuation still need verification; the synthetic rehearsal ledger cannot be used for spending. The current key-setting choice is owner-reported, not a fresh dashboard/credential verification.

The parent-reported Computer Use Terminal denial for the separate key worker remains in force. No key was created by that denied action; it was not retried or rerouted. TJ's later user-operated creation/save confirmation is distinct from that denied action and is not an assertion of successful API authentication.
