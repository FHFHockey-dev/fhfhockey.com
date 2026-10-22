# FHFH sprint ledger — 2026-10-22

As of **2026-10-22T13:07:52+00:00**. Current local HEAD `d3f057c6c849d5d5474bc912a6f461f617c65b15` on `octoberBranch`; retained release reference `248df9923cfbd00705222bb8ad9126a169bf8773`. No fetch or hosted observation.

**This is an inventory/status ledger, not proof every file or feature is vetted.** See [HEALTH.md](HEALTH.md) for evidence levels and exact source checks; [WORK-PACKETS.md](WORK-PACKETS.md) for proposed staffing. Proposals are not assignments. Implementation, acceptance and release remain distinct. FA Portal excluded.

## Owners

| Key | Thread | Assignment |
|---|---|---|
| FORGE | 01a1637a-4222-70c0-8439-cb3cc46b20c4 | FORGE lead; A1–A4/A6 local packet |
| STATS | 01a1637b-e751-779f-b01b-8404601160f7 | A7–A9 locally independently accepted including R1; next team-stat slice requires parent lease |
| YAHOO | 01a1637c-2c59-7388-8dd5-c2439023f0e0 | A5/A10 implementation |
| REVIEW | 01a160f3-6d90-774f-a641-a0b6afdd4029 | Completed original/FORGE/Yahoo and D4 bounded independent reviews; parent assigns next review |
| BILLING | 01a15f1d-cb9f-7584-a4fd-2d1e9499f03f | Inactive entrypoints implemented; narrow P2 cancellation request identity correction assigned |
| LUNA | 01a15b29-d48b-76e1-bd17-f8e8ab70103a | Dated provenance and review-only replacement artifacts complete,30tests; future application/live scope held |
| PIPELINE | 01a16391-ed12-75cc-9dc8-e1c04ad170fa | Daily pipeline evidence; read-only readiness |
| GRANTS | 01a16392-18df-72b3-a48b-34b90258b0c0 | D4 harness/matrix repair independently accepted locally; SQL/platform/hosted gates remain open |
| RESEARCH | 01a16392-4519-7029-aaff-fd20526ab0e0 | SOG artifact contract complete; active sKO/VuDu file-level unit/population/overlap audit |
| USAGE | 01a1637a-125a-7587-bcba-0302244ec0fc | Sprint usage watcher |
| PARENT | 01a15411-3560-7632-8d31-1dd2447ba00e | Sprint scope, staffing, integration, acceptance and release decisions |
| LEDGER | this delegated task | Read-only audit; only dedicated ledger and own diary writes |
| UNASSIGNED | UNASSIGNED | No current named custodian evidenced; historical author is not an active assignment |
| STATS-REVIEW | 01a16392-ddfc-7048-8ada-ef994ea880f8 | A7 R1 hold closed; A7–A9 pinned local acceptance |
| BILLING-REVIEW | 01a15fd2-1d7a-75ac-b30d-a34a7d3d3026 | Inactive entrypoints review reports105passes andP2 identity hold; correction/re-review pending |

## Evidence boundaries

Historical [EVIDENCE.json](EVIDENCE.json) and [initial fence](EVIDENCE-20261022T123633.json) are retained unchanged. New source/review observations are separately pinned in [HEALTH.json](HEALTH.json). No application suite or production action by this auditor. Six offline source-extraction observations are not product acceptance.

## Master task list

### MASTER-G1 — Keep native reader admission behind a qualified writer

- **Implementation:** Writer/reader infrastructure exists; admission/issuance gate open. **Acceptance:** Not end-to-end accepted. **Release:** Native S-1 dark in R10; activation not established.
- **Owner:** FORGE; **reviewer:** UNASSIGNED. **Dependencies:** MASTER-N1/N2; NATIVE-ISSUANCE; FE completeness/evaluation gates.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Current task list, model inventory and retained R10 subject; no fresh issued/readback evidence.
- **Acceptance/release gate:** Independent exact-byte acceptance, then separate exact-candidate release authorization where applicable.
- **Next:** FORGE lead coordinates writer-first acceptance; native implementation/activation custodian UNASSIGNED.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:45](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:45>); [forge-model-release-inventory.md:32](</Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-projection-audit-2026-10-21/forge-model-release-inventory.md:32>); Git `dbb5af2d1`

### MASTER-R1 — Preserve daily transaction locks after puck drop [proven]

- **Implementation:** released content recorded. **Acceptance:** Prior release credit retained; broader/narrower follow-up is separate. **Release:** Contained in retained origin/master; release candidate 986144844.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** authoritative provider slot/timezone evidence; coordinate R2 in the same file. Approval: Local; Release. Size S..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Read local Git release history and model release inventory; affected RSO planner/timeline/lineupGaps/query files equal retained origin/master at HEAD. No test or hosted rerun.
- **Acceptance/release gate:** Existing released content is credited; current audit packet changes and real-account/UI acceptance require their own evidence.
- **Next:** Retain released credit; no new implementation worker for this completed scope. Only separately identified acceptance gaps remain open.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:55](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:55>); [forge-model-release-inventory.md:41](</Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-projection-audit-2026-10-21/forge-model-release-inventory.md:41>); Git `986144844`

### MASTER-R2 — Keep an injured locked player occupying the provider slot [proven]

- **Implementation:** released content recorded. **Acceptance:** Prior release credit retained; broader/narrower follow-up is separate. **Release:** Contained in retained origin/master; release candidate 986144844.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** R1 boundary semantics. Approval: Local; Release. Size M..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Read local Git release history and model release inventory; affected RSO planner/timeline/lineupGaps/query files equal retained origin/master at HEAD. No test or hosted rerun.
- **Acceptance/release gate:** Existing released content is credited; current audit packet changes and real-account/UI acceptance require their own evidence.
- **Next:** Retain released credit; no new implementation worker for this completed scope. Only separately identified acceptance gaps remain open.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:62](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:62>); [forge-model-release-inventory.md:41](</Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-projection-audit-2026-10-21/forge-model-release-inventory.md:41>); Git `986144844`

### MASTER-F4 — Prevent late-writer corruption during continuation [actual-runner reproduction]

- **Implementation:** released content recorded. **Acceptance:** Prior release credit retained; broader/narrower follow-up is separate. **Release:** Contained in retained origin/master; release candidate b5e801d8f.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** MASTER-G1; AUDIT-A6 is a distinct pipeline-classification fix.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Read local Git release history and model release inventory; affected RSO planner/timeline/lineupGaps/query files equal retained origin/master at HEAD. No test or hosted rerun.
- **Acceptance/release gate:** Quiescent/cooperative continuation only. Forced takeover safety and real SQL concurrency are not established by metadata CAS or current A6 fixtures.
- **Next:** Retain released credit; no new implementation worker for this completed scope. Only separately identified acceptance gaps remain open.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:69](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:69>); [forge-model-release-inventory.md:41](</Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-projection-audit-2026-10-21/forge-model-release-inventory.md:41>); Git `b5e801d8f`

### MASTER-F1 — Reject fenced local runs in goalie readers [code-confirmed risk]

- **Implementation:** released content recorded. **Acceptance:** Prior release credit retained; broader/narrower follow-up is separate. **Release:** Contained in retained origin/master; release candidate c2ed28384.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** G1; establish intended non-local qualification contract. Approval: Local; Release. Size S..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Read local Git release history and model release inventory; affected RSO planner/timeline/lineupGaps/query files equal retained origin/master at HEAD. No test or hosted rerun.
- **Acceptance/release gate:** Existing released content is credited; current audit packet changes and real-account/UI acceptance require their own evidence.
- **Next:** Retain released credit; no new implementation worker for this completed scope. Only separately identified acceptance gaps remain open.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:77](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:77>); [forge-model-release-inventory.md:41](</Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-projection-audit-2026-10-21/forge-model-release-inventory.md:41>); Git `c2ed28384`

### MASTER-D1 — Enforce the NST 21-second minimum [code-confirmed]

- **Implementation:** Local accepted limiter/continuation repair; only gamelog subset released R20. **Acceptance:** Local receipt retained; natural paired chain/cross-host coordination open. **Release:** R20 gamelog only; other NST jobs retain master client/burst plans.
- **Owner:** PIPELINE; **reviewer:** UNASSIGNED. **Dependencies:** super-goal C0077/NST-CATCHUP-21S at `tasks/TASKS/super-goal/tasks-prd-fhfh-comprehensive-completion-audit-optimization.md:1731` supersedes the burst. Approval: Local; Release/Operational for scheduling changes. Size M..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Retained 209 distinct focused cases and consumer17; R20 explicitly excludes other jobs.
- **Acceptance/release gate:** Independent exact-byte acceptance, then separate exact-candidate release authorization where applicable.
- **Next:** Readiness owner separates released gamelog from pending producers and paired pipeline evidence.
- **Evidence:** [D1-D2-HANDOFF.md:7](</Users/tim/Code/fhfhockey.com/tasks/artifacts/codex-2026-10-20/D1-D2-HANDOFF.md:7>); [tasks-forge-projection-audit-streamlining-2026-10-21.md:293](</Users/tim/Code/fhfhockey.com/tasks/TASKS/forge-projections/tasks-forge-projection-audit-streamlining-2026-10-21.md:293>)

### MASTER-D2 — Recover partial WGO-goalie dates on retry [code-confirmed]

- **Implementation:** Latest-date overlap repair locally committed; old-hole repair outside scope. **Acceptance:** Local 45-case receipt; completeness/older holes open. **Release:** Unreleased route diff remains against retained origin/master.
- **Owner:** PIPELINE; **reviewer:** UNASSIGNED. **Dependencies:** choose checkpoint versus overlap; schema change is not assumed necessary. Approval: Local; Release; Operational for any historical repair/migration. Size M..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Retained independent45/45; local Git diff confirms route divergence.
- **Acceptance/release gate:** Independent exact-byte acceptance, then separate exact-candidate release authorization where applicable.
- **Next:** Review exact release pairing and old-hole evidence without invoking ingestion.
- **Evidence:** [D1-D2-HANDOFF.md:8](</Users/tim/Code/fhfhockey.com/tasks/artifacts/codex-2026-10-20/D1-D2-HANDOFF.md:8>); [D1-D2-HANDOFF.md:31](</Users/tim/Code/fhfhockey.com/tasks/artifacts/codex-2026-10-20/D1-D2-HANDOFF.md:31>)

### MASTER-D3 — Stop schedule work after the wrapper's timeout [code-confirmed risk]

- **Implementation:** released content recorded. **Acceptance:** Prior release credit retained; broader/narrower follow-up is separate. **Release:** Contained in retained origin/master; release candidate b5e801d8f.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** unseen local schedule work; no daily cron entry is approved. Approval: Local; Release + Operational for cron activation. Size M..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Read local Git release history and model release inventory; affected RSO planner/timeline/lineupGaps/query files equal retained origin/master at HEAD. No test or hosted rerun.
- **Acceptance/release gate:** Existing released content is credited; current audit packet changes and real-account/UI acceptance require their own evidence.
- **Next:** Retain released credit; no new implementation worker for this completed scope. Only separately identified acceptance gaps remain open.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:98](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:98>); [forge-model-release-inventory.md:41](</Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-projection-audit-2026-10-21/forge-model-release-inventory.md:41>); Git `b5e801d8f`

### MASTER-N1 — Resolve native target scope using the existing patch [held]

- **Implementation:** Existing native target-scope/replay integration; old freeze expired, requalification still open. **Acceptance:** Target-only policy decided; exact final writer/readback not accepted. **Release:** Dark native path credited; no live activation.
- **Owner:** FORGE; **reviewer:** UNASSIGNED. **Dependencies:** 17:00 UTC freeze, N2 current-base rebase, latest patch stack/ownership, G1. Approval: Local post-freeze; Release/Operational for publish, CAS, cron or env changes. Size M (review/integration slice)..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Source/status review only; no test rerun by ledger auditor.
- **Acceptance/release gate:** Independent exact-byte acceptance, then separate exact-candidate release authorization where applicable.
- **Next:** Reconcile final source-selection/hash and target-only patch stack; do not repeat settled policy choice.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:105](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:105>); [MASTER-TASKLIST-2026-10-20.md:284](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:284>); [forge-model-release-inventory.md:32](</Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-projection-audit-2026-10-21/forge-model-release-inventory.md:32>)

### MASTER-N2 — Rebase native patch 02 without losing current serving work [verified blocker]

- **Implementation:** Existing native target-scope/replay integration; old freeze expired, requalification still open. **Acceptance:** Target-only policy decided; exact final writer/readback not accepted. **Release:** Dark native path credited; no live activation.
- **Owner:** FORGE; **reviewer:** UNASSIGNED. **Dependencies:** freeze, exact current owner/base, N1/G1. Approval: Local after freeze; Release/Operational separately. Size M..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Source/status review only; no test rerun by ledger auditor.
- **Acceptance/release gate:** Independent exact-byte acceptance, then separate exact-candidate release authorization where applicable.
- **Next:** Reconcile final source-selection/hash and target-only patch stack; do not repeat settled policy choice.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:112](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:112>); [MASTER-TASKLIST-2026-10-20.md:284](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:284>); [forge-model-release-inventory.md:32](</Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-projection-audit-2026-10-21/forge-model-release-inventory.md:32>)

### MASTER-D4 — Make Data API grants explicit before October 30 [time-bound readiness]

- **Implementation:** Local harness/matrix repair ready for independent review; fresh SQL replay blocked. **Acceptance:** Local harness/matrix repair independently accepted; actual SQL/platform/hosted gates open. **Release:** Hosted apply not established; pending ledger entries.
- **Owner:** GRANTS; **reviewer:** REVIEW. **Dependencies:** Replay89–90 at insertion point, then91–97; current callers; all creators/roles/schema exposure.
- **Evidence level:** independently accepted. **Scope:** Only exact local packet and tested contract described in linked independent review; no whole-area or deployed acceptance. **Provenance:** imported independent review; auditor did not rerun it.
- **Verification:** Independent97 migration hashes;66 stale expectations reconciled to denials without widened access;6preflight+8TAP classifier cases. No fresh SQL replay.
- **Acceptance/release gate:** Fresh positive/negative exact97-chain SQL replay, PG15/PostgREST/JWT and separately authorized hosted catalogs. Local harness acceptance does not authorize apply.
- **Next:** Obtain separately permitted disposable SQL replay and platform acceptance; retain canonical schedule-RPC gap.
- **Evidence:** [REPORT.md:28](</Users/tim/Code/fhfhockey.com/tasks/artifacts/d4-grants-2026-10-20/repair-2026-10-22/REPORT.md:28>); [REVIEW.md:3](</Users/tim/Code/fhfhockey.com/tasks/artifacts/d4-grants-independent-review-2026-10-22/REVIEW.md:3>)

