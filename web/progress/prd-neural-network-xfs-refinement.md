# PRD: Neural Network xFS Refinement System

## Introduction/Overview

This PRD outlines the comprehensive refinement of the existing xFS (Expected Fantasy Score) neural network prediction system to achieve near-100% accuracy through advanced feature engineering, sophisticated rating systems, and real-time data integration. The current system uses basic arithmetic calculations; this project will transform it into a state-of-the-art machine learning system that analyzes 100+ features across player performance, team dynamics, opponent strength, and contextual factors.

**Problem Statement:** The current xFS prediction system is overly simplistic, using only 3 variables (points, shots, TOI) with fixed weights. This lacks the sophistication needed for accurate fantasy hockey predictions, missing critical factors like opponent strength, linemate chemistry, goalie performance, and contextual variables.

**Goal:** Build a neural network system that achieves the highest possible prediction accuracy by identifying and modeling the most common indicators of fantasy productivity with optimal pattern recognition for predictability.

## Goals

1. **Achieve Maximum Prediction Accuracy:** Strive for as close to 100% accuracy as possible through comprehensive data analysis and pattern recognition
2. **Implement Comprehensive Rating Systems:** Create detailed player, team, and goalie rating systems for context-aware predictions
3. **Advanced Linemate Integration:** Build sophisticated linemate chemistry analysis with real-time line combination tracking
4. **Real-time Model Updates:** Develop ensemble methods with continuous learning capabilities
5. **Feature Engineering Excellence:** Extract 100+ meaningful features from existing database tables to identify the strongest predictors of fantasy performance

## User Stories

1. **As a fantasy hockey analyst**, I want the xFS system to predict player performance with maximum accuracy so that I can make optimal lineup decisions with confidence.

2. **As a data scientist**, I want comprehensive feature importance analysis so that I can understand which factors most strongly predict fantasy success.

3. **As a developer**, I want modular rating systems (player, team, goalie) so that I can easily update and maintain different components independently.

4. **As a product manager**, I want real-time model performance monitoring so that I can track accuracy improvements and identify areas needing refinement.

5. **As an end user**, I want predictions that account for lineup changes, injuries, and matchup-specific factors so that my daily fantasy decisions are based on the most relevant information.

## Functional Requirements

### 1. Team Rating System
1.1. The system MUST create comprehensive team defensive ratings using goals against, shots against, penalty kill percentage, and save percentage metrics.
1.2. The system MUST calculate situational team performance ratings (home/away, back-to-back, rest days, travel distance).
1.3. The system MUST generate opponent strength scores that factor in recent performance trends (last 10 games weighted more heavily).
1.4. The system MUST track special teams effectiveness (power play and penalty kill units) as separate rating components.
1.5. The system MUST calculate goalie-adjusted team defensive ratings that account for starting goalie vs backup performance differentials.

### 2. Player Rating System
2.1. The system MUST generate individual offensive ratings incorporating goals, assists, shots, shooting percentage, and advanced metrics (Corsi, Fenwick, expected goals).
2.2. The system MUST create defensive impact ratings for all players using hits, blocks, takeaways, giveaways, and plus/minus metrics.
2.3. The system MUST calculate context-dependent ratings that adjust for zone starts, usage patterns, and quality of competition.
2.4. The system MUST track player performance trends with exponential decay weighting (recent games weighted more heavily).
2.5. The system MUST generate position-specific rating adjustments that account for different fantasy scoring patterns by position.

### 3. Goalie Rating System
3.1. The system MUST create comprehensive goalie ratings using save percentage, goals against average, quality starts, and high-danger save percentage.
3.2. The system MUST calculate rest-adjusted goalie performance ratings (days of rest impact on performance).
3.3. The system MUST track goalie performance against specific opponent types (high-scoring teams, low-scoring teams).
3.4. The system MUST generate starter vs backup probability models based on recent usage patterns and team situations.
3.5. The system MUST integrate goalie performance into opponent strength calculations for skater predictions.

