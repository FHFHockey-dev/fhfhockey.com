# FHFH Roster Schedule Optimizer Consolidated PRD

**Product owner:** TJ

**Document date:** October 9, 2026

**Status:** Confirmed product direction; proposed defaults await review; daily beta and full launch remain unaccepted

**Source snapshot:** October 9 evening EDT / October 10, 2026 UTC
**Source:** [FHFH RSO Consolidated Product Requirements](/Users/tim/Downloads/FHFH-RSO-Consolidated-PRD-2026-10-09.md), with TJ's clarifications in this chat

This PRD is a separate planning handoff. It preserves the [existing audited PRD](prd-rso.md), audits, implementation checklists and task Pages. Creating it does not authorize implementation, provider transactions, data changes, publishing or deployment. Historical delivery evidence below comes from the supplied consolidation; it is not a new live acceptance check.

## 1. Introduction and overview

The Roster Schedule Optimizer (RSO) helps an in-season fantasy hockey manager turn a limited acquisition budget into useful, legal starting contributions during a matchup or custom date range. It combines roster-slot scheduling, candidate comparisons, goalie-minimum planning and a sequence of proposed moves. A recommendation must improve the manager's feasible lineup; adding scheduled NHL games alone does not establish a gain.

FORGE supplies qualified player and goalie forecasts. RSO uses them to evaluate roster decisions, and Start Chart provides consistent daily comparisons. Comparable forecasts must match player/game identity, horizon, cutoff and lineage. Team-goal research alone cannot supply the individual category contributions required by RSO, and acceptance of a separate team-goals model is not an RSO prerequisite.

The first controlled daily-lineup beta must include both free/manual and premium/Yahoo-connected users. It requires positive compatible real-data player/goalie consumption plus engineering and data-integrity acceptance. TJ's subsequent P3 decision permits a controlled beta with clear evaluation limitations while quality evidence accumulates; the initial evaluation sample is not a universal beta gate. Broader performance claims and model-weight changes need stronger untouched evidence. Weekly-lock support and the completed commercial lifecycle are additional full-launch requirements.

All recommendations are advisory. Yahoo integration is read-only; the manager performs any lineup change, acquisition, waiver claim or FAAB action in Yahoo.

### Definitions

| Term | Meaning |
| --- | --- |
| GP / scheduled opportunity | A player's team has a game in the selected range. This does not prove the player will appear or fit a starting slot. |
| AGP / active-game opportunity | A player-game fits verified eligibility, timing, capacity and lineup locks. Expected contribution still requires participation evidence. |
| Optimized no-acquisition baseline | The best feasible current-roster lineup found under the same context, constraints and objective, without new acquisitions. |
| Marginal gain | A complete plan's starts or supported contribution minus its optimized no-acquisition baseline, including displaced contributions. |
| Bench Games | Scheduled player-games attributed to missed starting opportunities. An occupied slot with no game is not a vacancy. |
| DUST | Player DUST describes marginal congestion; overall DUST rate is bench games divided by scheduled games. A zero denominator is undefined. |
| Conditional forecast | Expected performance if the player appears or starts. It is not an appearance-weighted contribution without supported participation information. |
| Lineage | The forecast's model/source identity and retained input evidence, including the cutoff known when it was produced. |
| Manager intent | Selected moves, protections, exclusions, preferences and explicit active/bench locks. |

## 2. Goals

1. Let a manager create, retain and resume one working plan for a league/team and matchup or timeframe, with the next legal action and its prerequisites visible.
2. Compare maximum legal starts with best supported projected outcome against the same optimized no-acquisition baseline. Every claimed gain must account for displaced starts and contributions.
3. Keep every actionable plan within verified eligibility, capacity, locks, transaction timing, acquisition periods, waivers, reserve rules and goalie requirements.
4. Preserve unknown categories, participation, availability and rules explicitly in every declared acceptance case.
5. Give free and premium managers equal planning outputs for equal canonical inputs; premium pays for connected upkeep and account-backed continuity.
6. Fit the desktop workspace, including navigation, in one viewport and show a maximum of 20 readable roster-slot rows in the schedule viewport. Verify 19-, 20- and 29-slot cases, including 1440×900, with overflow reachable by internal scrolling and usable mobile workspaces.
7. Clear beta and full-launch gates with genuine consumer, rule, continuity and UX evidence. Retain quality, uncertainty and performance measurements against predeclared evaluation protocols; distinguish controlled beta acceptance from broader performance claims.

## 3. User stories

