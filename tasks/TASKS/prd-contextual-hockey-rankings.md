# PRD: Contextual Hockey Rankings

**Feature name:** Contextual Player, Goalie, and Team Style Rankings  
**Target route:** `/rankings`  
**Document status:** Draft - deep-research aligned 2026-06-06  
**Created:** 2026-06-04  
**Primary implementation focus:** Skater rankings MVP, with database/API structure prepared for goalies, team style, and advanced archetypes.

---

## 1. Introduction / Overview

The rankings page should become a contextual hockey intelligence engine, not just a static leaderboard.

The core user problem is that traditional hockey leaderboards answer only, “Who ranks highly overall?” They do not answer the more useful question:

> “Who ranks highly relative to their role, deployment, position, timeframe, opportunity, and team environment?”

This feature will create a rankings ecosystem for skaters, goalies, and teams. It will allow users to evaluate players and teams across dynamic peer groups such as position, deployment bucket, strength state, timeframe, and minimum sample size.

The first shippable version should prioritize skater rankings. It should include the data architecture, metric registry, skater window aggregates, deployment buckets, rank/percentile calculations, and a usable `/rankings` UI. Later phases should add MCM / BEAST scoring, advanced skater archetypes, goalie rankings, goalie deployment, team style, and opportunity-change detection.

A target plain-English output for the page is:

> “This skater ranks 23rd among qualified L2 forwards in SOG/60 and is in the 84th percentile among L2 forwards over his last 10 games played.”

Deep-research alignment update: the product should have two layers. The first layer is a fast sortable ranking table. The second layer is an interpretive layer with badges, composites, usage/luck explanations, comparison cards, and methodology details. The implementation must be conservative about denominator matching, source-data quality, rink/scorekeeper effects, and low samples; misleading precision is worse than an unavailable or caveated metric.

---

## 2. Goals

1. **Create a contextual rankings page** where users can rank skaters, goalies, and teams by selected metrics and peer groups.
2. **Ship a skater-first MVP** that supports filters for season, timeframe, position, deployment, strength state, minimum sample, and team.
3. **Calculate raw rank and percentile rank server-side**, not in the React table, so the frontend remains fast and consistent.
4. **Define every metric in a central metric registry** so formulas, descriptions, denominators, applicable strength states, directionality, methodology version, source-quality caveats, and minimum samples are not hardcoded only in frontend components.
5. **Use deployment-aware peer groups** so users can identify players who stand out relative to role, such as L3 forwards on PP2 or P2 defensemen with strong shot volume.
6. **Make ranking context explicit** by showing the selected peer group, timeframe, sample size, and whether higher or lower raw values are better.
7. **Label low-sample players clearly** so users can see interesting outliers without mistaking noise for reliable signal.
8. **Prepare for advanced fantasy-relevant archetypes**, including MCM / BEAST, Shoot-First, Pass-First, Play Driver, Results Luck Index, Goals Above Expected, Unrealized xG, xS%, and SAX%.
9. **Prepare for goalie and team-style expansion** without requiring a full rewrite of the data model or frontend route.
10. **Support shareable URLs** so users can bookmark and share exact ranking states.

---

## 3. Product Scope and Phasing

This PRD covers the full contextual rankings ecosystem, but delivery should be phased.

### 3.1 Phase Summary

| Phase | Name | Main Deliverable | Included in First Shippable Release? |
|---|---|---:|---:|
| Phase 1 | Skater Rankings MVP | Metric registry, skater aggregates, deployment windows, rank/percentile table or RPC, `/rankings` UI | Yes |
| Phase 2 | MCM / BEAST | Multi-category fantasy score and BEAST tier badges | No, but architecture must support it |
| Phase 3 | Advanced Skater Archetypes | Shoot-First, Pass-First, Play Driver, Results Luck Index, xS%, SAX%, Goals Above Expected, Unrealized xG | No, planned |
| Phase 4 | Goalie Rankings | G1/G2 buckets, netshare, GSAx, quality starts, steal games, relative SV% | No, planned |
| Phase 5 | Team Style Rankings | Rolling lines, top loading, PP usage, shot quality/quantity, run-and-gun, team luck, physicality, discipline | No, planned |
| Phase 6 | Opportunity Change Detection | TOI spikes, line promotion, PP promotion, goalie role changes | No, planned |

### 3.2 First Shippable Release

The first production version should include:

- `/rankings` route.
- Skater entity type only, with UI structured to support future entity types.
- Core skater metrics.
- Season-to-date, last 5, last 10, and last 20 player-game windows for player production rankings.
- Deployment calculated using team-window logic.
- Position and deployment peer groups.
- Raw rank and percentile rank.
- Sample-size labels.
- Shareable URL query params.
- Basic explanation text per row.

### 3.3 Later Release Planning

Later releases should add:

- MCM Score and BEAST Tier.
- Advanced skater archetype tags.
- Goalie rankings and goalie deployment.
- Team style rankings.
- Opportunity-change detection alerts.
- Comparison mode and fantasy scoring lenses.

---

## 4. Key Definitions

### 4.1 Ranking Context

Every ranking must be calculated within an explicit context. At minimum, the system should be able to represent:

```ts
entity_type: "skater" | "goalie" | "team"
position_group: "ALL_SKATERS" | "F" | "D" | "G" | "TEAM"
strength_state: "all" | "5v5" | "ev" | "pp" | "pk"
window: "season" | "last_5" | "last_10" | "last_20" | "last_40" | "past_240_games"
window_semantics: "player_last_n_games_played" | "team_last_n_games" | "season_to_date"
peer_group_type: "league" | "position" | "deployment" | "team"
peer_group_key: string
minimum_sample: {
  gp?: number
  toi?: number
  starts?: number
  shots_against?: number
  event_count?: number
  shot_attempts?: number
  unblocked_attempts?: number
}
higher_is_better: boolean
methodology_version?: string
source_quality_flags?: string[]
```

### 4.2 Timeframe Semantics

The app must distinguish between player-production windows and deployment/team-behavior windows.

| Context | Required Meaning |
|---|---|
| Player production rankings | Use the player’s last N games played. Example: `player_last_10_games_played`. |
| Skater deployment buckets | Use the team’s last N games. Example: `team_last_10_games`. |
| Goalie netshare and role | Use the team’s last N games. |
| Team style | Use the team’s last N games. |
| Season | Use season-to-date unless another split is selected. |

The UI should make this distinction clear in tooltips or helper text.

Example tooltip:

> “Production stats use the player’s last 10 games played. Deployment uses the team’s last 10 games to reflect current role and coaching usage.”

### 4.3 Deployment Buckets

Skater deployment should be based primarily on even-strength or 5v5 role, not total TOI alone.

For forwards:

- `L1`
- `L2`
- `L3`
- `L4`

For defensemen:

- `P1`
- `P2`
- `P3`

Special-teams deployment should be stored separately:

- `pp_deployment_bucket`: `PP1`, `PP2`, `None`
- `pk_deployment_bucket`: `PK1`, `PK2`, `None`

