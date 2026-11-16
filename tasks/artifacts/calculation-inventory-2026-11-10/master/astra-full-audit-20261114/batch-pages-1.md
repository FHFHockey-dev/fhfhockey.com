# FORGE landing and legacy statistics routes

Eight scope files, 2,162 lines, fully read at `89da739cb45d7d572ed59bfa0b209c79c5d99299`. Exact hashes, AST symbol inventory and read coverage are in the sibling manifest/TSV. `pages1-probe.cjs` executed five frozen modules inside a VM with finite synthetic data, a query double and transport that rejects before any request. All assertions passed. No application module imports, route invocation, provider request, database access, environment values, browser or supplied test suite ran.

## AFULL-TOIROUTE1-01 — P1: qualified observed PP share depends on an unrelated model row

- Location/claim: `web/pages/api/toi.ts:188–212`; decision152 requires observed share from the qualified stored team clock and player PPTOI, separately from modelled FORGE time.
- Evidence/scenario: game1 has a qualified team10 clock120 seconds and stored player PPTOI60. With no FORGE row, `buildToiSeries` returns observed time/share null and “No stored PP clock for this team-game yet.” Adding only `{game_id:1,team_id:10,toi_pp_seconds:null}` returns1 minute/50%, using exactly the same stored evidence.
- Cause: the route selects the team key exclusively from `forge_player_game_strength`; `getData` omits team-of-record. A missing/pruned/not-yet-built model row prevents the correct observed result and invents a missing-clock reason.
- Suggested fix: carry game-specific team identity from the player's actual game record into the observed clock lookup. Preserve independently nullable model time. Pin absent-model/present-clock and traded-player cases.
- Readers/tests: `/api/toi` → `TimeOnIceChart` on `/charts`. Existing route fixtures always supply the model team identity when asserting stored shares; they do not pin independence. No live incidence asserted.

## AFULL-TOIROUTE1-02 — P1: current position filters historical player games

- Location/claim: `web/pages/api/toi.ts:121–130,252–275`; the chart promises the selected player's TOI over a date interval.
- Evidence/scenario: the exact `getData` helper receives player1/current position C and two dated game rows, one C and one L. The query double enforces every emitted predicate. Only the C game returns; the L game's18 minutes disappears despite its matching player/date.
- Cause/fix: `.eq("position", position)` uses current player metadata to select historical facts. Remove that restriction from player-ID history, retain the explicit goalie admission guard, and test a changing-position history. Confirm actual stored position variants during any separately approved data read; this is source reachability, not a claim about a specific production player.
- Readers/tests: TOI chart and observed/model PP series. Existing fixed-position route mocks do not cover the change.

## AFULL-SUSROUTE1-01 — P1: historical sustainability windows are scoped to the player's current team

- Location/claim: `web/pages/api/SustainabilityStats/[playerId].ts:64–90,107–119`; the submitted season/date interval should describe that player's window across trades.
- Evidence/scenario: exact helper with current team TOR, requested2025-26/October1–10 emits both NST URLs with `team=TOR`. For a player who dressed only for BOS during that interval, a correctly team-filtered source cannot supply the requested player/window; a window spanning the trade admits only the current stint. The probe captures the exact URLs and then rejects transport, so no particular external response is asserted.
- Suggested fix: read the requested player identity across all teams for the requested interval, with explicit disjoint-stint aggregation and stable player-ID matching. Keep source counts and ratio components on the same population.
- Readers/tests: `useSustainabilityStats` → current-vs-career chart. Existing fixture pins a current-team URL; it does not exercise a traded-player window. Name-only identity matching is already acknowledged in source and remains a qualification risk.

## AFULL-SUSROUTE1-02 — P1: an unmapped team becomes a literal undefined query value

- Location/claim: same route `:70,90,182–215`; team identity must be resolved or explicitly unavailable before provider requests.
- Evidence/scenario: synthetic active player with `teamName="Utah Mammoth"` and a team ID causes both source URLs to contain `team=undefined`. The frozen dictionary has no Utah entry and also depends on exact full-name punctuation. This is a source-confirmed malformed request; the provider's response and actual current player record were not fetched.
- Suggested fix: use the shared canonical NST team adapter, validate the result, and avoid a current-team restriction for historical/player-wide windows as above. Pin supported aliases and explicit unmapped identity.
- Readers/tests: same chart; existing SustainabilityStats fixtures cover a mapped name only. No production call needed to reproduce URL construction.

