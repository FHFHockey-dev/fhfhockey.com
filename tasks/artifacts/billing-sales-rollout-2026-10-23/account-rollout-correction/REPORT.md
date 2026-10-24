# Account rollout presentation correction

P2 reproduced and corrected locally. The prior purchase closure, central policy, billing APIs and entitlement boundaries remain unchanged. Existing BILLING lease was rechecked against the release owner's recorded scope and current trusted-Yahoo lease. All34 previous packet hashes matched before this correction. No overlapping change or external operation occurred.

## Change

`InSeasonPanel.tsx` now reads **sync permission** separately from **actual membership** through the existing route/hook. Authenticated `rollout_free` permission displays that sync is currently available without a paid membership and suppresses the monthly/season purchase pitch and disabled purchase buttons. Membership verification/errors and monthly cancellation controls remain independent. Unknown/pending sync readback cannot display the purchase pitch; a failed read has its own retry. Refresh updates both views. Sign-out removes both states through the existing authenticated hook.

No route, entitlement resolver, cancellation implementation, billing policy, grant record, feature/environment flag, provider capability or stored workspace changed. Independent readiness restrictions and the unsupported Fantrax RSO adapter remain unchanged.

Exact delta: **three files**:

- `web/components/account/InSeasonPanel.tsx`
- `web/components/account/InSeasonPanel.test.tsx`
- `web/components/account/InSeasonPanel.rollout.test.tsx` (new actual route → real hook → panel regression; synthetic auth, mocked billing)

`CHANGED-FILES.json` pins the correction and32 preserved original files. `CANDIDATE.json` is the updated35-path candidate manifest. `correction.patch` applies on top of the previous34-path packet; the original packet/receipts are immutable.

## Verification

- Before patch: targeted new regression **failed1/1**, six other new cases skipped. Actual route/hook reproduced the disabled purchase presentation and missing free-sync explanation. `red-tests.json` retains the failure.
- After patch: **36/36 in one run**:29 existing account/cancellation tests plus7 route/hook/panel cases covering free, paid, grandfathered, membership outage, enforcement on, rollout-read failure and sign-out.
- Scoped TypeScript passed. Three-file ESLint passed with no diagnostics. Diff whitespace check passed. All correction pins and32 preserved source pins match.

Executed from repository root:

```sh
python3 tasks/artifacts/billing-sales-rollout-2026-10-23/account-rollout-correction/verify.py red
python3 tasks/artifacts/billing-sales-rollout-2026-10-23/account-rollout-correction/verify.py green
```

The runner uses an ordinary copy of the previously pinned snapshot, Node22.11.0/npm10.9.0, existing dependencies, synthetic import configuration and denied networking. Exact isolated cwd, environment and npm commands are in `red-commands.json` and `green-commands.json`. It runs the two named Vitest files, scoped `tsc --noEmit`, and three-file ESLint. No ignored local env, service calls, browser/server, GIT_DIR, dependency changes or database writes. Heavy-check lock released.

Counts overlap the earlier320-test packet and must not be added as356 distinct tests. This correction verifies36 cases; the32 untouched previous paths retain their prior pinned evidence. Browser execution and independent re-review remain pending.

## Manual acceptance / handoff

With synthetic authenticated free account and enforcement unset, open Account → Premium Sync: see current free-sync explanation, no plan prices or disabled purchase buttons, and no claim of paid membership. A paid/grandfathered account should still show actual membership and any existing monthly management/cancellation controls. Simulate membership-read failure: free-sync explanation remains with a separate membership error. Simulate sync-read failure: display retry and withhold purchase pitch. Sign out: previous availability/membership disappears. With enforcement explicitly on in an isolated fixture, the original free-account purchase presentation remains.

Ready for reviewer `01a15fd2-1d7a-75ac-b30d-a34a7d3d3026` and release-owner re-review via parent. No commit, push, deployment, Stripe action, credentials/configuration change, schema apply or live call. Previously issued Stripe checkout-link limitation and existing billing release gates remain as documented in the parent packet.
