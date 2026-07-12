---
description: Repository-wide FHFH PRD/task consolidation, completion, audit, remediation, and optimization charter
globs:
alwaysApply: false
---

# FHFH Comprehensive Completion, Audit, and Optimization Super-Goal

> **Expected repository location:** `tasks/TASKS/super-goal.md`
>
> **Goal state:** ACTIVE until every completion gate in this file is satisfied or the user explicitly cancels the goal.
>
> **Context-recovery rule:** After any context compaction, context reset, session restart, or uncertainty about prior progress, re-read this file, the three rule files, the canonical master PRD, the canonical master task list, and the context diary before taking any other action. Then inspect repository state and resume the exact recorded next task.

## 1. Introduction / Overview

Create and execute one continuous, repository-wide program that consolidates every FHFH Product Requirements Document, task list, embedded checklist, audit, implementation plan, remediation list, runbook, schema contract, and relevant supporting note into one canonical PRD and one canonical task list.

The program has three primary execution waves:

1. **Finish all unfinished work first.** Complete initiatives marked in progress, nearly finished, partially implemented, active, or remediation in progress.
2. **Plan, start, and finish all not-yet-started work.** Generate any missing PRD/task-list pair, resolve empty or untracked scopes, then implement and verify the work.
3. **Audit, triage, enhance, improve, and optimize all completed work.** This includes work that was already complete when this goal began and every initiative completed during waves 1 and 2.

This is a durable `/goal`, not a one-response planning exercise. Do not stop after inventorying, writing the master PRD, or generating the master task list. Continue executing the next eligible task until a real checkpoint requires user input or the complete Definition of Done is met.

## 2. Goals

1. Produce an evidence-backed inventory of all repository PRDs, task lists, embedded checklists, supporting implementation documents, and their actual status.
2. Create one canonical master PRD that describes the complete repository-wide program and follows the structure in `tasks/TASKS/rules/create-prd.mdc`.
3. Create one canonical master task list that includes all source tasks, generated missing tasks, audit tasks, remediation tasks, verification tasks, and final integration tasks, following `tasks/TASKS/rules/generate-tasks.mdc`.
4. Execute and maintain the task list according to `tasks/TASKS/rules/process-task-list.mdc`.
5. Complete every unfinished initiative before beginning the broad not-started implementation wave, subject only to documented dependency ordering.
6. Complete every not-started, planned, untracked, or empty initiative after creating sufficient scope and tasks.
7. Audit every completed initiative against its PRD, task list, implementation, runtime behavior, data contracts, tests, and current product goals.
8. Remediate verified defects and make evidence-backed improvements without speculative rewrites or unnecessary file churn.
9. Maintain one durable context diary that makes the goal resumable after pauses, compaction, or a new session.
10. Publish a final repository-wide PRD/task summary in the same practical style as the seed audit: category, initiative, PRD, task list, final status/count, goal, supporting material, evidence, improvements, and any explicitly accepted exception.

## 3. User Stories

- As the project owner, I want all scattered PRDs and task lists unified so that no unfinished, untracked, superseded, or forgotten work is lost.
- As the project owner, I want Codex to keep advancing through the program rather than ending the goal at each checkpoint.
- As the project owner, I want large-scale or conflicting changes surfaced for approval before Codex creates expensive or risky churn.
- As a developer, I want each task to retain source provenance, dependencies, acceptance criteria, and verification evidence.
- As a future Codex session, I want a context diary and explicit recovery protocol so that I can resume the exact task after context compaction.
- As a reviewer, I want completed work re-audited and optimized rather than trusted solely because old checkboxes are checked.

## 4. Functional Requirements

### FR-1: Read and apply the governing workflow

Before planning or implementation, read these files in full:

- `tasks/TASKS/rules/create-prd.mdc`
- `tasks/TASKS/rules/generate-tasks.mdc`
- `tasks/TASKS/rules/process-task-list.mdc`
- `tasks/TASKS/super-goal.md`

Use the three-step flow continuously:

1. **Create/refine the PRD.**
2. **Generate/refine the task list.**
3. **Process the task list until complete.**

The current user request, this file, and discoverable repository context provide the initial clarifications. Do not ask redundant questions whose answers are reasonably inferable. Ask the minimum bundled clarification only when a material product, architectural, destructive, or conflicting decision cannot be resolved safely from existing evidence.

When instructions conflict, use this precedence:

1. The user's latest explicit instruction.
2. This super-goal charter.
3. The three governing rule files.
4. Initiative-specific PRDs and task lists.
5. Supporting documents and inferred repository conventions.

Document every resolved conflict in the context diary and master task list.

### FR-2: Create the canonical artifacts

Create or update exactly these durable control artifacts:

1. `tasks/TASKS/super-goal/prd/prd-fhfh-comprehensive-completion-audit-optimization.md`
2. `tasks/TASKS/super-goal/tasks-prd-fhfh-comprehensive-completion-audit-optimization.md`
3. `tasks/TASKS/super-goal/super-goal-context-diary.md`
4. `tasks/TASKS/super-goal/super-goal-final-summary.md` — create the final form near completion; it may begin as a skeletal template.

The canonical master PRD must use these sections:

1. Introduction/Overview
2. Goals
3. User Stories
4. Functional Requirements
5. Non-Goals
6. Design Considerations
7. Technical Considerations
8. Success Metrics
9. Open Questions

The canonical master task list must begin with `## Relevant Files`, include concise notes, and use actionable numbered parent tasks and sub-tasks with Markdown checkboxes. It is the program control plane; source initiative task lists remain detailed execution records and must be kept synchronized.

### FR-3: Build an exhaustive, evidence-backed inventory

Recursively inspect `tasks/TASKS/` and relevant implementation locations. Classify each artifact as one or more of:

- PRD
- task list
- embedded checklist
- audit or remediation list
- implementation map or architecture plan
- runbook
- schema/data contract
- research or decision support
- visual/style reference
- superseded or obsolete document
- empty/incomplete document
- reference-only document

