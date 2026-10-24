# C3 independent review — reload candidate accepted with limits; sign-out completion held

**Recommendation:** retain C3's reload-continuity candidate, but do not mark sign-out/privacy cleanup complete or integrate it as a fully closed cancellation-reload fix yet. The exact one-line browser-auth proposal is correct for the existing reset-helper boundary and passed isolated offline controls. Recommend that the parent authorize a minimal local auth/test lease; this review grants nothing and leaves canonical sources unchanged.

## Findings

1. **P2 — candidate alone does not clear persisted billing metadata after the app's own sign-out unmounts the panel.** Canonical `AuthProviderContext/index.tsx:94` clears the rendered user before awaiting `resetSupabaseBrowserAuthState`; `/account` therefore unmounts the panel. Panel cleanup only invalidates/unsubscribes. The subsequent reset helper does not currently match `fhfh:in-season-cancellation:v1`. C3's retained browser result explicitly observes the leftover entry. Independent offline control reproduces the boundary: unmount the exact candidate, call baseline reset, key remains; call the exact proposed reset copy, key is removed. This is the disclosed held boundary, not evidence of real unauthorized cancellation.
2. **P2 assurance correction — “for at most 24 hours” is not a physical storage-retention guarantee.** The age check runs only during restore. An independent control advances the clock 48 hours after unmount: the bytes remain; only subsequent restore discards the old ID. Without a callback, a different signed-in account can also leave the previous owner's raw metadata in the same tab until restore runs. The next cancellation does not reuse the foreign owner's request ID and rewrites the entry, as separately verified. Update the receipt/acceptance wording; a hard physical-retention promise would require additional explicitly scoped work and is not supplied by this proposal.

No cross-account request-ID reuse, token persistence, permission relaxation, new billing mutation endpoint or provider call was found in the inspected diff. The stored metadata is still account/billing information: owner ID, subscription IDs, request IDs and save timestamps. “No token/email” does not mean “no private metadata.”

## Exact diff, pins and retained evidence

- Candidate patch SHA-256 `c500b580b79f2bd1ce3bc00e50630ea3ac1d47bd1985843c53121cb8a9b420ff`: **two changed files**, within the three-file panel scope. `InSeasonPanel.rollout.test.tsx` is unchanged. The retained 4,089-file before/after manifests show only the component/test differences; this review did not rehash or copy the whole historical snapshot.
- Auth proposal SHA-256 `c0deaddc7e9421a13c3b944c37c54e1a4fb421d93452d1275eacac2538e40002`: one additional exact key regex in `web/lib/supabase/browser-auth.ts`; no auth API/timeout/credential/permission changes.
- All **30/30 packet checksums** and **4/4 canonical baseline hashes** matched at start and end. Materialized candidate patch in a reviewer-owned isolated copy reproduces both candidate files byte-for-byte. Proposal instantiated only in an isolated reviewer copy; canonical auth remains at its original hash and unapplied. Full checks: [PINS.start.json](PINS.start.json), [PINS.end.json](PINS.end.json), [PATCH-RECONSTRUCTION.json](PATCH-RECONSTRUCTION.json).

| Path | Canonical baseline SHA-256 | Isolated candidate SHA-256 |
| --- | --- | --- |
| `web/components/account/InSeasonPanel.tsx` | `e5cde3349ee10bd4d8c9623e8051eb56853c4f72d50f7a9657fef257d4c70352` | `9987664256fd615d6b47cb41d019edd7c9515456e8c02808d42d741e239776ea` |
| `web/components/account/InSeasonPanel.test.tsx` | `d21fd263ef203b557c3f34030205ff9a8fd9ce32d2fa040babb93c0f6eb8b76c` | `646b3379e105e0ae3777c196db148fcd9af1366faa757102ccb3ebeae4b3e535` |
| `web/components/account/InSeasonPanel.rollout.test.tsx` | `b63510f723564a0707ed92f581f83f02a1f6db114550ff4415ab770db9d0e930` | unchanged |
| `web/lib/supabase/browser-auth.ts` | `7f4cae98be09dd0c77da863264b61d1543f91654da3b58291df9bc016a2daf7a` | proposal copy `6c4f86fefb3219fb310513efc85aaafe3dc5b698a2fab24b78731628255ef2b0` |

C3's retained FINAL-TESTS.json/log contain **52 passed / 0 failed** (45 primary + 7 unchanged rollout tests). The log and JSON agree. Its mutation log retains failures when owner, age, future, request-ID, sign-out, persistence or accepted-removal checks are removed; no mutation was repeated here. Its original red reload reproduction and whole-project TypeScript **exit 2** remain intact. The TS log names the two Luna Buffer/BinaryLike errors; this review did not rerun or independently establish their pre-existing status and does not report a green application typecheck.