This distinction matters because a player may be an L3 forward at even strength but still be fantasy-relevant due to PP1 or PP2 usage.

### 4.4 Percentile Meaning

A percentile should always mean:

> “This entity is better than X% of qualified peers in the selected peer group for this metric.”

For lower-is-better metrics, the backend must invert or normalize the value before calculating rank and percentile.

Raw rank should use dense-rank semantics inside the active peer group so ties do not create gaps. Percentile display should use a cume-dist-style calculation over the normalized metric value, ordered so stronger results approach 100. The UI copy remains "better than X% of qualified peers" and must name the peer group.

Examples:

| Metric | Raw Direction | Display Meaning |
|---|---|---|
| SOG/60 | Higher is better | 84th percentile means strong shot volume. |
| xGA/60 | Lower is better | 84th percentile means strong defensive suppression. |
| Penalties Taken/60 | Lower is better | 84th percentile means the player takes fewer penalties than most peers. |

### 4.5 Sample Confidence

Every ranking row should include a sample confidence label.

Allowed values:

- `low`
- `medium`
- `high`

The confidence should be based on metric type and selected window.

Examples:

| Metric Type | Sample Basis |
|---|---|
| Skater rate stats | TOI, GP, and metric-specific event count where relevant |
| Scoring stats | GP, TOI, shots, points, or event count where relevant |
| PP metrics | PPTOI |
| Goalie metrics | Starts, shots against, and unblocked attempts against where xG uses a Fenwick/unblocked universe |
| Team style | Team games |
| Shot-location metrics | Shot attempt count |

The UI may still show low-sample players, but it must label them clearly.

Example display:

> “97th percentile SOG/60 among L3 forwards. Low sample: 32 minutes played in selected window.”

---

## 5. Target Users

### 5.1 Primary Users

1. **Fantasy hockey managers** who need waiver, trade, streamer, and buy-low/sell-high signals.
2. **Hockey analysts and writers** who need contextual rankings and role-aware explanations.
3. **Power users of the site** who already use shift charts, goalie value pages, and advanced metrics.

### 5.2 Secondary Users

1. Casual hockey fans who want simplified player comparisons.
2. Developers or maintainers who need a consistent data model for rankings, percentiles, and future metrics.

---

## 6. User Stories

### 6.1 Skater Ranking Stories

1. **As a fantasy manager**, I want to rank L2 forwards by SOG/60 over their last 10 games so that I can find players with strong shot volume in realistic roles.
2. **As a fantasy manager**, I want to filter for L3 forwards with PP usage so that I can find hidden waiver candidates before they become obvious.
3. **As an analyst**, I want to compare players within deployment buckets so that I do not overvalue top-line players and undervalue productive depth players.
4. **As a user**, I want every row to show raw rank and percentile so that I understand both ordinal rank and relative strength.
5. **As a user**, I want low-sample players labeled clearly so that I can separate interesting outliers from reliable trends.
6. **As a user**, I want a plain-English explanation for why a player ranks highly so that I do not need to manually inspect every column.

### 6.2 MCM / BEAST Stories

1. **As a bangers-league fantasy manager**, I want to identify players who contribute shots, hits, blocks, and offense so that I can target multi-category value.
2. **As a user**, I want BEAST tiers to require multiple category strengths so that one-category specialists are not mislabeled as multi-category monsters.
3. **As a user**, I want MCM Score to be based on percentiles within a peer group so that the score is role-aware.

### 6.3 Advanced Archetype Stories

1. **As a user**, I want to find Shoot-First players so that I can identify shot and goal upside.
2. **As a user**, I want to find Pass-First players so that I can identify playmakers and assist-heavy profiles.
3. **As a user**, I want a Results Luck Index so that I can identify players who may be running hot or cold compared with their baseline.
4. **As a user**, I want Goals Above Expected and Unrealized xG so that I can find potential sell-high and buy-low candidates.

### 6.4 Goalie Stories

1. **As a fantasy manager**, I want goalie deployment buckets based on starts so that I can understand whether a goalie is a workhorse, starter, tandem goalie, backup, or call-up.
2. **As a user**, I want raw netshare and adjusted core netshare so that injury call-up starts do not distort the team’s actual goalie hierarchy.
3. **As an analyst**, I want to rank goalies by GSAx/start, relative SV%, and steal games so that I can evaluate goalie value beyond wins and save percentage.

### 6.5 Team Style Stories

1. **As a fantasy manager**, I want to know which teams heavily load PP1 so that I can better value players with PP1 roles.
2. **As an analyst**, I want to rank teams by line rolling and top loading so that I can identify coaching style and usage tendencies.
3. **As a user**, I want shot quantity and shot quality separated so that I can distinguish high-volume perimeter teams from dangerous chance-generation teams.

### 6.6 Shareability Stories

1. **As a user**, I want the filter state saved in the URL so that I can share a specific leaderboard with another person.
2. **As a developer**, I want shareable URLs so that I can reproduce ranking bugs and verify exact filter states.

---

## 7. Functional Requirements

### 7.1 Page and Navigation

**FR-001:** Create a new `/rankings` route.

**FR-002:** The `/rankings` route must load the skater leaderboard by default in the first shippable release.

**FR-003:** The page structure must support future entity types: skaters, goalies, and teams.

**FR-004:** If goalie or team rankings are not yet implemented, selecting those entity types should either be hidden or show a clear “Coming soon” state. Do not show broken or empty tables without explanation.

---

### 7.2 Filters

**FR-010:** The rankings UI must include a season filter.

**FR-011:** The rankings UI must include an entity-type filter with future support for:

- Skaters
- Goalies
- Teams

**FR-012:** The first release must support skaters.

**FR-013:** The rankings UI must include a timeframe filter with at least:

- Season to date
- Last 5
- Last 10
- Last 20

**FR-014:** The backend must interpret timeframe according to the selected entity and context:

- Player production rankings use player last N games played.
- Deployment, goalie role, and team style use team last N games.

**FR-015:** The skater UI must include a position-group filter:

- All skaters
- Forwards
- Defensemen

**FR-016:** The skater UI must include a deployment filter:

- All
- L1
- L2
- L3
- L4
- P1
- P2
- P3

**FR-017:** The deployment filter must not mix forward line buckets with defense pair buckets. For example, selecting `L2` should only include forwards, and selecting `P2` should only include defensemen.

**FR-018:** The rankings UI must include a strength-state filter. The first shippable release should expose only verified source states (`All`, `EV`, `PP`, `PK`). `5v5` may remain in the schema and metric registry as a planned state, but the UI/API must not expose it until true `5v5` source rows exist.

Planned full set:

- All
- 5v5
- EV
- PP
- PK

**FR-019:** The rankings UI must include minimum sample filters:

- Minimum GP for skaters.
- Minimum TOI for skaters.
- Future: minimum starts and shots against for goalies.

**FR-020:** The rankings UI must include a team filter.

