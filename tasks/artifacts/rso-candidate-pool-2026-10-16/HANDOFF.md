# Known candidate pool and discovery order

## Actual observation and corrected conclusion

TJ supplied the three accepted observability lines at2026-10-16T01:27:51Z:31logical pages attempted/returned/accepted,775accepted unique rows,0repeats,8017ms, stopped at the8second between-page bound.652unique catalog matches,123unmatched Yahoo rows,0rostered exclusions,652candidate matches. The provider catalog has849non-rostered candidates:652bothknown,0eligibility-only,0availability-only,197neitherknown.

The earlier197warning describes an unknown remainder, not failure of the entire pool.123unmatched Yahoo rows are not197unseen local candidates. No names/IDs were guessed, no123rows appended to the catalog, and no unknowns hidden. Actual counts establish healthy per-player ingestion/merge for a large known pool; they do not qualify the whole selected-week schedule or acquisition rules.

## Demonstrated display issue and smallest fix

Before this increment, unevaluated discovery cards were ordered by upcoming team games or name without eligibility/availability priority. In the652/197fixture, unknown players with alphabetically earlier names and more team games occupied the initial visible cards. The red regression failed because positive coverage was not displayed, and its retained DOM shows the unknown Alpha Unverified card first. Code inspection of the before comparator confirms that ordering. No admission-engine defect was reproduced.

Only CandidateBrowser.tsx changes runtime behavior:

- Always show matching pool size, number with known usable eligibility+availability, and number needing one/both checked.
- In existing Find & filter disclosure, show filtered/current-pool counts, four mutually exclusive known/partial/unknown buckets, separate legal-plan prerequisites and the actual bounded search selection.
- Within unranked discovery only, put both-known players first, then retain team-game/name ordering within each input group. Apply the same rule to By Team group order. Preserve evaluated net points/AGP order ahead of discovery cards, search, filters, Show more, unknown diagnostics and display count.
- Loading text accurately describes bounded search instead of implying every eligible player gets evaluated.

Eligibility exactly mirrors verified flag+normalizer validity+class check. Explicit manager_available is known for manual input alongside free_agent/waivers. A known waiver state does not establish clearance. Known player facts do not assert schedule completeness, legal acquisition, qualified forecasts or a retained plan.

## Engine and search proof; unchanged bounds

candidatePlanMetrics.ts is unchanged. It evaluates player gates (owned/excluded, verified/class-valid eligibility, explicit acquirable availability and a scheduled team game in range), sorts by stable canonical player ID, then selects at most40. Unknown candidates cannot consume these40slots. At most160total evaluations and12charged proposals per selected candidate remain; full-roster add-only skips are unchanged. Eligible here means passing these player gates, not verified timing/budget or a legal plan.

Two new real-engine fixtures use652bothknown+197neither, with synthetic scheduled team games and no exclusions:40known selected,612known not selected,197unknown filtered. Unknown timing yields40no_proposals states. Separately reviewed synthetic rules yield40evaluated states with legal retained options, within160evaluations. Both fixtures preserve snapshot and empty intent. This proves the path under explicit fixture assumptions; actual eligible count may be below652 due to other player gates.

The existing hook sends the snapshot to the worker independently of browser filters and Show5/10/20. Search/team/position/expansion are display-only. A new real hook→structuredClone worker stand-in→solver→UI fixture passes851players (2owned+849candidates) without storage/network actions. It shows652known/197unknown and40of652selected; searching Known651 changes display to1known while preserving the same worker instance, packet and search selection. Native browser Worker packaging remains outside this local test.

## Verification and frozen paths

Exact4path candidate.sha256 and intake-relative increment.patch accompany this handoff.10inputs pinned before;6runtime/dependency inputs remain unchanged, including engine, hook, card, main UI, accepted provider observability and eligibility normalizer. All preexisting dirty changes preserved. No source writes outside these4paths and this artifact folder, except a separate status-only note in the accepted observability folder.

- Final full nearest presentation20tests + integration3tests:23passed, justified by changed comparator/summary and display behavior.
- New engine2cases passed in initial red run,34existing engine cases skipped. Engine source never changed; successful engine checks were not rerun.
- Scoped4path ESLint exit0/empty log; diff whitespace check passed. No whole compiler/build.
- Initial red presentation log, focused presentation green and new integration green retained. Fixture counts are derived from actual aggregate metadata; identities, names, schedules/rules are synthetic.
- Actual provider/account/DB/network execution and writes:zero. No extra live refresh or owner browser/storage action.

## Reviewer focus

Check preservation of evaluated sort and all unknown discovery access; bucket conservation/filter scope; applicability of manual availability/class gates; unchanged engine/worker bounds; truthful separation of candidate selection, proposal evaluation, legal plans, schedule and forecast gates. Shared source and main UI remain frozen. Do not rerun accepted suites without a new finding.

## What TJ should see after inclusion

Without filters: **849 matching candidates ·652with known eligibility and availability ·197with inputs to verify.** Known inputs lead unranked discovery; unknowns remain available through search/expansion. Find & filter shows the four buckets and actual selected/eligible search counts. The actual eligible count is not assumed to be652. Missing schedule/rules can still leave compared metrics unavailable or prevent proposals.

## Writing review

Used better-writing skill for positive coverage before partial-input warnings and distinct facts/search/legal-plan terms. Source reviewed; no live browser check. Prior HIGH ambiguity (197warning could read as the entire pool) addressed by the visible denominator and known count. Discovery-order explanation now names input grouping. Approve for inspected copy; source acceptance remains the independent reviewer's decision.
