# FHFH Roster Schedule Optimizer — audited PRD

Document date: October 8, 2026. Status: requirements finalized; implementation and release acceptance remain open.

This is a documentation deliverable. It authorizes no implementation, merge, push, remote build, deployment, provider transaction, credential operation or production-data change.

## 1. Introduction / overview

The Roster Schedule Optimizer (RSO) helps an in-season fantasy hockey manager plan a matchup or custom date range. It combines the manager's roster, league rules, player availability and schedule with usable player/goalie forecasts. It answers: “Which legal sequence of roster choices gives me the most usable starts or the best projected result, and what would I sacrifice?”

The product is provider-neutral, with Yahoo as the first connected provider and Fantrax compatibility as a continuing direction. Yahoo access is read-only. A manager carries out any lineup change, acquisition or waiver claim in the provider.

Scheduled games alone can overstate a player's benefit. A player may arrive after a game, compete for a full position, remain locked on the bench or displace a stronger contribution. RSO must evaluate actual legal starting assignments and show the net change from an explicitly stated feasible no-move lineup.

This PRD updates the product plan using the [companion audit](rso-audit-2026-10-08.md). It preserves the earlier [implementation plan](../prd-roster-schedule-optimizer.md) and [task/evidence history](../tasks-prd-roster-schedule-optimizer.md); it does not replace their historical receipts.

### Resolved owner decision

TJ selected **A — Wait for both** on October 8 at 5:29 p.m. EDT (21:29 UTC): the **first controlled daily beta requires positive real-data forecast acceptance**. Legal schedule planning, rule fixtures, continuity and responsive work can proceed before that gate closes. Completion of those tasks alone does not clear the beta.

Both manual and Yahoo-connected users must be supported in the daily beta. Weekly-lock support is required before full launch. Unsupported weekly or mixed rules must be identified clearly until qualified.

### Plain-language definitions

| Term | Meaning |
| --- | --- |
| Scheduled game | A team's game in the selected date range; it may not be usable by this roster. |
| Legal start / active game | A player-game that fits eligibility, available roster capacity, timing and locks. Schedule capacity does not assert actual player participation. |
| Marginal contribution | The plan's contribution minus the stated no-move baseline, including displaced roster contributions and acquisition timing. |
| No-move baseline | A feasible lineup using the current roster, with no new acquisitions, evaluated under the same inputs and objective as the comparison. |
| Manager intent | The manager's selected moves, protections, exclusions and explicit locks. |
| Snapshot | The roster, rules, availability, schedule and evidence captured for a planning context at a stated time. |
| Revision / manifest | Identifiers linking forecasts to their immutable inputs, permitted uses, coverage and exclusions. |
| Conditional forecast | Production if an event occurs, such as appearing or starting; it is not automatically the expected contribution. |

## 2. Goals

1. Let a manager create or reopen one working plan for a league/team/timeframe and understand the next legal action without losing prior choices.
2. Compare maximum legal starts and best supported projected outcome against a stated no-move baseline, including tradeoffs and missing evidence.
3. Preserve league-specific positions, eligibility, locks, timing, budgets, waivers, reserves and goalie requirements in every evaluated plan.
4. Make unknown data visible. Missing availability, participation or statistics must never become a claim of addability, a certain appearance or a zero contribution.
5. Provide the same planning engine to free manual and premium connected users, with premium paying for synchronization, automatic upkeep and account saves.
6. Clear controlled daily beta only after both deterministic workflow checks and positive real-data forecast consumption pass; qualify weekly locks before full launch.
7. Deliver a usable mobile workspace and a compact desktop frame including navigation.

The acceptance matrix in section 8 supplies observable pass conditions. Predictive benefit, calibration and commercial activation have separate evidence gates.

## 3. User stories

