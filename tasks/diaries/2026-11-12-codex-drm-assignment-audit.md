# DRM assignment audit — 2026-11-12

- Scope: bounded offline audit of line/pair assignment math and exact consumers, with hand-checkable probes. No app/provider/database/browser changes or calls.
- Where: canonical `/Users/tim/Code/fhfhockey.com`, `octoberBranch`; shared dirty checkout preserved. Own `tasks/artifacts/drm-ddatv-2026-11-12/ASSIGNMENT-AUDIT.md`, optional probe beside it, and this diary.
- Staffing: assigned by Chef as `gpt-6.1-sol`/high; independent runtime confirmation not exposed by available direct runtime API. No workers.
- State: read repository instructions and mise-en-place; inspecting named helper and prior math relationships evidence. One targeted evidence pass plus one correction round budget.
- Next: execute actual helper offline on bounded fixtures, trace consumers and scopes, report minimal repair proposal and unresolved owner decisions.
- Blockers: none. Existing interval-union repair is prior work; strength clock remains unqualified per Chef handoff.

## Evidence checkpoint

- Observed HEAD during audit: `525c647c713091bbb851c23b86221973dd72983a` (concurrent shared checkout; source hashes emitted by probe).
- Actual-source offline probe passed on Node `v22.23.4`. First execution rejected a fixture missing `season_id`; corrected that fixture and reran successfully (single correction round).
- Proven: two real game trios `[1,2,4]` / `[1,3,5]` produce synthetic `[1,2,3]` with no common game; zero/one-second partners still fill a line; tie handling is ID-stable; missing-type mixed-position fallback excludes `C/RW`; reducer cannot detect a wholly absent requested game through skipped-row counts.
- Current next step: complete assigned report with bounded repair proposal, unresolved display policy, actual checks and limits. No app edits or remote access.

## Handoff

- Delivered `ASSIGNMENT-AUDIT.md` and reproducible `probe-assignment.cjs` in `tasks/artifacts/drm-ddatv-2026-11-12/`.
- Owned report/probe whitespace checks emitted no errors. No app suites rerun; actual offline assertions passed. No application or prior-evidence changes.
- Conclusion: current affinity packing cannot establish observed units. Minimum complete repair needs per-game simultaneous occupancy facts and qualified strength timing, plus explicit display policy for repeated players, ties, sparse coverage and strength/unit sizes.
- Next: Chef reviews evidence and resolves integration/product choices. Diary retained for handoff; not release/acceptance evidence. No pending permission or external action in this lane.

## Follow-up start — existing unit builder reuse

- New bounded read-only assignment: inspect `teamUnitToiBuilder.ts`, nearest tests/callers and persisted `team_unit_toi` reader contracts as a reuse path; no app edits, remote calls or new tests.
- New user decisions from Chef: each player has one main line, observed alternatives shown separately; main forward lines are5v5; other ES states separate.
- Next: distinguish reuse of implementation from admission of existing persisted facts; report minimum bounded extension and metadata/coverage gaps. Previous physical-union/strength evidence remains reused.

## Follow-up handoff

- Added existing-builder reuse addendum and `--unit-reuse` offline probe mode; probe passed once with no correction.
- Reuse existing observed-unit boundary sweep. Convert fixed-size ES pooled seconds by÷3/÷2; preserve existing rankings semantics. Legacy PP builder is pooled individual label time, not simultaneous PP units.
- New proof: deleting60s of one skater interval reduces both teams' observed exposure from120s to60s while every row stays `complete`. Empty/no-goalie/known4v4 return identical[]; nightly completion ignores partial flags. Current metadata/v1 is insufficient for qualified cache admission absent external immutable receipts.
- Minimum: canonical per-game source/roster adapter, expected-game and zero/gap manifest, provenance/version and atomic replacement, all-identity reader, disjoint main observed groups plus alternatives. Do not build a duplicate enumerator.
- Next: Chef review/integration. No app edits or external actions; diary retained for handoff.

## Follow-up start — independent line-history UI review

- New read-only review assignment: root-owned `LineHistory.tsx`, SCSS, component tests and `drm.tsx` integration; no edits, DB/network, build or full suites.
- Current intent: default game-date filtering of reliable audited game links; publication dates alongside; practice/unlinked/uncertain separate and publication-filtered; publication-date toggle. Never infer uncertain game dates. Backend DTO still in progress; two streams are audited immutable game claims and retained unverified legacy publication reports.
- Next: bounded source pass for concrete correctness/accessibility/scope issues; candidly separate source review from browser/runtime evidence.

## Line-history review handoff

- Completed independent read-only UI review using the review skill; report addendum records one P2 requirement mismatch: practice game-stream records render in main section despite ticket requiring separate publication-filtered practice records. Both fixtures/backend currently permit this path; coordinated routing fix needed if the explicit requirement stands.
- No stale response leak found in current keyed page integration; basic native semantics/focus CSS present. No additional concrete blocker. Limited publication-source corpus is disclosed and is not a completeness blocker.
- No tests/browser/network/database/build execution or app edits in this review; root's verification remains distinct. Next: Chef resolves practice policy and integrates sibling DTO.

## Follow-up start — claim publication pagination

- Bounded read-only review of new `claimPublication` cursor/state/date-filter/source-admission logic in sibling-owned `web/lib/sources/lineHistory.ts`; no settled UI re-review, network, edits to app, or suites.
- Scope per Chef: NULL-game bucket first, then one bound-game page;51 candidates, JS normalized publication-date filtering, valid outside dates filtered not failed, unknown originals skipped, max2queries/request and explicit scanned counts/cursor.
- Next: inspect only new cursor state and admission path for concrete dropped/duplicated/leaked records.

