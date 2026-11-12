# Owner intent: sKO and VuDu

**Owner:** TJ  
**Reconstructed:** 2026-11-11, from TJ's accessible conversations and recorded owner decisions  
**Purpose:** Supply the missing owner-intent input for `wave3-prompts/w3-7-sko-vudu.md`. This is a reconstruction of existing intent, not a new model proposal, a mathematical validation, or permission to change production.

## 1. The controlling definition

**sKO is the skater sustainability barometer. VuDu is its goalie counterpart. They assess whether a player's current level of performance is supported and likely to persist relative to that player's own established baseline.**

The question is not merely “was he lucky?” It is: **What is he doing now, how unusual is it for him, what supports or undermines it, and what evidence says that level can continue or change?**

TJ's direct definition was: “Sustainability is defined (to me) as the ability to persist in a current level of performance and play.” His current recorded decision 32 adds the own-player baseline, process, opportunity, uncertainty and validation requirements. Luck is one component. Neither a luck-gap-only score nor a generic quality/consistency ranking satisfies the whole definition.

### Authority and use

- **Binding owner intent:** the direct statements and explicit choices cited here, together with the current `OWNER-DECISIONS.md`. This file makes those requirements available in one place; it does not replace or silently amend the numbered decisions.
- **Product interpretation:** where this file translates those requirements into an audit test, it says so. Existing PRDs and implementation contracts corroborate the intended direction but are not proof that their proposed formulas were approved or validated.
- **Research hypotheses:** candidate features, regression methods, weights, thresholds, bounded transforms and historical experiment designs remain hypotheses unless separate evidence establishes adoption and validation.
- **Unresolved choices:** listed in section 9. Do not invent an owner decision to close them. They do not prevent auditing arithmetic, units, labels, data lineage or compliance with the requirements already settled.
- The current recorded decisions control over an older prompt. In particular, the October 2026 10-team-game forward horizon supersedes earlier illustrative five-appearance horizons, and current holdout rules supersede old proposed season splits.

## 2. Which of the four “sKO” things is canonical?

**The canonical product meaning is the sustainability interpretation described above and embodied by the intended Sko Element product. No existing formula becomes canonical merely because its name contains sKO.** The code must be audited against the owner's goal, not the goal rewritten to match the code.

| Existing name or family | How the audit should treat it |
| --- | --- |
| Legacy predicted points × stability sKO | Historical/quarantined implementation. It mixes expected quality with a preference for steadiness. It is not the current definition and must not be reinstated merely to resolve the naming collision. Audit any actual arithmetic or label defect, with its reach stated. |
| The Sko Element contract | Current intended product framework: player-specific production, support, opportunity and uncertainty, with separate skater and goalie interpretations. Its fixture implementation and pending adapters are not themselves a qualified complete metric. |
| Sustainability “sKO score model v3”, including `s_raw`/`s_100` | An existing calculation to assess, not the binding formula. Decision 32 explicitly says **do not preserve the current blended formula**; its inputs and weights must earn their place through evidence and out-of-sample tests. |
| `combineSKO` and other helpers | Implementation components with their own contracts and consumers. A helper name cannot establish the product definition, scientific validity or approval of a combined score. Trace what it actually computes and where it is used. |

This resolves the conceptual naming question without falsely selecting an unvalidated numerical implementation. The exact final sKO/VuDu equation remains to be established. **An implementation can be mathematically sound for a narrow diagnostic and still be incomplete or mislabelled as the whole sustainability metric.** Conversely, a descriptive diagnostic does not become mathematically wrong simply because it has not demonstrated predictive value.

TJ explicitly requested an intent document independent of implementation bias on 2026-11-03: “this is what we set out to do, check to make sure we're doing that.”

## 3. sKO: the skater contract

### 3.1 Questions it must help the manager answer

1. **Current state:** Is recent production above, below or near this player's appropriate normal/expected level? By how much, over which games and in which units?
2. **Support:** Does chance creation and underlying play support the production, or is conversion running ahead of or behind that evidence?
3. **Opportunity:** Has ice time, line assignment, power-play role, availability or surrounding opportunity changed? Could the new level persist, reverse or fluctuate?
4. **Duration:** How long has the observed condition lasted under a stated rule? This is different from predicting how long it will last.
5. **Forward research:** Which signals add evidence of continuation, positive regression, negative regression, or the start/end of a hot or cold stretch?
6. **Evidence strength:** What is known, missing, stale, incompatible, sparse or unvalidated? How much uncertainty accompanies the interpretation?

