# Partial Yahoo discovery diagnosis

## Frozen local outcome

No runtime source change. Two nearest test files add nine synthetic cases; all nine pass on the existing adapter/UI. This does not establish the cause or acceptance of TJ's actual session.

- Eight adapter→real candidate engine cases cover a full first page followed by the 8-second stop, later failure, stale page, wrong-league page, repeated player, missing mapping, ambiguous mapping, and foreign Yahoo game key. Valid mapped first-page rows keep individual eligibility/availability, with availability completeness still partial. A repeated identity loses availability only for that identity; another first-page player stays known. Unseen/unmapped/ambiguous/foreign-game players stay unknown. Mapping fixture deliberately uses string NHL IDs and full Yahoo keys.
- One main component test merges a partial provider snapshot over public catalogue rows. The known candidate keeps verified positions/free-agent availability in both the evaluated snapshot and displayed card. Only the unseen candidate is counted unknown. Partial capabilities do not clear every candidate.
- Every adapter test blocks real fetch. Main component uses mocked auth, provider/data/account endpoints and isolated jsdom storage. Exactly one mocked provider request, no account PUT. External/provider/database requests performed: zero.

## Actual-session evidence supplied by Scout

Scout reports personally inspecting TJ's screenshot (not independently opened here): source Yahoo inputs / Provider snapshot, Oct12–18,19roster players, Week3:1 acquisition used, remaining unknown, partial schedule, many question markers. TJ's transcript reports 197 candidates unknown and the availability time-budget/end-of-list notices. A connected snapshot is now established; no further source-label question is needed.

The transcript alone does not identify how many successful pages/rows were fetched or how many map uniquely into the current catalogue. These are separate from universe completeness. The new tests rule out a general partial-completeness veto in the current adapter and UI. They do not prove every current row has correct identity/context/freshness or that the exact tested source was loaded in TJ's tab.

## Code trace and identity contract

`rosterPlanning.ts`: every validated page is accumulated before the next budget check. Later partial/failure leaves this map intact. Pages require transport Date within120s of snapshot time, Age absent or0..60, exact authorized league key, complete player collection and <=25 rows. Every candidate needs current Yahoo game prefix, a unique Yahoo→NHL and NHL→Yahoo mapping, and a matching canonical NHL ID in PlanningData. League/own roster IDs cannot become available. Ownership must explicitly say freeagents/waivers; eligibility must be explicitly supplied. Returned player facts are joined into the existing canonical object, never by name. Whole snapshot admission is scoped to authorized user/account/team/league and dates/timezone in the client. `capabilities.availability=false` controls partial feedback/backoff, not per-player clearing or solver filtering.

`RosterScheduleOptimizer.tsx`: current connected player rows override public/manual rows by canonical player ID. Supplementing manager rules preserves provider players. CandidateBrowser and candidatePlanMetrics inspect each player's facts, not global availability completeness. Browser-only retained workspace deliberately strips provider availability on reload; the actual screenshot instead shows a provider snapshot.

The verified mapping SQL view joins Yahoo player_key to verified external identity, with explicit context/season and uniqueness requirements. Missing canonical/external mapping coverage can leave fetched rows unmatched without being a pagination-loss bug. This is a hypothesis for the actual session, not a measured diagnosis.

## Time budget and fan-out

The source does six Yahoo resource calls before availability pagination: settings, own roster, scoreboard, league rosters, league, team. Settings first; the other five run beside shared planning-data load. Required settings/roster retry once only for timeout. Availability starts its own clock after shared data and identity mapping load; these earlier reads do not consume its8-second pagination allowance.

Available pages are sequential,25players/request, offsets0..2000 inclusive: <=81pages/2025rows, normally6+P Yahoo resource calls. Each fetchYahooJson independently calls getYahooAccessToken, whose ordinary path reads get_connected_account_tokens_secure once; all of that authentication latency and response JSON time consumes the pagination window. Mapping uses sequential1000-row DB pages, outside that window. A401 can add one forced token refresh and HTTP retry; expired-token refresh has its existing lease/write path. We executed none of these real operations.

The8-second limit is a check between pages, not a hard wall-clock cancellation. The HTTP fetch has a10-second signal; token RPC latency precedes it. A page started just before8seconds can finish later. Raising limits or parallelizing pages would increase calls/load and is not justified by the current evidence. No timeout, fan-out, credentials, token reuse or scheduler changes were made.

## Exact meanings of question marks

| Location | Current code meaning |
| --- | --- |
| Whole player/date schedule cell | Team missing, or no matching team/date game while selected-range schedule completeness is not complete. It is not proof of an off day or an unknown opponent on a known game. |
| `vs?` / `@?` in a known game | Source row has no opponent abbreviation; planning normalizer uses `?`. |
| Superscript `?` beside goalie opponent | Game exists; no qualified confirmed/projected goalie starter evidence. |
| Row status `?` | Current assignment status contains unverified/pending/unknown/unavailable; exact status is in its aria-label/title. |
| GP/AGP/DUST `?` | Full-range contribution total unknown, with no positive known subtotal. Positive partial evidence is `N+`; this is separate from candidate availability. |
| Points dash | Projected active points unavailable, not zero. |

Day header NHL counts are known distinct game IDs and do not establish complete per-team/off-day coverage. Global partial schedule makes absent player/date entries unknown. Oct15-only refreshed22sides do not qualify Oct12–18 or a Yahoo period. refreshForecastInputs intentionally retains provider snapshot schedule/availability; it only replaces shared forecast inputs. A reader reload alone does not refresh upstream schedule or qualify a provider snapshot.

## Remaining bounded acceptance

1. Inspect already-retained metadata from the successful partial provider result, if available through an authorized supported surface. Need counts only: pages requested/successfully validated, fetched unique rows, current-game rows, uniquely mapped NHL rows present in catalogue, explicit eligibility rows, explicit ownership rows, repeated identities, exact selected context and original transport clocks. No names, credentials or complete payload required for this triage.
2. If those counters cannot be derived from existing retained evidence, prepare a narrow metadata-only diagnostic increment before any separately authorized provider execution. Do not blindly reload or lift limits. No new live call is authorized by this test result.
3. Resolve actual mapping/scope/freshness failures if demonstrated; preserve independently known per-player facts and unknown universe completeness.
4. Separately establish selected-week schedule freshness, manager rules/remaining allowance/reset windows, qualified forecast availability and real consumer readback. Neither9fixture passes nor Oct15 refresh clears those gates.

No application source edit, full compiler, build, browser attachment, account mutation, provider request, DB write, deployment or FORGE model/source change. Existing accepted UI/rules work remains frozen. Independent review remains pending against candidate.sha256 and tests.patch: frozen-review handoff and status read both returned Transport closed. An earlier ownership notice succeeded. No new reviewer was started without verified runtime settings.