- As a daily points manager, I want to compare usable starts and projected points so I can spend acquisitions on contributions that fit my lineup.
- As a category manager, I want to see banked results, remaining opportunities and category tradeoffs so I can pursue attainable categories and avoid wasteful moves.
- As a free manager, I want to search or paste my roster, resolve names, enter rules and retain one local workspace so I can plan without connecting a provider.
- As a connected manager, I want to inspect imported rules and availability with their sources so I can distinguish provider facts from my own assumptions.
- As a manager considering a drop, I want vacant and legal IR/IR+ capacity checked first, with my protected players respected, so I do not discard a valuable player unnecessarily.
- As a manager building a streaming sequence, I want costs, holds, effective dates and conditional later moves shown so I know what can be done now and what needs another availability check.
- As a manager below the goalie minimum, I want credited progress, confirmed starts and projected chances separated so I can choose coverage spending or accept the risk.
- As a returning manager, I want refresh, undo, reopening and account/context changes to preserve my choices while using the correct current provider authority.
- As a weekly-lock manager, I want week-long legal recommendations and a clear unsupported-state label until my rules are qualified.
- As a mobile manager, I want Itinerary, Roster, Candidates and Matchup workspaces so I can act on a readable plan on my phone.

## 4. Functional requirements

### FR1. Planning context and setup

The system must support matchup weeks, inclusive custom date ranges and midweek planning. Identify the season, provider, league, team, league timezone, selected dates and evidence time. Manual setup must support player search/paste, canonical identity resolution, unresolved names, actual slots, scoring and acquisition rules, with local progress retained.

Use authoritative league boundaries and distinguish acquisition resets from lineup locks. Charge an acquisition to its submission period and evaluate contributions from its effective time, including a legal Sunday submission effective Monday. Do not treat a current-week counter as verified future-week allowance. Optional opponent/scoreboard inputs must not require reconstruction of every league roster for useful schedule planning.

### FR2. Legal assignment and capacity

Use actual league slots and verified fantasy eligibility, including dual eligibility. Assign each player at most once per day. Preserve empty starting slots, lineup locks and manager-selected assignments; an NHL catalog position does not establish provider eligibility.

Before recommending a drop, check vacant roster capacity and legal IR/IR+ capacity. Show reserve prerequisites explicitly and respect the provider's supported reserve rules. Drop protection and active/bench locks are separate constraints. Preserve the released IR/IR+/NA handling where applicable; label unsupported IR-LT behavior rather than invent capacity.

### FR3. Comparable objectives

Present maximum legal starts and best supported projected outcome when they disagree. Use the league's scoring and actual startable marginal gains. Explain uncertainty, close comparisons and alternatives; do not apply a universal category blend or invent confidence from point estimates.

Prefer projected outcome only where credible forecasts and supported uncertainty justify that conclusion. Exact category-utility weights and tie-break thresholds remain open. The historical 65% example is not an approved accuracy threshold, objective weight or acceptance score.

### FR4. Baseline, marginal gains and explanations

Optimize the current roster before evaluating acquisitions. Compare complete alternatives against the same optimized no-acquisition baseline under matching context, scoring, constraints and evidence. Show displaced starts/contributions, acquisition cost, value sacrificed and uncertainty.

Scheduled GP alone must not determine value. Recommend no acquisition when no defensible improvement exists. Label bounded-search results as “best found” and disclose their limits; do not claim a global optimum.

### FR5. Timed streaming sequences

Support multiple streaming slots, week-long holds, successive occupants, add-only moves when capacity exists and explicit IR prerequisites. Evaluate each move against submission/effective dates, acquisition budgets and resets, roster capacity, waivers and locks.

Spend up to the remaining allowance; do not assume the full allowance must be spent. Distinguish the next actionable move from conditional later moves. Preserve a valid sequence prefix if a conditional suffix fails. Future candidate availability is not guaranteed.

### FR6. Candidate availability and rule authority

Separate executable free-agent paths, conditional waiver paths, exclusions and unknown availability. Current league evidence or explicit manager verification must establish addability. Public catalog membership, low ownership and absence from the user's roster do not establish availability.

Identify provider-verified rules, manager inputs/overrides and unknowns with their sources and observation times. Unknown rules or availability must block dependent actionable conclusions or be visible scenario assumptions. Retained/manual evidence must remain visibly unverified when current provider verification is unavailable.

### FR7. Ranked candidate alternatives

Provide **By Team** and **All Players** views, retaining the existing `candidateByTeam` / `AllPlayers` roles. Within displayed team/position groups, rank by usable model-projected points when supported. All Players must consider both actual AGP and projected points/outcome, with team and position filters; no fixed blend is approved.

Default to ten displayed alternatives, with five/ten/twenty choices. Use clear eligibility and availability headings, retain full legal eligibility and distinguish unknown from verified availability. Unsupported projected rankings must be labelled unavailable rather than filled with plausible values.

### FR8. Responsible drops and supporting context

Evaluate expendability using low active-game contribution together with low projected contribution. Ownership may be a fallback signal, but does not justify dropping a strong player. Respect the manager's protected list and never silently replace selected moves. Any automatic must-keep threshold remains a proposal.

Show hot/cold and opponent-context chips with sources and observation windows. Surface plausible slightly lower-projected alternatives when supported form or matchup evidence merits review. Do not invent multipliers or double-count information already reflected in forecasts.