For every initiative, record:

- stable initiative ID and title
- category/domain
- PRD path(s)
- task-list path(s)
- supporting-document path(s)
- seed status and checkbox count
- verified status based on repository evidence
- dependencies and downstream consumers
- missing pair, duplicate, superseded, conflicting, or empty-document state
- next action and execution wave

Do not rely on checked boxes alone. Reconcile them with code, migrations, schemas, APIs, cron configuration, UI routes, tests, documentation, runtime evidence, and repository history where useful.

The seed inventory later in this file is a starting map, not an excuse to skip repository discovery. Add omitted initiatives and artifacts as `NEW` work.

### FR-4: Normalize source documents without erasing history

- Preserve source paths and provenance for every imported task.
- Import every actionable checkbox and embedded checklist item into the canonical task list, including already-completed historical tasks.
- Give imported items a source reference and stable identifier so they can be traced back.
- Preserve existing completion state, but treat historical completion as **claimed complete pending wave-3 audit**.
- Add an explicit unchecked audit/triage/remediation parent task for every completed initiative.
- Deduplicate exact or semantically duplicate tasks while retaining all source references in a merge note.
- Mark superseded documents as superseded; do not execute both old and replacement scopes unless the current implementation still has an uncovered requirement.
- When a PRD exists without a task list, generate the missing task list from the PRD and current repository state.
- When a task list exists without a PRD, derive and create a concise PRD from the task list, supporting docs, implementation, and stated product goal.
- When a PRD is empty, infer the recoverable scope from neighboring files and implementation. Pause only if a consequential product decision truly cannot be inferred.
- Do not delete historical PRDs/task lists merely because they are consolidated.

### FR-5: Classify work into dynamic execution waves

#### Wave A — Unfinished work

Includes statuses such as:

- IN PROGRESS
- NEARLY FINISHED
- PARTIALLY IMPLEMENTED
- ACTIVE
- REMEDIATION IN PROGRESS
- incomplete embedded checklist
- completed audit with unfinished remediation

First verify that checked items are genuinely complete, then finish every unchecked, blocked, or newly discovered requirement. Add missing tests or verification only where risk justifies them.

#### Wave B — Not-yet-started or untracked work

Includes statuses such as:

- NOT STARTED
- PLANNED
- PLANNED / UNTRACKED
- AUDIT / PLANNING with no implementation task list
- empty/incomplete PRD
- missing PRD or missing task list
- audit complete but implementation/removal status untracked

For each initiative: establish or repair the PRD, generate actionable tasks, plan dependencies, implement, verify, update source and master records, and mark complete.

#### Wave C — Completed-work audit, triage, enhancement, and optimization

Includes:

- every initiative initially marked FINISHED, FOUNDATION FINISHED, AUDIT FINISHED, or AUDIT COMPLETE
- all work completed in waves A and B
- completed nested task lists inside otherwise unfinished initiatives

Do not broadly begin Wave C until Waves A and B are complete. Narrow audits needed to unblock A or B are allowed and must be documented. Wave C is dynamic: every newly completed initiative is automatically added to it.

### FR-6: Determine dependency-aware order inside each wave

Within Waves A and B, build a dependency graph before implementation. Prioritize:

1. release blockers, broken data contracts, correctness defects, and unsafe runtime behavior
2. shared ingestion, schema, identity, auth, cron, and model foundations
3. work blocking multiple downstream initiatives
4. nearly complete work that can be safely closed without bypassing higher-risk blockers
5. product surfaces, styling, cleanup, and lower-risk optimization

The stated wave order is mandatory; the exact order inside a wave may change for dependencies, shared fixes, or risk. Record each meaningful reorder and rationale in the diary. When one implementation change satisfies multiple source tasks, implement it once and attach the same evidence to every affected task.

### FR-7: Maintain the canonical master task list

The master task list must contain at least these parent phases:

- 0.0 Bootstrap, governing-rule read, inventory, and baseline
- 1.0 Canonical master PRD creation and reconciliation
- 2.0 Canonical master task-list generation and source mapping
- 3.0 Wave A — finish all unfinished initiatives
- 4.0 Wave B — plan, start, and finish all not-yet-started/untracked initiatives
- 5.0 Wave C — audit, triage, remediate, enhance, and optimize every completed initiative
- 6.0 Cross-initiative integration, regression, security, data, performance, and UX verification
- 7.0 Documentation reconciliation, cleanup, final summary, and completion gate

For each source initiative, include:

- source paths and seed/verified status
- imported or generated implementation tasks
- acceptance criteria
- verification requirements
- dependencies
- audit tasks
- newly discovered tasks appended as `NEW`

Update the source task list immediately after meaningful work, then mirror status in the master list. Keep `Relevant Files` accurate in both places. Never leave important discoveries only in prose or the diary; convert them to tasks.

### FR-8: Use a strict initiative Definition of Done

An initiative is not complete until all applicable conditions are satisfied:

- PRD requirements are implemented or explicitly removed by an approved scope decision.
- Every task and sub-task is complete, including newly discovered work.
- Source and master task lists agree.
- Relevant code, schema, migration, job, API, route, component, and documentation changes are present.
- Targeted verification passes using the narrowest valid commands and checks.
- Non-trivial calculations, parsing, normalization, branching, transformations, API behavior, and regressions have appropriate tests or a documented reason direct verification is sufficient.
- Supabase/PostgREST reads that may exceed a small bounded result set use verified pagination rather than assuming a large limit bypasses platform caps.
- Loading, empty, error, stale, partial-success, and fallback states are handled where relevant.
- Observability and operational failure behavior are adequate for jobs, pipelines, and release paths.
- Temporary artifacts are removed or consolidated.
- Documentation and runbooks reflect actual behavior.
- No unresolved blocker is hidden. Any external blocker or deferred exception is explicit, evidence-backed, and approved by the user.

