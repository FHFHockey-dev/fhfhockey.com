# Yahoo discovery observability: frozen local increment

## Scope

One runtime file, rosterPlanning.ts, and its two nearest test files. Existing Data health renders capabilities.limitations verbatim, so RosterScheduleOptimizer.tsx, shared DTO/types, provider client/token code and solver stay unchanged. Prior partial-discovery two-file test candidate is retained in this folder's before copies for historical independent review. New increment.patch is relative to that candidate, not HEAD.

Three count-only capability summary lines are assembled at the existing pagination/merge boundary. Counter state exists only within the request. Summary strings are returned in existing capabilities.limitations; they are excluded from snapshot.evidence and the saved snapshot. No new persistence/telemetry destination, console output or side effect.

## Counter definitions and conservation

- Pages attempted: logical available-page client calls (includes a call that fails before a response); returned: successfully returned JSON results; accepted: exact league/fresh transport, complete <=25-row collection. Physical HTTP401 retries/token reads are existing internal behavior, not extra attempts counted here.
- Accepted rows: rows from accepted pages only, never unverified scope/freshness/collection pages. Unique is distinct Yahoo player keys in those rows; repeats are subsequent occurrences. accepted rows = unique + repeats. Repeated ownership remains withheld exactly as before.
- Catalog matches: unique accepted keys satisfying existing current-game, bidirectional identity uniqueness and canonical NHL catalog lookup. unique = matches + unmatched. matched = rostered/excluded + candidate matches. Unmatched combines missing/ambiguous/wrong-game mapping and absent canonical catalog rows; it does not infer a specific cause.
- Provider catalog before search excludes all own/known league roster IDs. It is broader than the UI's197currently filtered matches and excludes manager-added rows. The mutually exclusive buckets both known / eligibility only / availability only / neither known sum to that candidate denominator. Eligibility uses exactly normalizeEligibility validity/class plus eligibilityVerified; availability means explicit free_agent or waivers, and does not establish waiver clearance or legal acquisition.
- Elapsed measures the pagination loop, including existing auth reads and response parsing, before candidate merge. 8000ms remains a between-page check, not a hard request deadline. Stops distinguish end of list/repeated identities, page bound, time budget, backoff/access restriction, request failure, freshness failure, scope failure and invalid collection. Bounds, sequential calls, auth, retries, original player assignment logic and source clocks remain unchanged.

## Verification

- Full nearest adapter file:50tests passed, including11partial/identity/count cases and39existing cases. Changed runtime pagination/merge boundary justifies this rerun.
- Main component new partial-provider display test:1passed,199existing skipped. Confirms the three rows display inside the existing closed Data health disclosure; opening it makes no request, preserves one mocked provider read and performs no account PUT.
- Scoped ESLint three changed files:exit0,empty log.
- Initial focused combined run had11adapter assertions fail because the new assertion expected4planning-wrapper calls before pages; actual routing correctly has3planning +2board +1draft calls. Corrected only the test expectation to3+pages. That original log is retained; its UI test passed and was not unnecessarily repeated. Final full adapter run passed50. No runtime failure was represented as a fixed defect.
- No full compiler/build/browser/live provider/account/DB execution. Actual requests/writes:zero. Fixture results do not diagnose TJ's197candidates.

## Exactly what TJ should read when available

After the accepted increment is available and an already-authorized normal provider result has completed, open the existing **Data health** disclosure and read/copy just these three rows:

1. **Yahoo availability read:** pages attempted/returned/accepted; accepted rows/unique/repeats; elapsed/budget; stop reason.
2. **Yahoo availability matches:** unique catalog matches/unmatched; rostered/excluded/candidate matches.
3. **Yahoo provider catalog before search:** total candidates; both known/eligibility only/availability only/neither known; discovery complete/partial.

Opening Data health performs no fetch. Old responses cannot retroactively supply these counts. Do not trigger a provider refresh, reload, console script or storage export just for this observation without the appropriate scope. No names, player IDs, credentials or raw provider bodies are needed.

## Remaining gates

Actual counts have not arrived; no claim explains TJ's197unknown players. Partial universe completeness alone still does not revoke individually known facts. Selected-week schedule freshness, actual manager acquisition rules/remaining allowance/reset windows and genuine forecast consumer acceptance remain separate. October15-only refresh does not qualify October12–18. Frozen candidate requires independent engineering review/inclusion; no deployment or new provider execution follows from source acceptance.
