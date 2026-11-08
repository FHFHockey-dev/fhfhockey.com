# Player Cards / Social Share: coverage, ownership and dependencies

Planning snapshot: 2026-10-31, `/Users/tim/Code/fhfhockey.com`, `octoberBranch`, initial HEAD `18078d3d9783a6fbc6d123e37fdaf3489b3f3ecc`. **Local planning only. Parent confirmation pending; detailed subtasks and worker execution have not started.**

## Deliverables and actual rule behavior

| Lane / artifact | Location |
| --- | --- |
| Player Cards plan / PRD | [Player Cards evolution](TASKS/prd-player-cards-evolution-2026-10-31.md) |
| Player Cards task list | [PC parents](tasks-prd-player-cards-evolution-2026-10-31.md) |
| Social Share plan / PRD | [Social Share expansion](TASKS/prd-social-share-expansion-2026-10-31.md) |
| Social Share task list | [SS parents](tasks-prd-social-share-expansion-2026-10-31.md) |
| Three separate self-contained handoffs | [Claude worker, Astra audit, Astra cards worker](player-cards-social-share-handoffs-2026-10-31.md) |

The actual rules are [generate-tasks.mdc](TASKS/rules/generate-tasks.mdc) and [process-task-list.mdc](TASKS/rules/process-task-list.mdc), not `.cursor/rules`. Generation normally creates parents and subtasks in one pass. Step 4 instead says: **“If the PRD is ambiguous, unusually large, contains major architectural forks, or presents meaningful strategic uncertainty, generate only the parent tasks first and ask for confirmation before expanding into sub-tasks.”** This request spans two substantial products, new goalie methods and source/ownership gates. Therefore 8 PC and 13 SS parents are created; subtask expansion awaits confirmation. This is an approval checkpoint, not an execution failure or a claim of full task generation.

Processing permits adjacent low-risk subtasks, requires meaningful checkpoints, immediate truthful checkbox updates and verification before parent completion. It includes exact confirmation requirements for genuine manual/decision/commit steps and explicit-path checkpoint commits when appropriate; a shared dirty tree can make an isolated commit unsafe. It does not authorize production access or override repository/user restrictions. Future prompts require processing every authorized task, not merely reading the rule.

## Shared requirements

| ID | Contract / acceptance |
| --- | --- |
| SH-R01 | One canonical editing checkout on `octoberBranch`. Inspect current diff/status, preserve all teammate changes and historical worktrees; no new editing branch/worktree, no ownership inferred from file presence. |
| SH-R02 | Common identities, season, date/cutoff/timezone, game finality, window IDs and sample definitions. Player L5/L10 means completed **appearances**; goalie start share means completed **team games**. Weekly/rest-of-week and season-to-date have explicit boundaries. Preserve matched recent/previous; disclose STD overlap. |
| SH-R03 | Reuse shared metric definitions: BLK+SOG+HITS, categories, pooled rates/percentages, seconds/minutes, source-specific ixG versus on-ice xG and GSAx. Display basis, strength, numerator/denominator, cohort N and eligibility. Do not copy inconsistent formulas across lanes. |
| SH-R04 | Source observation/update/as-of timestamps, freshness and coverage; pagination/identity/deduplication and complete population/window proof where required. Missing/DNP/partial/unknown are separate from known zero; 0% Yahoo ownership is a valid known value. Avoid private league/account data in artifacts. |
| SH-R05 | Deterministic, explainable cohorts/ranks/ties and filter semantics. Configurable ownership, position, minimum GP and windows are shown in UI/export. Strict **> X** for Nightly Floor thresholds; ≥1 point and exactly-zero views are distinct. Empty eligible pools stay empty. |
| SH-R06 | Descriptive evidence, performance/regression, market observations, hypothetical scenarios and conditional forecasts are separate concepts. No fabricated consensus, fair-price/acceptance guarantee, unsupported rank, probability or predictive certainty. Confirmed starter status is independent of forecast qualification. |
| SH-R07 | Responsive/readable UI and same-snapshot PNG/share exports preserve source labels, filters, samples and unavailable states. Test calculations/source branches proportionately; verify actual browser/export behavior locally where affected. |
| SH-R08 | Preserve producer ownership: BLSH, WiGO, Game Grid, goalie workload/TGV/Start Chart and Yahoo Trade Market owners must allocate exact files. Use frozen read-only contracts or explicit handoffs; sequence shared writes. Independent Astra Social Share review has no source-write authority. |
| SH-R09 | Planning authorizes no implementation, new credentials, provider collection, external messages/posts, production writes, migrations, deployments or builds. Later work needs its own authorized bounds; a source gate or read permission is not deployment authority. No current-turn auto-review denial occurred. |
| SH-R10 | Every requirement remains an explicit task. Distinguish proposed, implemented locally, verified locally, blocked, accepted and deployed. Preserve older unfinished tasks, keep a short diary while working, and report actual checks/blockers; no percentage-complete substitute for coverage. |

