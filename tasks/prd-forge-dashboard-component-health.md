# PRD: FORGE Dashboard Component Health And Data Integrity

## 1. Introduction / Overview

The FORGE dashboard and its related drill-in routes are now live enough that the next priority is not more feature expansion. The next priority is trust.

Each dashboard component must be audited as a full operating chain:

- the UI component
- the page or route that renders it
- the API route that serves it
- the source tables behind it
- the cron jobs that keep it fresh
- the degraded or blocked behavior when upstream data is stale or missing
- the observability and verification needed to prove the component is showing the correct thing

This PRD defines a structured component-by-component health program for the FORGE route family. The output is not just a one-time audit. It must produce an actionable implementation plan that will be turned into a task list, and while that task list is being executed, any newly discovered errors, correctness issues, or optimization opportunities must be captured into a follow-on backlog instead of being lost in ad hoc notes.

The main problem this PRD solves is that a dashboard can look complete while still having silent failures in freshness, cron coverage, degraded behavior, data reconciliation, or source-table drift. This PRD is meant to make each FORGE component operationally trustworthy.

This effort is in scope for the full FORGE dashboard family, including:

- [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx)
- [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)
- [team/[teamId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/team/[teamId].tsx)
- [player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/player/[playerId].tsx)

It also covers every data-backed dashboard card and its supporting adapters, APIs, cron dependencies, and source tables.

## 2. Goals

1. Create a component-by-component audit framework for every data-backed FORGE dashboard surface.
2. Verify that each component is operationally healthy across freshness, correctness, cron ownership, degraded-state behavior, observability, and source-to-UI reconciliation.
3. Identify the exact cron chain and source-table dependency chain required to keep each component fresh.
4. Make runtime-budget expectations explicit for the cron-fed components so slow jobs become visible operational risks rather than background assumptions.
5. Classify each component with a clear `green`, `yellow`, or `red` health status and a short reason summary.
6. Produce a follow-on implementation task list for fixing or validating each component one by one.
7. Require that execution of the follow-on task list also creates a second rolling backlog for any newly discovered bugs, data anomalies, stale paths, or optimizations.
8. Prevent silent trust failures by requiring source-to-UI reconciliation checks for every audited component, not only the obviously risky ones.
9. Keep scope disciplined by focusing on validation, health, automation coverage, and repair planning rather than broad new feature work.

## 3. User Stories

1. As the maintainer of FORGE, I want to inspect each dashboard component as a full chain so I can tell whether it is actually healthy, not just visually present.
2. As the maintainer of FORGE, I want every component to name its source tables, serving API, and cron dependency so I know what must run to keep it trustworthy.
3. As the maintainer of FORGE, I want a clear `green / yellow / red` status for each component so I can prioritize work without rereading multiple files.
4. As the maintainer of FORGE, I want each component to prove that the UI matches the underlying data it is supposed to display so I can trust the dashboard as an operational product.
5. As the maintainer of FORGE, I want degraded and blocked behavior audited explicitly so stale or partial data does not quietly present itself as current.
6. As the maintainer of FORGE, I want runtime-budget expectations tied to component freshness so I can keep the cron surface efficient and avoid slow overnight drift.
7. As the maintainer of FORGE, I want the audit to produce a concrete task list for repairs and validation so the result is operationally useful rather than descriptive only.
8. As the maintainer of FORGE, I want newly discovered issues and optimizations captured while executing that task list so the system keeps getting tighter instead of spawning disconnected notes.

## 4. Functional Requirements

1. The system must create a full inventory of every data-backed FORGE component in scope.
2. The inventory must cover, at minimum:
   1. [SlateStripCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SlateStripCard.tsx)
   2. [TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx)
   3. [TeamPowerCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TeamPowerCard.tsx)
   4. [SustainabilityCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SustainabilityCard.tsx)
   5. [HotColdCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/HotColdCard.tsx)
   6. [GoalieRiskCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/GoalieRiskCard.tsx)
   7. [ForgeRouteNav.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/ForgeRouteNav.tsx) where it depends on data-aware routing or status behavior
   8. [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx)
   9. [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)
   10. [team/[teamId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/team/[teamId].tsx)
   11. [player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/player/[playerId].tsx)
3. The audit must treat each component as a full chain, not a JSX-only surface.
4. For each component, the audit must document the following:
   1. component purpose
   2. page or route owner
   3. client-side data adapter or normalizer
   4. serving API route or routes
   5. direct source tables or upstream datasets
   6. cron jobs or refresh jobs required for freshness
   7. freshness expectation
   8. runtime-budget expectation for the upstream refresh path
   9. degraded-state and blocked-state behavior
   10. observability or verification surface
   11. source-to-UI reconciliation method
   12. final health status and rationale
5. The audit must classify every component as:
   1. `green`
   2. `yellow`
   3. `red`
6. Each health classification must include short reasons instead of a color only.
7. The audit must verify whether each component is automated through an existing cron or scheduled refresh path.
8. The audit must identify missing automation ownership for any component whose source freshness depends on manual reruns or undocumented processes.
9. The audit must document the exact current cron or scheduled dependency chain for each component, including intermediate jobs where required.
10. The audit must document target runbook or cron-surface changes only where they are necessary to make the component reliable.
11. The audit must not assume that a component is healthy just because the API returns data.
12. The audit must verify that each component accurately represents the data it is meant to display.
13. The accuracy check must include source-to-UI reconciliation for every component in scope.
14. Source-to-UI reconciliation must compare the rendered or normalized values against the underlying API response and, where necessary, the authoritative source tables.
15. The audit must identify whether a component is vulnerable to silent fallback behavior that can mask stale or missing data.
16. The audit must identify whether the component’s stale-state treatment matches the intended dashboard stale-state policy.
17. The audit must verify whether degraded-state behavior is informative and safe, rather than silently misleading.
18. The audit must identify where observability is missing, weak, duplicated, or not reusable.
19. The audit must include the full route family, not just the main dashboard page.
20. The audit must check whether [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx) preview surfaces remain consistent with the deeper dashboard surfaces they preview.
21. The audit must check whether [team/[teamId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/team/[teamId].tsx) and [player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/player/[playerId].tsx) are receiving data and routing behavior consistent with the dashboard card contracts.
22. The audit must identify any component whose upstream dependencies have materially different freshness cadences that can create misleading mixed-state UI.
23. The audit must identify whether the component depends on data that is current, fallback, degraded, or blocked.
24. The audit must identify whether the component’s runtime path is compatible with the project’s operational efficiency goals, including the existing short-run daily budget expectations.
25. The audit must explicitly inspect the following known dashboard-serving APIs where relevant:
   1. [web/pages/api/v1/start-chart.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/start-chart.ts)
   2. [web/pages/api/v1/forge/players.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/forge/players.ts)
   3. [web/pages/api/v1/forge/goalies.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/forge/goalies.ts)
   4. [web/pages/api/team-ratings.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/team-ratings.ts)
   5. [web/pages/api/v1/trends/team-ctpi.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/trends/team-ctpi.ts)
   6. [web/pages/api/v1/sustainability/trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/sustainability/trends.ts)
   7. [web/pages/api/v1/trends/skater-power.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/trends/skater-power.ts)
   8. [web/pages/api/v1/transactions/ownership-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-trends.ts)
   9. [web/pages/api/v1/transactions/ownership-snapshots.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-snapshots.ts)
26. The audit must identify the authoritative source tables for those APIs, including but not limited to:
   1. `forge_runs`
   2. `forge_player_projections`
   3. `forge_goalie_projections`
   4. `yahoo_players`
   5. `team_power_ratings_daily`
   6. `sustainability_scores`
   7. `player_baselines`
   8. `wgo_team_stats`
   9. `games`
   10. `goalie_start_projections`
   11. any required NST team or skater sources discovered during the audit
27. The audit must explicitly connect each component to the cron schedule entries that keep those tables fresh.
28. The audit must inspect the relevant scheduling guidance in [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md).
29. The audit must name components that do not currently have an acceptable automated refresh path.
30. The audit must separate correctness failures from freshness failures so stale data is not misdiagnosed as a transformation bug.
31. The audit must separate API-contract issues from UI-rendering issues so repair work is assigned to the correct layer.
32. The audit must separate source-table issues from cron-surface issues so upstream fixes are not buried inside component tickets.
33. The audit must produce a recommended follow-on task list for validating and fixing the components one by one.
34. That follow-on task list must be structured so that component validation and component repair can proceed in an ordered, auditable way.
35. While executing that future task list, the system must capture any newly discovered bugs, data issues, stale paths, or optimizations into a separate running backlog.
36. The PRD must define that running backlog as a first-class output of the follow-on work, not an optional note-taking exercise.
37. The audit must prefer reuse of existing observability, verification scripts, and runbook surfaces where they exist, rather than inventing disconnected status mechanisms without need.
38. The audit must explicitly identify where a component has no reliable verification path today.
39. The audit must define acceptance criteria for declaring an individual component healthy.
40. A component may only be declared healthy if:
   1. its data path is automated or intentionally documented
   2. its freshness state is known
   3. its degraded behavior is appropriate
   4. its UI meaning matches the underlying data
   5. its health classification is supported by evidence
41. The audit deliverable must be understandable to a junior developer without requiring them to infer hidden operational assumptions.

## 5. Non-Goals (Out of Scope)

1. This PRD does not authorize broad new dashboard feature work.
2. This PRD does not authorize a visual redesign of the dashboard or drill-in pages.
3. This PRD does not require new database schema changes as part of the audit itself.
4. This PRD does not require expanding the cron surface beyond what is necessary to make existing components reliable.
5. This PRD does not require a broad rebuild of the FORGE stack.
6. This PRD does not require replacing working APIs simply because they are old.
7. This PRD does not require inventing a separate internal UI health console unless the audit proves one is necessary later.
8. This PRD does not require solving every discovered issue during PRD authoring; it only defines the audit and repair program.

## 6. Design Considerations

1. This effort is primarily operational, not visual.
2. Any health output generated from this PRD should favor compact, explicit status reporting over decorative presentation.
3. If any temporary audit UI or document structure is created later, it should mirror the dashboard’s real component boundaries so findings are easy to map back to code.
4. Health summaries should be easy to scan by component name and route name.
5. Status language should stay direct:
   1. what the component is supposed to show
   2. whether it is fresh
   3. whether it is accurate
   4. what keeps it updated
   5. what is currently wrong, if anything

## 7. Technical Considerations

### 7.1 Component Families In Scope

The audit must cover the following high-level surface families:

1. Slate context
   1. [SlateStripCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SlateStripCard.tsx)
   2. [web/pages/api/v1/start-chart.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/start-chart.ts)
2. Player opportunity
   1. [TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx)
   2. [web/pages/api/v1/forge/players.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/forge/players.ts)
   3. Yahoo ownership APIs and tables
3. Team context
   1. [TeamPowerCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TeamPowerCard.tsx)
   2. [web/pages/api/team-ratings.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/team-ratings.ts)
   3. [web/pages/api/v1/trends/team-ctpi.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/trends/team-ctpi.ts)
4. Sustainability
   1. [SustainabilityCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SustainabilityCard.tsx)
   2. [web/pages/api/v1/sustainability/trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/sustainability/trends.ts)
5. Trend movement
   1. [HotColdCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/HotColdCard.tsx)
   2. [web/pages/api/v1/trends/skater-power.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/trends/skater-power.ts)
6. Goalie risk
   1. [GoalieRiskCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/GoalieRiskCard.tsx)
   2. [web/pages/api/v1/forge/goalies.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/forge/goalies.ts)
7. Route previews and drill-ins
   1. [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)
   2. [team/[teamId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/team/[teamId].tsx)
   3. [player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/player/[playerId].tsx)

### 7.2 Cron And Freshness Expectations

1. Each component audit must identify the upstream jobs that keep the component current.
2. That job chain may include direct component feeds and upstream dependency feeds.
3. Runtime expectations must be documented where they materially affect dashboard freshness.
4. Components must not be marked `green` if their freshness depends on undocumented manual reruns.
5. Where cron ownership is missing or ambiguous, the audit must say so explicitly.
6. The audit must use the current cron guidance in [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md) as the baseline, then call out drift or gaps.

### 7.3 Source-To-UI Reconciliation

1. Every component must have a defined reconciliation method.
2. Reconciliation may happen at different layers:
   1. API response versus UI rendering
   2. normalized adapter output versus raw response
   3. API output versus authoritative source table
3. The reconciliation path must be specific enough that a junior developer could run it or implement it.
4. Components without a practical reconciliation path today must be called out as audit failures or gaps.

### 7.4 Health Output Format

The audit should produce one stable status record per component containing:

- component name
- route or page owner
- API owner
- source tables
- cron chain
- freshness state
- correctness state
- degraded-state quality
- observability state
- reconciliation state
- overall `green / yellow / red` status
- reason summary
- required fixes or checks

### 7.5 Follow-On Execution Model

1. After this PRD is approved, the next step must be generation of a task list for component-by-component validation and repair.
2. That task list should move through the components in a disciplined order rather than mixing unrelated fixes.
3. The execution of that task list must also maintain a second backlog for:
   1. newly discovered bugs
   2. optimizations
   3. missing observability
   4. cron or runbook cleanup
   5. correctness edge cases
4. The audit program should therefore be treated as:
   1. one planned remediation task list
   2. one rolling backlog of newly uncovered issues

## 8. Success Metrics

1. Every FORGE dashboard component in scope has a documented full-chain dependency record.
2. Every FORGE dashboard component in scope has a documented `green / yellow / red` status with reasons.
3. Every component has a documented source-to-UI reconciliation method.
4. Every component has a documented cron ownership path or an explicit automation gap.
5. The audit clearly distinguishes freshness issues, correctness issues, cron gaps, degraded-state issues, and observability gaps.
6. The resulting follow-on task list is actionable enough that a junior developer can work through components one by one without having to rediscover the operating model.
7. Newly discovered issues during follow-on work are captured into a separate backlog instead of being lost in thread history or artifact sprawl.
8. After the follow-on work completes, the FORGE dashboard should be able to justify each component’s trustworthiness with evidence rather than assumption.

## 9. Open Questions

1. Should the follow-on component health work remain document-first, or should it also create a lightweight internal status surface later if repeated checks prove too manual?
2. What exact runtime-budget thresholds should be enforced per component family where current jobs do not already have a known budget?
3. Should preview surfaces in [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx) inherit the same health status as their full dashboard counterparts, or should preview-specific degradations be tracked separately?
4. For mixed-source components such as team context or player opportunity, what is the final policy for partial freshness when one upstream feed is current and another is stale?
5. Which existing verification scripts can be reused directly for this audit, and which component families will need new checks?
