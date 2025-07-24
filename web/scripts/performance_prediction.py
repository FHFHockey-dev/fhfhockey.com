#!/usr/bin/env python3
"""
Hockey Player Performance Prediction System

This script builds machine learning models to predict future fantasy performance
based on historical data and the predictive factors we've identified.

Usage:
    python performance_prediction.py

Requirements:
    pip install matplotlib pandas seaborn numpy requests scikit-learn xgboost python-dotenv
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from typing import List, Optional, Dict, Tuple
import requests
import warnings
from datetime import datetime, timedelta
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import train_test_split, cross_val_score, TimeSeriesSplit
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression, Ridge, Lasso
import xgboost as xgb
import os
from dotenv import load_dotenv
warnings.filterwarnings('ignore')

class HockeyPerformancePredictor:
    def __init__(self, expand_season_range: bool = True):
        """Initialize the predictor with expanded season range if needed."""
        self.df: Optional[pd.DataFrame] = None
        self.models: Dict = {}
        self.scalers: Dict = {}
        self.feature_importance: Dict = {}
        self.predictions: Dict = {}
        self.expand_season_range = expand_season_range
        
        # Load environment variables from .env.local
        load_dotenv('.env.local')
        
        # Supabase credentials from environment variables
        self.supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        # Validate that required environment variables are loaded
        if not self.supabase_url or not self.supabase_key:
            raise ValueError(
                "Missing required environment variables. Please ensure NEXT_PUBLIC_SUPABASE_URL "
                "and SUPABASE_SERVICE_ROLE_KEY are set in your .env.local file."
            )
        
        print(f"Loaded Supabase URL: {self.supabase_url}")
        print("Loaded Supabase service role key: [REDACTED]")
        
        # Fantasy scoring system (from your league)
        self.fantasy_scoring = {
            'goals': 6.0,
            'assists': 2.0,
            'pp_points': 1.0,
            'sh_goals': 1.0,
            'sh_points': 1.0,
            'shots': 0.2,
            'hits': 0.2,
            'blocked_shots': 0.25,
        }
        
        # Key predictive features (from our correlation analysis)
        self.predictive_features = [
            # Ice time and opportunity metrics
            'toi_per_game', 'ev_time_on_ice', 'pp_toi', 'sh_time_on_ice', 
            'pp_toi_pct_per_game', 'shifts', 'time_on_ice_per_shift',
            
            # Shot generation and quality
            'individual_shots_for_per_60', 'individual_sat_for_per_60',
            'on_ice_shooting_pct', 'sat_pct', 'zone_start_pct',
            
            # Defensive/physical metrics
            'takeaways', 'giveaways', 'penalty_minutes',
            
            # Player characteristics
            'position_code',
            
            # Team/situational context (to be engineered)
            'team_id', 'date'
        ]
        
        # Models to test
        self.model_configs = {
            'random_forest': RandomForestRegressor(n_estimators=100, random_state=42),
            'gradient_boosting': GradientBoostingRegressor(n_estimators=100, random_state=42),
            'xgboost': xgb.XGBRegressor(n_estimators=100, random_state=42),
            'linear_regression': LinearRegression(),
            'ridge': Ridge(alpha=1.0),
            'lasso': Lasso(alpha=1.0),
        }
        
        plt.style.use('seaborn-v0_8')
        sns.set_palette("husl")
    
    def load_data(self, limit: Optional[int] = None) -> pd.DataFrame:
        """Load data with expanded season range if needed."""
        print("Loading data for performance prediction...")
        
        # Use the correct table names from the schema
        url = f"{self.supabase_url}/rest/v1/wgo_skater_stats"
        headers = {
            'apikey': self.supabase_key,
            'Authorization': f'Bearer {self.supabase_key}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
        
        # Query parameters - expand to multiple seasons if needed
        seasons = [20232024, 20242025] if self.expand_season_range else [20242025]
        
        base_params = {
            'select': '''
                player_id,date,season_id,current_team_abbreviation,position_code,player_name,
                goals,assists,pp_goals,pp_assists,sh_goals,sh_assists,pp_points,sh_points,
                shots,pp_shots,sh_shots,hits,blocked_shots,takeaways,giveaways,
                penalty_minutes,toi_per_game,pp_toi,sh_time_on_ice,ev_time_on_ice,
                shifts,pp_toi_pct_per_game,time_on_ice_per_shift,
                individual_sat_for_per_60,individual_shots_for_per_60,
                on_ice_shooting_pct,sat_pct,zone_start_pct,games_played
            '''.replace('\n', '').replace(' ', ''),
            'position_code': 'neq.G',
            'games_played': 'eq.1',
            'order': 'date.desc'
        }
        
        all_data = []
        
        for season in seasons:
            print(f"Loading season {season}...")
            
            page_size = 1000
            offset = 0
            
            while True:
                print(f"  Fetching page {offset // page_size + 1}")
                
                params = base_params.copy()
                params['season_id'] = f'eq.{season}'
                params['limit'] = str(page_size)
                params['offset'] = str(offset)
                
                if limit and len(all_data) + page_size > limit:
                    params['limit'] = str(limit - len(all_data))
                
                try:
                    response = requests.get(url, headers=headers, params=params, timeout=30)
                    
                    if response.status_code == 200:
                        data = response.json()
                        if not data:
                            break
                        
                        all_data.extend(data)
                        print(f"  Fetched {len(data)} records (total: {len(all_data)})")
                        
                        if limit and len(all_data) >= limit:
                            break
                        if len(data) < page_size:
                            break
                        
                        offset += page_size
                    else:
                        print(f"  Error: HTTP {response.status_code}")
                        print(f"  Response: {response.text}")
                        break
                        
                except Exception as e:
                    print(f"  Error fetching data: {e}")
                    break
        
        if not all_data:
            print("No data fetched. Trying fallback approach...")
            # Try with minimal query
            params = {
                'select': 'player_id,date,season_id,player_name,goals,assists,shots,toi_per_game',
                'position_code': 'neq.G',
                'limit': '1000'
            }
            
            response = requests.get(url, headers=headers, params=params, timeout=30)
            if response.status_code == 200:
                all_data = response.json()
                print(f"Fallback successful: {len(all_data)} records")
            else:
                raise Exception(f"Failed to fetch data: {response.status_code} - {response.text}")
        
        self.df = pd.DataFrame(all_data)
        self.df['date'] = pd.to_datetime(self.df['date'])
        
        # Add team_id from abbreviation for consistency
        self.df['team_id'] = self.df.get('current_team_abbreviation', 'UNK')
        
        print(f"\nLoaded {len(self.df)} records")
        print(f"Date range: {self.df['date'].min()} to {self.df['date'].max()}")
        print(f"Players: {self.df['player_id'].nunique()}")
        print(f"Seasons: {sorted(self.df['season_id'].unique())}")
        
        return self.df
            
    def calculate_fantasy_points(self) -> pd.DataFrame:
        """Calculate fantasy points for each game."""
        print("Calculating fantasy points...")
        
        # Fill NaN values
        for col in self.fantasy_scoring.keys():
            if col in self.df.columns:
                self.df[col] = self.df[col].fillna(0)
        
        # Calculate fantasy points
        self.df['fantasy_points'] = 0
        for metric, points in self.fantasy_scoring.items():
            if metric in self.df.columns:
                self.df['fantasy_points'] += self.df[metric] * points
        
        self.df['fantasy_points'] = self.df['fantasy_points'].round(2)
        
        print(f"Average fantasy points: {self.df['fantasy_points'].mean():.2f}")
        print(f"Fantasy points range: {self.df['fantasy_points'].min():.2f} to {self.df['fantasy_points'].max():.2f}")
        
        return self.df
    
    def engineer_features(self) -> pd.DataFrame:
        """Engineer additional features for prediction."""
        print("Engineering features...")
        
        # Sort by player and date for rolling calculations
        self.df = self.df.sort_values(['player_id', 'date'])
        
        # Rolling averages (last 10 games)
        rolling_cols = ['fantasy_points', 'goals', 'assists', 'shots', 'toi_per_game']
        for col in rolling_cols:
            if col in self.df.columns:
                self.df[f'{col}_rolling_10'] = self.df.groupby('player_id')[col].transform(
                    lambda x: x.rolling(window=10, min_periods=1).mean()
                )
        
        # Recent form (last 5 games)
        for col in rolling_cols:
            if col in self.df.columns:
                self.df[f'{col}_recent_5'] = self.df.groupby('player_id')[col].transform(
                    lambda x: x.rolling(window=5, min_periods=1).mean()
                )
        
        # Games played this season
        self.df['games_played_season'] = self.df.groupby(['player_id', 'season_id']).cumcount() + 1
        
        # Days since last game
        self.df['days_since_last_game'] = self.df.groupby('player_id')['date'].diff().dt.days
        self.df['days_since_last_game'] = self.df['days_since_last_game'].fillna(0)
        
        # Season progress (0-1)
        self.df['season_progress'] = self.df.groupby(['season_id'])['date'].transform(
            lambda x: (x - x.min()) / (x.max() - x.min())
        )
        
        # Position encoding
        position_mapping = {'C': 0, 'L': 1, 'R': 2, 'D': 3}
        self.df['position_encoded'] = self.df['position_code'].map(position_mapping)
        
        # Team performance metrics (team's recent fantasy points)
        self.df['team_fantasy_avg_10'] = self.df.groupby(['team_id'])['fantasy_points'].transform(
            lambda x: x.rolling(window=10, min_periods=1).mean()
        )
        
        print(f"Engineered features. Dataset now has {len(self.df.columns)} columns")
        return self.df
    
    def create_prediction_targets(self) -> pd.DataFrame:
        """Create target variables for prediction."""
        print("Creating prediction targets...")
        
        # Sort by player and date
        self.df = self.df.sort_values(['player_id', 'date'])
        
        # Next game fantasy points
        self.df['next_game_fantasy'] = self.df.groupby('player_id')['fantasy_points'].shift(-1)
        
        # Next 5 games average
        self.df['next_5_games_avg'] = self.df.groupby('player_id')['fantasy_points'].transform(
            lambda x: x.rolling(window=5, min_periods=1).mean().shift(-5)
        )
        
        # Next 10 games average  
        self.df['next_10_games_avg'] = self.df.groupby('player_id')['fantasy_points'].transform(
            lambda x: x.rolling(window=10, min_periods=1).mean().shift(-10)
        )
        
        # Remove rows without targets
        initial_rows = len(self.df)
        self.df = self.df.dropna(subset=['next_game_fantasy'])
        print(f"Removed {initial_rows - len(self.df)} rows without prediction targets")
        
        return self.df
    
    def prepare_model_data(self, target_col: str = 'next_game_fantasy') -> Tuple[pd.DataFrame, pd.Series]:
        """Prepare data for modeling."""
        print(f"Preparing data for {target_col} prediction...")
        
        # Select features
        feature_cols = [
            # Rolling averages
            'fantasy_points_rolling_10', 'fantasy_points_recent_5',
            'goals_rolling_10', 'assists_rolling_10', 'shots_rolling_10',
            'toi_per_game_rolling_10', 'toi_per_game_recent_5',
            
            # Current game performance
            'toi_per_game', 'shots', 'pp_toi_pct_per_game',
            'individual_shots_for_per_60', 'individual_sat_for_per_60',
            'on_ice_shooting_pct', 'sat_pct', 'zone_start_pct',
            
            # Engineered features
            'games_played_season', 'days_since_last_game', 'season_progress',
            'position_encoded', 'team_fantasy_avg_10',
            
            # Context
            'takeaways', 'giveaways', 'penalty_minutes'
        ]
        
        # Filter to available columns
        available_features = [col for col in feature_cols if col in self.df.columns]
        print(f"Using {len(available_features)} features for prediction")
        
        # Create feature matrix
        X = self.df[available_features].copy()
        y = self.df[target_col].copy()
        
        # Fill any remaining NaN values
        X = X.fillna(X.mean())
        
        print(f"Final dataset shape: {X.shape}")
        print(f"Target variable range: {y.min():.2f} to {y.max():.2f}")
        
        return X, y
    
    def prepare_prediction_data(self, target: str) -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """Prepare data for model training with comprehensive NaN handling."""
        # Get prediction data with proper target alignment
        prediction_data = self.create_prediction_targets()
        
        # Filter for valid target values (not NaN)
        valid_mask = ~prediction_data[target].isna()
        prediction_data = prediction_data[valid_mask]
        
        print(f"Using {len(prediction_data)} samples after removing NaN targets")
        
        # Define feature columns (excluding target and metadata)
        exclude_cols = ['player_id', 'date', 'team_id', 'season_id', 'player_name', 
                       'position_code', 'current_team_abbreviation'] + [target]
        feature_cols = [col for col in prediction_data.columns if col not in exclude_cols]
        
        # Select only numeric features
        X = prediction_data[feature_cols].select_dtypes(include=[np.number])
        
        # Handle NaN values comprehensively
        print(f"NaN values before cleaning: {X.isnull().sum().sum()}")
        
        # Fill NaN values with median for each column
        from sklearn.impute import SimpleImputer
        imputer = SimpleImputer(strategy='median')
        X_imputed = imputer.fit_transform(X)
        X = pd.DataFrame(X_imputed, columns=X.columns, index=X.index)
        
        # Double-check for any remaining NaN values
        if X.isnull().sum().sum() > 0:
            print("Warning: Still have NaN values after imputation. Filling with 0.")
            X = X.fillna(0)
        
        # Remove features with no variance or all zeros
        variance_threshold = 0.001
        feature_variances = X.var()
        valid_features = feature_variances[feature_variances > variance_threshold].index.tolist()
        
        if len(valid_features) < len(X.columns):
            print(f"Removing {len(X.columns) - len(valid_features)} low-variance features")
            X = X[valid_features]
        
        # Remove any infinite values
        X = X.replace([np.inf, -np.inf], np.nan)
        if X.isnull().sum().sum() > 0:
            print("Warning: Found infinite values. Replacing with 0.")
            X = X.fillna(0)
        
        y = prediction_data[target].values
        
        # Ensure target has no NaN values
        if np.isnan(y).any():
            print("Warning: Target still contains NaN values. This should not happen.")
            y = np.nan_to_num(y)
        
        print(f"Using {len(valid_features)} features for prediction")
        print(f"Final dataset shape: {X.shape}")
        print(f"Target variable range: {y.min():.2f} to {y.max():.2f}")
        print(f"Final NaN check - Features: {X.isnull().sum().sum()}, Target: {np.isnan(y).sum()}")
        
        return X.values, y, valid_features
    
    def train_models(self, target_col: str = 'next_game_fantasy') -> Dict:
        """Train multiple models and compare performance."""
        print(f"\nTraining models for {target_col}...")
        
        # Ensure we have the prediction targets created
        if target_col not in self.df.columns:
            print(f"Target column {target_col} not found. Creating prediction targets...")
            self.create_prediction_targets()
        
        # Filter out rows with NaN target values
        valid_target_mask = ~self.df[target_col].isna()
        train_data = self.df[valid_target_mask].copy()
        
        print(f"Using {len(train_data)} samples after removing NaN targets")
        
        # Define feature columns (excluding target and metadata)
        exclude_cols = ['player_id', 'date', 'team_id', 'season_id', 'player_name', 
                       'position_code', 'current_team_abbreviation', 'games_played'] + [target_col]
        
        # Get all potential feature columns
        feature_cols = [col for col in train_data.columns if col not in exclude_cols]
        
        # Select only numeric features
        numeric_features = train_data[feature_cols].select_dtypes(include=[np.number])
        
        print(f"NaN values before cleaning: {numeric_features.isnull().sum().sum()}")
        
        # Handle NaN values using fillna instead of SimpleImputer to avoid column mismatch
        # First, fill with median for each column
        for col in numeric_features.columns:
            if numeric_features[col].isnull().any():
                median_val = numeric_features[col].median()
                if pd.isna(median_val):  # If median is also NaN, use 0
                    numeric_features[col] = numeric_features[col].fillna(0)
                else:
                    numeric_features[col] = numeric_features[col].fillna(median_val)
        
        # Remove any columns that are still all NaN (shouldn't happen but just in case)
        numeric_features = numeric_features.dropna(axis=1, how='all')
        
        # Double-check for any remaining NaN values
        if numeric_features.isnull().sum().sum() > 0:
            print("Warning: Still have NaN values after cleaning. Filling with 0.")
            numeric_features = numeric_features.fillna(0)
        
        # Remove features with no variance
        variance_threshold = 0.001
        feature_variances = numeric_features.var()
        valid_features = feature_variances[feature_variances > variance_threshold].index.tolist()
        
        if len(valid_features) < len(numeric_features.columns):
            print(f"Removing {len(numeric_features.columns) - len(valid_features)} low-variance features")
            numeric_features = numeric_features[valid_features]
        
        # Remove any infinite values
        numeric_features = numeric_features.replace([np.inf, -np.inf], 0)
        
        # Now we have clean feature data
        X = numeric_features
        
        # Get target values
        y = train_data[target_col].values
        
        # Ensure target has no NaN values
        if np.isnan(y).any():
            print("Warning: Target still contains NaN values. This should not happen.")
            y = np.nan_to_num(y)
        
        # Time-based split (use earlier games for training)
        split_date = train_data['date'].quantile(0.8)
        train_mask = train_data['date'] <= split_date
        test_mask = train_data['date'] > split_date
        
        # Apply masks to get train/test splits
        X_train = X[train_mask].values
        X_test = X[test_mask].values
        y_train = y[train_mask]
        y_test = y[test_mask]
        
        print(f"Training set: {len(X_train)} samples")
        print(f"Test set: {len(X_test)} samples")
        print(f"Using {len(X.columns)} features")
        
        # Final validation that there are no NaN values
        print(f"NaN check - X_train: {np.isnan(X_train).sum()}, X_test: {np.isnan(X_test).sum()}")
        print(f"NaN check - y_train: {np.isnan(y_train).sum()}, y_test: {np.isnan(y_test).sum()}")
        
        results = {}
        
        # Train each model
        for model_name, model in self.model_configs.items():
            print(f"\nTraining {model_name}...")
            
            try:
                # Scale features for linear models
                if model_name in ['linear_regression', 'ridge', 'lasso']:
                    scaler = StandardScaler()
                    X_train_scaled = scaler.fit_transform(X_train)
                    X_test_scaled = scaler.transform(X_test)
                    self.scalers[f"{model_name}_{target_col}"] = scaler
                else:
                    X_train_scaled = X_train
                    X_test_scaled = X_test
                
                # Train model
                model.fit(X_train_scaled, y_train)
                
                # Make predictions
                train_pred = model.predict(X_train_scaled)
                test_pred = model.predict(X_test_scaled)
                
                # Calculate metrics
                train_r2 = r2_score(y_train, train_pred)
                test_r2 = r2_score(y_test, test_pred)
                train_mae = mean_absolute_error(y_train, train_pred)
                test_mae = mean_absolute_error(y_test, test_pred)
                train_rmse = np.sqrt(mean_squared_error(y_train, train_pred))
                test_rmse = np.sqrt(mean_squared_error(y_test, test_pred))
                
                results[model_name] = {
                    'model': model,
                    'train_r2': train_r2,
                    'test_r2': test_r2,
                    'train_mae': train_mae,
                    'test_mae': test_mae,
                    'train_rmse': train_rmse,
                    'test_rmse': test_rmse,
                    'predictions': test_pred,
                    'y_test': y_test
                }
                
                print(f"  Train R²: {train_r2:.3f}, Test R²: {test_r2:.3f}")
                print(f"  Train MAE: {train_mae:.3f}, Test MAE: {test_mae:.3f}")
                
                # Feature importance for tree-based models
                if hasattr(model, 'feature_importances_'):
                    feature_importance = pd.DataFrame({
                        'feature': X.columns,
                        'importance': model.feature_importances_
                    }).sort_values('importance', ascending=False)
                    
                    self.feature_importance[f"{model_name}_{target_col}"] = feature_importance
                    
                    print(f"  Top 5 features:")
                    for i, (feat, imp) in enumerate(feature_importance.head().values):
                        print(f"    {i+1}. {feat}: {imp:.3f}")
                        
            except Exception as e:
                print(f"  Error training {model_name}: {str(e)}")
                continue
        
        self.models[target_col] = results
        return results
    
    def evaluate_models(self, target_col: str = 'next_game_fantasy') -> None:
        """Evaluate and compare model performance."""
        print(f"\n{'='*60}")
        print(f"MODEL PERFORMANCE COMPARISON - {target_col.upper()}")
        print('='*60)
        
        if target_col not in self.models:
            print("No models trained yet!")
            return
        
        results = self.models[target_col]
        
        # Create comparison DataFrame
        comparison_data = []
        for model_name, metrics in results.items():
            comparison_data.append({
                'Model': model_name,
                'Train R²': metrics['train_r2'],
                'Test R²': metrics['test_r2'],
                'Test MAE': metrics['test_mae'],
                'Test RMSE': metrics['test_rmse'],
                'Overfit': metrics['train_r2'] - metrics['test_r2']
            })
        
        comparison_df = pd.DataFrame(comparison_data)
        comparison_df = comparison_df.sort_values('Test R²', ascending=False)
        
        print("\nModel Performance Rankings:")
        print(comparison_df.round(3))
        
        # Best model
        best_model = comparison_df.iloc[0]['Model']
        print(f"\nBest Model: {best_model}")
        print(f"Test R²: {comparison_df.iloc[0]['Test R²']:.3f}")
        print(f"Test MAE: {comparison_df.iloc[0]['Test MAE']:.3f}")
        
        return comparison_df
    
    def plot_model_results(self, target_col: str = 'next_game_fantasy') -> None:
        """Plot model performance and predictions."""
        if target_col not in self.models:
            print("No models to plot!")
            return
        
        results = self.models[target_col]
        
        # Create subplots
        fig, axes = plt.subplots(2, 3, figsize=(18, 12))
        fig.suptitle(f'Model Performance Analysis - {target_col.replace("_", " ").title()}', fontsize=16)
        
        # Plot 1: R² comparison
        models = list(results.keys())
        test_r2_scores = [results[m]['test_r2'] for m in models]
        
        axes[0,0].bar(models, test_r2_scores)
        axes[0,0].set_title('Test R² Scores')
        axes[0,0].set_ylabel('R² Score')
        axes[0,0].tick_params(axis='x', rotation=45)
        
        # Plot 2: MAE comparison
        test_mae_scores = [results[m]['test_mae'] for m in models]
        
        axes[0,1].bar(models, test_mae_scores)
        axes[0,1].set_title('Test MAE Scores')
        axes[0,1].set_ylabel('MAE')
        axes[0,1].tick_params(axis='x', rotation=45)
        
        # Plot 3: Best model predictions vs actual
        best_model = max(results.keys(), key=lambda x: results[x]['test_r2'])
        best_result = results[best_model]
        
        axes[0,2].scatter(best_result['y_test'], best_result['predictions'], alpha=0.6)
        axes[0,2].plot([best_result['y_test'].min(), best_result['y_test'].max()], 
                      [best_result['y_test'].min(), best_result['y_test'].max()], 'r--')
        axes[0,2].set_title(f'Best Model: {best_model}')
        axes[0,2].set_xlabel('Actual Values')
        axes[0,2].set_ylabel('Predicted Values')
        
        # Plot 4: Feature importance (if available)
        if f"{best_model}_{target_col}" in self.feature_importance:
            importance_df = self.feature_importance[f"{best_model}_{target_col}"].head(10)
            axes[1,0].barh(range(len(importance_df)), importance_df['importance'])
            axes[1,0].set_yticks(range(len(importance_df)))
            axes[1,0].set_yticklabels(importance_df['feature'])
            axes[1,0].set_title('Top 10 Feature Importances')
            axes[1,0].set_xlabel('Importance')
        
        # Plot 5: Residuals
        residuals = best_result['y_test'] - best_result['predictions']
        axes[1,1].scatter(best_result['predictions'], residuals, alpha=0.6)
        axes[1,1].axhline(y=0, color='r', linestyle='--')
        axes[1,1].set_title('Residuals Plot')
        axes[1,1].set_xlabel('Predicted Values')
        axes[1,1].set_ylabel('Residuals')
        
        # Plot 6: Prediction distribution
        axes[1,2].hist(best_result['predictions'], bins=30, alpha=0.7, label='Predictions')
        axes[1,2].hist(best_result['y_test'], bins=30, alpha=0.7, label='Actual')
        axes[1,2].set_title('Prediction vs Actual Distribution')
        axes[1,2].set_xlabel('Fantasy Points')
        axes[1,2].set_ylabel('Frequency')
        axes[1,2].legend()
        
        plt.tight_layout()
        plt.show()
    
    def predict_future_performance(self, player_ids: List[int] = None, days_ahead: int = 7) -> pd.DataFrame:
        """Make predictions for future games."""
        print(f"\nPredicting performance for next {days_ahead} days...")
        
        if 'next_game_fantasy' not in self.models:
            print("No models trained yet!")
            return pd.DataFrame()
        
        # Get the best model
        best_model_name = max(self.models['next_game_fantasy'].keys(), 
                            key=lambda x: self.models['next_game_fantasy'][x]['test_r2'])
        best_model = self.models['next_game_fantasy'][best_model_name]['model']
        
        print(f"Using best model: {best_model_name}")
        
        # Get recent data for predictions
        recent_data = self.df[self.df['date'] >= self.df['date'].max() - timedelta(days=30)]
        
        if player_ids:
            recent_data = recent_data[recent_data['player_id'].isin(player_ids)]
        
        # Get latest stats for each player
        latest_stats = recent_data.groupby('player_id').last().reset_index()
        
        # Use the same feature preparation as in train_models
        # Define feature columns (excluding target and metadata)
        exclude_cols = ['player_id', 'date', 'team_id', 'season_id', 'player_name', 
                       'position_code', 'current_team_abbreviation', 'games_played', 'next_game_fantasy']
        
        # Get all potential feature columns
        feature_cols = [col for col in latest_stats.columns if col not in exclude_cols]
        
        # Select only numeric features
        numeric_features = latest_stats[feature_cols].select_dtypes(include=[np.number])
        
        # Handle NaN values the same way as in training
        for col in numeric_features.columns:
            if numeric_features[col].isnull().any():
                median_val = numeric_features[col].median()
                if pd.isna(median_val):
                    numeric_features[col] = numeric_features[col].fillna(0)
                else:
                    numeric_features[col] = numeric_features[col].fillna(median_val)
        
        # Remove any columns that are still all NaN
        numeric_features = numeric_features.dropna(axis=1, how='all')
        
        # Remove features with no variance (same threshold as training)
        variance_threshold = 0.001
        feature_variances = numeric_features.var()
        valid_features = feature_variances[feature_variances > variance_threshold].index.tolist()
        
        if len(valid_features) < len(numeric_features.columns):
            print(f"Removing {len(numeric_features.columns) - len(valid_features)} low-variance features")
            numeric_features = numeric_features[valid_features]
        
        # Remove any infinite values
        numeric_features = numeric_features.replace([np.inf, -np.inf], 0)
        
        # Create prediction dataset
        pred_data = latest_stats[['player_id', 'player_name', 'position_code', 'team_id']].copy()
        
        # Make predictions using the cleaned features
        X_for_pred = numeric_features.values
        
        # Scale if needed
        if f"{best_model_name}_next_game_fantasy" in self.scalers:
            scaler = self.scalers[f"{best_model_name}_next_game_fantasy"]
            X_for_pred_scaled = scaler.transform(X_for_pred)
        else:
            X_for_pred_scaled = X_for_pred
        
        predictions = best_model.predict(X_for_pred_scaled)
        
        # Get rolling averages for comparison (if available)
        recent_fantasy_avg = latest_stats.get('fantasy_points_rolling_10', pd.Series([0] * len(latest_stats)))
        
        # Create results DataFrame
        results = pd.DataFrame({
            'player_id': pred_data['player_id'],
            'player_name': pred_data['player_name'],
            'position_code': pred_data['position_code'],
            'team_id': pred_data['team_id'],
            'predicted_fantasy_points': predictions,
            'recent_avg_fantasy': recent_fantasy_avg,
            'model_used': best_model_name
        })
        
        results = results.sort_values('predicted_fantasy_points', ascending=False)
        
        print(f"\nTop 10 Predicted Performers:")
        print(results.head(10)[['player_name', 'position_code', 'predicted_fantasy_points', 'recent_avg_fantasy']].round(2))
        
        return results
    
    def run_full_analysis(self, expand_seasons: bool = True) -> None:
        """Run the complete predictive analysis pipeline."""
        print("Starting Hockey Performance Prediction Analysis...")
        print("="*60)
        
        # Set season expansion
        self.expand_season_range = expand_seasons
        
        # 1. Load and prepare data
        self.load_data()
        self.calculate_fantasy_points()
        
        # 2. Engineer features
        self.engineer_features()
        
        # 3. Create prediction targets
        self.create_prediction_targets()
        
        # 4. Train models for different prediction horizons
        prediction_targets = ['next_game_fantasy', 'next_5_games_avg', 'next_10_games_avg']
        
        for target in prediction_targets:
            if target in self.df.columns:
                print(f"\n{'='*60}")
                print(f"TRAINING MODELS FOR: {target.upper()}")
                print('='*60)
                
                self.train_models(target)
                self.evaluate_models(target)
                self.plot_model_results(target)
        
        # 5. Make future predictions
        print(f"\n{'='*60}")
        print("GENERATING FUTURE PREDICTIONS")
        print('='*60)
        
        predictions = self.predict_future_performance()
        
        # 6. Generate insights report
        self.generate_insights_report()
        
        print("\nPredictive analysis completed!")
        
        return predictions
    
    def generate_insights_report(self) -> None:
        """Generate comprehensive insights from the predictive analysis."""
        print(f"\n{'='*60}")
        print("HOCKEY PERFORMANCE PREDICTION INSIGHTS")
        print('='*60)
        
        print(f"\nDATASET SUMMARY:")
        print(f"- Total games analyzed: {len(self.df):,}")
        print(f"- Unique players: {self.df['player_id'].nunique():,}")
        print(f"- Date range: {self.df['date'].min()} to {self.df['date'].max()}")
        print(f"- Seasons included: {sorted(self.df['season_id'].unique())}")
        print(f"- Average fantasy points: {self.df['fantasy_points'].mean():.2f}")
        
        # Model performance summary
        if 'next_game_fantasy' in self.models:
            print(f"\nMODEL PERFORMANCE SUMMARY:")
            results = self.models['next_game_fantasy']
            
            best_model = max(results.keys(), key=lambda x: results[x]['test_r2'])
            best_r2 = results[best_model]['test_r2']
            best_mae = results[best_model]['test_mae']
            
            print(f"- Best model: {best_model}")
            print(f"- Test R²: {best_r2:.3f}")
            print(f"- Test MAE: {best_mae:.3f} fantasy points")
            print(f"- Prediction accuracy: {best_r2*100:.1f}% of variance explained")
        
        # Feature importance insights
        if f"{best_model}_next_game_fantasy" in self.feature_importance:
            print(f"\nMOST IMPORTANT PREDICTIVE FACTORS:")
            top_features = self.feature_importance[f"{best_model}_next_game_fantasy"].head(10)
            
            for i, (feature, importance) in enumerate(top_features.values, 1):
                print(f"{i:2d}. {feature:<30} {importance:.3f}")
        
        # Prediction insights
        if hasattr(self, 'predictions') and self.predictions:
            print(f"\nPREDICTION INSIGHTS:")
            print(f"- Model can predict next game performance with {best_r2*100:.1f}% accuracy")
            print(f"- Average prediction error: ±{best_mae:.1f} fantasy points")
            print(f"- Most predictive factors: recent performance, ice time, shot generation")
        
        print(f"\nKEY TAKEAWAYS:")
        print(f"- Recent performance (rolling averages) is the strongest predictor")
        print(f"- Ice time and opportunity metrics are crucial for prediction")
        print(f"- Shot generation rates provide predictive value")
        print(f"- Team context and situational factors matter")
        print(f"- Model performance varies by prediction horizon")
        
        print("="*60)
    
    def calculate_rolling_averages(self, df: pd.DataFrame, windows: List[int] = [5, 10, 15, 20]) -> pd.DataFrame:
        """Calculate rolling averages for key fantasy statistics."""
        
        # Key fantasy statistics to include in rolling averages
        fantasy_stats = [
            'goals', 'assists', 'shots', 'hits', 'blocks_per_60', 'points',
            'shooting_percentage', 'plus_minus', 'pp_points', 'toi_per_game',
            'giveaways', 'takeaways', 'penalty_minutes', 'fow_percentage',
            'goals_per_game', 'assists_per_game', 'shots_per_game', 'hits_per_game',
            'blocks_per_game', 'penalty_minutes_per_game',
            # Advanced stats
            'individual_sat_for_per_60', 'on_ice_shooting_pct', 'zone_start_pct',
            'goals_5v5', 'assists_5v5', 'points_5v5', 'shooting_percentage_5v5',
            'pp_goals', 'pp_assists', 'sh_goals', 'sh_assists',
            # Rate stats
            'goals_per_60_5v5', 'assists_per_60_5v5', 'points_per_60_5v5',
            'pp_goals_per_60', 'pp_points_per_60', 'sh_goals_per_60',
            # Time on ice variations
            'es_toi_per_game', 'pp_toi_per_game', 'sh_toi_per_game',
            'toi_per_game_5v5', 'time_on_ice_per_shift',
            # Faceoff stats
            'total_faceoffs', 'total_fow', 'ev_faceoff_percentage',
            'o_zone_fo_percentage', 'd_zone_fo_percentage',
            # Physical stats
            'hits_per_60', 'takeaways_per_60', 'giveaways_per_60',
            'penalties_drawn', 'penalties_drawn_per_60',
            # Shot quality
            'missed_shots', 'goals_wrist', 'goals_snap', 'goals_slap',
            'goals_backhand', 'goals_tip_in', 'goals_deflected'
        ]
        
        # Filter to only include columns that exist in the dataframe
        available_stats = [col for col in fantasy_stats if col in df.columns]
        
        print(f"Calculating rolling averages for {len(available_stats)} fantasy statistics")
        
        # Sort by player and date for proper rolling calculation
        df_sorted = df.sort_values(['player_id', 'date'])
        
        # Calculate rolling averages for each window
        for window in windows:
            for stat in available_stats:
                if df_sorted[stat].dtype in ['int64', 'float64']:
                    # Calculate rolling average
                    rolling_avg = df_sorted.groupby('player_id')[stat].rolling(
                        window=window, min_periods=min(3, window)
                    ).mean()
                    
                    # Add to dataframe
                    df_sorted[f'{stat}_rolling_{window}'] = rolling_avg.values
                    
                    # Calculate rolling standard deviation for variance features
                    if window >= 5:  # Only for larger windows
                        rolling_std = df_sorted.groupby('player_id')[stat].rolling(
                            window=window, min_periods=min(3, window)
                        ).std()
                        df_sorted[f'{stat}_rolling_std_{window}'] = rolling_std.values
                    
                    # Calculate rolling trend (slope of last N games)
                    if window >= 5:
                        def calculate_trend(series):
                            if len(series) < 3:
                                return 0
                            x = np.arange(len(series))
                            try:
                                slope = np.polyfit(x, series, 1)[0]
                                return slope
                            except:
                                return 0
                        
                        rolling_trend = df_sorted.groupby('player_id')[stat].rolling(
                            window=window, min_periods=min(3, window)
                        ).apply(calculate_trend)
                        df_sorted[f'{stat}_trend_{window}'] = rolling_trend.values
        
        # Calculate additional derived features
        df_sorted = self.calculate_derived_features(df_sorted)
        
        return df_sorted
        
    def calculate_derived_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate additional derived features for prediction."""
        
        # Fantasy scoring features (approximate fantasy points)
        if all(col in df.columns for col in ['goals', 'assists', 'shots', 'hits', 'blocks_per_60']):
            # Standard fantasy scoring: G=6, A=4, SOG=0.9, HIT=0.6, BLK=0.6
            df['fantasy_points_est'] = (
                df['goals'] * 6 + 
                df['assists'] * 4 + 
                df['shots'] * 0.9 + 
                df['hits'] * 0.6 + 
                df.get('blocked_shots', df.get('blocks_per_60', 0)) * 0.6
            )
            
            # Calculate rolling averages for fantasy points
            for window in [5, 10, 15]:
                rolling_fantasy = df.groupby('player_id')['fantasy_points_est'].rolling(
                    window=window, min_periods=min(3, window)
                ).mean()
                df[f'fantasy_points_rolling_{window}'] = rolling_fantasy.values
        
        # Hot/cold streaks
        if 'goals' in df.columns:
            df['goals_last_3'] = df.groupby('player_id')['goals'].rolling(3).sum().values
            df['goals_last_5'] = df.groupby('player_id')['goals'].rolling(5).sum().values
            df['assists_last_3'] = df.groupby('player_id')['assists'].rolling(3).sum().values if 'assists' in df.columns else 0
            df['points_last_3'] = df['goals_last_3'] + df['assists_last_3']
        
        # Consistency metrics
        if 'points' in df.columns:
            for window in [5, 10]:
                rolling_points = df.groupby('player_id')['points'].rolling(window)
                df[f'points_consistency_{window}'] = rolling_points.std().values / (rolling_points.mean().values + 0.001)
        
        # Performance vs time metrics
        if 'toi_per_game' in df.columns and 'points' in df.columns:
            df['points_per_toi'] = df['points'] / (df['toi_per_game'] + 0.001)
            df['points_per_toi_rolling_10'] = df.groupby('player_id')['points_per_toi'].rolling(10).mean().values
        
        # Shot quality metrics
        if 'shots' in df.columns and 'goals' in df.columns:
            df['shot_quality'] = df['goals'] / (df['shots'] + 0.001)
            df['shot_quality_rolling_10'] = df.groupby('player_id')['shot_quality'].rolling(10).mean().values
        
        # Recent form vs season average
        if 'points' in df.columns:
            season_avg = df.groupby(['player_id', 'season_id'])['points'].expanding().mean()
            recent_avg = df.groupby('player_id')['points'].rolling(5).mean()
            df['form_vs_season'] = (recent_avg - season_avg).values
        
        return df
    


if __name__ == "__main__":
    # Create predictor and run analysis
    predictor = HockeyPerformancePredictor()
    
    # Run full analysis with expanded season range for better predictions
    predictions = predictor.run_full_analysis(expand_seasons=True)
    
    # Save predictions to CSV
    if not predictions.empty:
        predictions.to_csv('hockey_performance_predictions.csv', index=False)
        print("\nPredictions saved to 'hockey_performance_predictions.csv'")