### FR9. Category and matchup decisions

Use league-specific points scoring, supported category utility or supported matchup-win analysis. Incorporate banked results and remaining opportunity; explain categories within reach and categories that may reasonably be faded. Missing categories must remain explicit.

Combine banked and future numerators/denominators for SV% and GAA; do not average daily ratios. Zero-exposure ratios are undefined. Win-probability claims require credible uncertainty. Optional opponent analysis may contextualize competition for candidates, but another manager's likely intent remains speculative.

### FR10. Goalie minimum planning

Separate credited progress, confirmed future starts and projected opportunities. Verify and explain the provider's counted-event definition even though “minimum appearances” and “minimum starts” share the product concept.

Warn when the minimum is at risk. Let the manager choose coverage spending or accept risk, showing the skater opportunity cost. Use Mon–Thu / Fri–Sun windows by default and offer Mon–Wed / Thu–Sun. Count unique goalie options, confirmed starts and projected chances separately in each window; explain empty windows.

Consider remaining actionable dates and back-to-backs without presuming a backup rotation or counting competing goalies as two starts for one team-game. Explain ratio risk from extra starts after the minimum is met.

### FR11. Goalie evidence labels

Distinguish confirmed, expected/projected, unknown, disputed and stale evidence. Bind each confirmation to the correct player, team and game, with source time, authority, corrections and expiry. A probability threshold or assumed back-to-back split must not create a confirmed start.

### FR12. Workspace continuity and manager intent

Maintain one resumable working plan per league/team and selected matchup/timeframe. Free users retain one local workspace in the same browser/device. Premium users receive account-backed saved sessions and cross-device resumption.

Preserve selections, preferences, unresolved imports, exclusions, protections and explicit active/bench locks. Allow temporary objective comparisons. Refresh, undo, reopening and context/account switching must preserve manager intent while retaining correct current provider authority. Proposed repairs must be reviewable and must not silently replace selected moves.

Account saves must isolate owners and use optimistic concurrency: a save based on an older version must not overwrite a newer saved plan without conflict handling. Ignore late responses belonging to another context or account.

### FR13. Refresh and recalculation

Refresh connected read-only information on open/resume and while premium workspaces are active. Premium users receive automatic recalculation and proposed plan revisions. Free users recalculate after manual edits or on request.

Separate provider state, retained/manual inputs and manager overrides with clear provenance. Exact refresh frequency remains a proposal; a successful fetch does not refresh the age of an older forecast's underlying evidence.

### FR14. Honest degraded states

Distinguish fresh, stale, partial, fallback and unavailable states. Preserve saved workspaces when planning or access endpoints fail. Missing forecasts, unsupported categories, unverified eligibility and unverified participation must not become reassuring zeros, certainty or populated fixtures.

Keep supported schedule analysis available with explicit limitations. Do not display a complete available-player list or full projected comparison when the required coverage is incomplete.

### FR15. Shared forecast contract and acceptance

RSO and Start Chart must consume compatible player-level forecasts with matching games, horizons, cutoffs and model/source lineage for comparable outputs. Admission must establish canonical identity, cutoff-known inputs, supported categories/estimators, participation/exposure, coverage and provenance. Zero forecast rows or team-goal research alone do not satisfy acceptance.

The shared direction covers skater G, A, PPP, SOG, HIT, BLK, PIM and goalie SV, GA, W, SO, SV%, GAA where applicable. The selected acceptance case requests **G/A/PPP/SOG/HIT/BLK and W/GA/SV/SO**; PIM/GAA are excluded from that case. Do not silently add an unrequested category to its acceptance definition. Missing heads remain null with reasons.

Separate conditional performance from appearance-weighted contribution. Require supported full-game scope and named residual contributors when reconciliation needs them. Reconcile matching scope/lineage; do not mechanically distribute team goals into player projections. Preserve original forecast revisions and evaluate later revisions separately. Apply the input-specific freshness warnings and declared-comparison coverage in P1–P2. Numerical quality thresholds and remaining evaluation details require review under section 9.

### FR16. Connected provider and manual acceptance cases

Yahoo is the first connected provider. Keep provider-neutral boundaries that can accommodate Fantrax, but do not present compatibility as completed live integration. NHL identity/schedule records do not establish Yahoo eligibility, ownership, waivers, remaining acquisitions or locks.

Use the retained 19-player Yahoo case: **2026–27 FHFH**, league `477.l.125593`, team **FHFH TJ**, `477.l.125593.t.10`, season `20262027`, **October 12–18**, **America/New_York**. TJ confirmed **four weekly acquisitions and three minimum goalie starts**. Four is the weekly limit, not verified remaining allowance. Current allowance, progress/counting, eligibility, availability, waivers, locks and reserves still require actual provider acceptance. Include an independent manual/free case.

### FR17. Free, premium and commercial access

