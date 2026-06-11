# Player Rankings Page Research Report

## Executive synthesis

Your concept is strong enough to become a flagship analytics page, but the hard part is not the leaderboard UI. The hard part is making every metric internally consistent across position, strength state, deployment bucket, and timeframe. Public hockey analytics already gives you the building blocks: on-ice and box-score data are widely standardized from the NHL play-by-play era, expected-goals models are typically built on unblocked shots, and public tracking/EDGE data now adds zone-time and location context. That means the product is absolutely feasible, but only if you treat denominator consistency, sample stabilization, and precomputation as first-class product requirements rather than implementation details. citeturn41view0turn7view0turn36view1

The single biggest improvement I would make to your vision is to split the page into two layers. The first layer should be a fast, sortable rankings interface with raw ranks, percentiles, deployment filters, and timeframe filters. The second layer should be an interpretive layer that explains *why* a player or team looks the way it does: archetype badges, offense/defense composites, usage context, luck or sustainability context, and comparison cards. NHL EDGE’s recent redesign points in exactly this direction, emphasizing daily updates, universal search, player comparisons, contextualized player/team pages, and visual storytelling rather than a bare spreadsheet. citeturn36view0turn36view1

If you want the page to feel trustworthy, use percentile semantics that align with user intuition. In PostgreSQL, `percent_rank()` is mathematically `(rank - 1) / (rows - 1)`, while `cume_dist()` gives the share of rows at or below the current row. For end-user phrases like “84th percentile among second-line forwards,” `cume_dist()` is usually the better fit, while `dense_rank()` is cleaner for raw rank because it avoids gaps after ties. citeturn29view0

## What is already strong in your vision

You are already thinking the right way about hockey context. Separating forwards from defensemen, separating by deployment, and letting the user switch between rolling windows such as last 5, 10, or 20 games versus season-to-date is exactly the sort of contextual framing that makes rate stats meaningful instead of misleading. Hockey analytics sites already rely heavily on rate stats, xG shares, deployment/usage, and positional baselines; Evolving-Hockey explicitly positions rate stats and positional comparisons as core tools for comparing players with different workloads, and it centers some evaluation views around positional means. citeturn41view0turn43view0

Your instinct to build fun taxonomy on top of the math is also excellent. “BEAST,” “MCM,” “shoot-first,” “pass-first,” “play driver,” “albatross,” “PP merchants,” and “run-and-gun” are good editorial choices because they turn a stat table into a product identity. NHL EDGE’s public-facing design leans the same way: it packages complex tracking data into approachable, story-like concepts, searchable comparisons, and glanceable rankings instead of requiring the user to know every acronym before they get value. citeturn36view0turn36view1

You also have a realistic data foundation for this. Public on-ice event and shift-era analysis effectively starts in the 2007-08 NHL play-by-play/RTSS era for many public models, and NHL EDGE’s player-and-puck-tracking public view adds a second data layer beginning with 2021-22, refreshing overnight because of the complexity of the calculations. That gives you a strong “historical + modern tracking” roadmap if you want phase one to be RTSS-based and phase two to add tracking-enriched features. citeturn41view0turn36view1

## Gaps that need explicit product decisions

The biggest logical gap is denominator mismatch. Evolving-Hockey defines skater `ixG` as the total expected goals of all individual **Fenwick** shots, and goalie `xGA` as the total xG value of all **Fenwick** shots against. That means formulas like `xG / Shots` or `xGA / Shots Against` are only coherent if your denominator uses the same shot universe. If you keep standard shots-on-goal as the denominator, you are mixing models built on unblocked attempts with a denominator that excludes misses. For skaters, the clean public equivalent of “expected shooting percentage” is `ixG / iFF`; for goalies, the clean public equivalent of “xGA per shot against” is `xGA / FA`, which is already embedded in expected Fenwick save percentage concepts. citeturn13view0turn13view1turn41view0

