# Product Requirements Document: Variance Hub

## 1. Introduction/Overview

The Variance Hub is an advanced analytics page designed for analytically-focused fantasy hockey managers. It provides deep insights into player performance variance, predictive modeling, and comprehensive data visualization through interactive charts and tables. The feature combines historical performance data with novel metrics to create a sophisticated tool for fantasy hockey analysis.

**Problem it solves:** Fantasy hockey managers need advanced tools to analyze player performance variance, predict future performance, and make data-driven decisions based on comprehensive metrics beyond basic statistics.

**Goal:** Create a comprehensive analytics hub that enables fantasy managers to analyze player performance variance, predict future fantasy scores, and make informed roster decisions through advanced visualizations and predictive modeling.

## 2. Goals

1. **Performance Variance Analysis**: Provide visual tools to analyze player performance variance through interactive stock-market-style charts
2. **Predictive Accuracy**: Develop and maintain a highly accurate Expected Fantasy Score (xFS) model with daily updates
3. **Comprehensive Data Access**: Display all relevant player statistics with flexible filtering and customizable fantasy scoring configurations
4. **User Experience**: Create an intuitive interface that serves analytical users without being "dumbed down" for casual users
5. **Data Transparency**: Maintain audit trails for predictive model accuracy through historical xFS tracking

## 3. User Stories

### Primary User Stories
- **As an analytical fantasy manager**, I want to visualize player performance variance over time so that I can identify consistent vs. volatile players
- **As a fantasy manager**, I want to see predicted fantasy scores (xFS) for upcoming games so that I can make informed start/sit decisions
- **As a data-driven user**, I want to filter players by position and time periods so that I can analyze specific player pools
- **As a fantasy manager**, I want to configure custom scoring settings so that the analysis reflects my league's specific rules
- **As an analytical user**, I want to compare multiple players on the same chart so that I can make direct comparisons

### Secondary User Stories
- **As a fantasy manager**, I want to bookmark favorite players so that I can quickly access their data
- **As a researcher**, I want to export player data so that I can perform additional analysis
- **As a mobile user**, I want to access the variance hub on my phone so that I can check data on the go
- **As a fantasy manager**, I want to see historical xFS accuracy so that I can trust the predictive model

## 4. Functional Requirements

### 4.1 Data Model & Backend Requirements
1. **Novel Metrics Calculation**: System must calculate Fantasy Points Above Replacement (FPAR), Positional Scarcity Value (PSV), Volatility Score (VUDu), Bust Rate, and Performance over Expectation (POE) from raw data
2. **xFS Predictive Model**: System must implement a daily-updating predictive model that considers:
   - Historical performance trends
   - Line combinations and linemate ratings
   - Ice time patterns (regular and power play)
   - Opponent strength metrics
   - Player availability/injury likelihood
3. **xFS Data Storage**: System must create and maintain separate Supabase tables for:
   - `xfs_predictions_5_game` (5-game projections)
   - `xfs_predictions_10_game` (10-game projections)
   - `xfs_audit_log` (historical predictions for accuracy tracking)
4. **Daily Job Processing**: System must run daily calculations without overwriting previous predictions
5. **Player Rating System**: System must develop quantifiable ratings for linemates to boost/dilute xFS predictions

### 4.2 Interactive Chart Visualization
6. **Stock Market Style Chart**: System must provide an interactive line chart with:
   - Crosshairs that follow mouse movement
   - Zoom and pan functionality
   - Brushable timeline selector (small reference chart at bottom)
   - Hover details showing exact values
7. **Multi-Player Comparison**: Users must be able to add/remove multiple players on the same chart
8. **Time Range Selection**: Users must be able to select custom date ranges, seasons, weeks, months, games, or daily views
9. **Candlestick Charts**: System must provide toggle between line and candlestick views showing min/max xFS ranges
10. **Chart Data**: Charts must display ADP differences and all novel metrics (FPAR, PSV, VUDu, Bust Rate, POE)

