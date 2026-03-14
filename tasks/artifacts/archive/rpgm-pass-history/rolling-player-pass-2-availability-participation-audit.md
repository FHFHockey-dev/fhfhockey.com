# Rolling Player Pass-2 Availability and Participation Audit

## Purpose

This artifact is the availability / participation portion of the pass-2 audit.

It covers every persisted availability, participation, and GP-compatibility field in `rolling_player_game_metrics` and records, for each contract surface:

- stored field set
- source tables
- source fields
- code path
- canonical formula
- intended hockey meaning
- current stored-field behavior
- reconstruction method
- rolling-window semantics
- traded-player and split-strength implications
- legacy alias behavior

This artifact does not assign final status buckets yet. Status ledger work remains separate in `/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-notes-pass-2.md`.

## Scope

Availability / participation field surface from the generated row type:

- canonical percentage fields: `14`
  - availability:
    - `season_availability_pct`
    - `three_year_availability_pct`
    - `career_availability_pct`
    - `availability_pct_last3_team_games`
    - `availability_pct_last5_team_games`
    - `availability_pct_last10_team_games`
    - `availability_pct_last20_team_games`
  - participation:
    - `season_participation_pct`
    - `three_year_participation_pct`
    - `career_participation_pct`
    - `participation_pct_last3_team_games`
    - `participation_pct_last5_team_games`
    - `participation_pct_last10_team_games`
    - `participation_pct_last20_team_games`
- canonical support counters: `21`
  - shared / legacy convenience:
    - `games_played`
    - `team_games_played`
  - season / historical support:
    - `season_games_played`
    - `season_team_games_available`
    - `three_year_games_played`
    - `three_year_team_games_available`
    - `career_games_played`
    - `career_team_games_available`
    - `season_participation_games`
    - `three_year_participation_games`
    - `career_participation_games`
  - rolling support:
    - `games_played_last3_team_games`
    - `games_played_last5_team_games`
    - `games_played_last10_team_games`
    - `games_played_last20_team_games`
    - `team_games_available_last3`
    - `team_games_available_last5`
    - `team_games_available_last10`
    - `team_games_available_last20`
    - `participation_games_last3_team_games`
    - `participation_games_last5_team_games`
    - `participation_games_last10_team_games`
    - `participation_games_last20_team_games`
- contextual contract field: `1`
  - `gp_semantic_type`
- legacy GP compatibility fields: `13`
  - `gp_pct_total_all`
  - `gp_pct_total_last3`
  - `gp_pct_total_last5`
  - `gp_pct_total_last10`
  - `gp_pct_total_last20`
  - `gp_pct_avg_all`
  - `gp_pct_avg_last3`
  - `gp_pct_avg_last5`
  - `gp_pct_avg_last10`
  - `gp_pct_avg_last20`
  - `gp_pct_avg_season`
  - `gp_pct_avg_3ya`
  - `gp_pct_avg_career`

Total availability / participation / compatibility fields in scope:

- `49`

## Shared Availability Contract

### Source contract

Availability semantics are owned by:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerAvailabilityContract.ts`

The contract distinguishes:

- all-strength rows:
  - semantic type: `availability`
- split-strength rows:
  - semantic type: `participation`

Replacement-intent meanings:

- all-strength availability:
  - numerator:
    - team games in which the player appeared
  - denominator:
    - team games available in scope
- split-strength participation:
  - numerator:
    - team games with positive TOI in the strength state
  - denominator:
    - team games available in scope

### Accumulator and snapshot code path

Availability and participation arithmetic is produced through:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingHistoricalAverages.ts`
  - `createHistoricalGpPctAccumulator()`
  - `updateHistoricalGpPctAccumulator(...)`
  - `getHistoricalGpPctSnapshot(...)`
  - `getRollingGpPctSnapshot(...)`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `didPlayerCountAsAppearance(...)`
  - `getGpOutputCompatibilityMode(...)`
  - `applyGpOutputs(...)`
  - `applyLegacyGpAliases(...)`

### Underlying event inputs

Availability / participation is not driven by NST stat columns directly. It depends on:

- WGO row spine for per-date row existence
- resolved `playedThisGame` decision
- per-row `teamGamesPlayed` progression for the current team bucket
- split-strength TOI resolution for participation determination

Source tables feeding those inputs:

- `wgo_skater_stats`
  - row spine
  - game date
  - original game id
- `games`
  - current-team game ledger validity
  - known `game_id` mapping
- split-specific NST counts / counts_oi / rates
  - only insofar as they provide TOI used by `didPlayerCountAsAppearance(...)` on split-strength rows

## Shared Semantics

### Season and historical scopes

Season, 3YA, and career scopes are player-centered across all stints in scope:

- season scope:
  - all player stints in the current season
- 3YA scope:
  - current season plus prior two seasons
- career scope:
  - all seasons in the accumulator

This is true for both:

- all-strength availability
- split-strength participation

### Rolling scopes

Rolling `lastN` availability / participation scopes are current-team team-game windows:

- `last3`
- `last5`
- `last10`
- `last20`

Meaning:

- denominator:
  - current team's last N chronological team games through the row date
- numerator:
  - player appearances or positive-TOI participations within those team games

This is intentionally different from additive / ratio / weighted-rate appearance windows.

### Appearance decision

`didPlayerCountAsAppearance(...)` in `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` defines the numerator inclusion rule:

- `strength = "all"`
  - always `true` for every WGO row
- split strengths:
  - `true` only when resolved split TOI is `> 0`

This is the dividing line between availability and participation semantics.

## Contract Surface Audit

### 1. Canonical All-Strength Availability Fields

Fields:

- percentages:
  - `season_availability_pct`
  - `three_year_availability_pct`
  - `career_availability_pct`
  - `availability_pct_last3_team_games`
  - `availability_pct_last5_team_games`
  - `availability_pct_last10_team_games`
  - `availability_pct_last20_team_games`
- support counters:
  - `season_games_played`
  - `season_team_games_available`
  - `three_year_games_played`
  - `three_year_team_games_available`
  - `career_games_played`
  - `career_team_games_available`
  - `games_played_last3_team_games`
  - `games_played_last5_team_games`
  - `games_played_last10_team_games`
  - `games_played_last20_team_games`
  - `team_games_available_last3`
  - `team_games_available_last5`
  - `team_games_available_last10`
  - `team_games_available_last20`

Primary code path:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingHistoricalAverages.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `getGpOutputCompatibilityMode("all")`
  - `applyGpOutputs(...)`

Canonical formulas:

- `season_availability_pct = season_games_played / season_team_games_available`
- `three_year_availability_pct = three_year_games_played / three_year_team_games_available`
- `career_availability_pct = career_games_played / career_team_games_available`
- `availability_pct_lastN_team_games = games_played_lastN_team_games / team_games_available_lastN`

Intended hockey meaning:

- share of team games in which the player appeared

Current stored-field behavior:

- all-strength rows populate availability percentage fields
- all-strength rows suppress participation percentage fields
- support counters are populated directly from the GP accumulator snapshots
- `games_played` and `team_games_played` duplicate current-season support counts for convenience

Reconstruction method:

1. build the player-centered season and career counters across all stints
2. build the current-team rolling windows from the current team bucket
3. divide player-game counts by team-game counts

Evidence from tests:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`
  - confirms all-strength availability aliases populate while participation aliases remain null
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingHistoricalAverages.test.ts`
  - confirms healthy one-team and missed-game availability calculations
  - confirms traded-player season scope stays player-centered across stints

### 2. Canonical Split-Strength Participation Fields

Fields:

- percentages:
  - `season_participation_pct`
  - `three_year_participation_pct`
  - `career_participation_pct`
  - `participation_pct_last3_team_games`
  - `participation_pct_last5_team_games`
  - `participation_pct_last10_team_games`
  - `participation_pct_last20_team_games`
- support counters:
  - `season_participation_games`
  - `three_year_participation_games`
  - `career_participation_games`
  - `participation_games_last3_team_games`
  - `participation_games_last5_team_games`
  - `participation_games_last10_team_games`
  - `participation_games_last20_team_games`
- shared denominator counters:
  - `season_team_games_available`
  - `three_year_team_games_available`
  - `career_team_games_available`
  - `team_games_available_last3`
  - `team_games_available_last5`
  - `team_games_available_last10`
  - `team_games_available_last20`

Primary code path:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `didPlayerCountAsAppearance(...)`
  - `getGpOutputCompatibilityMode(split strength)`
  - `applyGpOutputs(...)`

Canonical formulas:

- `season_participation_pct = season_participation_games / season_team_games_available`
- `three_year_participation_pct = three_year_participation_games / three_year_team_games_available`
- `career_participation_pct = career_participation_games / career_team_games_available`
- `participation_pct_lastN_team_games = participation_games_lastN_team_games / team_games_available_lastN`

Intended hockey meaning:

- share of team games in which the player logged positive TOI in the selected strength state

Current stored-field behavior:

- split-strength rows populate participation fields
- split-strength rows force availability percentage fields to `null`
- split-strength rows still populate the shared games-played and team-games-available support counters
- split-strength rows populate `gp_pct_*` as legacy participation aliases until the participation schema fully replaces them

Reconstruction method:

1. resolve split-strength TOI for each row
2. count numerator only where TOI is positive
3. reuse the same current-team team-game denominators as the availability contract
4. divide participation games by team games available

