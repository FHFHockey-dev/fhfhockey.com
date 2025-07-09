# Task List: Variance Hub Implementation

## Current Progress Bookmark (July 8, 2025)

**Current Status:** Task 2.5 completed - Performance over Expectation (POE) calculation algorithm fully implemented

**What's Working:**
- xFS prediction database tables created with proper schema and indexes
- Database query functions implemented for player stats and xFS data
- Daily cron job infrastructure set up for prediction generation and audit updates
- Training/validation system implemented using season split approach
- Complete utility functions for mapping Yahoo player IDs to NHL API player IDs
- **Fantasy Points Above Replacement (FPAR) calculation algorithm with comprehensive unit tests**
- **Positional Scarcity Value (PSV) calculation algorithm with comprehensive unit tests**
- **NEW: Volatility Score (VUDu) calculation algorithm with advanced streak analysis**
- **NEW: Bust Rate calculation algorithm with ADP-based expectation curves and reliability analysis**
- **NEW: Performance over Expectation (POE) calculation algorithm with regression analysis and tier classification**

**Recently Completed:**
- Task 2.5: Implemented comprehensive Performance over Expectation (POE) calculation system with:
  - Linear regression analysis engine for ADP vs Fantasy Points by position
  - Position-specific regression models (C, LW/RW, D, G) with R² confidence scoring
  - POE score calculation (Actual - Expected) with percentage and Z-score analysis
  - Percentile ranking system for relative performance measurement
  - Performance tier classification (Elite Overperformer/Solid Overperformer/Met Expectations/Underperformer/Major Bust)
  - Statistical outlier detection using 2+ standard deviation thresholds
  - Comprehensive integration with FPAR, PSV, VUDu, and Bust Rate metrics
  - Advanced regression analysis tools with model validation and confidence measures
  - Filtering and sorting capabilities by performance tier and POE score

**Next Immediate Steps:**
1. Begin Task 2.6: Create metrics aggregation functions for positional averages
2. Continue with remaining novel metrics tasks

**Key Technical Details for Context:**
- Using 2024-2025 season data split: Oct 2024 - Jan 2025 (training) vs Jan 2025 - Apr 2025 (validation)
- Database tables: `xfs_predictions_5_game`, `xfs_predictions_10_game`, `xfs_audit_log` with `player_name` column added
- Data sources: `wgo_skater_stats_totals` (season totals), `nst_gamelog_as_counts` (game logs), `wgo_skater_stats` (game-by-game)
- API endpoints: `/api/v1/db/generate-xfs-predictions`, `/api/v1/db/update-xfs-audit-logs`, `/api/v1/db/train-validate-xfs-model`
- Player mapping tables: `yahoo_players`, `yahoo_nhl_player_map_mat` with comprehensive utility functions
- **FPAR calculation with default 12-team Yahoo league configuration and customizable scoring**
- **PSV calculation with positional depth analysis and scarcity multipliers**
- **VUDu calculation with volatility metrics and risk classification system**
- **NEW: Bust Rate calculation with ADP-based expectation curves and reliability analysis**
- **NEW: POE calculation with regression analysis and performance tier classification**

**Files Modified in Current Session:**
- Fixed `train-validate-xfs-model.ts` with correct season dates and type handling
- Added player_name column to all xFS tables via migration
- Updated TypeScript interfaces to include player_name field
- Created `utils/database/player-id-mapping.ts` with complete mapping functionality
- Created `utils/database/player-id-mapping.test.ts` with comprehensive unit tests
- Updated `utils/database/variance-hub-queries.ts` to integrate player mapping functions
- **Verified `lib/variance-hub/metrics.ts` contains complete FPAR implementation**
- **Verified `lib/variance-hub/metrics.test.ts` contains comprehensive unit tests**
- **Added complete PSV (Positional Scarcity Value) calculation system to `lib/variance-hub/metrics.ts`**
- **Added comprehensive PSV unit tests to `lib/variance-hub/metrics.test.ts`**
- **Added complete VUDu (Volatility/Unpredictability) calculation system to `lib/variance-hub/metrics.ts`**
- **NEW: Added complete Bust Rate calculation system to `lib/variance-hub/metrics.ts`**
- **NEW: Added complete POE (Performance over Expectation) calculation system to `lib/variance-hub/metrics.ts`**

## File Tracking

**All files created, modified, or referenced during implementation:**