## Requirement coverage matrix

PC/SS references resolve to numbered parents in their separate task files. **All rows are planned, not implemented by this packet.** Subtask IDs and evidence links will be added after parent approval; none are silently considered satisfied by an older checkbox.

| Requirement | Task ownership / reference | Acceptance focus / dependent gate |
| --- | --- | --- |
| PC-R01 artwork, branding, search, mobile, formats, exports | PC 1.0, 3.0, 8.0 | Preserve dirty/untracked checkpoints and artwork/export parity. |
| PC-R02 JFresh-inspired hierarchy | PC 3.0 | Original FHFH hierarchy; no invented composite rating. |
| PC-R03 scoring/peripherals/categories/BSH | PC 2.0, 3.0 | Exact BLK + SOG + HITS, components and units. |
| PC-R04 WiGO radar versus aligned bars | PC 3.0 | Reuse assessment, same qualified data, mobile/export decision. |
| PC-R05 cohort/basis/sample/strength/ranks | PC 2.0, 3.0 | Population qualification, eligibility/ties and visible N. |
| PC-R06 optional L5/L10–STD production/TOI/PP/underlying | PC 4.0 | Explicit optional-view decision; preserve recent/previous and disclose overlap. |
| PC-R07 source/xG/baseline/missing data | PC 2.0, 4.0 | Individual/on-ice distinction, denominator/coverage tests. |
| PC-R08 individualized BLSH and market distinction | PC 5.0 | Current owner-approved method/snapshot; no price claim from regression alone. |
| PC-R09 Yahoo observed records | PC 6.0 | Recover records with owner; dates, full assets/picks, context, duplicates and bias. |
| PC-R10 illustrative ideas/preseason anchor | PC 6.0 | No guaranteed fairness/acceptance; source/date/labeled anchor. |
| PC-R11 searchable goalie outlook/inventory | PC 7.0, SS 11.0 | One shared schedule/risk contract; confirmation versus forecast. |
| PC-R12 evidence/production boundaries | PC 1.0–8.0 | Source labels and unavailable claims in UI/export; no remote actions. |
| PC-R13 correctness/responsive/export evidence | PC 8.0 | Focused calculation fixtures and actual local UI/PNG/share checks. |
| SS-R01 preserve existing suite | SS 1.0, 13.0 | Monday/Tuesday owner reconciliation and regressions. |
| SS-R02 What Changed | SS 2.0 | L5/L10 versus STD in three metric groups; honest overlap/coverage. |
| SS-R03 BSH leaderboards and movers | SS 3.0 | Components, per-game periods, cohort and explicit change baseline. |
| SS-R04 Category Blueprint/multicategory | SS 3.0 | Comparable category contributions, no invented universal score. |
| SS-R05 Role Watch | SS 4.0 | TOI/PPTOI change units, samples and role versus prediction. |
| SS-R06 Player vs Player/sourced discussions/Gemini | SS 5.0 | Reddit/X provenance; prospective capability gate, no fabricated consensus or credentials. |
| SS-R07 Off-Night Edge | SS 6.0 | GP/day, actual top16 WeekScore, up to one F and D/team, dynamic Yahoo threshold, weekly/rest-of-week and no filler. |
| SS-R08 Nightly Floor/Cardio Masters | SS 7.0 | >X SOG/HITS/BLK; ≥1 point; zero points/category; all filters/counts; DNP/missing/0%-unknown tests. |
| SS-R09 Crease Shift | SS 8.0 | L10 completed-team-game official start share/comparison/tandem; relief separate. |
| SS-R10 TGV week/month and best/worst | SS 9.0 | Reconcile current grades with requested per-category games/weeks above/below; method checkpoint. |
| SS-R11 GSAx complementary/source-specific | SS 9.0, 10.0 | Qualified sign/model/strength/sample; no TGV substitution. |
| SS-R12 Busy/Quiet | SS 10.0 | Shots/chances workload versus performance, appropriate exposure. |
| SS-R13 goalie Category Rescue | SS 10.0 | Wins, saves, SA context and ratios; available candidates and flexible posting day. |
| SS-R14 Risky Starts/Cherry-Picked symmetry | SS 11.0 | SF–SA, xGF/chances–xGA/chances, PP–PK plus penalty exposure, goals/win support; no correlated double-counting. |
| SS-R15 Ratio Impact longer-term | SS 12.0 | Pooled hypothetical SV%/GAA, sensitivity, no forecast/transaction claim; remains explicit scope. |
| SS-R16 Start/Sit search and inventory | SS 11.0, PC 7.0 | Shared per-game schedule/risk/confirmation/conditional forecast. |
| SS-R17 flexible editorial selection/evidence | SS 3.0, 10.0, 13.0 | Thursday/Friday options, no mandatory calendar; labels on all cards. |
| SS-R18 verification and independent Astra audit | SS 13.0 | Frozen candidate, focused checks, actual local exports and evidence-led independent findings. |
| SH-R01 checkout/preservation | PC 1.0, SS 1.0 | Exact ownership reconciliation; all historical worktrees preserved. |
| SH-R02 identity/window/baseline | PC 2.0, 4.0; SS 1.0, 2.0, 8.0, 11.0 | Shared definitions; team-game versus appearance denominators. |
| SH-R03 metrics/units/cohorts | PC 2.0; SS 1.0, 3.0, 9.0, 12.0 | One reviewed formula source per metric. |
| SH-R04 source/missingness/ownership | PC 2.0, 5.0–7.0; SS 1.0, 5.0–11.0 | Timestamp, coverage and invalid/unknown states; private data excluded. |
| SH-R05 ranks/filters/strict thresholds | PC 2.0; SS 3.0, 6.0–9.0 | Population proof; >X equality boundary and empty pools. |
| SH-R06 claim boundaries | PC 5.0–7.0; SS 5.0, 9.0–12.0 | Observations/scenarios/forecasts/market concepts stay distinct. |
| SH-R07 UI/export/testing | PC 3.0, 8.0; SS 13.0 | Same-snapshot parity, readable labels and meaningful regressions. |
| SH-R08 producer/teammate ownership | PC 1.0, 5.0–7.0; SS 1.0, 8.0–11.0, 13.0 | Exact leases and frozen read-only audit. |
| SH-R09 authorization boundaries | PC 1.0, 8.0; SS 1.0, 13.0 | No implementation/external actions in planning; future bounded permission. |
| SH-R10 task/state/diary truth | PC 1.0, 8.0; SS 1.0, 13.0 | All requirements accounted for, blockers unchecked, evidence qualified. |

