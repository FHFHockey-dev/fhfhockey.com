# R-HEALTH — local snapshot diagnostic acceptance

Status: implemented within approved scope; focused acceptance passes, ready for Chef review. Ownership released; no running process or blocker. Sol/medium runtime previously reconfirmed for this worker; Chef retains global verification.

Exact changed/created files:

- `web/lib/sustainability/health.ts`
- `web/lib/sustainability/health.test.ts`
- `tasks/codex-sprint-2026-10-19/continuation-review/R-HEALTH-HANDOFF.md`

Scoped initial diff was empty. No route/schema/config/model/writer/scheduler/master/register changes; no Git mutations. Existing generatedAt/tables fields and all-history count behavior remain intact.

## Actual local contract

Additive `snapshotDiagnostics` anchors to the latest observed score date already read by the health report. It never calls that date fresh/current. Without a date, counts/observations are unavailable and no added query runs.

With a date, six additional reads run sequentially:

1. Four exact HEAD score counts, filtered to that date and one of l3/l5/l10/l20.
2. One exact HEAD null-quintile count for that date and the four windows.
3. One distribution identity/window/population query for that date/four windows, exact count, deterministic config_revision/season_id/window_code order, limit5.

Maximum12totalrequests including the original6; at most5additional data rows, plus counts. No added history/player scans or per-player payload. Root identified a baseline date/window index, but no hosted plan, latency, execution-time cap or cost was measured. Exact counts may still scan selected-date rows; bounded query/payload scope is not a fixed database CPU bound.

Observed missing windows, unequal score counts, null quintiles and absent distribution windows are explicit issues. Multiple identities, duplicate windows, five-row sentinel or backend-capped/truncated observations never select an arbitrary version. Missing distribution windows are not inferred from ambiguous/truncated data; the field remains null. Exact count unavailable/negative/noninteger/nonfinite or any new query error rejects rather than becoming zero.

`expectedPopulation` is always null and `coverage` always unverified, with explicit lack of an authoritative eligible-player denominator/membership manifest. Equal250-row windows, zero null quintiles and four matching producer population counts still cannot establish membership, complete population, model lineage or freshness. Producer population_count is only a reported observation, never summed or used as an expected denominator. A partially generated but internally equal snapshot can remain undetected; no full coverage claim follows.

## Verification actually run

- From web: `npm test -- lib/sustainability/health.test.ts` — PASS exit0,17/17, first attempt. Only nonfatal Node punycode deprecation warning.
- `git diff --check -- web/lib/sustainability/health.ts web/lib/sustainability/health.test.ts` — PASS exit0.
- Final scoped diff inspected: only approved reader/test changes.
- Global TypeScript/lint, broader suites, browser, route invocation, Python, DB/provider/hosted requests NOT RUN; Chef owns global checks.

Existing aggregate/date and count-error cases retained. New mock cases exercise no-anchor6requests; equal counts staying unverified; missing/unequal/null observations; absent distributions; multiple identities/duplicate windows/sentinel/backend cap; invalid or unavailable counts; each new query-error stage; exact date predicates, HEAD/count selection, deterministic order/limit5 and maximum12requests. Real injected reader logic executes; no source-shape-only assertion substitutes for returned diagnostic output. No failed attempt or retry.

SHA-256 at handoff:

- `web/lib/sustainability/health.ts`: `b6d943c350939d67191a97778762f376d61e187b74ab47c310117ba68e6500a4`
- `web/lib/sustainability/health.test.ts`: `f779106353b3e54ba1587818c0c115110a2843993195e8eddd5789275e51674e`

Parent source C0096/NEW18 receives locally exercised health-observation progress only. Scheduled finalizer enablement, accepted operational gap, authoritative membership/model/freshness and natural/deployed receipts remain open. C0095/full scheduled population is not closed by this health report.

Next action: Chef independent reader/test review and focused rerun, then reserved global checks. Sprint remains active; no extra runtime change proposed.

## Chef independent integration —2026-10-19

Chef read the full source/mock diff and independently passed17/17. Review then found the old aggregate-count fallback also turned an unavailable exact count into zero. Chef reused the existing exact-count guard for aggregate counts, generalized its fixed error wording and added one nearby null-aggregate regression. Valid oldfields/counts and all query/payload bounds remain unchanged; unknown aggregate counts now fail closed. Revised focused suite PASS18/18. Source/master C0096 carry a matching partial-progress note and stayopen.

TypeScript8GB PASS after this final source/test change; final lint PASS0errors/68existing warnings. The worker hashes and all-history-count statement above describe the pre-integration handoff and are superseded for unknown aggregate counts by this receipt. Final source SHA-256:

- `web/lib/sustainability/health.ts`: `0dfb893d4c4052ef7dcdf6623061860ce9199f5665d6200e4c5262d30fbadcc2`
- `web/lib/sustainability/health.test.ts`: `1d8ce3809a7e5bf7e71f42bdb070da90b23129bf4d6e7656b29f28f94d89d005`

No route/schema/config/writer/model/scheduler or hosted/provider action changed. Maximum12queries/5additional rows are source/mock bounds, not measured database runtime or a full-population guarantee.
