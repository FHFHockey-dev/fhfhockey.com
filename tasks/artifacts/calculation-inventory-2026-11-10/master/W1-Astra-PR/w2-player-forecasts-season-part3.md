# W2 player forecasts, season part 3: independent peer review

Reviewed 2026-11-11 on Tim’s Mac in `/Users/tim/Code/fhfhockey.com`, branch `octoberBranch`. Audit commit: `82856e0b1e9a18bf131c0838503226f660a3f543`. Source first inspected at `76b25fb8fb60e6cde12b4cd2a5634e83ff1eadf1`; the reviewed player-forecast, fantasy-projection, bridge, optimizer and settlement paths had no committed diff from the audit commit.

This is an addendum to [Fable’s audit](../audits/player-forecasts-season-part3.md), not a replacement. Read with the [owner decisions](../OWNER-DECISIONS.md), [W1 season review](player-forecasts-season.md), [W1 goalie review](goalie-starters.md), [W1 RSO review](rso-roster-optimizer.md), Wave 2 prompt and packet. Only this Markdown file was written. No application changes, database queries, provider requests, production requests, deployments, dependency installs, commits or pushes were performed.

## Assessment

**Retain the rounding rejection, ledger population mismatch, unknown-as-zero coverage problem, explicit goalie-basis requirement and undefined-ratio findings. Correct the proposed DNP proof, the claimed full-population bias reversal, “silent” missing mass, and several dormant modeling remedies.**

The deepest executed checks establish:

1. Actual bridge probabilities **0.33337 / 0.33337 / 0.33326** become **0.3334 / 0.3334 / 0.3333**. The actual resolver rejects all three lines. Keeping the original probabilities preserves them.
2. A valid completeness receipt settles a missing backup to false/zero, but **does not change the count scorer’s dressed-only population**. A synthetic starter’s 21 expected saves are still compared with 30 actual saves, excluding the backup’s 9 expected saves. Binary start scoring already includes confirmed non-starts.
3. An unknown third goalie gets a **zero saves line with every main use permitted**. The actual coverage summarizer counts **3 of 3** goalie-save targets as eligible. The bridge nevertheless emits explicit missing-share warnings. The issue is numerical/permission completeness, not total absence of disclosure.
4. The season preview’s appearance-based 21.6 saves is correctly **withheld as issued**. Only after a hypothetical permission change and entry into reconstruction does it become 13.5 because the resolver assumes per-start conditional stats.
5. Two December games on the same NHL date get lead days **13 and 14**; the evening game is excluded from a 14-UTC-day window. This is reproducible, but the current version explicitly promises UTC. Changing it is a coordinated policy change, not an isolated arithmetic repair.
6. A contract-accepted synthetic season artifact can give Bernoulli GP/GS variances **0.96 / 0.75** at probabilities **0.8 / 0.5**, instead of **0.16 / 0.25**, because the evaluator adds a conditional variance to an event whose conditional value is fixed at one.

No new currently deployed P0 or production frequency is established. Conversely, “no public page shows a wrong number today” is not established by this review or by a search for scoreboard callers: the bridge feeds other live-capable consumers. Do not repeat the original verdict counts as independent certification.

## Evidence limits and source identity

- Executed: actual TypeScript functions bundled in memory with the repository’s installed esbuild, fictional inputs, blocked fetch/HTTP transports; deterministic 200,000-draw rounding simulation. The executable reproduction is below.
- Inspected: named source functions, direct consumers, relevant tests, schema/contract declarations, original audit and prior peer reviews. No service-backed test suite was run.
- Reported only: Fable’s ledger totals, 174/221 unresolved rows, 110/284 goalie counts, 8/147 relief sample, 156 served groups and table-state observations. No underlying production extract or receipt was reread.
- The report’s Q5 uses `pg_stat_user_tables.n_live_tup`, an **estimate**, not an exact row count. A zero estimate is weaker than proof that tables/artifacts do not exist. Use “reported inactive/empty snapshot, not independently verified,” not unconditional dormancy certification.
- Native source selection requires a valid selected catalog head (`web/lib/player-forecasts/forecastServingSource.ts:59-78`). The bridge requires the legacy selection, no admitted/native-baseline rows, an explicit bridge option and a non-off environment flag (`web/lib/rosterScheduleData/planning.ts:213-220`). These are runtime reach conditions, not measured deployment facts here.
- Fable’s Q1 and Q3 have no stated served-date bounds in their executable SQL; Q2 and Q5 are descriptions rather than complete queries, and `now() - interval '3 days'` is not a frozen cutoff. Preserve the reported snapshot but do not call its exact sample independently reproducible.

## Findings and corrections

### PR1 · Missing WGO rows are not established DNPs; count equality is not a completeness receipt

**M-PFC-126; correct D1 and its first owner question. P1 before unconditional accuracy claims.**

`servedForecastLedger.ts:265-278` explicitly requires trusted final team/class ingestion receipts, **not row counts or another player’s presence**. `:291-306` safely leaves missing outcomes unknown without one. The settle route supplies none (`web/pages/api/v1/db/forge-served-forecast-settle.ts:40-49`).

The source confirms the absence-settlement gap. It does **not** prove Fable’s “none has a WGO row, so they are true non-appearances, not late data.” Missing ingestion, identity mismatches, omitted source rows and corrections remain possible without independent evidence. Therefore the “full set says forecasts are 12% high” and “105 actual starts over 284 rows” are **conditional zero-imputation scenarios**, not established full-population accuracy. They implicitly treat the unresolved rows as zero, contrary to decision 41.

A row-count comparison fails even with a final game: official appearance IDs [201,202] and ingested IDs [201,999] both count two. Player 202 actually appeared but would be falsely settled absent by the proposed count receipt. Duplicate or stale identities can create the same failure. A dressed backup can also have no appearance statistics; “dressed,” positive-TOI appearance and official start are different events. Current `dressed = !!actual` (`:302`) means source-row presence, so the event contract must be clarified before broadening it.

