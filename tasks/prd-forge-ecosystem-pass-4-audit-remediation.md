# FORGE Ecosystem Pass 4 Audit and Remediation

## Introduction/Overview

This pass is a new, standalone FORGE workstream focused on auditing the full FORGE dashboard ecosystem from upstream data inputs through rendered dashboard outputs, then converting findings into executable work, completing remediation, validating behavior, and finishing styling. The prior pass left gaps in `web/pages/forge/dashboard.tsx`, individual dashboard component quality, and task-list growth during discovery. Pass 4 corrects those gaps by treating the audit as a living execution workflow rather than a static document exercise.

This pass is correctness-first. Calculation validity, output trustworthiness, endpoint operability, and transformation integrity take precedence over presentation polish, while still requiring a complete styling and visual inspection pass before closeout. Natural Stat Trick catch-up and freshness work are currently externally blocked by Cloudflare validation and must be documented as dependency blockers rather than treated as internal correctness failures unless contrary evidence appears.

## Goals

- Produce a new standalone pass-4 PRD and a new standalone pass-4 task list, with the new task list serving as the sole execution authority for this run.
- Review `web/pages/skoCharts.tsx` early and decide which legacy calculations, concepts, patterns, or files should be adopted, adapted, referenced, ignored, or retired.
- Audit the full FORGE ecosystem from upstream data collection and recompute logic through page assembly, dashboard components, styling surfaces, and rendered outputs.
- Convert every meaningful finding into an appended task or sub-task in the active pass-4 task list so discoveries do not remain trapped in prose.
- Execute remediation work from the new pass-4 task list, including correctness fixes, maintainability fixes tied to correctness or operability, component fixes, and page-level dashboard improvements.
- Smoke test live endpoints where feasible, document blocked Natural Stat Trick dependent work clearly, and capture any performance or operability follow-up as explicit tasks.
- Vet rendered dashboard outputs component-by-component and flag any result that is directionally questionable, under-reactive, unintuitive, edge-case-sensitive, or misaligned with hockey reality.
- Complete the styling pass for `web/pages/forge/dashboard.tsx` and its individual dashboard components using the existing style guide and variable system.
- Perform visual inspection in the local dev environment plus directly relevant API responses.

## User Stories

- As a FORGE operator, I want a fresh pass-4 workstream with its own PRD and task list so the audit is not confused with older unfinished passes.
- As a dashboard user, I want the FORGE page and its components to show outputs that are logically sound, operationally trustworthy, and visually polished.
- As a maintainer, I want every important issue discovered during the audit to become a task so no correctness, styling, performance, or legacy-cleanup work gets lost.
- As a product owner, I want `web/pages/skoCharts.tsx` reviewed early so worthwhile legacy ideas can influence pass-4 remediation and stale logic can be retired deliberately.
- As an operator, I want blocked NST-dependent catch-up or freshness work documented clearly so external blockers are separated from internal defects.

## Functional Requirements

1. The pass must begin by creating a new standalone PRD and a new standalone pass-4 task list in `/tasks/`, without reusing an older task list as the active implementation file.
2. The task list process must follow the repo workflow rules: generate parent tasks first, pause for user confirmation, then generate sub-tasks before implementation begins.
3. The pass must inspect `web/pages/skoCharts.tsx` early and evaluate its calculations, assumptions, concepts, visual patterns, debug affordances, and reuse or retirement value.
4. The pass must inventory all relevant FORGE files, including dashboard pages, dashboard components, shared components, projections logic, rolling-input logic, API/db routes, selectors, serializers, helpers, calculation modules, styling files, and relevant tests.
5. The pass must audit each relevant file for role, dependencies, assumptions, transformations, formula soundness, fallback behavior, edge-case handling, maintainability, observability, and downstream output impact.
6. The pass must rigorously challenge all meaningful derived metrics and novel calculations used by FORGE rather than assuming existing behavior is correct.
7. The pass must append every meaningful audit finding, open question, bug, optimization, styling issue, or retirement/reuse decision to the end of the active pass-4 task list as a new task or sub-task.
8. The pass must execute remediation work from the active pass-4 task list rather than stopping after audit narration.
9. The pass must avoid auto-resuming prior unfinished task lists in place; any useful legacy follow-up must be migrated deliberately into the new pass-4 task list.
10. The pass must smoke test relevant live endpoints where feasible, using one-day or operationally appropriate scopes, while respecting documented rate limits for Natural Stat Trick dependent flows.
11. The pass must treat NST-dependent catch-up, freshness, or smoke-test work currently blocked by Cloudflare validation as external dependency blockers, document them clearly, and continue with non-blocked work.
12. The pass must vet page and component outputs after implementation by tracing displayed values to their source inputs and assessing whether the results appear expected in hockey terms, not only internally consistent in code.
13. The pass must explicitly complete the styling pass for `web/pages/forge/dashboard.tsx` and its individual components using the established style blueprint and variable source of truth.
14. The pass must visually inspect the local dev page and directly relevant API responses, identify visual defects or awkward information density issues, and convert any unresolved findings into explicit tasks.
15. The pass must preserve task ordering by appending newly discovered work to the end of the active pass-4 task list unless a blocker must be called out explicitly.

