# 2026-11-07 Codex: goalie and FORGE cron pipeline repair

## Scope and authority
- User requests comprehensive cron/pipeline fix. Local implementation and fixture verification only; no production execution, data repair, push, or deployment authorized.
- Canonical checkout `/Users/tim/Code/fhfhockey.com`, `octoberBranch`; starting HEAD `040c59341784d246ae65362fbeae17b84bbae3a4`. Preserve concurrent dirty X/lineup/roster work.
- Own `web/pages/api/v1/db/update-goalie-projections-v2.ts`, its existing tests, then narrowly necessary FORGE provenance producer paths. Separate workers own cron report and Yahoo/WiGO.

## Evidence and plan
- Read-only auditor verified 224-row goalie batch rejected with SQLSTATE 21000, conflict key `(game_id, player_id)`; rolling FORGE shares failure, Nov 10–13 outputs absent. Exact conflicting IDs pending.
- Source builds candidates independently from full-season franchise logs, without team membership filtering. Existing test expects the same goalie for both opponents, reproducing the invalid key shape.
- Fix candidate identity at source, retain fail-closed duplicate validation before any batch writes, and test traded-goalie/history/unknown identity behavior. Do not deduplicate by arbitrary last-write-wins.
- Calibration contract failure is independently reported; inspect producer/consumer provenance before changing guards.

## Checks and next
- Repo instructions, current dirty status, relevant diaries and goalie route/tests read. No production calls or writes.
- Next: implement smallest safe goalie membership fix and regression tests, inspect FORGE contract, run focused tests/lint/typecheck.

## Checkpoint: goalie local repair
- Implemented current-season current-roster team filtering for current/future priors, date-scoped historical identity for historical refreshes, full-write-set conflict-key validation before chunking, and no writes on incomplete/ambiguous roster or failed team-log inputs. Missing eligible game/team history now returns 422 instead of a green zero/partial result.
- Existing future fixture incorrectly expected one goalie for both opponents; corrected it and added trade, cross-chunk duplicate, roster conflict/truncation/failure, historical transfer, and source failure regressions.
- 18 goalie tests pass; focused eslint and exact-path diff check pass. Whole-web typecheck in progress.
- Calibration finding: run metrics intentionally omit exclusion claim; accuracy's metrics-only check is obsolete. Proposed exact-run proof reuse is under independent review because accuracy is inside the producer import closure and also preserves/writes provenance-bearing metrics. No calibration boundary edits made yet.
- Other workers: reporting implements dynamic schedule URL matching + fair primary-source read budget. Yahoo missing values already honest/covered; WiGO needs authoritative repair of 273 historical null-ID/team rows, no safe inference or production writes performed.

## Checkpoint: calibration repair reviewed and implemented
- Independent reviewer rejected excluding the entire accuracy module because it writes calibration into provenance-bearing `forge_runs.metrics`. Approved only the resolved import edge `run-projection-accuracy.ts -> externalInputProof.ts`; accuracy and all ordinary writer dependencies remain hashed. Other paths into admission still fail the closure guard.
- Accuracy now proves the exact latest succeeded run using the existing serving proof helper and evaluates that proof's contracts. No provenance claim is fabricated or persisted; no older proven fallback bypasses atomic SQL's latest-run scope.
- Added proof acceptance/rejection and exact-edge hash regressions; fixed the existing accuracy test's stale audit-client mock (audit uses server client).
- Full web typecheck passed before calibration changes; final impacted checks underway. New producer source means a new closure hash: release needs an exact committed candidate, verifier receipt and admission, not just a Vercel deployment. No allowlist entries changed.