**Required remedy:** a versioned, target-specific receipt must establish game identity/finality, both team identities, player class, expected player-ID membership, unique ingested IDs, reconciliation/exclusions and source provenance. Use a verified complete appearance universe to prove no appearance; do not infer dressing from an appearance-only feed. Bind the forecast’s pregame team/candidate identity to that receipt. Preserve unresolved and corrected states.

Prefer existing stored trusted evidence to new provider calls. Do not ask the owner to choose whether an unsafe row-count proxy is acceptable. The implementation question is which existing evidence can prove the required population. Historical repairs need a separately bounded plan: the route only revisits three served dates (`:29-37`), and adding receipts today would not automatically repair older rows. The route deliberately clears prior settlements unsupported by current evidence (`:49-52`); retain that correction safety.

### PR2 · Receipts do not repair the count scorer; binary and market populations must stay distinct

**M-PFC-126; strengthen D1’s consumer inventory. P1, live-capable.**

Actual functions with starter A (p=.7, expected saves 21, actual 30) and backup B (p=.3, expected saves 9):

| Receipt | Backup dressed / started / saves | Count-score n / expected / actual | Start-score n |
|---|---|---|---|
| Absent | null / null / null | 1 / 21 / 30 | 1 |
| Final complete team/class | false / false / 0 | 1 / 21 / 30 | 2 |

`scoreLedger` explicitly selects `dressedRows` for counts, FP, FP deciles and back-to-back splits (`servedForecastLedger.ts:414-424`). `scorePairedLedger` does the same for paired counts/FP (`:487-504`). **These need basis-aware selection in addition to receipts.**

But binary W/SO/start already use all known outcomes (`:417-418,494-497`). Do not “fix” those by adding a dressed filter or requiring a goalie to start before scoring unconditional W/SO. Supply valid false outcomes instead. Nor should a two-candidate sum-one fixture be called a calibration test: one realized start equals the sum of a complete categorical forecast by construction; it says nothing about which candidate’s probability is calibrated.

Market props explicitly exclude DNP voids and pushes, and the team-win diagnostic uses a known start (`:526-553`). Those event-specific populations are not interchangeable with unconditional forecast scoring. Audit conversion to the **same market event**, rather than mechanically including absent players in every market table.

The ledger row lacks an explicit conditioning/basis field (`:17-28`), and bridge participation is copied from optional appearance metadata (`:125-130`). Ordinary bridge emissions do not supply appearance probability (`forgeDailyBridge.ts:397-407`), although some reserve emissions do. The independently assembled universe is returned by the builder but not persisted by the snapshot route (`forge-served-forecast-snapshot.ts:96-101,130-131`). A migration/retention plan must preserve basis, population, participation model and issuance provenance, not just fill a probability column.

Score resolved outcomes on the declared basis, disclose unresolved coverage and selection limits, and keep a clearly labeled appeared-only diagnostic if useful. Do not assert complete unconditional performance when population/outcomes are incomplete. Missing outcome need not make every descriptive diagnostic unavailable, but must prevent an unqualified accuracy claim.

### PR3 · Rounding rejection is confirmed; preserve precision rather than relaxing every guard

**M-PFC-122; retain D2. P1 in the admitted bridge path.**

`forgeDailyBridge.ts:573-585` builds continuous probabilities and `:635-636` rounds each to four decimals. `planningContributions.ts:98-128` rejects group mass above 1.000001. The actual synthetic bridge/resolver outputs were:

- Before: probabilities [.3334,.3334,.3333], saves [10.0011,10.0011,9.9978].
- After resolution: all three probabilities and saves null; assignment/totals/comparison denied.
- Replacing only probabilities with the original [.33337,.33337,.33326] preserves all three saves lines.

The seeded 200,000-draw uniform-normalize-round experiment rejected **25,209 (12.6045%)**. This reproduces the numerical mechanism, not a real-world incidence estimate. The distribution and candidate count matter.

Fable’s single served group above tolerance is **not by itself a producer-wide rejection measurement**. Its query combines `bridge_exact` and `bridge_reaimed`, while snapshot keys include source (`forge-served-forecast-snapshot.ts:101`). Repeated snapshots can retain distinct sources for one player-game; group sums need deduplication and a common issuance before they establish a probability vector. The ledger is also a served subset. These issues likewise prevent attributing all 15 low-mass groups to unknown candidates without full source lineage.

**Preferred remedy:** retain unrounded probabilities through bridge emission and wire transport; round only display. `bridgeForecastWire.ts:88,108` carries the numeric probability without an extra rounding step. Validate the original distinct candidate universe, finite range and mass. If compatibility requires four-decimal stored probabilities, an n×0.00005 error budget is defensible only for a **proven n-member rounded vector**, not as a general permission to accept malformed inputs. Do not rescale unknown mass or silently normalize duplicates.

Other guards: `calendarCoverage.ts:92-99` and `resolvedPlanningForecast.ts:100-126` have the same tolerance. However the cited `rosterScheduleOptimizer/planning.ts:534-537` does **not reject** mass: it caps a selected-lineup group sum at one for minimum-start coverage. Changing that clamp is not the same fix. Inventory each reader’s purpose before editing it.

Tests: three-way rounding, two-way half-ties, unrounded valid mass, genuine oversum, duplicate candidates, confirmed contradictory starters, null candidates, compact/expanded wire round trip, and repeated resolver reconstruction. Preserve legitimate independent appearance means when only separate starter metadata conflicts.

### PR4 · Missing mass is disclosed, but the numerical coverage still treats unknown as known zero

**M-PFC-121/122; narrow D3 and C20. P1 for false completeness, not a demand to force mass one.**

