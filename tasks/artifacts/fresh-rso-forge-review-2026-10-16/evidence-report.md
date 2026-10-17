# Independent product and engineering evidence report

Initial independent pass, 2026-10-16. Read alongside [executive-verdict.md](executive-verdict.md).

## Scope and evidence standard

The only supplied product target was useful, honestly labeled next-game/next-N FORGE forecasts; RSO using actual roster, positions and rules to optimize legal lineups and recommend complete drop/add swaps by net improvement; suggestions before plan selection; common forecast basis in Start Chart; Yahoo read-only.

I read current source and tests directly. I did not read previous handoffs, diagnosis reports, PRDs, proposed fixes, or private forecast/outcome artifacts, and did not contact other workers. Initial `git status` listed their filenames but none of those reports was opened. No application source was changed. All audit output, test configuration, synthetic fixtures, logs and runtime cache are confined to this report directory.

Observed branch: `octoberBranch`. Observed HEAD before and after inspection: `a8f58de6178e282acd3a71851c66f4a56b119f14`. The checkout already had extensive tracked/untracked work. This is an audit of observed working files, **not a review of that commit alone**. The initial manifest records 430 relevant source-file hashes. Final hashes and drift are recorded separately. Three inspected files changed during the pass: `RosterScheduleOptimizer.tsx`, `planningTypes.ts`, and `AcquisitionRules.integration.test.tsx`. The test-file drift appeared at the final hash check. The decisive search/evaluation files did not change in the recorded interval. Component line references below use the later observed version; exact hashes matter more than line stability.

Requested execution settings were GPT-6 Astra / High / Standard. No setting was changed, and the tools used did not independently attest the runtime model, reasoning effort or service speed. I therefore do not claim settings verification. I kept the coupled initial assessment with this observer; no agents were spawned.

Classification used below:

- **Confirmed defect:** source-path proof, strengthened by a synthetic execution where practical.
- **Missing capability:** a necessary workflow step is absent or intentionally unsupported.
- **Legitimate unknown:** information cannot safely be inferred from available inputs.
- **Questionable requirement:** the code imposes a product constraint whose necessity should be decided explicitly.
- **Hypothesis:** plausible explanation requiring evidence this scope cannot supply.

## Input-to-visible-result trace

### Shared FORGE forecast route

1. `web/pages/forge/forecasts.tsx:28` requests `/api/v1/forge/forecasts` only on form submission. It supports next 1–10 scheduled team games or a calendar window. Next-N uses a 60-day discovery interval; calendar is capped at 21 days by `web/lib/player-forecasts/gameExpectationReader.ts:6`. A scheduled opportunity is explicitly distinguished from an appearance/start.
2. The API delegates to `loadGameExpectations`, which calls `web/lib/rosterScheduleData/planning.ts:35`. The shared loader reads current verified canonical identities, season roster membership and schedule rows via `planningInputs.ts`; approved baseline bundles; optional modeled participation; and admitted detailed game revisions. It also loads matchup weeks, ownership and recent form even for this public forecast use.
3. The detailed route is controlled by serving/canary settings and immutable revision admission (`web/lib/projections/consumerRevisionAdmission.ts`). Baseline release is an exact allowlist plus policy/review/expiry verification (`web/lib/player-forecasts/contributionStore.ts:280`); native-source reconstruction adds another admission layer (`nativeContributionAdmission.ts:70`). Modeled participation has its own pinned releases and receipt reconstruction (`modeledSkaterParticipationStore.ts:29`). **Reading these code paths did not read any actual release IDs or private receipts.**
4. The baseline arithmetic is per-appearance ability (`baselineRates.ts:76`); modeled skater participation is recent current-club eligible-opportunity frequency, explicitly uncalibrated (`modeledSkaterParticipation.ts:44`). `planningContributions.ts:42` matches player/game/team/roster/schedule identities and resolves sources. `contributions.ts:286` integrates participation only when its basis and approved uses permit it. The scoped current-season SOG method deliberately cannot integrate participation (`contributions.ts:175`).
5. `gameExpectations.ts:128` selects upcoming scheduled games, exposes each head’s method/basis/clocks/permissions, and sums distinct per-game values. At lines 167–180, full totals require a complete schedule horizon and every selected game’s target. Covered partial sums exist in the API but the headline page totals remain unavailable when incomplete. Missing values are not generally filled with zero.

**Finding:** this is a workable shared forecast representation. It is not evidence that today’s releases cover a useful roster or have predictive skill. It is also not a full review of every mathematical submodel in the large legacy projection stages. Those stages feed the detailed-revision branch; the public consumer contract is the relevant decision boundary for this audit.

