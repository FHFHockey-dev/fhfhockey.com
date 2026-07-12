# Rankings Post-Alignment Gap Audit

## Executive Summary

The rankings ecosystem is now much closer to the original contextual hockey rankings vision than it was during the first audit. The page has live skater, goalie, and team ranking modes; durable skater `entity_metric_rankings`; skater snapshots and composite cards; goalie workload role context; team style/context metrics; durable `team_unit_toi`; visible source-state language; and broad test coverage across API, UI, methodology, and source-health scripts.

The remaining gap is no longer "the page is a basic leaderboard." The remaining gap is that several original-vision concepts are implemented as proxies, caveated descriptors, source-pending contracts, or partial-coverage signals. That is a valid product state, but it is not full parity with the original idea of an analyst-grade, deployment-relative, opportunity-aware rankings workstation.

The biggest current issues are:

1. Team unit metrics are published and rendered, but shareable URL state does not accept `forward_top_load_index`, `defense_pair_top_load_index`, or `pp1_pp2_usage_share`; direct URLs silently fall back to `off_rating`.
2. Skater archetypes, MCM/BEAST, defensive rating, and Results Luck are clearly documented, but several are still "current-contract" proxies instead of the exact original formulas.
3. Goalies are live, but the original Relative SV% and Under Pressure concepts remain source-pending.
4. Team style is useful and now includes unit usage, but it is still raw/contextual rather than score-, venue-, rest-, and opponent-adjusted coaching style.
5. Opportunity-change detection, one of the original prompt's highest-value features, is not yet present as a first-class ranking surface.
6. The new `team_unit_toi` aggregate is operationally live but not fully typed or scheduled like a mature pipeline surface.

## Source Materials Reviewed

- `tasks/TASKS/contextual-hockey-rankings/gpt-codex-suggested-prompt.md`
- `tasks/TASKS/contextual-hockey-rankings/prd-rankings-ecosystem-alignment-audit.md`
- `tasks/TASKS/contextual-hockey-rankings/workstation/context.md`
- `tasks/TASKS/contextual-hockey-rankings/workstation/Recommendations-DRR.md`
- `tasks/TASKS/contextual-hockey-rankings/workstation/deep-research-report.md`
- `tasks/TASKS/contextual-hockey-rankings/research/deep-research-report.md`
- `tasks/TASKS/contextual-hockey-rankings/tasks-prd-rankings-ecosystem-alignment-audit.md`
- Current implementation under `web/pages/rankings.tsx`, `web/components/Rankings/*`, `web/lib/rankings/*`, `web/pages/api/v1/contextual-rankings/*`, and the new `team_unit_toi` migration/writer/checker files.

## Original Objective Profile

The original objective was not just "rank NHL players." It was to build a contextual decision workstation that explains who is outperforming peers relative to opportunity, role, deployment, timeframe, and source confidence.

The intended user should be able to answer:

- Which skaters are best within their role, not just overall?
- Which players are getting better opportunity before the market reacts?
- Which players are shooting, passing, or driving play in a way raw points miss?
- Which recent production is skill-backed versus luck-driven?
- Which goalies are valuable relative to workload, team environment, and partner competition?
- Which teams and coaches create better fantasy environments through line rolling, top loading, PP usage, pace, discipline, and deployment patterns?
- Which rankings can be trusted immediately, and which are pending, proxy, low-sample, stale, or raw-context signals?

The original product shape implied five pillars:

1. **Contextual peer-group ranking**
   Rank skaters, goalies, and teams within meaningful contexts: position, deployment, goalie role, strength, team, timeframe, and sample thresholds.

2. **Role-relative interpretation**
   Highlight players who are valuable relative to deployment, not only top-line stars. L2/L3, P2/P3, PP2, PK, starter/tandem, and backup contexts should be usable peer groups.

3. **Analyst-grade derived metrics**
   Provide exact or explicitly versioned formulas for shoot-first/pass-first/play-driver profiles, MCM/BEAST, Results Luck, goalie relative value, team top-load/rolling style, and team game context.

4. **Data-pipeline durability**
   Precompute stable ranking windows and aggregates. Avoid raw play-by-play work on the page. Keep source contracts, methodology versions, and refresh paths visible.

5. **Actionable opportunity detection**
   Surface actionable changes such as TOI Up, PP1 Promotion, Line Promotion, Shot Volume Spike, Usage Drop, and starter-share changes.

## Current Ecosystem Profile