The bridge already tracks `openTeamGames` (`forgeDailyBridge.ts:607`) and emits “start chances there sum to less than 1” plus “unknown … plans count 0 starts” warnings (`:714,726`). `planning.ts:218,287-288` carries these into forecast evidence. `RosterScheduleOptimizer.tsx:1287` renders evidence limitations. Thus “silent” is false as a blanket statement.

The more concrete problem is `emitReserve`: an unknown start share receives a zeroed line (`forgeDailyBridge.ts:445-447,630-633`) through `emit`, which allows assignment/totals/comparison (`:405`). An actual fixture with [.6,.2,unknown] emits saves [18,6,0]. The actual `summarizeCalendarConsumerCoverage` then reports **required=3, eligible=3, assignment=3, totals=3, comparison=3, no exclusions** for SAVES_GOALIE. It tests finite value/permissions (`calendarCoverage.ts:123-136`), not whether zero represents an unknown start.

Keep known probabilities and means; carry unknown probability mass and target provenance explicitly. The whole-team start distribution should have a residual unknown bucket. A lineup containing an unknown-value player is incomplete, and drop/rank logic must honor that state. Do not automatically invalidate a fully known selected player’s individual marginal just because some other team candidate is unknown.

Do not deny all reserve codes: a confirmed out player’s zero is genuine; unknown start/no-line/evidence-unavailable zeros are not. Use the existing reserve-code machinery (`bridgeForecastWire.ts:32-47,78-89`) with explicit event semantics. Existing W1 RSO PR2 also demonstrates an absent-row gap in provider normalization; its unrounded implementation is not a generally safe template for completeness.

**Reach caveat:** the public `inspectCalendarConsumerCoverage` loader passes only `{now}`, not `forgeDailyBridge:true` (`calendarCoverage.ts:192-195`), while the bridge loader requires that option. The fixture proves the summarizer misclassifies bridge rows **when supplied**, not that its current operational endpoint was returning a bridge coverage report. RSO bridge consumers remain separately reachable under their own admission.

### PR5 · Goalie role basis is a real contract issue; do not activate the preview or add relief blindly

**M-PFC-122/125; retain D4/D5 with scope and upstream qualification.**

The detailed resolver labels non-null goalie `conditionalStats` **per_start** and multiplies by `startProbability` (`planningContributions.ts:194-206`). The season preview explicitly emits **per appearance, relief included** and separate pStart (`seasonGameContributions.ts:16-17,43-54,70-75`).

Executed fixture: conditional saves 27, pAppearance=.8, pStart=.5. Preview emits 21.6. With its real all-false permissions, reconstruction keeps public saves null. In an explicitly hypothetical in-memory permission change, with a baseline catalog present to enter reconstruction, it becomes **13.5**. No public integration failure or approved activation was demonstrated. Without a baseline catalog, this resolver returns raw rows after validation (`planningContributions.ts:130-141`), so merely passing the preview is not sufficient to reproduce the multiplication error.

**Fix before any integration:** persist conditional basis per target, including appearance/start/relief, and validate compatible participation lineage. Prefer the already-issued unconditional value if its contract is qualified; never reinterpret a conditional mean based solely on player class. Keep preview permissions denied until native admission qualifies it.

Bridge omission of an explicit relief component is source-confirmed and conflicts with decision 63. Its final multiplication is start-only. But the upstream selected-goalie row is itself built from **a top-starter scenario mixture** (`web/lib/projections/stages/goalie-stage.ts:656-685,804-824`), then read as “per-start” (`forgeDailyBridge.ts:283-289`). That mixture is not the individual goalie’s conditional-start mean. Adding relief to it without repairing candidate identity does not yield the desired decomposition.

Use candidate-specific conditional-start and conditional-relief distributions with mutually exclusive role probabilities. Preserve SA=SV+GA and official credited outcomes. Label start-only behavior until qualified. The reported 8/147 relief appearances shows relief exists in that served sample; it does not measure omitted saves or prove every backup’s net forecast bias is downward after other model errors.

### PR6 · Schedule-date behavior is reproducible, but the proposed fix needs a versioned cross-consumer contract

**M-PFC-124; retain D6 as a product-definition choice/conditional reach issue, not undocumented UTC arithmetic.**

Source lineage distinguishes:
- Official importer: `games.date = game.gameDate`, `startTime = game.startTimeUTC` (`update-games.ts:179-183`).
- Calendar builder: window starts at UTC midnight and selects by start instant, while retaining `gameDate` (`schedule.ts:64-72,92-96`).
- Contribution policy: explicitly `timeZone:"UTC"`; `calendarLeadDay` uses UTC date boundaries (`contributions.ts:6-20`). It affects detailed admission and the seven-day blend (`:291-307`).
- Planning/UI dates: `normalizePlanningGames` may instead derive date in the requested timezone (`planningInputs.ts:24-30`).
- Coverage loader explicitly requests UTC (`calendarCoverage.ts:192-195`); evaluator lead bins also use UTC timestamp dates (`evaluation.ts:272-273,414-415`).

Executed December fixture: as-of December 1 at 12Z; NHL-date December 14 games at 18Z and next-day 00Z. Leads are **13 / 14**, and only the afternoon game survives the 14-day calendar builder. A 1pm and 7pm ET pair on December 10 gets leads 9/10, so the same valid blended rates would have weights 5/7 and 4/7. These are intended consequences of the declared UTC policy, but inconsistent with an NHL-slate-based promise if that is the desired product.

A change to NHL dates needs an explicit as-of date timezone, end-point/inclusivity rule and version change shared by issuance, replay/admission, bridge, coverage, planning and evaluation. `ContributionGame` currently carries scheduledAt, not the schedule date, so “use games.date” cannot be a one-line replacement everywhere. Do not use a user-local planning date interchangeably with the NHL date. Cover DST transitions, after-midnight UTC games, non-North-American venues, postponements, same-instant offset forms and the last included slate. The season-ID cross-check is sound within the regular-season scope; no new season-boundary defect is established.

