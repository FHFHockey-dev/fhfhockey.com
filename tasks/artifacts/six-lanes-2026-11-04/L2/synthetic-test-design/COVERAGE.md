# Coverage mapping

Every original assertion remains in source. Retained suites load only inside beforeAll/tests and check exact SHA-256 pins. Synthetic coverage verifies contracts and arithmetic, not empirical acceptance or model quality.

## Mapper: each original test

| Original test | Portable/default substitute or explicit limit |
|---|---|
| distinguishes unknown source coverage from confirmed no personal history | History-boundary 0/19/20 plus unknown-history test. |
| keeps every profile and gives every recorded reason a text | Synthetic population counts/ranks; written notes and reason dictionary. Exhaustive saved-profile reason inventory remains retained-only. |
| shows an unavailable score as an unavailable tier with its reason, never as provisional | Measured zero / absent score / stale-window test asserts null score, tier, tracks and reason. |
| words an absent reference window as absence, not as a mismatch | Absent-context test asserts reference_window_not_supplied; exact saved-player wording remains retained. |
| counts games only for slot notes; profile-level notes carry no game count | Slot coverage-note test independently asserts games 2 versus null. |
| shows each profile's own reference age and anchors freshness to the recorded-through date | Stale-window test asserts age9/fresh=false and recorded-through anchor; each saved reference age (including1451) remains retained. |
| labels normalization separately from the bounded index and reconciles both sums | BL/SH arithmetic tests assert literal +/-sqrt(3), +/-63.39745962155614, observed/support/gaps and component sums. |
| shows estimator weights as decimals and never as percentages or confidence | BL/SH arithmetic asserts .8 weight and null probability; original full-profile text sweep remains retained. |
| shows a zero-shot window's zero as a value and withholds a thin history for history, not for the zero | Zero/missing shot context test + history-boundary and short-window priority tests. |
| keeps context as hypotheses and carries thin personal references visibly | Absent-context hypothesis flags + thin-history card test; exact retained conflicting-status label remains retained. supportGap default conflict tests remain unchanged. |
| ranks each list contiguously and keeps every withheld profile | Synthetic F/D ranks/top25 and exact population counts, plus withheld history tests. |
| withholds a would-be listed profile with no personal history and says why | History boundary zero confirms no-personal-history reason and withholding. |
| lists the same player again once they gain personal history | History boundary 0 versus20 restores membership; exact saved-player rank after restoration remains retained. |
| treats history that becomes unavailable as unknown, not as confirmed zero | Unknown history test versus confirmed zero; parser corruption tests reject interpretation drift. |
| withholds direction below the provisional 20-game history cutoff, listed or not, and keeps unknown apart from zero | History boundaries 19/20, unknown priority and thin-direction card tests. |
| withholds a short window after history, and a headline gap that is missing or points the other way | Unknown/short-window priority and contradictory/balanced/NaN/absent headline test. |
| orders each list by the FHFH Standard gap, ranks within F and D, and shows G+A and Game Score as supporting tracks | Independent different-index/headline ordering test, F/D ranks, literal headline gaps4/1 and roles. |
| marks the top 25 per side and position group and keeps the full ranked list | Synthetic27 defenders + forward and SH row asserts top25, full ranks and identities. |
| gives Player Cards the same saved list, ranks, headline, direction and reason the preview reads | Synthetic card full-profile equality (opportunity tests) and thin-history unknown direction. |
| shows an explicit unavailable state when nothing is attached, never zeros | BL/SH test asserts unavailable unattached opportunity with empty tracks. |
| maps both comparisons, the assessment, TOI and PP changes and the claims for each track | Opportunity tests assert independent expected12.9025*level and observed-minus-expected gap, TOI720/1200, PP120/120, unavailable adjusted Game Score, claims and list-check. |
| never changes the list or the rank, even when the assessment contradicts or withholds | Opportunity levels.1/3 prove contradicts/agrees without score changes; ten-game history explicitly unavailable without membership changes. |
| gives every opportunity reason code a written text | Original reason-code assertion moved unchanged into default suite; runs in either mode. |
| fails closed on a result that does not match the scored window or claims a forecast | Opportunity corruption loop rejects observed-window drift, forecast promotion, unavailable-zero substitution. |
| gives Player Cards the same opportunity the preview reads | Synthetic opportunity/card full-profile equality. |
| refuses components that no longer add to the gap | Synthetic component corruption test. |
| refuses changed claims, a missing rank or a rank on a withheld profile | Synthetic claims/rank corruption and thin-history rank rejection. |
| refuses a withheld context with no recorded reason | Synthetic context-reason corruption test. |
| refuses another arm, duplicate players and a packaging time before capture | Synthetic arm/duplicate/chronology corruption cases. |
| packages all 725 saved profiles without recomputing a score | Packaging remains independently opt-in and was NOT run; no synthetic substitute for full-population packaging. |