- As a free manager, I can enter a roster and reviewed rules, calculate on request and keep a local plan so I can make informed choices without connecting an account.
- As a connected Yahoo manager, I can inspect imported rules and availability, supplement explicitly missing rules and see their provenance so I know which conclusions are supported.
- As a manager planning an acquisition, I can compare legal starts and projected contributions after its effective time so I do not mistake extra scheduled games for a usable gain.
- As a category-league manager, I can see category gains, losses and full-lineup ratio changes so I can assess the actual tradeoff against my opponent.
- As a manager pursuing a goalie minimum, I can distinguish credited progress, projected starts/appearances and remaining actionable opportunities so I can assess risk without invented certainty.
- As a manager returning to a plan, I can refresh, undo an edit and reopen without silently losing selected moves or reusing obsolete provider authority.
- As a mobile manager, I can use Itinerary, Roster, Candidates and Matchup workspaces without navigating a stack of desktop panels.
- As a manager with unsupported rules or incomplete forecasts, I can continue the supported schedule analysis and see what needs review before acting.

## 4. Functional requirements

### Planning context and inputs

1. **Context and horizon.** The system must identify provider, season, league, team, selected dates, league time zone and as-of evidence. It must support matchup presets and valid custom ranges. Changing context must invalidate mismatched results and prevent responses from an older account/team/horizon from entering the current plan. Do not silently shorten a requested horizon to obtain coverage or meet a search budget.

2. **Manual and connected setup.** Manual users must be able to select canonical players, retain unresolved names, enter roster/rules and review assumptions. Connected Yahoo users must select an owned team and receive scoped roster, settings, locks, matchup and availability evidence. Existing account connection/settings behavior must remain available independently of RSO entitlement.

3. **Rule authority.** Every relevant setting must distinguish provider-verified, manager-supplied and unknown information. Manager input may fill a provider gap; it must not silently replace a conflicting authoritative provider rule. Display the retained provider value and conflict. Unknown acquisition or lineup semantics must block only dependent actionable conclusions.

4. **Availability and exclusions.** Candidate addability must come from explicit current league evidence or labelled manager verification. Ownership percentage and absence from the manager's roster are not availability. Preserve unknowns, partial discovery, source age, excluded players and reasons. Do not advertise a complete available-player list after a truncated, timed-out, repeated or incoherent read.

### Legal evaluation and comparisons

5. **Feasible baseline.** Each comparison must state its no-move baseline and objective. Use the same roster context, rules, opportunities and compatible forecast inputs for both sides. Optimize feasible slot assignments rather than compare against an arbitrary weak lineup. The engine may calculate separate no-move starts and outcome baselines; the displayed comparison must identify the one used.

6. **Maximum starts and projected outcome.** Show maximum legal starts and best supported projected outcome as distinct alternatives. Explain differences in usable games, player quality, displacement, category results, goalie coverage and acquisition cost. A bounded search must disclose its limits and must not claim a global optimum.

7. **Marginal gains.** Calculate gains from actual starting assignments after acquisition/drop timing, locks, eligibility and capacity. Count only an acquired player's usable opportunities before their later drop. Include displaced roster contributions. If three scheduled games yield one legal start and displace one existing start, do not label the result “three extra games.” Unknown metrics must be unavailable; a verified zero must remain zero.

8. **Eligibility and roster capacity.** Respect positions, dual eligibility, shared utility slots, active/bench capacity, vacancies, protected players, explicit exclusions, droppability and verified reserve eligibility. IR/IR+ moves must be legal prerequisites in the sequence; a vacancy must not require an invented drop.

9. **Lineup locks.** Apply daily locks and independent weekly lineup windows in the league time zone. Preserve explicit active and bench locks, including a lock encountered midway through the selected horizon. Acquisition reset periods must not define weekly lineup windows. Recognized but unqualified weekly/mixed profiles must be labelled unsupported for actionable planning.

10. **Acquisition action and effective times.** Distinguish when a manager submits an action from when it changes the roster. Candidate selection must follow verified same-day/next-day timing and waiver clearance, rather than assign identical times by default. Charge acquisition cost in the action's actual reset period. Preserve valid preceding-day actions, such as a Sunday submission effective Monday, when they are necessary for the selected horizon and covered by verified rules.

11. **Budgets, sequences and waivers.** Respect remaining allowances, reset boundaries, acquisition costs, dependencies and waiver timing. Show ranked feasible alternatives and conditional waiver paths. Retain a successful prefix when a later conditional step fails. Do not invent remaining allowance, assume zero means unlimited or recommend FAAB bid amounts.