### PR7 · PP support bug is conditional on a reduced artifact, not established for the canonical producer

**M-PFC-125; qualify D7. Dormant/preview compatibility issue.**

`seasonGameContributions.ts:7-8,46-55` insists PP_ASSISTS be listed as a finite primitive even when the complete strength family can derive it. Actual fixtures with every strength component supplied demonstrate:
- Reduced artifact without PP_ASSISTS: evaluator PP_POINTS=.32, preview PP_POINTS=null with missing_artifact_target.
- Same artifact with PP_ASSISTS=.3: evaluator and preview both .32.

However the canonical base target list **already includes PP_ASSISTS** (`contracts.ts:26-45`; Python `SKATER_TARGETS`), the Python writer includes the base list (`season.py:3681-3686`), and the v5 merge unions extra targets with that base (`evaluator.ts:255`). Thus a currently generated canonical v5 artifact missing PP_ASSISTS was not established. Also derivation requires the **complete strength family**, not merely two PP assist keys (`contracts.ts:516-522,566-568`).

Treat this as a supported-schema/adapter capability decision. If reduced schemas are supported, resolve dependencies from the same reconciliation contract and test the full dependency graph. Do not simply infer missing components as zero.

### PR8 · Missing variance scale does not generally create a zero-width unconditional interval

**M-PFC-129; correct D10; additional safeguard for 176/177. Dormant activation work.**

The missing `intervalVarianceScale` fallback does produce zero **conditional** variance (`season.py:3331-3335`). But:
- The normal fitter always writes the key, defaulting to 1 and fitting it from residuals (`:2473-2498,2539`). An absent key is malformed/legacy policy behavior, not a demonstrated normal output.
- The unconditional variance adds p(1−p)μ² (`:4410-4413`; TS `evaluator.ts:476-479`). With μ=10, p=.5 and conditional variance=0, unconditional variance is **25**, not zero.
- A positive mean can legitimately have p10=p90 for a deterministic or highly discrete distribution. “No equal p10/p90 at positive mean” is not a valid universal acceptance test.
- `max(variance, |rate|, .01)` is a modeling floor, **not universally sound for all counts**. Bernoulli events and other underdispersed counts need not have variance at least their mean.

New executable counterexample: `evaluatePortableSeasonGame` forces conditional GP and GS means to one (`evaluator.ts:440-453`) but still uses the supplied conditional variances (`:454-479`). For play=.8/start=.5 and conditional variances 1/1 it returns GP variance=.96 and GS variance=.75, violating their Bernoulli variances .16/.25. This artifact passes the evaluator’s contract check (`:176-189`), which verifies version/metadata rather than these moment invariants. The example establishes an accepted-input defect, not its frequency in saved artifacts; GP policies with zero residual scale can avoid it accidentally.

Require finite, explicitly defined policy scales; preserve valid zero scales with provenance. For GP/GS set conditional event variance to zero by construction and handle probability/parameter uncertainty separately. Compare actual emitted interval coverage prospectively, preserving the W1 consumed-lockbox and randomized-versus-emitted-interval qualifications.

### PR9 · Retain unknown ratios and outcome constraints; avoid unsupported modeling prescriptions

**M-PFC-128, 138–180; dormant or conditional activation blockers.**

- `reconcileProjectionValues({}, "goalie")` actually returns SV%=0, GAA=0, start%=0 and win%=0. Non-finite primitives also become zero (`contracts.ts:461-495`). Preserve unknown, known zero and denominator-zero distinctly throughout API/quantiles/UI. Empty-helper input proves behavior, not that it passed a complete production publication path.
- Ratios of expected totals are coherent **plug-in aggregate ratios**, not generally E[random ratio]. Likewise linear sum identities are sound only for aligned, known components; missing operands should not manufacture known sums.
- Reconciliation does not constrain W+L+OTL≤GP or QS≤GS. Synthetic raw values GP=.8, GS=.5, W=.7, L=.5, OTL=.2, QS=.6 survive as 1.4 decisions and .6 QS. It also leaves SA=1, GA=2, saves=0, violating SA=SV+GA (`contracts.ts:468-472`). These are helper/accepted-input constraints, not observed production rows.
- A multinomial outcome model can reconcile W/regulation-L/OTL/no-decision **conditional on appearance**. QS is not mutually exclusive with those outcomes; constrain it separately to credited starts and Vollman’s definition. Preserve the W1 official-label fix in `season.py:532-563`.
- Wins/starts is not automatically a conventional win percentage when relief wins are included (`contracts.ts:491-494`). Rename or define a verified alternative denominator; do not substitute decisions without deciding the metric.
- Hard-coded 82-season opportunities and the 84 rookie divisor are real (`season.py:3192-3205,3464-3482`). Their bias depends on actual included seasons and eligibility/exposure. The freeze accepts a supplied season list (`:1204-1208`); this review did not inspect a frozen dataset. Fully missed eligible seasons require a roster/opportunity denominator, not invented membership for every calendar year.
- Median-centered shrinkage is a policy/prior choice, not algebraically invalid because the final estimand is a mean. A median of bimodal goalie rates is **not necessarily between the modes**. Compare pooled/role-specific priors, pseudo-counts and recency policies on held-out outcomes. Do not mandate mean priors or decay without evidence.
- D8’s individual-game GAA/SV% outcome extraction (`settlement.ts:200-209`) is numerically correct for that game. A five-minute 1-GA stint really has 12 GAA. Equal-game scoring targets a different estimand from pooled season ratios; prefer count/denominator evaluation for aggregate fantasy ratios, but do not call per-game ratios wrong without identifying the declared target.

## Entry disposition

IDs are M-PFC. “Retain” is bounded source support, not predictive qualification. Grouped rows cover every entry; original verdict counts are not reissued.