## Checkpoint: concrete collision and provenance admission
- Auditor reproduced stored-source collision: Nico Daws `8482076`, Nov 10 game `2026020291`, candidate teams WPG `52` and NJD `1`. WPG roster current, NJD ended Nov 6; patch retains WPG. This is stored-data reproduction, not original NHL-response replay.
- Bounded read-only production reconstruction exactly matches 224 raw candidates; current-team policy yields 216 eligible rows, zero duplicate keys and zero uncovered game sides. Unrostered historical players are omitted, not confused with a truncated roster read; corresponding regression added (goalie suite 19 passed).
- Independent final calibration diff review approved. Actual-tree closure retains required writers and accuracy; admission absent; zero findings. Dirty-tree hash is not release evidence.
- Exact deployed commit `c09aa95ace52f8da26ef9ee1b2e635dc0245f201` verified offline: closure `abb563452f17dbcd802a5debd8af86425a01775bf2fb9693c9a14fb9f468f454`, 195 modules, zero findings, matches live stamps. Added evidence-backed admission entry. Reverified all eight existing receipts with new walker; all original hashes reproduced with zero findings. Updated receipt hashes, preserved freshness assertions.
- Latest three successful live runs have no capture observations; metrics.resume.invocations=1 matches stamp length1, supporting exact-closure proof. Null code_versions is normal, not a failure.
- Verification: 109 calibration/proof/identity/input-exclusion tests pass; 159 proof/receipt/rolling-pipeline tests pass (68 overlap). Full web typecheck passed after calibration changes, before final admission/test addition; final typecheck underway.
- Remaining gates: isolate and commit exact release candidate, verify/admit its new closure, deployment authorization/linked-project preflight, bounded goalie/FORGE repair approval. No production mutation, commit, push, or deployment performed.

## Final verification checkpoint
- Final whole-web typecheck passed (exit 0) after admission/test additions. Focused lint and full diff check passed. Distinct local checks: 219 goalie/calibration/proof/receipt/pipeline tests; reporting 139; Yahoo/WiGO 97.
- Source handoff saved to `tasks/artifacts/cron-pipeline-repair-2026-11-07/LOCAL-REPAIR-HANDOFF.md`.
- One final bounded audit requested: quantify already-persisted stale-team priors, since omission from a new upsert does not delete old rows. Do not imply source repair has cleaned production data.

## Stale-key reconciliation checkpoint
- Final audit found four persisted stale rows: `(2026020267,3,8477484)` Martin/NYR Nov 7; `(2026020270,1,8482076)` Daws/NJD Nov 7; `(2026020279,1,8482076)` Daws/NJD Nov 8; `(2026020283,3,8477484)` Martin/NYR Nov 9. New omission alone would leave them.
- Local-only writer now prunes exact rejected source triples after every replacement upsert succeeds. Predicates include old team, protecting a valid new-team row sharing `(game_id,player_id)`. No broad delete, no mutation on failed input/upsert, and cleanup failure or unacknowledged count stops pruning and returns non-success.
- Root explicitly reaffirmed no live deletion without specific approval/safe scope. No live delete invoked. This source behavior and the known four keys must be disclosed in recovery approval.
- Added cleanup regressions; final verification and independent review running. This is needed source reconciliation, not a production data repair claim.

## Final classification and cleanup review
- Independent cleanup review approved exact-key/local-only reconciliation; current producer scan retains all required modules and has zero findings. Cleanup is only observed rejected candidates in processed games, not a full-table sweep.
- Final goalie/pipeline/identity/receipt run: 132 passed, including 24 goalie tests. Focused lint passed; final post-cleanup full typecheck still running.
- Auditor resolved underlying-stats UNKNOWN (09:35 success, 3,762 rows) and game-scoring UNKNOWN (11:40 success). NST goalie remains unverified after both name and URL search. Existing route wrappers verified; no speculative wrapper added.
- Concurrent unrelated commits advanced shared HEAD to `691819d58`; no task commit or staging performed. Do not infer final candidate identity from the mutable checkout.

## Paused for release/recovery approval
- Final post-reconciliation whole-web typecheck passed (exit 0); lint and diff checks passed. No remaining local implementation/test blocker found.
- 460 distinct focused tests across the three lanes passed (224 core goalie/FORGE, 139 reporting, 97 Yahoo/WiGO). This is not the full unit suite.
- Source remains uncommitted alongside other owners' work. Release sealing/admission, deployment and bounded data recovery remain explicitly pending, as documented in the handoff.

## Local release isolation checkpoint
- Parent authorized exact local release preparation and producer admission only. No push, deployment, production repair or data deletion.
- Read-only remote refs verified release base `194d55e720f1a715904c252e750d96af9533ef20` (origin/master). Local master is stale and is not the base. Use a private temporary index and verification export; do not switch or stage the shared checkout.
- Reporting owner is extracting required changes onto that base, excluding unreleased poller/backlog and NST lifecycle/audit semantics. Core changed files match base before this task, so their focused diffs can be isolated directly.
- Four linked Vercel projects identified; latest successful web production deployment is `08344ca140c9b222d4388e2305ece14e15b9b7f7`. Live env listing denied (403); tool-prescribed CLI fallback unavailable. Do not bypass. Prior Lines release diary records `LINES_OBSERVATIONS_ENABLED=true` staged for the next web release, requiring explicit release disclosure/current authorized verification. Live root/branch/ignored-build configuration remains unverified.