## Parser: each expanded original test

The same contract/mutation bodies run on independently authored historical and legacy-current records by default, and separately on retained records when requested. The three empirical count/value tests are skipped in the synthetic iteration; their titles state the saved data scope. Streak count is1 synthetic /4 retained. V3 uses an authored literal sample by default, never mapper output.

| Test | Default coverage |
|---|---|
| retains all924 profiles, reviewed list order and unavailable coverage | Retained-only exact population/list/value assertions. Synthetic baseline separately asserts index50, three gaps2 and unavailable null. |
| preserves the independently reviewed low-shot example without rescoring | Retained-only exact population/list/value assertions. Synthetic baseline separately asserts index50, three gaps2 and unavailable null. |
| keeps zero shots numeric and missing support null | Same mutation/contract body on authored records; retained assertions also preserved. |
| does not substitute BLSH score signs for absent streaks | Same check; authored streak count1, retained count4; unstreaked BL preserved. |
| rejects mismatched streak player | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects mismatched streak date | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects mismatched streak version | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects duplicate identities and future current-window rows | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects reference/current overlap | Same mutation/contract body on authored records; retained assertions also preserved. |
| fails closed on stale list drift | Same mutation/contract body on authored records; retained assertions also preserved. |
| fails closed on conflict list drift | Same mutation/contract body on authored records; retained assertions also preserved. |
| fails closed on trusted list drift | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects fabricated issuance, confidence and nonfinite values | Same mutation/contract body on authored records; retained assertions also preserved. |
| keeps fallback identity explicit | Same mutation/contract body on authored records; retained assertions also preserved. |
| dispatches v2 without changing v1 and retains the full saved population | Retained-only exact population/list/value assertions. Synthetic baseline separately asserts index50, three gaps2 and unavailable null. |
| rejects duplicate identity/window drift | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects future identity/window drift | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects overlap identity/window drift | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects custody identity/window drift | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects saved component drift without repairing it | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects saved contribution drift without repairing it | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects saved index drift without repairing it | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects saved count drift without repairing it | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects saved sign drift without repairing it | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects saved withheld drift without repairing it | Same mutation/contract body on authored records; retained assertions also preserved. |
| keeps unavailable tiers and profile notes distinct from estimates and game counts | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects stale interpretation drift | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects conflict interpretation drift | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects rank interpretation drift | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects claim interpretation drift | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects issued interpretation drift | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects anchor interpretation drift | Same mutation/contract body on authored records; retained assertions also preserved. |
| accepts legacy arm-A records and v3 unattached opportunity without mutation | Authored legacy acceptance and no-mutation by default; exact repaired bytes only in retained iteration. Final title distinguishes them. |
| accepts balanced attached context on a buy-low list without changing ranks or scores | Same mutation/contract body on authored records; retained assertions also preserved. |
| retains nonzero buy_low_evidence opportunity using observed minus expected | Same mutation/contract body on authored records; retained assertions also preserved. |
| retains nonzero sell_high_evidence opportunity using observed minus expected | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects nonzero comparison gap sign corruption | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects nonzero comparison z sign corruption | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects nonzero comparison z ratio corruption | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects nonzero comparison zero scale corruption | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects nonzero comparison negative scale corruption | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects nonzero comparison direction sign corruption | Same mutation/contract body on authored records; retained assertions also preserved. |
| allows a nonzero balanced comparison without assuming an unsaved band threshold | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects a non-balanced direction on a zero z comparison | Same mutation/contract body on authored records; retained assertions also preserved. |
| retains a thin-history withheld profile and rejects a contradictory gate reason | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects version drift without repairing the payload | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects missing headline drift without repairing the payload | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects headline value drift without repairing the payload | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects track role drift without repairing the payload | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects history gate drift without repairing the payload | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects window gate drift without repairing the payload | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects policy gate drift without repairing the payload | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects direction drift without repairing the payload | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects position rank drift without repairing the payload | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects topN drift without repairing the payload | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects rank tie drift without repairing the payload | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects position order drift without repairing the payload | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects position count drift without repairing the payload | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects reason count drift without repairing the payload | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects direction count drift without repairing the payload | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects opportunity count drift without repairing the payload | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects opportunity claim drift without repairing the payload | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects unattached numeric drift without repairing the payload | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects arm C drift without repairing the payload | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects attached opportunity expected drift | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects attached opportunity window drift | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects attached opportunity gap drift | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects attached opportunity headline drift | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects attached opportunity applied drift | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects attached opportunity state drift | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects attached opportunity check count drift | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects attached opportunity missing check drift | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects attached opportunity version drift | Same mutation/contract body on authored records; retained assertions also preserved. |
| rejects attached opportunity changes drift | Same mutation/contract body on authored records; retained assertions also preserved. |

