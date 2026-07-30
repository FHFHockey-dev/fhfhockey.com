# Hidden Product Surface Ownership Matrix

## Scope

This matrix reconciles B-DEAD 4.1 and 4.4 without authorizing a route redirect, deletion, product promotion, or access-policy change. A page under `web/pages` remains a runtime entrypoint even when it has no inbound application link.

## Current dispositions

| Route                                            | Current evidence                                                                                                                           | Owner/replacement                                                                          | Disposition and remaining gate                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `/buyLowSellHigh`                                | Hidden client-side legacy page; exact application scans find no inbound route link.                                                        | Sustainability/Underlying Stats and the buy-low/sell-high sections on `/underlying-stats`. | Retain unchanged until B-DEAD 3.3/4.2 approves redirect or removal and replacement parity.                                           |
| `/goalies`                                       | `getServerSideProps` redirects to `/variance/goalies`; the variance route reuses the page component without re-exporting the redirect.     | Variance goalies is the canonical public route.                                            | Existing compatibility redirect is authoritative; no change required.                                                                |
| `/trueGoalieValue`                               | Hidden legacy goalie implementation with no inbound application link; lifecycle/error/stale-request regressions pass.                      | Variance goalies and Underlying Stats goalie surfaces.                                     | Retained quarantine candidate; redirect/removal remains under B-DEAD 3.3/4.2.                                                        |
| `/teamStats` and `/teamStats/[teamAbbreviation]` | The root links only to its own legacy detail route; no other application route links to the family.                                        | `/stats/team/[teamAbbreviation]` and `/underlying-stats/teamStats`.                        | Replacement choice and redirect/removal remain under B-DEAD 3.3/4.2.                                                                 |
| `/projections`                                   | Rich but hidden legacy comparison page; exact application scans find no inbound page link.                                                 | FORGE Quick Read, Command Center, Start Chart, and supported projection APIs.              | Product/redirect/removal decision remains under B-DEAD 3.3/4.2 and the owning FORGE decision gates.                                  |
| `/FORGE`                                         | Supported Quick Read page with current inbound links from Command Center, Forge navigation, player/team details, and Start Chart.          | Canonical FORGE ecosystem.                                                                 | Active supported route; exclude from dead-code deletion.                                                                             |
| `/skoCharts`                                     | Explicit `Legacy` quarantine notice, `noindex,nofollow`, no supported inbound link, and outbound links only to FORGE Dashboard and Trends. | B-SKO historical-only ownership; Trends/FORGE remain supported.                            | Retain as the owner-authorized historical quarantine unless a new explicit removal checkpoint is approved.                           |
| `/trendsDebug`                                   | Actively owned rolling-metrics validation console with a current server validation payload, runbooks/artifacts, and direct tests.          | Rolling-player-metrics pass-two audit/remediation.                                         | Not dead. B-DEAD 4.3 retains any separate access/retirement decision.                                                                |
| `/twitterEmbeds`                                 | Bounded SSR reads from current CCC/GDL source tables, public-card sanitization, first-arrival selection, and direct tests.                 | Lines/GDL ingestion and the current news/line-source display contract.                     | Hidden supported read-only surface; exclude from import-graph deletion. Any visibility/access change belongs to the Lines/GDL owner. |

## Ownership boundary

- Existing exact dispositions are preserved: `/goalies` redirects, `/skoCharts` is historical quarantine, and `/FORGE`, `/trendsDebug`, and `/twitterEmbeds` have current owners.
- The five unresolved legacy families remain unchanged and explicitly approval-gated: `/buyLowSellHigh`, `/trueGoalieValue`, `/teamStats*`, `/projections`, and the separately classified stub/development routes.
- No component or utility becomes deletable merely because its page has no inbound link. B-DEAD 5.2–5.4 retain complete consumer and post-change verification.
- No runtime file, navigation item, sitemap, rewrite, access policy, deployment, or external system changes in this reconciliation.

## Verification

- Exact route/link scans distinguish current inbound FORGE ownership from zero-inbound legacy families.
- Source inspection verifies the `/goalies` redirect and `/skoCharts` quarantine metadata.
- The current FORGE, Trends Debug, Twitter Embeds, and trueGoalieValue suites pass 4 files/28 tests.