### MASTER-R3 — Remove injured players from automatic DROP suggestions [proven]

- **Implementation:** released content recorded. **Acceptance:** Prior release credit retained; broader/narrower follow-up is separate. **Release:** Contained in retained origin/master; release candidate 986144844.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** existing injury policy; coordinate R1/R2. Approval: Local; Release. Size S..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Read local Git release history and model release inventory; affected RSO planner/timeline/lineupGaps/query files equal retained origin/master at HEAD. No test or hosted rerun.
- **Acceptance/release gate:** Existing released content is credited; current audit packet changes and real-account/UI acceptance require their own evidence.
- **Next:** Retain released credit; no new implementation worker for this completed scope. Only separately identified acceptance gaps remain open.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:128](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:128>); [forge-model-release-inventory.md:41](</Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-projection-audit-2026-10-21/forge-model-release-inventory.md:41>); Git `986144844`

### MASTER-F2 — Port the existing null-win goalie correction, not its whole reader

- **Implementation:** released content recorded. **Acceptance:** Prior release credit retained; broader/narrower follow-up is separate. **Release:** Contained in retained origin/master; release candidate 986144844.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** G1; compatible candidate checkout when separately authorized. Approval: Local; Release. Size S..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Read local Git release history and model release inventory; affected RSO planner/timeline/lineupGaps/query files equal retained origin/master at HEAD. No test or hosted rerun.
- **Acceptance/release gate:** Existing released content is credited; current audit packet changes and real-account/UI acceptance require their own evidence.
- **Next:** Retain released credit; no new implementation worker for this completed scope. Only separately identified acceptance gaps remain open.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:135](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:135>); [forge-model-release-inventory.md:41](</Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-projection-audit-2026-10-21/forge-model-release-inventory.md:41>); Git `986144844`

### MASTER-F3 — Separate shrinkage evidence by target and history support

- **Implementation:** Research/contract or local engineering evidence exists; promotion held. **Acceptance:** open. **Release:** not established.
- **Owner:** RESEARCH; **reviewer:** UNASSIGNED. **Dependencies:** F7 matched support transport, historical exposure quality, F5. This research prerequisite does not automatically block an independently qualified native baseline. Wood/Larkin values and their cause were not independently verified. Approval: Local; Release. Size M (target/support contract and regressions; calibration is a later bounded session)..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Source/status review only; no test rerun by ledger auditor.
- **Acceptance/release gate:** No empirical/model/product promotion without qualified time-ordered source/cohort, accepted contract and separately approved candidate.
- **Next:** Readiness owner inventories current evidence and proposes one bounded next slice; implementation ownership remains UNASSIGNED.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:142](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:142>)

### MASTER-F5 — Separate committed hits/blocks work from unresolved data repair

- **Implementation:** Local hydration/H-B candidate components; exact combined candidate qualification held. **Acceptance:** Blocked on valid corrected temporal inputs and final combined bytes. **Release:** Not released by R20 evidence; league-rescale migration 88 pending.
- **Owner:** FORGE; **reviewer:** UNASSIGNED. **Dependencies:** AUDIT-A1; MASTER-F3/F7; data identity; model/physical event qualification.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Historical four-arm reconstruction used current DB for earlier slates; SOG/HIT calibration regressions; no completed final-c receipt found.
- **Acceptance/release gate:** Independent exact-byte acceptance, then separate exact-candidate release authorization where applicable.
- **Next:** FORGE lead records exact combined candidate and missing prior-availability evidence; qualification executor UNASSIGNED.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:149](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:149>); [forge-model-release-inventory.md:22](</Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-projection-audit-2026-10-21/forge-model-release-inventory.md:22>); [hydration-recon-verdict.md:6](</Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-projection-audit-2026-10-21/hydration-recon-verdict.md:6>); [REPORT.md:34](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-fixes-2026-10-22/REPORT.md:34>)

### MASTER-F6 — Explain missing PP/ES bridge coverage with exact run provenance

- **Implementation:** Exact-game bridge guardrail local (A2); end-to-end scored coverage remains unverified. **Acceptance:** A2 locally independently accepted; issued/live coverage still open. **Release:** Earlier Q9 released R17; new A2 not released.
- **Owner:** FORGE; **reviewer:** UNASSIGNED. **Dependencies:** AUDIT-A2; MASTER-G1; qualified issued heads.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** FORGE378 independent assertions; retained Q9 release distinct from local A2.
- **Acceptance/release gate:** Independent exact-byte acceptance, then separate exact-candidate release authorization where applicable.
- **Next:** Finish exact-byte A2 review, then reconcile coverage using bounded retained receipts.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:157](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:157>); [REVIEW.md:19](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-independent-review-2026-10-22/forge-ledger-lease/REVIEW.md:19>); [tasks-forge-projection-audit-streamlining-2026-10-21.md:246](</Users/tim/Code/fhfhockey.com/tasks/TASKS/forge-projections/tasks-forge-projection-audit-streamlining-2026-10-21.md:246>)

### MASTER-F7 — Preserve paired SOG exposure before compaction [producer + reader gap]

- **Implementation:** Research/contract or local engineering evidence exists; promotion held. **Acceptance:** open. **Release:** not established.
- **Owner:** RESEARCH; **reviewer:** UNASSIGNED. **Dependencies:** F3 target/window contract, current rolling owner, original source-qualified observations for any later backfill. Independent native rollout is not gated merely by this experiment. Approval: Local; Release; Operational for schema/data repair if needed. Size M (bounded support slice; defer historical recomputation)..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Source/status review only; no test rerun by ledger auditor.
- **Acceptance/release gate:** No empirical/model/product promotion without qualified time-ordered source/cohort, accepted contract and separately approved candidate.
- **Next:** Readiness owner inventories current evidence and proposes one bounded next slice; implementation ownership remains UNASSIGNED.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:165](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:165>)

### MASTER-R4 — Preserve postponed-game coverage evidence before playability filtering

- **Implementation:** released content recorded. **Acceptance:** Prior release credit retained; broader/narrower follow-up is separate. **Release:** Contained in retained origin/master; release candidate b5e801d8f.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** schedule contracts and D3 owner. Approval: Local; Release. Size M..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Read local Git release history and model release inventory; affected RSO planner/timeline/lineupGaps/query files equal retained origin/master at HEAD. No test or hosted rerun.
- **Acceptance/release gate:** Existing released content is credited; current audit packet changes and real-account/UI acceptance require their own evidence.
- **Next:** Retain released credit; no new implementation worker for this completed scope. Only separately identified acceptance gaps remain open.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:172](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:172>); [forge-model-release-inventory.md:41](</Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-projection-audit-2026-10-21/forge-model-release-inventory.md:41>); Git `b5e801d8f`

### MASTER-R5 — Recheck schedule freshness inside planner admission [risk]

- **Implementation:** released content recorded. **Acceptance:** Prior release credit retained; broader/narrower follow-up is separate. **Release:** Contained in retained origin/master; release candidate b5e801d8f.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** R4, freshness contract; daily cron activation is a separate decision. Approval: Local; Release/Operational for cron. Size M..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Read local Git release history and model release inventory; affected RSO planner/timeline/lineupGaps/query files equal retained origin/master at HEAD. No test or hosted rerun.
- **Acceptance/release gate:** Existing released content is credited; current audit packet changes and real-account/UI acceptance require their own evidence.
- **Next:** Retain released credit; no new implementation worker for this completed scope. Only separately identified acceptance gaps remain open.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:179](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:179>); [forge-model-release-inventory.md:41](</Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-projection-audit-2026-10-21/forge-model-release-inventory.md:41>); Git `b5e801d8f`

### MASTER-I1 — Turn IFTTT comparison observations into typed regressions

- **Implementation:** Typed fixture packet local; S04/S10 adapter semantics incomplete; later identity experiment separate. **Acceptance:** Fixture credit only; human-label/claim semantics held. **Release:** Live activation not established.
- **Owner:** LUNA; **reviewer:** UNASSIGNED. **Dependencies:** original posts/context, human rubric and unseen local IFTTT notes. Approval: Local; separate paid-test approval/cap and Operational for activation. Size M (fixture slice)..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Retained179 focused tests; no inferred identity/semantic accuracy.
- **Acceptance/release gate:** Independent exact-byte acceptance, then separate exact-candidate release authorization where applicable.
- **Next:** Reconcile replacement, qualifier, correction/time authority and IFTTT migration/activation gates.
- **Evidence:** [REGISTER.md:33](</Users/tim/Code/fhfhockey.com/tasks/artifacts/codex-2026-10-20/REGISTER.md:33>); [I1.md:1](</Users/tim/Code/fhfhockey.com/tasks/artifacts/codex-2026-10-20/I1.md:1>)

### MASTER-F8 — Attribute and evaluate contextual player adjustments before adding boosts

- **Implementation:** Research/contract or local engineering evidence exists; promotion held. **Acceptance:** open. **Release:** not established.
- **Owner:** RESEARCH; **reviewer:** UNASSIGNED. **Dependencies:** F3/F7 support contract for changed weights, exact source selection G1, input availability/coverage. Approval: Local research/tests; Release; changed native methods require owner review. Size M (attribution + frozen experiment design, not all feature implementation)..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Source/status review only; no test rerun by ledger auditor.
- **Acceptance/release gate:** No empirical/model/product promotion without qualified time-ordered source/cohort, accepted contract and separately approved candidate.
- **Next:** RESEARCH owner active on actual sKO/VuDu unit/population/overlap/double-count source audit with synthetic counterexamples; no formula implementation.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:193](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:193>); [REPORT.md:11](</Users/tim/Code/fhfhockey.com/tasks/artifacts/research-backlog-readiness-2026-10-22/REPORT.md:11>)

### MASTER-F9 — Reconcile SOS definitions and benchmark opponent-adjusted strength

- **Implementation:** Local descriptive SoS contract + synthetic benchmark implemented; consumer migration/empirical trial open. **Acceptance:** open. **Release:** not established.
- **Owner:** RESEARCH; **reviewer:** UNASSIGNED. **Dependencies:** current source/metric inventory, F10 before reusing affected prediction features, versioned provider inputs and frozen evaluation protocol. Must not block an independently qualified simpler FORGE path. Approval: Local research/tests; Release/Operational separately. Size L (four bounded stages, not a single-session promise)..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Retained helper checks 15 initially, corrected helper 10, adjacent 7; synthetic numerical assertions. Counts overlap and are not added.
- **Acceptance/release gate:** No empirical/model/product promotion without qualified time-ordered source/cohort, accepted contract and separately approved candidate.
- **Next:** RESEARCH owner retained for bounded contract/fixture work from readiness report; no speculative formulas, empirical fitting or production activation.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:200](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:200>); [F9.md:80](</Users/tim/Code/fhfhockey.com/tasks/artifacts/codex-2026-10-20/F9.md:80>); [REPORT.md:9](</Users/tim/Code/fhfhockey.com/tasks/artifacts/research-backlog-readiness-2026-10-22/REPORT.md:9>)

### MASTER-F10 — Characterize opponent-form rating units and snapshot coverage

- **Implementation:** Local fixed opponent slots/history coverage + ES/PP complete totals; neutral-50 compatibility retained. **Acceptance:** open. **Release:** not established.
- **Owner:** RESEARCH; **reviewer:** UNASSIGNED. **Dependencies:** F9 metric contract if reused for SOS; current prediction model owner and provenance. Approval: Local; Release/Operational for model/data changes. Size M..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Retained 58 distinct focused cases; no exact deployed model qualification.
- **Acceptance/release gate:** Version/units, clipping and historical availability review; exact model comparison before feature/head promotion.
- **Next:** RESEARCH owner retained for bounded contract/fixture work from readiness report; no speculative formulas, empirical fitting or production activation.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:207](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:207>); [F10.md:1](</Users/tim/Code/fhfhockey.com/tasks/artifacts/codex-2026-10-20/F10.md:1>); [REPORT.md:10](</Users/tim/Code/fhfhockey.com/tasks/artifacts/research-backlog-readiness-2026-10-22/REPORT.md:10>)

### MASTER-S1 — Deepen existing sKO/VuDu formulas through counterexamples and paired evaluation

- **Implementation:** Research/contract or local engineering evidence exists; promotion held. **Acceptance:** open. **Release:** not established.
- **Owner:** RESEARCH; **reviewer:** UNASSIGNED. **Dependencies:** F3/F7 exposure provenance, FORGE source/issuance gates, existing `tasks/TASKS/forge-projections/v1/tasks-prd-projection-model.md:238–287` evaluator and baseline-plus-two-challenger restrictions. Approval: research and isolated fixtures authorized; empirical access/fitting and release retain their existing holds. Size M per single experiment, not one open-ended implementation..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Retained actual-export overlap fixtures, not empirical qualification; dedicated S1 archive kit absent.
- **Acceptance/release gate:** No empirical/model/product promotion without qualified time-ordered source/cohort, accepted contract and separately approved candidate.
- **Next:** RESEARCH owner active on actual sKO/VuDu unit/population/overlap/double-count source audit with synthetic counterexamples; no formula implementation.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:214](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:214>); [RESEARCH-KITS.md:14](</Users/tim/Code/fhfhockey.com/tasks/artifacts/codex-2026-10-20/RESEARCH-KITS.md:14>); [REPORT.md:11](</Users/tim/Code/fhfhockey.com/tasks/artifacts/research-backlog-readiness-2026-10-22/REPORT.md:11>)

### MASTER-R7 — Add ownership-informed release caution consistently across RSO

- **Implementation:** RSO ownership caution shipped; cross-surface contract not fully verified. **Acceptance:** Partial; preserve unknown/0/stale semantics across every consumer. **Release:** R10 dbb5af2d1; later drop ranking R12 5e4551c75.
- **Owner:** RESEARCH; **reviewer:** UNASSIGNED. **Dependencies:** R1/R2/R3 legality and shared ownership provenance; league depth/waiver/reclaim/keeper context is currently incomplete. Approval: design/research now; implementation policy/wording review before changing advice; Release for hosted activation. Size M..
- **Evidence level:** behavior tested. **Scope:** Only extracted current-source function/expression synthetic probes plus named inspected ranges; product defects reproduced, not acceptance. **Provenance:** this auditor; HEALTH.json and SOURCE-PROBES.json.
- **Verification:** Release subjects/inventory and current canonical 0% contract inspected; no new consumer suite.
- **Acceptance/release gate:** Independent exact-byte acceptance, then separate exact-candidate release authorization where applicable.
- **Next:** RESEARCH owner retained for bounded contract/fixture work from readiness report; no speculative formulas, empirical fitting or production activation.
- **Proposed dispatch:** P05; Existing YAHOO proposed; not yet assigned this packet. Parent reservation required; existing owner field unchanged.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:221](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:221>); [forge-model-release-inventory.md:46](</Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-projection-audit-2026-10-21/forge-model-release-inventory.md:46>); Git `dbb5af2d1`; Git `5e4551c75`; [REPORT.md:12](</Users/tim/Code/fhfhockey.com/tasks/artifacts/research-backlog-readiness-2026-10-22/REPORT.md:12>); [SOURCE-PROBES.json:1](</Users/tim/Code/fhfhockey.com/tasks/artifacts/fhfh-sprint-ledger-2026-10-22/SOURCE-PROBES.json:1>)

