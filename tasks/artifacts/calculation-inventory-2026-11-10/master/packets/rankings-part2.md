# Audit packet: Rankings (part 2 of 2)

Master entries M-RNK-061 to M-RNK-065 (5 of 65 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-RNK-061 | SAX% | Codex only | 0 | 1 |
| M-RNK-062 | Shot Attempts/60 | Codex only | 0 | 1 |
| M-RNK-063 | SOG/60 | Codex only | 0 | 1 |
| M-RNK-064 | Unrealized xG | Codex only | 0 | 1 |
| M-RNK-065 | xGA/60 | Codex only | 0 | 1 |

## M-RNK-061 SAX%

- **Match:** Codex only; Opus —; Codex RANK-sax_percentage
- **Possible related records (low-confidence location link, unconfirmed):** RNK-037
- **Purpose:** Shooting percentage above expected.
- **Where:** `web/lib/rankings/metricDefinitions.ts:959 CONTEXTUAL_RANKING_METRIC_DEFINITIONS`; `web/lib/rankings/skaterWindowAggregation.ts:514 buildSkaterWindowAggregatesFromRollingRow`
- **Tags (heuristic):** percent scale: 0-100; denominators: unblocked attempts; generation: current
- **Codex view (RANK-sax_percentage, calculation; Codex family 'Contextual skater rankings'):** SAX%
  - Purpose: Shooting percentage above expected.
  - Inputs/units: Source rolling_player_game_metrics fields: rolling_player_game_metrics.goals_per_60_total_{window}, rolling_player_game_metrics.ixg_per_60_total_{window}, rolling_player_game_metrics.shot_attempts_per_60_total_{window}, rolling_player_game_metrics.goals_per_60_goals_{baseline_window}, rolling_player_game_metrics.ixg_per_60_ixg_{baseline_window}, rolling_player_game_metrics.shot_attempts_per_60_shot_attempts_{baseline_window}. Denominator: Individual unblocked shot attempts from approved shot-goal xG feature rows.
  - Output scale: actual shooting percentage - expected shooting percentage Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
  - Consumers: Contextual rankings/player matrix/splits/trending/composites; metric definitions registry.
- **Audit context:**
  - Intended contract (Codex RANK-sax_percentage): actual shooting percentage - expected shooting percentage Source: web/lib/rankings/metricDefinitions.ts:580. Minimum GP 1, TOI 600 seconds.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/metricDefinitions.test.ts`; `web/lib/rankings/skaterWindowAggregation.test.ts`
- **Leads (not audited):**
  - (codex:RANK-sax_percentage) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

## M-RNK-062 Shot Attempts/60

- **Match:** Codex only; Opus —; Codex RANK-shot_attempts_per_60
- **Possible related records (low-confidence location link, unconfirmed):** RNK-037
- **Purpose:** Individual shot attempts per 60 minutes in the selected window.
- **Where:** `web/lib/rankings/metricDefinitions.ts:959 CONTEXTUAL_RANKING_METRIC_DEFINITIONS`; `web/lib/rankings/skaterWindowAggregation.ts:514 buildSkaterWindowAggregatesFromRollingRow`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Codex view (RANK-shot_attempts_per_60, calculation; Codex family 'Contextual skater rankings'):** Shot Attempts/60
  - Purpose: Individual shot attempts per 60 minutes in the selected window.
  - Inputs/units: Source rolling_player_game_metrics fields: shot_attempts_per_60_{window}, shot_attempts_per_60_total_last{n}, toi_seconds_total_last{n}, shot_attempts_per_60_shot_attempts_{baseline_window}, shot_attempts_per_60_toi_seconds_{baseline_window}. Denominator: Total TOI seconds in the selected player-production window.
  - Output scale: Events/expected goals per 60 minutes. Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
  - Consumers: Contextual rankings/player matrix/splits/trending/composites; metric definitions registry.
- **Audit context:**
  - Intended contract (Codex RANK-shot_attempts_per_60): NST individual Corsi For (ICF) / TOI seconds * 3600. Source: web/lib/rankings/metricDefinitions.ts:365. Minimum GP 1, TOI 300 seconds.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/metricDefinitions.test.ts`; `web/lib/rankings/skaterWindowAggregation.test.ts`
- **Leads (not audited):**
  - (codex:RANK-shot_attempts_per_60) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

## M-RNK-063 SOG/60

- **Match:** Codex only; Opus —; Codex RANK-sog_per_60
- **Possible related records (low-confidence location link, unconfirmed):** RNK-037
- **Purpose:** Shots on goal per 60 minutes in the selected window.
- **Where:** `web/lib/rankings/metricDefinitions.ts:959 CONTEXTUAL_RANKING_METRIC_DEFINITIONS`; `web/lib/rankings/skaterWindowAggregation.ts:514 buildSkaterWindowAggregatesFromRollingRow`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Codex view (RANK-sog_per_60, calculation; Codex family 'Contextual skater rankings'):** SOG/60
  - Purpose: Shots on goal per 60 minutes in the selected window.
  - Inputs/units: Source rolling_player_game_metrics fields: sog_per_60_{window}, sog_per_60_total_last{n}, toi_seconds_total_last{n}, sog_per_60_shots_{baseline_window}, sog_per_60_toi_seconds_{baseline_window}. Denominator: Total TOI seconds in the selected player-production window.
  - Output scale: Events/expected goals per 60 minutes. Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
  - Consumers: Contextual rankings/player matrix/splits/trending/composites; metric definitions registry.
- **Audit context:**
  - Intended contract (Codex RANK-sog_per_60): shots on goal / TOI seconds * 3600 Source: web/lib/rankings/metricDefinitions.ts:339. Minimum GP 1, TOI 300 seconds.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/metricDefinitions.test.ts`; `web/lib/rankings/skaterWindowAggregation.test.ts`
- **Leads (not audited):**
  - (codex:RANK-sog_per_60) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

## M-RNK-064 Unrealized xG

- **Match:** Codex only; Opus —; Codex RANK-unrealized_xg
- **Possible related records (low-confidence location link, unconfirmed):** RNK-037
- **Purpose:** Expected goals generated but not converted into goals.
- **Where:** `web/lib/rankings/metricDefinitions.ts:959 CONTEXTUAL_RANKING_METRIC_DEFINITIONS`; `web/lib/rankings/skaterWindowAggregation.ts:514 buildSkaterWindowAggregatesFromRollingRow`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Codex view (RANK-unrealized_xg, calculation; Codex family 'Contextual skater rankings'):** Unrealized xG
  - Purpose: Expected goals generated but not converted into goals.
  - Inputs/units: Source rolling_player_game_metrics fields: rolling_player_game_metrics.ixg_per_60_total_{window}, rolling_player_game_metrics.goals_per_60_total_{window}, rolling_player_game_metrics.ixg_per_60_ixg_{baseline_window}, rolling_player_game_metrics.goals_per_60_goals_{baseline_window}. Denominator: Metric-specific denominator described by the formula and methodology metadata.
  - Output scale: individual xG - goals Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
  - Consumers: Contextual rankings/player matrix/splits/trending/composites; metric definitions registry.
- **Audit context:**
  - Intended contract (Codex RANK-unrealized_xg): individual xG - goals Source: web/lib/rankings/metricDefinitions.ts:640. Minimum GP 1, TOI 600 seconds.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/metricDefinitions.test.ts`; `web/lib/rankings/skaterWindowAggregation.test.ts`
- **Leads (not audited):**
  - (codex:RANK-unrealized_xg) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

## M-RNK-065 xGA/60

- **Match:** Codex only; Opus —; Codex RANK-xga_per_60
- **Possible related records (low-confidence location link, unconfirmed):** RNK-037
- **Purpose:** On-ice expected goals against per 60 minutes.
- **Where:** `web/lib/rankings/metricDefinitions.ts:959 CONTEXTUAL_RANKING_METRIC_DEFINITIONS`; `web/lib/rankings/skaterWindowAggregation.ts:514 buildSkaterWindowAggregatesFromRollingRow`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Codex view (RANK-xga_per_60, calculation; Codex family 'Contextual skater rankings'):** xGA/60
  - Purpose: On-ice expected goals against per 60 minutes.
  - Inputs/units: Source rolling_player_game_metrics fields: rolling_player_game_metrics.oi_xga_total_{window}, rolling_player_game_metrics.toi_seconds_total_{window}, rolling_player_game_metrics.oi_xga_avg_{baseline_window}, rolling_player_game_metrics.toi_seconds_avg_{baseline_window}. Denominator: Total TOI seconds in the selected player-production window.
  - Output scale: Events/expected goals per 60 minutes. Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
  - Consumers: Contextual rankings/player matrix/splits/trending/composites; metric definitions registry.
- **Audit context:**
  - Intended contract (Codex RANK-xga_per_60): on-ice xGA / TOI seconds * 3600. Lower raw values are better. Source: web/lib/rankings/metricDefinitions.ts:486. Minimum GP 1, TOI 600 seconds.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/metricDefinitions.test.ts`; `web/lib/rankings/skaterWindowAggregation.test.ts`
- **Leads (not audited):**
  - (codex:RANK-xga_per_60) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