12. **Points, categories and ratios.** Use the league's declared objective and supported scoring inputs. For categories, present each category's baseline/plan values and gain/loss, direction and supported matchup result. Aggregate ratio numerators and denominators for the entire evaluated lineup; never average player ratios to construct a lineup ratio. Do not use a universal category blend or label category changes as win probabilities.

13. **Forecast permissions and uncertainty.** Projected totals, assignments, acquisition comparisons and recommendations require the evidence permissions appropriate to each use. Preserve compatible target, source, cutoff, schedule, roster, model and participation identity. Missing, expired, revoked, conflicting or incompatible inputs must suppress dependent numerical claims while preserving supported schedule analysis. Label estimates provisional unless the specific claim is calibrated.

14. **Participation and goalie semantics.** Keep conditional production, participation probability, unconditional contribution, confirmed evidence and realized results distinct. Do not turn a per-start forecast into an all-appearance forecast, expected starts into credited minimum progress, or an absent stat row into an authoritative nonappearance. Goalie start-only assumptions, relief support, back-to-back context and unresolved starter mass must be disclosed. Conflicting same-team starter evidence must not be clamped into apparent readiness.

15. **Goalie planning.** Default the early/late split to Mon–Thu/Fri–Sun, with Mon–Wed/Thu–Sun available. Use remaining actionable dates and back-to-back opportunities. Respect the league's verified minimum count basis and penalty. Display credited progress separately from projected/confirmed future evidence and explain minimum-risk versus projected-outcome tradeoffs, including harmful starts after a credited minimum is met.

16. **Bench explanations.** Explain decisions using the actual evaluated assignments: eligibility/capacity conflict, explicit lock, unavailable timing, missing evidence, negative contribution, supported category tradeoff or goalie-minimum priority. Show assumptions relevant to the selected date/window. A player name, reputation or invented matchup explanation must not substitute for evidence.

### Workspace, continuity and access

17. **One resumable working plan.** Retain one working plan for a league/team/timeframe. Preserve roster, selected moves, protections, exclusions, explicit locks, reviewed supplements and unresolved input. Provide undo for manager edits. The current single local workspace and context-scoped account saves must be tested against this contract before promising broader local multi-context retention.

18. **Refresh and repair.** Refresh on reopen and while active according to the user's capabilities. Keep manager-selected moves until the manager accepts a proposed repair. Show changed availability, rules, budgets, goalie evidence and passed action times. A failed refresh must preserve the prior workspace while clearly identifying stale/unverified authority. An old network or worker response must not replace current context.

19. **Undo after refresh.** Undo must reverse the manager edit without silently restoring obsolete provider authority or invalidating current account identity. Preserve/reconcile current provider inputs and flag affected intent. Add a compound refresh → undo → reopen regression before deciding whether the current whole-workspace undo requires repair. This is an acceptance requirement; the audit identified a risk, not a reproduced failure.

20. **Account continuation and conflicts.** Premium users must save and reopen a context-specific plan with owner isolation and optimistic concurrency. Account switching must clear incompatible connected/account state and discard late responses. A stale-version conflict must preserve the local plan and require review of the other version. Saved snapshots must open with their historical evidence visibly identified, and explicit continuation must reconcile them with current inputs.

21. **Free/premium contract.** Free users receive the same manual calculations, recommendations and supported engine behavior on request, with local retention and undo. Premium adds supported provider synchronization, connected automatic refresh/recalculation and account saves. Manager-triggered local edits/calculations must not be confused with premium background provider upkeep. Expired premium keeps saved snapshots read-only and retains manual use; it must not silently delete saved plans or grant sync/save/upkeep.

22. **Entitlement commitments.** Preserve independent valid purchase, preview, grandfather and Patreon grants so expiration of one does not revoke another. Preserve first-100 grandfathering through June 2027, the common two-week Draft Pro preview and existing verified paid active FHFH Patreon qualification across tiers, excluding trials/ineligible charge states. Final pricing, branding, exact date/timezone/cohort rules and fulfillment activation require separate decisions and authorization.

### Interface and release

