# BLSH v6 disabled production deployment · November 18

TJ approved deploying `80af7e76c21b505eb2db12b93cbb936e78114143` with both verification keys unset and applying the two pinned migrations. **Complete.** The production alias serves this SHA, the native switch is off and the public trade page returned 404. The pilot has zero runs.

## Release

- Remote master and the READY production alias matched the approved base `50dea27b84a34b05a1aa6e67dc24d2774e5d3f24` before publication. Rollback deployment was `dpl_Ar31rHkggarnGjwv6Xb4SGZrbnBr`. All 56 approved blobs matched their manifest. A release-tree TypeScript check passed for the trade page and both new request handlers.
- The only push fast-forwarded remote master to [the approved commit](https://github.com/FHFHockey-dev/fhfhockey.com/commit/80af7e76c21b505eb2db12b93cbb936e78114143). Vercel confirmed `fhfhockey.com`, production, region `iad1`, deployment `dpl_D9YPjERZXhgbNrD2t1aUXt5mwc17`, READY at **16:46:56.904 UTC** and assigned to the alias. The other three production-linked entries canceled: `cms-fhfhockey` (`dpl_7xip4WmxyK4jKCpcZpqTSpBkz9ug`), `functions-fhfhockey` (`dpl_H5usqeFerZJYdxxV44moGrpUYBNY`) and the root project (`dpl_CHaFgteBpJYcsV3Cpnj4tKF1xLvw`). One web build, no redeploy.
- `BLSH_REQUEST_CONTEXT_APPROVAL_PUBLIC_KEY` and `BLSH_OFFICIAL_PILOT_APPROVAL_PUBLIC_KEY` were absent from project configuration before and after deployment and from the deployed environment-name manifest. The team shared-environment inventory returned zero entries. No key values were read back into this receipt.
- One public GET to `https://fhfhockey.com/buy-low-sell-high/trade` returned **HTTP 404** at **16:50:21 UTC**. Vercel matched the trade path and reported `PRERENDER`, request `iad1::tmn87-1795020621212-3200afe91228`. No capture, request-context, boxscore or provider endpoint was called.
- Local master points to the deployed SHA. Canonical octoberBranch was reconciled locally at `62ce797adc8c1fc35d8d262412c27835651674ef`. All 56 released paths already matched the merge tree byte-for-byte; reconciliation made zero working-file writes.

## Database

Target `fyhftlxokyjtpndbkfse`. The November 16 native and context-reader ledger entries were present before apply. Each new transaction used the approved Git blob, guarded catalog checks, a migration-history insert and a PostgREST schema-reload notification. A separate read-only connection verified each committed migration before proceeding.

| Migration | SHA-256 | UTC readback |
| --- | --- | --- |
| `20261118131414_blsh_request_context_custody` | `db35ba0993d110a10dc2a7eb9e54b5b39cf7ed7415d14b3522283b2cb62b8e9f` | 16:39:22.115850 |
| `20261118155445_blsh_official_pilot` | `dd204d114dd83befab28cc17477f77a80ab8f40c96edbcdf27eb9759a2adc220` | 16:40:12.984415 |

Both ledger versions and names matched. Verified every new function body against the commit, both unique claim constraints per run table, RLS and table grants, client RPC exclusions, and all enabled custody triggers. The request bucket is private with a 32 MiB JSON limit and restrictive client policy. The native private bucket retains its 2.5 MiB limit. Official originals use their private database table.

At 16:45:52 UTC both raw and effective native switches were false. Native, request-context and official run counts were **0 / 0 / 0**. Neither the date-permit table nor the one-time dispatch table existed. The four registered jobs were still active at their existing times: 404 at 12:05, 405 at 12:20, 406 at 12:50 and 407 at 12:52 UTC. No jobs or flags were changed by this release.

**Scout closure.** Disabled deployment and the two migrations are complete. The [Master Task List](https://chatgpt.com/space/page_227f33dd9ed48191b1b2631bf6c4204c) was updated and its BLSH entries read back. The existing operator owns Nov 19 at 12:05 and 12:20 UTC. Keep the Nov 17 v5 terminal outcome unknown, shared NST registration and L7 sign-off open, and any future enablement subject to TJ's separate approval.