### What Is Now Strong

- The `rankings` page is a real workstation with entity modes for skaters, goalies, and teams.
- Skater matrix rows support contextual filters, metric groups, rank scopes, sample confidence, source caveats, snapshots, and composite cards.
- `entity_metric_rankings` is used as the preferred durable skater ranking source.
- Skater MCM/BEAST, offense rating, defense rating, archetype tags, and Results Luck have explicit methodology contracts.
- Goalie matrix rows include workload buckets, start-share context, SV%, GSAx, GSAA/60, xGA/Shot, Value Signal, HD SV%, quality starts, bad-start rate, steal rate, and role confidence.
- Team matrix rows include power ratings, raw 5v5 style, xGF%, shot quality, event rate, finishing/save/net luck, one-goal rate, home edge, PP opportunities, penalties, forward top load, defense pair top load, and PP1/PP2 usage share.
- `team_unit_toi` now provides durable live source rows for team unit usage.
- Source-pending and caveat states are intentionally preserved rather than hidden.
- The page includes snapshot panels and skater-only secondary tabs for metric explorer, deployment tiers, trending, splits, and WAR contract state.

### What Is Still Not Full-Parity

- Several user-facing features are "contract/proxy/live descriptor" implementations rather than the exact original formula.
- Skater secondary workflows are much richer than goalie/team secondary workflows.
- Team coaching-style interpretation is still primarily raw/contextual, not adjusted and validated as coaching behavior.
- Opportunity-change detection is not first-class.
- Some operational surfaces are still manually triggered or type-incomplete.

## Evidence From Runtime/UI Verification

Browser smoke test against `http://localhost:3102/rankings?entity=teams&team_metric=forward_top_load_index` showed:

- The page eventually hydrates into Team Rankings.
- Team unit columns render in the matrix: `Fwd Top Load`, `Pair Top Load`, and `PP1/PP2 Share`.
- The page displays broad caveat text for partial/pooled unit usage.
- Quick Info and sort state still show `Off Rating`, not `Forward Top Load`.

Targeted URL-state check confirmed:

```text
forward_top_load_index => off_rating
defense_pair_top_load_index => off_rating
pp1_pp2_usage_share => off_rating
```

This means backend and table rendering are ahead of the shareable URL/filter parser.

Browser console showed only a Next dev HMR warning, not an application runtime error.

## Priority Gap Findings

### P0 - Team Unit Metrics Are Live But Not URL-Restable

`availableFilters.ts` and `teamMatrix.ts` publish `forward_top_load_index`, `defense_pair_top_load_index`, and `pp1_pp2_usage_share` as available metrics. `parseTeamMatrixRequest` accepts them. The table renders them.

However, `rankingUrlState.ts` `parseTeamMetric` does not include those keys. Direct URLs, browser refreshes, and shared links normalize back to `off_rating`.

Impact:

- Users cannot reliably share or restore a team unit metric view.
- The UI can show the right columns but the active sort/Quick Info can contradict the URL.
- Source-health checks do not catch this because they only hit the team matrix with `off_rating`.

Evidence:

- `web/lib/rankings/rankingUrlState.ts`
- `web/lib/rankings/availableFilters.ts`
- `web/lib/rankings/teamMatrix.ts`
- Browser smoke test and targeted `ts-node` URL-state check.

### P0 - Team Unit Aggregate Is Live But Not Fully Typed

`teamMatrix.ts` queries `team_unit_toi` through `(supabase as any)`. `web/lib/supabase/database-generated.types.ts` does not include `team_unit_toi`.

Impact:

- Runtime works, but future refactors lose compile-time protection.
- Schema drift in `team_unit_toi` would not be caught as early as other Supabase table changes.
- This weakens the durability of one of the most important new alignment pieces.

Evidence:

- `web/lib/rankings/teamMatrix.ts`
- `web/lib/supabase/database-generated.types.ts`
- `web/supabase/migrations/20260622150500_create_team_unit_toi.sql`

### P1 - Skater Archetypes Remain Proxies

The original vision defined shoot-first, pass-first, and play-driver scores from explicit behavior shares and relative impact concepts. Current contracts label these as `current_proxy`.

Current rules use percentile thresholds such as:

- shot attempts high and primary assists below threshold for Shoot First Proxy
- primary assists high and shot attempts below threshold for Pass First Proxy
- on-ice xGF% plus shot/playmaking threshold for Play Driver Proxy

Impact:

- Useful tags exist, but they are not the original formula family.
- Users may treat the labels as exact if they do not open methodology details.
- The archetypes do not yet distinguish role-adjusted behavior share from pure rate/rank dominance.

Evidence:

- `web/lib/rankings/skaterCompositeMethodology.ts`
- `web/lib/rankings/skaterCompositeWriter.ts`
- `web/components/Rankings/PlayerSnapshotPanel.tsx`

### P1 - MCM/BEAST Still Excludes Original PP Points Component

The first pass intentionally resolved the mismatch by excluding `pp_points_per_60` and labeling it source-pending. That is honest and product-safe, but it is not original-vision parity.

Impact:

- MCM/BEAST is a current-contract fantasy multicategory composite, not the full original MCM formula.
- Power-play specialists can be underrepresented relative to the original definition.
- PP scoring contribution exists in other product areas, but not as verified contextual ranking rows for MCM.

Evidence:

- `web/lib/rankings/skaterCompositeMethodology.ts`
- `web/lib/rankings/metricDefinitions.ts`
- `web/lib/rankings/skaterCompositeWriter.ts`
- `web/lib/sustainability/entitySurfaceServer.ts` indicates PP points exist elsewhere, which may be a source candidate.

### P1 - Relative 5v5 GF% and xGF% Are Still Planned

The original Play Driver/Albatross concept depends on team-without-player baselines and relative impact. Current `relative_5v5_gf_percentage` and `relative_5v5_xgf_percentage` remain planned because the team-without-player baseline is not implemented.

Impact:

- The page ranks strong on-ice/contextual performance but cannot fully answer "what changes when this player is on the ice versus off?"
- Deployment-relative comparison exists, but true relative player impact does not.

Evidence:

- `web/lib/rankings/metricDefinitions.ts`
- `web/lib/rankings/matrixMetricRegistry.ts`
- `web/lib/rankings/skaterCompositeMethodology.ts`

### P1 - Defensive Rating Is Contextual, Not Adjusted Impact

The current defense rating uses suppression, on-ice process, and physical support components. It is explicitly marked with context-influenced/unadjusted caveats.

Research recommendations called for a split between descriptive windowed form and adjusted season-scale impact. The implementation has an adjusted-impact promotion contract elsewhere, but rankings promotion remains blocked by missing controls.

Impact:

- Defense Rating is useful as a descriptive/contextual signal.
- It should not be interpreted as isolated defensive talent.
- The original "perfectly enhance" target still needs an adjusted impact layer or clearer side-by-side separation between descriptive form and adjusted impact.

Evidence:

- `web/lib/rankings/skaterCompositeMethodology.ts`
- `web/lib/rankings/defensiveCompositeMethodology.ts`
- `web/lib/rankings/adjustedImpactPromotionContract.ts`
- `tasks/TASKS/contextual-hockey-rankings/workstation/Recommendations-DRR.md`

### P1 - Results Luck Is Live But Not the Entire Original Luck Story

The current Results Luck Index is a 100-centered composite with selected-window-excluded baseline requirements. That aligns with part of the ChatGPT suggested response, but the original product idea also framed luck/regression in simpler EV/PP and current-vs-baseline language.

Current strengths:

- It has leakage guards.
- It uses component-aware sources.
- It is sparse-live rather than faked.

Remaining gaps:

- Season rows can be null by design because selected-window exclusion does not apply cleanly.
- Users may need clearer "why null" explanation by cell, not only methodology.
- The page does not expose a simpler companion "Luck Score" or regression badge where the full index is unavailable.

Evidence:

- `web/lib/rankings/skaterCompositeMethodology.ts`
- `web/lib/rankings/resultsLuckSources.ts`
- `web/lib/rankings/skaterCompositeWriter.ts`
- `web/lib/rankings/playerMatrix.ts`

### P1 - Expected Shooting Denominator Is Still Marked Pending

`expected_shooting_percentage` is available, but its default denominator remains `unblocked_attempts_pending_confirmation`, and the description says denominator confirmation is pending.

Impact:

- xS% and SAX% are core finishing/sustainability metrics.
- If the denominator is not canonical, downstream composites and regression stories remain less trustworthy.
- The research recommendation specifically called for canonical shot-universe consistency.

Evidence:

- `web/lib/rankings/metricDefinitions.ts`
- `web/lib/rankings/skaterWindowAggregation.ts`
- `web/lib/rankings/metricDefinitions.test.ts`

