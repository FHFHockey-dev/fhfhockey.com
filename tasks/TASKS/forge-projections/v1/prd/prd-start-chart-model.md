# Start Chart & Predictive Model - Comprehensive Plan

# Context - Table Schema Ledger File:
** Markdown File with the Schemas for all Team tables in the Supabase **
- nst-team-tables-schemas.md

## 1. Project Overview
**Goal:** Build a "Start Chart" that ranks players by projected fantasy output for upcoming games.
**Core Logic:** `Projection = (Baseline * w1 + Trend * w2) * MatchupFactor * UsageFactor`

## 2. Data Architecture & Schemas

### A. Existing / Foundational Tables

#### 1. `team_power_ratings_daily` (Materialized View)
*Source: `sql/001_team_power_ratings.sql`*
Provides the defensive and offensive strength of every team for every day of the season.
*   `team_abbreviation` (text)
*   `date` (date)
*   `season_id` (int)
*   `xgf_per_60` (numeric): Expected Goals For (Offense Rating)
*   `xga_per_60` (numeric): Expected Goals Against (Defense Rating)
*   `hdca_per_60` (numeric): High Danger Chances Against (Defensive Quality)
*   `ca_per_60` (numeric): Corsi Against (Shot Volume Allowed)
*   `pdo` (numeric): Luck factor (Sv% + Sh%)

#### 2. `rolling_player_game_metrics`
*Source: `web/pages/trends/player/[playerId].tsx`*
Provides the player's recent form vs baseline.
*   `player_id` (int)
*   `game_date` (date)
*   `goals_avg_last5` / `goals_avg_all`
*   `assists_avg_last5` / `assists_avg_all`
*   `sog_per_60_avg_last5` / `sog_per_60_avg_all`
*   `ixg_per_60_avg_last5` / `ixg_per_60_avg_all`

### B. New Tables Required

#### 3. `team_discipline_stats`
Tracks how often teams take penalties (giving opponents PP time) and how often they draw them.
*   `team_id` (int)
*   `date` (date)
*   `times_shorthanded_per_60` (float): Predicts Opponent PP Opportunities.
*   `times_powerplay_per_60` (float): Predicts Own PP Opportunities.
*   `penalties_taken_per_60` (float): Explicit penalty tracking.
*   `penalties_drawn_per_60` (float): Explicit penalty drawing.
*   `toi_shorthanded_per_game` (float): Average time spent on PK per game.
*   `hits_taken_per_60` (float): Predicts Opponent Hit totals.
*   `shots_blocked_by_opponent_per_60` (float): Predicts Opponent Block totals.

#### 4. `goalie_start_projections`
Predicts who will start and how they will perform.
*   `game_id` (int)
*   `team_id` (int)
*   `player_id` (int)
*   `start_probability` (float): 0.0 - 1.0 (Based on `GoalieShareChart` logic).
*   `projected_gsaa_per_60` (float): Goals Saved Above Average projection.
*   `confirmed_status` (boolean): True if starter is confirmed.

#### 5. `player_sustainability_metrics` (The Barometer)
Quantifies "Luck" vs "Skill" to regress trends.
*   `player_id` (int)
*   `date` (date)
*   `shooting_percentage_L10` (float)
*   `shooting_percentage_career` (float)
*   `oiSH_percentage_L10` (float): On-Ice Shooting % (Luck metric).
*   `ipp_L10` (float): Individual Point Percentage (Involvement metric).
*   `status` (enum): 'Sustainable', 'Regression_Negative', 'Regression_Positive'.

#### 6. `player_projections` (Output Table)
The final calculated projections for the Start Chart.
*   `player_id` (int)
*   `game_id` (int)
*   `opponent_team_id` (int)
*   `proj_goals` (float)
*   `proj_assists` (float)
*   `proj_shots` (float)
*   `proj_pp_points` (float)
*   `proj_hits` (float)
*   `proj_blocks` (float)
*   `proj_pim` (float)
*   `proj_fantasy_points` (float)
*   `matchup_grade` (float): 0-100 score of how favorable the matchup is.

## 3. Implementation Roadmap

### Phase 1: Data Engineering (The Foundation)
1.  **Team Discipline:** Create `team_discipline_stats` table and populate it from game logs (Boxscore data).
2.  **Goalie Logic:** Extract logic from `GoalieShareChart` into a server-side job to populate `goalie_start_projections`.
3.  **Barometer:** Create a script to calculate `player_sustainability_metrics` using `rolling_player_game_metrics` as a base.

### Phase 2: The Projection Algorithm
1.  **Baseline:** Start with `rolling_player_game_metrics` (Season Avg).
2.  **Trend Adjustment:** Apply `player_sustainability_metrics` to regress/boost the baseline.
    *   *If Sh% is 25% (Career 12%), regress projection downwards.*
3.  **Matchup Adjustment:**
    *   **SOG:** `Proj_SOG = Baseline_SOG * (Opponent_CA_per_60 / League_Avg_CA_per_60)`
    *   **Goals:** `Proj_Goals = Proj_SOG * Player_Sh% * (Opponent_Goalie_GSAA_Factor)`
    *   **PP Points:** `Proj_PPP = Baseline_PPP * (Opponent_Times_Shorthanded / League_Avg)`
4.  **Linemate Adjustment (Advanced):**
    *   Check `lineCombinations` for current linemates.
    *   Apply a multiplier if playing with top-tier playmakers (based on their `assists_avg_all`).

### Phase 3: The Start Chart UI
1.  **View:** A sortable grid of players.
2.  **Columns:** Player, Opponent, Matchup Grade (Color-coded), Proj Points.
3.  **Features:**
    *   "Sit/Start" recommendation based on roster size.
    *   "Streamer" mode (Show available players with high projections).

## 4. Immediate Tasks
1.  **Database:** Run migrations for `team_discipline_stats` and `player_projections`.
2.  **Backend:** Create `api/v1/db/update-projections.ts` to run the algorithm.
3.  **Frontend:** Scaffold the `StartChart` component.