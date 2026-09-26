## Relevant Files

- `web/components/underlying-stats/UnderlyingStatsDashboard.tsx` - Owns the landing-page header, navigation, charts, Power Leaders, signal panels, readiness panel, and utility links.
- `web/components/underlying-stats/UnderlyingStatsDashboard.module.scss` - Owns the dashboard layout and responsive presentation.
- `web/components/underlying-stats/UnderlyingStatsNavBar.tsx` - Renders the existing four Underlying Stats destinations that should become the full-width link rail.
- `web/components/underlying-stats/UnderlyingStatsNavBar.module.scss` - Styles the four destination links and connected/card variants.
- `web/pages/underlying-stats/index.tsx` - Owns the detailed team table, its Simple/Advanced state, row limit, sorting, and composition with the dashboard.
- `web/pages/underlying-stats/indexUS.module.scss` - Styles the detailed team table and landing-page shell.
- `web/__tests__/pages/underlying-stats/index.test.tsx` - Existing landing-page tests to update for the new default view, tab behavior, links, and retained interactions.

### Notes

- This is a focused information-architecture and progressive-disclosure pass. Do not add new metrics, data products, routes, APIs, dependencies, or LineupExperts feature clones.
- Reuse the existing `UNDERLYING_STATS_NAV_LINKS`, `UnderlyingStatsNavBar`, dashboard data, table implementation, and interaction behavior.
- Preserve snapshot selection, error/loading states, team pin/preview behavior, table sorting, metric popovers, and responsive support.
- The working tree contains unrelated Start Chart, navigation, and Draft Dashboard changes. Inspect the current diff first and preserve every unrelated modification.
- Do not trigger a remote build, deployment, database operation, or production action.
- Run the narrowest relevant test first. TypeScript, lint, or browser verification should be added only when justified by the files changed.

## Tasks

- [ ] 1.0 Establish the safe implementation baseline
  - [ ] 1.1 Inspect the current diff for the relevant Underlying Stats files and confirm whether another task has started editing them.
  - [ ] 1.2 Read the existing landing-page test and identify the assertions that intentionally encode the current information hierarchy.
  - [ ] 1.3 Preserve all existing data contracts, date routing, loading/error behavior, team selection, sorting, and metric explanations.
- [ ] 2.0 Reorder the beginner-facing landing hierarchy
  - [ ] 2.1 Move the existing four-link Underlying Stats navigation out of the compact Team Hub treatment and render it as a full-width, evenly divided row immediately above Power Leaders.
  - [ ] 2.2 Keep exactly the existing destinations and labels: Team Explorer, Skater Stats, Goalie Stats, and xG Lab.
  - [ ] 2.3 Position Power Leaders as the first substantive hero panel after the compact page header and four-link row.
  - [ ] 2.4 Avoid duplicate navigation and retain a clear active-page/focus treatment at desktop and mobile widths.
- [ ] 3.0 Add progressive disclosure for rankings and charts
  - [ ] 3.1 Create one accessible primary workspace with `Team Rankings` and `Chart` tabs; `Team Rankings` must be selected on first load.
  - [ ] 3.2 Place the existing detailed team table inside `Team Rankings`, default it to Advanced mode, and show all available teams rather than the 12-row preview.
  - [ ] 3.3 Place the existing Process Quadrant and Team Movers workspace inside `Chart` without changing its data or pin/preview interactions.
  - [ ] 3.4 Use real tab semantics, visible focus, selected state, and keyboard-operable controls; do not create display-only tabs.
  - [ ] 3.5 Keep the existing Simple/Advanced table control available so users can intentionally reduce or expand detail after landing.
- [ ] 4.0 Remove redundant landing-page density while preserving access
  - [ ] 4.1 Remove the `signalGrid` panels from the landing flow: What Looks Real, Under the Radar, and Schedule Texture.
  - [ ] 4.2 Remove the `utilityGrid` from the landing flow after ensuring its useful destinations remain available through the four-link rail or the existing About disclosure.
  - [ ] 4.3 Reconcile Data Readiness with `commandMeta` so dataset readiness is accessible from the compact header without duplicating snapshot date, latest snapshot, team count, or freshness.
  - [ ] 4.4 Preserve the existing `UlsStatusPanel` detail behind a compact disclosure or equivalent accessible interaction; do not discard readiness information.
  - [ ] 4.5 Remove imports, helpers, state, and styles made unreachable by the deliberate panel removals, without unrelated cleanup.
- [ ] 5.0 Update focused tests and verify the implementation
  - [ ] 5.1 Update the existing landing-page test to assert the four-link order, Power Leaders-first hierarchy, default Team Rankings tab, Advanced table columns, and all-team rendering.
  - [ ] 5.2 Test switching to Chart and confirm Process Quadrant and Team Movers appear only in that workspace.
  - [ ] 5.3 Retain or adapt regression coverage for snapshot changes, failures, sorting, hydration, and team pin/preview behavior.
  - [ ] 5.4 Run `npm test -- __tests__/pages/underlying-stats/index.test.tsx` from `web/`, then targeted TypeScript/lint checks if warranted.
  - [ ] 5.5 Verify desktop and mobile behavior in a browser if feasible, including no horizontal overflow and usable tabs/link targets.
- [ ] 6.0 Produce the next-pass mockup handoff
  - [ ] 6.1 Inspect the implemented landing page and the original LineupExperts-inspired objectives after Task 5 is complete.
  - [ ] 6.2 Write a paste-ready ChatGPT prompt for a desktop/mobile mockup that describes the implemented foundation accurately and asks only for visual refinement, not new product scope.
  - [ ] 6.3 Require realistic desktop/mobile dimensions, the existing FHFH visual system, beginner-friendly hierarchy, and truthful data states.