Free/manual and premium/connected users must share the same planning engine and equal recommendations for equal canonical inputs. Free includes manual/on-request recalculation and one local workspace with settings, selections and undo. Premium adds supported connected refresh, saved sessions, cross-device resumption and proposed plan revisions. Do not make free retention depend on a bookmark or deliberately degrade manual planning.

The first 100 Draft Pro customers receive in-season access through the end of June 2027. Draft Pro customers receive a common two-week season-opening preview. Patreon access is included. A one-time seasonal purchase is preferred; final price, branding, exact access boundaries and entitlement edge cases remain open.

Evaluate purchase, preview, grandfathering and eligible paid-active Patreon grants independently. Expiry of one grant must not revoke another valid grant. Expired access retains read-only saved snapshots and manual continuation without promising continued paid refresh. The historical $5.99 per-draft price is not an approved in-season price.

### FR18. Workspace interactions

Implement the desktop and mobile behavior in section 6. Every visible control must perform its stated action, including day/date selection, filters, alternative count, objective comparison, local add/remove/swap exploration, undo and workspace selection. Correct accidental `[object Object]` rendering. Keep action semantics clear while removing redundant planning meta-copy.

## 5. Non-goals

- Provider transaction execution, lineup submission, waiver submission and FAAB bid recommendations.
- A draft product, a separate RSO forecast engine or a broad rewrite of released scheduling/continuity work.
- Guaranteed future candidate availability, globally optimal bounded-search claims, inferred goalie confirmations or fabricated forecasts.
- A universal category blend, unapproved objective weights or promotion of production forecasting based on exploratory team-goal work.
- Fantrax parity as an initial-launch gate; additional providers need their own real-provider evidence.
- Multiple named itineraries, public sharing/export and out-of-session RSO notifications in the initial scope.
- Restarting stopped/paused work or treating this PRD as permission to change code, provider state or production.

## 6. Design considerations

### Desktop workspace

Fit a compact dashboard in one viewport including site navigation. Place **Current Roster left**, the **individual-player schedule center**, and **Available Players right**. Give the center priority without duplicating its weekly schedule in a side panel. Use a compact title/context strip, practical controls and an economical summary area. Panel bodies may scroll; keep headings and controls visible.

Schedule rows must represent individual roster players. Show fantasy slot, team logo and surname, Monday–Sunday date columns and GP. Order configured slot groups **C, LW, RW, D, UTIL, G, BN, then supported IR/IR+**. Respect actual league slots and visibly preserve vacancies. Playing-today ordering must not replace fixed slot order.

Show a **maximum of 20 visible roster-slot rows** in the schedule viewport, including vacancies and expanded Bench/reserve slots. Use the available height for readable bounded rows; all additional rows remain reachable by internal vertical scrolling. Cover 19-, 20- and 29-slot examples at **1440×900**. Smaller viewports may show fewer rows. A collapsed bench shows a player-count chip; membership remains accounted for. This confirmed correction supersedes the earlier at-least-20 density requirement.

Provide a Monday–Sunday snapping slider, clickable dates and keyboard controls. Select today when it falls in the viewed week, or Monday for a future week. Show that day's legal local lineup, retaining vacancies, locks and manager choices. Mute elapsed dates without hiding them.

Date headers show compact dates/slate counts and actual active/open lineup-slot summaries. Labels/tooltips must distinguish NHL games, scheduled players, fantasy starters and confirmed goalies. Keep itinerary context in the grid: selected-step adds/drops, costs, holds, prerequisites and conditional legs. Prioritize acquisitions used/planned/remaining, net AGP gain, supported matchup impact and goalie-minimum status.

### Styling and accessibility

Reuse the actual Draft Dashboard `SuggestedPicks.tsx` position-color mapping. Place schedule position labels **inside the genuine continuous colored left group border**, with font color matching the panel background for a cut-out effect. Keep C/LW/RW/D/G readable across the rail and rotate UTIL/BENCH vertically. Preserve a straight inner edge, rounded outer left corners and a thin matching group outline; rail width/radius may increase for readable internal labels. The earlier literal 10 px rail/outside-label direction is superseded. Preserve relevant summary-card geometry. Avoid pseudo-border overlays, beveled tips and fragmentary borders.

Retain the dark, dense FHFH analytics style, restrained cyan accents, readable condensed labels, aligned numbers and current tokens. Preserve text/logos, sticky headings, visible keyboard focus and meaning beyond color. Historical mockups must not override the confirmed layout and border decisions.

### Mobile workspaces

Default to **Itinerary**, with **Roster**, **Candidates** and **Matchup** as alternatives. Provide a compact date selector and readable sequence; seven-day comparison may be an alternate view. Let the selected workspace scroll normally. Preserve the workspace model rather than stacking desktop panels into one long page. Desktop viewport constraints must not reduce phone usability.

## 7. Technical considerations

