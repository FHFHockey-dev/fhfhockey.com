# BLSH / VuDu goalie adapter assessment

2026-11-07. Local source inspection only. No application changes.

## Result

A lossless, real-data goalie adapter cannot be accepted from the inputs identified in this bounded review. Reusable observed-receipt parsing and canonical forecast arithmetic exist, but the inspected materials do not provide a pinned, accepted current-season goalie cohort plus a compatible admitted FORGE response for an end-to-end trace. Adding a wrapper that still returns `pending_goalie_adapter` would not close that gap. No such wrapper was added.

This does not mean all goalie data or released forecasts are absent elsewhere. It means no qualifying goalie input packet was supplied or established by the named source-readiness/audit materials and bounded local contract inspection. No provider/database read was attempted to fill the gap.

The two distinct future outcomes must not be conflated:

1. **Descriptive observed-versus-forward view:** supported by the Sko PRD once exact observed and canonical expected quantities have matching identity, event universe, units, scope, eligibility and permitted uses. Arithmetic alone requires no new fitted threshold or prior. A ratio of expected totals is not the expectation of a realized ratio or a personal retrospective expectation.
2. **BLSH personal retrospective goalie gap:** no accepted goalie reference/method/source decision was established. A recent-versus-prior observed block is descriptive history, not a counterfactual or personalized expected value. A FORGE forward difference cannot be relabeled to fill this requirement.

## Existing reusable contracts

| Boundary | Supported now | Qualification retained |
| --- | --- | --- |
| `baselineSourceLineage.ts:318-381` | Derive SV, SA, GA and minutes from retained final boxscore content; require coherent integer counts; verify player/team/game identity and bound payload/content hashes. | Positive-minute appearance adapter only. `baselineAppearanceFromBoxscore` returns null for zero-minute rows, so its missing result cannot establish a completed team-game nonappearance. Its `availableAt` is the capture cutoff; original `rawRow.fetched_at` is separately retained. Neither may be rewritten to today's time. |
| `nativeGoalieOutcomes.ts:22-88` | Explicit starter/decision receipt; distinguish relief wins and missing decisions; retain original source hashes/clocks. | Historical observed labels, `forecastIssued=false`, `released=false`, `qualificationEligible=false`. Missing decision stays unknown. Zero GA does not prove credited SO. |
| `nativeGoalieOutcomes.ts:178-217` | Source-recorded starter flag, including explicit false on a listed zero-minute goalie; microsecond source clocks preserved. | False means not a starter, not necessarily no appearance. Missing or ambiguous flags stay unknown. No future start probability is inferred. |
| `goalieBaselineRates.ts:29-35,221-254` | Existing native current-season SV/GA/SA/minute means use the same appearance cohort; relief included. | Explicit unvalidated rate policy, historical `populationCoverage=unverified`, no participation supplied. Reusing or admitting those means as the product's expectation is a separate producer/policy decision, not an adapter detail. |
| `gameExpectations.ts:16-65,172-240` | Canonical game-level conditional/unconditional targets; allowed uses, per-source IDs/versions/watermarks/clocks and participation; aggregate expected counts/minutes and starts; weighted SV%/GAA from expected primitive totals. | Complete scheduled horizon and admitted dependencies required. Ratios remain `ratio_of_expected_totals`. No repeated participation multiplication. This view's numeric target labels do not independently establish original shot-event universe or observation population coverage. |
| `skoElement/contract.ts:49-95,174-196` and `interpret.ts:149-188` | Observed pooled SV/SA/GA/minutes, prior disjoint block, known starts/relief, expected ratios/starts, explicit pending gap. | Observation contract lacks full per-game receipt lineage, season/fingerprint and credited W/SO fields. `InterpretationRecord` retains high-level forecast identity but not all canonical per-target receipts and allowed uses. A cast into this reduced record is not lossless. |
| `sko/gap.ts:72-101` | Native saves-per-100-on-net-shots arithmetic with explicit expected shot population. | Unknown or unblocked-attempt expected population returns null. No data admission, baseline choice, context standardization, quality model or predictive calibration is supplied by this utility. |

The companion requirements explicitly allow missing optional risk/calibration information without blocking an otherwise qualified simple comparison (`prd-sko-element.md`, FR-05). Those optional fields are not being invented as a blocker here. Required identity, population, scope, conditioning and evidence admission remain unresolved for the requested real goalie trace.

## Why an appearances-only conversion would be unsafe

Sko selects recent/prior windows from completed **team games**, independently of the future 5/10/20-game horizon. The existing goalie appearance capture is not that population:

- `BaselineHistoricalSourceReceipt.populationCoverage` is explicitly `unverified` (`baselineSourceLineage.ts:27-35`).
- A goalie can be a nonstarter and still appear in relief. A missing appearance, missing player row or false starter flag is not a verified zero-output nonappearance.
- Dropping unavailable team games would backfill older appearances and alter both selected windows and denominators.
- Correct SV% and GAA need pooled applicable primitives, not a mean of game ratios. Start share separately needs a complete, identity-bound team-game denominator and explicit starter evidence.
- Zero saves/GA remains zero when observed. Zero shot or minute exposure makes the corresponding ratio unavailable. Missing values, stale evidence and contradictory receipts must remain distinguishable.

A safe adapter therefore needs both a retained completed-team-game cohort and exact per-game observation receipts. It must keep missing rows in the cohort as unknown unless an existing receipt independently proves nonappearance. Full original source and forecast envelopes must accompany any reduced display record; a new hash over a reduced record is not proof of source acceptance.

## Protected boundary and source freshness

`captureCurrentGoalieBaselineInputs` must **not** be called unchanged for this task: its history and roster queries include `[seasonId - 10001, seasonId]` (`goalieBaselineInputCapture.ts:71-83`). For a 2026–27 request that includes the reserved 2025–26 season. Only source code was inspected; the helper was not executed and no holdout data was read.

The existing BLSH November 1 capture remains stale on November 7 under its own 24-hour capture policy, as documented in `SOURCE-READINESS.md`. That packet addresses the skater current-process path and cannot confer goalie admission. No capture was refreshed, repackaged or presented as current. No arm-C baseline or native goalie rate policy was adopted.

## Smallest safe next step

Ask the current source/forecast owner to identify an **already retained**, current-season-only packet for one explicit canonical goalie and one explicit as-of time, without starting new collection. The handoff must contain:

1. Canonical player/NHL identity, season, effective team associations and exact completed team-game IDs/dates for both disjoint observation windows. State verified coverage or retain explicit unknowns; do not silently use appearances as team games.
2. Original final-boxscore payloads and provider-byte/content hashes, source/capture/availability times, canonical game/team identity witnesses and any original explicit starter evidence. Include credited W/SO only when the separate existing outcome receipt supports them.
3. The matching **admitted canonical** `forge-game-expectations-v1` response for the selected 5/10/20 scheduled-team-game horizon, including source and participation receipts, allowed uses, baseline/manifest identity, expiry and limitations. If unavailable, observation-only display remains valid but full VuDu acceptance remains open.
4. Explicit on-net/guarded-net versus empty-net/team-event and strength-scope provenance for the proposed comparison; never derive expected SV% from unblocked-attempt xG divided by official shots.
5. Current exact-file custody for an add-only observation adapter/test and any required companion envelope. Keep canonical producers, shared interpretation/UI and release files outside that grant.

Then build a narrow pure **observed-receipt adapter**, reusing the existing parsers, retaining immutable provenance beside the Sko display input and preserving unknown team games. Review one genuine rendered trace before declaring real-data acceptance. If a personal retrospective gap is required in that pass, first obtain the explicit accepted goalie reference and development-validation plan. Neither the preceding observed block nor the forward forecast resolves that scientific choice.

Required focused regressions: source/player/team/game mismatch, duplicate/conflicting receipts, future and stale clocks, zero versus absent values, zero denominators, relief and explicit start differences, unknown nonappearance, original clock preservation, rate weighting, exact window membership, no double participation, incompatible shot population, and unchanged forwarded source/forecast identity. These are future acceptance tests, not tests claimed to have run here.

## Scope, custody and verification

- Read repository instructions and the named current source-readiness/audit requirements; inspected nearby implementation and tests. File identities are in `INSPECTION-PINS.json`.
- Current broad handoff identifies BLSH/FORGE as Claude-owned outside Scout's retained lanes. Historical lease records were read, but no new exact-file handback or active-writer acknowledgment was obtained. No application source edit was attempted and no ownership was inferred from an idle or historical label.
- Created only this report, its inspection pin receipt and the task diary. No existing app/UI/producer, shared mailbox/lease registry, Git index/ref, release packet or other worker file changed by this task.
- Documentation whitespace/newline check: recorded separately in `CHECKS.json`.
- Application tests, lint, typecheck, browser checks and builds: **not run**. This is a read-only implementation assessment with documentation output; existing test source was inspected, not counted as a passing run.
- No heavy lock needed or acquired. No network/provider/database operation, new source collection, empirical scoring/fitting, reserved holdout read, production activation, push, commit, build or deployment.

Status: assessment complete; real goalie adapter acceptance remains **pending input/method/custody evidence**, not tool-denied and not attempted with uncertain outcome.