## Scorer and player cards

| Original test | Default coverage |
|---|---|
| supportGap.test.ts: centers player levels and half-shrinks | Unchanged authored default test and assertions. |
| supportGap.test.ts: rejects current/future training | Unchanged authored default test and assertions. |
| supportGap.test.ts: keeps the target out of the fit | Unchanged authored default test and assertions. |
| supportGap.test.ts: rejects overlapping source blocks | Unchanged authored default test and assertions. |
| supportGap.test.ts: does not let new IDs hide duplicate player dates | Unchanged authored default test and assertions. |
| supportGap.test.ts: does not compress an invalid original block | Unchanged authored default test and assertions. |
| supportGap.test.ts: does not let an unknown team hide a trade | Unchanged authored default test and assertions. |
| supportGap.test.ts: is unavailable for a sparse fit | Unchanged authored default test and assertions. |
| supportGap.test.ts: gives a constant process no epsilon | Unchanged authored default test and assertions. |
| supportGap.test.ts: gives a duplicate feature no extra vote | Unchanged authored default test and assertions. |
| supportGap.test.ts: preserves the fitted correction under process unit changes | Unchanged authored default test and assertions. |
| supportGap.test.ts: rejects heteroscale invalid and missing covariance | Unchanged authored default test and assertions. |
| supportGap.test.ts: treats missing as not zero and zero as measured | Unchanged authored default test and assertions. |
| supportGap.test.ts: keeps singular-overlap conditional uncertainty valid | Unchanged authored default test and assertions. |
| supportGap.test.ts: does not give an unseen null-space change a measured interpretation | Unchanged authored default test and assertions. |
| supportGap.test.ts: cannot rename missing current support as production | Unchanged authored default test and assertions. |
| supportGap.test.ts: labels a missing reference as cohort | Unchanged authored default test and assertions. |
| supportGap.test.ts: does not veto low/zero shooting or balanced finishing | Unchanged authored default test and assertions. |
| supportGap.test.ts: does not mechanically sell an established finisher above ordinary xG when their own production and support are unchanged | Unchanged authored default test and assertions. |
| supportGap.test.ts: keeps peripheral-driven production visible | Unchanged authored default test and assertions. |
| supportGap.test.ts: separates a support change from the raw production axis | Unchanged authored default test and assertions. |
| supportGap.test.ts: keeps a conflict's number without a direction | Unchanged authored default test and assertions. |
| supportGap.test.ts: discloses floors and keeps GS signed | Unchanged authored default test and assertions. |
| supportGap.test.ts: keeps no current history null | Unchanged authored default test and assertions. |
| supportGap.test.ts: does not treat stale or cohort evidence as measured personal evidence | Unchanged authored default test and assertions. |
| supportGap.test.ts: preserves the index under outcome unit changes | Unchanged authored default test and assertions. |
| supportGap.test.ts: distinguishes balanced from missing | Unchanged authored default test and assertions. |
| supportGap.test.ts: keeps exactly two lists, tier order and non-list records separate | Unchanged authored default test and assertions. |
| supportGap.test.ts: leaves original objects unchanged | Unchanged authored default test and assertions. |
| supportGap.test.ts: reproduces fitted models, scores, states and lists | Existing explicit BLSH_V1_RUN_DIR parity only; not run. Missing root fails before replay; historical snapshot comes from pinned explicit retained root. |
| supportGap.test.ts: splits each track gap into components that add back exactly, and tracks into the score | Unchanged authored default test and assertions. |
| supportGap.test.ts: leaves scores from scoreAndAttribute identical to the frozen score | Unchanged authored default test and assertions. |
| supportGap.test.ts: uses beta[process][track] with a non-symmetric model | Unchanged authored default test and assertions. |
| supportGap.test.ts: tags reference, model, imputed, cohort and floor components separately | Unchanged authored default test and assertions. |
| supportGap.test.ts: separates the gap sign from research-list membership | Unchanged authored default test and assertions. |
| supportGap.test.ts: does not change the score it explains | Unchanged authored default test and assertions. |
| supportGap.test.ts: refuses a result that was not scored with attribution | Unchanged authored default test and assertions. |
| supportGap.test.ts: attributes cancelling coefficient changes to the model that actually scored | Unchanged authored default test and assertions. |
| supportGap.test.ts: labels terms with the scoring model's own feature names and freezes the record | Unchanged authored default test and assertions. |
| supportGap.test.ts: rejects invalid model coefficients before any arithmetic | Unchanged authored default test and assertions. |
| supportGap.test.ts: accepts context only for the scored player and games | Unchanged authored default test and assertions. |
| supportGap.test.ts: withholds context with missing identities | Unchanged authored default test and assertions. |
| supportGap.test.ts: withholds context whose outcomes disagree with the scored totals | Unchanged authored default test and assertions. |
| supportGap.test.ts: withholds context when the scored production axis names different games | Unchanged authored default test and assertions. |
| supportGap.test.ts: checks the reference window's identity separately | Unchanged authored default test and assertions. |
| supportGap.test.ts: withholds context whose seconds or appearance count differ from the scored window | Unchanged authored default test and assertions. |
| supportGap.test.ts: uses PP seconds for PP-scoped finishing, including the spread | Unchanged authored default test and assertions. |
| supportGap.test.ts: uses ES seconds for ES-scoped shots | Unchanged authored default test and assertions. |
| supportGap.test.ts: withholds rates with a missing, zero or unknown denominator | Unchanged authored default test and assertions. |
| supportGap.test.ts: withholds a delta across different scopes | Unchanged authored default test and assertions. |
| supportGap.test.ts: withholds a delta across different providers or a known revision change | Unchanged authored default test and assertions. |
| supportGap.test.ts: flags an unknown revision as unverified and withholds unknown provenance | Unchanged authored default test and assertions. |
| supportGap.test.ts: rejects a non-finite or invalid exposure and withholds the window | Unchanged authored default test and assertions. |
| supportGap.test.ts: rejects non-finite or negative counts with a reason, never a number | Unchanged authored default test and assertions. |
| supportGap.test.ts: reads the scored identity from the production axis, not from the caller's context | Unchanged authored default test and assertions. |
| supportGap.test.ts: treats a known revision on one side and another known revision on the other as a mismatch, including mixed windows | Unchanged authored default test and assertions. |
| supportGap.test.ts: states an unknown or unusable personal history instead of 'no history' | Unchanged authored default test and assertions. |
| supportGap.test.ts: checks goals and assists separately against the scored split and total | Unchanged authored default test and assertions. |
| supportGap.test.ts: freezes the scored result so modes, deltas and exposure cannot be relabelled | Unchanged authored default test and assertions. |
| supportGap.test.ts: rejects ES + PP seconds above the total and notes an undefined spread at zero xG | Unchanged authored default test and assertions. |
| supportGap.test.ts: withholds on-ice deltas between opposite mixed compositions that share one label | Unchanged authored default test and assertions. |
| supportGap.test.ts: checks PP seconds against the total when ES seconds are missing, and ES when PP are missing | Unchanged authored default test and assertions. |
| supportGap.test.ts: reports finishing per 60 as provider-model-relative, with a same-unit spread only when available | Unchanged authored default test and assertions. |
| supportGap.test.ts: defines assists per teammate on-ice goal and flags contradictions | Unchanged authored default test and assertions. |
| supportGap.test.ts: keeps genuine zeros and records missing reference values as coverage | Unchanged authored default test and assertions. |
| supportGap.test.ts: keeps unavailable scores unexplained but still reports context and deduplicated coverage | Unchanged authored default test and assertions. |
| supportGap.test.ts: adds every component back to the gap and every track back to the score for all numeric origins | Existing explicit BLSH_V1_RUN_DIR parity only; not run. Missing root fails before replay; historical snapshot comes from pinned explicit retained root. |
| retainedBlsh.test.ts: preserves a withheld direction even when the saved gap is positive or negative | Unchanged authored default test and assertions. |
| retainedBlsh.test.ts: preserves count discrepancies even when identity, team and exposure qualify | Unchanged authored default test and assertions. |
| retainedBlsh.test.ts: limits full matches to exposure and the five counts while preserving unknown PPP | Unchanged authored default test and assertions. |
| retainedBlsh.test.ts: retains missing boxes as unknown and exposure mismatches as differences | Unchanged authored default test and assertions. |
| retainedBlsh.test.ts: withholds invalid or promoted box attachments without replacing saved research | Unchanged authored default test and assertions. |
| retainedBlsh.test.ts: attaches pending source lineage without admitting stale research as current input | Unchanged authored default test and assertions. |
| retainedBlsh.test.ts: binds the independent review only to its exact stale-research scope | Unchanged authored default test and assertions. |
| retainedBlsh.test.ts: withholds invalid lineage but preserves independently qualified retained values | Unchanged authored default test and assertions. |
| retainedBlsh.test.ts: displays actual supplied values on a separately dated window and preserves full evidence | Unchanged authored default test and assertions. |
| retainedBlsh.test.ts: rejects unreviewed bytes, changed identity and promoted research claims | Unchanged authored default test and assertions. |
| retainedBlsh.test.ts: rejects incomplete saved windows and unavailable support instead of manufacturing neutrality | Unchanged authored default test and assertions. |
| retainedBlsh.test.ts: keeps saved window age separate from missing production and preserves raw diagnostics | Original exact Benn/Wilson/137-row assertions retained-only. Added authored ages1/11 + unavailable-track cases prove no misleading stale text, no mutation, and preserved evidence. |

## Empirical coverage absent from portable runs

- Exact924 historical /725 current profiles; BL/SH/withheld counts, numeric/missing/conflicting slices, all saved ranks, player-specific scores, real zero-shot prevalence, four real streak attachments, reference-age distribution and full saved-profile reason inventory.
- Exact repaired snapshot identity,137 recent missing-production rows, named saved-player values/diagnostics and immutable retained byte pins.
- Frozen2772-origin fitted-model/score/list replay and all-origin attribution parity remain separate optional checks; they were already opt-in and were not run here.
- Full725-profile source/summary packaging stays opt-in and was not run. None of these synthetic contracts establish source acceptance, calibration, forecast quality, production readiness, or redistribution permission.