### 4. Advanced Linemate Integration
4.1. The system MUST track real-time line combinations using time-on-ice together data from game logs.
4.2. The system MUST calculate line chemistry scores based on on-ice performance together vs apart.
4.3. The system MUST generate power play unit effectiveness ratings as separate entities from even-strength lines.
4.4. The system MUST account for linemate injury impact by modeling performance degradation when key linemates are absent.
4.5. The system MUST weight linemate quality based on actual ice time shared, not just roster listings.

### 5. Comprehensive Feature Engineering
5.1. The system MUST extract 100+ features from existing database tables (wgo_skater_stats, wgo_skater_stats_totals, nst_gamelog_as_counts).
5.2. The system MUST perform statistical analysis to identify the strongest predictors of fantasy performance.
5.3. The system MUST create rolling averages with multiple time windows (3, 5, 10, 15 games) for all key metrics.
5.4. The system MUST generate interaction features that capture relationships between different metrics (e.g., shots × shooting percentage).
5.5. The system MUST implement feature selection algorithms to identify the most predictive variables and eliminate noise.

### 6. Neural Network Architecture Enhancement
6.1. The system MUST implement ensemble methods combining multiple neural network architectures.
6.2. The system MUST support real-time model updating with new game data.
6.3. The system MUST provide feature importance analysis using SHAP (SHapley Additive exPlanations) values.
6.4. The system MUST implement uncertainty quantification to provide confidence intervals with predictions.
6.5. The system MUST support different model configurations for different prediction horizons (1-game, 5-game, 10-game).

### 7. Contextual Factor Integration
7.1. The system MUST incorporate schedule density factors (games in last/next week, travel distance).
7.2. The system MUST account for injury likelihood based on games played patterns and recent performance degradation.
7.3. The system MUST integrate weather data for outdoor games and arena-specific factors.
7.4. The system MUST model referee impact on penalty-dependent statistics (hits, penalty minutes).
7.5. The system MUST account for playoff motivation and meaningless game scenarios late in season.

### 8. Performance Monitoring and Validation
8.1. The system MUST track prediction accuracy across multiple metrics (MAE, RMSE, directional accuracy).
8.2. The system MUST provide position-specific accuracy analysis.
8.3. The system MUST implement A/B testing framework for comparing different model versions.
8.4. The system MUST generate daily accuracy reports with feature importance breakdowns.
8.5. The system MUST alert when model performance degrades below acceptable thresholds.

### 9. Data Pipeline Enhancement
9.1. The system MUST create automated data quality checks for all input features.
9.2. The system MUST implement real-time data ingestion for lineup changes and injury updates.
9.3. The system MUST handle missing data gracefully with appropriate imputation strategies.
9.4. The system MUST create data lineage tracking for debugging prediction anomalies.
9.5. The system MUST implement backup data sources for critical features.

### 10. API and Integration
10.1. The system MUST provide RESTful APIs for retrieving predictions, ratings, and feature importance.
10.2. The system MUST support batch prediction requests for multiple players.
10.3. The system MUST integrate with existing variance hub queries and database structure.
10.4. The system MUST provide model versioning and rollback capabilities.
10.5. The system MUST generate prediction explanations in human-readable format.

## Non-Goals (Out of Scope)

1. **External Data Sources:** This phase will focus exclusively on existing database tables. Integration with external APIs will be considered for future phases.
2. **Goalie-Specific xFS Predictions:** This system focuses on skater predictions. Goalie fantasy scoring will be addressed separately.
3. **Real-time Game Predictions:** Initial focus is on pre-game predictions. In-game adjustments will be future enhancement.
4. **Mobile App Integration:** API development only; mobile UI integration is out of scope.
5. **Historical Data Recreation:** Will not backfill predictions for historical games beyond what's needed for training.

## Technical Considerations

