# Planning-input confirmation: evidence and recommendation

Read-only review on 2026-11-10, `octoberBranch` at `11e4192d36ecc4ac4b338f9ab48e529c7049c618`. No application behavior changed; all nine files in the prior local loading candidate still match their recorded hashes. No browser reload, provider/auth call, production request, or new test run was needed.

## What the button does

`RosterScheduleOptimizer.tsx:219` initializes `reviewedInputs` to null. At `:775`, `reviewKey` serializes the account/context/date range/timezone, rules, roster, locks, and the whole visible planning player collection's identities, roster revisions, eligibility, availability, cannot-drop and reserve eligibility. At `:801` and `:1280`, the click only calls `setReviewedInputs(reviewKey)`.

It does not fetch Yahoo, verify credentials, validate settings, populate missing values, grant forecast admission, or authorize a Yahoo transaction. Reloading/remounting starts unreviewed again. Any change in the serialized key—including an unrelated candidate's tracked fields or player ordering—can require another click. Ordinary source timestamps alone are not in the key; do not claim every refresh necessarily resets it.

The reviewed flag, plus entered scoring, enables selection of candidate swaps, streaming plans and alternatives. It also contributes to readiness wording. Separate legality, budget, eligibility, forecast compatibility and unknown-data guards remain. `candidatePlanMetrics.ts:176` discards illegal or unverified-budget plans; numeric comparison has its own completeness checks. Prior local unit regression proves Net Pts visible before confirmation and unchanged after it.

Important naming issue: `CandidateCard.tsx:145` calls `selectPlan(plan.steps)` from **Preview swap**. The parent at `RosterScheduleOptimizer.tsx:1284` replaces the local selected itinerary and reports “Compared plan selected. Confirm roster changes with your provider.” It is not a pure temporary preview, but remains a reversible local edit. The generic confirmation itself makes no such edit.

## Which facts are already checked

| Input | Existing source/verification | Human work needed |
| --- | --- | --- |
| Team roster, actual slots, recognized scoring, daily/weekly format | Authenticated scoped Yahoo snapshot, identity mapping, settings parsing and freshness checks (`rosterPlanning.ts:450`, `:500`, `:515`, `:542`) | Resolve missing/unsupported values; no blanket recertification of verified facts is needed. |
| Fantasy eligibility, reserve eligibility, cannot-drop, actual locks | Explicit provider fields and freshness; lock reconstruction uses current roster/editability and game evidence (`:500`, `:549`) | Manual inputs or unresolved provider evidence; never infer eligibility from NHL position or injury text. |
| Available candidates and waivers | Individually returned league ownership and eligibility; incomplete scans stay partial (`:615`, `:650`, `:723`) | Verify unknown/manual candidates and future/conditional availability. Do not promote a partial scan to complete. |
| Remaining current-week acquisitions | Verified counter, correct week, identity and horizon; only then a provider-sourced allowance (`:525`) | Missing counts, out-of-period planning, or unsupported counting semantics. |
| League day boundary and add timing | Yahoo does not report the timezone; add timing may be inferred from its weekly deadline (`:460`, `:536`) | Confirm the actual timezone/day boundary and whether inferred timing matches the league, when relevant. |
| Weekly windows, waiver/FAAB gaps, goalie minimum details | Provider-reported portions retained; exact reset time, unreported weekly locks, credited minimum progress, counting/penalty and absent waiver budgets remain assumptions/unknowns (`:578`) | Supply or specifically acknowledge the missing facts required by the contemplated action. Not every gap matters to every comparison. |

`providerRules.ts:34` preserves authoritative provider values; manager values fill gaps and inferred timing can be overridden. Conflicts are surfaced. Existing field-specific confirmations (timezone and exact rule notes, `RosterScheduleOptimizer.tsx:1047`) already persist in manager overrides. The generic button does not perform those confirmations or remove unknown data. `capabilities.rules` is deliberately always false in this Yahoo adapter (`rosterPlanning.ts:726`), so it cannot be used as an all-or-nothing auto-confirm switch.

## Product intent and limits

The consolidated PRD (`tasks/TASKS/prd-rso-consolidated-2026-10-09.md:22`, `:65`, `:107`) requires advisory/read-only behavior, visible provider-vs-manager authority, and unknowns blocking dependent actionable conclusions or appearing as scenario assumptions. It does not require a generic acknowledgement every page load. Interpreting the current button as a manual-review safeguard is supported by that direction and its UI copy, not evidence that TJ explicitly requested this exact recurring click.

The October 29 UPKEEP-CONFIRM receipt says the existing gate was made visible next to disabled actions after a real-league test. It explicitly describes the inline buttons as the same `setReviewedInputs(reviewKey)` action previously inside collapsed rules; no new validation was added.

Automatically calling that setter on load would remove the click but falsely label all tracked inputs “reviewed,” including manager assumptions and stale retained data. It would not by itself defeat the independent engine guards or execute Yahoo moves. The real risk is unsupported confidence and local plan selection based on unexamined defaults—not an immediate transaction.

## Specific recommendation for TJ's decision

Remove the recurring blanket acknowledgement for fresh, supported, provider-verified inputs. Derive readiness from evidence rather than pretending the manager clicked a review button. Show “Verified from Yahoo” for those facts. Keep focused prompts only for unresolved inputs relevant to the contemplated move (for example, “Confirm league day boundary” or “Enter remaining acquisitions”). Persist manager confirmations by league and exact value/source meaning, and ask again only when the relevant fact materially changes. Manual users retain explicit setup/identity/availability confirmation; saved/unverified provider data does not acquire current authority on reopen.

Allow scenario inspection without blanket confirmation, while showing its actual assumptions and withholding unsupported actionable conclusions. Because **Preview swap** currently selects the local itinerary, either retain an explicit selection action with a truthful label, or make Preview a separate non-mutating comparison followed by **Use this plan**. Never change selected moves merely on load.

Do not implement `setReviewedInputs(reviewKey)` automatically or gate automatic readiness on `canSync`, a nonempty roster, or `capabilities.rules`. Those do not establish field-level correctness. Forecast admission, legality/budget checks, actual league slots, provider read-only behavior and unknown/unsupported separation must remain unchanged.

No implementation is authorized by this review request. The decision needed is whether TJ wants the recommended replacement of the generic gate with evidence-based readiness and targeted prompts, including the Preview/selection wording choice. An initial local implementation can then be scoped and tested without a live Yahoo call.
