# /game-grid/[mode] — page audit

- Source: `web/pages/game-grid/[mode].tsx`
- Status: Discussion started; not ready for implementation planning.
- Discovery: Not listed in primary navigation configuration; other entry points and access remain unverified.
- Evidence: route and immediate UI source inspected; rendering and interaction behavior remain unverified.
- Scope: inspect the user-facing page and its tools. If this is a redirect, internal screen, or experiment, record its disposition before further auditing.

## Purpose and intended user

Initial interpretation: help an average fantasy GM compare NHL team schedules, identify useful off-night games and favorable upcoming windows, and plan streaming or roster moves. Advanced opponent metrics and Week Score add depth beyond raw game counts. Owner confirmation/refinement: pending.

## Current experience and evidence

Observed in `web/pages/game-grid/[mode].tsx`, `web/components/GameGrid/GameGrid.tsx`, and `web/components/GameGrid/Header.tsx`:

- Entry `/game-grid` redirects to `/game-grid/7-Day-Forecast`.
- Seven- and ten-day forecast modes, previous/next week controls, orientation switching, and a custom date-range flow.
- Team schedule grid, daily NHL game totals, off-night indicators, games played, and Week Score. Sorting controls and day-exclusion controls are present in header source.
- Opponent metrics and four-week schedule components provide deeper and longer-range context.
- Week Score explanation and a mobile tips/legend sheet explain schedule scoring, day types, columns, and controls.
- Separate mobile and desktop rendering paths; source includes a best-available-players section in the desktop return path, whose mobile availability/parity needs checking if relevant to owner concerns.
- Related-tool links follow the grid. Custom ranges use the separate `/game-grid/dateRange` route, which asks the visitor to return to Game Grid when range parameters are missing.

No browser flow has been tested. Discuss the main Game Grid experience first; preserve separate records for its redirect and custom-range route.

## Questions and owner responses

1. Does the purpose summary match your vision? Is the primary job a quick schedule lookup, planning streaming pickups, or both?
2. What already works well and should be preserved? What is unfinished or most frustrating on desktop or mobile?
3. Can an average GM understand off-nights and Week Score, and discover sorting/day exclusion without your explanation? Which controls or metrics need clearer presentation?

Owner responses: pending. Known site-wide guidance: average GM first, optional advanced depth; Home and Draft Dashboard are UI references. Game Grid is an owner-identified priority tool.

## Recommendations and decisions

Initial discussion recommendation: assess the clarity of the core schedule task before expanding the tool. Examine whether deeper metrics and longer-range views support that task without obscuring it; confirm discoverability of existing controls and mobile usability before proposing new features. These are audit questions, not confirmed defects or approved changes.

## Plan handoff — draft, not ready

Complete only after the purpose is confirmed, priority problems are concrete, scope is agreed, and material questions are resolved:

```text
/plan
Review this page audit and its recorded owner responses before planning.
Page: /game-grid/[mode]
Source: web/pages/game-grid/[mode].tsx
Audit: web/prep-chef/game-grid--mode.md

Confirmed purpose and audience: PENDING
Original purpose summary, owner response, and refined summary: PENDING
Observed current behavior and evidence: PENDING
Approved improvements and priority: PENDING
Navigation and shared UI conventions to follow: PENDING
Preserve / out of scope: PENDING
Acceptance criteria and relevant UI states: PENDING
Dependencies and unresolved questions: PENDING

Create a sequenced, actionable task list for the agreed scope, with proportionate
verification. Follow repository AGENTS.md. Inspect the current page before
assuming the audit is still accurate. Do not implement changes or deploy.
Do not turn unapproved recommendations into requirements. Ask about material
remaining ambiguities before finalizing the plan.
```