### FR-9: Audit and triage every completed initiative

For each Wave-C initiative:

1. Re-read the PRD, task list, supporting contracts, and prior audits.
2. Map requirements to current implementation and runtime/data evidence.
3. Verify the most important paths and failure states.
4. Classify findings by category:
   - correctness and requirement alignment
   - data integrity, identity mapping, completeness, freshness, leakage, and provenance
   - reliability, idempotency, retry/failure behavior, cron safety, and observability
   - security, privacy, authentication, authorization, and entitlement handling
   - performance, pagination, caching, query volume, rendering, and bundle/runtime cost
   - UX, accessibility, responsive/mobile behavior, state communication, and visual consistency
   - maintainability, ownership, duplication, dead code, contracts, and documentation
   - test quality and regression protection
5. Assign severity:
   - **P0:** active data loss, security exposure, destructive behavior, or critical outage risk
   - **P1:** incorrect core result, broken primary path, release blocker, or major reliability defect
   - **P2:** meaningful quality, performance, UX, observability, or maintainability gap
   - **P3:** low-risk polish, cleanup, or optional optimization
6. Add every finding as an actionable task with evidence and acceptance criteria.
7. Remediate in severity/dependency order.
8. Re-verify and record final evidence.

Do not perform a broad rewrite merely because an alternative architecture is cleaner. Prefer targeted, in-place changes. Propose a large redesign only when evidence shows the current design cannot safely satisfy requirements.

### FR-10: Pause only at meaningful checkpoints

Continue through adjacent low-risk tasks without stopping after every sub-task. Pause when required by the governing process or when any of these apply:

- destructive or irreversible data/schema change
- broad architecture replacement or cross-system rewrite
- breaking public/API/data contract change
- mass deletion, rename, route removal, or subsystem quarantine with uncertain consumers
- production deployment, credentials, billing, provider configuration, or external account action
- conflicting PRDs, task lists, or product requirements with materially different outcomes
- strategy fork whose choice changes scope, cost, UX, or long-term ownership
- unexpected failure that invalidates key assumptions
- user-owned manual action or verification

Before asking for approval:

1. Update the source task list, master task list, and context diary.
2. Preserve the exact current task and next action.
3. Present the pause using this structure:

   **SUPER-GOAL PAUSED — NOT COMPLETE**

   - Current wave, initiative, parent task, and sub-task
   - Work completed since the last checkpoint
   - Why approval or input is required
   - Options in plain language, with consequences and tradeoffs
   - Concise recommendation when evidence favors one option
   - Exact response, command output, or confirmation required
   - Resume reminder: after the reply, re-read `tasks/TASKS/super-goal.md`, the master task list, and the latest diary entry, then resume this exact sub-task

A pause suspends the goal; it never completes or cancels it. Do not say the work is finished. Once the required response arrives, recover context and continue automatically from the recorded next action.

For true manual actions, require the exact output or exact confirmation defined in `process-task-list.mdc`. A generic `yes` or `y` is not sufficient when a choice, command output, `Done, proceed`, or `Committed, proceed.` is required.

### FR-11: Maintain one context diary

Use only `tasks/TASKS/super-goal/super-goal-context-diary.md` for the super-goal's durable execution memory. Do not create separate scratch diaries per initiative.

At the top of the diary, include a permanent recovery banner that instructs a future session to re-read:

- `tasks/TASKS/super-goal.md`
- the three governing rule files
- the canonical master PRD
- the canonical master task list
- the latest diary entries
- `git status` and the current working diff

Append a concise entry:

- at goal initialization
- before and after each significant parent task or grouped checkpoint
- before every approval/manual-action pause
- immediately after resuming from a pause
- before expected context compaction when detectable
- immediately after context compaction/reset or at the start of a new session
- whenever dependencies, scope, or verified status materially change

Each entry must include:

- timestamp and entry number
- context state: normal, pre-compaction, post-compaction, approval pause, manual-action pause, or resumed
- current wave, initiative, task, and sub-task
- objective and work completed
- files inspected, created, or modified
- decisions and rationale
- commands/tests/checks and results
- blockers, approval state, and exact required response if paused
- newly discovered tasks and where they were added
- exact next action
- restart instructions sufficient for a fresh Codex context

Keep entries concise and factual. Link to task IDs instead of copying large outputs. The task list is the source of actionable truth; the diary is the source of execution continuity.

### FR-12: Recover correctly after context compaction or reset

Treat any loss of detailed memory, compressed context, new session, or uncertainty about the active task as a recovery event. Before acting:

1. Read `tasks/TASKS/super-goal.md` completely.
2. Read the three governing rule files completely.
3. Read the canonical master PRD.
4. Read the canonical master task list, especially the first unchecked task and all `NEW` tasks.
5. Read the diary recovery banner and at least the latest three entries, expanding further if needed.
6. Inspect `git status`, staged changes, and the relevant diff.
7. Inspect the source initiative PRD/task list for the active task.
8. Add a `post-compaction` or `resumed` diary entry confirming the recovered state.
9. Resume the exact recorded next action; do not restart the whole inventory unless evidence shows the inventory is stale.

### FR-13: Apply disciplined implementation, test, and edit strategy

Follow `process-task-list.mdc`, including:

- targeted in-place edits over full-file rewrites
- smallest effective change that fully solves the task
- grouped progression through tightly related low-risk subtasks
- narrow, risk-based testing rather than automatic test-file creation
- exact manual-action and manual-verification instructions
- conventional, descriptive commits where appropriate
- cleanup of temporary artifacts before completion
- explicit tracking of every bug, follow-up, open question, optimization, and manual dependency as a task

Use current repository conventions for TypeScript, Next.js/React, Python, Supabase, cron, API routes, data models, styling, and tests. Inspect before assuming.

### FR-14: Produce the final summary

When all implementation and audit work is complete, fully populate `tasks/TASKS/super-goal/super-goal-final-summary.md`.