23. **Responsive workspaces.** Mobile must default to Itinerary with Roster, Candidates and Matchup workspaces and an optional seven-day comparison. Preserve selection and relevant context between workspaces. Desktop must fit navigation, setup, summary and workspaces within a compact viewport with sensible panel scrolling. Mobile scrolling must remain usable.

24. **Beta and launch gates.** Controlled daily beta requires accepted manual and connected daily workflows, schedule/provider/access acceptance and positive real-data forecast acceptance for the declared profiles/horizon. Weekly-lock support and connected-rule qualification are additional full-launch gates. Passing fixtures, branch pushes, table population, exploratory captures or an HTTP 200 alone must not clear either gate.

## 5. Non-goals / out of scope

- Yahoo lineup writes, acquisitions, waiver submissions or other provider transactions.
- FAAB bidding advice.
- Multiple named itineraries, public sharing/export and out-of-session notifications; these are explicitly deferred.
- A universal category blend, unsupported category/ratio invention or uncalibrated win-probability claims.
- Advertising authoritative Fantrax in-season sync before its roster/availability/rule feeds are qualified.
- A broad forecasting rewrite, team win-probability promotion or broad historical backfill as an automatic prerequisite for RSO development. Compatible player/goalie forecast inputs remain a specific external dependency.
- Changing Draft Pro commerce, creating credentials, publishing forecasts/grants or triggering deployment as part of this documentation task.

## 6. Design considerations

Use the existing RSO component, candidate browser, bench/evidence views and scoped styles. Extend their patterns rather than add a competing workspace or rules editor.

A compact readiness path should direct the manager to existing roster, rule, availability and forecast inputs. It must distinguish schedule analysis, acquisition legality and projected recommendation readiness. Default slot values or a selected lineup mode do not verify a league.

The itinerary should answer the immediate decision: next action, action/effective time, prerequisite/drop, cost, legal startable gain, supported projected tradeoff and conditional risk. Keep explanations close to the result. Disclosure panels may hold advanced rule and source details. Private revision identifiers belong in diagnostic evidence rather than ordinary product copy.

Use clear unavailable, stale, partial, unsupported, loading and conflict states. Retain keyboard navigation, labelled controls, visible focus and readable zoom/reflow. Avoid horizontal overflow at the smallest supported mobile width. Verify expanded details and dense rosters, not just the empty page.

Current evidence includes historical fixture checks at 1440×900, 390×844 and 320×844, plus existing dense/expanded layout cases. These are acceptance leads, not a current live visual review.

## 7. Technical considerations and current implementation

### Existing boundaries

| Responsibility | Existing implementation to reuse |
| --- | --- |
| Page and workspace presentation | [page](../../web/pages/roster-schedule-optimizer.tsx), [RSO component](../../web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx), CandidateBrowser, BenchDecisions, ForecastEvidence and scoped SCSS |
| Serializable inputs/rules/intent | [planningTypes](../../web/lib/rosterScheduleOptimizer/planningTypes.ts), workspace and providerRules |
| Legal timeline, assignments and sequence search | [planning engine](../../web/lib/rosterScheduleOptimizer/planning.ts), planningTimeline, matching, slots and reconciliation |
| Background local calculation | [planning hook](../../web/hooks/useRosterPlanning.ts) and rosterPlanning.worker |
| Shared schedule/player/forecast read boundary | [planning data loader](../../web/lib/rosterScheduleData/planning.ts), planningInputs and shared consumerRevisionAdmission |
| Connected Yahoo snapshots | [Yahoo adapter](../../web/lib/integrations/yahoo/rosterPlanning.ts) and RSO provider route |
| Entitlements and account persistence | in-season access/server/workspaceSchema, RSO access/workspace routes and repository-root Supabase migration lineage |

Preserve server authentication, service-only account persistence, owner/context filters and version checks. The earlier additive migration/release is recorded in task history; this PRD proposes no new schema or migration. Check the relevant migration authority before any later database work.

Shared and provider reads must be bounded by selected scope, counts, stable identities and deadlines. Preserve truthful source timestamps and compatibility through cache/reopen/refresh. The current public HTTP cache does not by itself prove accepted-news revocation reaches an already retained browser plan within an acceptable lag. Freshness/revocation acceptance must cover warm cache and failed revalidation.