**FR-021:** Changing any filter must refresh the leaderboard results and recalculate rank and percentile within the selected peer group.

**FR-022:** The selected filters must be reflected in the URL query params.

Recommended query params:

```txt
/rankings?entity=skaters&season=20252026&window=last10&position=F&deployment=L2&strength=all&metric=sog_per_60&min_gp=5&min_toi=50&team=all
```

---

### 7.3 Metric Registry

**FR-030:** Create or adapt a central `metric_definitions` data source.

**FR-031:** Every leaderboard metric must have a metric definition.

**FR-032:** A metric definition must include at least:

```ts
metric_key: string
display_name: string
entity_type: "skater" | "goalie" | "team"
category: string
description: string
formula_description: string
higher_is_better: boolean
default_strength_state: "all" | "5v5" | "ev" | "pp" | "pk"
applicable_strength_states: Array<"all" | "5v5" | "ev" | "pp" | "pk">
denominator_key: string | null
denominator_description: string | null
sample_requirements: {
  gp?: number
  toi?: number
  starts?: number
  shots_against?: number
  event_count?: number
  unblocked_attempts?: number
} | null
methodology_version: string
source_quality_flags: string[]
default_peer_group: string | null
minimum_gp: number | null
minimum_toi: number | null
minimum_starts: number | null
minimum_shots_against: number | null
is_rate_stat: boolean
is_percentile_eligible: boolean
phase: "phase_1" | "phase_2" | "phase_3" | "phase_4" | "phase_5"
```

**FR-033:** The frontend must use metric definitions for display names, descriptions, tooltips, default strength state, and whether higher values are better.

**FR-033A:** Metric tooltips and methodology surfaces must show denominator, applicable strength states, sample requirement, and any source-quality caveats.

**FR-034:** Metric formulas must not live only inside React table components.

**FR-035:** Lower-is-better metrics must use `higher_is_better = false` and must be normalized before ranking.

---

### 7.4 First-Release Skater Metrics

**FR-040:** The first shippable release must support these skater metrics where source data exists:

| Metric | Metric Key | Notes |
|---|---|---|
| Goals/60 | `goals_per_60` | Goals per 60 minutes. |
| Assists/60 | `assists_per_60` | Total assists per 60 minutes. |
| Primary Assists/60 | `primary_assists_per_60` | Preferred playmaking signal. |
| Points/60 | `points_per_60` | Total points per 60 minutes. |
| SOG/60 | `sog_per_60` | Shots on goal per 60 minutes. |
| Shot Attempts/60 | `shot_attempts_per_60` | Individual attempts per 60 minutes. |
| Hits/60 | `hits_per_60` | Hits per 60 minutes. |
| Blocks/60 | `blocks_per_60` | Blocks per 60 minutes. |
| Individual xG/60 | `ixg_per_60` | Individual expected goals per 60 minutes. |

**FR-041:** If a source stat is not available in the current schema, the metric should be disabled or marked unavailable rather than calculated incorrectly.

**FR-042:** For all rate metrics, store and use the underlying numerator and denominator. Do not store only the final rate.

Example:

- Store `shots_on_goal` and `toi_total`.
- Calculate `sog_per_60` from those values.

---

### 7.5 Planned Advanced Skater Metrics

These metrics are part of the product plan but are not required in the first shippable release unless the data already exists and implementation is low-risk.

**FR-050:** Prepare schema and metric definitions for:

| Metric | Metric Key | Phase | Notes |
|---|---|---:|---|
| xS% | `expected_shooting_percentage` | 3 | Prefer `individual_xg / individual_unblocked_attempts` when the xG model is built on a Fenwick/unblocked-shot universe. Use shots-on-goal only if the source model is explicitly on-goal. |
| Shooting Percentage Above Expected | `sax_percentage` | 3 | Actual finishing above expected, using the same denominator universe as xS% or a goals-minus-xG equivalent. |
| Goals Above Expected | `goals_above_expected` | 3 | `goals - individual_xg`. |
| Unrealized xG | `unrealized_xg` | 3 | `individual_xg - goals`. Useful for buy-low signals. |
| On-ice GF% | `on_ice_gf_percentage` | 3 | `on_ice_gf / (on_ice_gf + on_ice_ga)`. |
| On-ice xGF% | `on_ice_xgf_percentage` | 3 | `on_ice_xgf / (on_ice_xgf + on_ice_xga)`. |
| Relative 5v5 GF% | `rel_5v5_gf_percentage` | 3 | Player GF% minus team-without-player GF%. |
| Relative 5v5 xGF% | `rel_5v5_xgf_percentage` | 3 | Player xGF% minus team-without-player xGF%. |
| Results Luck Index | `results_luck_index` | 3 | Current results versus historical baseline, centered around 100. |

**FR-051:** Advanced metrics must be labeled by category in the metric registry:

- Results
- Process
- Opportunity
- Regression
- Deployment
- Fantasy composite

**FR-052:** Do not mix strength states inside a metric unless the formula explicitly requires it and the metric definition explains it.

---

### 7.6 Skater Window Aggregates

**FR-060:** Create or adapt a derived aggregate data source for skater windows.

Recommended table name:

```txt
skater_window_aggregates
```

**FR-061:** One row should represent one player, team, season, window, and strength-state context.

**FR-062:** The aggregate should include source numerators and denominators needed for first-release metrics.

Recommended fields:

```ts
player_id
team_id
season
window_type
window_size
window_semantics
window_start_date
window_end_date
strength_state
position_group
games_played
toi_total
toi_ev
toi_5v5
toi_pp
toi_pk
goals
assists
primary_assists
secondary_assists
points
pp_goals
pp_assists
pp_points
shots_on_goal
shot_attempts
unblocked_attempts
individual_xg
hits
blocks
individual_corsi
individual_fenwick
takeaways
giveaways
penalties_taken
penalties_drawn
on_ice_cf
on_ice_ca
on_ice_ff
on_ice_fa
on_ice_gf
on_ice_ga
on_ice_xgf
on_ice_xga
denominator_event_count
source_quality_flags
methodology_version
created_at
updated_at
```

**FR-063:** The developer must inspect the existing Supabase schema and adapt field names as needed.

**FR-064:** The first release should precompute at least:

- Season to date
- Last 5
- Last 10
- Last 20

**FR-065:** Later releases should support:

- Last 40
- Last 82
- Past 240 games for historical baseline metrics
- Custom windows, if performance allows

---

### 7.7 Skater Deployment Windows

**FR-070:** Create or adapt a derived data source for skater deployment by window.

Recommended table name:

```txt
skater_deployment_windows
```

**FR-071:** Use the existing `lineCombinations` Supabase table where possible.

**FR-072:** Use existing `/shiftcharts` power-play unit logic where possible for PP deployment.

**FR-073:** Deployment should be calculated per team, season, and selected team-window.

**FR-074:** Forward deployment must support:

- `L1`
- `L2`
- `L3`
- `L4`

**FR-075:** Defense deployment must support:

- `P1`
- `P2`
- `P3`

**FR-076:** Store special-teams deployment separately from even-strength deployment.

Required fields:

```ts
player_id
team_id
season
window_type
window_size
window_semantics
position_group
ev_deployment_bucket
pp_deployment_bucket
pk_deployment_bucket
avg_ev_toi_per_gp
avg_5v5_toi_per_gp
avg_total_toi_per_gp
avg_pp_toi_per_gp
avg_pk_toi_per_gp
deployment_confidence
created_at
updated_at
```

**FR-077:** Even-strength deployment should be based primarily on line-combination role and EV/5v5 TOI per game.

**FR-078:** Total TOI alone must not be used as the primary deployment source because PP specialists and PK specialists can distort role.

**FR-079:** Deployment confidence must be stored.

Allowed values:

- `high`
- `mixed`
- `low`

Suggested interpretation:

| Confidence | Meaning |
|---|---|
| `high` | Player was consistently in the same line/pair bucket for the selected window. |
| `mixed` | Player moved across multiple buckets or usage was ambiguous. |
| `low` | Player had too few games or too little TOI to assign confidently. |

**FR-080:** The leaderboard must show the deployment bucket and confidence where available.

---

### 7.8 Ranking and Percentile Logic

**FR-090:** Create or adapt a server-side ranking data source.

Recommended table name:

```txt
entity_metric_rankings
```

Alternative acceptable approach:

- A Supabase RPC that returns equivalent precomputed or efficiently calculated ranking results.

**FR-091:** The frontend must not calculate full-league percentile rankings client-side.

**FR-092:** A ranking row should include:

```ts
entity_type
entity_id
team_id
season
window_type
window_size
window_semantics
strength_state
metric_key
peer_group_type
peer_group_key
raw_value
normalized_value
raw_rank
percentile
qualified_peer_count
minimum_sample_met
sample_confidence
as_of_date
```

**FR-093:** The ranking engine must support these peer groups for skaters:

- League-wide all skaters
- League-wide forwards
- League-wide defensemen
- Deployment-specific forwards: `L1`, `L2`, `L3`, `L4`
- Deployment-specific defensemen: `P1`, `P2`, `P3`
- Team-specific skaters

**FR-094:** Raw rank must be calculated inside the active peer group.

Example:

> If the user filters to L2 forwards and selects SOG/60, raw rank means rank among qualified L2 forwards, not rank among all NHL skaters.

**FR-095:** Percentile must be calculated inside the active peer group.

**FR-096:** Percentile should be rounded to a whole number for display.

**FR-097:** Use dense-rank behavior for raw rank where ties produce rankings such as `1, 2, 2, 3`.

**FR-098:** Percentile should handle ties without creating misleading jumps. Use a `cume_dist()`-style percentile over normalized metric values, ordered so stronger results approach 100, or an equivalent better-than-share calculation documented in implementation notes.

**FR-099:** If `qualified_peer_count` is too small to make percentile meaningful, the UI should show a warning or suppress percentile.

Recommended threshold:

- Show normal percentile when peer count is at least 10.
- Show caution when peer count is 5 to 9.
- Show `N/A` or strong caution when peer count is below 5.

---

### 7.9 Leaderboard Table

**FR-110:** The first-release leaderboard table must include these columns:

| Column | Purpose |
|---|---|
| Player | Main entity. |
| Team | Team context. |
| Pos | Forward or defenseman. |
| Deployment | L1/L2/L3/L4 or P1/P2/P3. |
| GP | Sample size. |
| TOI/G | Usage context. |
| Metric Value | Raw selected metric value. |
| Raw Rank | Rank inside selected peer group. |
| Percentile | Better-than-X% context. |
| Trend | Optional in first release; required in opportunity-change phase. |
| Tags | Optional in first release; later MCM/BEAST/archetype badges. |

**FR-111:** The table must be sortable by at least:

- Metric value
- Raw rank
- Percentile
- GP
- TOI/G

**FR-112:** Default sort should be best percentile or best raw rank for the selected metric.

**FR-113:** The table must show a clear loading state.

**FR-114:** The table must show a clear empty state when filters return no qualified players.

**FR-115:** The table must show a clear unavailable state when the selected metric cannot be calculated from available data.

---

### 7.10 Explanation Drawer

**FR-120:** Each leaderboard row should have an expandable explanation drawer or expandable section.

**FR-121:** The explanation should summarize why the entity ranks highly or poorly.

Example:

```txt
Why this player stands out:
- 91st percentile in SOG/60 among L2 forwards.
- 84th percentile in Hits/60.
- 77th percentile in Goals/60.
- Low sample warning: 42 minutes in selected window.
```

**FR-122:** For first release, the explanation may be rule-based and generated from available row data.

**FR-123:** Explanations must not make claims unsupported by available data.

---

### 7.11 MCM / BEAST Score

MCM / BEAST is planned for Phase 2. The Phase 1 architecture must support it.

**FR-130:** Create metric definitions and storage fields for MCM Score and BEAST Tier.

Recommended storage location:

```txt
skater_composite_ratings
```

**FR-131:** MCM Score should reward multi-category players, not one-category specialists.

**FR-132:** Peripheral categories should be called “Riffs.”

Riff categories:

- Shots/60
- Hits/60
- Blocks/60

Scoring categories:

- Goals/60
- Primary Assists/60
- Points/60
- PP Points/60

The published output must include total flag count, Riff/peripheral flag count, scoring flag count, named tier, and the visible percentile thresholds used for each flag. Hits and blocks should carry a rink/scorekeeper caveat unless a rink-adjusted source is available.

**FR-133:** MCM Score should be calculated from percentiles, not raw values.

Suggested formula:

```ts
riff_score = average(top_2([
  shots_percentile,
  hits_percentile,
  blocks_percentile
]))

scoring_score = max([
  goals_percentile,
  primary_assists_percentile,
  points_percentile,
  pp_points_percentile
])

depth_score = average([
  shots_percentile,
  hits_percentile,
  blocks_percentile,
  goals_percentile,
  primary_assists_percentile,
  points_percentile,
  pp_points_percentile
])

mcm_score =
  0.45 * riff_score +
  0.35 * scoring_score +
  0.20 * depth_score
```

**FR-134:** BEAST tiers should use gates so that a single elite category cannot create a BEAST label.

Suggested gates:

| Tier | Eligibility |
|---|---|
| MCM Watch | At least 2 Riff categories at or above 60th percentile and at least 1 scoring category at or above 60th percentile. |
| MCM | At least 2 Riff categories at or above 70th percentile, at least 1 scoring category at or above 60th percentile, and MCM Score >= 70. |
| BEAST | At least 2 Riff categories at or above 75th percentile, at least 1 scoring category at or above 70th percentile, at least 4 of 7 total categories at or above 70th percentile, and MCM Score >= 80. |
| BEAST+ | All 3 Riff categories at or above 80th percentile, at least 2 scoring categories at or above 75th percentile, at least 4 of 7 total categories at or above 80th percentile, and MCM Score >= 88. |
| BEAST Elite | Reserved for the top transparent flag tier when thresholds are finalized. |