Use this hierarchy:

- category heading
- initiative heading
- PRD path(s)
- task-list path(s)
- final status and completed/total count
- concise initiative goal
- source/supporting documents
- implementation and verification evidence
- audit findings and improvements completed
- approved exceptions or external dependencies, if any

Include repository-wide totals:

- artifacts inventoried
- initiatives identified
- PRDs created/repaired
- task lists created/repaired
- source tasks imported
- Wave-A initiatives completed
- Wave-B initiatives completed
- Wave-C initiatives audited
- P0/P1/P2/P3 findings opened and closed
- tests/checks/builds executed
- remaining approved exceptions

The final summary must resemble the seed audit's clarity while reporting verified final state, not inferred state.

## 5. Non-Goals (Out of Scope)

- Do not rewrite every subsystem for stylistic preference.
- Do not replace working architecture without evidence and approval at a large-change checkpoint.
- Do not trust completion checkboxes without audit evidence.
- Do not erase source history, provenance, or superseded documents merely to make the directory cleaner.
- Do not create one diary, runbook, or scratch document per initiative.
- Do not inflate the task list with speculative files, ritual tests, or microscopic subtasks.
- Do not silently change product scope to avoid a difficult task.
- Do not perform destructive production operations, provider/account changes, or breaking migrations without the required approval.
- Do not declare the super-goal complete while any unapproved incomplete task, audit finding, verification failure, or synchronization gap remains.

## 6. Design Considerations

- Use existing FHFH visual guidance where UI work is involved:
  - `tasks/TASKS/rules/brand-style-cheat-sheet.md`
  - `tasks/TASKS/rules/fhfh-styles.md`
  - `tasks/TASKS/rules/vars_Audit.md`
- Preserve or improve responsive/mobile behavior, accessibility, hierarchy, density, and state communication.
- Consolidate shared patterns when evidence shows duplication, but avoid broad visual churn unrelated to an initiative's acceptance criteria.
- Treat completed mockups, audits, and current production conventions as inputs; resolve conflicts through the documented approval process.

## 7. Technical Considerations

- Resolve paths relative to the repository root. The seed audit used `/Users/tim/Code/fhfhockey.com`; do not hard-code that absolute path when the active checkout differs.
- Treat Supabase schemas, policies, views, RPCs, pagination limits, and migrations as explicit contracts.
- Treat cron schedules, idempotency, telemetry, partial success, external providers, and stale data as operational concerns, not incidental details.
- Preserve model-boundary and leakage-safety rules for projections, xG, sustainability, trends, rankings, and prediction systems.
- Reconcile player/team/goalie identity mapping across NHL, Yahoo, Patreon/auth, NST/GDL/CCC, and internal canonical tables where applicable.
- Prefer shared data contracts and ownership clarity over parallel implementations.
- Verify current code and runtime behavior before relying on old audits or plans.

## 8. Success Metrics

The super-goal succeeds only when:

1. Every discovered initiative and actionable artifact is represented in the canonical inventory and master task list.
2. Every missing or empty PRD/task-list pair is repaired sufficiently for execution.
3. Every Wave-A initiative is verified complete.
4. Every Wave-B initiative is planned, implemented, and verified complete.
5. Every completed initiative, including all newly completed Wave-A/B work, has passed Wave-C audit.
6. All P0 and P1 findings are closed; every P2/P3 item is completed unless the user explicitly approves a documented exception.
7. Source and master task lists are synchronized and contain no untracked discoveries.
8. Required targeted tests, builds, checks, migrations, and manual verifications pass.
9. The diary can reconstruct the last action, current state, decisions, and exact next step without relying on conversational memory.
10. The final summary reports verified status and evidence for every initiative.

## 9. Open Questions

There are no mandatory launch questions. Infer answers from this charter, repository evidence, source PRDs/task lists, and existing conventions. Add a question to the master task list and pause only when a material decision meets the checkpoint criteria in FR-10.

## 10. Required Continuous Workflow

### Phase 0 — Bootstrap and baseline

- Read all governing files.
- Create the canonical directory and artifacts.
- Initialize the diary with the recovery banner.
- Snapshot repository status and working changes without overwriting unrelated user work.
- Inventory and classify all source artifacts.
- Verify seed statuses and identify missing, duplicate, superseded, empty, or conflicting documents.

### Phase 1 — Create the canonical master PRD

- Apply the PRD structure from `create-prd.mdc`.
- Consolidate goals, functional requirements, boundaries, dependencies, success criteria, and open questions from all initiatives.
- Preserve initiative-specific scope and source provenance.
- Ask only truly necessary bundled clarification questions.

### Phase 2 — Generate the canonical master task list

- Apply `generate-tasks.mdc`.
- Import every source checkbox and embedded checklist.
- Generate missing tasks and paired documents.
- Build dependency-aware Waves A, B, and C.
- Include Relevant Files, notes, acceptance criteria, verification, and source mappings.
- Immediately begin Phase 3 after the task list is viable; do not stop merely to announce that planning is complete.

### Phase 3 — Execute Wave A

- Verify completed subtasks, finish outstanding work, remediate defects, test, synchronize task lists, and move each completed initiative into Wave C.

### Phase 4 — Execute Wave B

- Create/repair scope and task pairs, implement all work, verify completion, synchronize records, and move each initiative into Wave C.

### Phase 5 — Execute Wave C

- Audit every originally completed and newly completed initiative.
- Add and close severity-ranked remediation and optimization tasks.
- Re-verify the initiative and record evidence.

### Phase 6 — Cross-initiative integration and regression

- Reconcile shared contracts and ownership.
- Verify critical end-to-end user and operational paths.
- Check build/type/lint/test status using repository conventions and the narrowest sufficient commands.
- Check data completeness, pagination, identity mapping, freshness, model leakage boundaries, cron health, route ownership, loading/error/stale states, responsive behavior, and documentation consistency.