## Existing owners and proposed file allocation

Sources inspected: [Codex leases](artifacts/cross-platform/2026-10-24-coordination/CODEX-LEASES.json), [Claude leases](artifacts/cross-platform/2026-10-24-coordination/CLAUDE-LEASES.json), existing card tasks/checkpoint 17 and the [master register](MASTER-LIST.md). Registers are timestamped evidence, not proof an owner is currently writing. **No leases, mailbox, master register or existing task file were modified.**

| Surface | Existing custody / observation | Proposed lane boundary; exact files to allocate before editing |
| --- | --- | --- |
| Planning packet | This planner only | The six dated deliverables in this packet plus `tasks/diaries/2026-10-31-codex-player-cards-social-share-planning.md`. No app writes. |
| Player Cards | Thread `01a16ec2-f81c-717b-8961-8c3832fdc00f`; Claude PC handback recorded Oct26; checkpoint17 frozen local | Astra card lane: `web/components/player-cards/CurrentPlayerCard.tsx`, `CurrentPlayerCardStudio.tsx`, `CurrentPlayerCardStudio.test.tsx`; `web/lib/player-cards/currentNhl.ts`, `currentNhl.test.ts`, `currentNhlExport.ts`; card entrypoints and share bridge only after explicit exact allocation. Read-only protection for artwork files until a change requires their owner's allocation. |
| Social Share core | SS1 released Oct26; Monday accepted local commit recorded as `80fa80b5c`; TT register still active; no deployed claim | Claude integration owner alone for `web/components/SocialShare/SocialShare.tsx`, `SocialShare.module.scss`, `SocialShare.test.tsx`, `web/lib/socialShare/types.ts`, `server.ts`, `edition.ts`, `export.ts`, `web/pages/social-share/[format].tsx`, `web/pages/api/v1/social-share/[format].ts`, `web/e2e/social-share.spec.ts`. Obtain current TT handoff before `trends.ts`, `trendSources.ts` and their tests. |
| Shared skater definitions | Existing card domain and WiGO pipelines differ | Propose Codex card lead as definition steward for `web/lib/player-cards/registry.ts`, `aggregation.ts`, `windows.ts` and nearest tests; Claude consumes a reviewed interface. No forced cross-import/refactor: choose a small boundary after verifying dependencies. Only one writer per exact file. |
| WiGO radar | Claude `WIGO-UI-PASS` is active; older WIGO lease also recorded | `web/components/CategoryCoverageChart/CategoryCoverageChart.tsx`, `web/hooks/usePercentileRank.ts`, `web/components/WiGO/WigoDashboardSections.tsx` are inspect-only here. Coordinate any extraction or correction with WiGO owner; do not inherit legacy population assumptions. |
| BLSH preview/current input | Codex successor `01a17e93-6d23-77b3-bb91-c200b28f80fc`, `CODEX-BLSH-CURRENT-SEASON-20261027-SUCCESSOR` | Producer retains preview/parser/page/current-input/snapshot files. Cards requests reviewed DTO/metadata and consumes them; no rewrite of BLSH score or thresholds. |
| BLSH research | Claude BLSH support-gap/dry-run/forecast-dev frozen; display-mapper candidate recorded; session `3546ceb0` owns mapper | `supportGap.ts`, `productionReference.ts`, `currentWindows.ts`, `forecastEvaluation.ts`, `displayProfile.ts` and corresponding tests stay with existing owners. File presence is not analytical acceptance. Verify latest handoff; older pending findings/receipts must not be treated as current status without reconciliation. |
| Game Grid / goalie / Start Chart | Shared protected producers; exact current writer must be refreshed | `web/lib/goalieWorkload.ts`, `web/components/GoalieShareChart/index.tsx`, `web/components/GoaliePage/goalieCalculations.ts`, `web/lib/projections/startChartContract.ts` and Game Grid score helpers inspect-only until owner allocation. Proposed **new** schedule/risk inventory adapter owned by Claude; exact path selected and leased during SS 1.0/11.0; Astra is its consumer. No speculative new filename is claimed here. |
| Yahoo Trade Market | Register `LM-TRADE-MARKET; BLSH-5.1`: existing Trade Market/Autopsy owner; exact current thread not resolved | Recovery/source qualification goes to that owner. Consult [Autopsy PRD](TASKS/prd-roster-autopsy.md); preserve bundles/picks/attribution. No new scraper/credentials or blind retry of historical 429. |
| Independent Social audit | Requested Astra reviewer; not dispatched | Read-only source/tests/frozen evidence, writes only one agreed audit report. No overlap with Claude implementation or card source custody. |