**FR-135:** The UI should show MCM Score as a number and BEAST Tier as a badge once implemented.

**FR-136:** BEAST and MCM labels must be explainable from visible percentile flags. Do not publish only an opaque composite score.

---

### 7.12 Advanced Skater Archetypes

Advanced skater archetypes are planned for Phase 3.

**FR-140:** Prepare `skater_composite_ratings` to support these fields:

```ts
player_id
team_id
season
window_type
window_size
window_semantics
offense_rating_overall
offense_rating_deployment
defense_rating_overall
defense_rating_deployment
mcm_score
beast_tier
shoot_first_score
pass_first_score
play_driver_score
results_luck_index
tags
components_json
created_at
updated_at
```

**FR-141:** Composite ratings must be calculated from metric percentiles, not raw values.

**FR-141A:** Defensive composites should be labeled as `Defense Impact` or `Defensive Impact in Context` until an adjusted RAPM/GAR-like layer is available. Raw on-ice defensive results are context-influenced and must not be presented as pure defensive talent.

**FR-142:** Planned Shoot-First Score should use:

- Individual attempt share.
- Individual SOG share.
- Individual xG share.
- Denominator-matched individual Corsi/Fenwick and xG components, not mixed shot-on-goal and Fenwick xG universes.

Suggested formula:

```ts
shoot_first_score =
  0.45 * percentile(individual_attempt_share) +
  0.35 * percentile(individual_shot_share) +
  0.20 * percentile(individual_xg_share)
```

Suggested labels:

| Score | Label |
|---:|---|
| 70+ | Shot Leaning |
| 80+ | Shoot-First |
| 90+ | Trigger Man |

**FR-143:** Planned Pass-First Score should use:

- Primary assists/60.
- Assists as share of points.
- Primary assists as share of total assists.
- Optional inverse shot-volume component.

Suggested formula:

```ts
pass_first_score =
  0.45 * percentile(primary_assists_per_60) +
  0.25 * percentile(assist_point_share) +
  0.20 * percentile(primary_assist_share) +
  0.10 * inverse_percentile(shots_per_60)
```

**FR-144:** Pass-First labels must require a minimum points and primary-assists sample.

**FR-145:** Planned Play Driver Score should use:

- Primary points/60.
- Primary point share.
- Relative 5v5 xGF%.
- Relative 5v5 GF%.
- Individual xG/60.
- Adjusted or relative versions where available; otherwise the UI must caveat that the score is contextual and teammate/opponent/usage-influenced.

Suggested formula:

```ts
play_driver_score =
  0.30 * percentile(primary_points_per_60) +
  0.20 * percentile(primary_point_share) +
  0.20 * percentile(rel_xgf_pct) +
  0.15 * percentile(rel_gf_pct) +
  0.15 * percentile(individual_xg_per_60)
```

**FR-146:** Results Luck Index should be centered around 100.

Suggested interpretation:

| Luck Index | Meaning |
|---:|---|
| 120+ | Running hot |
| 105-119 | Slightly hot |
| 95-105 | Normal |
| 80-94 | Slightly cold |
| <80 | Running cold |

**FR-147:** Results Luck Index should compare current results to a prior non-overlapping or frozen historical baseline that excludes the selected current window. A baseline containing the current window leaks results into the comparison and must not be used for a hot/cold label.

Suggested concept:

```txt
results = GF/xGF + IPP + oiSH% / league_average_oiSH%
results_luck_index = 100 * current_results / baseline_results
```

**FR-148:** For players without enough historical data, blend player history with peer-group average.

**FR-149:** For PP luck, require a minimum PPTOI sample. If the sample is too small, exclude PP or regress it toward peer average.

---

### 7.13 Goalie Rankings and Deployment

Goalie rankings are planned for Phase 4. The architecture should prepare for them.

**FR-160:** Create or prepare a goalie aggregate data source.

Recommended table name:

```txt
goalie_window_aggregates
```

Recommended fields:

```ts
goalie_id
team_id
season
window_type
window_size
window_semantics
starts
games_played
toi
shots_against
goals_against
saves
save_percentage
xga
gsax
xga_unblocked_attempts_against
wins
losses
ot_losses
quality_starts
really_bad_starts
steal_games
high_danger_shots_against
high_danger_goals_against
high_danger_save_percentage
created_at
updated_at
```

**FR-161:** Create or prepare a goalie deployment data source.

Recommended table name:

```txt
goalie_deployment_windows
```

Recommended fields:

```ts
goalie_id
team_id
season
window_type
window_size
window_semantics
raw_netshare
adjusted_core_netshare
goalie_bucket
is_core_goalie
is_likely_replacement_stint
role_confidence
created_at
updated_at
```

**FR-162:** Goalie deployment must use starts as the primary role input, not games played.

**FR-163:** Calculate raw netshare as:

```txt
raw_netshare = goalie_starts / team_starts
```

**FR-164:** Calculate adjusted core netshare as:

```txt
adjusted_core_netshare = goalie_starts / core_goalie_starts
```

**FR-165:** Store both raw netshare and adjusted core netshare.

**FR-166:** Suggested goalie buckets:

| Netshare | Bucket | Label |
|---:|---|---|
| 65%+ | `G1-W` | Workhorse |
| 57.5-64.9% | `G1` | Starter |
| 50-57.4% | `G1A` | Tandem Lead |
| 42.5-49.9% | `G1B` | Tandem Partner |
| 35-42.4% | `G2+` | Busy Backup |
| 25-34.9% | `G2` | Backup |
| <25% | `G3` | Spot / Call-Up |

**FR-167:** Tandem labels should require both top goalies to have meaningful share.

Suggested tandem condition:

```txt
top_goalie_netshare <= 57.5%
AND second_goalie_netshare >= 40%
```

**FR-168:** The system should identify likely injury call-up or replacement stints when possible.

Suggested detection logic:

```txt
goalie_raw_netshare < 25%
AND goalie_starts_are_clustered = true
AND one_of_top_two_goalies_has_gap_during_that_cluster = true
AND goalie_does_not_continue_after_top_goalie_returns = true
```

**FR-169:** Replacement-stint logic must include a role confidence field and must not be presented as certain.

**FR-170:** Prepare support for these goalie metrics:

- Save percentage
- GSAx
- GSAx/60
- GSAx/start
- xGA per unblocked attempt against when the xG model is built on unblocked attempts; xGA per shot against only when the model is on-goal
- Relative SV%
- Quality Start %
- Really Bad Start %
- Steal Games
- Steal %
- High-danger SV%
- Under Pressure profile

**FR-171:** Steal game logic should eventually use adjusted goal differential excluding empty-net goals if available.

Suggested logic:

```txt
steal_game =
  goalie_started
  AND team_won
  AND goalie_gsax >= max(1.0, adjusted_goal_differential)
```

