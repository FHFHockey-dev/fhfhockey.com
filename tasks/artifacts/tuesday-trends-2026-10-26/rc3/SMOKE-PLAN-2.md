# Tuesday Trends production smoke test 2 (proposed; NOT executed)

Target: production deployment `dpl_BShSQSBknDJ7KjY9UtUcH1kM3hvY` of master `74a6e7d04` (#389, fhfhockey project). This is the first production run of READ-PLAN v2, so sparkline reads are on.
Budget: **at most 3 application requests, sequential, concurrency 1**, plus **1 read-only Vercel runtime-log query**. Stop at the first failure.

| # | Who | Request | Expected | Stop condition |
|---|---|---|---|---|
| S1 | Claude (curl, no credentials) | `GET https://fhfhockey.com/api/v1/social-share/tuesday-trends` | `401`, `Cache-Control: private, no-store, max-age=0`, `Vary: Authorization`, no data | Any 2xx or cacheable header → stop |
| S2 | TJ, signed in as editor, **one** load of `https://fhfhockey.com/social-share/tuesday-trends` (1 API GET ≈ 14 bounded statements) | — | All four cards: Hot/Cold, Ownership Movers, Deployment Changes, Rate Standouts. Each should show: light-card tiles with neon logos and stripe edges; HOT/COLD, RISING/FALLING and MORE ICE/LESS ICE labels in Tomorrow; sparklines where every point was observed; a source/freshness line dated today or yesterday. No "PP3" chip anywhere. | Any card "unavailable" or missing sparklines everywhere → no refresh; go to L1 |
| S3 | TJ (optional, client-only) | Switch graphics; Download one PNG | The PNG matches the card, neon and font render, the Tomorrow labels are present | — |
| L1 | Claude | One Vercel runtime-log read for the new production deployment, query `social-share`, since deploy | Only S1's 401 and S2's 200s; no `[social-share]` error/warning lines. In particular no `57014` statement timeout from the new S1/M2 sparkline reads | End |

Kill switch, if L1 shows sparkline-read failures or timeouts: set `SOCIAL_SHARE_TUESDAY_SPARKLINES=0` on the fhfhockey project. That is a Vercel setting change and needs TJ's approval. The cards still render without sparklines.

Not included: cron/ETL routes, refresh loops, other routes, Monday re-checks.

## Results (TJ approved: "run SMOKE-PLAN-2.md… Stop at the first failure")
- **S1 PASS**, 2026-10-26T21:07:06Z (Claude, curl, no credentials, 1 request): `HTTP/2 401`, `cache-control: private, no-store, max-age=0`, `vary: Authorization`, `x-robots-tag: noindex, nofollow`, `x-vercel-cache: MISS`, body `{"error":"Sign in to use the share studio."}`.
- **S2 PASS** (TJ, one signed-in load): "All four cards rendered with the new tiles, neon logos, Tomorrow labels, sparklines and a current source line; no PP3."
- **L1 INCONCLUSIVE**, read at 21:07:49Z (Claude, one Vercel runtime-log read: deployment `dpl_BShSQSBk…`, since 20:55Z, query `social-share`, limit 100). It returned exactly 1 entry: S1's `/api/v1/social-share/tuesday-trends` 401 at 21:07:06. TJ's S2 page load and API call were not present yet, most likely ingestion lag. It cannot confirm that the v2 sparkline reads ran without a `[social-share]` warning or a 57014 timeout. TJ saw sparklines on every card, which suggests S1/M2 succeeded. The read budget is used; any further read needs TJ's approval.
- **L1 second read** at 21:13:15Z (TJ approved one more identical read): still exactly 1 entry, S1's 401 at 21:07:06. TJ's S2 page and API requests do not appear in this deployment's `social-share` runtime logs.
  - Not explained by evidence in hand. Ingestion lag after about 6 minutes is unlikely. TJ's cards showed the #389-only design (light-card tiles, Tomorrow labels, sparklines), so the request was served by 74a6e7d04 code.
  - Absent from these logs either way: any `[social-share]` error or warning. Also not proven: that the S1/M2 reads logged nothing, because S2's entries are missing entirely.
  - **Status:** functional pass (S1 + S2); log confirmation not obtained. No further reads made.
