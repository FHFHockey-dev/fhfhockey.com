# Tuesday Trends production smoke-test plan (proposed; NOT executed)

Target: production deployment of master `19890a8cb` (fhfhockey project, web root) at https://fhfhockey.com.
Budget: **at most 3 application requests, sequential, concurrency 1**, plus **1 read-only Vercel runtime-log query** (observability, not an app request). Stop as soon as the check is conclusive.

| # | Who | Request | Expected | Stop condition |
|---|---|---|---|---|
| S1 | Claude (curl, no credentials) | `GET https://fhfhockey.com/api/v1/social-share/tuesday-trends` | `401`; `Cache-Control: private, no-store, max-age=0`; `Vary: Authorization`; no data body. The gate rejects the request before any Supabase data read. | Any 2xx, or a public/cacheable header → stop and report (gate regression) |
| S2 | TJ, in his own signed-in editor browser | Open `https://fhfhockey.com/social-share/tuesday-trends` once. The page makes 1 API GET, which issues the NHL schedule call plus ~11 bounded Supabase reads. | All four cards render: Recent Form, Movers, Deployment, Rates. Each shows a source line with games-thru and updated dates; no "Fixture" names; Download enabled per ready card | Any card "unavailable" → do not refresh. Go to L1 |
| S3 | TJ (optional) | Switch graphics locally (client-side, no new request), then Download one PNG | The PNG matches the on-screen card; the filename has `tuesday-trends` and the week | — |
| L1 | Claude | One Vercel runtime-log read for the fhfhockey production deployment, filtered to `[social-share]`, since deploy time | No errors; any source failure is named | End of smoke test |

Not included: cron, ETL or refresh endpoints; repeated refreshes; browser crawls; other routes; Monday re-checks (unchanged code).
