# Phase 5 validation and runtime summary

Source authority: frozen goal-start snapshot at manifest `2634689a5aa2a130be38c50975ea52d038ba85321591ca24981ec3ecf771b56f`.

All commands ran in the disposable child under a sandbox that permitted only local network access and disposable-path writes. No dependency installation, migration, deployment, cron/job invocation, ingestion, fixture load, or production write was performed. Raw logs remain external and are indexed by hash in `evidence/external-output-manifest.jsonl`; only bounded conclusions are retained here.

| Check | Result | Bounded evidence |
|---|---|---|
| `tsc --noEmit` | Passed | Exit 0; no output; no frozen-path change or extra non-dependency output. |
| ESLint over `pages components lib hooks` | Passed with warnings | 53 warnings, 0 errors. Most are `@next/next/no-img-element`; four anonymous-default-export warnings were also present. These warnings are baseline evidence, not automatic recommendations. |
| Full Vitest suite | Failed | 645 files passed; two files failed. The run reported 3,618 passing and two failing tests. One file failed collection because the intentionally blank service-role variable is required at import time. The other file had two assertions showing five active forecast migrations are absent from the frozen migration-authority manifest. |
| Targeted credential-attribution rerun | Passed | With a named non-secret dummy service-role value and outbound network denied, `rollingPlayerValidationPayload.test.ts` passed 17/17. This clears the collection failure as an audit-environment prerequisite, not a product failure. |
| Functions pytest | Passed | 60/60. |
| Player-forecast modeling pytest | Passed | 15/15. The installed Python was 3.13.0 rather than the declared 3.12 minimum; `psycopg` was unavailable but the pure test harness did not require it. |
| Yahoo identity pytest | Passed | 22/22. |
| Rankings Playwright discovery | Passed | Three tests in one spec were discovered. Discovery does not establish runtime behavior. |
| Rankings Playwright execution | Not run | The spec requires live rankings/Supabase data. Credentials and services were intentionally unavailable, and substituting production or remote data was outside the charter. |
| Next production build/postbuild | Not run | A build was not needed to resolve a remaining conclusion after type checking, tests, and a bounded dev compile. It would also execute `next-sitemap` and generate output; the repository explicitly reserves builds for build-specific necessity. |
| Next local runtime | Safety-stopped | Next 15.5.22 compiled `/404`; the page rendered at 1440×900 without root horizontal overflow. Browser asset evidence then showed third-party fonts/support imagery and Vercel telemetry scripts. Further navigation stopped because the browser client could not guarantee interception of telemetry writes. |

The local server reported tracked `web/.env.development` by filename. Repository metadata confirmed the file is tracked, not ignored. Its content was not opened, printed, copied into evidence, or inspected by the audit. Known runtime variable names were supplied non-secret dummy process values; availability of every other name remains `unknown` or `not_checked`.

The canonical snapshot remained 3,580/3,580 exact after every batch. The disposable Next process generated 42 `.next` files and rewrote its disposable copy of `web/next-env.d.ts`; both are external-output evidence and were never copied back.