### P1 - Goalie Relative SV% and Under Pressure Are Still Source-Pending

The current goalie surface is much richer than before, but two original concepts remain unavailable:

- Relative SV% versus team without the goalie
- Under Pressure profile/quadrant

Impact:

- Current goalie rankings are descriptive and workload-aware, but not fully context-relative.
- The original MVP-style goalie concept is approximated with Value Signal rather than exact relative team-without-goalie save percentage.

Evidence:

- `web/lib/rankings/goalieMatrix.ts`
- `web/lib/rankings/entityCoverageContracts.ts`
- `web/lib/rankings/availableFilters.ts`

### P1 - Team Coaching Style Is Raw/Contextual, Not Adjusted Coaching Trait

Team style currently uses raw/contextual 5v5 team style, team power ratings, WGO game context, and `team_unit_toi`. This is meaningful, but the methodology explicitly says it is not score- or venue-adjusted.

Original-vision team/coaching concepts still missing or incomplete:

- Score-adjusted 5v5 style
- Venue-adjusted style
- Rest/fatigue splits
- Period scoring splits
- PP dependency beyond PP opportunity and PP1/PP2 share
- Mistake capitalization
- Shot location/perimeter/slot/circles profile
- Offensive-zone time or sustained-pressure proxy
- Defenseman scoring and defense activation
- Shorthanded offense and PK aggression
- Opponent-adjusted style

Impact:

- The team page can describe environment but cannot yet confidently say "this coach/system causes X."
- Top-load and rolling-line metrics are live, but forward/defense coverage is partial and should be promoted cautiously.

Evidence:

- `web/lib/rankings/teamStyleMethodology.ts`
- `web/lib/rankings/teamMatrix.ts`
- `web/lib/rankings/entityCoverageContracts.ts`
- `tasks/TASKS/contextual-hockey-rankings/gpt-codex-suggested-prompt.md`

### P1 - Team Unit Usage Coverage Needs More User-Facing Precision

The durable aggregate has broad PP coverage, but forward-line and defense-pair usage are partial strict-overlap coverage:

- Forward line rows: 2,563 rows, 524 games, 31 teams
- Defense pair rows: 2,797 rows, 524 games, 31 teams
- Power play rows: 7,569 rows, 1,387 games, 32 teams

The UI shows broad partial-coverage caveats, but the matrix cells do not expose per-team/per-metric coverage thresholds prominently enough.

Impact:

- A team with no forward-line value shows N/A, but users may not know whether the team truly does not top-load or whether shift-resolution coverage is missing.
- Percentiles across partial samples can overstate precision.

Evidence:

- `web/lib/rankings/teamMatrix.ts`
- `web/lib/rankings/teamUnitToiBuilder.ts`
- `web/lib/rankings/teamUnitToiWriter.ts`
- `tasks/TASKS/contextual-hockey-rankings/tasks-prd-rankings-ecosystem-alignment-audit.md`

### P1 - Opportunity Change Detection Is Not First-Class

The original prompt explicitly called out:

- TOI Up
- PP1 Promotion
- Line Promotion
- Shot Volume Spike
- Usage Drop
- starter-share changes

The current Trending tab compares skater metrics across season/last20/last10/last5 and includes TOI deltas, but it is not a dedicated opportunity-change detection surface with typed events, thresholds, severity, and action labels.

Impact:

- The page explains who ranks well, but still under-delivers on "who should I act on before everyone else notices?"
- Users must infer opportunity changes from tables instead of seeing actionable flags.

Evidence:

- `web/lib/rankings/trending.ts`
- `web/components/Rankings/TrendingPanel.tsx`
- `tasks/TASKS/contextual-hockey-rankings/gpt-codex-suggested-prompt.md`

### P2 - Secondary Workflows Are Skater-Only

Skaters support Rankings, Metric Explorer, Deployment Tiers, Trending, Splits, and WAR contract state. Goalies and teams support Rankings and WAR contract state; other tabs render unsupported/source-pending states.

Impact:

- Entity coverage is asymmetrical.
- Team and goalie ranking modes are useful but not yet full workstations.
- Original idea included goalie/team context, not only skater context.

Evidence:

- `web/lib/rankings/availableFilters.ts`
- `web/pages/rankings.tsx`
- `web/components/Rankings/SplitsPanel.tsx`
- `web/lib/rankings/splits.ts`

### P2 - Comparison API Exists, But UI Is Not the Original Drawer