### Phase 7 — Final reconciliation and completion

- Close or obtain explicit approval for every exception.
- Synchronize source and master task lists.
- Remove temporary artifacts.
- Complete the final summary and diary.
- Verify all success metrics.
- Only then mark the final parent task and the super-goal complete.

## 11. Seed Initiative Inventory and Initial Wave Assignment

The following inventory comes from the existing audit and must be verified against the repository. Counts are seed counts, not final evidence. Add any omitted initiatives.

### Wave A — Unfinished / active work to finish first

#### Platform and operations

- **Authentication and user settings — IN PROGRESS, 15/34**
  - PRD: `tasks/TASKS/auth-user-settings-platform/prd/prd-auth-user-settings-platform.md`
  - Tasks: `tasks/TASKS/auth-user-settings-platform/tasks-prd-auth-user-settings-platform.md`
- **Cron audit email failures — IN PROGRESS, 3/7**
  - Tasks: `tasks/TASKS/cron-operations/tasks-cron-audit-email-failures.md`
  - Reconcile with the Wave-B Cron NST/audit remediation initiative.
- **GDL suite ingestion — IN PROGRESS, 3/10**
  - Tasks: `tasks/TASKS/lines-gdl-ingestion/tasks-prd-gdl-suite-ingestion.md`
  - No separate PRD was found; derive/create one if still missing.

#### Contextual rankings and analytics

- **Three Pillars Analytics — NEARLY FINISHED, 14/17**
  - PRD: `tasks/TASKS/three-pillars-analytics/prd-three-pillars-analytics.md`
  - Tasks: `tasks/TASKS/three-pillars-analytics/tasks-prd-three-pillars-analytics.md`
- **Sustainability model — NEARLY FINISHED, 10/12**
  - PRD: `tasks/TASKS/three-pillars-analytics/sustainability/prd/prd-sustainability-model.md`
  - Tasks: `tasks/TASKS/three-pillars-analytics/sustainability/tasks-prd-sustainability-model.md`
  - Supporting phase: `tasks/TASKS/three-pillars-analytics/sustainability/prd/prd-sustainability-step4.md`

#### Underlying stats and site surfaces

- **Underlying stats audit, remediation, and SOS — NEARLY FINISHED, 6/7**
  - PRD: `tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-underlying-stats-landing-page-sos.md`
  - Tasks: `tasks/TASKS/three-pillars-analytics/underlying-stats/tasks-prd-underlying-stats-landing-page-sos.md`
- **Site surface expansion roadmap — IN PROGRESS, 4/9**
  - PRD: `tasks/TASKS/three-pillars-analytics/site-roadmap/prd/prd-fhfh-site-surface-expansion-roadmap.md`
  - Tasks: `tasks/TASKS/three-pillars-analytics/site-roadmap/tasks-prd-fhfh-site-surface-expansion-roadmap.md`
- **Style system and underlying-stats restyle — IN PROGRESS, 8/12**
  - PRD: `tasks/TASKS/three-pillars-analytics/site-roadmap/prd/prd-fhfh-style-system-and-underlying-stats-restyle.md`
  - Tasks: `tasks/TASKS/three-pillars-analytics/site-roadmap/tasks-prd-fhfh-style-system-and-underlying-stats-restyle.md`

#### FORGE projections

- **Projection model V1 — IN PROGRESS, 22/40**
  - PRD: `tasks/TASKS/forge-projections/v1/prd/prd-projection-model.md`
  - Tasks: `tasks/TASKS/forge-projections/v1/tasks-prd-projection-model.md`
  - Nested skater work: `tasks/TASKS/forge-projections/v1/tasks-skater-forge.md` — 4/8
  - Nested goalie work is complete and belongs in Wave C: `tasks/TASKS/forge-projections/v1/tasks-goalie-forge.md` — 8/8
- **FORGE dashboard component remediation — IN PROGRESS, 1/7**
  - Audit PRD: `tasks/TASKS/forge-projections/dashboard-health/prd/prd-forge-dashboard-component-health.md`
  - Audit tasks: `tasks/TASKS/forge-projections/dashboard-health/tasks-prd-forge-dashboard-component-health.md` — 6/6
  - Remediation tasks: `tasks/TASKS/forge-projections/dashboard-health/tasks-forge-dashboard-component-remediation.md`
- **FORGE Command Center — IN PROGRESS, 6/9**
  - PRD: `tasks/TASKS/forge-projections/command-center/prd-forge-command-center-rebuild.md`
  - Tasks: `tasks/TASKS/forge-projections/command-center/tasks-prd-forge-command-center-rebuild.md`
- **FORGE ecosystem pass-four audit/remediation — NEARLY FINISHED, 20/23**
  - PRD: `tasks/TASKS/forge-projections/ecosystem-audits/prd/prd-forge-ecosystem-pass-4-audit-remediation.md`
  - Tasks: `tasks/TASKS/forge-projections/ecosystem-audits/tasks-prd-forge-ecosystem-pass-4-audit-remediation.md`
- **FORGE pass-four living audit/remediation — IN PROGRESS, 13/28**
  - PRD: `tasks/TASKS/forge-projections/ecosystem-audits/prd-forge-pass-4-living-audit-remediation.md`
  - Tasks: `tasks/TASKS/forge-projections/ecosystem-audits/tasks-prd-forge-pass-4-living-audit-remediation.md`

#### Prediction and xG models

- **NHL game prediction model — NEARLY FINISHED, 9/11**
  - PRD: `tasks/TASKS/nhl-game-prediction-model/prd-nhl-game-prediction-model.md`
  - Tasks: `tasks/TASKS/nhl-game-prediction-model/tasks-prd-nhl-game-prediction-model.md`
  - Accuracy improvement: `tasks/TASKS/nhl-game-prediction-model/tasks-prd-game-prediction-accuracy-improvement.md` — 5/7
  - Roster/SOS model: `tasks/TASKS/nhl-game-prediction-model/tasks-prd-nhl-game-prediction-roster-sos-model.md` — 2/10