The second gap is sample stability. Evolving-Hockey explicitly warns that rate stats become unstable in low-playing-time situations and recommends using cutoffs. It also regresses low-TOI players to average in GAR via explicit TOI thresholds. If you use only a minimum games-played filter, a player with five games and tiny EV usage can still surface as a leaderboard outlier. I would treat TOI, shot volume, and event counts as mandatory quality controls alongside GP, and I would visually flag unstable samples instead of simply hiding them. citeturn41view0turn32view0

The third gap is defensive evaluation. Raw on-ice defensive numbers are influenced by teammates, opponents, zone starts, score state, and rest context. Evolving-Hockey’s RAPM framework exists specifically because raw on-ice numbers have those issues, and it adjusts for teammates, opponents, score state, zone starts, and back-to-backs. So if you calculate “overall defense rating” from unadjusted on-ice xGA or GA rates, you should label it as **defensive impact in context**, not a pure talent score. If you want a stronger long-term product, a RAPM-like or GAR-like adjusted layer should eventually sit behind your offense/defense composites. citeturn43view0

The fourth gap is scorekeeper and rink effects. Schuckers and Macdonald’s work on NHL RTSS data found significant and consistent rink effects for certain recorded events. That matters directly for the categories you want to use most for fantasy-style peripheral rankings, especially hits, blocks, giveaways, and takeaways. Those metrics are still useful, but they should either be rink-adjusted, explicitly caveated, or excluded from any “precision” composite that claims to measure player quality. citeturn33search7

The fifth gap is “luck” leakage. Your current baseline logic includes current-season data in the baseline while also comparing current results to that baseline. That dampens your signal because the hot or cold stretch you are trying to detect is partially included in the baseline you are comparing against. I would compute a baseline from the *prior* rolling history excluding the currently selected window, then compare the selected window to that frozen prior baseline. That is a design recommendation rather than a published standard, but it follows the general statistical logic behind avoiding target leakage.

## Recommended metric framework

Below is the framework I would ship in phase one. The mathematical basis comes from public definitions for xG, Fenwick, GSAx, GSAA, rate stats, relative metrics, and RAPM; the formulas themselves are product recommendations tuned for your page. citeturn41view0turn13view0turn13view1turn14view0turn43view0

| Concept | Recommended design |
|---|---|
| Raw rank | `dense_rank()` within `(position_group, deployment_bucket, strength_state, timeframe)` |
| Percentile | `100 * cume_dist()` within the same partition, ordered so “better” is higher |
| Deployment bucket | Use a rolling EV deployment classifier, smoothed across recent team games, not a single-game line label |
| Sample eligibility | Require minimum GP **and** minimum TOI **and** minimum event denominator such as shots/unblocked shots |
| Offense rating | Weighted percentile composite of adjusted on-ice chance creation plus individual scoring/playmaking |
| Defense rating | In phase one, call it **Defense Impact** and weight adjusted suppression/relative share metrics more than raw blocks/hits |
| Luck / sustainability | Compare current-window finishing and involvement to a prior, non-overlapping baseline |

For skaters, I would tighten your custom metrics like this. First, keep your deployment-bucket idea, but smooth it. A single game can mislabel a player because of injuries, in-game benching, or line blender behavior. I would classify deployment from a short rolling average of EV TOI share and common linemate usage rather than a one-game snapshot. Second, for “shoot-first,” use a share-of-on-ice-attempts measure such as `iCF / on_ice_CF` or `iFF / on_ice_FF`; Evolving-Hockey exposes both individual and on-ice Corsi/Fenwick definitions, which makes this internally coherent. Third, rename your expected shooting idea to match the denominator: if you use public xG, prefer `xFSh% = ixG / iFF`, and use either `G - ixG` or `(G / iFF) - (ixG / iFF)` for finishing above or below expected. Fourth, for “play driver,” I would not rely only on relative GF%; relative-to-team concepts are useful, but xG-based relative measures are more stable than goals alone, and RAPM-like adjusted measures are even better if you can support them later. citeturn13view0turn14view0turn41view0turn43view0

