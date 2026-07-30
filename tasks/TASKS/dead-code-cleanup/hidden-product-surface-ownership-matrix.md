# Hidden Product Surface Ownership Matrix

## Scope

This matrix reconciles B-DEAD 4.1–4.4 without authorizing route deletion or product promotion. A page under `web/pages` remains a runtime entrypoint even when it has no inbound application link.

## Current dispositions

| Route                                            | Current evidence                                                                                                                           | Owner/replacement                                                                          | Disposition and remaining gate                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `/buyLowSellHigh`                                | Hidden client-side legacy page; exact application scans find no inbound route link.                                                        | Sustainability/Underlying Stats and the buy-low/sell-high sections on `/underlying-stats`. | Retained for bookmarks with a visible noindex quarantine notice and canonical replacement link; redirect/removal stays under 3.3.    |
| `/goalies`                                       | `getServerSideProps` redirects to `/variance/goalies`; the variance route reuses the page component without re-exporting the redirect.     | Variance goalies is the canonical public route.                                            | Existing compatibility redirect is authoritative; no change required.                                                                |
| `/trueGoalieValue`                               | Hidden legacy goalie implementation with no inbound application link; lifecycle/error/stale-request regressions pass.                      | Variance goalies and Underlying Stats goalie surfaces.                                     | Retained for bookmarks with a visible noindex quarantine notice linking to `/variance/goalies`; redirect/removal stays under 3.3.     |
| `/teamStats` and `/teamStats/[teamAbbreviation]` | The root links only to its own legacy detail route; no other application route links to the family.                                        | `/stats/team/[teamAbbreviation]` and `/underlying-stats/teamStats`.                        | Retained for bookmarks with a visible noindex quarantine notice linking to Underlying Team Stats; redirect/removal stays under 3.3.   |
| `/statsPlaceholder`                             | Hidden legacy team catalogue and SoS implementation with no current product-navigation ownership.                                        | `/underlying-stats`.                                                                       | Owner-approved bookmark-compatible retention with the shared visible noindex quarantine notice and canonical replacement link.       |
| `/projections`                                   | Rich but hidden legacy comparison page; exact application scans find no inbound page link.                                                 | FORGE Quick Read, Command Center, Start Chart, and supported projection APIs.              | Retained for bookmarks with a visible noindex quarantine notice linking to FORGE; redirect/removal stays under 3.3/FORGE owner gates. |
| `/FORGE`                                         | Supported Quick Read page with current inbound links from Command Center, Forge navigation, player/team details, and Start Chart.          | Canonical FORGE ecosystem.                                                                 | Active supported route; exclude from dead-code deletion.                                                                             |
| `/skoCharts`                                     | Explicit `Legacy` quarantine notice, `noindex,nofollow`, no supported inbound link, and outbound links only to FORGE Dashboard and Trends. | B-SKO historical-only ownership; Trends/FORGE remain supported.                            | Retain as the owner-authorized historical quarantine unless a new explicit removal checkpoint is approved.                           |
| `/trendsDebug`                                   | Actively owned rolling-metrics validation console with a current server validation payload, runbooks/artifacts, and direct tests.          | Rolling-player-metrics pass-two audit/remediation.                                         | Retained admin tool: the page waits for resolved admin identity and the API uses fail-closed `adminOnly` authorization.               |
| `/twitterEmbeds`                                 | Bounded SSR reads from current CCC/GDL source tables, public-card sanitization, first-arrival selection, and direct tests.                 | Lines/GDL ingestion and the current news/line-source display contract.                     | Hidden supported read-only surface; exclude from import-graph deletion. Any visibility/access change belongs to the Lines/GDL owner. |

## Ownership boundary

- Existing exact dispositions are preserved: `/goalies` redirects, `/skoCharts` is historical quarantine, and `/FORGE`, `/trendsDebug`, and `/twitterEmbeds` have current owners.
- Six legacy routes across five families retain bookmark-compatible behavior but are no longer ambiguous: their shared visible quarantine notice, noindex metadata, and exact canonical links are explicit. Redirect/removal remains separately approval-gated.
- No component or utility becomes deletable merely because its page has no inbound link. B-DEAD 5.2–5.4 retain complete consumer and post-change verification.
- `/forge/dashboard` is separately owner-approved as the Command Center compatibility redirect; no route was removed and no deployment or external system changed in this local cohort.

## Verification

- Exact route/link scans distinguish current inbound FORGE ownership from zero-inbound legacy families.
- Source inspection verifies the `/goalies` redirect and `/skoCharts` quarantine metadata.
- The ownership cohort passed 4 files/28 tests. The implementation cohort adds 22/22 focused notice, page-access, and API-access tests plus full TypeScript and scoped zero-error lint with one pre-existing image warning.