## Non-Goals (Out of Scope)

- Building a brand-new FORGE product direction unrelated to the existing dashboard and data pipeline.
- Treating previous PRDs or task lists as the active execution authority for pass 4.
- Forcing NST catch-up or freshness recovery during this pass while Cloudflare validation remains an external blocker.
- Performing unrelated repo cleanup that does not materially affect FORGE correctness, operability, output trust, or dashboard quality.
- Accepting code-path consistency alone as sufficient proof that component outputs are correct from a hockey or product perspective.

## Design Considerations

- Use the existing FORGE style system rather than inventing a parallel design language.
- Follow the styling blueprint in the repo’s FORGE/FHFH style guidance and use the variable definitions from the shared SCSS variable source of truth.
- The dashboard should read as a polished one-page hub with strong hierarchy, intentional spacing, good scanability, and component-level consistency.
- The pass must explicitly re-review `web/pages/forge/dashboard.tsx` and the dashboard’s individual child components because prior styling updates were incomplete.

## Technical Considerations

- The audit must start from upstream inputs and trace through rolling averages, projections, derived metrics, query layers, assembly helpers, API routes, and final rendering.
- Natural Stat Trick dependent endpoints must stay safely below the documented rate limits: 40 requests per minute, 80 per 5 minutes, 100 per 15 minutes, and 180 per hour.
- If smoke tests identify slow operational paths exceeding the intended 4m30s threshold where applicable, the pass must create optimization tasks unless an external blocker or justified exception applies.
- The task list must remain live and continue growing throughout audit, implementation, smoke testing, output vetting, styling, and visual inspection.
- Any user-run step involving manual refreshes, endpoint runs, or time-sensitive environment actions must require the explicit confirmation `Done, proceed`.

## Success Metrics

- A new standalone PRD and new standalone pass-4 task list exist and are used for this run.
- `web/pages/skoCharts.tsx` has a documented adoption/adaptation/reference/retirement decision, with any follow-up captured as explicit tasks.
- The active pass-4 task list expands during discovery instead of remaining frozen.
- High-priority FORGE correctness, operability, output-trust, and styling defects discovered in pass 4 are remediated or clearly blocked with explicit follow-up tasks.
- `web/pages/forge/dashboard.tsx` and its relevant child components receive completed styling and quality review rather than only top-level page chrome adjustments.
- Endpoint smoke-test status is explicit: passed, failed, blocked by external NST dependency, or deferred with a reason.
- Component outputs have been vetted for both code-path integrity and hockey-facing plausibility.
- Visual inspection is completed against the local dev page and relevant API surfaces, with follow-up tasks added for any unresolved issues.

## Open Questions

- Which specific legacy ideas from `web/pages/skoCharts.tsx` remain valuable enough to port or adapt into FORGE after line-by-line review?
- Which FORGE outputs are internally consistent in code but still questionable in hockey-facing behavior and therefore need formula or presentation changes?
- Which endpoint smoke tests can be executed meaningfully without NST catch-up, and which must remain blocked until the external access issue is resolved?
- Are there latent styling inconsistencies between page-level layout and child components that only become obvious during browser-based visual inspection?