**FR-172:** Quality Start should support a compatibility mode based on save percentage thresholds and a modern xG mode where a start is quality when `GSAx >= 0`. The selected mode must be visible in methodology.

**FR-173:** Adjusted core netshare should exclude emergency-callup usage during contiguous absence windows for one of the top two goalies when the inference has sufficient confidence.

---

### 7.14 Team Style Rankings

Team style rankings are planned for Phase 5.

**FR-180:** Create or prepare a team style data source.

Recommended table name:

```txt
team_style_windows
```

Recommended fields:

```ts
team_id
season
window_type
window_size
window_semantics
forward_roll_score
forward_top_load_index
defense_roll_score
defense_top_load_index
pp1_toi_share
pp2_toi_share
pp_unit_gap
shot_quantity_score
shot_quality_score
run_and_gun_score
high_event_score
pp_dependency_score
team_luck_index
physicality_score
discipline_score
rest_split_summary
home_road_split_summary
created_at
updated_at
```

**FR-181:** Team style should be labeled as “Team Style” publicly, not “Coaching Style,” unless the app has reliable coach-by-game data.

**FR-182:** Forward line rolling should use line EV TOI share.

Suggested concepts:

```txt
line_toi_share = line_ev_toi / total_forward_ev_toi
forward_top_load_index = L1_toi_share - L3_toi_share
forward_roll_balance = 1 - gini([L1, L2, L3, L4 toi shares])
```

**FR-183:** Defense pair rolling should use pair EV TOI share.

Suggested concept:

```txt
defense_top_load_index = P1_toi_share - P3_toi_share
```

**FR-184:** PP unit concentration should track:

- PP1 TOI share
- PP2 TOI share
- PP unit gap

Suggested labels:

| PP1 Share | Label |
|---:|---|
| 70%+ | PP1 Heavy |
| 60-69% | PP1 Leaning |
| 50-59% | Balanced PP |
| <50% | Unusual / Rotating Units |

**FR-185:** Shot quantity and shot quality should be separate.

Suggested concepts:

```txt
shot_quantity = CF_per_60
shot_quality = xGF / FF
```

Use `xGF / CF` only if the source xG model is explicitly built on all Corsi attempts. If xG is Fenwick/unblocked-shot based, team shot quality must use `xGF / FF`.

**FR-186:** Run-and-gun score should reward high event volume in both directions.

Suggested formula:

```txt
event_volume = xGF_per_60 + xGA_per_60
event_balance = 1 - abs(xGF_per_60 - xGA_per_60) / (xGF_per_60 + xGA_per_60)
run_and_gun_score = 0.75 * percentile(event_volume) + 0.25 * percentile(event_balance)
```

**FR-187:** Team luck should use higher-is-luckier directionality without rewarding goals against in the wrong direction.

Suggested formula:

```txt
net_goals_above_expected = (GF - xGF) + (xGA - GA)
team_luck_index = percentile(net_goals_above_expected)
```

The UI may also show finishing luck, save luck, and PDO context separately.

**FR-188:** PP merchant metrics should separate goal dependency from xG dependency.

Suggested concepts:

```txt
pp_goal_dependency = pp_goals_for / total_goals_for
pp_xg_dependency = pp_xgf / total_xgf
```

---

### 7.15 Opportunity Change Detection

Opportunity-change detection is planned for Phase 6.

**FR-190:** Prepare the data model so later releases can compare current and previous windows.

**FR-191:** Planned opportunity-change badges include:

- TOI Up
- TOI Down
- Line Promotion
- Line Demotion
- PP1 Promotion
- PP1 Role Lost
- PPTOI Spike
- Shot Volume Spike
- Starter Share Rising
- New Tandem Split

**FR-192:** Each opportunity-change badge should be based on measurable changes, not subjective interpretation.

Example:

```txt
Player moved from L3 to L2 and gained 2:41 TOI/G over the last 5 team games.
```

**FR-193:** Opportunity-change explanations should show the before and after values.

---

### 7.16 Shareable URL State

**FR-200:** Every filter state must serialize to the URL.

**FR-201:** Loading a URL with query params must restore the same filter state.

**FR-202:** Invalid query params should fall back to safe defaults and avoid crashing the page.

**FR-203:** The default route should load a sensible default state.

Recommended default:

```txt
entity=skaters
position=all
deployment=all
window=season
strength=all
metric=points_per_60
min_gp=0
min_toi=0
team=all
```

---

### 7.17 API and Data Access

**FR-210:** The frontend should retrieve leaderboard data from a derived table, materialized view, aggregate table, or Supabase RPC.

**FR-211:** The frontend must not query raw play-by-play or raw shot-event data directly on leaderboard page load.

**FR-212:** The API response for the leaderboard should include all fields needed to render the table without additional per-row queries.

Recommended response shape:

```ts
type RankingRow = {
  entity_type: "skater" | "goalie" | "team"
  entity_id: string
  entity_name: string
  team_id: string | null
  team_abbrev: string | null
  position_group: string | null
  deployment_bucket: string | null
  deployment_confidence: "high" | "mixed" | "low" | null
  games_played: number | null
  toi_per_game: number | null
  metric_key: string
  metric_display_name: string
  raw_value: number | null
  formatted_value: string | null
  raw_rank: number | null
  percentile: number | null
  qualified_peer_count: number
  sample_confidence: "low" | "medium" | "high"
  minimum_sample_met: boolean
  denominator_description: string | null
  sample_requirements: Record<string, number> | null
  methodology_version: string
  source_quality_flags: string[]
  tags: string[]
  explanation_items: string[]
}
```

**FR-213:** Leaderboard requests should support server-side pagination or row limits.

**FR-214:** The first release should support at least top 100 rows for a selected leaderboard.

**FR-215:** The backend should be structured so future comparison mode can request a fixed list of players.

**FR-216:** The API layer should expose or prepare endpoints/RPCs for available filters, metric metadata, methodology metadata, and comparison payloads.

**FR-217:** Ranking responses must include enough methodology metadata to render denominator, strength-state, sample, last-updated, and source-quality tooltip text without row-level refetches.

---

## 8. Non-Goals / Out of Scope

### 8.1 Out of Scope for First Shippable Release

The following are not required for Phase 1:

1. Goalie leaderboard UI.
2. Team style leaderboard UI.
3. MCM / BEAST calculation in production.
4. Advanced archetype calculations in production.
5. Results Luck Index in production.
6. Buy-low / sell-high recommendation engine.
7. Opportunity-change alerts.
8. Comparison mode.
9. Fantasy format weighting modes.
10. Custom user-created formulas.
11. Calendar-date custom windows.
12. Raw play-by-play querying from the frontend.

### 8.2 Out of Scope for This PRD

The following are outside this PRD entirely:

1. Building a full fantasy roster-management system.
2. Syncing user fantasy league rosters.
3. Waiver-wire transaction automation.
4. Betting recommendations.
5. Player news ingestion.
6. Manual admin dashboards for editing every metric.
7. Exact visual design mockups beyond the layout and UX requirements listed here.