### MASTER-F11 — Separate goalie workload, danger and stopping without double-counting [research + compatibility gate]

- **Implementation:** Research/contract or local engineering evidence exists; promotion held. **Acceptance:** open. **Release:** not established.
- **Owner:** RESEARCH; **reviewer:** UNASSIGNED. **Dependencies:** S1 for VuDu semantics and overlap analysis, F8 effect attribution, qualified on-net evidence and held-out calibration. Decide whether VuDu communicates future-outcome gap with separate environment explanation or context-neutral skill gap; neither is implicitly accepted. Approval: research/design now; model/adapter implementation review, historical-access/fitting gates and Release/Operational remain separate. Size M per contract/fixture slice..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Dedicated F11 archive kit absent; existing goalie overlap evidence is not relabeled F11.
- **Acceptance/release gate:** No empirical/model/product promotion without qualified time-ordered source/cohort, accepted contract and separately approved candidate.
- **Next:** RESEARCH owner active on actual sKO/VuDu unit/population/overlap/double-count source audit with synthetic counterexamples; no formula implementation.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:231](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:231>); [RESEARCH-KITS.md:14](</Users/tim/Code/fhfhockey.com/tasks/artifacts/codex-2026-10-20/RESEARCH-KITS.md:14>); [REPORT.md:11](</Users/tim/Code/fhfhockey.com/tasks/artifacts/research-backlog-readiness-2026-10-22/REPORT.md:11>)

### MASTER-U1 — Refactor player-page responsive layout as a separate agenda [observed UI + source evidence]

- **Implementation:** released content recorded. **Acceptance:** Prior release credit retained; broader/narrower follow-up is separate. **Release:** Contained in retained origin/master; release candidate c2ed28384.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** U2 shared data/context contract; current laptop changes and shared-file ownership; visual direction review. Approval: agenda only now, separately assigned local implementation and TJ visual acceptance, then Release. Size M per session (not one whole-page rewrite)..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Read local Git release history and model release inventory; affected RSO planner/timeline/lineupGaps/query files equal retained origin/master at HEAD. No test or hosted rerun.
- **Acceptance/release gate:** Existing released content is credited; current audit packet changes and real-account/UI acceptance require their own evidence.
- **Next:** Retain released credit; no new implementation worker for this completed scope. Only separately identified acceptance gaps remain open.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:238](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:238>); [forge-model-release-inventory.md:41](</Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-projection-audit-2026-10-21/forge-model-release-inventory.md:41>); Git `c2ed28384`

### MASTER-U2 — Reconcile player-page cross-tab units and participation denominators [observed discrepancies]

- **Implementation:** released content recorded. **Acceptance:** Prior release credit retained; broader/narrower follow-up is separate. **Release:** Contained in retained origin/master; release candidate c2ed28384.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** source definitions and current owner changes; U1 coordination. Approval: agenda now; separately assigned local fix; Release and separate Operational approval for any actual data repair. Size M..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Read local Git release history and model release inventory; affected RSO planner/timeline/lineupGaps/query files equal retained origin/master at HEAD. No test or hosted rerun.
- **Acceptance/release gate:** Existing released content is credited; current audit packet changes and real-account/UI acceptance require their own evidence.
- **Next:** Retain released credit; no new implementation worker for this completed scope. Only separately identified acceptance gaps remain open.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:245](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:245>); [forge-model-release-inventory.md:41](</Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-projection-audit-2026-10-21/forge-model-release-inventory.md:41>); Git `c2ed28384`

### MASTER-A1 — Add historical category consistency, not unvalidated next-game odds [proposed page analysis]

- **Implementation:** Descriptive SOG artifact contract delivered; application integration absent. **Acceptance:** 17syntheticfixtures/23checks passed for artifact contract only. **Release:** not established.
- **Owner:** RESEARCH; **reviewer:** UNASSIGNED. **Dependencies:** U1/U2, canonical per-game counts/appearance identity, F5 for physical-event inputs and F3/F7 for any exposure-based reliability extension. Forecast probabilities require a separate frozen chronological cohort, simple baseline, calibration/Brier or log-score and decision evaluation; neither historical hit rate nor a Poisson assumption supplies this automatically. Approval: product/research proposal now; UI implementation/wording review; Release separately. Size M for SOG-only slice..
- **Evidence level:** behavior tested. **Scope:** Owner offline receipt at pinned packet; no independent whole-area or deployment claim. **Provenance:** imported owner test receipt.
- **Verification:** SOG admission, zero/missing, thresholds, windows, finality/type/cutoff/dedup/invariance fixture checks; application source metadata still insufficient.
- **Acceptance/release gate:** No empirical/model/product promotion without qualified time-ordered source/cohort, accepted contract and separately approved candidate.
- **Next:** P02/player owner must provide stable game/team-at-game/finality/completeness metadata before app integration; no predictive claims.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:252](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:252>); [REPORT.md:13](</Users/tim/Code/fhfhockey.com/tasks/artifacts/research-backlog-readiness-2026-10-22/REPORT.md:13>); [VERIFICATION.md:3](</Users/tim/Code/fhfhockey.com/tasks/artifacts/research-backlog-readiness-2026-10-22/sog/VERIFICATION.md:3>)

### MASTER-R8 — Explain whole-swap category tradeoffs using usable contributions [proposed RSO enhancement]

- **Implementation:** Whole-plan category gains/sacrifices and pooled ratios present; R10 released credit retained. **Acceptance:** Groundwork exists; current broader acceptance/longer-horizon trade extension distinct. **Release:** R10 dbb5af2d1.
- **Owner:** RESEARCH; **reviewer:** UNASSIGNED. **Dependencies:** R1–R3 legality, G1/F6 qualified category heads, league rules, R7 retention caution displayed separately; A1 is optional context, never a prerequisite or substitute for FORGE values. Approval: analysis now; review implementation scope before changing advice; Release separately. Size M for explanation-only slice..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Source/status review only; no test rerun by ledger auditor.
- **Acceptance/release gate:** Independent exact-byte acceptance, then separate exact-candidate release authorization where applicable.
- **Next:** RESEARCH owner retained for bounded contract/fixture work from readiness report; no speculative formulas, empirical fitting or production activation.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:259](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:259>); Git `dbb5af2d1`; [REPORT.md:12](</Users/tim/Code/fhfhockey.com/tasks/artifacts/research-backlog-readiness-2026-10-22/REPORT.md:12>)

### MASTER-R6 — Measure full serialized transport and storage budgets

- **Implementation:** released content recorded. **Acceptance:** Prior release credit retained; broader/narrower follow-up is separate. **Release:** Contained in retained origin/master; release candidate b5e801d8f.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** actual request/response shapes, browser storage failure behavior; avoid private saved-plan exports. Approval: Local; Release. Size M..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Read local Git release history and model release inventory; affected RSO planner/timeline/lineupGaps/query files equal retained origin/master at HEAD. No test or hosted rerun.
- **Acceptance/release gate:** Existing released content is credited; current audit packet changes and real-account/UI acceptance require their own evidence.
- **Next:** Retain released credit; no new implementation worker for this completed scope. Only separately identified acceptance gaps remain open.
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:268](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:268>); [forge-model-release-inventory.md:41](</Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-projection-audit-2026-10-21/forge-model-release-inventory.md:41>); Git `b5e801d8f`

### MASTER-O1 — Evaluate deployment-bound trace evidence for debugging [optional tooling]

- **Implementation:** Read-only trace recipe prepared; CLI help validated historically. **Acceptance:** Hosted observability coverage unverified. **Release:** No instrumentation or hosted query.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** appropriate read-only access, observability coverage and owner-authorized session; not a product-release prerequisite. Approval: planning only now; separate hosted-access/instrumentation review and Release if application code changes. Size S..
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Source/status review only; no test rerun by ledger auditor.
- **Acceptance/release gate:** Independent exact-byte acceptance, then separate exact-candidate release authorization where applicable.
- **Next:** Assign optional observability owner only if evidence need warrants it.
- **Proposed dispatch:** P09; Existing PIPELINE proposed queued local readiness slices. Parent reservation required; existing owner field unchanged.
- **Evidence:** [O1-TRACE-RECIPE.md:1](</Users/tim/Code/fhfhockey.com/tasks/artifacts/codex-2026-10-20/O1-TRACE-RECIPE.md:1>)

## Independent audit repairs

### AUDIT-A1 — Strict prior-day context

- **Implementation:** implemented locally; uncommitted. **Acceptance:** qualified independent acceptance for local guardrail integration. **Release:** not released.
- **Owner:** FORGE; **reviewer:** REVIEW. **Dependencies:** Queue packet dependencies; preserve shared file claims.
- **Evidence level:** independently accepted. **Scope:** Only exact local packet and tested contract described in linked independent review; no whole-area or deployed acceptance. **Provenance:** imported independent review; auditor did not rerun it.
- **Verification:** Independent378 assertions:366 existing suites+5original oracles+7lease cases;14file hashes stable; scoped lint/patch checks pass.
- **Acceptance/release gate:** Historical exact-candidate/vintage qualification still held
- **Next:** Integrate only reviewed hashes; retain separate historical/completeness/universe/concurrency gates. Follow-up NST route edits need a new exact-byte pass.
- **Evidence:** [REVIEW.md:18](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-independent-review-2026-10-22/forge-ledger-lease/REVIEW.md:18>)

### AUDIT-A2 — Keep complete exact-game forecast despite incomplete newer line

- **Implementation:** implemented locally; uncommitted. **Acceptance:** qualified independent acceptance for local guardrail integration. **Release:** not released.
- **Owner:** FORGE; **reviewer:** REVIEW. **Dependencies:** Queue packet dependencies; preserve shared file claims.
- **Evidence level:** independently accepted. **Scope:** Only exact local packet and tested contract described in linked independent review; no whole-area or deployed acceptance. **Provenance:** imported independent review; auditor did not rerun it.
- **Verification:** Independent378 assertions:366 existing suites+5original oracles+7lease cases;14file hashes stable; scoped lint/patch checks pass.
- **Acceptance/release gate:** Preserve expiry/team/null-head gates; no fabricated next-game forecast
- **Next:** Integrate only reviewed hashes; retain separate historical/completeness/universe/concurrency gates. Follow-up NST route edits need a new exact-byte pass.
- **Evidence:** [REVIEW.md:19](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-independent-review-2026-10-22/forge-ledger-lease/REVIEW.md:19>)

### AUDIT-A3 — Missing actuals stay unknown without authoritative completion evidence

- **Implementation:** implemented locally; uncommitted. **Acceptance:** qualified independent acceptance for local guardrail integration. **Release:** not released.
- **Owner:** FORGE; **reviewer:** REVIEW. **Dependencies:** Queue packet dependencies; preserve shared file claims.
- **Evidence level:** independently accepted. **Scope:** Only exact local packet and tested contract described in linked independent review; no whole-area or deployed acceptance. **Provenance:** imported independent review; auditor did not rerun it.
- **Verification:** Independent378 assertions:366 existing suites+5original oracles+7lease cases;14file hashes stable; scoped lint/patch checks pass.
- **Acceptance/release gate:** Trusted finality/completeness producer absent; historical zeros outside replay window unaudited
- **Next:** Integrate only reviewed hashes; retain separate historical/completeness/universe/concurrency gates. Follow-up NST route edits need a new exact-byte pass.
- **Evidence:** [REVIEW.md:20](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-independent-review-2026-10-22/forge-ledger-lease/REVIEW.md:20>)

### AUDIT-A4 — Independent dressed-player universe and honest unavailable coverage

- **Implementation:** implemented locally; uncommitted. **Acceptance:** qualified independent acceptance for local guardrail integration. **Release:** not released.
- **Owner:** FORGE; **reviewer:** REVIEW. **Dependencies:** Queue packet dependencies; preserve shared file claims.
- **Evidence level:** independently accepted. **Scope:** Only exact local packet and tested contract described in linked independent review; no whole-area or deployed acceptance. **Provenance:** imported independent review; auditor did not rerun it.
- **Verification:** Independent378 assertions:366 existing suites+5original oracles+7lease cases;14file hashes stable; scoped lint/patch checks pass.
- **Acceptance/release gate:** Durable universe storage/complete snapshot receipt unimplemented; optional SQL view not qualified
- **Next:** Integrate only reviewed hashes; retain separate historical/completeness/universe/concurrency gates. Follow-up NST route edits need a new exact-byte pass.
- **Evidence:** [REVIEW.md:21](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-independent-review-2026-10-22/forge-ledger-lease/REVIEW.md:21>)

### AUDIT-A5 — Missing weighted actual stat remains null

- **Implementation:** implemented locally; uncommitted. **Acceptance:** qualified local acceptance. **Release:** not released.
- **Owner:** YAHOO; **reviewer:** REVIEW. **Dependencies:** Queue packet dependencies; preserve shared file claims.
- **Evidence level:** independently accepted. **Scope:** Only exact local packet and tested contract described in linked independent review; no whole-area or deployed acceptance. **Provenance:** imported independent review; auditor did not rerun it.
- **Verification:** Independent138 suite cases+1 original A5 assertion
- **Acceptance/release gate:** Absent-player DNP inference deliberately excluded
- **Next:** Integrate accepted hash-pinned packet only; retain excluded end-to-end gates.
- **Evidence:** [REVIEW.md:18](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-independent-review-2026-10-22/a5-a10-yahoo/REVIEW.md:18>)

### AUDIT-A6 — Late checkpoint kill classification; explicit handoff; owner-keyed accounting

- **Implementation:** implemented locally; uncommitted. **Acceptance:** Original pinned packet accepted; three current pipeline files changed in authorized continuation follow-up and need fresh review. **Release:** not released.
- **Owner:** FORGE; **reviewer:** REVIEW. **Dependencies:** Queue packet dependencies; preserve shared file claims.
- **Evidence level:** independently accepted. **Scope:** Only exact local packet and tested contract described in linked independent review; no whole-area or deployed acceptance. **Provenance:** imported independent review; auditor did not rerun it.
- **Verification:** Independent378 assertions:366 existing suites+5original oracles+7lease cases;14file hashes stable; scoped lint/patch checks pass.
- **Acceptance/release gate:** Real DB concurrency/killed process unrun; quiescent/new-run transition required
- **Next:** Retain prior378-assertion receipt against original hashes; re-review new state/route/test delta after FORGE lead finishes.
- **Evidence:** [REVIEW.md:22](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-independent-review-2026-10-22/forge-ledger-lease/REVIEW.md:22>)