Reuse the shared planner, schedule cache, provider-neutral adapters, entitlement capabilities and workspace reconciliation. Keep canonical identity, exact context and input provenance separate from selected intent and suggested repairs. Cancel stale calculations and suppress late provider/save responses. Before future implementation, inspect active ownership and preserve concurrent checkout work.

The supplied source names `octoberBranch` in `/Users/tim/Code/fhfhockey-october` as its working checkout. This documentation deliverable is in `/Users/tim/Code/fhfhockey.com`; that does not establish those checkouts as equivalent or choose an implementation checkout.

### Historical delivery snapshot and remaining evidence

| Area | Reported source evidence | Remaining acceptance |
| --- | --- | --- |
| Core engine, continuity and rules | Reviewed timing, baseline, sequence and category fixes in production; historical 264-test/five-browser receipt | Actual startable gains, live connected rules and native consumer readbacks |
| Reserve handling | Released IR/IR+/NA capacity correction | IR-LT unsupported; actual provider acceptance open |
| Compact schedule and borders | Local internal-label/max-20-slot engineering and 19/20/29-slot desktop/mobile fixture evidence; independent written-requirement review complete | Original-reference fidelity remains unverified; broader product acceptance |
| Selected October 12–18 schedule | Approved refresh at October 9 15:44:31.111 UTC; independently checked 100 team-game sides / 50 games, zero deletions and unchanged neighboring rows | Freshness bound and other horizons are separate |
| Production release | Reported verified `ca81578afdae9b85643aee2c4d87d3ded3099c75`, production/October preview READY, four CI checks and 278 focused tests; includes schedule truth, PPP accounting and goalie labels | Native forecasts, beta acceptance and two inherited database-audit failures remain open |
| Local audit | `e5d967dba4f757b51ad1c90bb82b139fb21863ca`: no committed post-production RSO-scope difference; uncommitted presentation/tests present | Uncommitted work is not established as accepted or deployed |
| Native offline harness | `46f7229e5` repaired four original findings; fictional isolation/reproducibility verified | `fetched_at` cutoff omission found; repair/recheck ongoing in source snapshot; genuine participation and full-game/goalie inputs still blocked |
| Product gates | Daily-beta scope and real-forecast gate agreed | Positive compatible player/goalie revisions, selected-provider acceptance, UX/performance and access; weekly locks/commercial lifecycle for full launch |

The source reports repaired RSO `2630a3377`, re-review `acac5439e` and border `c1dbea8a0` as production ancestors, including later evidence-binding changes. Older local-only/unreleased labels are superseded by that reported snapshot. The audit did not perform a fresh fetch or new live-provider acceptance. Historical health gaps, schedule-only results, disabled forecasts and 503 endpoints require current rechecks; they do not prove every present request fails.

### Dependency order for future authorized work

1. Repair and independently recheck the offline cutoff defect, covering each supported timestamp before, exactly at and after `asOf`. Harness correctness is separate from genuine forecast qualification.
2. Qualify a genuine player/goalie path with lawful, timestamped inputs, participation, coverage and lineage. OTT–NJD catalog records for Jack Hughes/Jake Allen are leads, not selected-team availability evidence.
3. Approve freshness/acceptance bounds and verify compatible positive RSO/Start Chart readbacks. Keep unsupported heads unavailable; do not wait for unrelated team-goal promotion.
4. Complete the actual selected-team rule/availability matrix. Reuse the completed schedule refresh unless a concrete freshness or scope need justifies another refresh.
5. Verify workspace continuity, marginal objectives, drops, goalie risk, both tiers and mobile behavior. Serialize shared-component changes.
6. Present exact release scope, genuine evidence, measured performance and limitations for controlled daily-beta acceptance.
7. Complete weekly-lock and commercial gates before full-launch acceptance. Qualify additional providers separately.

### References