### Start Chart

`web/pages/start-chart.tsx:442` requests `forecast_source=game_expectations`. The API’s branch at `web/pages/api/v1/start-chart.ts:1177` calls the same shared reader for a single New York calendar date, then converts and scores it. `startChartContract.ts:399` adapts the shared per-game values; `:355` sets one board-wide expected/per-appearance/per-start basis; `:379` separately enforces comparison permission. The page can change scoring/basis. It refreshes and clears expired forecast rows (`start-chart.tsx:444–465`).

**Positive control:** the same synthetic expected GOALS value survived FORGE → Start Chart, and switching to an absent conditional basis produced null rather than borrowing the expected value. This is an important boundary to preserve. Start Chart is a daily comparison surface, not currently a next-N comparison surface. No requirement to expand that was assumed.

### RSO roster and provider input

`web/pages/roster-schedule-optimizer.tsx` mounts the client component. The component restores workspace intent, loads shared data, checks access, and can import an owned Yahoo team. `/api/v1/roster-schedule-optimizer/provider` requires an authenticated user and `rso_sync`; Fantrax explicitly returns unsupported for authoritative current rosters.

`web/lib/integrations/yahoo/rosterPlanning.ts:144` validates account/team/league scope, obtains roster/settings plus optional scoreboard/league roster facts, joins Yahoo keys to canonical NHL players, and sets explicit positions, reserve eligibility, can-drop state and locks. Available-player discovery paginates at most 81 pages of 25 with an 8-second **between-page** budget (`:285`); individually accepted results can remain useful when the full list is incomplete. The request path uses Yahoo GETs (`providerClient.ts:213–251`), not transaction execution.

The provider deliberately sets acquisition timing unknown, cost null, periods empty (`rosterPlanning.ts:256–264`), and reports rules/acquisitions capabilities false (`:374`). The UI’s Acquisition rules editor and `supplementProviderRules` can fill these gaps with manager inputs. This is **not** the same as having no way to enter acquisition rules. It is a required onboarding step that a successful Yahoo connection alone does not complete.

Connected evaluation uses the supplemented provider snapshot (`RosterScheduleOptimizer.tsx:570–580`); manual mode constructs a snapshot from workspace rules/roster/realized/opponent fields. A separate canonical NHL calendar is displayed (`canonicalSchedule.ts`), with stronger coverage checks than the planning-cache loader. That display calendar does not itself become optimizer schedule authority.

### RSO decision and presentation

`useRosterPlanning.ts` sends the snapshot/intent to `planRoster` in a Worker. `planning.ts:1044` evaluates no-move active-games and outcome baselines before the selected plan, then performs bounded multi-step search. `planningTimeline.ts` applies capacity, timing, reserve, drop protection, locks and acquisition budgets; the daily assignment uses weighted slot matching. Unknown comparable scoring in a connected position component suppresses quality claims rather than favoring the player with data (`planning.ts:304–343`).

The main visible candidate cards use **a second search**, `useCandidateMetrics` → `candidateMetrics.worker` → `candidatePlanMetrics.ts`, comparing single acquisitions and their necessary drops/reserves with an optimized original roster. Selected transactions are intentionally removed from this calculation (`useCandidateMetrics.ts:8–16`, `candidatePlanMetrics.ts:44`). The component’s plan alternatives disclosure instead displays `planRoster` results. These searches have different selection/quota/acceptance rules.

**Negative finding against a possible premise:** automatic suggestions already precede selection. The defect is not “the user must first invent a plan.” Some advice is legitimately withheld because inputs are incomplete, but there are also independent correctness and search-quality problems.

## Prioritized confirmed defects

### P1 — An unresolved owned player can be priced as zero in the baseline and recommended as a quantified drop

**Evidence:** `planningInputs.ts:104–116` can return a canonical player with `teamAbbreviation: null` when current roster membership is absent/ambiguous. The Yahoo mapping can still resolve that canonical identity and retain it on the manager’s roster. At `planning.ts:536`, a player without a matching scheduled team never becomes a play. The coverage and quality checks examine generated plays, not all owned players whose schedule is unknown (`:206–274`, `:753–785`). The partial identity evidence is not a blocker. `candidatePlanMetrics.ts:94–99` accepts finite baseline/evaluation totals and comparison flags without requiring the dropped contribution itself to be known.