### Database Integration
- Leverage existing tables: `wgo_skater_stats`, `wgo_skater_stats_totals`, `nst_gamelog_as_counts`, `wgo_goalie_stats`, `wgo_goalie_stats_totals`
- Maintain compatibility with current `xfs_predictions_5_game`, `xfs_predictions_10_game`, and `xfs_audit_log` tables
- Use existing player ID mapping utilities for Yahoo integration

### Machine Learning Stack
- TensorFlow.js for neural network implementation
- Scikit-learn algorithms for feature selection and preprocessing
- SHAP library for feature importance analysis
- Ensemble methods combining multiple model architectures

### Performance Requirements
- Prediction generation must complete within 30 minutes for all active players
- Individual player predictions must return within 2 seconds via API
- Model training must support incremental learning without full retraining
- System must handle 1000+ concurrent API requests

### Data Quality
- Implement automated anomaly detection for input features
- Create data validation rules for all rating components
- Establish confidence thresholds for predictions based on data completeness
- Build fallback mechanisms for missing or invalid data

## Success Metrics

### Primary Accuracy Metrics
1. **Mean Absolute Error (MAE):** Target < 2.0 fantasy points for 5-game predictions
2. **Root Mean Square Error (RMSE):** Target < 3.0 fantasy points for 5-game predictions
3. **Directional Accuracy:** Target > 75% for predicting above/below season average performance
4. **Confidence Calibration:** Prediction confidence intervals should contain actual results 90% of the time

### Secondary Performance Metrics
1. **Feature Importance Stability:** Top 10 features should remain consistent across model retraining cycles
2. **Position-Specific Accuracy:** Each position (C, LW, RW, D) should meet accuracy targets independently
3. **Prediction Horizon Performance:** 1-game predictions should be 20% more accurate than 10-game predictions
4. **Comparative Performance:** System should outperform baseline models by at least 25% across all metrics

### Operational Metrics
1. **API Response Time:** 95th percentile < 2 seconds for individual predictions
2. **System Uptime:** 99.9% availability during prediction generation windows
3. **Data Pipeline Reliability:** < 0.1% data loss or corruption rate
4. **Model Training Efficiency:** Complete retraining in < 4 hours with new season data

## Implementation Phases

### Phase 1: Foundation (Weeks 1-4)
- Implement comprehensive team rating system
- Build goalie rating and integration framework
- Create advanced feature extraction pipeline
- Establish data quality monitoring

### Phase 2: Core Enhancement (Weeks 5-8)
- Develop sophisticated linemate integration system
- Implement ensemble neural network architecture
- Build player rating system with contextual adjustments
- Create feature importance analysis framework

### Phase 3: Optimization (Weeks 9-12)
- Implement real-time model updating capabilities
- Build comprehensive performance monitoring dashboard
- Optimize prediction accuracy through hyperparameter tuning
- Create API endpoints and integration testing

### Phase 4: Validation & Deployment (Weeks 13-16)
- Conduct extensive backtesting with historical data
- Implement A/B testing framework for model comparison
- Create comprehensive documentation and user guides
- Deploy to production with monitoring and alerting

## Open Questions

1. **Historical Training Data:** How many seasons of historical data should be used for initial model training to balance recency with sample size?

2. **Injury Data Integration:** What level of injury detail should be incorporated, and how should injury probability be modeled?

3. **Lineup Change Timing:** How should the system handle lineup changes that occur after predictions are generated but before games start?

4. **Model Ensemble Weighting:** Should ensemble model weights be static or dynamically adjusted based on recent performance?

5. **Feature Engineering Automation:** Should the system automatically discover new feature combinations, or should they be manually engineered?

6. **Cross-Position Modeling:** Should separate models be trained for each position, or should position be treated as a feature in a unified model?

7. **Prediction Confidence Thresholds:** At what confidence level should the system decline to make a prediction due to insufficient data?

8. **Real-time Data Dependencies:** Which data sources are critical enough to delay predictions if unavailable, versus which can use last-known values?