### AUDIT-A7 — Matching complete samples for rates and ranks

- **Implementation:** R1 consumer-query repair implemented locally. **Acceptance:** Qualified independent acceptance; R1 hold closed. **Release:** not released.
- **Owner:** STATS; **reviewer:** STATS-REVIEW. **Dependencies:** Queue packet dependencies; preserve shared file claims.
- **Evidence level:** independently accepted. **Scope:** Only exact local packet and tested contract described in linked independent review; no whole-area or deployed acceptance. **Provenance:** imported independent review; auditor did not rerun it.
- **Verification:** Independent R1: original2 + negative2 + cross-consumer10 passed (14 total); scoped TS/lint;13hashes matched. Earlier A8/A9 checks retained without rerun.
- **Acceptance/release gate:** Pinned local query/aggregation contract accepted; source completeness, combined integration and release remain separate.
- **Next:** Integrate pinned accepted R1 bytes. Upstream absent rows and broader S01 acceptance remain distinct.
- **Evidence:** [REVIEW.md:5](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-independent-review-2026-10-22/a7-a9-stats/REVIEW.md:5>); [REVIEW.md:35](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-independent-review-2026-10-22/a7-a9-stats/REVIEW.md:35>); [REVIEW.md:3](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-independent-review-2026-10-22/a7-a9-stats/r1/REVIEW.md:3>)

### AUDIT-A8 — Withhold goalie workload windows on incomplete pagination

- **Implementation:** implemented locally; uncommitted. **Acceptance:** qualified independent local acceptance. **Release:** not released.
- **Owner:** STATS; **reviewer:** STATS-REVIEW. **Dependencies:** Queue packet dependencies; preserve shared file claims.
- **Evidence level:** independently accepted. **Scope:** Only exact local packet and tested contract described in linked independent review; no whole-area or deployed acceptance. **Provenance:** imported independent review; auditor did not rerun it.
- **Verification:** Independent111 focused+3original reproductions+3stale pagination checks passed; scoped tsc/lint. A7 failures do not close or invalidate these scoped cases.
- **Acceptance/release gate:** Bounded2 attempts,8 concurrent; real-provider completeness not certified
- **Next:** Retain accepted A8/A9 hashes while bounded A7 query/mock follow-up is repaired.
- **Evidence:** [REVIEW.md:23](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-independent-review-2026-10-22/a7-a9-stats/REVIEW.md:23>)

### AUDIT-A9 — Shot-data request ownership and A→B→A cache correctness

- **Implementation:** implemented locally; uncommitted. **Acceptance:** qualified independent local acceptance. **Release:** not released.
- **Owner:** STATS; **reviewer:** STATS-REVIEW. **Dependencies:** Queue packet dependencies; preserve shared file claims.
- **Evidence level:** independently accepted. **Scope:** Only exact local packet and tested contract described in linked independent review; no whole-area or deployed acceptance. **Provenance:** imported independent review; auditor did not rerun it.
- **Verification:** Independent111 focused+3original reproductions+3stale pagination checks passed; scoped tsc/lint. A7 failures do not close or invalidate these scoped cases.
- **Acceptance/release gate:** Provider query/filter semantics unchanged; no live request needed
- **Next:** Retain accepted A8/A9 hashes while bounded A7 query/mock follow-up is repaired.
- **Evidence:** [REVIEW.md:24](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-independent-review-2026-10-22/a7-a9-stats/REVIEW.md:24>)

### AUDIT-A10 — Provider-route mock contract exercises real shared guard

- **Implementation:** implemented locally; uncommitted. **Acceptance:** qualified local acceptance. **Release:** not released.
- **Owner:** YAHOO; **reviewer:** REVIEW. **Dependencies:** Queue packet dependencies; preserve shared file claims.
- **Evidence level:** independently accepted. **Scope:** Only exact local packet and tested contract described in linked independent review; no whole-area or deployed acceptance. **Provenance:** imported independent review; auditor did not rerun it.
- **Verification:** Independent138 suite cases including75 Yahoo,14 access,49 paywall
- **Acceptance/release gate:** A repaired verification seam, not live security/RLS or full billing acceptance
- **Next:** Integrate accepted hash-pinned packet only; retain excluded end-to-end gates.
- **Evidence:** [REVIEW.md:22](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-independent-review-2026-10-22/a5-a10-yahoo/REVIEW.md:22>)

## Stats S01–S20

### STATS-S01 — Team shares and GS1 truth

- **Implementation:** Local implementation + A7 repair. **Acceptance:** A7 consumer-admission hold closed; broader S01 plan acceptance not inferred. **Release:** No whole-slice release acceptance established.
- **Owner:** STATS; **reviewer:** STATS-REVIEW. **Dependencies:** AUDIT-A7; shared TeamDashboard ownership.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Imported accepted A7–A9 packet and R1 review; no proof of entirely absent source rows or whole S01 source/UX scope.
- **Acceptance/release gate:** Declared units, paired exposure, zero/null, source keys; unknown unsupported state; independent exact-byte checks and affected fixture-safe interaction/width coverage.
- **Next:** STATS owner can take next bounded P06 slice after parent file reservation; retain unverified full-plan boundaries.
- **Evidence:** [users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:170](</Users/tim/.claude/plans/users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:170>); [REVIEW.md:5](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-independent-review-2026-10-22/a7-a9-stats/REVIEW.md:5>); [REVIEW.md:3](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-independent-review-2026-10-22/a7-a9-stats/r1/REVIEW.md:3>)

### STATS-S02 — Team Schedule reconciliation

- **Implementation:** No current complete receipt found. **Acceptance:** not established. **Release:** No whole-slice release acceptance established.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** S01; existing schedule consumers.
- **Evidence level:** behavior tested. **Scope:** Only extracted current-source function/expression synthetic probes plus named inspected ranges; product defects reproduced, not acceptance. **Provenance:** this auditor; HEALTH.json and SOURCE-PROBES.json.
- **Verification:** Plan acceptance is proposed, not executed evidence.
- **Acceptance/release gate:** Completed regular-season cohort, points/OTL, date-only timezone and modal parity; independent exact-byte checks and affected fixture-safe interaction/width coverage.
- **Next:** Parent reserves a bounded owner; preserve existing work and execute only this slice after dependencies.
- **Proposed dispatch:** P01; New Astra stats schedule worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:191](</Users/tim/.claude/plans/users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:191>); [SOURCE-PROBES.json:1](</Users/tim/Code/fhfhockey.com/tasks/artifacts/fhfh-sprint-ledger-2026-10-22/SOURCE-PROBES.json:1>)

### STATS-S03 — Goalie truth across landing/profile

- **Implementation:** No current complete receipt found. **Acceptance:** not established. **Release:** No whole-slice release acceptance established.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** S07 shared player files serialized; S18 sources.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Plan acceptance is proposed, not executed evidence.
- **Acceptance/release gate:** QS classification/starts coverage; SV/GAA matched exposure; null/zero qualification; independent exact-byte checks and affected fixture-safe interaction/width coverage.
- **Next:** Parent reserves a bounded owner; preserve existing work and execute only this slice after dependencies.
- **Proposed dispatch:** P02; New Astra player worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:205](</Users/tim/.claude/plans/users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:205>)

### STATS-S04 — Timeline truth

- **Implementation:** No current complete receipt found. **Acceptance:** not established. **Release:** No whole-slice release acceptance established.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** Approved source and snapshot/game evidence.
- **Evidence level:** behavior tested. **Scope:** Only extracted current-source function/expression synthetic probes plus named inspected ranges; product defects reproduced, not acceptance. **Provenance:** this auditor; HEALTH.json and SOURCE-PROBES.json.
- **Verification:** Plan acceptance is proposed, not executed evidence.
- **Acceptance/release gate:** No unapproved xG fallback; never sum snapshots as games; independent exact-byte checks and affected fixture-safe interaction/width coverage.
- **Next:** Parent reserves a bounded owner; preserve existing work and execute only this slice after dependencies.
- **Proposed dispatch:** P03; New Astra stats route worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:227](</Users/tim/.claude/plans/users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:227>); [SOURCE-PROBES.json:1](</Users/tim/Code/fhfhockey.com/tasks/artifacts/fhfh-sprint-ledger-2026-10-22/SOURCE-PROBES.json:1>)

### STATS-S05 — Goalie workload and responsive containment

- **Implementation:** Local load-time work + AUDIT-A8; full slice incomplete. **Acceptance:** partial local evidence; full slice open. **Release:** No whole-slice release acceptance established.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** S02 completed-game cohort; AUDIT-A8.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** See owning A7–A9 packet for111+3; prior S01/load-time receipts retained without adding overlapping counts.
- **Acceptance/release gate:** Elapsed completed team games; recovery, selected team, responsive shell and no overflow; independent exact-byte checks and affected fixture-safe interaction/width coverage.
- **Next:** Parent reserves a bounded owner; preserve existing work and execute only this slice after dependencies.
- **Proposed dispatch:** P01; New Astra stats schedule worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:228](</Users/tim/.claude/plans/users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:228>); [REPORT.md:5](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-fixes-2026-10-22/a7-a9-stats/REPORT.md:5>)

### STATS-S06 — Honest lines and Shot Map tabs

- **Implementation:** Local lazy loading + AUDIT-A9; line/type/filter remainder unverified. **Acceptance:** partial local evidence; full slice open. **Release:** No whole-slice release acceptance established.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** S01 integration; AUDIT-A9.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** See owning A7–A9 packet for111+3; prior S01/load-time receipts retained without adding overlapping counts.
- **Acceptance/release gate:** Canonical lineup shapes; event-type/reset/coordinate cases; no inactive reads; independent exact-byte checks and affected fixture-safe interaction/width coverage.
- **Next:** Parent reserves a bounded owner; preserve existing work and execute only this slice after dependencies.
- **Proposed dispatch:** P06; Existing STATS proposed next slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:229](</Users/tim/.claude/plans/users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:229>); [REPORT.md:5](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-fixes-2026-10-22/a7-a9-stats/REPORT.md:5>)

### STATS-S07 — Player scope and participation

- **Implementation:** R8/R9/R10 partial foundations + local SSR/radar speed changes. **Acceptance:** partial local evidence; full slice open. **Release:** No whole-slice release acceptance established.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** S03 then S12; protected player improvements.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** See owning A7–A9 packet for111+3; prior S01/load-time receipts retained without adding overlapping counts.
- **Acceptance/release gate:** Season/type/date/identity/eligibility consistency; >30 logs, zero vs missed, real refetch; independent exact-byte checks and affected fixture-safe interaction/width coverage.
- **Next:** Parent reserves a bounded owner; preserve existing work and execute only this slice after dependencies.
- **Proposed dispatch:** P02; New Astra player worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:230](</Users/tim/.claude/plans/users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:230>)

### STATS-S08 — Game-route correction

- **Implementation:** Earlier diary mentions fixes; no complete current acceptance packet found. **Acceptance:** partial local evidence; full slice open. **Release:** No whole-slice release acceptance established.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** S11 inbound links wait on acceptance.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Plan acceptance is proposed, not executed evidence.
- **Acceptance/release gate:** ID/schema/state/0–0/error; independent panels; truthful H2H and source timing; independent exact-byte checks and affected fixture-safe interaction/width coverage.
- **Next:** Parent reserves a bounded owner; preserve existing work and execute only this slice after dependencies.
- **Proposed dispatch:** P03; New Astra stats route worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:231](</Users/tim/.claude/plans/users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:231>)

### STATS-S09 — Accessible shared search

- **Implementation:** No current complete receipt found. **Acceptance:** not established. **Release:** No whole-slice release acceptance established.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** Exclusive shared-search ownership.
- **Evidence level:** behavior tested. **Scope:** Only extracted current-source function/expression synthetic probes plus named inspected ranges; product defects reproduced, not acceptance. **Provenance:** this auditor; HEALTH.json and SOURCE-PROBES.json.
- **Verification:** Plan acceptance is proposed, not executed evidence.
- **Acceptance/release gate:** Keyboard/touch/stale responses/loading/error/recovery/focus return; independent exact-byte checks and affected fixture-safe interaction/width coverage.
- **Next:** Parent reserves a bounded owner; preserve existing work and execute only this slice after dependencies.
- **Proposed dispatch:** P04; New Astra search/navigation worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:232](</Users/tim/.claude/plans/users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:232>); [SOURCE-PROBES.json:1](</Users/tim/Code/fhfhockey.com/tasks/artifacts/fhfh-sprint-ledger-2026-10-22/SOURCE-PROBES.json:1>)

### STATS-S10 — Roster and remaining semantics

- **Implementation:** No current complete receipt found. **Acceptance:** not established. **Release:** No whole-slice release acceptance established.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** S06/S07 shared controls settled.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Plan acceptance is proposed, not executed evidence.
- **Acceptance/release gate:** Position/zero/null/SV% formatting; injury source; labels/tab IDs/touch/keyboard; independent exact-byte checks and affected fixture-safe interaction/width coverage.
- **Next:** Parent reserves a bounded owner; preserve existing work and execute only this slice after dependencies.
- **Proposed dispatch:** P04; New Astra search/navigation worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:233](</Users/tim/.claude/plans/users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:233>)

### STATS-S11 — Connected discovery

- **Implementation:** No current complete receipt found. **Acceptance:** not established. **Release:** No whole-slice release acceptance established.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** Accepted S08 for inbound game links; relevant correctness slices.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Plan acceptance is proposed, not executed evidence.
- **Acceptance/release gate:** Stable IDs; correct context and back behavior; no nested anchors or invented IDs; independent exact-byte checks and affected fixture-safe interaction/width coverage.
- **Next:** Parent reserves a bounded owner; preserve existing work and execute only this slice after dependencies.
- **Proposed dispatch:** P04; New Astra search/navigation worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:234](</Users/tim/.claude/plans/users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:234>)

### STATS-S12 — Reproducible query context and definitions

- **Implementation:** No current complete receipt found. **Acceptance:** not established. **Release:** No whole-slice release acceptance established.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** S07; current URL/query builders.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Plan acceptance is proposed, not executed evidence.
- **Acceptance/release gate:** Reload/back/share; truthful data-through vs updated clocks; accessible exact values; independent exact-byte checks and affected fixture-safe interaction/width coverage.
- **Next:** Parent reserves a bounded owner; preserve existing work and execute only this slice after dependencies.
- **Proposed dispatch:** P04; New Astra search/navigation worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:235](</Users/tim/.claude/plans/users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:235>)

### STATS-S13 — GS2 Trends