For your novel multi-cat metric, the best version is transparent and percentile-based. I would define three **Peripheral** flags from percentile thresholds in Shots, Hits, and Blocks, and four **Scoring** flags from Goals, Primary Assists, Points, and Power-Play Points. Then publish both the raw seven-category flag count and a named tier. For example: **BEAST** = at least two Peripheral flags and at least one Scoring flag; **BEAST+** = at least four total flags with at least one flag from each family; **BEAST Elite** = five or more total flags. The trick is to keep percentile bands visible to the user so the badge feels explainable instead of whimsical.

For goalies, I would keep your netshare/deployment idea but simplify the bucket taxonomy slightly and formalize the injury exception logic. Use starts share over the selected window, but define an “eligible tandem denominator” that excludes emergency-callup goalies if the third goalie’s usage occurred during a contiguous absence window for one of the top two goalies. For goalie performance, keep GSAx and GSAA as anchor metrics because those definitions are already standard in public hockey analytics. Then expose two quality-start views: a compatibility view with the classic Hockey-Reference/Rob Vollman quality-start family and really-bad-start family, and a modern view where `GSAx >= 0` is a quality start and `GSAx > goal differential in a win` is a steal. Your “Under Pressure” quadrant is also good product design if your source supports danger-state save splits. citeturn13view1turn17search7turn18view1turn17search19

For teams, the main recommendation is to use **score- and venue-adjusted 5v5 metrics** for anything you want to describe as “style.” Evolving-Hockey explicitly notes that teams play differently by score and venue, and adjusting for that is important because score effects change shot and event rates. So use adjusted 5v5 xG share, attempt share, and event rates for coach/style descriptors. I would also change a few formulas. Your “shot quality” formula should be `xGF / FF` rather than `xGF / CF`, because xG is built on Fenwick shots. Your “lucky team” formula should not add `GA/xGA`, because allowing *more* goals than expected is the wrong direction; instead use something like `Net Goals Above Expected = (GF - xGF) + (xGA - GA)` or a finishing/save split plus PDO-style context. And your “run and gun” idea works better as a two-axis label: **Event Rate** = `xGF + xGA`, **Control** = `xGF%`, with “run and gun” reserved for teams that are high on event rate and near the middle on control. citeturn41view0turn35search0turn35search3turn26search17

## Data model and prerequisites

The page should only exist on top of a deliberate warehouse-style schema. At minimum, you need reliable game metadata, player/team dimensions, position groups, shift data, line/pair assignments, player-game box events, shot-level event data with coordinates and strength state, on-ice stint data or derivable on-ice joins, goalie start/appearance data, and team-game context such as home/road, rest days, and score state. Public xG models are built from unblocked shots with shot features such as distance, angle, shot type, prior events, and game state, so if you will calculate xG yourself rather than ingest it, your shot table needs those fields normalized cleanly. citeturn41view0turn40search15

I would normalize the database into the following core objects:

| Table | Purpose | Must-have fields |
|---|---|---|
| `dim_game` | canonical game record | `game_id`, `season`, `date`, `home_team_id`, `away_team_id`, `playoff_flag`, `rest_days_home`, `rest_days_away` |
| `dim_player` | canonical player record | `player_id`, `name`, `position_group`, `shoots`, `team_id_current` |
| `fact_shot` | one row per shot attempt | `game_id`, `event_id`, `team_id`, `player_id`, `strength_state`, `shot_type`, `x`, `y`, `is_goal`, `is_on_goal`, `is_blocked`, `is_missed`, `rebound_flag`, `rush_flag`, `xg` |
| `fact_skater_game` | one row per skater per game | `game_id`, `player_id`, `team_id`, `toi_ev`, `toi_pp`, `toi_sh`, `goals`, `assists`, `primary_assists`, `points`, `pp_points`, `shots`, `fenwick`, `corsi`, `hits`, `blocks`, `giveaways`, `takeaways` |
| `fact_goalie_game` | one row per goalie appearance/start | `game_id`, `player_id`, `team_id`, `started_flag`, `toi`, `sa`, `fa`, `ga`, `xga`, `gsax`, `gsaa`, `win_flag` |
| `bridge_line_assignment_game` | per-game deployment input | `game_id`, `player_id`, `ev_unit_label`, `avg_ev_toi`, `pp_unit_label`, `pk_unit_label` |
| `fact_team_game` | team-style layer | `game_id`, `team_id`, `gf`, `ga`, `xgf`, `xga`, `cf`, `ca`, `ff`, `fa`, `ppg`, `pp_opp`, `pkg_allowed`, `hits`, `blocks`, `pen_taken`, `pen_drawn`, `ot_flag`, `one_goal_game_flag` |
| `mv_window_metrics_*` | precomputed leaderboard outputs | ranks, percentiles, bucket IDs, composite ratings, stability flags, updated timestamps |