---

## 9. Design Considerations

### 9.1 Page Layout

The `/rankings` page should use a clear analytics-dashboard layout.

Recommended structure:

1. Page title and short description.
2. Filter bar.
3. Metric selector.
4. Context summary sentence.
5. Leaderboard table.
6. Expandable explanation drawer per row.
7. Methodology panel or tooltip area.
8. Future comparison drawer or comparison cards.

Example context summary:

> “Showing SOG/60 rankings for qualified L2 forwards, all situations, over each player’s last 10 games played.”

### 9.2 Filter UX

Filters should be easy to scan and should not overwhelm first-time users.

Recommended grouping:

- Primary filters: Entity, Season, Window, Metric.
- Context filters: Position, Deployment, Strength, Team.
- Sample filters: Minimum GP, Minimum TOI.

### 9.3 Metric Selector UX

The metric selector should show:

- Display name.
- Category.
- Short description.
- Directionality, such as “Higher is better” or “Lower is better.”
- Default strength state, where helpful.
- Denominator and applicable strength states.
- Sample requirement and source-quality caveats.

### 9.4 Percentile Display

Percentile should be visually easy to understand.

Recommended display:

```txt
84th percentile
```

Tooltip:

```txt
Better than 84% of qualified L2 forwards for SOG/60 in this selected window.
```

### 9.5 Sample Confidence Display

Sample confidence should be visible but not overly disruptive.

Recommended badges:

- High sample
- Medium sample
- Low sample

Low-sample rows should have a warning tooltip explaining why confidence is low.

### 9.6 Deployment Display

Deployment should show both EV role and special-teams role where available.

Example:

```txt
L3 · PP2
```

Tooltip:

```txt
EV deployment: L3. Power-play deployment: PP2. Deployment confidence: mixed.
```

### 9.7 Explanation Drawer

The drawer should use plain language and short bullets.

Good example:

```txt
Why this player stands out:
- 91st percentile in SOG/60 among L2 forwards.
- 82nd percentile in Hits/60.
- Avg TOI/G: 16:42.
- Deployment: L2, PP2.
```

Avoid vague claims such as:

```txt
This player is elite.
```

unless the supporting metric and peer group are shown.

---

## 10. Technical Considerations

### 10.1 Existing Project Context

The project uses Supabase.

Known existing resources that should be inspected and reused where appropriate:

- `lineCombinations` Supabase table.
- Existing `/shiftcharts` ecosystem, especially PP unit assignment logic based on PPTOI share.
- Existing `/trueGoalieValue` page and goalie metric logic.

The developer should inspect the current Supabase schema before creating new tables. Table and field names in this PRD are recommended target names, not guaranteed existing names.

Where the research report recommends warehouse-style fact or dimension tables, first verify whether existing repo/Supabase sources already provide the needed fact shape. Do not create redundant fact tables if `rolling_player_game_metrics`, current NST/WGO tables, xG aggregate tables, or existing game/player/team dimensions can be adapted safely.

### 10.2 Data Architecture

Do not make the leaderboard query raw events directly.

Recommended pipeline:

```txt
Raw data
  ↓
Normalized game-level tables
  ↓
Window aggregates
  ↓
Metric calculations
  ↓
Ranks and percentiles
  ↓
Frontend API / Supabase RPC
  ↓
/rankings UI
```

### 10.3 Recommended Derived Tables

The system should create or adapt these derived data sources:

1. `metric_definitions`
2. `skater_window_aggregates`
3. `skater_deployment_windows`
4. `entity_metric_rankings`
5. `skater_composite_ratings`
6. `goalie_window_aggregates`
7. `goalie_deployment_windows`
8. `team_style_windows`

Phase 1 only requires the first four for production use, plus optional scaffolding for `skater_composite_ratings`.

### 10.4 Aggregate Tables vs Views

Prefer physical aggregate tables or materialized views over expensive frontend calculations.

Guidance:

- Use typed columns for core stats and commonly queried metrics.
- Use JSONB only for experimental components, tags, or flexible metadata.
- Avoid storing only final rates when numerators and denominators are needed for safe recalculation.
- Store `updated_at` and `methodology_version` on published ranking or aggregate snapshots.

### 10.5 Precomputed Windows

Precompute common windows:

- Season to date
- Last 5
- Last 10
- Last 20
- Last 40, later
- Past 240 games, later for baseline metrics

### 10.6 Incremental Updates

After a new game is ingested, the pipeline should update affected entities rather than recalculating the full league where possible.

Affected entities include:

- Players in the game.
- Goalies in the game.
- Both teams in the game.
- Peer-group rankings affected by those players, goalies, or teams.

### 10.7 Indexing

Add indexes or equivalent query optimization for common leaderboard filters.

Recommended index dimensions:

- `season`
- `window_type`
- `window_size`
- `window_semantics`
- `entity_type`
- `metric_key`
- `peer_group_type`
- `peer_group_key`
- `position_group`
- `deployment_bucket`
- `team_id`
- `strength_state`

### 10.8 Caching

Leaderboard filter combinations will repeat frequently.

Recommended cache key shape:

```txt
entityType|season|window|position|deployment|strength|metric|minGp|minToi|team
```

Caching may be handled at the RPC, API, or application layer depending on existing architecture.

### 10.9 Data Quality and Missing Data

The system must handle missing data safely.

Examples:

- If primary assists are unavailable, disable `primary_assists_per_60` and any metric that depends on it.
- If xG is unavailable, disable xG-based metrics.
- If line-combination data is incomplete, use EV/5v5 TOI fallback and lower deployment confidence.
- If a player has no qualifying TOI, do not calculate misleading rates.
- If hits, blocks, giveaways, or takeaways are not rink-adjusted, caveat or exclude them from precision quality composites.
- If primary-assist order or event attribution is not verified, mark affected metrics with a source-quality flag.

### 10.10 Testing Requirements

Add tests or validation scripts for:

1. Higher-is-better rankings.
2. Lower-is-better rankings.
3. Percentile calculations inside peer groups.
4. Dense-rank tie behavior.
5. Minimum sample filtering, including event-denominator thresholds.
6. Low-sample confidence labels.
7. Forward deployment buckets not mixing with defense pair buckets.
8. URL query param parsing and defaults.
9. Empty result states.
10. Unavailable metric states.
11. Denominator correctness for xG/Fenwick, shot-on-goal, goalie xGA, and team shot-quality metrics.
12. Goalie injury/call-up adjusted-netshare denominator logic.
13. Deterministic rank and percentile partitions for tied values and lower-is-better metrics.

---

## 11. Acceptance Criteria

### 11.1 Phase 1 Acceptance Criteria

The first shippable version is complete when all of the following are true:

1. A user can open `/rankings` and see a skater leaderboard.
2. A user can select a skater metric and see metric value, raw rank, and percentile.
3. Rank and percentile are calculated within the selected peer group.
4. Lower-is-better metrics rank correctly when such metrics are enabled.
5. The page supports season, timeframe, position, deployment, strength, minimum GP, minimum TOI, and team filters.
6. Production rankings use player last N games played.
7. Deployment uses team last N games.
8. Forwards and defensemen are not incorrectly mixed for deployment-specific rankings.
9. Skater deployment buckets are calculated from line combinations and/or EV/5v5 usage.
10. Deployment confidence is shown or available in the response.
11. Low-sample rows are clearly labeled.
12. Metric definitions, denominators, sample requirements, methodology version, and source-quality flags are not hardcoded only in React table components.
13. The frontend does not calculate full-league percentiles client-side.
14. The leaderboard does not query raw play-by-play or raw shot-event data directly on page load.
15. URL query params preserve and restore filter state.
16. Empty and unavailable states are handled clearly.
17. The implementation leaves a clear path for MCM / BEAST, goalie rankings, and team style rankings.

### 11.2 Phase 2 Acceptance Criteria

MCM / BEAST is complete when:

1. MCM Score is calculated from metric percentiles.
2. Riff categories include shots, hits, and blocks.
3. Scoring categories include goals, primary assists, points, and PP points.
4. BEAST tiers use eligibility gates.
5. A one-category specialist cannot qualify as BEAST solely from one elite category.
6. MCM Score, BEAST Tier, total flag count, Riff/peripheral flag count, scoring flag count, and percentile thresholds are visible in the leaderboard or explanation drawer.

### 11.3 Phase 3 Acceptance Criteria

Advanced skater archetypes are complete when:

1. Shoot-First Score is available for qualified players.
2. Pass-First Score is available for qualified players and includes sample gates.
3. Play Driver Score is available for qualified players.
4. Results Luck Index is centered around 100 and uses prior non-overlapping or frozen baseline logic.
5. Goals Above Expected and Unrealized xG are available where xG data exists.
6. The UI distinguishes results, process, opportunity, and regression metrics.
7. Defense-oriented ratings are labeled as contextual defensive impact unless an adjusted model is available.

### 11.4 Phase 4 Acceptance Criteria

Goalie rankings are complete when:

1. Goalies can be selected as an entity type on `/rankings`.
2. Goalie deployment buckets are based primarily on starts.
3. Raw netshare and adjusted core netshare are both stored.
4. Replacement/call-up inference includes role confidence.
5. Goalie metrics include GSAx, GSAx/start, relative SV%, quality start %, really bad start %, and steal games where data allows.
6. Goalie leaderboard supports rank and percentile by selected peer group.
7. Quality Start mode and xGA denominator are visible in methodology.

### 11.5 Phase 5 Acceptance Criteria

Team style rankings are complete when:

1. Teams can be selected as an entity type on `/rankings`.
2. Team style metrics are calculated from team-window aggregates.
3. PP1 usage, line rolling, pair rolling, shot quantity, shot quality, run-and-gun, and team luck are available where data allows.
4. Team style is labeled with confidence or caveats where data is incomplete.
5. Team shot quality and team luck use denominator- and directionally-correct formulas.

---

## 12. Success Metrics

### 12.1 Product Success Metrics

1. Users can answer contextual ranking questions without exporting data or manually calculating peer groups.
2. Users can identify non-obvious players, such as high-percentile L3 forwards or P2 defensemen with PP1 usage.
3. Users interact with filters and share ranking URLs.
4. Users open explanation drawers to understand why players rank highly.
5. Later phases increase usage of MCM / BEAST, goalie role, and team style features.

### 12.2 Technical Success Metrics

1. Common leaderboard queries return quickly enough for interactive filtering.
2. Rank and percentile results are consistent between refreshes for the same data state.
3. Frontend code does not duplicate metric formulas.
4. Adding a new metric usually requires updating the metric registry and backend calculation layer, not rewriting table components.
5. The data model supports skaters, goalies, and teams without separate one-off leaderboard systems.

### 12.3 Suggested Performance Targets

These are target goals, not hard blockers unless the team chooses to enforce them.

| Action | Target |
|---|---:|
| Initial leaderboard load | Under 2.5 seconds |
| Filter change with cached/precomputed data | Under 1.5 seconds |
| Top 100 leaderboard query | Under 1.5 seconds |
| URL state restoration | Immediate after data load |

---

## 13. Open Questions

1. What are the exact names and available fields in the current Supabase source tables?
2. Does `lineCombinations` include line/pair number, strength state, game ID, team ID, player ID, and TOI?
3. Does the current data source include primary assists, secondary assists, individual xG, on-ice xGF, and on-ice xGA?
4. Does the current xG model use all attempts, unblocked attempts, or shots on goal as its base event type?
5. Is PPTOI share logic from `/shiftcharts` already reusable as a shared utility or does it need to be extracted?
6. Does `/trueGoalieValue` already calculate GSAx, quality starts, really bad starts, or relative goalie metrics in reusable form?
7. Should first-release leaderboards include unqualified players with low-sample labels, or hide them by default behind minimum sample filters?
8. What should the default minimum GP and TOI be for the first release?
9. Should percentiles display as whole numbers only, or should the UI allow one decimal place in detailed views?
10. Should traded-player views support full season, current team only, previous team split, and since-joining-team in Phase 1 or later?
11. Is there an existing design system component for badges, drawers, tooltips, and data tables that should be reused?
12. Should the first release expose metric methodology in a page-level “Methodology” drawer?

---

## 14. Recommended Build Order

1. Inspect existing Supabase schema and confirm available source fields.
2. Create or adapt `metric_definitions`.
3. Build `skater_window_aggregates` for season, last 5, last 10, and last 20.
4. Build `skater_deployment_windows` using `lineCombinations`, EV/5v5 TOI, and PP unit logic from `/shiftcharts`.
5. Build `entity_metric_rankings` or an equivalent Supabase RPC.
6. Validate rank, percentile, directionality, peer groups, and sample confidence.
7. Build the first `/rankings` UI with filters, metric selector, table, and URL state.
8. Add the explanation drawer.
9. Add MCM / BEAST in Phase 2.
10. Add advanced skater archetypes in Phase 3.
11. Add goalie rankings and deployment in Phase 4.
12. Add team style rankings in Phase 5.
13. Add opportunity-change detection in Phase 6.

---

## 15. Junior Developer Notes

When working on this feature, keep these rules in mind:

1. Do not calculate full-league ranks or percentiles in the browser.
2. Do not hardcode formulas inside table cells.
3. Do not mix forwards and defensemen in deployment-specific peer groups.
4. Do not use total TOI alone to assign skater deployment.
5. Do not show a percentile without knowing the peer group.
6. Do not show a strong label like BEAST, Play Driver, or Running Cold unless the required data and sample gates are met.
7. Do not query raw play-by-play data from the leaderboard page.
8. Always store enough context to explain a ranking in plain English.
9. When data is missing or incomplete, show an honest unavailable or low-confidence state.
10. Keep the system extensible: the same ranking engine should eventually support skaters, goalies, and teams.