- [Existing audited PRD](prd-rso.md), [RSO audit](rso-audit-2026-10-08.md), [implementation checklist](../tasks-prd-rso.md), [compact-layout amendment](rso-compact-layout-amendment-2026-10-09.md) and [compact-layout checklist](../tasks-rso-compact-layout-2026-10-09.md).
- [September workflow/access decisions](https://chatgpt.com/c/6ab87c84-55e4-83e9-9e5f-c23c3a857cc1?messageId=70025017-be1e-45d2-a7a2-2cc6fd3a04f5), [October UI decisions](https://chatgpt.com/c/6ac98424-7d34-83ea-9071-8778922b583e?messageId=b04c2ec5-f4fd-418a-b2ff-437261ff737f) and [seasonal purchase preference](https://chatgpt.com/c/6ababe14-f5b4-83ea-ae11-dff1b01fc203?messageId=713fc9b3-82d4-44ea-83e0-d72dd18aa33e), as referenced by the consolidation.
- [FHFH Master Task List](https://chatgpt.com/space/page_227f33dd9ed48191b1b2631bf6c4204c) and [project priorities/progress](https://chatgpt.com/space/page_d8755e5b1fc4819180b99b8a1286fc8a), as referenced by the consolidation.

These references do not imply exhaustive historical coverage or current live qualification. Recheck exact revisions before operational or release decisions.

## 8. Success metrics and acceptance criteria

### Required controlled daily-beta evidence

All of the following must pass. P1's provisional ages are warning thresholds, and P3's sample is an initial evaluation milestone; neither is an automatic rejection limit or universal beta gate. Other proposed numbers become gates only after explicit owner approval.

| Gate | Observable pass condition | Required evidence |
| --- | --- | --- |
| Genuine forecast consumption | Compatible player/goalie revisions reach both RSO and Start Chart for matching game/horizon/cutoff/lineage, with input-specific freshness and material-status checks; missing heads and participation remain explicit | Retained genuine inputs, forecast revision/lineage, complete declared comparison or explicit narrowing/exclusions, and positive consumer readbacks; fixtures or zero rows do not pass |
| Legal connected and manual plans | Selected Yahoo case and a manual/free case handle eligibility, allowance/reset periods, timing, locks, waivers, minimums, vacancies, protection and supported reserves | Actual provider evidence plus deterministic edge cases, including Sunday-to-Monday timing and independent lock/reset periods |
| Honest marginal objectives | Maximum-starts and projected-outcome alternatives use the same optimized no-acquisition baseline and league scoring; no GP-only inflation or invented category blend | Reconciled baseline/alternative starts and contributions, displaced value, costs, uncertainty, missing data and no-beneficial-move cases |
| Continuity and tier behavior | Refresh → undo → reopen and context/account switching preserve intent and current authority; free/manual and premium/connected behavior matches FR12–FR13/FR17 | Both-tier workflows, owner isolation, conflicting saves, late-response suppression and equal-input output comparisons |
| Workspace usability and performance | Desktop 19/20/29-slot cases fit the specified frame with at most 20 visible slot rows and reachable overflow; keyboard/touch and mobile workspaces function; unknown/partial/empty/error states remain honest | Browser evidence and measured real workloads, with search limits and owner-reviewed targets disclosed |
| Release acceptance | Exact scope, deployment and live readbacks independently checked; both tiers covered; unsupported weekly-lock leagues clearly labelled | Release evidence, remaining limitations and an explicit owner beta decision |

### Full-launch additions

Full launch also requires accepted weekly-lock behavior, the completed commercial/entitlement lifecycle and remaining supported-rule/provider acceptance. Full Fantrax parity is not an initial-launch gate. Passing review, deploying visual fixes or passing synthetic tests does not waive either launch gate.

### Measurements to retain

- Claimed versus independently reconciled legal-start and projected-category deltas, including displaced contributions and acquisition use.
- Coverage by required category/player-game, participation status, forecast age and compatible-revision consumer readback rate.
- Per-category forecast error against frozen, cutoff-safe outcomes and a declared baseline; uncertainty and sparse outcomes reported separately.
- Workspace preservation and equal-input parity results for both tiers, including degraded access and concurrent saves.
- Desktop/mobile acceptance results, calculation latency distributions, refresh failures/staleness, workload size and bounded-search completion status.
- Purchase/preview/grandfathering/Patreon grant outcomes, additive-grant behavior and expired snapshot/manual continuation.

No conversion-rate, forecast-accuracy, latency or load target is approved by this PRD. Section 9 records TJ's revised P1–P5 direction and keeps remaining numerical and commercial choices visible.

## 9. Open questions and proposed defaults

**Decision register:** TJ revised P1–P3 and confirmed the category/drop direction in P4–P5 during checklist execution. Those decisions below supersede the original proposals. Unapproved details remain labelled; P6–P12 are still recommendations for review. No policy decision is evidence of completed implementation or acceptance.

### Forecast freshness, coverage and numerical acceptance

**P1 — Input-specific freshness (revised direction confirmed).** Report model-fit age separately from schedule/game-status, roster, injury and goalie-confirmation age. Use **six hours**, or **two hours near puck drop**, only as provisional warnings for relevant time-sensitive inputs, measured from the underlying evidence rather than the latest reader fetch. For this PRD, **near puck drop means a covered upcoming game's start is between zero and 120 minutes after the forecast issue time**. Recheck material news and game status before issuing a forecast; disclose missing rechecks and unknown input age. These warnings are not universal hard rejection limits, do not impose a model-fit TTL, and do not override an authoritative revision's explicit expiry, correction, permission or scope restriction. Source-specific warning tuning and recheck mechanisms remain engineering/evaluation work.

**P2 — Declared comparison coverage (revised direction confirmed).** Require complete coverage of the players, games and categories included in each claimed comparison, with supported participation/exposure. An explicitly narrowed comparison is permitted when coverage is partial: name its included scope, show exclusions and withhold any recommendation whose result depends on missing data. Never fill missing projections with zero. The requested six skater/four goalie categories remain the full-case target, but are not required for every explicitly narrower claim. Independent schedule guidance remains available without pretending missing statistical heads are supported.

**P3 — Evaluation milestone (revised direction confirmed).** Retain frozen pregame revisions across at least **14 distinct NHL slates**, **500 skater player-games** and **100 goalie starts** as an initial evaluation milestone, retaining the predeclared population and eventual nonparticipants. Predefine chronological holdouts, cutoff-safe baselines and category-specific error/calibration checks before examining outcomes. Report uncertainty, coverage and sparse/rare-event limitations. This sample is not an automatic pass/fail threshold or universal beta gate. A controlled beta may proceed after engineering and data-integrity acceptance, with clear limitations; broader performance claims require stronger evidence. Model-weight changes require support from a larger untouched evaluation set. Exact holdout boundaries, baselines, category-specific metrics and numerical claim thresholds remain to be declared and reviewed.

**P3a — Evaluation protocol draft (proposed defaults; approval and artifact binding pending).** The following makes P3 reviewable; it does not approve an accuracy claim, model change or release. No evaluator or producer is changed by this draft.

- **Population and chronology:** For prospective qualification, freeze a protocol revision, authorized source/permission manifest, model/baseline versions, cutoff selector, declared forecast horizon and eligible player-game population before outcomes become known; freeze each actual forecast at its pregame issue/cutoff. Keep every revision for one NHL game in the same chronological partition and report each cutoff series separately. Retain eventual nonparticipants, missing forecasts, cancelled/rescheduled games and unresolved outcomes with explicit statuses; an absent outcome or projection is never a zero. Use the accepted first 14-slate/500-skater-player-game/100-goalie-start milestone for diagnostic reporting. Propose the **following 28 chronological slates**, reaching **1,000 skater player-games and 200 goalie starts**, as a larger untouched evaluation reference. Do not inspect its outcomes while selecting models/metrics. These larger numbers are proposals, not sufficient evidence by themselves or beta gates. Freeze exact dates and counting rules after an authorized issuance path exists, before outcomes become known. Held-out forecast errors must use later observations rather than fitting residuals. [Forecasting: Principles and Practice](https://otexts.com/fpp3/accuracy.html).
- **Cutoff-safe baseline:** Prefer the existing admitted player/goalie rate baseline when available, with its exact algorithm and input snapshot frozen before outcomes. Match player/game, horizon, cutoff, membership and target semantics. Use only supported participation/exposure, applying it once according to the declared basis; never substitute team-goal research for player forecasts. A later baseline replay must be labelled as a replay from frozen inputs, and cannot stand in for the genuinely pregame-issued model forecast. Missing baseline heads remain coverage gaps and cannot support a paired skill claim.
- **Category-specific checks:** For published mean forecasts, propose **mean squared error** as the primary score; report mean absolute error and signed bias as diagnostics in each category's native units. Select a matching score first if a forecast declares a different estimand. Evaluate ratio numerator/denominator components separately and recompute full-horizon ratios only with known positive exposure; retain undefined ratios. Do not average unlike category errors into an overall accuracy grade. Squared and absolute error target different point forecasts, so the score must match the forecast's stated target. [Making and Evaluating Point Forecasts](https://arxiv.org/pdf/0912.0902).
- **Participation/calibration:** For actual issued appearance/start probabilities, propose **Brier score** and reliability bins of width **0.1**, with sample counts, mean forecast, verified event frequency and uncertainty. Match the stated event: a start, an appearance and credited minimum progress are distinct. Score the immutable issued probability; record admitted confirmation separately. Keep missing event evidence explicit. Do not infer joint category-win probabilities or predictive intervals from point means.
- **Uncertainty and claims:** Predeclare the named primary categories and cutoff-series claims, and review multiplicity and repeated-look treatment before examining outcomes; no correction or additional numerical default is selected here. Propose **2,000 paired slate-block bootstrap resamples** and nominal **95% intervals** for category-specific model-minus-baseline score differences; keep all player rows of a slate together and report dependence, sparse-event and effective-sample limitations. Block design and calibration uncertainty need review before use. As a concrete claim default for review, require the untouched, scope-complete paired comparison's interval upper bound to be **below zero** for the named primary mean-loss score; otherwise report no demonstrated improvement. This is a proposed evidence rule for a specific claim, not planner utility, a statistical-equivalence rule, the 5% points display, a universal pass/fail grade or automatic authorization to tune weights. The controlled-beta direction in P3 remains unchanged.

**Still open:** authorized issuer/packet, exact population dates and cutoff/counting rules, baseline artifact/version, ratio/event semantics, resampling design, primary claim/multiplicity/repeated-look policy and owner approval of the proposed sample/metric/claim defaults. Freeze these before prospective outcomes become known; no fictional or reconstructed forecast closes the evidence gap.

### Category comparisons and protection

**P4 — Category utility and comparison display (direction confirmed; equivalence tolerance open).** Use actual startable plan outcomes under the league's scoring and the same horizon/baseline. Show supported per-category gains/losses and alternatives without an automatic blend. **5%** is approved only as a clearly labelled provisional **“similar projected points”** display rule, never a confidence interval or automatic decision threshold. Its denominator is the larger absolute supported plan total; normalize each total by that denominator before taking their difference to avoid subtraction/division overflow or underflow. Two known zero totals are equal; missing/nonfinite totals are not comparable, and signed totals retain their signs. Display the absolute point difference as well so tiny totals do not imply a meaningful gain. Prefer fewer acquisitions only when supported outcomes are otherwise equivalent under a separately declared numerical tolerance. That tolerance remains open; show gain and acquisition cost for meaningful tradeoffs. Category weights and inferred must-keep rules require separate approval.

**P5 — Drop protection (direction confirmed).** Keep automatic must-keep protection **off** and respect explicit manager protections. Check legal vacant slots and IR/IR+ capacity before recommending a drop, and preserve manager-selected moves. Drop protection and lineup locks remain separate constraints. Category weights or inferred must-keep rules need a separate approved policy; ownership alone must not become drop permission.

### Performance, refresh and workload

**P6 — Latency and bounded search.** Propose **p95 ≤2 seconds** for optimized no-acquisition calculation and **p95 ≤5 seconds** for a proposed streaming plan, measured from calculation request to usable result. Start evaluation with 19/20/25-player rosters, 7- and 14-day horizons, up to 250 verified candidate records and a four-acquisition limit. Propose a **20-second search ceiling** that returns a valid best-found result or an explicit incomplete/unavailable result while preserving the workspace. This is a declared test workload, not a production candidate cap or permission to shorten horizons. Measure genuine workload distributions before approval.

**P7 — Connected refresh frequency.** Propose refresh on open/resume and every **five minutes while the premium workspace is visible**, plus revalidation before presenting a stale candidate path as currently actionable. Pause periodic polling while hidden; after failure, back off to **15 then 30 minutes**, showing stale/unknown state. Free recalculation remains manual/edit-triggered or on request. Review provider limits and actual freshness needs before adopting the cadence; polling does not extend forecast validity or guarantee future addability.

**P8 — Load and usability measurement.** Start with **ten concurrent active workspaces** under the P6 workload and retain p50/p95 latency, request failures, cancellation and staleness results. Add a **390×844 mobile acceptance viewport** alongside the confirmed 1440×900 desktop case, preserving keyboard/touch behavior and normal workspace scrolling. These are proposed initial measurement conditions, not proven capacity or a production SLA; approve a broader load target from actual usage.

### Seasonal access, pricing and entitlement edges

**P9 — Price.** Propose **$9.99 for one seasonal purchase** as an owner-review pricing hypothesis. No market validation, revenue forecast or agreement is implied, and the historical $5.99 Draft Pro price remains separate. TJ must approve price and what the package includes before commercial implementation.

**P10 — Package name.** Propose **FHFH In-Season Pro**, with RSO/Start Chart inclusion stated explicitly if that bundle is approved. Keep branding open until the owner approves the commercial scope; do not rename existing products based on this proposal.

**P11 — Time boundaries.** Propose **America/New_York** for commercial access. End season access at **July 1, 2027, 00:00**, making June 30 inclusive. Start the common preview at **00:00 on an owner-declared season-opening date**, ending exactly 14 days later; a late purchaser receives the remainder of the common window. This must not invent an official NHL opening date. Exact product start date, purchased-season term and timezone require approval.

**P12 — Cohort and grant edge cases.** Propose counting **unique customers**, using the earliest qualifying successful non-refunded Draft Pro purchase, and freezing an owner-reviewed first-100 cohort before issuing grants. Duplicate purchases do not count a customer twice. Treat Patreon qualification as eligible paid-active membership, subject to owner-approved tiers and identity matching. A refund/chargeback or membership lapse removes only the affected grant after authoritative reconciliation; another valid preview, purchase, grandfathering or Patreon grant preserves access. Do not silently substitute a new grandfathered customer after a cohort change. Confirm late/refunded purchases, cancellation timing, identity conflicts and cohort corrections with TJ. Expiry retains read-only snapshots and manual continuation as already confirmed, with no ongoing paid-refresh promise.

### Evidence gaps to resolve through qualification

These are engineering/provider evidence gaps, not requests for TJ to guess provider facts: genuine cutoff-known player/goalie inputs and participation; positive compatible consumer revisions; selected-league eligibility and availability completeness; counted goalie progress; remaining acquisitions/resets, waivers, locks and supported reserves; actual account/access lifecycle; weekly-lock qualification; and real-workload UX/performance. The offline timestamp repair establishes harness correctness only. No genuine forecast, beta or full-launch gate is closed by this document.