### Created Files:
- `utils/database/migrations/001_create_xfs_prediction_tables.sql` - Database migration for xFS prediction tables (updated with player_name column)
- `utils/database/migrations/002_create_xfs_indexes.sql` - Database indexes for xFS prediction tables
- `pages/api/v1/db/generate-xfs-predictions.ts` - API endpoint for daily xFS prediction generation (updated with player names)
- `pages/api/v1/db/update-xfs-audit-logs.ts` - API endpoint for updating audit logs with actual performance data
- `pages/api/v1/db/train-validate-xfs-model.ts` - API endpoint for training/validation using season split approach
- `scripts/cron-jobs/daily-xfs-predictions.sql` - Supabase cron job for daily prediction generation
- `scripts/cron-jobs/update-xfs-audit-logs.sql` - Supabase cron job for daily audit log updates
- `scripts/cron-jobs/train-validate-xfs-model.sql` - Supabase cron job for monthly model training/validation
- `scripts/cron-jobs/README.md` - Documentation for xFS cron job infrastructure
- `utils/database/player-id-mapping.ts` - Utility functions for mapping Yahoo player IDs to NHL API player IDs
- `utils/database/player-id-mapping.test.ts` - Unit tests for player ID mapping functions
- `lib/variance-hub/metrics.ts` - Novel metrics calculation functions with complete FPAR, PSV, and VUDu implementations
- `lib/variance-hub/metrics.test.ts` - Unit tests for metrics calculations with comprehensive coverage

### Modified Files:
- `utils/database/variance-hub-queries.ts` - Added comprehensive xFS prediction and audit log query functions
- `progress/tasks-prd-variance-hub.md` - Updated task completion status and added file tracking

### Referenced Files:
- `progress/supabase-table-structures.md` - Referenced for existing database table schemas

## Relevant Files

- `pages/variance-hub.tsx` - Main Variance Hub page component
- `pages/variance-hub.test.tsx` - Unit tests for the main page
- `components/VarianceHub/VarianceHubChart.tsx` - Interactive stock-market style chart component
- `components/VarianceHub/VarianceHubChart.test.tsx` - Unit tests for chart component
- `components/VarianceHub/VarianceHubTable.tsx` - Player data table with filtering
- `components/VarianceHub/VarianceHubTable.test.tsx` - Unit tests for table component
- `components/VarianceHub/ScoringConfiguration.tsx` - Fantasy scoring settings component
- `components/VarianceHub/ScoringConfiguration.test.tsx` - Unit tests for scoring configuration
- `components/VarianceHub/PlayerFilters.tsx` - Position and time period filtering component
- `components/VarianceHub/PlayerFilters.test.tsx` - Unit tests for filters
- `components/VarianceHub/PlayerBookmarks.tsx` - Player bookmarking functionality
- `components/VarianceHub/PlayerBookmarks.test.tsx` - Unit tests for bookmarks
- `lib/variance-hub/metrics.ts` - Novel metrics calculation functions (FPAR, PSV, VUDu, etc.)
- `lib/variance-hub/metrics.test.ts` - Unit tests for metrics calculations
- `lib/variance-hub/xfs-model.ts` - xFS predictive model functions
- `lib/variance-hub/xfs-model.test.ts` - Unit tests for xFS model
- `lib/variance-hub/fantasy-scoring.ts` - Fantasy scoring calculation utilities
- `lib/variance-hub/fantasy-scoring.test.ts` - Unit tests for fantasy scoring
- `lib/variance-hub/opponent-strength.ts` - Opponent strength calculation functions
- `lib/variance-hub/opponent-strength.test.ts` - Unit tests for opponent strength
- `scripts/xfs-daily-job.py` - Python script for daily xFS predictions
- `scripts/xfs-daily-job.test.py` - Unit tests for daily job script
- `utils/database/variance-hub-queries.ts` - Database query functions for variance hub
- `utils/database/variance-hub-queries.test.ts` - Unit tests for database queries
- `utils/database/migrations/001_create_xfs_prediction_tables.sql` - Migration for xFS prediction tables
- `hooks/useVarianceHubData.ts` - Custom hook for data fetching and state management
- `hooks/useVarianceHubData.test.ts` - Unit tests for custom hook
- `types/variance-hub.ts` - TypeScript type definitions for variance hub
- `styles/components/VarianceHub.module.scss` - Styling for variance hub components
- `progress/supabase-table-structures.md` - Reference for existing database table schemas

### Notes

- Unit tests should be placed alongside the code files they are testing
- Use `npx jest [optional/path/to/test/file]` to run tests
- The xFS model will require a separate Python environment for the daily job
- Database migrations will be needed for the new xFS tables
- Consider using a charting library like D3.js, Chart.js, or Recharts for interactive visualizations
- Reference `progress/supabase-table-structures.md` for existing database table structures when creating queries


### Novel Metrics