- **Implementation:** Planned; unsupported affordances remain hidden. **Acceptance:** not established. **Release:** No whole-slice release acceptance established.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** Accepted S01+S12; dated row semantics.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Plan acceptance is proposed, not executed evidence.
- **Acceptance/release gate:** Source/strength/window/exposure/sample/gaps; snapshot series accurately labeled; independent exact-byte checks and affected fixture-safe interaction/width coverage.
- **Next:** Parent reserves a bounded owner; preserve existing work and execute only this slice after dependencies.
- **Proposed dispatch:** P06; Existing STATS proposed next slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:239](</Users/tim/.claude/plans/users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:239>)

### STATS-S14 — GS3 League Comparison

- **Implementation:** Planned; A7 rank guards are not GS3 completion. **Acceptance:** not established. **Release:** No whole-slice release acceptance established.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** Accepted S13; qualified comparable team cohort.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Plan acceptance is proposed, not executed evidence.
- **Acceptance/release gate:** 32-team target, actual included N, ties/ranks/percentiles and missing teams; independent exact-byte checks and affected fixture-safe interaction/width coverage.
- **Next:** Parent reserves a bounded owner; preserve existing work and execute only this slice after dependencies.
- **Proposed dispatch:** P06; Existing STATS proposed next slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:241](</Users/tim/.claude/plans/users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:241>)

### STATS-S15 — Recent versus baseline capability

- **Implementation:** Optional proposal; not implemented/accepted by evidence. **Acceptance:** not established. **Release:** No whole-slice release acceptance established.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** S03/S07/S12.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Plan acceptance is proposed, not executed evidence.
- **Acceptance/release gate:** Opportunity/exposure/actual N/trades/deployment; no hot/cold forecast inference; independent fixture/browser acceptance and separate release. Optional capability needs scope approval.
- **Next:** Parent reserves a bounded owner; preserve existing work and execute only this slice after dependencies.
- **Evidence:** [users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:249](</Users/tim/.claude/plans/users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:249>)

### STATS-S16 — Observed comparison capability

- **Implementation:** Optional proposal; not implemented/accepted by evidence. **Acceptance:** not established. **Release:** No whole-slice release acceptance established.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** S12/S15.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Plan acceptance is proposed, not executed evidence.
- **Acceptance/release gate:** Same-type same-query observed contract; null parity; no duplicate scoring; independent fixture/browser acceptance and separate release. Optional capability needs scope approval.
- **Next:** Parent reserves a bounded owner; preserve existing work and execute only this slice after dependencies.
- **Evidence:** [users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:250](</Users/tim/.claude/plans/users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:250>)

### STATS-S17 — Reproducible export capability

- **Implementation:** Optional proposal; not implemented/accepted by evidence. **Acceptance:** not established. **Release:** No whole-slice release acceptance established.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** Source rights; complete selected result semantics.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Plan acceptance is proposed, not executed evidence.
- **Acceptance/release gate:** Stable IDs/units/query/scope/clocks; deterministic full-result/filter/sort parity; independent fixture/browser acceptance and separate release. Optional capability needs scope approval.
- **Next:** Parent reserves a bounded owner; preserve existing work and execute only this slice after dependencies.
- **Evidence:** [users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:251](</Users/tim/.claude/plans/users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:251>)

### STATS-S18 — Goalie specialist / injury source extension

- **Implementation:** Optional proposal; source compatibility held. **Acceptance:** not established. **Release:** No whole-slice release acceptance established.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** S03; MASTER-S1/F11; matched event population.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Plan acceptance is proposed, not executed evidence.
- **Acceptance/release gate:** Danger/GSAA/VuDu definitions and rights; unsupported metrics unavailable; independent fixture/browser acceptance and separate release. Optional capability needs scope approval.
- **Next:** Parent reserves a bounded owner; preserve existing work and execute only this slice after dependencies.
- **Evidence:** [users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:252](</Users/tim/.claude/plans/users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:252>)

### STATS-S19 — Upcoming opportunity strip

- **Implementation:** Optional proposal; not implemented/accepted by evidence. **Acceptance:** not established. **Release:** No whole-slice release acceptance established.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** Existing schedule logic; verified scope.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Plan acceptance is proposed, not executed evidence.
- **Acceptance/release gate:** Seven-day date/team parity; future versus history; ownership never league availability; independent fixture/browser acceptance and separate release. Optional capability needs scope approval.
- **Next:** Parent reserves a bounded owner; preserve existing work and execute only this slice after dependencies.
- **Evidence:** [users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:253](</Users/tim/.claude/plans/users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:253>)

### STATS-S20 — Covered game events

- **Implementation:** Optional proposal; not implemented/accepted by evidence. **Acceptance:** not established. **Release:** No whole-slice release acceptance established.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** Accepted S08/S11; existing PBP.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Plan acceptance is proposed, not executed evidence.
- **Acceptance/release gate:** Game/boxscore/PBP identity; pagination/partial coverage; unknown xG not zero; independent fixture/browser acceptance and separate release. Optional capability needs scope approval.
- **Next:** Parent reserves a bounded owner; preserve existing work and execute only this slice after dependencies.
- **Evidence:** [users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:254](</Users/tim/.claude/plans/users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:254>)

### STATS-R1 — Deferred legacy routes/presets scope checkpoint

- **Implementation:** Decision checkpoint. **Acceptance:** open. **Release:** not applicable.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** STATS-S12.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Current plan only
- **Acceptance/release gate:** Confirm rejected duplicate engines remain excluded; record any separately authorized change
- **Next:** Resolve after S12, no implementation by implication
- **Evidence:** [users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:165](</Users/tim/.claude/plans/users-tim-downloads-fhfh-stats-audit-ev-delegated-sprout.md:165>)

## Current RSO forecast gates

### RSO-FE-01 — Honest missing/mixed coverage

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** Canonical FE source dependencies; MASTER-G1.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P07; New Astra forecast-boundary worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:77](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:77>)

### RSO-FE-02 — Shared coverage/provenance boundary

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-01.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P07; New Astra forecast-boundary worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:78](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:78>)

### RSO-FE-03 — Producer/input readiness

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-02.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:79](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:79>)

### RSO-FE-04 — Skater conditioning boundary

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-02/03.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:80](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:80>)

### RSO-FE-05 — Near-term serving

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-03/04.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:81](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:81>)

### RSO-FE-06 — Baseline candidate

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-02/03.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P07; New Astra forecast-boundary worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:82](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:82>)

### RSO-FE-07 — Lazy RSO integration

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-04/05/06.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P07; New Astra forecast-boundary worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:83](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:83>)

### RSO-FE-08 — Goalie/category completeness

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-02/05/06.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:84](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:84>)

### RSO-FE-09 — Deterministic bounded planning

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-02/07/08.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P07; New Astra forecast-boundary worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:85](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:85>)

### RSO-FE-10 — Recommendation validation

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-05–09.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:86](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:86>)

### RSO-FE-11 — Production activation

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** Canonical FE source dependencies; MASTER-G1.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:87](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:87>)

### RSO-FE-03a — Repair and verify live inputs

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** Canonical FE source dependencies; MASTER-G1.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:115](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:115>)

### RSO-FE-05b — Profile before expanding generation

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-05a.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:123](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:123>)

### RSO-FE-05c — Verify horizon operation and coherent serving

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-03a/05b and applicable release authorization.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:125](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:125>)

### RSO-FE-04a — Resolve participation coverage for advertised uses

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-03a.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:129](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:129>)

### RSO-FE-08a — Complete the live goalie path

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-03a.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:132](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:132>)

### RSO-FE-08b — Close target and settlement gaps for declared profiles

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** Canonical FE source dependencies; MASTER-G1.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:133](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:133>)

### RSO-FE-10a — Freeze evaluation policy and prospective evidence

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-04a/08b for advertised profiles.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:143](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:143>)

### RSO-FE-10b — Settle and evaluate as outcomes arrive

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-10a.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:145](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:145>)

### RSO-FE-07a — Validate baseline release and continuity

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-10a/10b.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P07; New Astra forecast-boundary worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:146](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:146>)

### RSO-FE-09a — Measure actual consumer performance

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** eligible shared snapshots.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P07; New Astra forecast-boundary worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:147](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:147>)

### RSO-FE-11a — Review and authorize the exact rollout

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** the applicable items above.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:152](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:152>)

### RSO-FE-02c — Preserve issued context through the public adapter

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** Canonical FE source dependencies; MASTER-G1.
- **Evidence level:** source inspected. **Scope:** publicPlanningForecasts/admitConsumerGameRevisions and loadPlanningData named ranges only; full consumer behavior untested **Provenance:** this auditor.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** P07 proposed boundary owner inspects detailed target/use approval and nearest tests; do not treat all-use literal as full runtime/exploit proof.
- **Proposed dispatch:** P07; New Astra forecast-boundary worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:162](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:162>); [consumerRevisionAdmission.ts:121](</Users/tim/Code/fhfhockey.com/web/lib/projections/consumerRevisionAdmission.ts:121>)

### RSO-FE-04b — Supply a separate baseline participation contract

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-02b/02c and FE-04a policy.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P07; New Astra forecast-boundary worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:192](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:192>)

### RSO-FE-05d — Implement refresh and operational coverage, not just initial queue seeding

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-02a/02c, FE-03a and FE-05a.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:193](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:193>)

### RSO-FE-06a — Make baseline input capture coherent and finalize the window contract

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** Canonical FE source dependencies; MASTER-G1.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P07; New Astra forecast-boundary worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:196](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:196>)

### RSO-FE-06b — Connect bounded baseline generation to shared refreshes

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-06a and FE-02c.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P07; New Astra forecast-boundary worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:205](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:205>)

### RSO-FE-07b — Compare the exact resolved complete plans

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-02b/02c.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P07; New Astra forecast-boundary worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:209](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:209>)

### RSO-FE-08c — Align the goalie producer with mixture semantics/version

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-08a.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:210](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:210>)

### RSO-FE-08d — Settle authoritative nonappearances without inventing zeros

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-02c.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:215](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:215>)

### RSO-FE-09b — Implement the planned cache boundaries and invalidation

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-02c, FE-05d and FE-06b.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P07; New Astra forecast-boundary worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:216](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:216>)

### RSO-FE-10c — Implement matched rate and FORGE benchmark evaluation

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-06a, FE-10a and supported settlement.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:218](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:218>)

### RSO-FE-10d — Retain and evaluate downstream planning decisions

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-07b, FE-08b/08d and FE-10a.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:219](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:219>)

### RSO-FE-10e — Make settlement ingestion bounded, complete and reproducible

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-08d and precedes FE-10b operational scale-up.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:223](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:223>)

### RSO-FE-01c — Explain player-quality bench decisions

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-02c and FE-07b for source identity.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P07; New Astra forecast-boundary worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:226](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:226>)

### RSO-FE-10f — Verify evaluation-reader completeness

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** Canonical FE source dependencies; MASTER-G1.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:229](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:229>)

### RSO-FE-05e — Separate diagnostic completeness from usable coverage

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-02a and feeds FE-05c/05d.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:233](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:233>)

### RSO-FE-05f — Operate a bounded calendar horizon locally without new Vercel generation

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-05a/05b/05e and FE-05d refresh semantics.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:243](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:243>)

### RSO-FE-10g — Connect the local prospective freeze/outcome/evaluation lifecycle

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-10a policy/selection contract, FE-10e/10f and FE-05f for horizon operation.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:292](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:292>)

### RSO-FE-07c — Label the actual evidence used in lineup and comparison views

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-02c/07b, with FE-01c displacement explanations.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P07; New Astra forecast-boundary worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:297](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:297>)

### RSO-FE-07e — Carry the selected horizon policy through generation and consumption

- **Implementation:** Local progress explicitly recorded; current authority leaves gate open. **Acceptance:** not closed; exact newer evidence reconciliation required. **Release:** Existing RSO bridge release does not activate all shared forecast gates.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** FE-02c and FE-05 scope contracts; feeds FE-07a/09b/10a.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical unchecked row with partial receipts, not a current whole-feature test pass. Private exports deliberately not read.
- **Acceptance/release gate:** Use exact canonical acceptance in source row; future/prospective, account and operation gates cannot be closed by local helper tests.
- **Next:** Assign explicit acceptance/implementation owner; map to native/RSO current candidate before doing duplicate work.
- **Proposed dispatch:** P07; New Astra forecast-boundary worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-roster-schedule-optimizer.md:303](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-roster-schedule-optimizer.md:303>)

## FORGE native

### NATIVE-ISSUANCE — Qualified target-only writer → publish/readback → compatible readers

- **Implementation:** Local v1/v2/replay infrastructure; dark serving. **Acceptance:** held. **Release:** dark only.
- **Owner:** FORGE; **reviewer:** UNASSIGNED. **Dependencies:** MASTER-G1/N1/N2; corrected A1; qualified target heads.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Retained code/task receipts only
- **Acceptance/release gate:** Exact immutable issuance/readback and common revision before consumer activation; distinct operational approval
- **Next:** Name native execution custodian and exact bounded candidate
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-forge-daily-pipeline.md:14](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-forge-daily-pipeline.md:14>); [forge-model-release-inventory.md:32](</Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-projection-audit-2026-10-21/forge-model-release-inventory.md:32>)

### FORGE-Q7-Q8 — Conversion shrink and rest/B2B challenger gates

- **Implementation:** Local HOLD commits. **Acceptance:** not qualified. **Release:** HOLD.
- **Owner:** RESEARCH; **reviewer:** UNASSIGNED. **Dependencies:** MASTER-F3/F7/F8; valid captured cohort.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Retained verdict: Q7 not cleared; Q8 wash, no empirical promotion
- **Acceptance/release gate:** Frozen common-origin cohort/heads/calibration; no tuning from anecdote
- **Next:** Preserve HOLD; reconcile candidate budget and exact comparator
- **Evidence:** [forge-model-release-inventory.md:28](</Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-projection-audit-2026-10-21/forge-model-release-inventory.md:28>)

### FORGE-HYDRATION-HB — Final combined hydration + hits/blocks qualification

- **Implementation:** Components exist; final-c result not located. **Acceptance:** held. **Release:** unreleased.
- **Owner:** FORGE; **reviewer:** UNASSIGNED. **Dependencies:** AUDIT-A1; MASTER-F5; physical-event source semantics.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Four-arm reconstruction is historical current-DB evidence, not prior availability
- **Acceptance/release gate:** Do not qualify corrected final candidate with invalid inclusive capture signatures; migration88 separate
- **Next:** Record legitimate input availability and exact final bytes; executor UNASSIGNED
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [REPORT.md:34](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-fixes-2026-10-22/REPORT.md:34>); [hydration-recon-verdict.md:6](</Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-projection-audit-2026-10-21/hydration-recon-verdict.md:6>)

### LEDGER-COMPLETENESS — Authoritative finality/DNP evidence producer and prior-zero audit