## /goal Work Orders

### Head Chef — Program Oversight

```text
/goal Coordinate the Underlying Stats LineupExperts-alignment foundation in `/Users/tim/Code/fhfhockey.com` using `tasks/tasks-underlying-stats-lineupexperts-alignment.md` as the controlling work order.

You are the Head Chef. Own delegation, sequencing, scope control, verification, and cost discipline. Do not become the primary implementer if that would interfere with oversight. The user explicitly authorizes you to create and message Codex threads for this program.

Create exactly these worker tasks in the existing `fhfhockey.com` Codex project and place them in the `CHEF — Underlying Stats Alignment` sidebar section:
1. `Sous Chef — Underlying Stats Foundation`: execute Tasks 1.0 through 5.0. Start with GPT-6 Sol at medium reasoning. Escalate to high only for a concrete unresolved architecture, state-management, or responsive-accessibility problem; dial down again when the difficult portion is settled.
2. `Commis — Underlying Stats Verification`: independently review and verify the completed implementation after the Sous Chef reports ready. Use GPT-6 Luna at high reasoning, or GPT-6 Sol low only if Luna cannot perform a required repository/browser check. This worker should not redesign the feature or silently repair broad issues; it should report precise defects and make only tiny, clearly in-scope corrections if explicitly delegated.
3. `Commis — Underlying Stats Mockup Brief`: execute Task 6.0 only after implementation and verification are stable. Use GPT-6 Luna at low reasoning. This is a documentation/prompt task, not an image-generation or application-code task.

Sequence the work: dispatch the Sous Chef first; do not dispatch verification against a moving implementation; do not finalize the mockup prompt against the old layout. Inspect the current working-tree diff before every handoff and ensure workers preserve unrelated Start Chart, navigation, and Draft Dashboard changes. Prevent parallel edits to the same Underlying Stats files.

At each handoff, compare the result against every parent task and subtask in the work order. Require evidence for tests and browser checks; never treat test discovery as runtime verification. Reject scope expansion into new metrics, routes, APIs, data pipelines, LineupExperts clones, dependencies, remote deployments, or production changes. If a worker is blocked, diagnose whether the block is real, narrow the task or change the reasoning level appropriately, and ask the user only when new authority or a material product decision is required.

Maintain a concise coordination ledger in your own thread: worker, assigned scope, model/reasoning, status, files touched, checks run, blockers, and next handoff. Stop when Tasks 1.0–6.0 are either verified complete or accurately reported as unresolved. Do not create a PR, deploy, or publish data unless the user separately authorizes it.
```

### Sous Chef — Underlying Stats Foundation

```text
/goal Implement Tasks 1.0 through 5.0 in `tasks/tasks-underlying-stats-lineupexperts-alignment.md` for the Underlying Stats landing page.

You are the sole implementation owner for this workstream. Begin by reading the repository `AGENTS.md`, the controlling task file, the current diff, and only the relevant files listed there. Preserve unrelated working-tree changes.

Restructure the existing page rather than rebuilding it: use the existing four-link navigation as a full-width row above Power Leaders; make Power Leaders the first substantive hero; create accessible Team Rankings and Chart tabs with Team Rankings selected initially; default the existing table to Advanced and show all available teams; place Process Quadrant and Team Movers under Chart; remove the signal and utility grids from the landing flow; merge detailed readiness access into the compact header without losing `UlsStatusPanel` information or duplicating metadata.

Do not add metrics, routes, APIs, dependencies, feature clones, or speculative abstractions. Preserve all existing data contracts and working interactions. Update the existing landing-page test rather than creating a duplicate test file. Run the narrowest relevant verification first and report only checks actually performed. Do not deploy, publish, or create a PR.

When complete, give the Head Chef a concise handoff with files changed, behavior implemented, test/browser evidence, known limitations, and any subtask not satisfied.
```

### Commis — Underlying Stats Verification

```text
/goal Independently verify Tasks 1.0 through 5.0 in `tasks/tasks-underlying-stats-lineupexperts-alignment.md` after the Sous Chef implementation is ready.

You are a verification worker, not a redesign owner. Read the task file, inspect the final diff, and map evidence to every acceptance subtask. Confirm the four-link order and destinations, Power Leaders hierarchy, Team Rankings default, Advanced/all-team table behavior, Chart tab behavior, readiness disclosure, retained date/error/sorting/pin interactions, accessibility semantics, and responsive behavior.

Run the focused Vitest file and only the additional TypeScript, lint, or browser checks justified by the changed surface. Distinguish passed, failed, blocked, and not-run checks. Do not expand scope or refactor unrelated code. Report precise defects to the Head Chef; make no broad corrections unless the Head Chef explicitly assigns them. Do not deploy, publish, or create a PR.
```

### Commis — Underlying Stats Mockup Brief

```text
/goal Execute Task 6.0 in `tasks/tasks-underlying-stats-lineupexperts-alignment.md` after the implementation and verification handoffs are complete.

Inspect the finished Underlying Stats landing page and write one paste-ready prompt for ChatGPT to generate a side-by-side desktop/mobile UX/UI mockup. Accurately describe the implemented hierarchy: compact header and readiness access, four equal destination links, Power Leaders hero, Team Rankings default workspace, Chart secondary workspace, and reduced landing-page density.

The prompt must ask for visual refinement only. It must not invent metrics, controls, routes, data, or new LineupExperts feature scope. Require realistic viewport proportions, FHFH dark analytics styling, beginner-friendly progressive disclosure, accessible interaction cues, truthful loading/empty/error states, and a desktop/mobile composition. Do not edit application code or generate the image. Return the prompt and a short list of assumptions to the Head Chef.
```