### 4.3 Player Data Table
11. **Comprehensive Statistics**: Table must display high/low/average weekly scores based on user-configured fantasy settings
12. **Position Filtering**: Users must be able to filter by:
    - Granular: C, LW, RW, D, G
    - Semi-granular: FWD (C/LW/RW), D, G
    - Wide granular: SKT (all skaters), G
13. **Time Period Filtering**: Users must be able to filter by season, weeks, months, games, daily (excluding preseason, separate playoff category)
14. **Table Functionality**: 
    - Sort by any column
    - Pagination (100 players per page)
    - Export functionality (CSV/Excel)
    - Player bookmarking capability
15. **Scoring Configuration**: Users must be able to input custom fantasy scoring settings for both skaters and goalies

### 4.4 Fantasy Scoring System
16. **Skater Scoring**: Support for Goals, Assists, Hits, Blocks, PPP, PPG, PPA, SHP, SHG, SHA, STP, Shots, TOI, PIM, Plus/Minus
17. **Goalie Scoring**: Support for Wins, Saves, Save %, Shutouts, Games Started, Shots Against
18. **League Types**: Support for both points leagues (actual values) and category leagues (value over replacement)
19. **Scoring Persistence**: Users must be able to save and load scoring configurations

### 4.5 Positional Analysis
20. **Position Averages**: System must calculate and display positional averages for all metrics (high/low/average scores, xFS)
21. **Opponent Strength**: System must calculate and factor opponent defensive strength into predictions

## 5. Non-Goals (Out of Scope)

1. **Real-time Updates**: System will not provide real-time data updates (daily updates only)
2. **Authentication System**: No user authentication or login required for MVP
3. **Preseason Data**: Preseason statistics will be excluded from analysis
4. **Injury Tracking**: Detailed injury history beyond games played/available ratio
5. **Social Features**: No sharing, comments, or social media integration
6. **Trade Analysis**: No trade evaluation or roster construction tools
7. **League Integration**: No direct integration with fantasy platforms (Yahoo, ESPN, etc.)

## 6. Design Considerations

### 6.1 User Interface
- **Chart Design**: Stock market-style visualization similar to the attached temperature chart reference
- **Color Scheme**: Use team colors where appropriate, with clear contrast for readability
- **Mobile Responsiveness**: Full mobile support with touch-friendly interactions
- **Legend/Glossary**: Include comprehensive explanations for novel metrics without dumbing down content

### 6.2 Performance
- **Chart Rendering**: Use efficient charting library (D3.js, Chart.js, or similar) for smooth interactions
- **Data Loading**: Implement pagination and lazy loading for large datasets
- **Caching**: Cache calculated metrics to improve page load times

## 7. Technical Considerations

### 7.1 Data Sources
- **Primary Tables**: `wgo_skater_stats`, `nst_gamelog_as_counts`, `nst_gamelog_as_counts_oi`, `nst_gamelog_as_rates`, `nst_gamelog_as_rates_oi`
- **Season Totals**: `wgo_skater_stats_totals`, `nst_seasonlong_*` tables
- **Team Data**: `nst_team_all`, `nst_team_stats`, `wgo_team_stats`
- **ADP Data**: `yahoo_nhl_player_map_mat`, `yahoo_players`