Use complete context/rule/intent/objective/evidence identities for reuse and cancellation. The data parser currently allows at most 367 inclusive calendar days. Long-horizon performance must disclose bounded search rather than shorten the horizon.

### Exact revision and completion map

| Revision | Verified scope / status | Limit |
| --- | --- | --- |
| Local master 9b11d3607b5afe2d7c6dff6d6dd918c1bcff92c4 | Dirty; ahead 4/behind 22 against retained origin/master | Do not use as the integration base or overwrite unrelated changes. |
| Production 171116877633d537a39b2a3e168882913269d47f | Retained origin/master; current Pages report deployed READY; core RSO present | This audit did not perform new live endpoint/UI checks. Core deployment is separate from feature acceptance. |
| Release-safe 98c1b5036dea54a1d9fdf551f279d241b7851ecf | Pushed by current Page receipt and retained origin ref; descends from production | Inspected RSO core/provider/access scope matches production. CategoryGains is absent. |
| Research-safe 30b184bc7f63eca090ee98610901c70b32a7afb5 | Pushed receipt and retained ref; production ancestor | Research acceptance is separate from RSO data/release acceptance. |
| Consumer cfa484fa27cccd614839b8edffb0e31453b1f890 | Verified local nine-file component/hook/test candidate; 126 unit/five-browser/TypeScript/lint historical receipts | Not integrated into the above tips or M1–M4; not pushed/deployed/real-data accepted. Reuse the focused patch. |
| Forecast M1–M4 9592e2e6c023cbfb665ba5b4674ff9c366c7637a | Locally accepted engineering per current Page; actual M4 admission/test diff inspected | Not released. Qualification, native participation/targets and actual matching consumer readbacks remain open. |

The consumer patch adds category deltas guarded by legal/budget/comparison/manifest evidence and synchronously invalidates results when inputs/intent change. Its work is completed locally; rebuilding it would duplicate completed work.

M4 owns changes to shared consumerRevisionAdmission and the data-loader planning test. It improves conflicting-revision, run/date/class/horizon and timestamp admission checks. Keep those files with the shared owner rather than add a parallel implementation.

The Yahoo adapter already distinguishes scoped weekly usage from an unverified limit. It explicitly leaves acquisition timing/cost/reset periods, exact weekly lineup windows and goalie-minimum credit/counting unresolved. Fixtures must preserve those safeguards; live contracts need qualification rather than optimistic defaults.

The audit's concrete consumer gap is candidate selection assigning identical action/effective time even where the engine supports next-day or waiver rules. Whole-workspace undo is a compound continuity risk to test. Existing account-switch, saved-view, individual undo and provider-refresh fixtures are already present.

### Evidence labels

| Label | Required evidence |
| --- | --- |
| Verified local | Direct source/revision inspection, or explicitly recorded execution at a named revision |
| Pushed | Exact remote-ref receipt; no implied deployment |
| Deployed | Exact deployment/release receipt; no implied feature acceptance |
| Real-data accepted | Observed fresh compatible input and actual consumer result for a declared profile/horizon |
| Incomplete | A known requirement gap or unmet acceptance condition |
| Unknown | Evidence was unavailable or not observed; absence of verification is not a reproduced defect |
| Deferred | An explicit approved exclusion from current scope |

This documentation task ran no application tests, browser cases or runtime provider checks. Historical counts remain attributed to their original revisions and sources.

## 8. Success metrics and acceptance matrix

### Required acceptance