**Executed reproduction:** three owned players have synthetic values 100, 90 and 1; candidate value 10. Removing the first player’s current team/revision leaves that player on the roster. The engine reports baseline 91, `recommendation.eligible=true`, `comparisonEligible=true`, then prefers dropping that unresolved player for **net +10 points / +1 active game**. Its dropped-player ledger correctly says `lostPoints:null`, `lostAGP:null` — directly contradicting the certainty of the net metric.

**Impact:** “unknown is not zero” is enforced at the forecast-head layer but violated before opportunities exist. A manager can receive an unjustified positive swap. This is more consequential than another missing-forecast explanation.

**Smallest direction:** distinguish verified zero-game opportunity from unresolved team/schedule for every relevant owned player, and propagate that uncertainty into baseline/net comparisons. Do not globally suppress unaffected, explicitly scoped capacity information. Add an invariant that a drop comparison cannot claim a complete net score while its missing contribution is unaccounted for.

### P1 — Default bounded search misses trivial beneficial swaps under complete inputs

**Evidence:** candidate selection sorts by ID and slices the first 40 (`candidatePlanMetrics.ts:41–69`), with 160 evaluations total. Two baselines consume two evaluations. With comparable forecasts each proposal consumes two more, one per objective (`:85`, `:117–139`). Drop proposals prioritize the two lowest `holdValue`/ID players for each candidate/date (`planning.ts:1001–1036`). Catalog inputs default holdValue to null and the Yahoo adapter does not populate it. Thus this often degenerates to ID order.

**Executed reproduction:** full 3-C roster values 100/90/1; forty available C players each worth 10; one game; complete forecasts, positions, rules and budget. One-candidate control finds dropping the 1-point player, **+9**. At forty candidates the default budget ends after testing the first two drops. The best retained card is **−80**; the +9 legal swap, independently evaluated to total 200 versus baseline 191, is absent for every candidate. These are synthetic arithmetic values, not performance estimates for real players.

**Separate executed reproduction:** candidate ID 140, the 41st eligible player, has value 1000. Its diagnostic is `not_selected/candidate_limit`, zero evaluations. It cannot compete with weaker evaluated cards. UI filtering and Show more only affect presentation (`CandidateBrowser.tsx:161`); selecting a player or searching its name does not request its evaluation. Excluding other players could incidentally change the capped set, but is not a sensible evaluation workflow.

**Impact:** a “bounded” disclaimer accurately describes the limitation but does not make the search useful. More data can make the result worse. The secondary plan-alternatives engine does not repair the candidate cards’ results; it has its own bounded shortlist/beam and must not be assumed to do so.

**Smallest direction:** prioritize complete candidate/drop pairs using marginal contribution/capacity, allocate a useful per-candidate first comparison, and evaluate an explicitly searched candidate on demand. For the first slice, exhaustive single-add/drop search on a small declared set is easier to reason about than two independent bounded searches. Do not just raise all quotas or remove cancellation protections.

### P1/P2 — Category workflow has disconnected inputs and a points-only selection predicate

**Source-confirmed:** Yahoo opponent data always sets `remaining:null` (`rosterPlanning.ts:362`). `opponentStats` returns null in that state (`planning.ts:77`). No remaining-opponent projection is computed from the imported opponent roster on this path. The visible `MatchupSetup` edits `workspace.realized` and `workspace.opponent` (`RosterScheduleOptimizer.tsx:1040`), but connected snapshot assembly returns the supplemented provider snapshot (`:574`). `supplementProviderRules` fills rules/locks only, not these matchup fields. Manual mode consumes them (`:579`); connected mode does not. Editing the exposed manual totals therefore cannot resolve the connected calculation. This was traced in source, not browser-executed.

**Additional deterministic source defect:** candidate `netPoints` is only computed in points mode (`candidatePlanMetrics.ts:94`). `CandidateCard.tsx:86` disables selection whenever a plan includes a drop and `netPoints === null`, including category mode. Consequently a category-league drop plan in the main cards cannot be selected even when legal and fully reviewed. Plan-alternatives UI has another path, so this is not a claim that all category plan selection everywhere is impossible.

**Product boundary:** `planning.ts:754–758` deliberately never grants a scalar quality recommendation in category mode. `CandidateBrowser.tsx:169` describes AGP ordering and manager category tradeoffs. That is defensible, but it does not fulfill a universal interpretation of “ranked by net improvement.” Category priority, weighted utility, dominance, or calibrated win probability are different products. Choose one explicitly; a calibrated joint win model is not a prerequisite for displaying honest category vectors and manager-selected priorities.

### P2 — Planning “complete schedule” is not proven coverage

