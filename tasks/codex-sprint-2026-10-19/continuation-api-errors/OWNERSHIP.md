# R-APIERR exact ownership

Owner `01a1566f-c3e3-7fc0-9dd4-2f71a4a62233`, runtime gpt-6.1-sol/high retained; Chef xhigh. Canonical checkout octoberBranch. All candidate files clean before lane edits. Chef owns register/global checks and prior lane ownership is released.

Chef explicitly approved this exact list and the single narrow reportError factory change after read-only findings. Generic dependency errors must use sanitized fallback even when carrying a plausible statusCode; trusted DraftProRequestError retains caller validation/denials. No other shared helper changes authorized.

## Exact owned source files

- `web/pages/api/v1/trends/player-trends.ts`
- `web/pages/api/v1/account/draft-pro/drafts/index.ts`
- `web/pages/api/v1/account/draft-pro/drafts/[id].ts`
- `web/pages/api/v1/account/draft-pro/drafts/[id]/imports/[importId].ts`
- `web/pages/api/v1/account/draft-pro/reports/index.ts`
- `web/pages/api/v1/account/draft-pro/reports/[id].ts`
- `web/pages/api/v1/account/draft-pro/scenarios/index.ts`
- `web/pages/api/v1/account/draft-pro/scenarios/[id].ts`

Narrow shared helper: `web/lib/draft-pro/reports.ts` reportError factory uses existing trusted class; no other helper logic.

## Existing tests

- `web/__tests__/pages/api/v1/trends/player-trends.test.ts`
- `web/lib/draft-pro/api-tests/drafts-index.test.ts`
- `web/lib/draft-pro/api-tests/reports.test.ts`
- `web/lib/draft-pro/api-tests/scenarios.test.ts`
- `web/lib/draft-pro/api-tests/private-import-route.test.ts`

Notes/reports only within this lane. Contextual-rankings, safe GET trends/runs, ESPN/Fantrax, Yahoo/Patreon and all other-owner/fenced paths remain read-only.