| ID | Requirements | Evidence to produce / pass condition | Current disposition | Gate |
| --- | --- | --- | --- | --- |
| AC-01 | 1–3 | Manual and normalized connected snapshots preserve exact team/horizon/timezone; account/horizon replacement rejects old responses and explains rule provenance/conflicts | Existing source/tests; compound and live acceptance open | Schedule/provider |
| AC-02 | 5–8 | Displacement, dual eligibility and utility congestion produce correct marginal starts/contributions against the stated baseline; tiny exhaustive fixture cases agree; zero and missing remain distinct | Core fixtures present; category presentation candidate unintegrated | Deterministic planning |
| AC-03 | 9–11 | Same-day, next-day, preceding-day, waiver clearance, reset boundaries, vacancies, IR/IR+, locks and successful-prefix cases are legal; no extra budget or premature games | Engine fixtures present; candidate timing wiring incomplete | Schedule/rules |
| AC-04 | 4,11 | Partial/failed availability retains unknowns; no non-rostered/low-ownership player becomes addable; budget waivers require supported evidence without bids | Local safeguards/fixtures present; actual provider coverage unqualified | Provider |
| AC-05 | 12–16 | Points/category/ratio and goalie-minimum cases show actual supported outcomes and tradeoffs; invalid participation/starter mass and unsupported targets suppress claims | Local fixtures and cfa receipts; native semantics/readback open | Numeric forecast |
| AC-06 | 17–20 | Refresh → undo → reopen preserves current authority and manager choices; repairs require acceptance; locks/protections survive; stale-version save and account switch preserve isolation | Individual tests exist; compound risk unproven | Continuity |
| AC-07 | 21–22 | Free manual requests and premium background upkeep use the same engine; expiry retains read-only saves; grant union and capability enforcement work | Local access/schema/API fixtures; operational/commercial activation separate | Access |
| AC-08 | 23 | Dense/expanded desktop including navigation scrolls in sensible panels; 320/390px mobile tabs preserve intent and remain usable; keyboard/zoom states pass | Historical browser receipts; integrated/current acceptance open | UX |
| AC-09 | 13–15,24 | Fresh admitted player/goalie evidence covers the declared horizon/profile; exact revision/manifest reaches legal selected/no-move assignments and category comparisons; exclusions remain visible; matching Start Chart readback where shared acceptance requires it | Not real-data accepted; public serving OFF per current Page receipt | Positive real-data beta |
| AC-10 | 1,13,18 | Warm cache, reopen, accepted news, expiry, revoked permissions, failed refresh and cancellation never revive unsupported eligibility or present fetch time as source time | Local guards; permitted freshness lag and end-to-end proof open | Freshness |
| AC-11 | 9,24 | Exact weekly windows, daily/weekly independence, midpoint/bench locks, acquisitions after locks and provider supplementation pass manual/connected profiles | Weekly engine/browser fixtures present; Yahoo qualification open | Full launch |
| AC-12 | 24 | Exact proposed release includes required candidates, declared supported profiles and all applicable receipts; approved deployed build has observed live behavior | Not cleared | External release |

For AC-09, a populated table, successful job, fixture revision, exploratory capture or HTTP 200 with zero forecasts is insufficient. Record selected dates/opportunities, as-of time, admitted revision/manifest, permitted uses, participation basis, required versus covered targets, exclusions and actual consumer assignments/comparisons. A bounded private readback may supply evidence within an approved scope; this PRD authorizes no run or serving change.

A narrow proof does not certify broader horizon/profile coverage. Missing real-data coverage must not be hidden by truncating the manager's selected dates. The broader team win-probability promotion is not a prerequisite for these player/goalie consumption checks.

### Performance and product measures

- Correctness: every required acceptance case passes at the proposed integrated revision; all unsupported claims in negative cases remain unavailable.
- Continuity: zero silently replaced manager-selected moves in the refresh/undo/reopen and save-conflict acceptance pack.
- Forecast readiness: every numerical claim has compatible evidence for its declared use; report coverage/exclusions rather than a misleading single success rate.
- UX: no horizontal overflow in required mobile cases; usable keyboard/zoom and dense desktop scrolling.
- Proposed performance targets from the earlier plan: visible local-edit response within 100 ms, typical baseline within 250 ms, typical alternatives within two seconds, feasible provisional stress result within five seconds and context/cancellation acknowledgement within 100 ms. Measure before adopting them as release guarantees; historical fixture timings are not production service levels.
- Post-beta measures to define before measurement: time to first reviewed plan, successful resume rate, manager-accepted repair rate, repeated use and relevance feedback. No numeric adoption, retention or pricing target is invented here.
- Predictive quality: only make benefit/calibration claims supported by the appropriate retained evaluation cohort and target/conditioning. Fixture correctness alone is not predictive accuracy.