- **xG trending model completion — NEARLY FINISHED, 22/23**
  - Tasks: `tasks/TASKS/xg-model/trending-model/tasks-xg-trending-model-completion.md`
  - No separate PRD was found; derive/create one if still missing.
- **xG release remediation — IN PROGRESS, 4/8**
  - Tasks: `tasks/TASKS/xg-model/release/tasks-xg-release-remediation.md`
  - Reconcile with the Wave-B exception-resolution list and `tasks/TASKS/xg-model/docs/`.

#### Draft dashboard and Yahoo

- **Draft Dashboard — PARTIALLY IMPLEMENTED / ACTIVE**
  - PRD: `tasks/TASKS/draft-dashboard-yahoo/prd/prd-draft-dashboard.md`
  - No distinct task list was found; create/reconstruct one from the PRD, implementation, audits, and open defects before finishing the initiative.
- **Draft Dashboard debug and performance — IN PROGRESS, 1/5 explicit items**
  - PRD/embedded tasks: `tasks/TASKS/draft-dashboard-yahoo/prd/prd-draft-dash-debug.md`

### Wave B — Not started, planned, empty, or untracked work

#### Platform and operations

- **Cron NST and audit remediation — NOT STARTED, 0/5**
  - PRD: `tasks/TASKS/cron-operations/prd/prd-cron-nst-audit-remediation.md`
  - Tasks: `tasks/TASKS/cron-operations/tasks-prd-cron-nst-audit-remediation.md`

#### Contextual rankings and analytics

- **Sustainability Barometer — NOT STARTED, 0/8**
  - PRD: `tasks/TASKS/three-pillars-analytics/sustainability/prd/prd-sustainability-barometer.md`
  - Tasks: `tasks/TASKS/three-pillars-analytics/sustainability/tasks-prd-sustainability-barometer.md`
- **Sustainability/trends audit — NOT STARTED, 0/5**
  - PRD: `tasks/TASKS/three-pillars-analytics/sustainability/prd/prd-sustainability-trends-audit.md`
  - Tasks: `tasks/TASKS/three-pillars-analytics/sustainability/tasks-prd-sustainability-trends-audit.md`
  - Supporting: `tasks/TASKS/three-pillars-analytics/sustainability/sustainability-trends-plan.md`
  - Supporting: `tasks/TASKS/three-pillars-analytics/sustainability/deep-research-report.md`

#### Underlying stats and site surfaces

- **Game Grid master table/dashboard — NOT STARTED, 0/5**
  - PRD: `tasks/TASKS/three-pillars-analytics/underlying-stats/game-grid/prd-game-grid-master-table-dashboard.md`
  - Tasks: `tasks/TASKS/three-pillars-analytics/underlying-stats/tasks-prd-game-grid-master-table-dashboard.md`
  - Supporting: `tasks/TASKS/three-pillars-analytics/underlying-stats/game-grid/game-grid-revamp-plan.md`
  - Supporting: `tasks/TASKS/three-pillars-analytics/underlying-stats/game-grid/modularization-of-the-game-page.md`
- **SKO charts — PLANNED / UNTRACKED**
  - PRDs: `tasks/TASKS/sko-charts/prd-sko.md`, `tasks/TASKS/sko-charts/prd-sko-charts.md`
  - Supporting: `tasks/TASKS/sko-charts/sko-modeling-notes.md`
  - No matching task list was found; reconcile the PRDs and generate one.

#### FORGE projections

- **Start Chart and model — PLANNED / UNTRACKED**
  - PRDs: `tasks/TASKS/forge-projections/v1/prd/prd-start-chart.md`, `tasks/TASKS/forge-projections/v1/prd/prd-start-chart-model.md`
  - No dedicated task list was found; reconcile the two scopes and generate one.
- **FORGE + Trends + Start Chart combination — NOT STARTED, 0/10**
  - PRD: `tasks/TASKS/forge-projections/ecosystem-audits/prd/prd-forge-trends-combo-project.md`
  - Tasks: `tasks/TASKS/forge-projections/ecosystem-audits/tasks-prd-forge-trends-combo-project.md`
  - Architecture: `tasks/TASKS/forge-projections/ecosystem-audits/forge-trends-combo-architecture.md`

#### Prediction and xG models

- **xG release exception resolution — NOT STARTED, 0/4**
  - Tasks: `tasks/TASKS/xg-model/release/tasks-xg-release-exception-resolution.md`
  - Derive/create a paired PRD if one remains absent.

#### Draft dashboard and Yahoo

- **Yahoo ingestion and mapping audit — AUDIT / PLANNING**
  - PRD: `tasks/TASKS/draft-dashboard-yahoo/prd-yahoo-audit.md`
  - No matching task list was found; generate and execute one.
- **Game Grid/Draft Dashboard style overhaul — PLANNED**
  - PRD: `tasks/TASKS/draft-dashboard-yahoo/prd/prd-gamegrid-draft-dashboard-style-overhaul.md`
  - Supporting: `tasks/TASKS/draft-dashboard-yahoo/docs/DraftDashboard_Audit.md`
  - Supporting: `tasks/TASKS/draft-dashboard-yahoo/draft-dashbord-audit.md`
  - No matching task list was found; generate and execute one.

#### Cleanup and reference documentation

- **Code cleanup and warning reduction — PLANNED / UNTRACKED**
  - PRD: `tasks/TASKS/dead-code-cleanup/prd-cleanup-tasks.md`
  - Generate a controlled, evidence-backed task list.
- **Dead-code removal/quarantine follow-through — AUDIT COMPLETE; REMOVAL UNTRACKED**
  - Audit PRD: `tasks/TASKS/dead-code-cleanup/prd-dead-code-report.md`
  - Generate implementation tasks from current evidence; re-verify consumers before deletion.