A player can be excellent but temporarily overproducing, consistently poor, or expected to cool while still having a better outlook than before a promotion. These are different states, not contradictions to collapse into one “good/bad” score.

### 3.2 Opportunity belongs inside the question

TJ's explicit correction was **“Distinguishing, but not discounting or disqualifying”** a changing opportunity. A promotion is not grounds to discard a player from sustainability analysis. It may create a genuinely higher supported output; the durability of the promotion is itself uncertain and relevant.

Likewise, reduced ice time may explain declining production without proving deteriorating ability. Show the distinction between performance supported by a new role, unusually efficient conversion, and a fragile role. Do not assume every role change is permanent, nor subtract it away as irrelevant noise.

### 3.3 Evidence and classes

- Use the player's own established history, not only distance from the league average. A repeatably strong finisher should not be called lucky solely for exceeding league shooting percentage.
- **Forwards and defensemen need separate classes.** TJ specifically named IPP as a reason. Position, strength state and opportunity matter to the interpretation.
- Production, individual process, on-ice/team context, conversion residuals and opportunity are distinguishable evidence. Historical research requests mention goals and assists separately, raw NHL points, fantasy points, Game Score, shot/chance creation and deployment.
- Those are candidate families, not an instruction to add every correlated input to one formula. Counting goals, shooting percentage, IPP and related residuals repeatedly can double-count the same evidence.
- A model residual is not automatically proven luck. It can contain omitted role/context, measurement error or model bias.
- Do not convert “steadier” into “better” through an unexplained volatility penalty. Quality, observed variability, future outcome spread and uncertainty about the estimated mean are different concepts.

### 3.4 Single-number ambition, without a false shortcut

TJ repeatedly requested a distilled novel metric and a quick-glance barometer. That ambition remains. A clear summary should retain visible component evidence, sample/coverage and uncertainty; it must not hide material disagreement between production, process and opportunity.

No final backronym, exact equation, coefficient set, fixed neutral value or score range was conclusively adopted in the recovered record. “Sustainability KPI Overview” is historical; TJ later said he disliked the acronym. Retain the familiar sKO name without declaring a new expansion official.

## 4. VuDu: the goalie contract

**VuDu asks the same support-and-persistence question using goalie-specific evidence. It is not the skater formula with different column names, not just a save-percentage gap, and not an assertion that all goalie performance is random.**

The name and construct evolved. TJ first used VuDu in July 2025 for drafted-player fantasy volatility generally. By October 2026 he explicitly assigned sKO to skaters and VuDu to goalie sustainability, invoking “Goalies are Voodoo.” The latest definition governs; the original interest in volatility remains relevant context.

### 4.1 Required distinctions

- **Shot volume/workload:** how often he is expected to play and how many shots/minutes he faces.
- **Shot danger/environment:** quality of chances allowed and team defensive context, including team xGA where it provides non-duplicated information.
- **Stopping performance:** observed results versus a compatible expected stopping baseline, with sample size and model limitations.
- **Opportunity:** starts, relief appearances, no appearance, role changes and the persistence of workload.
- **Team support and outcomes:** the goalie's own win/decision chance is not simply the team's win probability. Team scoring/support can matter without being labelled goalie talent.
- **Variation and uncertainty:** distinguish observed inconsistency from uncertain skill estimates and the distribution of future outcomes.

TJ explicitly requested separating “shot volume, shot danger and stopping ability,” warned that adding team xGA again could double-count the environment, and rejected unblocked-shot xG divided by on-net shots as a calibrated expected save percentage.

### 4.2 Mathematical and data meaning

These are audit consequences of the intended comparisons and the recorded decisions, not a newly chosen goalie model:

- Keep event populations compatible. On-net save probability compares with saves/on-net shots; an unblocked-attempt model needs a justified conversion, not a changed denominator by convenience.
- Pool saves and shots for SV%, and goals against and playing time for GAA. A mean of per-game ratios is not the same quantity. Missing exposure is not a zero rate.
- Keep guarded-net, empty-net and extra-attacker concepts explicit; do not attribute team empty-net events to an absent goalie.
- Distinguish a conditional next-start line from an unconditional projection over scheduled team games. Decision 63 includes start and relief contributions, no appearance, shrinkage and uncertainty; until qualified, any omitted relief term must be disclosed.
- Wins, regulation losses, overtime losses and no-decisions use the actual credited definitions. They are not inferred from “appeared” or “games minus wins.”
- GSAx or similar residuals are relative to the particular xG model and event universe. Do not label them pure skill or pure luck.

A valid native-unit save-gap diagnostic can be useful without completing all of VuDu. A fixture-supplied expectation or a pending adapter does not demonstrate a live validated goalie metric.

## 5. Baselines, windows and time

Apply decisions **33, 34, 61 and 68** together:

1. **Player baseline:** only information available before the evaluated window. Prior completed seasons and, when appropriate, earlier current-season games may contribute. The judged games cannot also form their own baseline.
2. **Recency and shrinkage:** reflect relevant evidence and sparse histories, with weights/methods validated rather than invented. Rookies get peer-informed expectations with limited-history labels and uncertainty, not false precision or fabricated zeros.
3. **Default descriptive window:** current season, showing the actual n when fewer than N games exist. Offer a distinctly labelled across-seasons last-N view with seasons/dates/sample visible. Calendar L7/L14/L30 is not “last 7/14/30 appearances.”
4. **League reference:** a separate versioned, pre-window snapshot with position and metric-specific exposure qualifications. Record source seasons, cutoff, sample and version. Do not substitute league quality rank for the player's own sustainability baseline.
5. **Usual range:** expectation for a window of this size, accounting for exposure and uncertainty. Hot/cold means observed results are meaningfully outside that range. Whether the stretch is supported is a separate process/opportunity question. A range is not “predictive” until its later held-out coverage supports that claim.
6. **Forward horizon:** TJ chose the player's next **10 scheduled team games**, with **5 and 20** alternatives. These are not guaranteed player appearances or goalie starts, and are not a team-total prediction. Keep this forward horizon separate from the recent window used to judge current form.
7. **History and freshness:** historical views must use what was available at the time. Issued forecasts and retrospective reconstructions are different. The nightly/current-performance goal does not authorize this audit to create a cron or activate an unserved pipeline.

A prior five-game block may be a useful local comparison, but by itself is not proof that a system has implemented the established, context-aware player baseline TJ described.

## 6. Outputs, consumers and product boundaries

### Intended user and surfaces

The primary user is a fantasy hockey manager seeking an understandable, evidence-backed view of current performance and forward risk. TJ explicitly chose two distinct end products:

- **The Sko Element:** the sustainability dashboard, with forward, defense and VuDu goalie views. It should explain current production, expected/comparable performance, support, opportunity, variability and uncertainty without needing a market price.
- **Buy Low / Sell High:** a separate stock-market-style research/workflow page, initially watchlists and manager-entered trades. It can consume qualified sustainability evidence, then add league value and an explicit market reference. It must not turn a hot/cold signal or popularity into demonstrated mispricing.

Trends-style views and player cards are also requested presentation contexts. These are intended consumers, not a claim that each is implemented or live. The auditor must verify actual route/caller reach independently and label live, conditional, dormant, quarantined or research behavior accurately.

The October plan keeps FORGE as the canonical forecast engine and Sko Element as a read-only interpretation layer over compatible accepted outputs. This is an architectural direction, not approval of today's FORGE data or its calculations. The retrospective BLSH scorer is a separate path; do not assume every BLSH score reads FORGE. Do not create a competing forecaster inside an interpretation helper merely to fill missing inputs.

### Honest display contract

Show, where supported: the target/stat and units; recent value; relevant baseline or expected value; signed difference; observed duration; process and opportunity context; source/cutoff/version; and sample, coverage and uncertainty.

A natural-unit **expected minus observed** gap is the previously agreed diagnostic direction: for higher-is-better production, positive means rebound/underproduction relative to expectation and negative means cooling/overproduction. A lower-is-better quantity needs explicitly favourable orientation. This gap is one component of the broader definition, not a substitute for process, role stability or a validated persistence assessment.

The PRD's `100 × tanh(D / s)` and similar bounded scores are **unvalidated display proposals**, not owner-approved formulas. A score is not a calibrated continuation probability, a talent percentile, confidence, trade value, or a number of games until regression. No definitive scale or coefficients are selected by this file.