- **Implementation:** Safe unknown guardrail implemented; producer absent. **Acceptance:** held. **Release:** unreleased follow-up.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** AUDIT-A3; RSO-FE-08d.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** No producer/storage or historical cleanup executed
- **Acceptance/release gate:** Game/team/class/final/ingest-complete provenance; separately bounded data repair
- **Next:** Agree producer/storage contract without inferring absence from unrelated rows
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [REPORT.md:35](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-fixes-2026-10-22/REPORT.md:35>)

### LEDGER-UNIVERSE — Durable independent dressed denominator and snapshot receipt

- **Implementation:** Pure universe/score contract only; storage unimplemented. **Acceptance:** held. **Release:** coverage unavailable.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** AUDIT-A4; independent complete snapshot.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** 2/1=0.5 pure oracle; no durable read/write proof
- **Acceptance/release gate:** Persist separate membership and complete-snapshot provenance; never use emitted forecasts/current roster as historical universe
- **Next:** Review smallest local schema/storage scope; no migration application
- **Proposed dispatch:** P08; Existing FORGE proposed next contract/readiness slice. Parent reservation required; existing owner field unchanged.
- **Evidence:** [REPORT.md:36](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-fixes-2026-10-22/REPORT.md:36>)

## Pipeline and data

### PIPE-NATURAL — Natural daily pipeline completion / terminal alert evidence

- **Implementation:** Read-only readiness complete; Oct22 scheduled outcome receipt not found. **Acceptance:** Automatic chain/consumer acceptance open. **Release:** R20 recorded.
- **Owner:** PIPELINE; **reviewer:** UNASSIGNED. **Dependencies:** AUDIT-A6; correct producer pair; existing job records.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Daily owner compared canonical cronJSON with R20; nine10:05–10:55 slots, RSO08:52/14:52, settle11:00,snapshot12:30. R20 smokes do not prove natural execution.
- **Acceptance/release gate:** Existing Oct22 invocation/audit/state/h1coverage + fresh RSO witness and bounded consumer evidence. First natural snapshotOct22 12:30; first settlementOct23 11:00, so empty today is inconclusive.
- **Next:** FORGE lead fixes existing NST207 integration locally; runtime receipts require separate bounded read permission.
- **Proposed dispatch:** P09; Existing PIPELINE proposed queued local readiness slices. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-forge-projection-audit-streamlining-2026-10-21.md:274](</Users/tim/Code/fhfhockey.com/tasks/TASKS/forge-projections/tasks-forge-projection-audit-streamlining-2026-10-21.md:274>); [vercel.json:1](</Users/tim/Code/fhfhockey.com/web/vercel.json:1>); [run-rolling-forge-pipeline.ts:429](</Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-rolling-forge-pipeline.ts:429>)

### PIPE-BACKFILL — NST10-07..10-18 gap proof and affected rolling rewrite

- **Implementation:** User reports active background NST backfill; runtime/host/progress not inspected. **Acceptance:** blocked/unverified. **Release:** not established.
- **Owner:** PIPELINE; **reviewer:** UNASSIGNED. **Dependencies:** Source recovery; separately bounded production authorization.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Last saved source state521;cursor0. Daily owner corrects full scope to12dates×20URLs=240requests, not older180estimate. No new execution.
- **Acceptance/release gate:** Date×table coverage then exact bounded recompute/readback; all four NST rolling limits
- **Next:** Parent clarifies local versus deployed runtime; preserve user process, do not invoke backfill or poll production. Prior outage/cursor receipt is historical and cannot describe this current run.
- **Proposed dispatch:** P09; Existing PIPELINE proposed queued local readiness slices. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-forge-projection-audit-streamlining-2026-10-21.md:76](</Users/tim/Code/fhfhockey.com/tasks/TASKS/forge-projections/tasks-forge-projection-audit-streamlining-2026-10-21.md:76>); [tasks-forge-projection-audit-streamlining-2026-10-21.md:256](</Users/tim/Code/fhfhockey.com/tasks/TASKS/forge-projections/tasks-forge-projection-audit-streamlining-2026-10-21.md:256>)

### PIPE-JOB79 — Conditional retirement of redundant NST job79

- **Implementation:** Proposal only. **Acceptance:** held. **Release:** not changed by this audit.
- **Owner:** PIPELINE; **reviewer:** UNASSIGNED. **Dependencies:** PIPE-BACKFILL.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** 5.5 unchecked; older scheduled failures retained
- **Acceptance/release gate:** Backfill proof and preserved coverage + explicit schedule authorization
- **Next:** Keep active until requirements met; propose exact operational plan only
- **Proposed dispatch:** P09; Existing PIPELINE proposed queued local readiness slices. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-forge-projection-audit-streamlining-2026-10-21.md:69](</Users/tim/Code/fhfhockey.com/tasks/TASKS/forge-projections/tasks-forge-projection-audit-streamlining-2026-10-21.md:69>)

### PIPE-ROLLING-DROP — Post-drop writer parity and storage follow-through

- **Implementation:** 491-column drop shipped/applied perR17; parity gate open. **Acceptance:** partial. **Release:** R17 recorded.
- **Owner:** PIPELINE; **reviewer:** UNASSIGNED. **Dependencies:** Streamlining7.5; current natural run.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** 714 tests retained;20players×5strength parity not closed
- **Acceptance/release gate:** Do not equate absence of literal readers with row-identical recompute; vacuum is separate user operation
- **Next:** Reconcile retained post-drop/natural receipt and any user vacuum outcome
- **Proposed dispatch:** P09; Existing PIPELINE proposed queued local readiness slices. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-forge-projection-audit-streamlining-2026-10-21.md:224](</Users/tim/Code/fhfhockey.com/tasks/TASKS/forge-projections/tasks-forge-projection-audit-streamlining-2026-10-21.md:224>); [tasks-forge-projection-audit-streamlining-2026-10-21.md:250](</Users/tim/Code/fhfhockey.com/tasks/TASKS/forge-projections/tasks-forge-projection-audit-streamlining-2026-10-21.md:250>)

### CRON-REPORT — Continuation labels and metadata-derived alert eligibility

- **Implementation:** Local dirty report/email packet. **Acceptance:** local checks; integration acceptance open. **Release:** not established.
- **Owner:** PIPELINE; **reviewer:** UNASSIGNED. **Dependencies:** Compatible wrapper metadata; terminal attempts_exhausted/stage_killed.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Retained report78/email13/wrappers38; not additive aggregate claim
- **Acceptance/release gate:** Pin wrapper/report pairing and focused terminal-state evidence
- **Next:** Reconcile current report diff and new daily-pipeline findings
- **Evidence:** [CRON-REPORT.md:1](</Users/tim/Code/fhfhockey.com/tasks/artifacts/codex-2026-10-20/CRON-REPORT.md:1>)

### WGO-HISTORY — Historical season/date identity repair

- **Implementation:** Forward guard exists;105-row correction not authorized/executed in receipt. **Acceptance:** held. **Release:** forward fix distinct from data repair.
- **Owner:** PIPELINE; **reviewer:** UNASSIGNED. **Dependencies:** MASTER-F5; canonical identity and source dates.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Retained9 guard tests; historical proposal only
- **Acceptance/release gate:** Never broad shift or truncate from count mismatch; bounded identity plan and approval
- **Next:** Inventory unresolved historical records using already-retained redacted evidence
- **Evidence:** [WGO-LABELS.md:1](</Users/tim/Code/fhfhockey.com/tasks/artifacts/codex-2026-10-20/WGO-LABELS.md:1>)

### SUSTAINABILITY-NATURAL — Batch-complete natural sustainability chain and markers

- **Implementation:** Local repair credit; wider marker backlog retained. **Acceptance:** natural execution unverified. **Release:** historical fixes released; exact closure open.
- **Owner:** PIPELINE; **reviewer:** UNASSIGNED. **Dependencies:** Ordered source/window/score chain.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Historical82/171 backlog and4 fresh markers; counts do not prove current full run
- **Acceptance/release gate:** Natural non-overlap/full-population receipt; no arbitrary cron disable
- **Next:** Reconcile newest retained job evidence and closure rows
- **Evidence:** [REGISTER.md:39](</Users/tim/Code/fhfhockey.com/tasks/artifacts/codex-2026-10-20/REGISTER.md:39>); [tasks-prd-sustainability-barometer.md:181](</Users/tim/Code/fhfhockey.com/tasks/TASKS/three-pillars-analytics/sustainability/tasks-prd-sustainability-barometer.md:181>)

### PIPE-NST207 — Enable/reconcile existing acknowledged NST207 continuation contract

- **Implementation:** Safety correction assigned but shared ingestion/runner edits paused: user reports active background NST backfill. **Acceptance:** HOLD: NST-R1 P1 overlap erases durable manual-review hold; NST-R2 P2 failed hold write advertises retry. **Release:** not released.
- **Owner:** FORGE; **reviewer:** REVIEW. **Dependencies:** AcceptedA6route custody; D1producer contract.
- **Evidence level:** behavior tested. **Scope:** Independent failing source/route oracles in exact continuation packet; no local acceptance or rollout. **Provenance:** imported independent review.
- **Verification:** Independent155existing+5additional passed;2safety oracles failed. Actual same-version overlap and failed-hold-write paths reproduced with mocked child/lease harness.
- **Acceptance/release gate:** Network-denied producer/consumer route regression; preserve source_down degrade and A6lease contract; exact route re-review after edit.
- **Next:** FORGE owner continues isolated analysis only; parent clarifies local Mac versus deployed runtime and file collision before resuming shared edits. No NST calls/process interference.
- **Proposed dispatch:** P09; Existing PIPELINE proposed queued local readiness slices. Parent reservation required; existing owner field unchanged.
- **Evidence:** [run-rolling-forge-pipeline.ts:429](</Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-rolling-forge-pipeline.ts:429>); [D1-D2-HANDOFF.md:22](</Users/tim/Code/fhfhockey.com/tasks/artifacts/codex-2026-10-20/D1-D2-HANDOFF.md:22>); [REVIEW.md:3](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-independent-review-2026-10-22/nst-continuation/REVIEW.md:3>)

### D4-SCHEDULE-RPC — Reconcile recurring schedule RPC definition with canonical migration chain

- **Implementation:** Canonical caller exists; definition located only in task draft. **Acceptance:** schema/caller gap open; no hosted outage claimed. **Release:** not established.
- **Owner:** GRANTS; **reviewer:** UNASSIGNED. **Dependencies:** MASTER-D4; canonical authority; schedule owner.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** README118 records absent canonical definition; hosted existence not queried.
- **Acceptance/release gate:** Do not silently add migration or apply all pending entries; confirm intended authoritative definition and exact release scope.
- **Next:** GRANTS owner reports gap; implementation owner UNASSIGNED; local harness repair does not solve it.
- **Evidence:** [README.md:118](</Users/tim/Code/fhfhockey.com/tasks/artifacts/d4-grants-2026-10-20/README.md:118>)

## Paid sync and billing

### PAID-SYNC — Shared Yahoo/Fantrax paid sync gates with manual workflows preserved

- **Implementation:** 55-path local packet; A10 seam accepted separately. **Acceptance:** broader packet review not established. **Release:** not released.
- **Owner:** BILLING; **reviewer:** UNASSIGNED. **Dependencies:** Verified in-season/legacy grants; A5/A10 shared dependency fence.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Retained35files636 deduplicated latest-per-file cases; no all-state×route proof
- **Acceptance/release gate:** Real guard/owner boundaries; no revocation of valid legacy grant without cohort rule; RLS/provider acceptance separate
- **Next:** Pin combined billing/sync candidate and remaining consumer review
- **Evidence:** [REPORT.md:62](</Users/tim/Code/fhfhockey.com/tasks/artifacts/provider-sync-paywall-2026-10-21/REPORT.md:62>); [REVIEW.md:22](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-independent-review-2026-10-22/a5-a10-yahoo/REVIEW.md:22>)

### BILLING-QUEUE — Monthly queue job isolation and confirmed failure identities

- **Implementation:** Latest correction implemented locally. **Acceptance:** Latest correction independently accepted for local integration. **Release:** disabled/unreleased.
- **Owner:** BILLING; **reviewer:** BILLING-REVIEW. **Dependencies:** Durable retry receipts; draftSQL; frozen7files.
- **Evidence level:** independently accepted. **Scope:** Only exact local packet and tested contract described in linked independent review; no whole-area or deployed acceptance. **Provenance:** imported independent review; auditor did not rerun it.
- **Verification:** Independent235/235 plus original2repros;14realPGqueue groups retained;11latestcorrection hashes match per readiness report. Prior counts overlap.
- **Acceptance/release gate:** Re-review exact7hashes and SQL, unresolved outcomes stay running; no public activation
- **Next:** Preserve accepted correction while new guarded local wiring packet proceeds; review new delta independently.
- **Evidence:** [READINESS-OWNER-2026-10-22.md:15](</Users/tim/Code/fhfhockey.com/tasks/artifacts/in-season-billing-2026-10-21/READINESS-OWNER-2026-10-22.md:15>)

### BILLING-SANDBOX — Checkout/cancellation/grace/retry/natural July cutoff

- **Implementation:** Approved isolated3checkout cases and natural cutoff executed. **Acceptance:** retained sandbox credit; live acceptance separate. **Release:** public monthly checkout/auto executor disabled.
- **Owner:** BILLING; **reviewer:** UNASSIGNED. **Dependencies:** BILLING-QUEUE; access policy; sandbox/live separation.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Later receipts supersede initial setup blockers; July cutoff without invoice/worker recorded
- **Acceptance/release gate:** No silent sandbox→live promotion; real trigger/config and selected candidate separately authorized
- **Next:** Retain results; close only precise remaining billing findings
- **Evidence:** [REPORT.md:9](</Users/tim/Code/fhfhockey.com/tasks/artifacts/in-season-billing-2026-10-21/REPORT.md:9>)

### BILLING-REFUND — Complete sandbox refund verification

- **Implementation:** Request awaiting specific dashboard approval in last receipt. **Acceptance:** pending external approval. **Release:** not release-ready.
- **Owner:** BILLING; **reviewer:** UNASSIGNED. **Dependencies:** Recorded Stripe approval; no duplicate request.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Last authorized outcome2026-10-21T18:43:57Z requires_review, no refund object; current outcome unverified.
- **Acceptance/release gate:** Confirm existing outcome before retry; do not substitute live payment
- **Next:** Owner checks only within approved refund scope
- **Evidence:** [READINESS-OWNER-2026-10-22.md:46](</Users/tim/Code/fhfhockey.com/tasks/artifacts/in-season-billing-2026-10-21/READINESS-OWNER-2026-10-22.md:46>)

### BILLING-WIRING — Guarded signup/cancel management UI and inactive authenticated worker entrypoint

