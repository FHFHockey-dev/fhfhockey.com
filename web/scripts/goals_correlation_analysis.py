#!/usr/bin/env python3
"""
Hockey Player Goals Correlation Analysis - Supabase REST API Version

This script analyzes the player_stats_unified materialized view to identify
which statistics correlate most strongly with goals scored.

Usage:
    python goals_correlation_analysis.py

Requirements:
    pip install matplotlib pandas seaborn numpy requests python-dotenv
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from typing import List, Optional
import requests
import warnings
warnings.filterwarnings('ignore')

class GoalsCorrelationAnalyzer:
    def __init__(self):
        """Initialize the analyzer with Supabase REST API."""
        self.df: Optional[pd.DataFrame] = None
        self.correlation_results: Optional[pd.Series] = None
        
        # Supabase credentials from your .env.local
        self.supabase_url = "https://fyhftlxokyjtpndbkfse.supabase.co"
        self.supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5aGZ0bHhva3lqdHBuZGJrZnNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxMDM4Mjg5OCwiZXhwIjoyMDI1OTU4ODk4fQ.GzYkvgCMlydjuZdCYLML6SJr_Qznti2THSkG4luUvCc"
        
        # Set up matplotlib style
        plt.style.use('seaborn-v0_8')
        sns.set_palette("husl")
        
    def load_data(self, limit: Optional[int] = None) -> pd.DataFrame:
        """Load data from the player_stats_unified materialized view using Supabase REST API with pagination."""
        print("Loading data from player_stats_unified via Supabase REST API...")
        
        # Supabase REST API endpoint
        url = f"{self.supabase_url}/rest/v1/player_stats_unified"
        
        headers = {
            'apikey': self.supabase_key,
            'Authorization': f'Bearer {self.supabase_key}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
        
        # Base query parameters
        base_params = {
            'select': '''
                player_id,date,season_id,team_id,position_code,
                goals,points,assists,shots,shooting_percentage,plus_minus,
                penalty_minutes,hits,blocked_shots,takeaways,giveaways,
                toi_per_game,shifts,pp_toi,pp_toi_pct_per_game,sh_time_on_ice,ev_time_on_ice,time_on_ice_per_shift,
                pp_goals,pp_assists,pp_shots,pp_shooting_percentage,
                sh_goals,sh_shots,sh_shooting_percentage,
                goals_5v5,assists_5v5,points_5v5,shooting_percentage_5v5,
                individual_sat_for_per_60,individual_shots_for_per_60,
                on_ice_shooting_pct,sat_pct,zone_start_pct,
                has_nst_counts,has_nst_counts_oi,has_nst_rates
            '''.replace('\n', '').replace(' ', ''),
            'goals': 'not.is.null',
            'position_code': 'neq.G',  # Exclude goalies
            'games_played': 'eq.1',    # Only actual game records
            'season_id': 'eq.20242025',  # Focus on current season
            'order': 'date.desc'
        }
        
        all_data = []
        page_size = 1000  # Supabase default limit
        offset = 0
        
        try:
            while True:
                print(f"Fetching page {offset // page_size + 1} (offset: {offset})")
                
                # Set pagination parameters
                params = base_params.copy()
                params['limit'] = str(page_size)
                params['offset'] = str(offset)
                
                # Apply user-specified limit if provided
                if limit and offset + page_size > limit:
                    params['limit'] = str(limit - offset)
                
                response = requests.get(url, headers=headers, params=params, timeout=30)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if not data:  # No more data
                        print("No more data to fetch")
                        break
                    
                    all_data.extend(data)
                    print(f"Fetched {len(data)} records (total so far: {len(all_data)})")
                    
                    # Check if we've reached the user-specified limit
                    if limit and len(all_data) >= limit:
                        print(f"Reached user-specified limit of {limit}")
                        break
                    
                    # If we got fewer records than page_size, we've reached the end
                    if len(data) < page_size:
                        print("Reached end of data")
                        break
                    
                    offset += page_size
                    
                else:
                    print(f"Error: HTTP {response.status_code}")
                    print(f"Response: {response.text}")
                    raise Exception(f"Failed to fetch data: {response.status_code}")
            
            # Convert to DataFrame
            self.df = pd.DataFrame(all_data)
            
            # Convert date column to datetime
            self.df['date'] = pd.to_datetime(self.df['date'])
            
            print(f"\nSUCCESS: Loaded {len(self.df)} total records")
            print(f"Date range: {self.df['date'].min()} to {self.df['date'].max()}")
            print(f"Players: {self.df['player_id'].nunique()}")
            print(f"Seasons: {sorted(self.df['season_id'].unique())}")
            
            return self.df
            
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            raise
    
    def clean_data(self) -> pd.DataFrame:
        """Clean and prepare data for analysis."""
        print("Cleaning data...")
        
        # Remove rows where goals is null or negative
        initial_count = len(self.df)
        self.df = self.df[self.df['goals'] >= 0]
        print(f"Removed {initial_count - len(self.df)} records with invalid goals")
        
        # Fill NaN values with 0 for numeric columns
        numeric_columns = self.df.select_dtypes(include=[np.number]).columns
        self.df[numeric_columns] = self.df[numeric_columns].fillna(0)
        
        # Create derived features
        self.df['goals_per_shot'] = np.where(
            self.df['shots'] > 0, 
            self.df['goals'] / self.df['shots'], 
            0
        )
        
        self.df['pp_goals_per_pp_shot'] = np.where(
            self.df['pp_shots'] > 0,
            self.df['pp_goals'] / self.df['pp_shots'],
            0
        )
        
        # Position encoding
        position_dummies = pd.get_dummies(self.df['position_code'], prefix='pos')
        self.df = pd.concat([self.df, position_dummies], axis=1)
        
        print("Data cleaning completed")
        return self.df
    
    def calculate_correlations(self) -> pd.Series:
        """Calculate correlations between all numeric variables and goals."""
        print("Calculating correlations with goals...")
        
        # Select numeric columns for correlation analysis
        numeric_cols = self.df.select_dtypes(include=[np.number]).columns
        
        # Remove ALL goal-derived metrics to avoid circular correlations
        exclude_cols = [
            # Identity and target
            'player_id', 'season_id', 'team_id', 'goals',
            
            # All metrics that include goals in their calculation
            'points', 'pp_points', 'sh_points', 'points_5v5',  # Points = goals + assists
            'goals_5v5', 'pp_goals', 'sh_goals',  # Direct goal subsets
            'goals_per_shot', 'pp_goals_per_pp_shot',  # Ratios including goals
            'plus_minus',  # Includes team goals for/against while on ice
            
            # Shooting percentages (goals/shots ratios)
            'shooting_percentage', 'pp_shooting_percentage', 'sh_shooting_percentage',
            'shooting_percentage_5v5', 'on_ice_shooting_pct',
            
            # Any other derived features we created
            'goals_per_shot', 'pp_goals_per_pp_shot'
        ]
        
        # Focus on predictive factors: shots, ice time, usage, advanced metrics
        feature_cols = [col for col in numeric_cols if col not in exclude_cols]
        
        print(f"Analyzing {len(feature_cols)} predictive features (excluding {len(exclude_cols)} goal-derived metrics)")
        
        # Calculate correlations
        correlations = self.df[feature_cols].corrwith(self.df['goals'])
        
        # Remove NaN correlations and sort by absolute value
        correlations = correlations.dropna()
        self.correlation_results = correlations.reindex(
            correlations.abs().sort_values(ascending=False).index
        )
        
        print(f"Calculated correlations for {len(self.correlation_results)} features")
        return self.correlation_results
    
    def plot_top_correlations(self, top_n: int = 20) -> None:
        """Plot the top N correlations with goals."""
        top_corr = self.correlation_results.head(top_n)
        
        plt.figure(figsize=(12, 8))
        colors = ['red' if x < 0 else 'blue' for x in top_corr.values]
        bars = plt.barh(range(len(top_corr)), top_corr.values, color=colors, alpha=0.7)
        
        plt.yticks(range(len(top_corr)), top_corr.index)
        plt.xlabel('Correlation with Goals')
        plt.title(f'Top {top_n} Features Correlated with Goals')
        plt.grid(axis='x', alpha=0.3)
        
        # Add correlation values on bars
        for i, (bar, value) in enumerate(zip(bars, top_corr.values)):
            plt.text(value + (0.01 if value >= 0 else -0.01), i, 
                    f'{value:.3f}', va='center', 
                    ha='left' if value >= 0 else 'right')
        
        plt.tight_layout()
        plt.show()
    
    def plot_goals_distribution(self) -> None:
        """Plot goals distribution and summary statistics."""
        fig, axes = plt.subplots(2, 2, figsize=(15, 10))
        
        # Goals distribution
        axes[0,0].hist(self.df['goals'], bins=range(0, self.df['goals'].max()+2), 
                      alpha=0.7, edgecolor='black')
        axes[0,0].set_xlabel('Goals per Game')
        axes[0,0].set_ylabel('Frequency')
        axes[0,0].set_title('Distribution of Goals per Game')
        axes[0,0].grid(True, alpha=0.3)
        
        # Goals by position
        position_goals = self.df.groupby('position_code')['goals'].agg(['mean', 'sum', 'count'])
        axes[0,1].bar(position_goals.index, position_goals['mean'])
        axes[0,1].set_xlabel('Position')
        axes[0,1].set_ylabel('Average Goals per Game')
        axes[0,1].set_title('Average Goals by Position')
        axes[0,1].grid(True, alpha=0.3)
        
        # Goals over time (by season)
        season_goals = self.df.groupby('season_id')['goals'].mean()
        axes[1,0].plot(season_goals.index, season_goals.values, marker='o')
        axes[1,0].set_xlabel('Season')
        axes[1,0].set_ylabel('Average Goals per Game')
        axes[1,0].set_title('Goals Trend by Season')
        axes[1,0].grid(True, alpha=0.3)
        
        # NST data availability impact
        nst_comparison = self.df.groupby('has_nst_counts')['goals'].agg(['mean', 'count'])
        axes[1,1].bar(['No NST Data', 'Has NST Data'], nst_comparison['mean'])
        axes[1,1].set_ylabel('Average Goals per Game')
        axes[1,1].set_title('Goals: NST Data vs No NST Data')
        axes[1,1].grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.show()
    
    def generate_insights_report(self) -> None:
        """Generate a text report of key insights."""
        print("\n" + "="*60)
        print("HOCKEY GOALS CORRELATION ANALYSIS REPORT")
        print("="*60)
        
        print(f"\nDATASET SUMMARY:")
        print(f"- Total games analyzed: {len(self.df):,}")
        print(f"- Unique players: {self.df['player_id'].nunique():,}")
        print(f"- Date range: {self.df['date'].min()} to {self.df['date'].max()}")
        print(f"- Average goals per game: {self.df['goals'].mean():.3f}")
        print(f"- Games with NST data: {self.df['has_nst_counts'].sum():,} ({self.df['has_nst_counts'].mean()*100:.1f}%)")
        
        print(f"\nTOP 15 POSITIVE CORRELATIONS WITH GOALS:")
        positive_corr = self.correlation_results[self.correlation_results > 0].head(15)
        for i, (feature, corr) in enumerate(positive_corr.items(), 1):
            print(f"{i:2d}. {feature:<35} {corr:>6.3f}")
        
        print(f"\nTOP 5 NEGATIVE CORRELATIONS WITH GOALS:")
        negative_corr = self.correlation_results[self.correlation_results < 0].head(5)
        for i, (feature, corr) in enumerate(negative_corr.items(), 1):
            print(f"{i:2d}. {feature:<35} {corr:>6.3f}")
        
        # Position analysis
        print(f"\nGOALS BY POSITION:")
        pos_stats = self.df.groupby('position_code')['goals'].agg(['count', 'mean', 'std'])
        for pos, stats in pos_stats.iterrows():
            print(f"{pos}: {stats['mean']:.3f} ± {stats['std']:.3f} goals/game (n={stats['count']:,})")
        
        print(f"\nKEY INSIGHTS:")
        if len(positive_corr) > 0:
            top_feature = positive_corr.index[0]
            top_corr_value = positive_corr.iloc[0]
            print(f"- Strongest predictor: {top_feature} (r={top_corr_value:.3f})")
        
        if 'shooting_percentage' in positive_corr.index[:5]:
            print(f"- Shooting percentage is a key factor")
        
        if any('pp_' in feature for feature in positive_corr.index[:10]):
            print(f"- Power play metrics are important for goal scoring")
        
        if any('nst_' in feature for feature in positive_corr.index[:10]):
            print(f"- Advanced NST metrics provide additional predictive value")
        
        print("="*60)
    
    def run_full_analysis(self, limit: Optional[int] = None) -> None:
        """Run the complete analysis pipeline."""
        print("Starting Hockey Goals Correlation Analysis...")
        
        # Load and prepare data
        self.load_data(limit=limit)
        self.clean_data()
        
        # Calculate correlations
        self.calculate_correlations()
        
        # Generate visualizations
        print("\nGenerating visualizations...")
        
        # 1. Goals distribution
        self.plot_goals_distribution()
        
        # 2. Top correlations
        self.plot_top_correlations(top_n=20)
        
        # 3. Generate insights report
        self.generate_insights_report()
        
        print("\nAnalysis completed! Check the generated plots and report above.")


if __name__ == "__main__":
    # Create analyzer and run analysis
    analyzer = GoalsCorrelationAnalyzer()
    
    # Run with a sample for testing (remove limit for full analysis)
    analyzer.run_full_analysis()  # Start with 10k records for testing