## Claim-publication review handoff

- Bounded source pass completed; no concrete finding in new NULL→bound-game→row keyset state, timestamp normalization/Eastern publication filter, or explicit public DTO projection.
- Source-traced: cursor binds mode/team/date/asOf; row cursors preserve exact game prefix and lexicographic interpreted_at+claim_id continuation; stage-next bypasses exhausted NULL bucket; one extra candidate preserves51st row for next page; valid out-of-window publication is filtered without skipped count; originals unknown/malformed withheld; output never promotes uncertain game date/link.
- No probe/test/network/database execution. Existing sibling tests inspected for new paths; tests still in progress at assignment. Existing archive incompleteness/publication ordering limitations are intentional and disclosed, not new defects. Next: Chef integration and focused verification.

## Implementation start — observed deployment engine

- New write grant ONLY `web/lib/drm/observedDeployment.ts`, adjacent `.test.ts`, and this diary. Canonical octoberBranch; preserve concurrent parent/sibling work. No network/subagents/full project checks.
- Contract announced: retain proposed analyzer fields; units additionally carry teamId and explicit strength; formation coverage includes excludedSpecialTeamsSecondsByTeam. Pure all/5v5/otherES/PP/PK player and same-team pair seconds; exact tagged partition/input-total checks; reuse existing ES unit builder.
- Next: implement strict source validation/sweep, observed PP/PK groups and disjoint primary selection; meaningful fixtures plus independent per-second oracle; focused tests and own-file lint.

## Engine implementation handoff

- Implemented only `web/lib/drm/observedDeployment.ts` and adjacent `.test.ts`; parent/sibling files untouched. API exports MatrixStrength, DeploymentShiftRow, DeploymentAnalysis, ObservedDeploymentUnit, analyzeDeploymentGame, selectMainDeploymentUnits.
- Units carry teamId, explicit strength, sorted members, absolute shared clock seconds, formation skaterCount and sorted gameIds. Selector aggregates identities across games, greedily selects disjoint primaries within team/kind/skaterCount (4F/3D/2PP orPK), alternatives separate, no synthetic filling.
- Validation rejects game/team/player mismatch, duplicate identities/physical intervals, malformed clocks/periods/durations, untagged/overlapping/incomplete strength partitions, disagreeing teammate/opponent states and mismatched input-owned totals. Half-open sweep supplies all/state player/pair seconds, includes same-team goalies, excludes opponents. Existing pure ES builder reused and converted from pooled seconds with duration consistency checks.
- Coverage explicitly tracks otherES clock, excluded special-team formations and unrepresented strict5v5 formations. Reader must independently qualify source completeness/provenance; this interface cannot infer completely absent source rows/periods.
- Focused Vitest:21 tests passed, including actual changing-game groups, asymmetric shares/short use, partition across physical shift, otherES/4F1D/pulled goalie, regular/playoffOT,13 corruption cases, tie/cap behavior and independent per-second occupancy oracle. Own-file ESLint passed; own-file whitespace checks emitted no errors. First attempted test creation used wrong relative path and found no tests; corrected path before execution. No full tsc, build, DB/provider/network, deployment or other files edited.
- Next: Chef integration/review and integration-level type/reader/UI checks. No pending external action in this lane.

## Reader implementation/review start

- New bounded write grant: `web/lib/drm/readMatrix.ts`, `types.ts`, `web/pages/api/v1/drm.ts`, new focused reader/route tests as justified, diary and concise reader receipt. Root owns UI/client; engine edits require request. No network/provider, full tsc or delegation.
- Objective: qualify complete scheduled game scope against pinned final PBP, current input/relationshipv6 manifests, historical roster and interval engine; exclude stale/missing/partial games visibly, preserve true zero versus unknown and correct pair/strength denominators.
- Next: inspect drafted reader/schema contracts; implement concrete fixes; run small mocked-reader/route verification and scoped lint, one correction round then handoff.

## Reader handoff

- Delivered reader corrections,15 mocked reader tests and3 route tests; DTO unchanged. Exact changes/evidence in `tasks/artifacts/drm-ddatv-2026-11-12/READER-RECEIPT.md`.
- Fixed scope revalidation, final PBP clock comparison, source-head positive identity, per-game metadata acceptance and normalized goalie exemption. Parent-granted engine type corrections address reported whole-tsc narrowing errors; no runtime-math redesign.
- Final focused run39 passed (21engine+15reader+3route); scoped ESLint passed. No worker full tsc/network/build/DB calls. Parent notified files free for integration and8GB tsc.
- Next: Chef integration verification. Scope completeness remains tied to scheduled ledger/current source/materialization/roster evidence; source replay is not performed by this reader. Diary retained for task handoff.

## Independent integration review start

- New read-only ticket: root-owned DRM page/client/hook/observed-unit/coverage/history/matrix integration; no engine/reader re-audit, edits, full checks or network.
- Focus: observed-versus-inferred presentation, per-strength denominators and knownzero, separateES/PP all view, scope races and verified-game history comparison. Root owns ongoing UI/tsc; sibling browser history work remains separate evidence.
- Next: one bounded actual-diff/caller pass; report only actionable concrete defects with scope limits.

## Integration review handoff

- Read-only bounded pass complete. One P3 copy finding at ObservedUnits.tsx46: cards do not display TOI, so selected-strength ice-time claim should refer to matrix or be removed.
- No actionable numerical/stale-scope/history same-game defect found. Observed groups active in aggregated path, separate5v5/PP all list, denominator/knownzero handling and current-scope guards source-traced. History uses raw per-game units, not selector-aggregated totals.
- No tests/browser/network rerun. Findings/limits added to existing audit artifact and sent to Chef. Parent retains all application ownership.