## 9. Dependency-ordered milestones and ownership proposals

These are proposed responsibilities for a later authorized implementation task, not new assignments or spawned workers. The existing lead owns integration and final acceptance.

| Milestone | Deliverable | Dependencies | Proposed owner / non-colliding file scope |
| --- | --- | --- | --- |
| RSO-0 — Evidence baseline | Preserve this PRD/audit, resolved A decision, exact ancestry and existing receipts | Complete in this documentation task | Documentation owner; these two Markdown files |
| RSO-1 — Integration plan | Review cfa's nine-file patch and M4's shared admission changes against the release-safe ancestry; name exact candidate integration scope and verify no duplicate work | RSO-0 | Lead/release owner; integration is separately authorized later |
| RSO-2 — Legal first plan | Repair candidate action/effective timing; display net legal startable gain, cost and uncertainty; extend nearest component/engine/browser cases | RSO-1; independent of fresh forecast generation | Existing RSO consumer owner 01a110a4; RSO component, CandidateBrowser and nearest tests |
| RSO-3 — Compound continuity | Prove refresh→undo→reopen, manager intent/protections/locks, current authority, saved conflicts and mobile continuity; fix only reproduced gaps | RSO-2 for shared component ownership; RSO-1 | RSO workspace/consumer owner; component, workspace/reconciliation and existing tests |
| RSO-4 — Rules qualification pack | Fixture matrix for provider/manual rule provenance, timing/reset/waiver/eligibility/availability and independent weekly windows; prepare bounded real Yahoo acceptance scope | RSO-0; can proceed alongside RSO-2/3 when file ownership is separate | RSO provider-contract owner; Yahoo rosterPlanning and providerRules/tests |
| RSO-5 — Positive forecast qualification | Fresh compatible player/goalie revision, participation and supported targets; actual matching downstream readback | Existing forecast qualification/admission work and qualified schedule/roster inputs | Existing FORGE readiness/M4 owner; consumerRevisionAdmission and data planning tests stay with that owner |
| RSO-6 — Integrated acceptance | cfa/M4 inclusion and AC-01–10/12 evidence for declared daily manual/connected profiles; responsive and freshness checks | RSO-2/3/4/5 | Lead plus existing consumer/Start Chart owners; serialize shared E2E/component edits |
| RSO-7 — Controlled daily beta | Release checklist with positive real-data acceptance and independently passed schedule/provider/access/UX gates | RSO-6 and separate external release authorization | Lead/release owner; no guessed release date |
| RSO-8 — Weekly full launch | Qualify actual connected weekly windows/rules and AC-11; close full-launch evidence without rebuilding existing weekly engine | RSO-4/6; full launch also requires all daily gates | Provider-contract/RSO owners under lead review |
| Commercial activation | Final branding/price/term/dates/cohort edge cases and approved fulfillment/grant operations | Separate owner decisions; development can continue independently | Business/entitlement owner; preserve existing commitments |

RSO-2 and RSO-3 both touch the RSO component and must be serialized. RSO-4 may be independent if it avoids that component and the shared E2E file until integration. RSO-5 must not be duplicated by a consumer patch.

Protect UTA–BOS capture owner 01a10f57 and pin 6a91f09d888722d2828809e62e1b932ab43330d0. Do not repurpose that session, branch, worktree or evidence. Its schedule is not this PRD's release clock.

### Release gates

| Stage | Required completion |
| --- | --- |
| Independent local engineering | Deterministic schedule/rule/continuity/UX deliverables may proceed before forecast qualification. Completion has no beta-clearance implication. |
| Controlled daily beta | Supported daily manual and connected workflows; schedule/provider/access/UX acceptance; positive fresh forecast acceptance; correct candidate inclusion; separate deployment approval. TJ's A decision applies. |
| Full launch | All daily gates plus qualified weekly-lock behavior and connected weekly rules. Unsupported mixed profiles remain explicitly excluded. |
| Calibrated/predictive claims | Claim-specific retained evaluation and compatible participation/conditioning evidence; separate from feature availability. |
| Commercial activation | Final approved commercial/cohort/timezone rules and separately authorized fulfillment/grants. Existing free/manual commitments continue. |