### 7.2 New Database Schema
```sql
-- xFS Predictions Tables
CREATE TABLE xfs_predictions_5_game (
  id SERIAL PRIMARY KEY,
  player_id INTEGER,
  prediction_date DATE,
  game_date DATE,
  xfs_score DECIMAL,
  min_xfs DECIMAL,
  max_xfs DECIMAL,
  confidence_interval DECIMAL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE xfs_predictions_10_game (
  id SERIAL PRIMARY KEY,
  player_id INTEGER,
  prediction_date DATE,
  game_date DATE,
  xfs_score DECIMAL,
  min_xfs DECIMAL,
  max_xfs DECIMAL,
  confidence_interval DECIMAL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE xfs_audit_log (
  id SERIAL PRIMARY KEY,
  player_id INTEGER,
  prediction_date DATE,
  game_date DATE,
  predicted_xfs DECIMAL,
  actual_fantasy_score DECIMAL,
  accuracy_score DECIMAL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 7.3 Architecture
- **Backend**: Python-based prediction model with daily cron job
- **Frontend**: React components with advanced charting library
- **Database**: Supabase for data storage and real-time subscriptions
- **API Layer**: RESTful endpoints for data retrieval and configuration

## 8. Success Metrics

### 8.1 Primary Metrics
1. **Predictive Accuracy**: xFS model accuracy rate >75% for 5-game predictions, >65% for 10-game predictions
2. **User Engagement**: Average session duration >10 minutes
3. **Feature Adoption**: >50% of users utilize custom scoring configurations
4. **Chart Interaction**: >80% of users interact with chart features (zoom, pan, brush)

### 8.2 Secondary Metrics
1. **Data Export Usage**: Track export functionality usage
2. **Bookmark Utilization**: Percentage of users who bookmark players
3. **Mobile Usage**: Mobile traffic percentage and engagement rates
4. **Position Filter Usage**: Track most commonly used filter combinations

## 9. Implementation Phases

### Phase 1: MVP (Core Functionality)
- xFS predictive model development and daily job setup
- Basic interactive line chart with brushing and crosshairs
- Player data table with filtering and sorting
- Custom fantasy scoring configuration

### Phase 2: Advanced Features
- Candlestick chart implementation
- Multi-player comparison on charts
- Advanced filtering options
- Export and bookmarking functionality

### Phase 3: Polish & Optimization
- Mobile responsiveness optimization
- Performance improvements
- Comprehensive legend/glossary
- Enhanced predictive model accuracy

## 10. Open Questions

1. **Model Complexity**: Should the xFS model use machine learning algorithms (Random Forest, Neural Networks) or statistical regression methods?
2. **Data Refresh**: Should there be a manual refresh option for users or strictly automated daily updates?
3. **Chart Performance**: With multiple players and large datasets, what's the maximum number of players that can be compared simultaneously?
4. **Metric Weighting**: Should users be able to adjust the weighting of different factors in the xFS calculation?
5. **Historical Depth**: How many seasons of historical data should be included in the analysis?
6. **Opponent Strength**: Should opponent strength be calculated game-by-game or use season-long averages?

## 11. Suggested Optimizations & Enhancements

### 11.1 Advanced Analytics
- **Strength of Schedule Visualization**: Color-coded calendar showing upcoming opponent difficulty
- **Correlation Analysis**: Show which metrics are most predictive of future performance
- **Trend Detection**: Automatic detection of hot/cold streaks with statistical significance
- **Regression to Mean**: Indicators showing when players are likely to regress to their mean performance

### 11.2 User Experience Enhancements
- **Smart Defaults**: Remember user preferences for filters and scoring settings
- **Comparison Presets**: Pre-configured player comparisons (e.g., "Top 5 Centers", "Rookie Breakouts")
- **Alert System**: Notifications when bookmarked players have significant xFS changes
- **Performance Badges**: Visual indicators for players exceeding/underperforming xFS predictions

### 11.3 Advanced Visualizations
- **Radar Charts**: Multi-dimensional player comparisons
- **Heat Maps**: Position-based performance across different metrics
- **Scatter Plots**: Risk vs. reward analysis for player selection
- **Distribution Curves**: Show performance distribution patterns

### 11.4 Data Insights
- **Breakout Prediction**: Identify players with high breakout potential
- **Injury Risk Assessment**: Enhanced injury likelihood based on usage patterns
- **Line Chemistry Analysis**: Quantify chemistry between specific player combinations
- **Situational Splits**: Home/away, back-to-back games, rest days analysis

This comprehensive PRD provides a roadmap for developing the Variance Hub feature while maintaining focus on analytical depth and predictive accuracy for fantasy hockey managers.