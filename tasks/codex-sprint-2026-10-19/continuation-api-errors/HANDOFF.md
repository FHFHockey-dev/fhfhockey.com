# R-APIERR handoff — bounded NEW-028 item 5 reconciliation

Owner `01a1566f-c3e3-7fc0-9dd4-2f71a4a62233`, retained runtime gpt-6.1-sol/high; Chef xhigh. Canonical checkout octoberBranch. Exact candidate ownership sent before edits; Chef expressly approved eight routes, five existing test files, plus the single reports.ts error-factory conversion. All were clean before this lane. Ownership is now released for Chef review; changes uncommitted, no process running. Sprint remains active.

## Implemented residuals

1. **Player-trend POST rebuild:** its GET boundary was already fixed, but the authorized POST failure catch still returned raw dependency text. It now retains HTTP 500 and the existing fixed fallback message `Failed to rebuild player trends`, with full error retained in server diagnostics. Authorization, repair bounds and success results are unchanged. This is a server-to-server authorized failure path, not a claim that anonymous callers could reach that rebuild error.
2. **Seven Draft Pro saved-draft/report/scenario/private-read routes:** replaced duck-typed `statusCode` trust with the already-existing `DraftProRequestError` class. Generic Storage/RPC/dependency errors carrying plausible 403/503 status/message/code no longer bypass the route's existing fixed fallback. Trusted capability denial, Zod validation, method/auth/ownership results, private transport bytes and save conflicts retain their contracts. The private-import reader retains its existing generic 404 unavailable fallback, while the six other routes retain their fixed 500 fallback.
3. **Preserved report validation:** with Chef's separate helper authorization, converted only `reports.ts`'s local `reportError` factory to `DraftProRequestError`, retaining status/message/code. The factory is local to `assertReportSnapshotMatch`; its production consumer is the reports API, and the existing report-dashboard adapter test also imports the assertion. That consumer's three tests passed; calculation/snapshot algorithms unchanged.
4. **Scenario validation provenance:** moved recognition of the two exact comparison validation errors into a catch immediately around the pure comparison function, converting them to the trusted class. Removed the outer broad `Choose two`/`Candidates must` prefix-based bypass, so unrelated dependency errors cannot impersonate local validation. Existing distinct-candidate validation remains HTTP 400 with the same code/message.

## Read-only reconciliation of the named families

- **Contextual rankings:** eight dependency-catching handlers (comparison, matrix, trending, goalies, teams, splits, deployment-tiers, snapshot) already call `sendContextualRankingsError`; its unknown/dependency branch logs internally and returns `CONTEXTUAL_RANKINGS_UNAVAILABLE`. metadata/available-filters are static readers and war has no raw public error catch. No duplicate repair or claim of rerun runtime coverage there.
- **Named trends:** team-power, goalie-power, team-sos, player-trends GET already return fixed unavailable codes; bounded inspection also confirmed skater-power and team-ctpi fixed failure responses. Raw internal throw messages are consumed by those fixed catches. Only the player-trends POST residual was changed.
- **Runs:** `[runId].ts` and latest already have fixed `FORGE_RUN_DETAIL_UNAVAILABLE` / `LATEST_FORGE_RUN_UNAVAILABLE` responses. These FORGE-adjacent files were read only, with no new changes or tests here.
- **ESPN/Fantrax account handlers:** existing generic error fallbacks and manual-import 500 boundaries are fixed. Their typed integration-error transport retains intentional validation/reconnect/rate statuses and codes; relevant client provider failures use application-authored fixed text rather than raw upstream bodies. No new ESPN/Fantrax change or blanket integration requalification.
- **Other Draft Pro branches:** private upload/chunk/stage already use the trusted request class and fixed dependency responses; checkout/verification/account-index have fixed failures; refund requests have a fixed generic 500 and caller-specific 404/422 messages. These were not changed or blanket-tested.
- **Explicit exclusions:** all Yahoo routes/writers; Patreon OAuth/connect/callback and adjacent Patreon ownership; fenced RSO/FORGE/projection/in-season paths; sustainability read/entitySurface/trendsSandbox (other worker); `_app.tsx` (Chef review); any newly dirty other-owner file. No change within those exclusions. NEW-028 item 5 is not declared globally complete from this lane.

This was a targeted named-family/symbol reconciliation, not a repeat 357-route audit. No shared API response helper was modified. The separately authorized reportError factory was the only helper change.

## Checks actually run