- Flag integration review found an additional real interaction: released line-source processing reconciles scheduled games even when the intake queue is empty. With `LINES_OBSERVATIONS_ENABLED=true`, this can persist snapshot observations although ordinary queue counters are zero. Requested conservative no-op audit suppression guard and route-level regression before sealing the isolated candidate. CCC returns before snapshot processing for an empty queue and is unaffected.

## Isolated candidate review checkpoint
- Provisional exact candidate `a0d4ca104331953157ee9dd5903f26320d31246d` created as private local commit objects on `194d55e7`, retained at `refs/candidates/cron-pipeline-repair-20261107`. Shared HEAD/index unchanged. No editing branch/worktree created.
- Producer parent `d9fcc711e12d2902cd6b646ce38888a43e606f2b` and final candidate independently verify closure `2676c5366cfc08fa7aaec4a1d4369e6f51caf3018bf2fca3f7d358faceb5c746`, 195 modules, zero findings. Receipt-backed admission added.
- First isolated test run: 415 passed, two failed only because archive omitted unchanged external SQL/JSON fixture inputs. Added those exact candidate fixtures and reran only the affected tests. Initial raw tsc hit default 4GB heap; corrected to repository npm run typecheck (8GB), not a source change. Scoped candidate lint passed.
- Independent review found another real no-op suppression edge: fetched events may yield zero claims while marking exhaustion or still invoking Lines reconciliation. Requested raw-intake emptiness guard and regression for both processors. Provisional candidate and bundle must not be released; corrected candidate will supersede them. Producer/admission boundary review itself passed.

- Provisional candidate checks now total 417 distinct passing fixtures after restoring the exact omitted SQL/JSON inputs; scoped lint passed. Corrected 8GB typecheck found only one additional omitted cross-root FxTwitter module, now exported from the exact candidate. Final rerun waits for the review correction, avoiding any interpretation of archive omissions as product defects.
- Reporting owner implemented explicit `eventsFetched` captured before intake/claim, with exact-zero suppression and real contention/exhaustion route regressions. Missing/null/nonzero counts retain audit; source snapshot flag guard remains. Incremental patch and final verification are next.

## Final isolated release handoff
- Final candidate `b4033ad65ffba6835ba0754dd665e5d694301f64`, tree `766a20dd8ca872685b88c5f816b022ab912315ef`, 33 scoped changed paths on base `194d55e720f1a715904c252e750d96af9533ef20`. Private candidate ref retained; bundle/patch/manifest verified. Shared HEAD/index unchanged.
- Independent review closed the zero-claim audit blocker. Exact final closure remains `2676c5366cfc08fa7aaec4a1d4369e6f51caf3018bf2fca3f7d358faceb5c746`, 195 modules, zero findings, with committed producer receipt/admission.
- Exact final export: 424/424 tests in 14 files, scoped ESLint, whole-web npm run typecheck (8GB), diff checks and bundle verification pass. No local/remote build or full suite.
- Deliverables: tasks/artifacts/cron-pipeline-repair-2026-11-07/CANDIDATE.json, isolated-candidate.bundle, isolated-candidate.patch, final logs, exact receipts, updated LOCAL-REPAIR-HANDOFF.md and RELEASE-PREFLIGHT.md.
- Remaining release gates: explicit exact-SHA deployment authorization; live four-project root/trigger/ignore verification; authorized current flag verification/next-release acknowledgment after 403 env read. Recovery requires fresh bounded approval including stale-row cleanup. Yahoo refresh hardening and WiGO repair remain separately owned, not silently included.
- No push, deployment, production write/delete, cron run or environment change. Local preparation complete; preserve this open diary for pending release/recovery.

## Flag confirmation and live deployment preflight
- TJ confirmed Production LINES_OBSERVATIONS_ENABLED=true. Exact b4033 consumers, six write targets/RPC, separate public serving/carry-forward gates and recurring near-term NHL reads verified. Six tables/RPC confirmed present via bounded read-only SQL. No flag write or denied-env read retry.
- Live browser read-only inspection completed missing project settings: roots web/cms/functions/repository root; all Production master, Preview disabled. Web/CMS/functions source ignore overrides verified; candidate root ignore exits0. Existing CMS/functions canceled logs confirm ignored-step exit0. Expected four entries, one web build, three skips/cancellations. CMS/functions deprecated Node20 noted; do not automatically upgrade.
- Remote master still194d55e; no candidate production deployment exists. Candidate code/commit unchanged, previous424/type/lint/review checks retained.
- Critical release disclosure: deployment activates exact-key stale goalie pruning on ordinary scheduled runs, so release consent must cover that behavior even when manual recovery is separately authorized.
- Updated CANDIDATE.json and RELEASE-PREFLIGHT.md; added FLAG-AND-DEPLOYMENT-PREFLIGHT.json. No deployment, setting change, cron execution or production mutation.