- **Date Range Matrix refactor — PLANNED**
  - PRD: `tasks/TASKS/dead-code-cleanup/prd-drm-refactor.md`
  - Generate and execute a task list.
- **SKO pipeline burn-down — PLANNED**
  - Plan: `tasks/TASKS/dead-code-cleanup/burn-down-plan.md`
  - Reconcile with SKO charts and generate the missing PRD/task-list pair or merge into the appropriate canonical SKO initiative.
- **Trends scope — EMPTY / NOT STARTED**
  - Empty PRD: `tasks/TASKS/three-pillars-analytics/trends/prd-trends.md`
  - Recover scope from Three Pillars, rolling metrics, FORGE/Trends combination, current code, and supporting docs. Ask only if a material product choice remains.

### Wave C — Completed work requiring audit, triage, enhancement, and optimization

#### Platform and operations

- **Cron audit and schedule optimization — FINISHED, 6/6**
  - PRD: `tasks/TASKS/cron-operations/prd/prd-cron-audit-and-schedule-optimization.md`
  - Tasks: `tasks/TASKS/cron-operations/tasks-prd-cron-audit-and-schedule-optimization.md`
  - Schedule source: `tasks/TASKS/cron-operations/cron-schedule.md`
- **Cron failed-job remediation — FINISHED, 5/5**
  - PRD: `tasks/TASKS/cron-operations/prd/prd-cron-failed-jobs-remediation.md`
  - Tasks: `tasks/TASKS/cron-operations/tasks-prd-cron-failed-jobs-remediation.md`
- **NST API migration — FINISHED, 8/8**
  - PRD: `tasks/TASKS/xg-model/nst-migration/prd/prd-nst-api-audit-and-migration.md`
  - Tasks: `tasks/TASKS/cron-operations/tasks-prd-nst-api-audit-and-migration.md`
  - Supporting runbook, caller inventory, configuration contract, and ownership decisions live under `tasks/TASKS/xg-model/nst-migration/`.
- **Lines/CCC ingestion — FINISHED, 12/12**
  - PRD: `tasks/TASKS/lines-ccc-ingestion/prd-lines-ccc-ingestion.md`
  - Tasks: `tasks/TASKS/lines-ccc-ingestion/tasks-prd-lines-ccc-ingestion.md`

#### Contextual rankings and analytics

- **Contextual Hockey Rankings — FINISHED, 84/84**
  - PRD: `tasks/TASKS/contextual-hockey-rankings/prd-contextual-hockey-rankings.md`
  - Tasks: `tasks/TASKS/contextual-hockey-rankings/tasks-prd-contextual-hockey-rankings.md`
- **Rankings ecosystem alignment audit — FINISHED, 20/20**
  - PRD: `tasks/TASKS/contextual-hockey-rankings/prd-rankings-ecosystem-alignment-audit.md`
  - Tasks: `tasks/TASKS/contextual-hockey-rankings/tasks-prd-rankings-ecosystem-alignment-audit.md`
- **Rankings post-alignment gap audit — FINISHED, 9/9**
  - PRD: `tasks/TASKS/contextual-hockey-rankings/prd-rankings-post-alignment-gap-audit.md`
  - Tasks: `tasks/TASKS/contextual-hockey-rankings/tasks-prd-rankings-post-alignment-gap-audit.md`
- **Rolling player metrics audit — FINISHED, 5/5**
  - PRD: `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/prd/prd-rolling-player-metrics-audit.md`
  - Tasks: `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/tasks-prd-rolling-player-metrics-audit.md`
- **Rolling player metrics remediation blueprint — FINISHED, 8/8**
  - PRD: `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/prd/prd-rolling-player-metrics-remediation-blueprint.md`
  - Tasks: `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/tasks-prd-rolling-player-metrics-remediation-blueprint.md`
- **Rolling player metrics remediation — FINISHED, 5/5**
  - PRD: `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/prd/prd-rolling-player-metrics-remediation.md`
  - Tasks: `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/tasks-prd-rolling-player-metrics-remediation.md`
- **Rolling player metrics pass-two trends debug — FINISHED, 6/6**
  - PRD: `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/prd/prd-rolling-player-metrics-audit-pass-2-trends-debug.md`
  - Tasks: `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/tasks-prd-rolling-player-metrics-audit-pass-2-trends-debug.md`
  - Associated completed lists: `tasks-rolling-player-pass-2-main-audit.md`, `tasks-rpm-audit-action-items-pass-2.md` in the same feature directory.

#### Underlying stats and site surfaces

- **Player underlying stats — FINISHED, 8/8**
  - PRD: `tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md`
  - Tasks: `tasks/TASKS/three-pillars-analytics/underlying-stats/tasks-prd-player-underlying-stats-landing-page.md`
- **Team underlying stats — FINISHED, 14/14**
  - PRD: `tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-team-underlying-stats-landing-page.md`
  - Tasks: `tasks/TASKS/three-pillars-analytics/underlying-stats/tasks-prd-team-underlying-stats-landing-page.md`
- **Goalie underlying stats — FINISHED, 6/6**
  - PRD: `tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-goalie-underlying-stats-landing-page.md`
  - Tasks: `tasks/TASKS/three-pillars-analytics/underlying-stats/tasks-prd-goalie-underlying-stats-landing-page.md`
- **Underlying-stats standalone landing/power-ranking roadmaps — FINISHED, 7/7 and 6/6**
  - Discover and import the exact source paths during inventory.
- **Mobile stats optimization — FINISHED, 5/5**
  - PRD: `tasks/TASKS/three-pillars-analytics/site-roadmap/prd/prd-mobile-stats-page-optimization.md`
  - Tasks: `tasks/TASKS/three-pillars-analytics/site-roadmap/tasks-prd-mobile-stats-page-optimization.md`