- **Implementation:** Guarded UI/routes and inactive authenticated worker implemented locally; all gates default off. **Acceptance:** HOLD pending P2 same-owner TOKEN_REFRESHED cancellation-request identity correction. **Release:** disabled/no activation.
- **Owner:** BILLING; **reviewer:** BILLING-REVIEW. **Dependencies:** AcceptedBILLING-QUEUE; owner-safe access; existing adapter.
- **Evidence level:** behavior tested. **Scope:** Owner offline receipt at pinned packet; no independent whole-area or deployment claim. **Provenance:** imported owner test receipt.
- **Verification:** Owner307tests/fullTS/lint; parent reports independent105tests pass and P2 uncertain cancellation retry loses original request identity. No duplicate collection demonstrated. All11prior correctionfiles preserved.
- **Acceptance/release gate:** Mock anonymous/foreign-owner, min/config/outage/account-switch/cancel and bounded partial worker failures; no active trigger/config/service call.
- **Next:** BILLING owner makes assigned narrow identity-preservation correction; BILLING-REVIEW verifies exact delta. Gates stay off; isolated ownerlookupRPC/live acceptance remains open.
- **Evidence:** [READINESS-OWNER-2026-10-22.md:25](</Users/tim/Code/fhfhockey.com/tasks/artifacts/in-season-billing-2026-10-21/READINESS-OWNER-2026-10-22.md:25>); [HANDOFF.md:3](</Users/tim/Code/fhfhockey.com/tasks/artifacts/in-season-billing-2026-10-21/inactive-entrypoints-2026-10-22/HANDOFF.md:3>)

### BILLING-LIVE — Live commercial, hosting, monitoring, schema and service-recovery release gates

- **Implementation:** Not activated; sandbox-only schema/config. **Acceptance:** held. **Release:** not release-ready.
- **Owner:** BILLING; **reviewer:** UNASSIGNED. **Dependencies:** BILLING-WIRING; real refund/dispute/interruption evidence; workerhost/cadence.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Accepted policy does not establish live currency minimum/tax/demand or scheduler reliability.
- **Acceptance/release gate:** Confirm live minimum/tax/terms, host/budget/cadence/monitoring response owner, schema/rollback and exact deployment authorization.
- **Next:** Prepare concrete gated plan; preserve existing grants and no fourth sandboxCheckout.
- **Evidence:** [READINESS-OWNER-2026-10-22.md:43](</Users/tim/Code/fhfhockey.com/tasks/artifacts/in-season-billing-2026-10-21/READINESS-OWNER-2026-10-22.md:43>)

## Luna and IFTTT

### LUNA-LOCAL — Default-off identity proposals and graded local comparison

- **Implementation:** Local modules/caller/acronym correction implemented. **Acceptance:** Offline readiness checks passed; efficacy/live integration held. **Release:** default-off.
- **Owner:** LUNA; **reviewer:** UNASSIGNED. **Dependencies:** Original source/directory/occurrence hashes; no authority expansion.
- **Evidence level:** behavior tested. **Scope:** Owner offline receipt at pinned packet; no independent whole-area or deployment claim. **Provenance:** imported owner test receipt.
- **Verification:** 252distinct offline tests across11files, including91identity tests;40trial pins unchanged; no test added. Earlier164/91not added.
- **Acceptance/release gate:** Suggestions separate from aliases/claims; exact IDs/spans and independent labels
- **Next:** LUNA owner prepares retained-export dated provenance adapter and review-only identity-to-claim contract; no paid/live action.
- **Evidence:** [READINESS.md:25](</Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-ifttt-readiness-2026-10-22/READINESS.md:25>); [READINESS.md:75](</Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-ifttt-readiness-2026-10-22/READINESS.md:75>)

### LUNA-TRIAL — S06 development shadow identity trial

- **Implementation:** One approved request completed;2owner-agreeing proposals. **Acceptance:** case-level validation only. **Release:** no rollout.
- **Owner:** LUNA; **reviewer:** UNASSIGNED. **Dependencies:** Partial2-player directory; exposed development labels.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** HTTP200/completed;2,167tokens;usage-price0.000311500USD;ceiling0.000342650USD per retained receipt
- **Acceptance/release gate:** No general accuracy/notification claim; representative heldout bank and broad dated directory needed
- **Next:** Design separately bounded holdout; no new paid call implied
- **Evidence:** [TRIAL-RESULT.md:3](</Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-identity-offline-2026-10-20/acronym-continuation/TRIAL-RESULT.md:3>)

### LUNA-BUDGET — Preserve unknown billed-outcome reservation and aggregate cap

- **Implementation:** Prior uncertain attempt retained. **Acceptance:** uncertain prior outcome; no new attempt here. **Release:** not applicable.
- **Owner:** LUNA; **reviewer:** UNASSIGNED. **Dependencies:** Existing aggregate ledger; no competing budget store.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Receipt exposure0.262519843 under0.52cap;uncertain reservation0.254394800 remains
- **Acceptance/release gate:** Headroom is not authorization; no reset/clear/retry of uncertain outcome
- **Next:** Owner reconciles original outcome within existing approved process
- **Evidence:** [TRIAL-RESULT.md:34](</Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-identity-offline-2026-10-20/acronym-continuation/TRIAL-RESULT.md:34>)

### LUNA-NICKNAME — Owner-confirmed RNH canonical nickname

- **Implementation:** One approved mapping written and independently read back. **Acceptance:** mapping persistence complete. **Release:** data change recorded; reader activation not verified.
- **Owner:** LUNA; **reviewer:** UNASSIGNED. **Dependencies:** Explicit owner identity-only confirmation.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Canonical alias readback receipt; no model confidence used
- **Acceptance/release gate:** No historical membership or broader alias learning inferred
- **Next:** No repeat write; verify consuming path only if separately requested
- **Evidence:** [REPORT.md:3](</Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-identity-offline-2026-10-20/owner-confirmed-nickname/REPORT.md:3>)

### IFTTT-ACTIVATION — Typed semantics, retention/recovery and hosted activation

- **Implementation:** Local I1 fixtures and retained SQL6–8 designs. **Acceptance:** full semantic and hosted gates open. **Release:** not established.
- **Owner:** LUNA; **reviewer:** UNASSIGNED. **Dependencies:** MASTER-I1; migration89/90 compatibility; human rubric.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Fixture-only semantic gaps S04/S10 remain; identity trial is separate
- **Acceptance/release gate:** Approved paid cap/source/claim authority; do not auto-publish from identity result
- **Next:** Reconcile current typed pipeline and migration/activation receipts
- **Evidence:** [REGISTER.md:33](</Users/tim/Code/fhfhockey.com/tasks/artifacts/codex-2026-10-20/REGISTER.md:33>); [README.md:16](</Users/tim/Code/fhfhockey.com/tasks/artifacts/d4-grants-2026-10-20/README.md:16>)

### LUNA-PROVENANCE — Retained safe export → dated identity snapshot provenance

- **Implementation:** Task-only dated provenance/review replacement artifacts completed; no application changes. **Acceptance:** 30offline artifact tests and scopedTS passed; application/efficacy/live gates open. **Release:** default-off.
- **Owner:** LUNA; **reviewer:** UNASSIGNED. **Dependencies:** Recorded alias observation vs validity policy; membership intervals; unchanged safe export.
- **Evidence level:** behavior tested. **Scope:** Owner offline receipt at pinned packet; no independent whole-area or deployment claim. **Provenance:** imported owner test receipt.
- **Verification:** 16provenance+14replacement tests;40trialpins retained; strict snapshots withhold unsupported historical alias/membership validity; old response remains bound to old directory.
- **Acceptance/release gate:** Do not retrodate owner-confirmed alias to September29 or flatten provenance; dates/conflicts/truncation remain unknown.
- **Next:** Retain completed artifacts; parent chooses separately bounded future application packet and missing historical evidence. No new paid/live action.
- **Evidence:** [READINESS.md:77](</Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-ifttt-readiness-2026-10-22/READINESS.md:77>); [README.md:3](</Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-dated-contracts-2026-10-22/README.md:3>)

### LUNA-CLAIM-CONTRACT — Review-only identity→claim replacement/subject boundary

- **Implementation:** Task-only dated provenance/review replacement artifacts completed; no application changes. **Acceptance:** 30offline artifact tests and scopedTS passed; application/efficacy/live gates open. **Release:** no automated publication.
- **Owner:** LUNA; **reviewer:** UNASSIGNED. **Dependencies:** Retained validatedS06proposals; exact occurrence/direction/game-time bounds.
- **Evidence level:** behavior tested. **Scope:** Owner offline receipt at pinned packet; no independent whole-area or deployment claim. **Provenance:** imported owner test receipt.
- **Verification:** 16provenance+14replacement tests;40trialpins retained; strict snapshots withhold unsupported historical alias/membership validity; old response remains bound to old directory.
- **Acceptance/release gate:** Never send multi-person chunk to single-player reviewer; matched ID is not confirmed participation.
- **Next:** Retain completed artifacts; parent chooses separately bounded future application packet and missing historical evidence. No new paid/live action.
- **Evidence:** [READINESS.md:78](</Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-ifttt-readiness-2026-10-22/READINESS.md:78>); [README.md:3](</Users/tim/Code/fhfhockey.com/tasks/artifacts/luna-dated-contracts-2026-10-22/README.md:3>)

## Remaining site

### SITE-START-CONTRACT — Start Chart paging/disclosure/category contract parity

- **Implementation:** Current task-list NEW20 remains unchecked. **Acceptance:** unverified. **Release:** existing UI shipped; documentation/contract closure open.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** Exact current source/retained release; no native gate weakening.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Task-source only; no new browser inspection
- **Acceptance/release gate:** Reconcile View all/initiallimit/category/performance budget with actual supported behavior
- **Next:** Assign bounded current source/contract audit
- **Proposed dispatch:** P07; New Astra forecast-boundary worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-start-chart.md:216](</Users/tim/Code/fhfhockey.com/tasks/TASKS/forge-projections/v1/tasks-prd-start-chart.md:216>)

### SITE-START-RECENTFORM — Qualified Recent Team Form before restoring old CTPI

- **Implementation:** Current NEW17 open. **Acceptance:** held. **Release:** not established.
- **Owner:** RESEARCH; **reviewer:** UNASSIGNED. **Dependencies:** Qualified contract and dated inputs; MASTER-F9/F10.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Current task source; no promotion evidence inferred
- **Acceptance/release gate:** No old CTPI reactivation without qualified replacement
- **Next:** Readiness owner identifies superseding implementation/evidence
- **Evidence:** [tasks-prd-start-chart.md:197](</Users/tim/Code/fhfhockey.com/tasks/TASKS/forge-projections/v1/tasks-prd-start-chart.md:197>)

### SITE-NPM — Resolve scoped dependency audit findings

- **Implementation:** Triage report only. **Acceptance:** unfixed/unassigned. **Release:** not changed.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** No install/lockfile change in audit scope.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Retained57findings; current exposure not rescanned
- **Acceptance/release gate:** Assign risk-specific update/test scope before dependency change
- **Next:** Prioritize exploitable/reachable findings; do not broad-upgrade
- **Proposed dispatch:** P09; Existing PIPELINE proposed queued local readiness slices. Parent reservation required; existing owner field unchanged.
- **Evidence:** [NPM-AUDIT-TRIAGE.md:1](</Users/tim/Code/fhfhockey.com/tasks/artifacts/codex-2026-10-20/NPM-AUDIT-TRIAGE.md:1>)

### SITE-ESPN — Classify optional ESPN odds failures/source access

- **Implementation:** Decision memo only. **Acceptance:** unverified. **Release:** no source/schedule change.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** Existing logs vs HTTP403/network failures; unrelated forecast health preserved.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** No provider probe;42failures/14days historical supplied context
- **Acceptance/release gate:** No unsupported provider-policy claim; precise bounded evidence and approval
- **Next:** Assign evidence owner or retain explicit backlog
- **Proposed dispatch:** P09; Existing PIPELINE proposed queued local readiness slices. Parent reservation required; existing owner field unchanged.
- **Evidence:** [A21-ESPN.md:5](</Users/tim/Code/fhfhockey.com/tasks/artifacts/codex-2026-10-20/A21-ESPN.md:5>)

### SITE-DRAFT-ERRORS — Draft Pro status/error sweep and refund-route follow-up

- **Implementation:** Local37-test sweep; account refund consumer excluded. **Acceptance:** follow-up unverified. **Release:** not established.
- **Owner:** BILLING; **reviewer:** UNASSIGNED. **Dependencies:** Current refund/commerce boundaries.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Retained3files37tests; refund route not included
- **Acceptance/release gate:** Private-safe branded errors across real consumer; keep separate from payment approval
- **Next:** Billing owner triages exact out-of-scope consumer before edits
- **Evidence:** [DRAFT-PRO-STATUS.md:11](</Users/tim/Code/fhfhockey.com/tasks/artifacts/codex-2026-10-20/DRAFT-PRO-STATUS.md:11>)

### RSO-REAL-ACCEPTANCE — Fresh real-account owner acceptance window

- **Implementation:** Older10-12..18 window expired; local/provider partial receipts. **Acceptance:** open. **Release:** public beta gate retained.
- **Owner:** UNASSIGNED; **reviewer:** UNASSIGNED. **Dependencies:** Qualified forecasts; provider rules; saved context; current release.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Private exports not read; tests do not substitute owner flow
- **Acceptance/release gate:** Fresh dated bounded account/league acceptance with consent; no private data in ledger
- **Next:** Parent reserves acceptance owner/window
- **Evidence:** [MASTER-TASKLIST-2026-10-20.md:289](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:289>); [HANDOFF-2026-10-20.md:151](</Users/tim/Code/fhfhockey.com/tasks/handoff-2026-10-20/HANDOFF-2026-10-20.md:151>)

## Sprint operations

### SPRINT-USAGE — Usage meter and bounded work pacing

- **Implementation:** Watcher assigned. **Acceptance:** ongoing. **Release:** not applicable.
- **Owner:** USAGE; **reviewer:** UNASSIGNED. **Dependencies:** Parent staffing and checkpoints.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Parent-reported latest checkpoint:59%weekly remaining at2026-10-22T12:58:32Z. No fresh usage tool read by ledger owner. Quota conservation is not a sprint stop condition.
- **Acceptance/release gate:** Meter observation not productivity/model-brand judgment
- **Next:** Parent retains monitoring, dispatch and stop coordination. User permits quota to run to0%or STOP SPRINT; quota conservation is not a sprint stop condition. Paid/external/production authority remains separate.
- **Evidence:** Parent dispatch; no runtime receipt claimed.

### SPRINT-INTEGRATE — Pin combined accepted release candidate and dependencies

