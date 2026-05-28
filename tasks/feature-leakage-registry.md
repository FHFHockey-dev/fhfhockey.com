# Feature Leakage Registry

The canonical implementation is `web/lib/ml/featureLeakageRegistry.ts`.

Before a prediction, trending, or training builder consumes a new table or feature family, register it with one of these categories:

- `pregame_safe`: known before puck drop without freshness checks.
- `pregame_safe_with_freshness`: safe only with source timestamps, expiry, or strict as-of joins.
- `in_game_only`: created during the target game.
- `postgame_descriptive`: derived from completed game events or same-game deployment.
- `target_leakage`: directly or indirectly encodes the label/output.
- `unknown`: not approved for model use until audited.

Model builders should call `validateFeatureLeakageUsage` or `assertFeatureLeakageUsage` before adding feature tables or encoded feature keys to a matrix. Unknown sources intentionally fail closed.

Current pregame-safe examples:

- `games`, `teams`, `seasons`
- `nhl_xg_team_game_travel_fatigue_features`

Current freshness-gated examples:

- `player_status_history`
- `goalie_start_projections`
- lineup source tables
- NHL EDGE game/daily metric tables
- dated team strength and NST/WGO history

Current postgame-only examples:

- `nhl_xg_shot_predictions`
- xG aggregate tables
- shot-assist, transition, created-xG, QoT/QoC, and adjusted-impact outputs

Direct target-leakage examples:

- `shotEventType:goal`
- `eventTypeDescKey:goal`
- `label_goal`
- `isGoal`
- serving output tables such as `game_prediction_outputs`
