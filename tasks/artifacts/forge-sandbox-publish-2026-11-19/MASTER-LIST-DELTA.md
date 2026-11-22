# FHFH Master Task List: Nov 19 evening delta for Scout (FORGE/RSO entry)

Record this alongside the capture pass that is already logged.

**The hosted capture → publication → RSO sandbox test PASSED on Nov 19.** One Supabase Cron call reached the authenticated Next.js GET on Vercel and ran the whole chain in **11.65 s**, without TJ's Mac:

- capture (5.3 s)
- one publication from that exact claim (5.8 s, about 5 s of which is the publisher's cutoff-tolerance wait)
- both real RSO readers on the same committed revision (0.4 s)

| Item | Evidence |
| --- | --- |
| Cron | Job 410 `forge-sandbox-get-2099020991`, run 258842 `succeeded` at 22:23:00Z. The job unscheduled itself. |
| HTTP | pg_net request 1854: GET https://fhfhockey.com/api/v1/db/forge-sandbox-run → **200**, not timed out. |
| Release | SHA `66ce25aa37c08038b47296f495afebe72aadfcdb`, deployment `dpl_efjChRV3HrwFS8sQCCUxng4393NY`. One fhfhockey build; 3 other projects canceled. |
| Claim | `722dd2a3-fc89-4ddc-9c0a-d554ef32a436`. Custody and witness qualified; DigiCert genTime 22:23:05Z. Packet sha256 `3dc33030…`. |
| Publication | 1 publication, revision `04966b40-0c33-4f36-8fe2-3b04e17773cd`, published 22:23:11.5Z. |
| Daily RSO | **2.965 points at C#1**. Selected run = claim; revision `forge-daily-bridge-v1:722dd2a3…`. |
| Detailed RSO | Same claim, revision `04966b40…`, **`missing_participation`**, points and slot null. |
| Duplicate | The route's begin step, called again as the sandbox role, returned `duplicate` with the same claim. Rows stayed at 1 publication, 1 run and 1 claim. Publications are unique on claim_id and revision_id. |
| Receipt | `tasks/artifacts/forge-sandbox-publish-2026-11-19/HOSTED-RECEIPT-2099020991.json` (Claude local checkout). |

**What shipped to master.**
- Shared-module changes: `starterBoardFlags` (3 default parameters now read `forgeEnv()`); `run-forge-projections`, with an additive `computeForgePregamePublication`, an optional sidecar flag, and the model env read through `forgeEnv()`; `inputCapture` (opt-in `rejectUnrecordedReads`).
- New `forgeEnvScope`, used only by the sandbox route.
- Producer closure `78655939…` added to `VERIFIED_FORGE_PRODUCER_CLOSURES` with TJ's approval. Live FORGE runs from this build stay admitted.
- Before release, 54 live-module test files gave the same outcomes on master and on the branch.

**Isolation.**
- Private sandbox tables in the existing project. Access used the narrow `forge_sandbox_api` views and wrappers with a NOLOGIN role and an 11 h token.
- No service-role path. No signing secret in app config. No live flag changes. Job 408 stayed off. BLSH was untouched.

**Cleanup verified.** The job is disarmed, Exposed schemas are restored to `public, graphql_public, storage, analytics`, the sandbox schemas and roles are dropped, the authenticator grant is revoked, and the Vercel token is removed.

**Not proven, and still open.**
- This is a synthetic sandbox. It is not live acceptance; the live gates are unchanged.
- The candidate's `forgeDailyBridge` rewrite and `observeSuccess` were deliberately not shipped (they need to ship together).
- `octoberBranch` is now one release behind master (`66ce25aa3`). TJ decides when to sync it.
- The pgsodium support request is still with TJ to send.