Decision 35 controls recommendation language: descriptive luck or unusualness alone is never “trust,” “fade,” “buy” or “sell” advice. A failed forward test limits predictive/actionable claims; it does not automatically refute an honestly labelled retrospective measurement.

## 7. Research standard: what TJ asked to discover

TJ's repeated research request is broader than checking whether existing code executes:

- Establish player-specific normal performance and examine sustained high/low stretches.
- Study **before, during and toward the end** of hot and cold stretches, separately, rather than only correlating inputs with the same results used to define the streak.
- Examine raw points, fantasy points and Game Score as distinct targets, with their units and definitions preserved; any combined assessment requires justification.
- Investigate which process, conversion, deployment and contextual measurements add information about continued output or positive/negative regression.
- Test alternative windows, baselines and recency treatment without treating the illustrative choices as settled coefficients.
- Keep skater and goalie models distinct. Explore F/D differences and goalie volume/danger/stopping separately.
- Distinguish association from causation, contemporaneous description from precursor information, and a researched hypothesis from validated performance.
- Compare against appropriate simple baselines on genuinely untouched, time-appropriate data. Freeze cutoffs, identities, policy and source versions so claims are reproducible. Do not reuse consumed holdouts as fresh evidence.
- Evaluate mean forecasts with proper scores under decision 65; MAE is secondary. Evaluate the final issued/served quantity, compatible populations and fantasy decision effects, not only an intermediate fit.

In October TJ described his own weighted-correlation outline as **“not an authoritative list, it is only my hypothesis and first guess.”** No correlation ranking, survey preference, model coefficient or proposed backronym should be converted into a binding numerical rule here.

## 8. How w3-7 should proceed using this file

1. Audit now against this reconstructed intent and current numbered decisions. The missing owner-definition prerequisite is supplied; no need to classify everything undetermined simply because the final novel formula is unfinished.
2. Separate three judgments: **arithmetic/contract correctness**, **fit to owner intent**, and **evidence supporting a predictive claim**. Report each without conflating them.
3. Trace each named implementation to its actual inputs and consumers. Preserve provenance and version boundaries; do not call fixtures live data or an imported unused helper a user-visible defect.
4. Check units, populations, strength states, pooled exposure, non-overlapping baselines, signs, missing-versus-zero behavior and actual output labels. Existing tests using convenient fixtures do not establish real-input semantics.
5. Assess whether the interpretation preserves opportunity changes, F/D separation, goalie workload/stopping distinctions and the broader support question. Identify missing requirements as incompleteness with stated reach, not as a newly invented coefficient defect.
6. Read and apply the required upstream Astra corrections in the w3-7 prompt. Keep evidence-supported descriptive metrics separate from failed or untested predictive extensions.
7. For a question that truly depends on an unresolved final numerical design, mark **that judgment** undetermined and state exactly what owner choice or empirical evidence would settle it. Continue the rest of the audit.
8. Follow the original audit's read limits and output scope. This file authorizes no code changes, new model training/data collection, migrations, activation, cleanup, repairs, registry changes or deployment.

## 9. Genuinely open, not silently decided here

- **Final summary design:** how should the one-number ambition combine or coexist with the separate gap, process, role-persistence and uncertainty evidence? No exact composite is established by the recovered record.
- **Final numerical scale and coefficients:** neither the legacy sKO formulas nor the tanh proposal is approved by this reconstruction. Evidence must establish any fitted weighting, threshold or calibration.
- **Target-specific presentation:** which validated stat/league target should headline each view when several disagree? The request supports multiple targets, not an arbitrary average.
- **VuDu completion:** what accepted goalie forecast/observation contract provides compatible expectations, workload and uncertainty? The intended calculation is defined above; whether current adapters meet it is for the audit to determine.
- **Official backronyms:** sKO and VuDu names are established; a final replacement expansion is not verified.

These are bounded design/evidence questions. They do not reopen the already-settled own-player baseline, opportunity inclusion, F/D separation, goalie-specific treatment, labelled uncertainty or leakage-safe evaluation requirements.

## 10. Primary evidence and chronology

The following are TJ's statements or explicit choices, not generated descriptions attributed to him. Dot message IDs identify messages in the existing conversation; ChatGPT links point to the retrieved original messages.

