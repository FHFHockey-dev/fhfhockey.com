# FORGE Pass 4 Living Audit, Remediation, Validation, and Styling PRD

## Introduction/Overview

This PRD defines a new, standalone pass-4 workstream for the FORGE dashboard ecosystem. The goal is to run a living audit and execution workflow that starts from the repo's task-governed planning rules, creates a new dedicated PRD and task list, audits the full FORGE pipeline from upstream inputs through rendered dashboard output, expands the active task list as new issues are discovered, and then executes remediation through smoke testing, output vetting, styling completion, and visual inspection.

This pass exists to close gaps left by the previous pass, especially incomplete styling on [`web/pages/forge/dashboard.tsx`](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx), incomplete component-level fixes, insufficient task-list expansion as new issues were discovered, and the lack of a fully closed-loop validation process.

## Goals

1. Create a new pass-4 PRD and a new pass-4 task list that become the only active execution artifacts for this run.
2. Review [`web/pages/skoCharts.tsx`](/Users/tim/Code/fhfhockey.com/web/pages/skoCharts.tsx) early and decide what should be adopted, adapted, referenced only, ignored, or retired.
3. Audit the full FORGE ecosystem from foundation data inputs through projection logic, endpoint behavior, page assembly, components, and styling.
4. Convert every meaningful finding into an appended task or sub-task in the active pass-4 task list instead of leaving it only in prose.
5. Execute remediation work for correctness, maintainability, performance, output quality, and styling gaps discovered during the audit.
6. Implement and validate production-path gradient boosting improvements for the expected-goals model used by FORGE.
7. Smoke test relevant live endpoints with applicable one-day or correct-scope runs, enforcing the target completion threshold of 4 minutes 30 seconds where applicable and respecting Natural Stat Trick rate limits.
8. Vet rendered outputs component-by-component and visually inspect the dashboard in a Chromium-capable environment.
9. Finish styling for the dashboard page and its individual components using [`fhfh-styles.md`](/Users/tim/Code/fhfhockey.com/fhfh-styles.md) and [`web/styles/vars.scss`](/Users/tim/Code/fhfhockey.com/web/styles/vars.scss).

## User Stories

- As the maintainer of FORGE, I want a fresh pass-4 workstream so this run does not silently resume an outdated task list or inherit stale execution state.
- As the maintainer of FORGE, I want the legacy [`web/pages/skoCharts.tsx`](/Users/tim/Code/fhfhockey.com/web/pages/skoCharts.tsx) page reviewed early so useful ideas can be carried forward and stale logic can be retired deliberately.
- As the maintainer of FORGE, I want the full data and calculation pipeline audited so novel metrics and projections are challenged instead of trusted by default.
- As the maintainer of FORGE, I want every meaningful issue or enhancement opportunity discovered during the audit turned into an explicit task so nothing important dies in narrative notes.
- As the maintainer of FORGE, I want the dashboard and its components fully styled and visually reviewed so the page reads as a polished one-page hub rather than a partially updated work-in-progress.
- As the maintainer of FORGE, I want endpoint smoke tests and output vetting performed so correctness includes operational viability and believable rendered results.

## Functional Requirements

1. The workflow must begin by reading [`web/rules/create-prd.mdc`](/Users/tim/Code/fhfhockey.com/web/rules/create-prd.mdc), asking the minimum required clarifying questions, and creating a new pass-4 PRD under `/tasks/`.
2. The workflow must read [`web/rules/generate-tasks.mdc`](/Users/tim/Code/fhfhockey.com/web/rules/generate-tasks.mdc) and create a new pass-4 task list from the new PRD rather than reusing an older task list as the active list.
3. Because this pass is broad and strategically significant, the workflow must create parent tasks first and pause for confirmation before generating sub-tasks.
4. The workflow must read [`web/rules/process-task-list.mdc`](/Users/tim/Code/fhfhockey.com/web/rules/process-task-list.mdc) and use the new pass-4 task list as the sole active execution list for this run.
5. The workflow must inspect [`web/pages/skoCharts.tsx`](/Users/tim/Code/fhfhockey.com/web/pages/skoCharts.tsx) before the broader audit and evaluate its calculations, concepts, presentation patterns, and retirement candidates.
6. The workflow must inventory and audit all files that materially influence FORGE outputs, including dashboard pages, components, projection logic, queries, rolling-data ingestion, upsert routes, helper modules, derived metrics, shared utilities, styling surfaces, and relevant tests.
7. The audit must challenge the logic and implementation of meaningful derived metrics, probabilities, ratings, scoring formulas, and weighting systems instead of assuming existing novelty implies correctness.
8. Every meaningful finding discovered during the audit, implementation, smoke testing, output vetting, styling review, or visual inspection must be appended to the end of the active pass-4 task list as a new task or sub-task.
9. The work phase must execute against the expanded task list and not stop at narrative analysis.
10. The expected-goals modeling path used by FORGE must be reviewed, honed, and improved with gradient boosting in the production implementation path when the audit supports that change.
11. Relevant live endpoints must be smoke tested using the correct operational scope, including one-day upserts where applicable, and must be evaluated against the 4 minute 30 second target where that threshold applies.
12. If a valid smoke test is blocked because a table is too stale, the workflow must stop and require the user to perform the necessary catch-up locally and respond with the exact text `Done, proceed` before continuing.
13. Any endpoint touching Natural Stat Trick must remain safely below these request ceilings: 40 requests in 1 minute, 80 requests in 5 minutes, 100 requests in 15 minutes, and 180 requests in 1 hour.
14. After implementation and smoke testing, each relevant dashboard component's displayed outputs must be traced to source inputs and checked for logical and numerical soundness.
15. Styling work must explicitly include both page-level and component-level review and improvement using the existing style blueprint and variables as the source of truth.
16. The page must be visually inspected in Chromium or an equivalent browser-capable environment to verify hierarchy, spacing, density, overflow, and dashboard polish.
17. The pass should prefer a desktop no-scroll or near-no-scroll one-page hub unless unavoidable constraints justify limited scrolling.
18. The pass should remain code-first and non-destructive by default; schema changes or manual DB steps should only be introduced if clearly necessary and then handled under the repo's manual-action rules.

