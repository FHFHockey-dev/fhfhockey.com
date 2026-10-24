# P07 — detailed forecast approval boundary

**Result: FE-02c's documented gap is reproduced at the local admission/permission boundary.** Seven offline checks pass as reproductions and controls. No application change, approval receipt, native activation, production query or NST operation was made. This does not demonstrate an unauthorized deployed recommendation or model inaccuracy.

**Later policy update:** TJ selected option2; FORGE lead owns implementation. [Decision receipt](P07-SELECTED-POLICY.md) and [acceptance matrix](P07-CONSUMER-ACCEPTANCE.md) supersede pending-selection notes in this historical audit. The seven executed reproductions remain unchanged.

## Concrete counterexamples

1. The repository's existing fictional issued-goalie fixture has valid schedule/roster identity, captured-read fingerprint, expiry, external-fantasy-input exclusion and a 0.5 starter probability with 30 conditional saves. It contains **no target/use approval receipt**. `publicPlanningForecasts` emits expected saves **15** and permits assignment, totals and comparison. The actual `forecastAllows` helper accepts totals/comparison. The actual pure `resolveContribution` also retains mean15 with all three permissions and no exclusion.
2. A separate synthetic skater has valid confirmed-line evidence, appearance probability1 and HITS=3. Its real payload fields are `modelMode: candidate` and `codeVersion: synthetic-unreviewed-candidate`; no target/use receipt is supplied. The same admission boundary emits HITS=3 with all three permissions. This demonstrates that these metadata fields are not bound to a reviewed scope at this boundary. It does not simulate a real candidate run or prove that a deployed reader selects such a revision.

Controls preserve existing strengths: removing the external-fantasy exclusion contract denies admission; wrong schedule identity and future publication deny admission. Passing assignment-only permissions into the actual resolver preserves mean15 but denies totals/comparison with `use_not_approved`. Missing permissions deny all three uses. Therefore FE-02b's independent consumer mechanism works for the exercised controls; the upstream grant supplies broader authority than it can independently justify.

[P07-PROBES.cjs](P07-PROBES.cjs) extracts exact current pure declarations with the installed TypeScript compiler and executes them in VM contexts. [P07-PROBES.json](P07-PROBES.json) pins nine source/test files and records every executed declaration and result. No mocks replace identity hashing, time checks, admission, participation arithmetic, resolver permissions or the planner helper. Fictional fixtures originate in `planning.test.ts:35–55`. Resolver inputs mirror the adapter's inspected field construction; **the full planning adapter, whole-plan engine, RPC, browser and deployment were not executed**.

Command, Node22.11.0:

```sh
node tasks/artifacts/fhfh-sprint-ledger-2026-10-22/P07-PROBES.cjs
```

The first run covered an arbitrary metadata change on the goalie fixture. The final run strengthened that case to an actual skater branch with confirmed participation and HITS; both runs passed. Only the final seven-case receipt is the current probe evidence; counts are not added.

## Actual trace and boundaries