| ID(s) | Peer-review disposition |
|---|---|
| 121 | Conditional wrong coverage for supplied unknown-zero bridge rows; executed 3/3 result. Loader reach qualified. PR4. |
| 122 | Rounding rejection confirmed. Partial mass allowed correctly; source basis, warnings and native-versus-bridge distinctions matter. PR3–5. |
| 123 | Retain fail-closed reviewed-target and native-universe gates, but current-bridge authorization is an explicit branch (`rsoUsePolicy.ts:129`), not evidence that all projections are qualified. |
| 124 | UTC mechanics correct for declared policy; NHL-slate choice and all consumers need coordinated change. PR6. |
| 125 | Preview remains unapproved; appearance/start mismatch requires hypothetical integration; PP failure requires reduced schema. PR5/7. |
| 126 | Receipt integration and count population gaps confirmed; withdraw proven-DNP/full-cohort bias claims. PR1/2. |
| 127 | Preserve absent-as-unknown until complete identity evidence; ratio extraction sound per game, aggregate objective separate. PR1/9. |
| 128 | Fixed denominators/availability policy deserve validation; not every median/no-decay choice is a proven defect. PR9. |
| 129 | Missing scale fallback unsafe but no universal zero-width consequence; invalid proposed test replaced. PR8. |
| 130 | Retain narrow final-boxscore/conditional pilot contract (`forge_walk_forward.py:131-150,623-640`); no pipeline replay or provider call. |
| 131 | Retain: sole caller sets reconcile_each_quantile=false (`advanced.py:1831-1852,2103-2108`); no claim of calibrated quantiles. |
| 132 | Mixture moment identity correct for finite valid conditional moments (`aggregation.py:16-27`); aggregation covariance/normal bands are separate W1 limitations. |
| 133 | Retain clipped nonnegative context mean on named function inspection (`challenger_model.py:94-98`), not train/serve parity certification. |
| 134 | Retain explicit position-prior fallback (`challenger_model.py:155-169`), subject to W1 caller/parity qualifications. |
| 135 | Retain descriptive-only/no-promotion labeling (`daily_board_context.py:219-236`); no fit replay. |
| 136 | Whole-team exclusion/label checks are sound (`daily_board_goalies.py:24-79`). An outcome outside issued pool throws at :55-56; groups with labels summing !=1 are counted/excluded at :73-75. Do not conflate these behaviors. |
| 137 | Retain retrospective temperature-fit/chronology/provenance limits (`daily_board_goalies.py:120-146`; `daily_board_models.py:140-157`); no prospective calibration claim. |
| 138–142 | Retain known aligned-component linear identities; unknown propagation and reconciliation scope qualify “exact.” `contracts.ts:566-589,606-610`. |
| 143–144 | Retain undefined ratio issue. `contracts.ts:477-482,594-596`; PR9. |
| 145 | xGA−GA sign correct with same source/scope; missing GA must not become zero. `contracts.ts:495-499`. |
| 146,148,150 | Retain zero-denominator danger SV% issue; danger components separately clamp GA≤SA. `contracts.ts:500-510`. |
| 147,149,151 | Retain danger saves identity after that clamp; clipping is reconciliation, not proof input model was coherent. |
| 152–154 | Retain missing/zero-denominator on-ice share issue. `contracts.ts:611-624`. |
| 155,157–158,161–163 | Retain aligned known-component sum identities. `contracts.ts:468-472,569-589`; whole-goalie saves additionally need GA≤SA validation. |
| 156,160,164–167 | Retain undefined ratios; 167 also wins-per-start labeling. `contracts.ts:473-495,590-604`; PR9. |
| 159 | GP−GS relief expectation identity valid only with coherent probabilities; max(0,...) can conceal inconsistent inputs. `contracts.ts:483-486`. |
| 168–174 | Remain empirically undetermined. Declared heads and context evaluator are not trained-artifact evidence; units, population, source coverage and reconciliation must be qualified. |
| 175 | Retain QS label/credited-start constraint, separately from decision multinomial. PR9. |
| 176–177 | Mean event probabilities structurally sound; added conditional-variance counterexample means whole-head “sound” is too broad. PR8. |
| 178 | Nonnegative GA mean alone insufficient: whole-line GA≤SA invariant must be enforced. PR9. |
| 179–180 | Retain official regulation-L/OTL mapping and coherent outcome constraint, no assumed provider semantics. PR9. |

## Fix order and owner questions

1. Preserve unknown outcome and source evidence. Build the receipt and basis/population contract, then change each scorer according to its own event, including diagnostics and market comparisons.
2. Fix probability precision and distinct-candidate accounting without normalizing unknown mass. Correct bridge unknown-zero permissions/coverage at the same time, including RSO selection, totals and drop logic.
3. Before season/native integration, make conditional basis explicit, enforce GP/GS and goalie outcome invariants, propagate undefined ratios and qualify relief/candidate-specific models.
4. Decide whether calendar horizons promise UTC days or NHL schedule dates. This is the remaining substantive product choice. Incomplete counts are already required by decision 47; exact residual-mass placement is a UX detail, not permission to hide unknowns.
5. Confirm scoreboard audience only if needed for release priority, not to decide whether the math matters. Existing source and synthetic counterexamples are sufficient to plan a fix without fresh production reads.

## Reproduction and verification

**Passed:** commit/source comparisons; source and contract review; the actual-function synthetic cases below; deterministic rounding simulation. **Not run:** application suites, builds, DB/provider reads, production routes, trained artifact replay, fitted calibration, visual browser verification or deployment checks.

Run from `web/` with installed dependencies. This extracts the sole `js` block from this report and executes it through stdin, without creating a script file:

```sh
python3 - <<'PY' | node
from pathlib import Path
p = Path("../tasks/artifacts/calculation-inventory-2026-11-10/master/W1-Astra-PR/w2-player-forecasts-season-part3.md")
s = p.read_text()
print(s.split("\x60\x60\x60js\n", 1)[1].split("\n\x60\x60\x60", 1)[0])
PY
```