Historical worktrees observed: `fhfhockey-october` at `6e14053ff5926e77a37a823e9451e77472a9855c`, and the social-share-tools worktree at `2331cc1ba64eaf202223941f29b33793f47571c9`, among many others. They were inventoried via Git and preserved, not edited or treated as the canonical current baseline. Local memory's schedule-only milestone describes the latter historical candidate; current canonical code and leases take priority. `.agents` / `.agents/skills` are absent. Relevant local Codex memory was checked for prior social-share/source boundaries. Local config says Astra/xhigh, but that is a configured default, not independently verified actual runtime settings; no additional agents were spawned or setting changes claimed.

## Shared dependency sequence

1. Confirm parent decomposition, expand every parent using the generation rule, then obtain/verify worker execution authority and exact file custody. These are separate gates.
2. PC 2.0 and SS 1.0 agree identity/window/metric contracts. Keep fixture UI work independent while sources are qualified. A single writer records definitions; both lanes review the interface.
3. Claude owns Social integration. BSH/Blueprint/Nightly Floor, Off-Night Edge, and goalie modules can be separate bounded assignments only after exact non-overlapping files are known. Same-file trends/Role Watch work is sequenced. No worker tree is launched by this plan.
4. BLSH and Trade Market producer handoffs gate only PC 5.0/6.0 observed consumers. WiGO population reuse gates ranks, not raw category bars. Goalie input/forecast qualification gates only the corresponding claim.
5. SS 11.0 freezes one goalie inventory interface used by SS Start/Sit and PC 7.0; both may develop fixtures independently after agreeing the interface. Preserve Start Chart producer boundaries.
6. Claude freezes source hashes, actual check receipts and unresolved requirements for independent Astra audit. Review does not own production/source writes. Correct findings with the implementation owner; recheck only changed evidence. Codex lead independently reviews the Player Cards result.