| Source / function | Inspected behavior | Implication |
|---|---|---|
| `calibrationEligibility.ts:3,21–27` | `excluded_from_native_inputs_v1` attests exclusion of external fantasy inputs. | It is an input-provenance contract, not target/use approval. |
| `gameRevisions.ts:180–191` | Issued payload carries model mode/code, captured provenance and board evidence. | No typed target-specific use approval in this envelope. Publication/runtime authority was not re-audited here. |
| `consumerRevisionAdmission.ts:38–127,148–206` | Strong identity, schedule, captured-time, horizon and usable-value checks precede unconditional A/T/C at line121. `modelVersion` carries codeVersion; modelMode is not a permission predicate. | Location of the broad grant. Existing `use_not_approved` at line89 checks only the input-exclusion contract. |
| `consumerRevisionAdmission.ts:210–242` | Accepted-news read fails closed and stale revisions are rejected; forecasts then return from the pure adapter. | No later target-use narrowing in this wrapper. This wrapper was source-inspected, not executed. |
| `rosterScheduleData/planning.ts:176–177,204–210` | Calls the shared admission module; manifest includes issued revisions, input identities and baseline/participation checksums. | Approval identity/revocation would need coherent transport/cache/retained treatment; do not attach approval to a current timestamp alone. |
| `planningContributions.ts:182–197,227–232` | For each target, constructs a detailed source with `released:true`, copying `original.allowedUses` into both source and participation. Resolver then controls assignment versus totals. | Current raw row-level permissions apply to every supplied target. A target-specific change cannot stop at replacing one literal. |
| `contributions.ts:146–183,267–360` | Checks source identity/time/conditioning and independently intersects allowed uses, including participation permissions. | Reuse this completed mechanism. Do not make non-null means or `released:true` substitutes for producer approval. |
| `rosterScheduleOptimizer/planning.ts:99–101,122,249,308–311` | Raw rows use row permissions; resolved rows use target permissions. Assignment, totals and comparison consumers consult them. | Demonstrated local permission effects have a real consumer; no complete-plan numerical outcome was tested. |
| `planningTypes.ts:82–108`; `planningDataTransport.ts:18,35–41,51–56` | Raw `GameForecast.allowedUses` is row-level; resolved contributions are target-level. Wire shapes preserve existing permissions. | Any target map/receipt design must survive transport and saved inputs; exact retained-schema edits require a separate lease. |
| `nativeContributionAdmission.ts:74–100` | Separate baseline loader obtains an approved bundle and validates retained original inputs. | Baseline approval does not automatically approve detailed FORGE. This loader was not executed or comprehensively reviewed. |
| `starterBoardScoring.ts:173–202,239–245` | Expected goalie values use start-only/zero-relief assumptions. Board scores expected/conditional/legacy values independently of RSO A/T/C. | This packet does not change goalie formulas or Starter Board scoring; coordinate that investigator and preserve existing board scope. |

Exact inspection pins, including additional source-only paths, are in [P07-SOURCES.json](P07-SOURCES.json). No claim that every line of these files or their dependency graph was vetted.

## Smallest useful next scope

The current [FE-02c decision matrix](/Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:162) explicitly says **the owner chooses the retained-component policy before implementation binds it**. It distinguishes retained provisional A/T/C, review-before-quality use, and a narrow skater assignment-only option. None is recorded there as selected. Preserve existing provisional serving policy where it applies; a silent blanket withdrawal or new accuracy threshold would exceed this audit.

1. **Parent/forecast policy owner identifies the authoritative retained scope:** exact model/component/configuration/code, supported targets, conditioning, participation/adjustment assumptions, independent uses, validity and revocation. Current code hashes, serving flags and canary membership are not policy evidence. The goalie start-only/zero-relief choice remains separate from the active scientific audit.
2. **Prepare one local contract/admission packet after that decision:** trusted policy resolution into `consumerRevisionAdmission`, then target-specific propagation through `GameForecast` and `planningContributions`. Prefer existing contribution permission structures; decide representation only after tracing the existing transport/saved-schema constraints. Do not accept a policy claim supplied by an untrusted client. No producer model, SQL publish, hosted receipt, flag, queue or cron change is inherent in this packet.
3. **Acceptance cases:** assignment-only versus totals-only versus comparison; two targets with different permissions in one row; missing/revoked/expired/wrong-model/conditioning evidence; current permission revocation after refresh/reload; denied participation versus approved target; mixed compatible source permissions; legacy snapshots without new evidence; preserved capacity/locks/realized values. Extend nearest existing reader/resolver/transport/saved-schema tests, using P07's valid identity/time controls.
4. **Review the exact local bytes before integration.** Keep Starter Board untouched under this RSO-only slice unless parent separately authorizes a shared board policy. No claim that permission work supplies missing PK, goalie minutes, participation, historical qualification or default mixed-roster usefulness.

P07 audit owner is this ledger task; **application implementation remains unassigned and policy-dependent**. No new worker was launched. P02 stays coordinated with the existing sKO/VuDu investigator; no duplicate formula audit was performed.

## Policy provenance follow-up

[P07-DECISION.md](P07-DECISION.md) distinguishes explicit retained TJ legacy/source/bridge/native decisions from the still-unselected detailed target/use matrix. Additional call-site inspection confirms Start Chart shares admission and its native loader shares loadPlanningData; RSO empty admission can trigger the interim bridge. Therefore “preserve Starter Board” above is a required acceptance constraint, not a claim that editing shared admission is mechanically RSO-only. No new behavior tests or policy choice were made.