Keep serving OFF until the applicable owner approves activation. No forecast generation, production repair, migration, grant publication or remote build is implied by a milestone being ready.

### Proportionate verification in later implementation

Run commands from web with its pinned Node 22.11.0/npm configuration. Select only tests justified by the touched scope:

- Focused Vitest: npm test -- --run followed by the relevant planning, workspace, reconciliation, providerRules, Yahoo rosterPlanning, component or in-season test path.
- Browser behavior: npm run test:e2e -- e2e/roster-schedule-optimizer.spec.ts --project=chromium in an approved runnable environment. Test discovery is not browser execution.
- TypeScript when warranted: NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false; the larger heap reflects historical repository evidence.
- Scoped ESLint for changed files, and diff/link/document review for documentation.

Do not run a production build for routine confidence, regenerate dependencies/lockfiles, or treat any remote deployment as verification without explicit task authorization. Report passed, failed, not run or blocked with the exact revision and scope. Reuse unchanged passing receipts where appropriate.

## 10. Open questions and remaining blockers

### Product question resolved

The beta staging question is resolved as **A**. It must not be re-opened merely because schedule/workspace development finishes first.

### Development and evidence questions

| Open item | What it blocks / next evidence |
| --- | --- |
| Which exact daily rule/scoring profiles, test accounts and horizons comprise the controlled cohort? | Lead must declare a bounded acceptance scope and unsupported cases before beta; retain manual/connected parity and the full product contract. |
| Fresh native player/goalie coverage, approved targets and participation | Positive forecast acceptance; existing forecast owner supplies qualified revisions and actual readbacks. |
| Current runtime schedule/provider freshness and coverage | Bounded read-only acceptance; the earlier stale/zero-forecast Page receipt is not a new live observation. |
| Exact Yahoo action/effective timing, NHL limit encoding/reset boundaries, waiver semantics and weekly windows | Connected qualification pack; preserve unknowns until verified, with labelled manager supplements where allowed. |
| Refresh→undo→reopen behavior and local per-context retention | Compound acceptance pack; do not assume the identified risk is a reproduced defect. |
| Permitted event-to-consumer freshness/revocation lag and cache cost | Define and measure a bounded policy; don't invent a freshness service level or increase origin load without evidence. |
| Actual integrated performance and large-horizon behavior | Measure proposed targets with declared workloads, search bounds and cancellation. |
| Exact candidate integration/release inclusion | Lead's future review of cfa and M4; local completion and branch push are different statuses. |

### Commercial decisions kept separate

Final in-season branding, price, billing model/term, exact access dates/timezone, first-100 qualification/order, duplicate/refund/complimentary cases, preview eligibility and late purchasers remain open. One-time billing is the current preference in the Master Page; it is not a finalized price or activated fulfillment contract. Preserve the approved June 2027 grandfathering, common preview and Patreon/free-premium commitments.

### Source availability and documentation verification

- [FHFH Master Task List](https://chatgpt.com/space/page_227f33dd9ed48191b1b2631bf6c4204c), sequence 16, and [FHFH project priorities and progress](https://chatgpt.com/space/page_d8755e5b1fc4819180b99b8a1286fc8a), sequence 40, were read on October 8. Their release/test/runtime statements are attributed receipts.
- Existing RSO owner thread 01a110a4-ee58-719a-93ed-3471224490d9, completed turn 01a11d44-9cee-70f4-8698-1d16ea6562bc, was read and reused. Its current source findings outrank the earlier mistaken integration assumption.
- Review RSO Prompt and the original trust task history were not recovered as usable direct sources. Repository PRDs/current Pages/owner findings supply the available evidence. No session directories were searched.
- The supplied PRD creation rules were read through Library. A local copy could not be downloaded; the readable rules and TJ’s exact clarification answer were used to finalize this document.
- This PRD follows the sheet's final output location, tasks/TASKS, uses numbered requirements for a junior developer, records TJ's answer and leaves implementation untouched.
- Documentation verification is reported with delivery. No application suite or browser execution is claimed for this documentation-only change.