- Value Over Replacement Player, VORP: VORP=(Player FPPG−Replacement FPPG)×GamesPlayed // 
    - "Replacemennt player" (RP) is determined by roster size and number of teams
        - 16 roster spots and 12 teams 16*12=208, so player ranked 209 would be the replacement value, the FPPG of this player is our Replacement FPPG
        - Can/Should be broken down by position, 16 teams, 2 LW slots and 5 Bench slots means ~3 LW/team, 12*3=36 so the 37th ranked LW is our RP
- Regression Model: A regression analysis was performed with ADP as the independent variable (X) and total fantasy points as the dependent variable (Y). This generates a line of best fit, represented by the equation Y=mX+b
- POE Calculation: The POE for each player is then calculated as the residual from this regression line: POE=ActualFantasyPoints−ExpectedFantasyPoints


## Current xFS Algorithm Analysis (As of July 8, 2025)

### Current Implementation Issues:
The existing xFS prediction system is extremely basic and does NOT use machine learning:

**Current "Algorithm" (Oversimplified):**
```
xFS = (avgPoints * 5) + (avgShots * 0.9) + (avgTOI/60 * 0.5)
```

Where:
- `avgPoints` = average points in last 5 games
- `avgShots` = average shots in last 5 games  
- `avgTOI` = average time on ice in last 5 games

**Major Problems:**
1. No machine learning - just basic arithmetic
2. Only uses 3 variables (points, shots, TOI)
3. No opponent strength consideration
4. No linemate impact analysis
5. No injury likelihood assessment
6. No seasonal trends or momentum
7. No positional adjustments
8. Fixed weights (5, 0.9, 0.5) instead of learned parameters

### Proposed Neural Network xFS Algorithm:

**Input Features (35+ variables):**
1. **Recent Performance (10 games)**
   - Goals, assists, shots, hits, blocks, TOI per game
   - Shooting percentage trends
   - Power play usage and production

2. **Seasonal Context**
   - Games played, season progression
   - Home/away splits
   - Back-to-back game performance

3. **Opponent Strength Metrics**
   - Opponent defensive rating
   - Goals against per game
   - Penalty kill efficiency
   - Shot suppression rate

4. **Linemate Quality**
   - Linemate xFS ratings
   - Power play unit strength
   - Line combination stability

5. **Injury/Fatigue Indicators**
   - Games since injury return
   - Recent ice time changes
   - Performance decay patterns

**Neural Network Architecture:**
```
Input Layer (35 features) 
    ↓
Hidden Layer 1 (64 neurons, ReLU activation)
    ↓
Dropout Layer (0.3)
    ↓
Hidden Layer 2 (32 neurons, ReLU activation)
    ↓
Dropout Layer (0.2)
    ↓
Hidden Layer 3 (16 neurons, ReLU activation)
    ↓
Output Layer (3 neurons)
    ↓
[xFS_score, min_xFS, max_xFS]
```

**Training Data:**
- Historical game logs (2+ seasons)
- Feature engineering from raw stats
- Target: Actual fantasy scores achieved
- Train/validation split by time (not random)

**Algorithm Equation (High Level):**
```
xFS = NeuralNetwork(
    recent_performance_vector,
    opponent_strength_vector,
    linemate_quality_vector,
    injury_fatigue_vector,
    seasonal_context_vector
)

where confidence_interval = model_uncertainty + prediction_variance
```

This would be a proper machine learning approach instead of the current basic arithmetic.


## Tasks

- [ ] 1.0 Database Schema & Backend Infrastructure Setup
  - [x] 1.1 Create Supabase migration for xFS prediction tables (`xfs_predictions_5_game`, `xfs_predictions_10_game`, `xfs_audit_log`)
  - [x] 1.2 Set up database indexes for optimal query performance on prediction tables
  - [x] 1.3 Create database query functions for retrieving player statistics from existing tables
  - [x] 1.4 Create database query functions for xFS predictions and audit data
  - [x] 1.5 Set up daily cron job infrastructure for xFS model execution
  - [x] 1.6 Create utility functions for mapping Yahoo player IDs to NHL API player IDs

- [ ] 2.0 Novel Metrics Calculation System
  - [x] 2.1 Implement Fantasy Points Above Replacement (FPAR) calculation algorithm
  - [x] 2.2 Implement Positional Scarcity Value (PSV) calculation algorithm
  - [x] 2.3 Implement Volatility Score (VUDu) calculation algorithm
  - [x] 2.4 Implement Bust Rate calculation algorithm
  - [x] 2.5 Implement Performance over Expectation (POE) calculation algorithm
  - [ ] 2.6 Create metrics aggregation functions for positional averages
  - [ ] 2.7 Implement caching mechanism for calculated metrics to improve performance
  - [ ] 2.8 Create functions to calculate ADP differences from Yahoo data