If delegation is used later, follow [mise-en-place.md](../mise-en-place.md): verify actual model/effort, keep lead effort above workers, use self-contained bounded tickets and exact file ownership. Suggested budget is one implementation worker per lane plus the requested fresh-context Social auditor, no recursive staffing, one initial audit and one bounded correction/review round; reassess with a concrete reason if essential acceptance needs more. Models requested by the user are Claude for Social and Astra for cards/audit; prompts do not change runtime models. Do not dispatch when the platform cannot verify/apply a necessary assignment; report that limit and continue independent planning.

## Open decisions, blockers and status

| Item | Exact pending action / target | Status, scope and next step |
| --- | --- | --- |
| Generation checkpoint | Expand PC 1.0–8.0 and SS 1.0–13.0 into subtasks | **Pending parent confirmation**, required by generation step 4. Plans/parents/matrix/prompts complete for review; full subtask lists are not complete. |
| Source ownership | Allocate exact implementation paths from current card/TT/WiGO/BLSH/goalie owners | **Pending at execution**, not an authorization denial. Refresh current leases and stop only overlapping writes. No messages or lease changes made here. |
| TGV semantics | Resolve requested per-category counts vs current weekly grade method | **Open method decision**, SS 9.0. Recommend a separately named category-count view that preserves existing TGV; do not choose thresholds before reconciliation. |
| Radar / optional season view | Select primary visualization and optional L5/L10–STD disposition | **Open review decisions**, PC 3.0/4.0. Prototype with qualified fixtures after authorization; preserve matched recent/previous. |
| Thresholds/cohorts | Choose Nightly Floor minimum GP/coverage, ownership defaults and comparison populations | **Open configuration decisions**, SS 1.0/3.0/6.0/7.0/9.0. Recommend visible configurable settings; strict >X semantics already fixed. |
| Observed trades | Recover actual qualified records from Trade Market/Autopsy owner | **Source unverified**, PC 6.0. Register reports synthetic prototype and prior 429/zero observations; no supported claim of existing observed dataset. Continue local empty/fixture presentation later. |
| BLSH / advanced metrics / goalie forecast | Confirm current reviewed method/snapshot and source qualification | **Dependent admission gates**, PC 2.0/5.0/7.0 and SS goalie tasks. No live reads or scientific/production acceptance claimed. |
| Sentiment/Gemini | Establish sourced discovery capability | **Prospective**, SS 5.0. No provider/credential setup; manual attributable discussion input can support comparison fixtures. |
| Ratio Impact | Implement authorized longer-term scenario task or record explicit deferral | **Planned future work**, SS 12.0, not dropped or complete. |

## Verification performed for this packet

Read-only repository inspection covered actual rules, local status/worktrees, relevant owner records, current card/social/goalie/BLSH sources, local memory and both referenced threads. Existing source checks and deployed behavior were not rerun or verified. Planning verification checks file/link existence, unique requirement/task IDs, coverage mapping, unchecked parent state and whitespace. Application tests/builds/browser/production requests are not required for these Markdown-only changes and were not run. Remote builds, deployments, posts, new credential accesses and production data changes: **zero**.

Validation result: **passed** for 29 local Markdown links, 41 unique coverage rows, 8 PC + 13 SS unique unchecked parent IDs, required task-list sections, all absolute source paths in the three prompts, process-rule/completion mandates and six-file whitespace. Referenced npm/test entrypoints were checked against web/package.json. An initial validation regex treated newlines as indentation and falsely reported subtasks; the corrected horizontal-whitespace check passed without changing task content. HEAD remained 18078d3d9783a6fbc6d123e37fdaf3489b3f3ecc. All six deliverables are new local untracked Markdown files; no commit or existing-file edit was made by this task.

This document is requirements/ownership evidence, not a lease, release approval or diary-derived acceptance.