- **WiGO charts optimization — FINISHED, 6/6**
  - PRD: `tasks/TASKS/wigo-charts/prd-wigo-charts-optimization.md`
  - Tasks: `tasks/TASKS/wigo-charts/tasks-prd-wigo-charts-optimization.md`

#### FORGE projections

- **Goalie FORGE nested work — FINISHED, 8/8**
  - Tasks: `tasks/TASKS/forge-projections/v1/tasks-goalie-forge.md`
- **FORGE run modularization — FINISHED, 7/7**
  - PRD: `tasks/TASKS/forge-projections/v1/prd/prd-run-forge-projections-modularization.md`
  - Tasks: `tasks/TASKS/forge-projections/v1/tasks-prd-run-forge-projections-modularization.md`
- **FORGE dashboard refresh — FINISHED, 7/7**
  - PRD: `tasks/TASKS/forge-projections/dashboard-health/prd/prd-forge-dashboard.md`
  - Tasks: `tasks/TASKS/forge-projections/dashboard-health/tasks-prd-forge-dashboard.md`
- **FORGE dashboard component-health audit — FINISHED, 6/6**
  - PRD: `tasks/TASKS/forge-projections/dashboard-health/prd/prd-forge-dashboard-component-health.md`
  - Tasks: `tasks/TASKS/forge-projections/dashboard-health/tasks-prd-forge-dashboard-component-health.md`
  - Audit its claims again after Wave-A remediation completes.
- **FORGE ecosystem pass three — FINISHED, 10/10**
  - PRD: `tasks/TASKS/forge-projections/ecosystem-audits/prd/prd-forge-ecosystem-pass-3-stabilization-quarantine-dashboard.md`
  - Tasks: `tasks/TASKS/forge-projections/ecosystem-audits/tasks-prd-forge-ecosystem-pass-3-stabilization-quarantine-dashboard.md`
- **FORGE prediction-engine super list — FINISHED, 11/11**
  - Tasks: `tasks/TASKS/forge-projections/prediction-engine/tasks-prd-forge-prediction-engine-super-task-list.md`
  - No standalone PRD was found; derive one only if the master PRD/source mapping cannot adequately preserve its scope.

#### Prediction and xG models

- **NHL API xG data foundation — FOUNDATION FINISHED, 8/8**
  - PRD: `tasks/TASKS/xg-model/nhl-api-foundation/prd/prd-nhl-api-xg-model.md`
  - Tasks: `tasks/TASKS/xg-model/tasks-nhl-api-xg-model.md`
  - Supporting evidence/contracts live under `tasks/TASKS/xg-model/nhl-api-foundation/`.
- **xG baseline contracts — FINISHED, 8/8 and 6/6**
  - Tasks: `tasks/TASKS/xg-model/baseline/tasks-xg-baseline-options.md`
  - Tasks: `tasks/TASKS/xg-model/baseline/tasks-xg-baseline-follow-ups.md`
  - No standalone PRD was found; preserve contract provenance in the master PRD.

#### Variance

- **Skater variance leaderboard — FINISHED, 11/11**
  - PRD: `tasks/TASKS/variance/v1/prd-skater-variance-leaderboard.md`
  - Tasks: `tasks/TASKS/variance/v1/tasks-prd-skater-variance-leaderboard.md`
- **Variance section and goalie analytics — FINISHED, 9/9**
  - PRD: `tasks/TASKS/variance/v1/prd/prd-variance-section.md`
  - Tasks: `tasks/TASKS/variance/v1/tasks-prd-variance-section.md`
- **Variance second pass — FINISHED, 10/10**
  - PRD: `tasks/TASKS/variance/v2/prd-variance-goalies-skaters-second-pass.md`
  - Tasks: `tasks/TASKS/variance/v2/tasks-prd-variance-goalies-skaters-second-pass.md`
  - Supporting: `tasks/TASKS/variance/v2/variance-runbook.md`

#### Reference/control artifacts to validate, not blindly implement

- **Schema documentation — REFERENCE / SNAPSHOT**
  - Index: `tasks/TASKS/schema-docs/README.md`
  - Check freshness and ownership during relevant audits; create tasks only for verified drift or missing documentation.
- **Process and style rules — ACTIVE REFERENCE**
  - `tasks/TASKS/rules/create-prd.mdc`
  - `tasks/TASKS/rules/generate-tasks.mdc`
  - `tasks/TASKS/rules/process-task-list.mdc`
  - `tasks/TASKS/rules/brand-style-cheat-sheet.md`
  - `tasks/TASKS/rules/fhfh-styles.md`
  - `tasks/TASKS/rules/vars_Audit.md`

### Dynamic Wave-C rule

As soon as any Wave-A or Wave-B initiative satisfies its initiative Definition of Done, add its audit/triage/optimization task to Wave C. Do not consider prior implementation completion equivalent to final super-goal completion.

## 12. Goal Completion Gate

Before declaring success, answer all of the following with evidence in the master task list, diary, and final summary:

- Has every source artifact been inventoried and classified?
- Is every initiative represented by a usable PRD and task list, directly or through an explicitly documented merge?
- Are all Wave-A and Wave-B tasks complete and verified?
- Has every completed initiative passed Wave-C audit after its latest implementation changes?
- Are all P0/P1 findings closed and all P2/P3 findings completed or explicitly approved as exceptions?
- Are source and master checkboxes synchronized?
- Are Relevant Files sections accurate?
- Are tests/checks/builds and manual verification recorded?
- Are data contracts, pagination, identity mapping, freshness, cron behavior, model boundaries, auth/entitlements, UI states, accessibility, performance, observability, and documentation reconciled where applicable?
- Is the context diary current and sufficient for recovery?
- Is the final summary complete and evidence-backed?
- Is the working tree understood, with no accidental overwrite of unrelated user changes and no temporary debris?

If any answer is no, the super-goal remains active and the next missing item becomes a task. Only mark the final task complete when every answer is yes or the user has explicitly approved a documented exception.
