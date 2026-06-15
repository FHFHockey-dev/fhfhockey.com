# Goal: Complete the `/rankings` Analyst Workstation

Use high reasoning. Treat this as a product-completion task, not a small UI-only polish pass.

Build the Player Rankings ecosystem described in `tasks/TASKS/player-rankings-workstation/deep-research-report.md`, using the reference screenshots in `tasks/TASKS/player-rankings-workstation/assets/`:

- `target-mockup-fhfh-heatmap.jpeg`: desired dense dark heatmap + right player focus panel.
- `target-mockup-true-hockey-insights.jpeg`: desired workstation layout, sidebar/tabs, snapshot cards, advanced metric bars, trend panel.
- `current-state-fullpage.jpeg`: current `/rankings` state to replace; it is vertically long and developer-table-like.

The completed desktop page should feel like a finished one-screen analytics dashboard: all primary controls, matrix, selected-player/team/goalie snapshot, legend, and tab shell visible in one viewport. Avoid page-level vertical scrolling on desktop. Internal table/body regions may scroll horizontally or paginate, but the workstation frame should fit the screen.

## Work Mode

1. Inspect the repo, schema, existing API routes, existing analytics tables, and existing UI patterns first.
2. Look specifically for existing work around `/rankings`, contextual rankings, shift charts, line combinations, true goalie value, team rankings, metric glossary, cached snapshots, migrations, and test utilities.
3. Produce a short implementation plan before coding.
4. Implement in small, coherent steps.
5. Prefer additive, reversible migrations and repo-native patterns.
6. Add tests for schema, formulas, APIs, UI states, and responsive behavior.
7. Run targeted tests, lint, build, and broader test suites when feasible.

## Non-Negotiable Product Principles

- Rankings must be fast and mostly precomputed.
- Do not perform expensive raw-event aggregation from browser/page requests.
- Every metric must have clear denominator semantics.
- Every metric must expose raw value, raw rank, percentile, sample state, and methodology metadata where applicable.
- Use `dense_rank()` for raw rank semantics.
- Use percentile semantics suitable for user-facing “Xth percentile among peers”; prefer `cume_dist()` or equivalent ordered so better performance means higher percentile.
- Compute ranks/percentiles independently per metric.
- Support peer partitions by entity type, timeframe, strength, position group, and deployment bucket.
- Separate forwards and defensemen where appropriate.
- Low-sample outputs must be flagged, caveated, or excluded according to metric metadata.
- Never invent values. If a source is missing, implement a clear unavailable/source-pending state rather than fake numbers.
- Use methodology versions and updated timestamps for published outputs.

## In Scope

Implement the full Player Rankings ecosystem:

- `/rankings` one-screen analyst workstation UI.
- Skater rankings, composites, archetypes, and deployment buckets.
- Goalie rankings, goalie deployment buckets, and goalie-specific metrics.
- Team rankings/style rankings and team-style badges.
- Ranking matrix/table view.
- Metric Explorer tab.
- Deployment Tiers tab.
- Trending tab.
- Splits tab.
- Wins Above Replacement tab, if existing inputs or a reliable repo-native formula exist; otherwise implement the tab/contract/metadata with explicit source-pending state and no fake WAR values.
- MCM/BEAST composite and tiers.
- Luck Score / sustainability score.
- Offense Rating.
- Defensive Impact.
- Shoot First.
- Pass First.
- Play Driver.
- `skater_composite_ratings` population.
- Composite writers/recompute jobs using existing repo/Supabase patterns.
- Snapshot panels for skaters, goalies, and teams.
- Methodology/glossary metadata.
- Filter state, shareable URL state, loading/error/empty states.
- Tests and validation queries.

## Out of Scope / Stop Conditions

Do not proceed without direction if the work requires:

- destructive database changes;
- deleting or rewriting canonical raw data;
- a data-contract decision that cannot be inferred safely from existing repo patterns;
- paid/external data sources unavailable to the repo;
- security, RLS, or data-integrity risks;
- route/API behavior that clearly conflicts with existing consumers.

Do not stop merely because composites, goalies, teams, composite writers, or secondary tabs are involved. They are in scope.

## Data / Pipeline Architecture

Use existing schema where possible. Add only what is needed and keep migrations reversible.

Prefer these logical objects, adapted to existing naming conventions:

