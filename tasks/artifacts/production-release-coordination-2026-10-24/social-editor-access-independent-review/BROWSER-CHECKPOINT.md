# Frozen social-access browser checkpoint

**The planned browser gaps are closed for the original frozen access candidate, across R1 and R2. No application defect found.** This does not accept the advancing SS1 renderer or a production release.

| Run | Actual result |
| --- | --- |
| `browser-r1/` | 10 assertions passed, then one harness-selector failure. Preserved unchanged. |
| `browser-r2/` | 4 distinct remaining assertions passed; the preceding ten were not rerun beyond necessary session setup. |

R1 verified signed-out/non-editor denial, editor mount and bearer, concurrent **exact-same-URL** reads separated by account, rejection of an actual old-token helper promise, manual refresh with the new bearer and displayed edition, six invalid-URL denials before any request, renderer error/retry, and revoked-role closure. Its subsequent `getByRole('status')` selector matched both the fixture's implicit-status `<output>` and the gate paragraph. That was a harness ambiguity, not an application defect; `browser-r1/RESULTS.json`, `RUN.log` and `failure.png` retain it.

With separate coordinator authorization, R2 reused the exact R1 bundle and targeted `p[role="status"]`. It verified a late old-account role grant cannot reopen/fetch; a failed role lookup clears authority and keeps the workspace closed; logout immediately closes the workspace and rejects its actual pending edition promise; and bearer/asset isolation with no external page requests or uncaught renderer errors. `browser-r2/RESULTS.json` is passed. These are separate runs, not one all-green original run.

The actual pinned AuthProvider, gate, SocialShare and editionFetch execute in a fresh headless browser. The fixture only exposes the existing actual fetch helper to observe its shared promise; it does not replace that helper. Both runs used synthetic sessions, a mock auth/role service, an in-memory `ensureUserRecords` stub, fictional route responses, blocked service workers and request interception. R1 made six fictional API requests; R2 made three. No server, listening port, existing profile, live session, DB/account write or publication was used. Browsers closed and the shared heavy lock was released after each run.

## Pins and preservation

- All twelve access candidate pins and all 49 frozen bundle inputs matched before execution. R1 bundle and byte-identical R2 bundle: `11c34cbd6e1f60ead0f111241f365ca402f148cee80ef79cb5d5a4f832ed51b8`.
- R1 runner: `b0343a24f3dcd0067d5d0e0a715fdc50951f55a69995e256d4a6001a3e75ed7c`; R2 runner: `16c37ea19f8e9c0d4921b93103c25f0a26a42df6c64d50e0a082b04ef963ab00`.
- Every original review/control/browser artifact and the entire R1 failure evidence remain byte-for-byte unchanged. `BROWSER-CHECKPOINT.json` contains final preservation checks and artifact hashes; each version has its input/execution pins.
- I visually inspected the R1 failure screenshot (generic loading gate, no workspace) and R2 signed-out screenshot (sign-in prompt, no workspace). Neutral styling/local-font errors are fixture limits, not visual-layout or PNG-export acceptance.

## Coverage boundaries

The browser route responses are fictional. Their configured no-store header does **not** verify the server boundary. Actual-handler credentials, role denial, direct edition access, method/format/query handling and private/no-store errors remain covered by the original **35 passing local unit controls**, importing the actual handler with mocked auth/role/source dependencies. Those controls and the owner's 170 cases were preserved and not rerun here. No live API, Supabase/RLS, Next SSR/server/build, full existing E2E suite or real-account authorization claim is made.

The canonical renderer/spec had advanced before R1: `SocialShare.tsx` observed `c16e1b3adbeebca741a883b845e295be1cbc5106aa54012acc46728032c8ed92`, versus frozen `e15e95c131dc0b4d377c6d3356ad4f7d30606fabed64e0fd7e3db9cbb348fe77`; E2E spec observed `83230d539d6bcac430fc4167f318087db302f6c00e6171e23011b1d20678f904`, versus frozen `6e2d42d5ce5a554b59e8e57331cc8bea7cf8f99009abdad0cbbb5a67c7fc8edf`. The coordinator explicitly selected the original frozen target. Integrating access with a later SS1 candidate remains a separate pinned-composition prerequisite. No canonical source was copied over or edited. Role initialization and publication remain unapproved.