## Approved release checkpoint 21:08 UTC
TJ approved exact b4033 and ongoing Lines writes plus bounded scheduled stale cleanup; manual recovery remains separate. Rechecked all four live project settings, master base, all 33 candidate blobs and reproduced exact closure receipt. Published b4033 to master with expected-base lease and verified remote readback. Four Production entries: web building; CMS/functions explicitly ignored via exit 0, legacy root canceled. No shared checkout/index changes, no app/cron calls, no settings changed. See RELEASE-EXECUTION.json. Next: observe this one build and bounded runtime logs, no retry on failure; shared octoberBranch release-sync still needs coordination around concurrent work.

## Production ready checkpoint 21:13 UTC
Exact b4033 reached READY with fhfhockey.com and www aliases. Vercel build completed21:12:02Z, reported4m; companion footprint stayed three cancellations. First deployment-scoped runtime sample contained six homepage records, only198kB page-data warnings; project runtime-error query found none in21:12–21:13:10 window. This does not verify later scheduled jobs. Zero direct application/cron requests, no manual recovery, no settings changed. Production release artifacts saved; manual recovery and concurrent octoberBranch sync remain pending.

## Read-only recovery preflight 21:21 UTC
- Refreshed47-game Nov7–13 slate,32 teams,224 stored goalie candidates→216 eligible, no duplicate eligible identity/empty side/ambiguous current membership. Eight rejected exact predicates, four presently persisted, recorded in RECOVERY-PREFLIGHT.json. Nov10–13 remain empty; no active pipeline lease/running FORGE date row.
- Source/line coverage remains adequate in bounded reads; full PBP/shift parity deliberately not rerun. Ordinary execution preflight stays mandatory. Orchestrator cursor7 failed; no reset/replay proposed.
- Recommended independent one-call goalie refresh followed by future full-slate FORGE Nov8–13 only, preserving Nov7 pregame history after two games started. All actual writes remain unauthorized. Goalies use fresh provider candidates, so216/4 are estimates, not endpoint-enforced caps.
- Additional blocker: current Starter Board compute/legacy configuration unknown. Date-only FORGE calls can capture inputs and publish revisions when enabled. Parent has no confirmed values; no retry of denied env listing. Minimal two-flag question and conditional write scope documented in RECOVERY-APPROVAL.md.
- Only local evidence/diary files changed; no code, index, production writes, endpoint calls, flags or deployment. Next: parent obtains exact configuration and separate bounded recovery approval.

## Approved goalie recovery complete 21:29 UTC
- TJ approved one Nov7–13 goalie refresh only. Before execution, detected concurrent #414 release00ea36 on Production instead of b4033. Stopped and reconciled:00ea36 descends from b4033; all15 goalie dependency modules and runtime/build config are identical, no Lines/StarterBoard flag dependency. Parent confirmed materially unchanged approved action could proceed.
- Local DNS failed before HTTP, with unchanged DB/no audit confirmed; permitted network escalation then received only a www→canonical308. One canonical handler invocation ran21:27:55–21:28:05UTC, HTTP200,216 upserts/four removals/eight exclusions, no failures/warnings. No blind retry of an executed or uncertain operation.
- Post-read verifies216 rows,47 games/94 sides,120 inserted keys,96 existing keys, exactly four expected removed keys; no duplicate or out-of-roster row. One matching success audit. No new FORGE run and projection_execution remains failed/cursor7/unchanged10:22 timestamp. No reset/flag/deploy action.
- New metadata issue: upsert payload omits updated_at, so96 existing rows keep old timestamps despite49 changed-value rows;47 values remain identical. Source gate checks presence, not updated_at. Reported separate small observability fix; no extra update or recovery call.
- Saved GOALIE-RECOVERY-{DEPLOYMENT-RECONCILIATION,BEFORE,EXECUTION,AFTER,VERIFIED}.json and dispatch receipts. Goalie recovery complete; FORGE configuration/approval and release-sync remain open.