Evidence from tests:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`
  - confirms split-strength rows suppress availability aliases and emit participation aliases

### 3. Shared Support Counters and Convenience Fields

Fields:

- `games_played`
- `team_games_played`
- `season_games_played`
- `season_team_games_available`
- `three_year_games_played`
- `three_year_team_games_available`
- `career_games_played`
- `career_team_games_available`
- `games_played_last3_team_games`
- `games_played_last5_team_games`
- `games_played_last10_team_games`
- `games_played_last20_team_games`
- `team_games_available_last3`
- `team_games_available_last5`
- `team_games_available_last10`
- `team_games_available_last20`

Current stored-field behavior:

- these fields are always populated regardless of strength
- on split strengths, the `games_played*` family really means participation numerator counts rather than plain all-strength availability
- `games_played` and `team_games_played` are convenience mirrors of current-season numerator and denominator support

Semantic implication:

- these shared counter names are legacy-friendly but semantically overloaded
- pass-2 validation must not assume that `games_played` means the same thing on `all` and `ev` rows without checking `gp_semantic_type`

### 4. Context Label: `gp_semantic_type`

Field:

- `gp_semantic_type`

Current stored-field behavior:

- `all` rows store `availability`
- split-strength rows store `participation`

Primary code path:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `getGpOutputCompatibilityMode(...)`
  - row upsert payload at write time

Intended meaning:

- tells downstream readers how to interpret the GP-like surfaces on the row

Validation requirement:

- every audit and every `trendsDebug.tsx` availability panel must show `gp_semantic_type` alongside shared support counters and legacy `gp_pct_*`

### 5. Legacy GP Compatibility Surface

Fields:

- `gp_pct_total_all`
- `gp_pct_total_last3`
- `gp_pct_total_last5`
- `gp_pct_total_last10`
- `gp_pct_total_last20`
- `gp_pct_avg_all`
- `gp_pct_avg_last3`
- `gp_pct_avg_last5`
- `gp_pct_avg_last10`
- `gp_pct_avg_last20`
- `gp_pct_avg_season`
- `gp_pct_avg_3ya`
- `gp_pct_avg_career`

Primary code path:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `applyLegacyGpAliases(...)`

Current stored-field behavior:

- all-strength rows:
  - `gp_pct_*` is derived from canonical availability fields
  - `gp_pct_avg_*` is not a distinct averaging pass; it mirrors the same values as the canonical availability outputs
- split-strength rows:
  - `gp_pct_*` remains the legacy participation alias surface
  - these fields still carry split-strength positive-TOI semantics even though their names suggest generic games played

Canonical formulas:

- all-strength:
  - `gp_pct_total_all = season_availability_pct`
  - `gp_pct_avg_all = gp_pct_total_all`
  - `gp_pct_avg_season = season_availability_pct`
  - `gp_pct_avg_3ya = three_year_availability_pct`
  - `gp_pct_avg_career = career_availability_pct`
  - `gp_pct_total_lastN = availability_pct_lastN_team_games`
  - `gp_pct_avg_lastN = gp_pct_total_lastN`
- split-strength:
  - `gp_pct_total_all = season_participation_pct`
  - `gp_pct_avg_all = gp_pct_total_all`
  - `gp_pct_avg_season = season_participation_pct`
  - `gp_pct_avg_3ya = three_year_participation_pct`
  - `gp_pct_avg_career = career_participation_pct`
  - `gp_pct_total_lastN = participation_pct_lastN_team_games`
  - `gp_pct_avg_lastN = gp_pct_total_lastN`

Key audit implication:

- `gp_pct_avg_*` is a naming artifact, not a real average
- any downstream consumer still using `gp_pct_*` must be interpreted through `gp_semantic_type`

Evidence from tests:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`
  - confirms all-strength `gp_pct_*` mirrors canonical availability
  - confirms split-strength `gp_pct_*` remains populated while availability aliases are suppressed

## Traded-Player and Missed-Game Semantics

### Traded players

- season, 3YA, and career scopes are player-centered across all stints
- rolling `lastN` windows are current-team-only
- this means one row can legitimately have:
  - season availability / participation including prior team games
  - rolling `lastN` percentages including only current-team games

### Missed games

- denominator includes missed team games in scope
- numerator only increments when the player appeared or participated
- this is why availability and participation fields can decline while raw rolling metric families remain based only on appearance windows

Evidence from tests:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingHistoricalAverages.test.ts`
  - `counts missed games in the denominator for availability scopes`
  - `keeps season availability player-centered after a trade instead of collapsing to the current team bucket`

## Diagnostics and Validation Notes

- suspicious-output diagnostics already compare canonical availability ratios to raw support counters and flag mismatches
- pass-2 validation must treat stale `games` and stale WGO row spine as blockers because both corrupt the denominator ledger
- `trendsDebug.tsx` must show:
  - `gp_semantic_type`
  - current numerator / denominator counters
  - current-team rolling team-game window membership
  - traded-player split between season-wide and current-team rolling scopes
  - legacy `gp_pct_*` side-by-side with canonical outputs behind a compatibility toggle

## How This Artifact Should Be Used

- task `2.5` should keep contextual labels such as `gp_semantic_type`, `pp_unit`, and line context distinct from arithmetic metrics while still auditing their stored meaning
- tasks `2.6` and `2.7` should translate the availability / participation surfaces into:
  - a formula-only status entry in `/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-notes-pass-2.md`
  - an action item in `/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-action-items-pass-2.md` whenever naming ambiguity, compatibility drag, or debug-console visibility needs follow-up
- tasks in `3.x` should use this artifact for live validation examples involving:
  - healthy one-team availability
  - missed-game denominator growth
  - traded-player season-versus-current-team window differences