Retained browser harness/RESULTS were inspected, not replayed. Same-owner reuse/account-switch observations are supported by captured synthetic IDs. Two `CHARACTERIZATION` records hard-code pass=true while recording leftover storage; they are observations of known gaps, not passing cleanup assertions. No browser/server or production/Stripe/Supabase request was run by this reviewer.

## Proposal correctness, precise key scope and limits

The added pattern is exactly `/^fhfh:in-season-cancellation:v1$/i`. The existing helper tests its shared pattern list against **both localStorage and sessionStorage**. It deletes exactly this key and case variants in both storage areas; it does not clear `v2`, prefixed/suffixed neighbors, unrelated app state or manual/RSO plans. The component itself writes only sessionStorage. Existing auth-token/reset-key cleanup is unchanged.

The helper is called by explicit app sign-out, manual “reset local session,” and before password/OAuth sign-in. The proposal therefore clears unresolved cancellation continuity on those reset paths as well; it is not a sign-out-only hook. The existing cleanup occurs after local sign-out resolves/rejects or its timeout (normally five seconds), and storage deletion remains best effort under browser storage exceptions. Offline controls verify resolve, rejection, timeout and a blocked localStorage getter without skipping sessionStorage cleanup.

It does not erase storage in other tabs by itself. Cross-tab SIGNED_OUT with a mounted panel has an existing event cleanup path, but an already-unmounted/anonymous tab need not execute this reset helper. Likewise, anonymous startup alone does not run it. Normal AuthForm sign-in resets the key before authentication; a direct/missed session change instead relies on the candidate's owner check when restore is invoked. Do not claim global immediate deletion, hard 24h physical retention or cross-device/tab idempotency.

Route source continues to authenticate the user and verify subscription ownership before accepting cancellation; reused request IDs match the existing `cancel:${requestId}` claim key and body regexes. This is source inspection only, not a database/provider execution or exactly-once financial acceptance test. Retry continuity remains bounded to usable stored state for the same owner in the same tab and falls back to mounted memory if storage fails. Refund-consumer and private-error-copy work remains outside this candidate, as C3 states.

## Minimal safe lease recommendation — parent decision only

Recommend a fresh exact local lease for:

1. `web/lib/supabase/browser-auth.ts` at baseline `7f4cae98be09dd0c77da863264b61d1543f91654da3b58291df9bc016a2daf7a`, applying only the supplied one-pattern proposal.
2. `web/__tests__/contexts/AuthProviderContext.test.tsx` at observed baseline `7e9bb5e5f6370b1e8ffb69eca11dbcc4385fab0aa441facceb62de66758d8074`, extending the existing targeted sign-out/storage-cleanup regression. Seed the cancellation key with no mounted panel and assert cleanup plus unrelated-plan preservation; include the exact key scope/error/timeout cases as appropriate.

Reconfirm both current hashes/custody before granting. No write to AuthProviderContext implementation, AuthForm, routes, API/RPC/schema/Stripe/entitlement policy, credentials, package/lockfile, schedules, Git or hosted settings is needed for this one-line correction. Focused offline tests and diff inspection suffice; use no browser slot or full build. Candidate/release integration remains a separate parent-owned decision, not a grant from this review. Correct retention wording through C3's existing artifact owner rather than overwriting its receipt.

## Independent command/result

Cwd `web/`, Node 22.11.0/npm conventions; reviewer config/copies/cache only:

```sh
npm test -- --run --config ../tasks/artifacts/c3-independent-review-2026-10-24/review.vitest.config.mts --maxWorkers=1 --no-file-parallelism
```

**Passed, exit 0: 9/9 focused offline controls**, one invocation. Tests cover exact 24h boundary, 48h raw retention, no-callback account transition, unmount/baseline/proposal, exact key scope in both stores, sign-out resolve/reject/timeout and storage exception isolation. No owner 52-case suite repetition, broad check or browser. [COMMANDS.json](COMMANDS.json), [focused-tests.log](focused-tests.log), [storage-boundaries.test.tsx](tests/storage-boundaries.test.tsx). A punycode deprecation warning is retained. Patch reconstruction used `patch` only inside reviewer copies; commands/results are in PATCH-RECONSTRUCTION.json.

No failed reviewer test or blocked/denied/running check. Canonical sources, C3 packet and original failures are unchanged. Shared CODEX-LEASES changed concurrently and is recorded as an observation, not a reviewer write. Read-only discovery first probed absent alternate AuthProvider/account paths before locating the actual `index.tsx` files; those misses did not affect checks. No new worker, Git mutation, credential/permission change, production/paid call or lease grant occurred. The Supabase skill was consulted for local auth review; no implementation or service query was performed.