There is a versioned comparison API and skater split comparison surface. The original prompt called for an expandable explanation drawer and richer row-level comparison workflow.

Current UI has:

- Row selection
- Snapshot side panels
- `details` explanation in Metric Explorer rows
- Splits tables

Missing:

- A unified expandable row drawer across matrix rows
- Side-by-side selected entity comparison for skater/goalie/team matrices
- "Why this rank" explanations that combine raw value, peer context, deployment, source quality, and opportunity trend in one user-facing drawer

Evidence:

- `web/lib/rankings/comparison.ts`
- `web/pages/api/v1/contextual-rankings/comparison.ts`
- `web/components/Rankings/RankingsTable.tsx`
- `web/components/Rankings/PlayerMatrixTable.tsx`
- `web/pages/rankings.tsx`

### P2 - Methodology Dates and Historical Notes Are Slightly Stale

`teamMatrix.ts` still reports `methodologyUpdatedAt: "2026-06-21"` even though `team_unit_toi` went live on `2026-06-22`. The completed task list also contains chronological notes that are now superseded by later work.

Impact:

- Not a product blocker.
- It weakens trust in methodology metadata if users inspect dates.

Evidence:

- `web/lib/rankings/teamMatrix.ts`
- `tasks/TASKS/contextual-hockey-rankings/tasks-prd-rankings-ecosystem-alignment-audit.md`

### P2 - Source-Health Checks Do Not Cover Newly Added Edge Paths

`check-rankings-source-health.ts` covers skater matrix, several skater metric explorer paths, goalie matrix, and team matrix with `off_rating`. It does not cover:

- Team unit metric direct API checks
- Team unit metric URL restoration
- Goalie source-pending disabled-option behavior
- Results Luck sparse-live rows
- Team Home Edge and PP/penalty context metrics
- Snapshot panel selected-entity paths

Impact:

- Current checks can pass while shareable URL state or newly added metrics regress.
- The team unit URL bug would have been caught by an expanded source-health or URL-state test.

Evidence:

- `web/scripts/check-rankings-source-health.ts`
- `web/lib/rankings/rankingUrlState.test.ts`

### P2 - Pipeline Scheduling Is Still Manual/Endpoint-Oriented

The new `team_unit_toi` writer and admin endpoint make rebuilds possible, and the live upsert has been performed. The ecosystem still lacks a fully documented recurring production refresh path equivalent to mature scheduled aggregates.

Impact:

- Future snapshots depend on manual or external triggering unless a scheduler exists outside the repo.
- Stale unit usage could lag the rest of the page without a direct alert.

Evidence:

- `web/pages/api/v1/db/update-team-unit-toi.ts`
- `web/lib/rankings/teamUnitToiWriter.ts`
- `web/scripts/check-team-unit-toi-source-health.ts`

## Close-But-Not-Exactly Areas

These are not "bugs"; they are honest product compromises that should remain visible until replaced with exact implementations.

| Area | Current State | Original Target | Gap |
| --- | --- | --- | --- |
| Shoot First | Percentile proxy | Shot/assist/share formula | Proxy label is correct but not final |
| Pass First | Percentile proxy | Assist/share/playmaking formula | Proxy label is correct but not final |
| Play Driver | On-ice xGF% + action proxy | Relative GF/xGF/on-off driver | Missing team-without-player baseline |
| MCM | Six live components, PP points excluded | Full MCM including PP points | Needs verified PP points rows |
| BEAST | Current-contract gates | Original full category gates | Same PP component gap |
| Defense Rating | Contextual composite | Adjusted defensive impact | Missing promotion-ready adjusted layer |
| Results Luck | Sparse live 100-centered index | Full regression/luck story | Good core, limited explainability/null-state handling |
| Goalie Value | GSAx/GSAA Value Signal | Relative SV% MVP signal | Approximation until team-without-goalie baseline exists |
| Team Style | Raw/contextual 5v5 + unit usage | Adjusted coaching style | Needs score/venue/rest/opponent adjustments |
| Trending | Window deltas | Opportunity event detection | Needs typed opportunity signals |

## Non-Gaps From The First Audit That Are Now Closed Or Acceptable

- Team and goalie modes are no longer placeholder-only.
- Team source-pending contracts are empty; team context metrics have live sources.
- `team_unit_toi` exists and feeds visible team metrics.
- Home Edge now uses WGO point percentage joined to game venue identity.
- Goalie HD SV%, xGA/Shot, Value Signal, quality starts, bad starts, steal rate, and start share are live.
- Source-pending states are preserved instead of faked.
- WAR remains contract-only/source-pending, which is correct until a validated replacement-level model exists.
- The UI has visible source-state/caveat language across skater, goalie, and team matrices.