- `fact_skater_game`
- `fact_goalie_game`
- `fact_team_game`
- `fact_shot`
- `player_deployment_window`
- `goalie_deployment_window`
- `team_style_window`
- `skater_composite_ratings`
- materialized or cached leaderboard snapshots by entity + timeframe
- metric metadata/config table for labels, descriptions, formulas, denominators, weights, thresholds, sample requirements, directionality, and applicability

If equivalent tables already exist, extend/adapt them instead of duplicating.

Pipeline shape:

1. ingest/consume existing normalized game data;
2. classify deployment;
3. aggregate rolling windows and season-to-date windows;
4. calculate metric raw values;
5. calculate ranks and percentiles;
6. calculate composites/badges;
7. publish snapshot rows with methodology version and updated timestamp;
8. serve `/rankings` from snapshots/RPC/read APIs.

Use Supabase/Postgres-native patterns already present in the repo. If the repo uses cron, queues, Edge Functions, RPCs, materialized views, or background jobs, follow those patterns. Do not launch live backfills unless an existing safe backfill process exists; implement the writer/recompute infrastructure and document how to run it.

## Required Filters

Support, where applicable:

- entity type: skaters, goalies, teams
- timeframe: last 5 GP, last 10 GP, last 20 GP, season-to-date
- strength: all, EV, 5v5, PP, SH where supported
- player type / position group: forwards, defensemen, goalies
- deployment bucket
- team
- minimum GP
- minimum TOI
- sort metric
- search
- display mode: raw rank, percentile, both

Labels must be product-facing, not developer-facing. For example:

- `Team ID` -> `Team`
- `All` -> `All Skaters`, `All Teams`, or context-specific equivalent
- unimplemented or unavailable modes -> `Source Pending`, `Unavailable`, or disabled with explanation

## Rank and Percentile Semantics

- Use raw ranks and percentile ranks per metric.
- Partition by timeframe, strength, entity type, position group, and deployment bucket when filtered to peers.
- Support overall partitions without deployment filtering.
- Lower-is-better metrics must still map to positive percentile, where higher percentile means better peer standing.
- The left column must be clearly labeled as `Sort Rank`, `Rank by {Metric}`, or `Row` depending on semantics.
- Avoid initial loads dominated by tied bottom rows. Default sort should show useful players first.

Default skater matrix sort priority:

1. active sort metric percentile descending, if set;
2. `points_per_60` percentile descending;
3. `goals_per_60` percentile descending;
4. first available default metric percentile descending.

## Skater Deployment

Use existing `lineCombinations` or equivalent shift/line data.

Create smoothed EV deployment buckets:

- forwards: L1, L2, L3, L4
- defensemen: P1, P2, P3

Classify deployment from rolling recent-game EV usage and/or stable line/pair assignment, not one noisy game. Use fallback rules when line data is incomplete. Persist deployment per player per window.

## Goalie Deployment

Create netshare/startshare buckets within selected window:

- G1 Workhorse
- G1 Starter
- G1A Tandem Lead
- G1B Tandem Secondary
- G2 Backup
- G2 Reserve

Support injury/call-up logic where third/fourth goalies temporarily distort team denominator. If a call-up appears during a contiguous absence window for one of the top two goalies, compute primary tandem share using an eligible tandem denominator rather than total team games.

## Skater Metrics

At minimum implement live values, ranks, percentiles, sample states, and metadata for:

- goals/60
- assists/60
- points/60
- primary assists/60
- power-play points/60
- shots/60
- blocks/60
- hits/60
- ixG/60
- xGF/60 on-ice
- xGA/60 on-ice
- xGF%
- relative xGF%
- expected shooting percentage using `ixG / iFF` where supported
- shooting above expected using `G - ixG` or per-unblocked-shot equivalent
- Shoot First
- Pass First
- Play Driver
- Luck Score / sustainability score
- Offense Rating
- Defensive Impact
- MCM/BEAST

### MCM / BEAST

Implement as transparent percentile flags.

Peripheral categories:

- shots
- hits
- blocks

Scoring categories:

- goals
- primary assists
- points
- power-play points

Produce:

- peripheral flag count
- scoring flag count
- total flag count
- tier label
- supporting category list

Suggested configurable tiers:

- `BEAST`: at least 2 peripheral flags and at least 1 scoring flag
- `BEAST+`: at least 4 total flags with at least 1 from each family
- `BEAST Elite`: 5+ total flags

Make thresholds config-driven and visible in methodology.

### Offense Rating

Use a weighted percentile composite from available offensive metrics such as individual scoring rates, primary assists, shots/chances, ixG, on-ice xGF, PP production, and play-driving components. Keep weights configurable. Show component contributions.

### Defensive Impact

Use available defensive/suppression metrics such as xGA suppression, relative xGF/xGA, PK usage/impact, blocks where appropriate, takeaways if reliable, and contextual caveats. If inputs are unadjusted, label this as contextual defensive impact, not pure defensive talent.

### Shoot First

Use share of on-ice attempts where possible, such as `iCF / on_ice_CF` or `iFF / on_ice_FF`. Do not mix incompatible denominators.

### Pass First

Use primary assists and assist share of total points. Make the threshold configurable and show support metrics.

### Play Driver

Use goals + primary assists share, relative xGF/GF impact where available, and caveats for goal-only volatility.

### Luck Score

Compare current-window results to a prior non-overlapping baseline. Avoid target leakage by not including the selected current window in its own baseline. Use strength-specific baseline components where available. If 240-game or multi-season history is unavailable, compute a clearly labeled limited-baseline version or mark source pending.

## Goalie Metrics

At minimum implement:

- save percentage
- GSAA
- GSAx
- xGA against
- xGA per unblocked shot against
- quality start percentage
- really bad starts
- steals
- relative save percentage
- netshare/deployment bucket
- workload/context metrics where available
- Under Pressure quadrant/tag where data supports it

Goalie event definitions:

- support traditional quality-start compatibility mode;
- support modern xG mode where quality start can be `GSAx >= 0`;
- define steals as wins where GSAx exceeds game goal differential, if game-level inputs exist;
- define really bad starts by configurable save-percentage/GSAx thresholds.

## Team Rankings and Style Metrics

Implement team rankings/style descriptors, including:

- line rolling vs top-loaded usage
- pair rolling vs top-pair-heavy usage
- PP unit share
- shot quantity vs shot quality
- lucky/unlucky team
- high-event vs low-event
- run-and-gun profile
- one-goal game tendency
- home/road split
- rest-day split
- PP reliance / PP merchants
- discipline
- physicality
- period scoring profile
- control-play metrics such as CF%, xGF%, offensive zone time if available

Use score-and-venue-adjusted 5v5 metrics for team style whenever the repo supports them. Prefer `xGF / FF` for shot quality if xG is Fenwick-based. For team luck, prefer net goals above expected or finishing/save split context rather than directionally incorrect ratios.

## UI / UX Target

The desktop `/rankings` page should become a dense, polished, dark analyst workstation inspired by the two target screenshots. It should not feel like a developer validation table.

### Layout

- One-screen dashboard frame on desktop.
- Top header with title, context sentence, last updated, and key actions.
- Compact filter bar.
- Polished tab shell.
- Main content area split between matrix/table and right snapshot panel.
- Matrix scrolls horizontally inside its own region.
- Snapshot panel does not crush metric cells.
- Legend and density controls are visible without page-level scrolling.
- Tablet/mobile collapses the right panel into drawer or below-table card.

### Tabs

Implement or complete:

- Table / Matrix View
- Metric Explorer
- Deployment Tiers
- Trending
- Splits
- Wins Above Replacement
- Methodology / glossary access

If a tab’s underlying data is not yet available, the tab must still be product-quality and explain `Source Pending` rather than appearing broken or fake.

### Matrix Table

- Grouped metric headers.
- Sticky metric header where practical.
- Sticky/frozen identity columns where practical.
- Strong selected-row state.
- Better hover state.
- Reduced gridline noise.
- Stable horizontal scroll.
- Compact readable row height.
- Readable metric labels.

Identity columns:

- player / goalie / team
- team where applicable
- position
- GP
- TOI/G or workload equivalent
- deployment

### Metric Cells

Each metric cell should clearly show:

- percentile, with `%`;
- metric rank, with `#`;
- raw/formatted value;
- state indicators.

Preferred compact format:

```txt
40%
#460 · 9.81
```

Unavailable:

```txt
N/A
Source Pending
```

Planned/source-pending:

```txt
Source Pending
Needs pipeline
```

Low sample:

- keep the value visible;
- add a small warning indicator;
- provide tooltip/accessibility explanation.

### Color Scale

Use subtle heatmap bands:

- 95-100
- 90-94
- 80-89
- 60-79
- 40-59
- 20-39
- 0-19
- N/A

Lower-is-better metrics must color by positive percentile, not raw value. Reduce heavy borders and harsh red/orange pills. Color must not be the only cue.

### Snapshot Panel

Prioritize live data for selected skater/goalie/team.

Top section:

- identity
- team
- position/entity type
- deployment
- GP
- TOI/G or workload
- sample confidence

Then show:

- top strengths from available percentiles;
- weak spots;
- sample/source caveats;
- key advanced metric bars;
- trend/splits where available;
- Why He Stands Out / Why This Team Stands Out generated from available data only.

Composite cards must use real populated data or source-pending states. No temporary client-side fake approximations.

### Legend / Methodology

Legend must explain:

- color = percentile among qualified peers;
- stronger vs weaker peer rank;
- raw rank vs percentile rank;
- N/A;
- Source Pending;
- low-sample icon;
- stale-source icon if present;
- lower-is-better percentile behavior;
- deployment-relative vs overall ranking.

Methodology/glossary should expose metric formula, denominator, directionality, sample requirement, supported entity types, strength states, and last updated/methodology version.

## API / Contracts

Expose or update read endpoints/RPCs for:

- rankings list;
- available filters;
- metric metadata;
- methodology metadata;
- comparison payloads;
- selected-entity snapshot payload;
- trend/splits payloads where available.

Keep existing consumers compatible where possible. Add versioned fields rather than breaking contracts.

Each metric definition should include:

- key
- label
- short label
- description
- formula
- denominator
- higher_is_better
- percentile_direction
- sample requirement
- applicable entity types
- applicable strength states
- source status
- methodology version

## Tests

Add/update focused tests for:

- schema/migration validity;
- rank partitions;
- percentile direction and lower-is-better handling;
- denominator correctness;
- sample-threshold flags/exclusion;
- deployment classification for skaters;
- goalie netshare buckets;
- goalie injury/call-up denominator logic;
- composite writers;
- MCM/BEAST tiers;
- Offense Rating and Defensive Impact component weighting;
- Luck Score baseline exclusion of current window;
- API filter/metadata payloads;
- default sorting;
- rank/header semantics;
- metric cell live/unavailable/source-pending/low-sample/stale rendering;
- grouped headers;
- selected row state;
- snapshot updates;
- strengths/weakness generation;
- filter labels/context copy;
- legend rendering;
- responsive-safe layout behavior.

Run, as feasible:

- targeted rankings tests;
- relevant SQL/API/component tests;
- `npm run lint`;
- `npm run build`;
- `npm run test:full`.

If unrelated existing tests fail, record them clearly. Fix all failures caused by this work.

## Acceptance Criteria

- `/rankings` loads as a polished one-screen desktop analytics workstation.
- Initial load shows useful sorted leaders, not mostly tied bottom rows.
- Skater, goalie, and team views work.
- Matrix cells show percentile, rank, raw value, and state.
- Unavailable, source-pending, low-sample, stale, and true-zero states are distinct.
- Heatmap colors are readable, subtle, and semantically correct.
- Lower-is-better metrics color correctly by positive percentile.
- Snapshot panels prioritize live insights and caveats.
- MCM/BEAST, Luck Score, Offense Rating, Defensive Impact, Shoot First, Pass First, and Play Driver are implemented when source data supports them, otherwise explicit source-pending contracts exist with no fake values.
- `skater_composite_ratings` and composite writer/recompute path exist where appropriate.
- Deployment Tiers, Trending, Splits, and WAR tabs are product-quality and data-backed where possible.
- Methodology and legend are understandable.
- Desktop has no page-level vertical scroll for the main dashboard frame; tablet/mobile do not overlap or clip.
- Lint/build pass.
- Focused tests pass.

## Final Response Required From Codex

When finished, summarize:

1. What changed.
2. Schema/migration changes.
3. SQL/functions/materialized views or jobs added.
4. API changes.
5. UI changes.
6. Tests run and results.
7. Any explicit source-pending areas or follow-up decisions.
