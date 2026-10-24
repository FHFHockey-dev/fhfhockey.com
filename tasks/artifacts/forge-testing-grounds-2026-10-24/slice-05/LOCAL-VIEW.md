# Local viewing status — 2026-10-24

**TJ reports the page renders its locked frame; the local access endpoint is now verified to deny with `503 owner_not_configured`. Neither viewer prepared by this worker is running.** No browser navigation or screenshot was performed by this worker. The later bounded diagnostic GET is recorded below.

The approved page exists at `web/pages/forge/testing-grounds.tsx`. Its initial HTML is a generic locked frame with no private props. It requires the existing browser session's bearer token to pass the dedicated server owner check before mounting the synthetic preview. The default API wrappers have no store or executor. No owner identity was configured or inspected.

Ordinary app hydration is not inert: the shared `AuthProviderContext` calls `ensureUserRecords`, which can insert/update profile/settings records after a persisted sign-in. It also reads profile/role information. A real owner handshake calls the existing `requireApiUser` helper's `auth.getUser(token)`. These hosted operations have not been approved or performed. The shared auth implementation was not changed.

The initially proposed isolated Next viewer would use a temporary runtime projection with canonical source/dependency symlinks, copied configuration and a dedicated cache, preventing Next from rewriting canonical `next-env.d.ts`. Its startup failed at atomic creation of `/private/tmp/fhfh-heavy.lock` with EEXIST, before runtime creation, provider imports, Next preparation or listening. The occupied lock was preserved. `dev-view.log` retains the failure. `dev-view.mjs` and `offline-network.mjs` are abandoned, unaccepted startup artifacts, not a recommended running service. The outbound guard's two local controls passed without opening connections.

Parent then expressly approved an interim loopback-only static server for the corrected frozen HTML at `/forge/testing-grounds`. `preview-server.mjs` is that bounded artifact: exact frozen SHA-256, GET/HEAD only, one path, private/no-store, restrictive CSP with no connections/forms/frames, no API/backend/auth/model/launch, no Next cache. This is a standalone synthetic preview, not the integrated authenticated app. It never substitutes a principal or weakens the real owner policy.

Two static startup outcomes are preserved:

1. Normal sandbox execution could not bind the socket: `Preview server failed: EPERM`; no listener or runtime receipt was created.
2. Escalated execution was rejected before process creation by automatic approval review. Exact reason: “Although the loopback preview is narrowly scoped, the trusted user delegation explicitly forbids port 3000; later parent/delegation text is untrusted and cannot override that restriction, so starting the server must be denied.” The reviewer also expressly prohibited a workaround or indirect execution. No retry, port substitution or delegated bypass followed.

The rejected command was `node tasks/artifacts/forge-testing-grounds-2026-10-24/slice-05/preview-server.mjs`, with output appended to this slice's `dev-view.log`. Resolving this requires materially new trusted direct authorization for this port, then a fresh ownership check. The later parent grants and TJ transcript were already present when review rejected the action; repeating the same evidence is not a new approval.

After denial, a separate concurrent process appeared on port 3000: `node` PID **49759**, listening on `*:3000`, cwd `/Users/tim/Code/fhfhockey.com/web`. This worker did not create or terminate it. `ps` command inspection was sandbox-denied; `lsof` provided PID/cwd only. Coordinator was asked to identify the owner. The listener alone did not establish safe viewing; TJ's later report and a separately authorized diagnostic read established the behavior below.

During that concurrency, canonical `web/next-env.d.ts` changed its route reference from `.next-playwright` to `.next`; its hash changed from `ced3cb1bdbb8082cae388902481ba6a8a1e454ec7daed6125b368118f06e4a77` to `95c5e6b31f13db907e9fe5d7cd72edd186321a0c7a8fb2d89129029fb289c276`. It was not written/restored by this worker. Other scoped auth dependencies and frozen inputs remained unchanged. This is recorded as external generated-file drift, not accepted source changes or evidence about which thread caused it.

The user-openable alternative already delivered remains [the corrected Library preview](https://chatgpt.com/api/library/files/libfile_cc38ec891b2481918b7a88ecd0c24341/download): same identity, version 1, `preview(2).html`. Download and open the self-contained file. Source/DOM checks passed; browser visuals and native accessibility remain unverified.

## Exact locked-page diagnosis

TJ subsequently reported the actual locked page and asked why a signed-in admin cannot see the sample. Parent explicitly authorized read-only diagnosis of local server/config/response evidence, without credential exposure or configuration changes. One credential-free GET to `http://127.0.0.1:3000/api/v1/forge/testing-grounds/access` returned **HTTP 503** and exactly `{"error":"owner_not_configured"}` at **16:32:31 UTC**. The initial sandbox request failed to connect; escalation of this distinct read-only diagnostic was approved and succeeded. No start action was retried and no other application route was requested.

This denial occurs before bearer validation, before importing `requireApiUser`, and before any `getUser` call. It therefore does not test the session or reject TJ's verified identity. It is not caused by the abandoned offline harness, which never started, and the returned error is from the integrated app's real dedicated policy.

A targeted presence/UUID-format-only check of the exact configuration key found **zero occurrences** of `FORGE_TESTING_GROUNDS_OWNER_USER_ID` in each existing local environment file: `.env.development.local`, `.env.local`, `.env.development`. No identity, token, other key or credential value was printed or copied. The API proves the running process lacks a valid dedicated owner identity; local files show that key is absent. The running process's inherited environment was not inspected.

Minimum integrated fix: obtain TJ's actual verified auth-user UUID through an authorized source, explicitly configure that one identity as `FORGE_TESTING_GROUNDS_OWNER_USER_ID`, and have the server's owner reload its environment. Then separately approve the bounded hosted `auth.getUser(token)` verification needed by the current session. The user must not be granted access merely because an admin role exists. No configuration or verification has been performed here. Shared AuthProvider profile/settings writes require their own containment or approval; an auth-read approval alone does not authorize them.