## Recommended Next Enhancement Themes

This section intentionally stays at product/PRD level rather than a task checklist.

### Theme 1 - Restore State Correctness

Make every published filter and metric key round-trip through:

- available filters
- URL parse/serialize
- API request path
- direct API parse
- matrix sort state
- Quick Info/methodology copy
- tests and source-health checks

Start with the three team unit metrics because they are currently user-visible and live.

### Theme 2 - Convert Proxies Into Original-Formula Metrics

Prioritize skater parity items:

- `pp_points_per_60` contextual rows for MCM/BEAST
- relative 5v5 GF% and xGF%
- exact shoot/pass/play-driver formulas
- canonical expected-shooting denominator
- better null-state explanations for Results Luck

### Theme 3 - Promote Adjusted Impact Carefully

Do not rename current contextual composites as adjusted impact. Instead, add a distinct adjusted-impact layer only after:

- rest/fatigue controls exist
- zone-start controls are joined
- opponent/teammate controls are verified
- defensive-specific target/decomposition is defined
- methodology and UI copy make the distinction clear

### Theme 4 - Make Opportunity Change Detection First-Class

Create a dedicated opportunity-change surface rather than relying on users to infer changes from Trending.

Target signals should include:

- TOI Up
- PP1 Promotion
- PP2 to PP1 threat
- Line Promotion
- Pair Promotion
- Shot Volume Spike
- Usage Drop
- Goalie starter-share rising/falling
- Team top-load change
- PP unit concentration change

### Theme 5 - Mature Team Coaching Style

Treat current team style as a strong MVP descriptor. The next level should add:

- score-adjusted 5v5 style
- venue adjustment
- rest and schedule context
- opponent adjustment
- period splits
- PP dependency and PK aggression
- shot-location profile
- defenseman-activation/scoring profile
- per-team unit usage coverage thresholds

### Theme 6 - Harden Data Operations

Bring the new aggregate and ranking surfaces in line with mature repo patterns:

- regenerate Supabase types for `team_unit_toi`
- remove `supabase as any`
- document or add scheduled refresh
- expand source-health checks
- update methodology dates automatically or explicitly during source changes

## Acceptance Criteria For "Original Vision Alignment"

The rankings ecosystem can be considered aligned with the original vision when:

1. Every visible metric and filter round-trips through URL state, API request paths, browser refresh, and source-health tests.
2. Any original metric concept is either exact, clearly renamed as a proxy, or hidden as source-pending.
3. Skater archetype tags use exact formula contracts or visibly remain "proxy" everywhere they appear.
4. MCM/BEAST includes PP points or is renamed/positioned as a current-contract variant everywhere.
5. Relative skater impact has team-without-player baselines for GF% and xGF%.
6. Goalie Relative SV% and Under Pressure either become live or remain disabled with no ambiguous "value" substitute.
7. Team style has adjusted and raw variants separated in the UI.
8. Opportunity-change detection exists as an actionable surface with typed signals.
9. Team unit usage exposes per-team/per-metric coverage, not only global caveats.
10. New ranking aggregates are typed, refreshable, monitored, and covered by source-health checks.

## Open Product Questions

1. Should MCM remain a current-contract six-component metric, or is PP points mandatory for the name to match the original idea?
2. Should Results Luck remain a single sparse-live index, or should the UI add a simpler regression badge when exact baseline requirements fail?
3. Should adjusted impact be a separate tab/metric group, or should it annotate existing offense/defense composites?
4. Should team unit metrics rank only teams above a minimum resolved-game coverage threshold?
5. Should opportunity-change detection be a new tab, a matrix badge layer, or part of the snapshot panel?
6. Should goalie/team secondary tabs be expanded now, or should the next pass focus only on skater parity and opportunity detection?

## Suggested First Follow-Up PRD Scope

The highest-leverage next PRD should target "Rankings Original Vision Parity Pass 2" with this scope:

- Fix URL/filter/source-health integrity for live metrics.
- Add exact skater role/archetype parity prerequisites.
- Add opportunity-change detection as a first-class surface.
- Mature team unit usage coverage and typed pipeline contracts.
- Keep adjusted impact and advanced team coaching style as gated follow-up unless the required source controls are already available.