**Evidence:** `planningInputs.ts:124–125` derives problems from an empty result or missing/older-than-36-hour fetched timestamps. It does not require both team sides, expected games per date, or a successful full-range ingestion receipt. The paginated DB read proves it read the rows present, not that those are all NHL games. `gameExpectations.ts:167–180` and `candidatePlanMetrics.ts:86` rely on this completeness label to produce full totals/net AGP.

**Executed reproduction:** an offline database stub returned one fresh NJD-home row for a seven-day range, with no NYR-away row or coverage witness. `loadPlanningInputs` returned one game and `schedule.completeness='complete'`, no limitations.

**Impact:** missing rows could silently undercount a roster and produce false totals. This does **not** prove the current stored schedule is incomplete. The canonical display calendar already checks covered dates and expected daily counts (`canonicalSchedule.ts:23–56`); it is a distinct source and does not fix this planner assertion.

**Direction:** use a persisted coverage receipt for the requested season/date span, including zero-game dates, rather than inferring completeness from freshness/nonemptiness. Retain per-team/per-date uncertainty if the full witness is missing.

### P2 — Forecast validity does not consistently expire in the visible product

**Source-confirmed:** FORGE forecast state changes on user submission (`forge/forecasts.tsx:28–46`); its only effect aborts on unmount (`:26`). No timer, focus refresh, or expiry-based display guard invalidates loaded expected totals. Source expiry is shown only in expanded detail. A page left open can continue displaying the original next-game/next-N rows after a game starts or a source expires. It does show a read-as-of timestamp, which mitigates but does not resolve this ambiguity.

Manual RSO similarly evaluates against a retained `context.asOf`; the shared-data effect runs on context/reload changes, not forecast expiry (`RosterScheduleOptimizer.tsx:369–381`). Provider auto-upkeep can refresh some sessions; it is capability-dependent and backs off. Start Chart already has a client expiry clock and removes expired rows (`start-chart.tsx:444–465`).

**Direction:** consistently distinguish historical snapshot analysis from current actionable advice. A local expiry marker/invalidation can be cheap and does not require aggressive polling or a generation job. This pass did not perform a timed UI/browser reproduction.

## Missing capabilities, legitimate unknowns and questionable requirements

- **Actual useful coverage is unknown.** Source proves the loaders can return empty because release allowlists/permissions/expiry/identity fail; it does not prove which gate is failing today. No environment, account, database, or private forecast artifacts were inspected. Do not infer a live coverage count from synthetic tests or filenames.
- **Ability and participation are separate legitimate unknowns.** Multiplying a conditional rate by scheduled games alone is not an unconditional forecast. The code generally handles this correctly. A conditional category comparison can still be useful if labeled consistently; it should not be sold as a full league-value recommendation.
- **Native broad-baseline cold start is absent.** `baselineRates.ts:131` skips a target if both projection consensus and previous-season rate are absent, before using current-season observations. Native admission requires no external projection rows (`nativeContributionAdmission.ts:27–29`). A synthetic player with twenty current-season GOALS/SOG observations and no prior received zero broad-baseline targets. This is an intentional prior requirement/missing capability, not proof that the arithmetic is wrong. The scoped current-season SOG method partially addresses one head but explicitly remains conditional, so it cannot by itself unlock a complete multi-stat points roster.
- **A released rate is not automatically a useful forecast service.** Baseline and participation releases must line up for the roster/game/stat cohort and remain current. Modeled participation is bounded to 500 total entries per read (`modeledSkaterParticipationStore.ts:64–77`) and its receipts expire within a day (`modeledSkaterParticipation.ts:48–55`). This can support a bounded cohort; it cannot be assumed to cover every skater across a week. Production completeness/refresh orchestration was not established here.
- **Acquisition facts are genuinely needed.** Unknown allowance, waiver timing, lock semantics and positional eligibility should not be guessed. The missing piece is a small, usable path to confirm required gaps, not bypassing them. Current provider success messages do not mean all rule facts are verified.
- **Complete league scoring is demanding by design.** Unknown competing eligible forecasts propagate through shared positional components, especially UTIL, and prevent full quality certification (`planning.ts:304–343`). This avoids invented superiority but can reduce the whole roster to capacity analysis because one head/player is absent. Consider explicitly scoped recommendations or sensitivity bounds; never silently delete the manager’s real scoring weights.
- **Forecast usefulness/accuracy is unproven here.** Hashes, provenance, deterministic reconstruction and unit tests establish consistency, not predictive skill. No conclusion about calibration, bias, comparative accuracy, or actual player value can be drawn from this audit.
- **No evidence that a wholesale engine replacement is required.** Weighted legal assignment and small complete swaps worked. The shared forecast basis worked. Yahoo transaction execution is absent from the inspected planning request path. Preserve these strengths.