Two prerequisites are easy to underestimate. The first is **primary assist derivation**. NHL goal scoring officially allows up to two assists, which means primary versus secondary assist can be reconstructed if your play-by-play source preserves assist order. The second is **event-quality governance**. Because public RTSS event recording can have rink effects for hits, blocks, giveaways, and takeaways, I would store both raw counts and an “adjusted/caveated” flag so the UI can tell the user which metrics are more sensitive to scorer bias. citeturn22search0turn33search7

## Pipeline and performance architecture

A page like this should be built as a precomputed analytics product, not as live ad hoc SQL over raw game tables. PostgreSQL’s materialized views persist query results in table-like form, and `REFRESH MATERIALIZED VIEW CONCURRENTLY` lets you refresh without blocking concurrent reads, although that requires at least one qualifying unique index and only one refresh can run at a time per materialized view. That makes materialized views a very good fit for your last-5, last-10, last-20, and season-to-date leaderboard snapshots. citeturn11view1turn11view0

For scale, partition your largest fact tables by season or game date. PostgreSQL’s partition pruning exists specifically to improve performance on declaratively partitioned tables, and Supabase’s own partitioning guidance recommends partitioning large tables to improve performance and simplify management. On top of that, use multicolumn indexes for your dominant filters, partial indexes for hot slices such as active seasons or public rows, and expression indexes for repeated computed predicates. Index-only scans become attractive when the query can be satisfied from the index alone, which is common for leaderboard-style reads. Also index every foreign key and every non-PK column used in RLS policies or frequent joins. citeturn11view2turn11view3turn11view4turn11view5turn30view0turn28search10

For orchestration, Supabase gives you everything you need inside the platform. Supabase Cron can schedule recurring jobs from every second to once a year, and the hosted platform supports `pg_cron` plus `pg_net` to invoke Edge Functions on a schedule. Database Webhooks are asynchronous wrappers around triggers, and Supabase Queues/`pgmq` provide durable background queues with guaranteed delivery and retryable jobs. The practical design is: ingest a completed game, normalize it, enqueue affected entities, recompute only the touched windows, then refresh the relevant materialized views or summary tables. Store secrets in Vault, protect public tables with RLS/least privilege, and keep long-running recomputations off the browser/client path because Supabase client and dashboard queries have a 60-second max-configurable timeout. Monitor the whole thing with `pg_stat_statements`, which Supabase ships by default for query-performance monitoring. If the page becomes traffic-heavy, use read replicas so analytical reads do not contend with writes on your primary database. citeturn11view6turn11view7turn11view8turn11view9turn38search0turn38search1turn38search5turn38search7turn38search8turn31search4turn31search6

My recommended pipeline is therefore simple in shape even if the SQL is not: raw game ingest, event normalization, deployment classification, rolling-window aggregation, percentile/rank calculation, composite/badge calculation, published snapshot. Keep the raw data immutable, make derived tables versionable, and attach an `updated_at` plus `methodology_version` to every published snapshot so you can change formulas without confusing users.

## Codex-ready PRD prompt

OpenAI’s own Codex guidance is highly aligned with what you need here: for difficult work, ask Codex to plan first; put instructions at the beginning; be specific about output format and constraints; and keep reusable repo-specific guidance in `AGENTS.md`, which Codex reads before it starts work. citeturn12view1turn12view2turn37view0turn12view0