- **Implementation:** Separate local packets; no combined acceptance yet. **Acceptance:** open. **Release:** no release authorized here.
- **Owner:** PARENT; **reviewer:** UNASSIGNED. **Dependencies:** AcceptedFORGE14,Yahoo,A7–A9includingR1,D4harness; unresolvedNSTmanual-reviewhold andbillingcancellationidentity followups; sourcehealthH01–H05; preserve currentfileleases.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Per-packet hash verification in this ledger; no combined tests claimed
- **Acceptance/release gate:** Review exact accepted files/dependencies; all project deployment inventory and exactSHA authorization before any remote build
- **Next:** Parent dispatches WORK-PACKETS local gaps, collects exact follow-up acceptance, and later pins combined candidate; no release authorized here.
- **Evidence:** [REPORT.md:38](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-fixes-2026-10-22/REPORT.md:38>); [REPORT.md:78](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-fixes-2026-10-22/a7-a9-stats/REPORT.md:78>); [REVIEW.md:57](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-independent-review-2026-10-22/a5-a10-yahoo/REVIEW.md:57>)

### SPRINT-LEDGER — Maintain evidence-grounded dedicated task ledger

- **Implementation:** 151-entry ledger plus explicit evidence tiers,11scopedsourcefileinspections,6offlineobservations and9proposed stagedpackets delivered. **Acceptance:** Metadata/reference/owner validation passed; not independent acceptance of every underlying application item. **Release:** local documentation only.
- **Owner:** LEDGER; **reviewer:** UNASSIGNED. **Dependencies:** Parent owner/status updates; canonical sources.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Metadata/reference/whitespace checks; source probes reproduce4defectclasses with5cases and1control; nativeFE02c sourcegap reconfirmed. This is not whole-repository vetting.
- **Acceptance/release gate:** Only ledger/own diary writes; no completeness percentages, private exports or author inference
- **Next:** Parent dispatches proposed exactfiles; further ledger updates consume source-pinned worker/reviewer receipts.
- **Evidence:** [QUEUE.md:29](</Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-fix-queue-2026-10-22/QUEUE.md:29>)

## Research products

### RESEARCH-MONETIZATION — Value proposition and sustainable marginal-cost evidence

- **Implementation:** No separate prior researchID; this ledger adds tracking only. **Acceptance:** no demand/economic proof. **Release:** not a billing activation task.
- **Owner:** RESEARCH; **reviewer:** UNASSIGNED. **Dependencies:** Accepted commerce policy; free manual baseline; authorized aggregates only.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Readiness found no demand/conversion/retention/uniqueness evidence.
- **Acceptance/release gate:** Jobs-to-feature matrix, synthetic usability script and measured-vs-assumed cost worksheet; recruitment/analytics/pricing/activation separate.
- **Next:** Prepare bounded contract/fixture evidence; do not change settled pricing.
- **Evidence:** [REPORT.md:71](</Users/tim/Code/fhfhockey.com/tasks/artifacts/research-backlog-readiness-2026-10-22/REPORT.md:71>)

### BLSH-2.2 — Implement 5/10/20 scheduled-team-game selection, actual date-span labels and expected appearances. Require explicit common-date inputs for date-aligned comparisons.

- **Implementation:** Partial groundwork/fixture evidence in current authority; unchecked requirement remains. **Acceptance:** open; exact current acceptance not established. **Release:** fixture/local scope; no new release.
- **Owner:** RESEARCH; **reviewer:** UNASSIGNED. **Dependencies:** MASTER-S1/F11/R7/R8 and canonical task dependencies.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Readiness maps current code to existing task IDs; no empirical/user-demand inference.
- **Acceptance/release gate:** Canonical item acceptance plus qualified shared adapter/input identity and independent UX/statistical review; optional5.x remains separately scoped.
- **Next:** RESEARCH owner inventories/frames bounded contract/fixture work; application implementer UNASSIGNED unless parent reserves it.
- **Proposed dispatch:** P07; New Astra forecast-boundary worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-buy-low-sell-high.md:27](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-buy-low-sell-high.md:27>); [REPORT.md:63](</Users/tim/Code/fhfhockey.com/tasks/artifacts/research-backlog-readiness-2026-10-22/REPORT.md:63>)

### BLSH-3.1 — Build compact filters, Rebound/Cooling views, sortable candidate rows and a detail panel with opportunity, volatility, confidence and observed duration.

- **Implementation:** Partial groundwork/fixture evidence in current authority; unchecked requirement remains. **Acceptance:** open; exact current acceptance not established. **Release:** fixture/local scope; no new release.
- **Owner:** RESEARCH; **reviewer:** UNASSIGNED. **Dependencies:** MASTER-S1/F11/R7/R8 and canonical task dependencies.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Readiness maps current code to existing task IDs; no empirical/user-demand inference.
- **Acceptance/release gate:** Canonical item acceptance plus qualified shared adapter/input identity and independent UX/statistical review; optional5.x remains separately scoped.
- **Next:** RESEARCH owner inventories/frames bounded contract/fixture work; application implementer UNASSIGNED unless parent reserves it.
- **Proposed dispatch:** P07; New Astra forecast-boundary worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-buy-low-sell-high.md:33](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-buy-low-sell-high.md:33>); [REPORT.md:63](</Users/tim/Code/fhfhockey.com/tasks/artifacts/research-backlog-readiness-2026-10-22/REPORT.md:63>)

### BLSH-3.4 — Create mobile list/detail/trade layouts, keyboard/touch-accessible explanation controls and visible essential limitations. Capture desktop/mobile fixture screenshots for owner review.

- **Implementation:** Partial groundwork/fixture evidence in current authority; unchecked requirement remains. **Acceptance:** open; exact current acceptance not established. **Release:** fixture/local scope; no new release.
- **Owner:** RESEARCH; **reviewer:** UNASSIGNED. **Dependencies:** MASTER-S1/F11/R7/R8 and canonical task dependencies.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Readiness maps current code to existing task IDs; no empirical/user-demand inference.
- **Acceptance/release gate:** Canonical item acceptance plus qualified shared adapter/input identity and independent UX/statistical review; optional5.x remains separately scoped.
- **Next:** RESEARCH owner inventories/frames bounded contract/fixture work; application implementer UNASSIGNED unless parent reserves it.
- **Proposed dispatch:** P07; New Astra forecast-boundary worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-buy-low-sell-high.md:36](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-buy-low-sell-high.md:36>); [REPORT.md:63](</Users/tim/Code/fhfhockey.com/tasks/artifacts/research-backlog-readiness-2026-10-22/REPORT.md:63>)

### BLSH-4.1 — After shared serving is ready, replace fixture inputs with the existing batched reader. Preserve as-of/model/source identity, allowed uses, freshness and missingness; avoid per-player external fetches.

- **Implementation:** Partial groundwork/fixture evidence in current authority; unchecked requirement remains. **Acceptance:** open; exact current acceptance not established. **Release:** fixture/local scope; no new release.
- **Owner:** RESEARCH; **reviewer:** UNASSIGNED. **Dependencies:** MASTER-S1/F11/R7/R8 and canonical task dependencies.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Readiness maps current code to existing task IDs; no empirical/user-demand inference.
- **Acceptance/release gate:** Canonical item acceptance plus qualified shared adapter/input identity and independent UX/statistical review; optional5.x remains separately scoped.
- **Next:** RESEARCH owner inventories/frames bounded contract/fixture work; application implementer UNASSIGNED unless parent reserves it.
- **Proposed dispatch:** P07; New Astra forecast-boundary worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-buy-low-sell-high.md:38](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-buy-low-sell-high.md:38>); [REPORT.md:63](</Users/tim/Code/fhfhockey.com/tasks/artifacts/research-backlog-readiness-2026-10-22/REPORT.md:63>)

### BLSH-4.2 — Verify one genuine supported skater and goalie trace and both-page parity. Report unsupported coverage separately rather than marking the whole feature complete.

- **Implementation:** Partial groundwork/fixture evidence in current authority; unchecked requirement remains. **Acceptance:** open; exact current acceptance not established. **Release:** fixture/local scope; no new release.
- **Owner:** RESEARCH; **reviewer:** UNASSIGNED. **Dependencies:** MASTER-S1/F11/R7/R8 and canonical task dependencies.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Readiness maps current code to existing task IDs; no empirical/user-demand inference.
- **Acceptance/release gate:** Canonical item acceptance plus qualified shared adapter/input identity and independent UX/statistical review; optional5.x remains separately scoped.
- **Next:** RESEARCH owner inventories/frames bounded contract/fixture work; application implementer UNASSIGNED unless parent reserves it.
- **Proposed dispatch:** P07; New Astra forecast-boundary worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-buy-low-sell-high.md:39](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-buy-low-sell-high.md:39>); [REPORT.md:63](</Users/tim/Code/fhfhockey.com/tasks/artifacts/research-backlog-readiness-2026-10-22/REPORT.md:63>)

### BLSH-4.3 — Verify loading, stale/partial, invalid-offer and persistence-isolation behavior with focused tests and actual browser screenshots. Have an independent reviewer check statistical semantics and UX.

- **Implementation:** Partial groundwork/fixture evidence in current authority; unchecked requirement remains. **Acceptance:** open; exact current acceptance not established. **Release:** fixture/local scope; no new release.
- **Owner:** RESEARCH; **reviewer:** UNASSIGNED. **Dependencies:** MASTER-S1/F11/R7/R8 and canonical task dependencies.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Readiness maps current code to existing task IDs; no empirical/user-demand inference.
- **Acceptance/release gate:** Canonical item acceptance plus qualified shared adapter/input identity and independent UX/statistical review; optional5.x remains separately scoped.
- **Next:** RESEARCH owner inventories/frames bounded contract/fixture work; application implementer UNASSIGNED unless parent reserves it.
- **Proposed dispatch:** P07; New Astra forecast-boundary worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-buy-low-sell-high.md:40](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-buy-low-sell-high.md:40>); [REPORT.md:63](</Users/tim/Code/fhfhockey.com/tasks/artifacts/research-backlog-readiness-2026-10-22/REPORT.md:63>)

### BLSH-4.4 — Deliver the exact diff, checks, limitations, route decision and release proposal. Deployment remains a separate authorized action.

- **Implementation:** Partial groundwork/fixture evidence in current authority; unchecked requirement remains. **Acceptance:** open; exact current acceptance not established. **Release:** fixture/local scope; no new release.
- **Owner:** RESEARCH; **reviewer:** UNASSIGNED. **Dependencies:** MASTER-S1/F11/R7/R8 and canonical task dependencies.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Readiness maps current code to existing task IDs; no empirical/user-demand inference.
- **Acceptance/release gate:** Canonical item acceptance plus qualified shared adapter/input identity and independent UX/statistical review; optional5.x remains separately scoped.
- **Next:** RESEARCH owner inventories/frames bounded contract/fixture work; application implementer UNASSIGNED unless parent reserves it.
- **Proposed dispatch:** P07; New Astra forecast-boundary worker — UNASSIGNED. Parent reservation required; existing owner field unchanged.
- **Evidence:** [tasks-prd-buy-low-sell-high.md:41](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-buy-low-sell-high.md:41>); [REPORT.md:63](</Users/tim/Code/fhfhockey.com/tasks/artifacts/research-backlog-readiness-2026-10-22/REPORT.md:63>)

### BLSH-5.1 — Propose a rights-reviewed, timestamped market reference only if useful; define comparability and stale-source behavior before integration.

- **Implementation:** Partial groundwork/fixture evidence in current authority; unchecked requirement remains. **Acceptance:** open; exact current acceptance not established. **Release:** fixture/local scope; no new release.
- **Owner:** RESEARCH; **reviewer:** UNASSIGNED. **Dependencies:** MASTER-S1/F11/R7/R8 and canonical task dependencies.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Readiness maps current code to existing task IDs; no empirical/user-demand inference.
- **Acceptance/release gate:** Canonical item acceptance plus qualified shared adapter/input identity and independent UX/statistical review; optional5.x remains separately scoped.
- **Next:** RESEARCH owner inventories/frames bounded contract/fixture work; application implementer UNASSIGNED unless parent reserves it.
- **Evidence:** [tasks-prd-buy-low-sell-high.md:43](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-buy-low-sell-high.md:43>); [REPORT.md:63](</Users/tim/Code/fhfhockey.com/tasks/artifacts/research-backlog-readiness-2026-10-22/REPORT.md:63>)

### BLSH-5.2 — Specify optional RSO net-startable trade evaluation with complete roster/rules/schedule inputs and replacement consequences. Do not label raw production totals as this result.

- **Implementation:** Partial groundwork/fixture evidence in current authority; unchecked requirement remains. **Acceptance:** open; exact current acceptance not established. **Release:** fixture/local scope; no new release.
- **Owner:** RESEARCH; **reviewer:** UNASSIGNED. **Dependencies:** MASTER-S1/F11/R7/R8 and canonical task dependencies.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Readiness maps current code to existing task IDs; no empirical/user-demand inference.
- **Acceptance/release gate:** Canonical item acceptance plus qualified shared adapter/input identity and independent UX/statistical review; optional5.x remains separately scoped.
- **Next:** RESEARCH owner inventories/frames bounded contract/fixture work; application implementer UNASSIGNED unless parent reserves it.
- **Evidence:** [tasks-prd-buy-low-sell-high.md:44](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-buy-low-sell-high.md:44>); [REPORT.md:63](</Users/tim/Code/fhfhockey.com/tasks/artifacts/research-backlog-readiness-2026-10-22/REPORT.md:63>)

### BLSH-5.3 — Predeclare decision-value evaluation and false-alert analysis before promoting stronger buy/sell or duration claims. Use the existing exposure register and preserve closed evaluation data.

- **Implementation:** Partial groundwork/fixture evidence in current authority; unchecked requirement remains. **Acceptance:** open; exact current acceptance not established. **Release:** fixture/local scope; no new release.
- **Owner:** RESEARCH; **reviewer:** UNASSIGNED. **Dependencies:** MASTER-S1/F11/R7/R8 and canonical task dependencies.
- **Evidence level:** inventoried only. **Scope:** Task and receipt reconciliation only; no claim this whole area or all referenced source files were vetted. **Provenance:** retained task lists and receipts.
- **Verification:** Readiness maps current code to existing task IDs; no empirical/user-demand inference.
- **Acceptance/release gate:** Canonical item acceptance plus qualified shared adapter/input identity and independent UX/statistical review; optional5.x remains separately scoped.
- **Next:** RESEARCH owner inventories/frames bounded contract/fixture work; application implementer UNASSIGNED unless parent reserves it.
- **Evidence:** [tasks-prd-buy-low-sell-high.md:45](</Users/tim/Code/fhfhockey.com/tasks/tasks-prd-buy-low-sell-high.md:45>); [REPORT.md:63](</Users/tim/Code/fhfhockey.com/tasks/artifacts/research-backlog-readiness-2026-10-22/REPORT.md:63>)
