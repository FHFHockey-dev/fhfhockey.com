## pass-2 GP compatibility role review

Sub-task: `5.3`

This artifact reviews whether `games_played`, `team_games_played`, and `gp_semantic_type` still have a valid compatibility role after the pass-2 availability / participation work.

## Decision Summary

- `games_played`
  - keep for now as a compatibility and convenience field
  - not authoritative compared with the explicit season / rolling support counters
- `team_games_played`
  - keep for now as a compatibility and convenience field
  - not authoritative compared with `season_team_games_available`
- `gp_semantic_type`
  - keep and treat as required compatibility metadata until legacy GP consumers are removed
  - this field still carries real meaning and should not be targeted before `gp_pct_*` and shared GP convenience fields are retired or isolated

## 1. `games_played`

Current behavior:

- written in [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts) as `historicalGpPctSnapshot.seasonPlayerGames`
- mirrors the season numerator support count for the current row
- on all-strength rows, it reads as season availability numerator
- on split-strength rows, it really means season participation numerator

Current role:

- convenience mirror of `season_games_played`
- compatibility bridge for older readers that expect a single GP-like count
- debug-friendly shorthand during row inspection

Why it is not authoritative:

- the explicit support counters already exist:
  - `season_games_played`
  - `three_year_games_played`
  - `career_games_played`
  - `games_played_lastN_team_games`
- the single field name is semantically overloaded across all-strength versus split-strength rows

Decision:

- keep for now
- do not treat as the primary contract surface
- do not add new readers that prefer it over the explicit support counters

## 2. `team_games_played`

Current behavior:

- written in [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts) as `historicalGpPctSnapshot.seasonTeamGames`
- mirrors the current season denominator support count

Current role:

- convenience mirror of `season_team_games_available`
- compatibility bridge for older GP% logic that still expects a single denominator field
- quick inspection field in debug surfaces

Why it is not authoritative:

- the explicit denominator contract already exists through:
  - `season_team_games_available`
  - `three_year_team_games_available`
  - `career_team_games_available`
  - `team_games_available_lastN`
- the name suggests actual games played rather than games available in the scoped contract, which is less precise than the canonical replacement naming

Decision:

- keep for now
- treat as compatibility / convenience only
- prefer the explicit `*_team_games_available` fields in any new reader or audit explanation

## 3. `gp_semantic_type`

Current behavior:

- written per row from `getGpOutputCompatibilityMode(config.state).semanticType`
- values are:
  - `availability`
  - `participation`

Current role:

- disambiguates whether the shared GP counters and legacy `gp_pct_*` fields mean:
  - ordinary all-strength availability, or
  - split-strength participation with positive TOI
- tells debug surfaces and reviewers how to interpret:
  - `games_played`
  - `team_games_played`
  - `gp_pct_*`

Why it is still required:

- split-strength rows intentionally suppress availability-named aliases and keep legacy GP compatibility fields during the participation-schema transition
- without `gp_semantic_type`, a reader cannot safely infer whether `games_played` or `gp_pct_avg_last5` is availability or participation
- the availability audit explicitly requires every GP-related panel to show `gp_semantic_type` while the mixed contract still exists

Decision:

- retain `gp_semantic_type` until both of these are true:
  - legacy `gp_pct_*` fields are retired or fully isolated from user-facing readers
  - shared convenience GP fields no longer carry split-strength semantic overload

## 4. Compatibility posture after this review

Recommended posture:

- authoritative availability / participation contract:
  - explicit replacement fields and support counters
- compatibility / convenience fields:
  - `games_played`
  - `team_games_played`
- required semantic guardrail:
  - `gp_semantic_type`

Implication for later schema cleanup:

- `games_played` and `team_games_played` can become cleanup candidates once downstream convenience reads are gone
- `gp_semantic_type` should be retired later than those fields, not earlier
- any cleanup plan that removes `gp_semantic_type` before legacy GP semantics are gone would make existing rows easier to misinterpret, not safer