```md
You are Codex acting as a senior full-stack product engineer and analytics engineer.

Task:
Design and implement a new “Player Rankings” analytics page and its supporting database layer for an NHL analytics website powered by Supabase/Postgres.

Work mode:
1. Start in plan mode.
2. Produce a short implementation plan before coding.
3. Then implement the plan in small, reviewable steps.
4. Preserve existing app conventions and do not break existing pages.
5. Add tests and validation queries for all new metric pipelines.

Product intent:
Create a high-performance rankings page for skaters, goalies, and teams that supports:
- raw ranks
- percentile ranks
- timeframe filters
- deployment filters
- position-aware comparisons
- offense and defense composites
- fun archetype badges
- methodology transparency

Core product principles:
- Rankings must be fast and mostly precomputed.
- Every metric must use a denominator consistent with its source data.
- Skaters and defensemen must usually be separated.
- Deployment buckets must be stable and smoothed, not based on one noisy game.
- Low-sample outputs must be flagged or excluded.
- Public-facing labels should be intuitive even when backend math is advanced.

Scope:
Build:
- database schema additions
- SQL functions/views/materialized views
- backend read APIs
- frontend rankings page
- methodology tooltip/content
- tests
- migration scripts

Do not build:
- a full custom xG model from scratch unless required by existing codebase
- unbounded live aggregation directly from raw play-by-play tables
- opaque black-box ratings with no explanation

Required filters:
- entity type: skaters | goalies | teams
- timeframe: last 5 GP | last 10 GP | last 20 GP | season to date
- strength state where relevant: all | EV | 5v5 | PP | SH
- position group: F | D
- deployment bucket
- minimum GP
- minimum TOI
- sort metric
- display mode: raw rank | percentile | both

Required skater deployment logic:
Use existing `lineCombinations` data.
Create smoothed EV deployment buckets:
- forwards: L1, L2, L3, L4
- defensemen: P1, P2, P3

Implementation guidance:
- classify deployment from rolling recent-game EV usage, not a single-game label
- use fallback rules when line data is incomplete
- persist deployment per player per window

Required goalie deployment logic:
Create netshare buckets based on starts share within the selected window, with support for injury/call-up scenarios where a third goalie temporarily distorts team-game denominator.
Recommended buckets:
- G1 Workhorse
- G1 Starter
- G1A Tandem Lead
- G1B Tandem Secondary
- G2 Backup
- G2 Reserve

Required rank semantics:
- use `dense_rank()` for raw rank
- use `cume_dist()` for percentile-style output
- compute rank/percentile per metric independently
- compute within partitions defined by timeframe + strength state + position group + deployment bucket
- support “overall” partitions without deployment filter too

Required skater metrics:
At minimum support:
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
- shoot-first share
- pass-first indicators
- play driver indicators
- luck/sustainability score
- offense rating
- defense impact rating
- novel multi-cat badge metric

Required formula guidance:
- use xG on unblocked-shot denominators
- expected shooting percentage should be based on `ixG / iFF`
- “shooting above expected” should be `G - ixG` or the per-unblocked-shot equivalent
- avoid mixing xG with shots-on-goal denominators unless an on-goal expected-shot model already exists

Novel multi-cat badge:
Implement a transparent percentile-flag system:
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
- total flags
- peripheral flags
- scoring flags
- tier label

Suggested tiers:
- BEAST
- BEAST+
- BEAST Elite

Make thresholds config-driven.

Required goalie metrics:
At minimum support:
- save percentage
- GSAA
- GSAx
- xGA against
- xGA per unblocked shot against
- quality start %
- really bad starts
- steals
- relative save percentage
- offense-independent workload/context metrics where data allows
- “under pressure” style quadrant tags if data supports it

Goalie event definitions:
- traditional quality start compatibility mode
- modern xG mode where quality start can also be derived from GSAx >= 0
- steals based on GSAx exceeding game goal differential in wins
- really bad starts based on save percentage threshold

Required team metrics:
Support style badges / descriptors for teams, including:
- line rolling vs top-loaded usage
- pair rolling vs top-pair-heavy usage
- PP unit share
- shot quantity vs shot quality
- lucky/unlucky team
- high-event vs low-event
- one-goal game tendency
- home/road split
- rest-day split
- PP reliance
- discipline
- physicality
- period scoring profile
- control-play metrics (CF%, xGF%, offensive zone time when available)

Important methodology rule:
For “team style” use score-and-venue-adjusted 5v5 metrics whenever possible.

Recommended database objects:
- fact_skater_game
- fact_goalie_game
- fact_team_game
- fact_shot
- player_deployment_window
- goalie_deployment_window
- team_style_window
- materialized leaderboard snapshots by entity + timeframe
- config table for thresholds, labels, and weights

Performance requirements:
- use partitioned fact tables where appropriate
- precompute window snapshots
- avoid browser-triggered expensive queries
- add the right multicolumn/partial/expression indexes
- keep queries explainable and measurable
- use concurrent refresh where appropriate
- support incremental recomputation after new game ingestion

Operational requirements:
- use Supabase cron / queues / edge functions if needed for async recompute
- store secrets safely
- respect RLS and least-privilege access patterns
- include updated timestamps and methodology versions in published outputs

Frontend requirements:
Build a rankings page with:
- fast table rendering
- sticky filters
- sortable columns
- rank + percentile display
- player/team search
- comparison drawer
- methodology tooltip / glossary
- stability badge for low samples
- shareable URL state
- mobile-friendly condensed cards
- empty/loading/error states

Page sections:
- skaters
- goalies
- teams
- methodology
- comparisons

UI behavior:
- separate F and D by default where appropriate
- clearly indicate whether results are overall or bucket-relative
- clearly indicate denominator and strength state in every metric tooltip
- expose both serious metric names and fun badge names
- include “last updated” timestamp

API/contract requirements:
Expose read endpoints or RPCs for:
- rankings list
- available filters
- metric metadata
- methodology metadata
- comparison payloads

Each metric definition should include:
- metric key
- label
- description
- formula
- denominator
- higher_is_better boolean
- sample requirement
- applicable entity types
- applicable strength states

Testing requirements:
Add:
- SQL unit tests where appropriate
- deterministic fixture tests for rank partitions
- tests for denominator correctness
- tests for deployment classification
- tests for goalie injury/call-up denominator logic
- tests for sample-threshold exclusion
- frontend tests for filters and sorting

Acceptance criteria:
- rankings page loads quickly from precomputed data
- rank and percentile values are stable and correct
- no denominator mismatches remain
- skater, goalie, and team views all work
- methodology is visible and understandable
- code is production-ready and documented
- migrations are reversible
- tests pass

Output format:
1. Plan
2. Schema/migration changes
3. SQL/functions/materialized views
4. API changes
5. Frontend implementation
6. Tests
7. Follow-up notes and tradeoffs

Before coding:
Inspect the repository and existing schema first.
Look for existing pages or tables related to:
- shift charts
- line combinations
- true goalie value
- leaderboard patterns
- metric glossary
- cached analytics snapshots

If an `AGENTS.md` file does not exist, propose one and add a concise repo-specific version.
```

## Open questions and limitations

The remaining unresolved items are product decisions, not feasibility blockers.

- You need to decide whether offense/defense composites are **descriptive impact scores** in phase one or whether you want to invest immediately in an adjusted RAPM/GAR-style layer for stronger talent inference. Public methodology strongly suggests the latter is better for defensive evaluation, but it also adds pipeline complexity. citeturn43view0
- You need to decide whether your xG/GSAx layer is computed in-house, imported from an existing internal page like `/trueGoalieValue`, or derived from a licensed/public model. That choice determines how much of the schema should be shot-level versus aggregate-level.
- You should decide whether rink-effect-sensitive categories such as hits, blocks, giveaways, and takeaways are eligible for flagship composite ratings or only for fun/editorial badges. Public RTSS rink-effect research suggests caution. citeturn33search7
- You should decide whether deployment is based on all situations, EV only, or separate EV/PP/PK contexts. My recommendation is EV-only for line/pair deployment, with PP/PK handled as separate usage badges rather than the same bucket system.