| Date | Primary source | Intent established |
| --- | --- | --- |
| 2025-07-08 | [Original VuDu](https://chatgpt.com/c/686d2319-8110-8005-9560-5d3440ced921?messageId=12391611-a6a8-4ced-b159-ae28a8de9060) | “The variance and volatility would be the difference in game to game and week to week point accumulations and performances and is designed to distill the total variance into a single novel metric.” Initial general fantasy-volatility concept; later reassigned to goalie sustainability. |
| 2025-09-19 | [Volatility research, partial voice transcript](https://chatgpt.com/c/68cde9cd-11f4-8329-a38f-67c6a1be76e6?messageId=cc99164d-59c0-49a3-a240-32c3de118b0d) | Dynamic windows, recency and accurate/contextual calculations. A [separate message](https://chatgpt.com/c/68cde9cd-11f4-8329-a38f-67c6a1be76e6?messageId=03c38744-155e-49ad-8508-f17365107085) asks whether volatility differs by position, not an assumed goalie property. Voice content is partly omitted. |
| 2025-09-21 | [Original SKO](https://chatgpt.com/c/68d08adf-0b68-832a-a19f-bfc07c21b833?messageId=9ea99679-2a74-4753-8db6-63d66974bd7f) | “First we will build our skater model. We will call the metric "SKO" - sustainability KPI overview.” Own-player average-game/stretch baseline, sustained over/underperformance, a “streak barometer,” separate skater/goalie work. |
| 2025-09-21 | [Refined research prompt](https://chatgpt.com/c/68d08adf-0b68-832a-a19f-bfc07c21b833?messageId=eedf845e-aa43-439b-a3f6-d5c47b532ae8) | User-selected prompt explicitly requires no leakage and frozen baselines. The old proposed 2024-25 holdout is not proof that it remains untouched today. |
| 2025-09-22 | [Sustainability barometer](https://chatgpt.com/c/68d1d335-5fc4-8325-921e-c5a1d809bc3f?messageId=ce35da1b-d022-4a09-9e81-587954776a6e) | “We want to know if a player is playing above or below what is expected of them.” Distinguishes luck, skill, individual play-driving and on-ice team help. |
| 2025-09-23 | [Research before construction](https://chatgpt.com/c/68d1e7fc-62c0-832b-8dfe-44ffcb617914?messageId=bc9aebf8-b0b0-42db-a329-51d763275b46) | “We should do the linear regression plot relationship analysis first before we build out this sKO metric.” Research method proposal, not validation of a formula. |
| 2025-09-30 | [Game-to-game and rolling sustainability](https://chatgpt.com/c/68dbf6ed-58cc-8323-a6ed-e750f38a18ec?messageId=d70ae176-ca07-4684-be72-630af930f910) | “Sustainability will be the ability to sustain their performance.” Formula ideas pasted in the surrounding discussion are not empirical proof. |
| 2025-10-14 | [Current performance, nightly diagnostic](https://chatgpt.com/c/68dd37ff-db2c-832d-a6ef-aa2d86695fec?messageId=00e66b69-2caf-4998-a477-8c633a9ed354) | Wants nightly evaluation, projected output/delta, and players furthest outside their thresholds **today** for Trends; not only future projection work. |
| 2026-01-31 | [Skater research priority](https://chatgpt.com/c/697e333e-94e8-8325-9e08-d6d26e209062?messageId=ce1415d6-6f5b-4cb2-973e-e69831809b51) | “Which metrics have the most correlation to a continued level of performance, which metrics point to positive regression to the mean, and which point to a negative regression.” |
| 2026-01-31 | [Separate goalie research](https://chatgpt.com/c/697e38bb-cbec-8331-a412-5a48c8df09f3?messageId=fc75d0e1-3745-4106-b944-1a5caae3034e) | “Do NOT merge skater and goalie metrics into a single unified scoring model.” Denominators, public-source provenance, incremental evidence and heuristic-versus-validated distinctions. |
| 2026-10-15 19:13 UTC | Dot `Sentinel_62621f379da88191aa654531b76ed379` | Quick-glance above/below own baseline and duration; BLSH goal; goalie equivalent named VuDu; independent research, not imitation of code. |
| 2026-10-15 19:57 UTC | Dot `Sentinel_50dac91df76c81918579514ba7ad9049` | Opportunity “Distinguishing, but not discounting or disqualifying”; separate F/D; two distinct pages: Sko Element and BLSH. |
| 2026-10-15 20:10–20:12 UTC | Assistant question `Sentinel_34ab0a5bad708191b10258a6fc18a132`; TJ answer `Sentinel_3abef957378c8191afa75ea86cd00ba3` | Assistant offered next 10 scheduled team games with 5/20 alternatives, and watchlists plus manager-entered trades with explicit market references. TJ selected “1A, 2A.” |
| 2026-10-15 20:50 UTC | Dot `Sentinel_42546c14c64081918c8ccf5d966836f2` | Own baselines; rolling windows; pre/during/end-streak relationships; explicit warning that the suggested weighted formula plan is only his hypothesis. |
| 2026-10-20 | Dot `Sentinel_140a308c8ef8819189d11064bb720c08`, `Sentinel_5bccebdc52a88191b7267eb374bb1240` | Team xGA considered; volume/danger/stopping separated; do not double-count environment or divide unblocked xG by on-net shots as calibrated xSV%. |
| 2026-10-25 | [Explicit current definition](https://chatgpt.com/c/6ade2e3d-e9a8-83e8-9dd2-4a438484dbb7?messageId=57e921ef-39fb-4bc8-9035-9e029a065899) | Persistence at current performance; hot/cold start/end, regression and luck; distilled novel metric; “Sko” for skaters and “Vudu” for goalies; logical soundness, reproducibility, no invented or falsely verified claims. |
| 2026-10-25 | Dot `Sentinel_1a73c2f71fe08191b13fdbe47c53bd8e`, `Sentinel_ea35e41f768081919f544cf3aa8fee0d` | NHL points, fantasy points and Game Score as research targets; own multiseason history; research ambition, not approved fixed weights. |
| 2026-10-29 | Dot `Sentinel_31ed3ebbdcf881919407bee0899a2f55`, `Sentinel_08205977b6748191b4cf004b942ccc81` | Retrospective production/support gap separate from market value and predictive evidence; survey rankings not weights; player projection over team schedule, not team-total forecast. |
| 2026-11-03 | Dot `Sentinel_8348805cf8c48191adfcb5e8743f5b50` | A conceptual owner-intent file without implementation bias: “this is what we set out to do, check to make sure we're doing that.” |
| 2026-11-11 | Dot `Sentinel_a328954849a08191bb85e07eaf43803b`; `OWNER-DECISIONS.md` 32–35, 61, 68 | Luck-only option does not capture the definition; present controlling baseline, support, opportunity, range and reference rules. |

## 11. Repository corroboration and coverage limits

Read for this reconstruction:

- Attached `w3-7-sko-vudu.md`, matched against `wave3-prompts/w3-7-sko-vudu.md`.
- `OWNER-DECISIONS.md`, especially 24–29, 32–39, 61–68 and relevant Wave 2 decisions.
- `packets-slim/sko.md` and `packets-slim/vudu.md` for the naming collisions and claimed consumers.
- `tasks/TASKS/prd-sko-element.md`: October 15 planning direction and explicitly provisional formulas.
- `tasks/codex-sprint-2026-10-19/sko-vudu/PHASE0-CONTRACT.md` and `PLAN-EXCERPTS.md`: distinctions and proposal status, not proof of live deployment or validation.
- `tasks/TASKS/sko-charts/sko-modeling-notes.md`: historical legacy/quarantine lineage.
- `tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md`: dated implementation context.
- `W1-Astra-PR/w2-blsh-buy-low-sell-high.md` and `W1-Astra-PR/w2-1-sql-cross-cut.md`: summaries/corrections relevant to interpreting this audit.

Coverage includes accessible Dot messages retrieved with sKO, VuDu and sustainability searches, the linked earlier ChatGPT conversations, and the named repository materials. Broad conversation search reported partial/unavailable results in some queries. Some voice content and the October 25 Deep Research answer were omitted by the reader. No claim is made that every historical chat, private branch or deleted message was available. No unseen research answer is treated as evidence.

This is an owner-intent reconstruction, not a new code audit or verification of current serving state. No production database/provider reads, model fitting or application tests were performed. Exact formulas, deployment status and any remaining source-dependent claims belong to the w3-7 audit and its evidence.