## Non-Goals (Out of Scope)

- Reusing or auto-resuming a pre-existing unfinished task list as the active execution authority for this pass.
- Treating previous PRDs, audits, or task lists as anything other than reference context unless explicitly promoted by the user.
- Making unrelated platform-wide redesigns outside the FORGE ecosystem.
- Performing destructive data or git operations that are not explicitly required for this pass.
- Adding speculative documentation sprawl that is not needed to support the active pass-4 task workflow.

## Design Considerations

- Use [`fhfh-styles.md`](/Users/tim/Code/fhfhockey.com/fhfh-styles.md) as the styling blueprint and [`web/styles/vars.scss`](/Users/tim/Code/fhfhockey.com/web/styles/vars.scss) as the variable source of truth.
- Prioritize strong visual hierarchy, compact but legible information density, intentional spacing, and polished component consistency across the FORGE dashboard.
- Improve both the page chrome and the internal dashboard components; do not stop after top-level layout cleanup.

## Technical Considerations

- Relevant file surfaces include, at minimum:
  - [`web/pages/forge/dashboard.tsx`](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx)
  - [`web/pages/skoCharts.tsx`](/Users/tim/Code/fhfhockey.com/web/pages/skoCharts.tsx)
  - [`web/lib/projections/run-forge-projections.ts`](/Users/tim/Code/fhfhockey.com/web/lib/projections/run-forge-projections.ts)
  - [`web/lib/projections/queries/skater-queries.ts`](/Users/tim/Code/fhfhockey.com/web/lib/projections/queries/skater-queries.ts)
  - [`web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)
  - [`web/pages/api/v1/db/update-rolling-player-averages.ts`](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts)
  - relevant files under `web/pages/api/v1/db/`
  - relevant files under `web/pages/api/v1/forge/`
- This pass must follow the repo's task-list management rules, including parent/sub-task progression, checkpointing, manual-action overrides, and task-list maintenance.
- Routine verification should prefer narrow, practical commands and direct observation over excessive test creation, but targeted tests should be added or updated where logic risk justifies them.

## Success Metrics

- A new pass-4 PRD exists and a new pass-4 task list is created and used as the sole active execution list.
- The active pass-4 task list grows as meaningful findings are discovered during the audit and execution.
- The FORGE dashboard page and its relevant components are materially improved in correctness, readability, and styling.
- Legacy `skoCharts` findings are converted into explicit adopt/adapt/retire work items.
- Relevant endpoint smoke tests complete successfully, with timing captured and threshold failures either fixed or converted into explicit optimization tasks.
- Rendered outputs are vetted component-by-component and judged logically sound under the approved default review standard.
- The expected-goals model path used by FORGE includes audited and validated gradient boosting improvements where appropriate.
- The dashboard passes a Chromium-capable visual inspection with no major hierarchy, overflow, or congestion issues remaining.

## Open Questions

- Whether any endpoint needed for smoke testing will require a manual catch-up run before a valid one-day test can be executed.
- Whether the audit will reveal production-path constraints that require bounded fallback logic around the new gradient boosting implementation.
- Whether any legacy `skoCharts` concepts are valuable enough to port directly versus document and retire.