## Shortest path to a useful vertical slice

1. **Define one supported decision contract.** Start with one daily points league using its actual scoring, one matchup window, actual roster/eligibility and a bounded verified candidate set. If the target manager uses categories, use an explicit selected objective/category vector instead; do not change their league to points or claim a global optimum.
2. **Repair negative-space coverage.** Every owned player must have known identity/team/schedule or explicit unresolved status. Require schedule coverage evidence. Demonstrate the unknown-owned-player reproduction can no longer generate a complete positive net claim.
3. **Make the no-move lineup the visible reference.** Show legal assignments, baseline contribution, unresolved components and supplied-versus-provider rules. Fill timing/cost/reset/remaining inputs once. Suggestions should appear without any selected transaction; that architecture already exists.
4. **Make single swaps dependable before multi-step itineraries.** Evaluate complete drop/add pairs against the same baseline and forecast basis; rank net gain, with lost contribution and schedule displacement visible. Fix the forty-candidate counterexample and demand evaluation for a searched player. Reuse one comparison result for cards and the alternative list rather than maintaining conflicting notions of the best found plan.
5. **Supply one sufficient forecast cohort.** Establish coverage for every scoring head needed by that actual roster/candidate decision. A clearly labeled simple baseline with an appropriate participation assumption/model is a more direct initial product than waiting for every advanced submodel. Its empirical approval and allowed use remain separate work; do not convert the existing conditional SOG canary into totals by relabeling it.
6. **Prove the journey, then widen.** An offline acceptance fixture should flow provider-shaped roster/settings and manager supplements through snapshot construction, shared forecasts, actual candidate worker logic and UI selection. Include dual eligibility, a weak third drop choice, a strong 41st candidate, unknown roster membership, a no-game date, and expiry. Then, only with later explicit authorization, check a bounded real cohort to determine whether published coverage meets this contract.

Stop at a useful tested daily single-acquisition flow before expanding weekly locks, multi-move beam depth, goalie joint scenarios or category win-probability optimization. Do not rewrite the entire FORGE pipeline, add another parallel reader, or continue growing diagnostics as the primary progress measure. Do not loosen unknown handling to make screens look populated.

## Verification and limits

Installed Node was **22.11.0**, Vitest **3.2.7**. A dedicated artifact-local Vitest configuration used an artifact-local env directory and no project setup/env files. A setup guard blocks fetch, HTTP(S), TCP and TLS entry points. Only pure calculation modules and a synthetic query stub were executed. No compiler/type-check command or application build was run; Vitest performed its normal test-source transforms.

Eight unique checks ran and passed across three executions:

| Check | Result | Meaning |
| --- | --- | --- |
| One-candidate complete swap | Passed | Positive control, correct +9 |
| Forty-candidate budget starvation | Passed | Reproduces missed +9 / returned best −80 |
| Strong 41st candidate | Passed | Reproduces zero evaluations |
| Unknown owned-player team | Passed | Reproduces unjustified +10 with unknown lost contribution |
| Unequal next-N game sums | Passed | Correct sum, missing head remains null |
| FORGE → Start Chart basis | Passed | Shared value preserved, no basis substitution |
| Current-season-only broad baseline | Passed | Confirms no-prior coverage hole |
| Sparse planning schedule | Passed | Reproduces unsupported completeness assertion |

These are **audit probes**, not a claim that the application passes its full suite. Existing nearby tests were inspected, not broadly executed. They include legal slot reshuffling, missing-forecast withholding, acquisition rules, 652-known/197-unknown discovery fixtures and UI mock-worker paths. The candidate-pool tests explicitly assert first-40 selection and display-only filtering; that validates the implementation contract but does not demonstrate recommendation quality. The new forty-candidate regret example supplies the missing product-level counterexample.

Artifacts: `synthetic.test.ts`, `vitest.audit.config.mjs`, `offline-guard.mjs`, `synthetic-results.log` (first five checks), `unknown-team-results.log` (one additional check), `forecast-controls-results.log` (two additional checks), and source-hash manifests. Skipped counts in the later logs are tests intentionally filtered after their earlier successful run, not failed checks.

No denied or uncertain external action occurred. Remaining limitations are authorized-scope limits: no browser usability/layout check, no real provider input validation, no real release/forecast/outcome coverage, no predictive evaluation, no deployment verification, and no independent runtime-model attestation. Concurrent component/type edits are flagged rather than altered. This report is the initial independent finding set; any comparison with other workers’ findings must be a subsequent pass.
