# PRD: FPAR Score Precomputation System

## Introduction/Overview
Currently, FPAR (Forecasting Performance Above Replacement) calculations are performed in real-time by querying large game log tables, which hits Supabase's 1000-row pagination limit and causes performance issues. This feature implements a precomputation system that processes game logs nightly and stores calculated FPAR scores in dedicated tables for fast retrieval.

## Goals
1. **Performance**: Reduce FPAR score retrieval time from seconds to milliseconds
2. **Scalability**: Handle thousands of players without pagination limits
3. **Accuracy**: Maintain precise FPAR calculations while improving speed
4. **Reliability**: Ensure scores are always up-to-date through automated processing
5. **Maintainability**: Create a system that can be easily extended for other metrics

## User Stories
- As a **fantasy hockey user**, I want to see FPAR scores instantly when browsing players so that I can make quick decisions
- As a **data analyst**, I want historical FPAR trends to be immediately available so that I can perform analysis without waiting
- As a **mobile user**, I want the app to load player rankings quickly even on slower connections
- As a **developer**, I want a reliable system that processes scores automatically so that I don't need to manually trigger calculations

## Functional Requirements

### 1. Database Schema
1.1. Create `fpar_skater_scores` table with columns:
- `player_id` (bigint, primary key)
- `season_id` (integer, primary key) 
- `date_calculated` (date, primary key)
- `fpar_score` (double precision)
- `fpar_percentile` (double precision)
- `games_played` (integer)
- `projection_confidence` (double precision)
- `position_code` (text)
- `updated_at` (timestamp)

1.2. Create `fpar_goalie_scores` table with similar structure

1.3. Create indexes on commonly queried columns:
- `(player_id, season_id)`
- `(season_id, fpar_score DESC)`
- `(position_code, season_id, fpar_score DESC)`

### 2. Calculation Engine
2.1. Create `/pages/api/v1/db/calculate-fpar-scores.ts` endpoint
2.2. Process all players in database (not just active ones)
2.3. Use incremental updates: append new daily snapshots for players with games that day
2.4. Calculate FPAR scores using the existing algorithm but with optimized data fetching
2.5. Handle current season (2024-25) and last 2 seasons (2022-23, 2023-24)
2.6. Implement error handling and retry logic for failed calculations

### 3. Data Processing Pipeline
3.1. Create scheduled job that runs nightly at 4:00 AM EST
3.2. Process players incrementally: append new rows for players with games that day
3.3. For players with no games, no new rows are added (values remain unchanged)
3.4. Recalculate rolling 5-game and 10-game FPAR averages for affected players
3.5. Update percentile rankings after all scores are calculated
3.6. Log processing statistics and errors

### 4. API Endpoints
4.1. `GET /api/v1/fpar/skater-scores` - Retrieve precomputed skater FPAR scores
4.2. `GET /api/v1/fpar/goalie-scores` - Retrieve precomputed goalie FPAR scores
4.3. `GET /api/v1/fpar/rankings` - Get top players by FPAR with pagination
4.4. `GET /api/v1/fpar/player/{playerId}` - Get specific player's FPAR history
4.5. `GET /api/v1/fpar/trends/{playerId}` - Get daily FPAR snapshots for trend analysis

### 5. Data Fetching Optimization
5.1. Use `fetchAllRows` utility to handle Supabase pagination automatically
5.2. Implement parallel processing for independent player calculations
5.3. Use database views to pre-aggregate commonly needed statistics
5.4. Cache frequently accessed reference data (team info, season dates)

## Non-Goals (Out of Scope)
- Real-time FPAR calculation during games
- Historical recalculation of FPAR scores before 2022-23 season
- FPAR calculations for non-NHL leagues
- Machine learning model improvements (focus on performance, not accuracy changes)
- Integration with other metrics (xFS, variance calculations) in this initial implementation

## Technical Considerations
- **Incremental Processing**: Only process and store new data for players with games on a given day
- **Storage Strategy**: Store daily snapshots for trend analysis and historical comparisons
- **Database Connections**: Use connection pooling to handle multiple concurrent calculations
- **Data Retention**: Keep daily snapshots for current season + last 2 seasons
- **Monitoring**: Add logging for processing time, success rates, and data quality metrics
- **Supabase RLS**: Configure Row Level Security policies for the new FPAR tables

## Success Metrics
- **Performance**: FPAR score retrieval time < 100ms (currently ~2-5 seconds)
- **Throughput**: Process all active players within 30 minutes during nightly job
- **Accuracy**: 99.9% of scores calculated successfully each night
- **Availability**: FPAR scores available 24/7 without calculation delays
- **Storage**: Efficient incremental storage (only new data added daily)

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)
- Create database tables and indexes
- Implement basic calculation engine with incremental updates
- Set up nightly processing job at 4:00 AM EST

### Phase 2: Optimization & Testing (Week 3)
- Add batch processing and parallel execution
- Implement error handling and retry logic
- Load test with full dataset to validate performance

### Phase 3: API Integration (Week 4)
- Immediately replace existing real-time FPAR calculations
- Update existing components to use precomputed scores
- Add new API endpoints for trend analysis

### Phase 4: Monitoring & Maintenance (Week 5)
- Implement monitoring and alerting
- Create data quality checks
- Document system for future extensions

## Deployment Strategy
- **Immediate replacement**: Replace existing real-time FPAR system as soon as precomputed scores are available
- **No parallel running**: Clean cutover to new system to avoid complexity
- **Fallback plan**: Keep existing calculation code commented out for emergency rollback

## Open Questions
1. Should we implement automatic cleanup of old daily snapshots (e.g., delete data older than 3 seasons)?
2. Do we need to handle player trades/team changes in the daily snapshot logic?
3. Should we add data validation to ensure FPAR scores are within expected ranges?
4. How should we handle edge cases where a player's recent games significantly change their FPAR score?
5. Should we implement alerts for when the nightly job fails or takes longer than expected?

## Future Extensibility
While this PRD focuses specifically on FPAR precomputation, the system architecture should be designed with extensibility in mind for future implementation of:
- Neural network xFS refinement calculations
- Variance hub metrics
- Other advanced hockey analytics that would benefit from precomputation