## AFULL-CAREERROUTE1-01 — P2: season-team stints are counted as separate seasons

- Location/claim: `web/pages/api/CareerAverages/[playerId].ts:155–165,191–209,249–264,276`; count outputs are documented as per-season means, and `seasons` purports to count seasons.
- Evidence/scenario: one completed season has disjoint TOR10-goal and BOS20-goal rows. Exact `computeCareerAverages` returns goals15 and seasons2, instead of a30-goal season and seasons1. Controls retain correct pooled shooting10% and SOG/60=12.
- Suggested fix: group disjoint team stints by season before computing count means and season counts; qualify/remove totals before summing. Preserve matched numerator/denominator pooling for ratios.
- Readers/severity: API count/season fields; the active career comparison consumes ratios, for which this disjoint fixture is correct. No displayed count consumer or actual NST multi-stint layout was established, so P2. The source explicitly allows “season (or season-team)” input but does not reconcile these count fields. Legacy Teams has the same row-count mean pattern at240–243; it is likewise dormant and should share a defined season contract.
- Tests: CareerAverages fixture covers separate seasons, not multiple disjoint rows within one season. No new repository test or code fix was made.

## Existing finding retained

`AFULL-WTEST3-01` remains P2 for legacy Teams xS%=ixG/shots instead of ixG/iFF. The full route now confirms its other pooled definitions, strict unknown propagation, key-matched IPP and explicit legacy identity mismatch. Earlier exact expression probe already pins the counterexample; it was not rerun. No repository caller was established in the earlier bounded trace. This does not reopen accepted Averages/ThreeYearAverages fixes.

## Remaining symbol review

- `FORGE.tsx`845 lines: date parsing/shared ET policy, request ownership cleanup, five-request all-settled fanout, timeout display, independent unavailable panels, same-date warning, normalized/provisional projection handling, ownership25–75% candidate restriction, shared tonight ranking, conditional-if-plays points, L10 start-share explanation, limited top3 cards, trusted/fade scores and provenance. No new independent arithmetic finding. The five fetches are parallel and the timeout does not cancel transport; account for this fanout in the separately approved page budget. Calibration disclosures are displayed evidence, not proof of empirical qualification. Top-add candidates are the ownership movers subset, not the entire player pool. Source review cannot establish rendered/network correctness.
- `Averages`66 and `ThreeYearAverages`102 lines: shared counts/rates service, three-year/career scopes and versioned scale contract; sequential calls and response shaping. No duplicate numeric derivation remains. Lazy NST lifecycle wrappers mean GET safety must not be inferred from the route name.
- `CareerAverages`: matched season/team ratio components, only completed seasons, July season boundary, ixG/iFF, own valid denominators, unknown-time propagation, SOG/60 conversion and0–1 versus0–100 share distinctions hold for reviewed disjoint inputs. Total-row layout/duplicates remain unverified provider assumptions, not silently certified.
- `SustainabilityStats`: own ratio components, xS unblocked denominator and minutes-to-per60 conversion; nullable values preserved. Uses independently supplied percentage cells for displayed ratios and counts for intervals; source reconciliation remains an external-data requirement. Parallel NST calls stay under the already-reviewed shared client/lifecycle pacing contract; no provider execution here.
- `toi`: sorted date series, null clock/status distinctions, zero-player contribution only under qualified complete team set, above-clock refusal and separately labelled model values. Parsing duplicates the shared time parser and accepts seconds60–99; no malformed persisted time was established, so record as a hardening/test gap, not an additional confirmed live defect. No explicit game-type/finality predicate in the custom-date path; exposure depends on selected source rows. `getInterval` also serves percentile-rank and retains its existing season-default behavior.
- Yahoo pickup51 lines: method/auth/access/rate admission, no-store, typed error status and constant-only error logs. No numeric computation beyond status/rate gating. `loadYahooPickupContext` can refresh/sync; do not invoke this GET during a read-only page pass without inspecting/authorizing side effects. All delegated math/lifecycle findings remain in their previously audited modules.

Supplied tests were already source-reviewed in web-tests batches; none were executed by this batch. Frozen helper controls are synthetic evidence only. No fixes, live pages or Claude-owned changes were made.