The fixtures use real source modules and synthetic data. The permission change in BASIS_INTEGRATION is explicitly counterfactual, not an activation. Endpoint/body data are never requested. Normalized-uniform simulation is not a model of empirical goalie shares.

```js
const esbuild = require("./node_modules/esbuild"), assert = require("node:assert/strict");
const entry = `export * from './lib/rosterScheduleData/forgeDailyBridge';export * from './lib/player-forecasts/planningContributions';export * from './lib/player-forecasts/servedForecastLedger';export * from './lib/player-forecasts/schedule';export * from './lib/player-forecasts/contributions';export * from './lib/player-forecasts/seasonGameContributions';export * from './lib/fantasy-projections/contracts';export * from './lib/fantasy-projections/evaluator';export * from './lib/player-forecasts/calendarCoverage';`;
const out = esbuild.buildSync({ stdin: { contents: entry, resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "cjs", write: false, logLevel: "error" });
global.fetch = () => {
  throw Error("NETWORK_FORBIDDEN");
};
for (const k of ["http", "https"]) {
  const h = require(k);
  h.request = h.get = () => {
    throw Error("NETWORK_FORBIDDEN");
  };
}
const m = { exports: {} };
new Function("module", "exports", "require", out.outputFiles[0].text)(m, m.exports, require);
const f = m.exports;
const now = /* @__PURE__ */ new Date("2026-10-19T18:00:00Z"), seasonId = 20262027, gameId = 2026020002;
const member = (id) => ({ id: String(id), nhlId: 200 + id, nhlTeamId: 10, rosterRevision: "roster-" + id, name: "Goalie " + id, teamAbbreviation: "TOR", eligiblePositions: ["G"], eligibilityVerified: true, playerClass: "goalie", availability: "free_agent", ownership: null, canDrop: true, holdValue: null, reserveEligibility: [] });
const players = [1, 2, 3].map(member), games = [{ id: String(gameId), date: "2026-10-19", startsAt: "2026-10-19T23:00:00Z", teamAbbreviation: "TOR", opponent: "MTL", home: true, status: "scheduled", scheduleRevision: "schedule-1" }];
function bridgeFixture(shares) {
  return f.buildForgeDailyBridgeForecasts({ runs: [{ run_id: "r2", as_of_date: "2026-10-19", created_at: "2026-10-19T12:00:00Z", git_sha: "fixture", external_input_proven: true }], skaters: [], goalies: [{ run_id: "r2", as_of_date: "2026-10-19", horizon_games: 1, game_id: gameId, goalie_id: 201, team_id: 10, starter_probability: shares[0], proj_saves: 30, proj_goals_allowed: 3, proj_shots_against: 33, proj_win_prob: 0.55, proj_shutout_prob: 0.05 }], goalieShares: shares.flatMap((p, i) => p == null ? [] : [{ player_id: 201 + i, team_id: 10, game_id: 2026020001, game_date: "2026-10-18", l10_start_pct: p, season_start_pct: p, updated_at: "2026-10-19T10:00:00Z" }]) }, players, games, now, seasonId, f.forecastCalendarPolicy());
}
function snapshot(forecasts) {
  return { id: "fixture", context: { provider: "manual", seasonId, leagueId: "L", teamId: "T", startDate: "2026-10-19", endDate: "2026-10-19", timeZone: "America/New_York", asOf: now.toISOString() }, players, games, forecasts, roster: [], rules: {}, lockedAssignments: [], realized: {}, opponent: null, evidence: {} };
}
{
  const b = bridgeFixture([0.33337, 0.33337, 0.33326]), r = f.resolvePlanningContributions(snapshot(b.forecasts));
  console.log("ROUNDING", JSON.stringify({ before: b.forecasts.map((x) => [x.playerId, x.startProbability, x.stats.SAVES_GOALIE]), after: r.forecasts.map((x) => [x.playerId, x.startProbability, x.stats.SAVES_GOALIE, x.allowedUses]), reasons: r.forecastInputExclusions }));
  const partial = bridgeFixture([0.6, 0.2, null]);
  console.log("PARTIAL", JSON.stringify({ rows: partial.forecasts.map((x) => [x.playerId, x.startProbability, x.stats.SAVES_GOALIE, x.allowedUses]), limitations: partial.limitations }));
  const raw = b.forecasts.map((x, i) => ({ ...x, startProbability: [0.33337, 0.33337, 0.33326][i] }));
  console.log("UNROUNDED_SURVIVES", f.resolvePlanningContributions(snapshot(raw)).forecasts.map((x) => x.stats.SAVES_GOALIE));
  assert.deepEqual(b.forecasts.map((x) => x.startProbability), [0.3334, 0.3334, 0.3333]);
  assert(r.forecasts.every((x) => x.stats.SAVES_GOALIE === null));
  assert(f.resolvePlanningContributions(snapshot(raw)).forecasts.every((x) => x.stats.SAVES_GOALIE !== null));
}
{
  const b = bridgeFixture([0.7, 0.3, null]);
  const input = { date: "2026-10-19", seasonId, now, games: [{ gameId, date: "2026-10-19", scheduledAt: games[0].startsAt, status: "scheduled", homeTeamId: 10, awayTeamId: 8 }], players: players.slice(0, 2).map((p) => ({ nhlId: p.nhlId, planningId: p.id, playerClass: "goalie", teamId: 10 })), bridgeForecasts: b.forecasts, runDates: /* @__PURE__ */ new Map([["r2", "2026-10-19"]]), scheduleGames: [], wgoGameRows: [], goalieGameRows: [] };
  const built = f.buildLedgerRows(input);
  const actuals = { skaters: [], goalies: [{ game_id: gameId, player_id: 201, games_started: 1, saves: 30, goals_against: 3, shots_against: 33, wins: 1, shutouts: 0 }] };
  for (const complete of [false, true]) {
    const settled = f.settleLedgerRows(built.rows, { ...actuals, ...complete ? { completeScopes: [{ gameId, teamId: 10, playerClass: "goalie", final: true, complete: true }] } : {} }, "2026-10-20T12:00:00Z");
    const score = f.scoreLedger(settled)[0];
    assert.equal(score.heads.saves.n, 1);
    assert.equal(score.heads.saves.expected, 21);
    assert.equal(score.binary.start.n, complete ? 2 : 1);
    console.log("LEDGER", JSON.stringify({ complete, rows: settled.map((x) => [x.player_id, x.dressed, x.started, x.act_saves]), saveN: score.heads.saves.n, saveExpected: score.heads.saves.expected, saveActual: score.heads.saves.actual, startN: score.binary.start.n, startBrier: score.binary.start.brier, population: score.scoringPopulation }));
  }
  const official = [201, 202], badIngest = [201, 999];
  console.log("COUNT_RECEIPT_COUNTEREXAMPLE", JSON.stringify({ official, badIngest, countsEqual: official.length === badIngest.length, absent202ActuallyAppeared: true }));
  const nowWinter = /* @__PURE__ */ new Date("2026-12-01T12:00:00Z");
  const ws = [{ id: 1, date: "2026-12-14", startTime: "2026-12-14T18:00:00Z", type: 2, seasonId, homeTeamId: 10, awayTeamId: 8 }, { id: 2, date: "2026-12-14", startTime: "2026-12-15T00:00:00Z", type: 2, seasonId, homeTeamId: 6, awayTeamId: 5 }];
  console.log("WINTER_HORIZON", JSON.stringify({ leads: ws.map((g) => f.calendarLeadDay(g.startTime, nowWinter.toISOString())), scopes: f.buildCalendarGameScopes({ games: ws, now: nowWinter, days: 14 }).map((g) => g.gameId) }));
  assert.deepEqual(ws.map((g) => f.calendarLeadDay(g.startTime, nowWinter.toISOString())), [13, 14]);
}
{
  let artifact = function(prior) {
    return { schemaVersion: "player-forecast-season-artifact-v1", seasonId, contractVersion: f.FANTASY_PROJECTION_V5_CONTRACT_VERSION, contractChecksum: f.FANTASY_PROJECTION_V5_CONTRACT_CHECKSUM, artifactVersion: "synthetic", featureSchemaVersion: "synthetic", trainingCutoffAt: "2026-04-16T23:59:59Z", codeVersion: "synthetic", players: { "1": { fhfhPlayerId: 1, nhlPlayerId: 201, teamId: 10, ratings: {}, deployment: {}, ...prior } }, teams: {} };
  };
  var artifact2 = artifact;
  const binding = { playerId: 1, nhlPlayerId: 201, teamId: 10, gameId, opponentTeamId: 8, isHome: true, seasonId, scheduledAt: games[0].startsAt, scheduleRevision: "schedule-1", rosterRevision: "roster-1", observedAt: "2026-10-19T10:00:00Z" };
  const skaterRates = { ...Object.fromEntries([...f.SKATER_PRIMITIVE_TARGETS, ...f.SKATER_FANTASY_V4_PRIMITIVE_TARGETS].filter((k) => k !== "PP_ASSISTS").map((k) => [k, 0])), GAMES_PLAYED: 1, GOALS: 0.5, PRIMARY_ASSISTS: 0.4, SECONDARY_ASSISTS: 0.3, PP_GOALS: 0.1, PP_PRIMARY_ASSISTS: 0.2, PP_SECONDARY_ASSISTS: 0.1 };
  for (const hasPpa of [false, true]) {
    const rates = { ...skaterRates, ...hasPpa ? { PP_ASSISTS: 0.3 } : {} };
    const a2 = artifact({ population: "forward", position: "C", playProbability: 0.8, conditionalRates: rates, conditionalVariances: {}, primitiveTargets: Object.keys(rates) });
    const ev2 = f.evaluatePortableSeasonGame(a2, 1, { gameId, teamId: 10, opponentTeamId: 8, isHome: true, scheduledStartAt: games[0].startsAt });
    const prev = f.prepareSeasonGameContribution(a2, binding, "2026-10-19T12:00:00Z", games[0].startsAt, now);
    console.log("PP_SUPPORT", JSON.stringify({ hasPpa, evaluator: ev2.unconditionalMeans.PP_POINTS, preview: prev.forecast.stats.PP_POINTS, reason: prev.missingTargets.find((x) => x.targetKey === "PP_POINTS"), denied: prev.forecast.allowedUses }));
  }
  const a = artifact({ population: "goalie", position: "G", playProbability: 0.8, startProbability: 0.5, conditionalRates: { GAMES_PLAYED: 1, GAMES_STARTED: 1, SHOTS_AGAINST_GOALIE: 30, GOALS_AGAINST_GOALIE: 3, TOTAL_TOI: 3600, WINS_GOALIE: 0.4, SHUTOUTS_GOALIE: 0.05 }, conditionalVariances: { GAMES_PLAYED: 1, GAMES_STARTED: 1 }, primitiveTargets: ["GAMES_PLAYED", "GAMES_STARTED", "SHOTS_AGAINST_GOALIE", "GOALS_AGAINST_GOALIE", "TOTAL_TOI", "WINS_GOALIE", "SHUTOUTS_GOALIE"] });
  const ev = f.evaluatePortableSeasonGame(a, 1, { gameId, teamId: 10, opponentTeamId: 8, isHome: true, scheduledStartAt: games[0].startsAt });
  console.log("BERNOULLI_VARIANCE", JSON.stringify({ gp: ev.variances.GAMES_PLAYED, correctGp: 0.8 * 0.2, gs: ev.variances.GAMES_STARTED, correctGs: 0.5 * 0.5 }));
  const raw = f.prepareSeasonGameContribution(a, binding, "2026-10-19T12:00:00Z", games[0].startsAt, now);
  const sn = snapshot([raw.forecast]);
  sn.players = sn.players.slice(0, 1);
  sn.baselineSources = [{ kind: "baseline", playerId: 1, nhlPlayerId: 201, seasonId, teamId: 10, targetKey: "SAVES_GOALIE", basis: "per_start", unit: "count", mean: 27, participationIntegrated: false, sourceId: "unreleased-fixture", policyVersion: "synthetic", released: false, cutoffAt: "2026-10-18T00:00:00Z", issuedAt: "2026-10-18T01:00:00Z", expiresAt: games[0].startsAt, sourceWatermark: "synthetic", scheduleRevision: "schedule-1", rosterRevision: "roster-1" }];
  const denied = f.resolvePlanningContributions(sn).forecasts[0];
  sn.forecasts = [{ ...raw.forecast, allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false } }];
  const allowed = f.resolvePlanningContributions(sn).forecasts[0];
  console.log("BASIS_INTEGRATION", JSON.stringify({ emitted: raw.forecast.stats.SAVES_GOALIE, conditional: raw.forecast.conditionalStats.SAVES_GOALIE, asIssuedResolved: denied.stats.SAVES_GOALIE, hypotheticallyPermittedResolved: allowed.stats.SAVES_GOALIE }));
  const wrong = f.reconcileProjectionValues({ GAMES_PLAYED: 0.8, GAMES_STARTED: 0.5, WINS_GOALIE: 0.7, LOSSES_GOALIE: 0.5, OTL_GOALIE: 0.2, QUALITY_STARTS_GOALIE: 0.6, SHOTS_AGAINST_GOALIE: 1, GOALS_AGAINST_GOALIE: 2, TOTAL_TOI: 3600 }, "goalie");
  console.log("GOALIE_UNCONSTRAINED", JSON.stringify({ decisions: wrong.WINS_GOALIE + wrong.LOSSES_GOALIE + wrong.OTL_GOALIE, gp: wrong.GAMES_PLAYED, qs: wrong.QUALITY_STARTS_GOALIE, gs: wrong.GAMES_STARTED, sa: wrong.SHOTS_AGAINST_GOALIE, saves: wrong.SAVES_GOALIE, ga: wrong.GOALS_AGAINST_GOALIE }));
  assert.equal(ev.variances.GAMES_PLAYED, 0.96);
  assert.equal(ev.variances.GAMES_STARTED, 0.75);
  assert.equal(denied.stats.SAVES_GOALIE, null);
  assert.equal(allowed.stats.SAVES_GOALIE, 13.5);
  const empty = f.reconcileProjectionValues({}, "goalie");
  assert.equal(empty.SAVE_PERCENTAGE, 0);
  assert.equal(empty.GOALS_AGAINST_AVERAGE, 0);
  console.log("EMPTY_RATIOS", JSON.stringify(empty));
  const zeroVariance = structuredClone(a);
  zeroVariance.players["1"].playProbability = 0.5;
  zeroVariance.players["1"].conditionalRates.GOALS_AGAINST_GOALIE = 10;
  zeroVariance.players["1"].conditionalVariances.GOALS_AGAINST_GOALIE = 0;
  const mixed = f.evaluatePortableSeasonGame(zeroVariance, 1, { gameId, teamId: 10, opponentTeamId: 8, isHome: true, scheduledStartAt: games[0].startsAt });
  assert.equal(mixed.variances.GOALS_AGAINST_GOALIE, 25);
  console.log("ZERO_CONDITIONAL_VARIANCE", mixed.variances.GOALS_AGAINST_GOALIE);
}
{
  const b = bridgeFixture([0.6, 0.2, null]), sn = snapshot(b.forecasts);
  sn.games.push({ ...games[0], teamAbbreviation: "MTL", opponent: "TOR", home: false, scheduleRevision: "schedule-2" });
  const scopes = [{ teamId: 10, opponentTeamId: 8, teamAbbreviation: "TOR", scheduleRevision: "schedule-1" }, { teamId: 8, opponentTeamId: 10, teamAbbreviation: "MTL", scheduleRevision: "schedule-2" }].map((side) => ({ ...side, scopeKey: gameId + ":" + side.teamId, gameId, seasonId, homeTeamId: 10, awayTeamId: 8, gameDate: "2026-10-19", scheduledStartAt: games[0].startsAt, teamGameHorizon: 1, calendarLeadDay: 0, queueCompatible: true }));
  const c = f.summarizeCalendarConsumerCoverage(sn, scopes, { skaterTargets: [], goalieTargets: ["SAVES_GOALIE"] }, sn.context);
  console.log("UNKNOWN_COVERAGE", JSON.stringify({ required: c.requiredPlayerGameTargets, eligible: c.eligiblePlayerGameTargets, assignment: c.assignmentEligiblePlayerGameTargets, totals: c.totalsEligiblePlayerGameTargets, comparison: c.comparisonEligiblePlayerGameTargets, exclusions: c.exclusions }));
  assert.equal(c.requiredPlayerGameTargets, 3);
  assert.equal(c.eligiblePlayerGameTargets, 3);
}
{
  let seed = 20261111, rejected = 0;
  const rnd = () => (seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296;
  for (let i = 0; i < 2e5; i++) {
    const a = [rnd(), rnd(), rnd()], s = a.reduce((x, y) => x + y, 0);
    if (a.reduce((x, y) => x + Math.round(y / s * 1e4) / 1e4, 0) > 1.000001) rejected++;
  }
  console.log("SIMULATION", JSON.stringify({ draws: 2e5, seed: 20261111, rejected, rate: rejected / 2e5 }));
  assert.equal(rejected, 25209);
}
console.log("All synthetic mechanism assertions passed.");
```