| Check | Result |
| --- | --- |
| `cd web && npm test -- __tests__/pages/api/v1/trends/player-trends.test.ts` | PASS, exit 0; 12 tests, including admitted POST dependency redaction/server diagnostic retention and existing auth/bounds/success/read contracts. |
| `cd web && npm test -- lib/draft-pro/api-tests/drafts-index.test.ts lib/draft-pro/api-tests/reports.test.ts lib/draft-pro/api-tests/scenarios.test.ts lib/draft-pro/api-tests/private-import-route.test.ts lib/draft-pro/reportDashboardAdapter.test.ts` | PASS, exit 0; 38 tests across five files: drafts 8, reports 10, scenarios 12, private reader 5, adapter 3. Includes adversarial backend status/message/code across all seven changed Draft Pro routes, trusted-denial fixtures, report mismatch status/code/message, pure scenario validation and provider-prefix impersonation. |
| `git diff --check -- <all 14 exact owned files below>` | PASS, exit 0. |
| Scoped source diff review | Eight catches, existing class imports, scenario pure-function validation isolation and narrow reportError conversion only; unrelated handler business operations preserved. |
| Global tsc/lint/build/full suite/browser/hosted/provider checks | NOT RUN; Chef owns global checks, remote/builds prohibited. |

**50 tests passed total**, no failed check or retry. Tests use existing synthetic service/auth/analysis mocks and fixed fake season values; no real database/provider execution, secret-file read, network request, package change, Git mutation or deployment. No new test files were created.

## Exact 14 changed files and SHA-256

| File | SHA-256 |
| --- | --- |
| `web/pages/api/v1/trends/player-trends.ts` | `2c8fe56d566407437460d734bcf6a6fc0435b6321ccceee6ff7ed51f40820d51` |
| `web/pages/api/v1/account/draft-pro/drafts/index.ts` | `feaadc96f5da857976f59b7d0b1fad404c796d762f809a8f81b56969a8bba531` |
| `web/pages/api/v1/account/draft-pro/drafts/[id].ts` | `92491db5907133840c47ef220a49d116f03002e0ad5ff565ae08c9d63af7d837` |
| `web/pages/api/v1/account/draft-pro/drafts/[id]/imports/[importId].ts` | `abf6a7bd0185199b24a167f868290fe61afae55fd245ffea41f5d63179311b56` |
| `web/pages/api/v1/account/draft-pro/reports/index.ts` | `4c4dad34ccf57a446da953bf58a62671fb7c8a3734569f072ed16af7d826cfc8` |
| `web/pages/api/v1/account/draft-pro/reports/[id].ts` | `1eac217e246c63693a46eb7cae7de081723d4ffbbf07a697cebb6561d3be0a29` |
| `web/pages/api/v1/account/draft-pro/scenarios/index.ts` | `d17dbd9041b38642942cc0eadb6dab6244e831185360255c11c64011d6dceb1c` |
| `web/pages/api/v1/account/draft-pro/scenarios/[id].ts` | `3c1176aea2316e2518397a1624b6fe6a5ae7d9760fa139dbbe641242f8b34d2a` |
| `web/lib/draft-pro/reports.ts` | `ecfc709cebeaa151e3965d43b3bba987fe0250fce6dd97f9d284325de91fcc0d` |
| `web/__tests__/pages/api/v1/trends/player-trends.test.ts` | `706036c82f5d97d886e5b78fca310b26480a97db6aed3c14bcedb3fb36417bc7` |
| `web/lib/draft-pro/api-tests/drafts-index.test.ts` | `ce207a788ac6117ddd5e9b732acb756d32708c92756f9f5ba7b8404685030238` |
| `web/lib/draft-pro/api-tests/reports.test.ts` | `7139c80e550120a527bb60aeedf83c46791b8f5dbbf42194670a28bb623c9fe6` |
| `web/lib/draft-pro/api-tests/scenarios.test.ts` | `0dd82f15a3940a6b0b003d05cfc7f226117d080f71a8e1d971efc76f3025fba6` |
| `web/lib/draft-pro/api-tests/private-import-route.test.ts` | `875d3b0a1478b9f4bb85a61c61e5755056af656f6ccf05c92836dcbcc41efdb5` |

## Exact lane files created

- `tasks/codex-sprint-2026-10-19/continuation-api-errors/OWNERSHIP.md`
- `tasks/codex-sprint-2026-10-19/continuation-api-errors/HANDOFF.md`

Preexisting R-APIERR-TICKET.md read only. No other files created or changed by this lane.

## Limits and next real unblocked piece

Local mocked evidence proves these error-boundary changes while preserving exercised contracts; it does not establish deployed behavior or qualification of excluded owners. Source-confirmed already-fixed routes were not rerun solely to duplicate evidence. No new release, schema, integration or provider gate is cleared.

Chef can independently review/rerun the focused receipt, then reconcile NEW-028 item 5's stale named claims against existing S-02/S-03 receipts and the explicit excluded-owner evidence. Remaining excluded-owner verification should remain separate rather than reopening fixed handlers or expanding this lane's source ownership.
