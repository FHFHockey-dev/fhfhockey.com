#!/usr/bin/env python3
"""
Hockey Player Fantasy Points Correlation Analysis

This script analyzes the player_stats_unified materialized view to:
1. Calculate fantasy points for each player game
2. Determine fantasy score percentiles
3. Identify which non-fantasy metrics correlate with higher fantasy performance

Usage:
    python fantasy_points_analysis.py

Requirements:
    pip install matplotlib pandas seaborn numpy requests python-dotenv
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from typing import List, Optional, Dict
import requests
import warnings
import os
from dotenv import load_dotenv
warnings.filterwarnings('ignore')

class FantasyPointsAnalyzer:
    def __init__(self):
        """Initialize the analyzer with fantasy scoring system."""
        self.df: Optional[pd.DataFrame] = None
        self.correlation_results: Optional[pd.Series] = None
        self.percentiles: Optional[Dict] = None
        
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
        
        # Fantasy scoring system (customizable)
        self.fantasy_scoring = {
            # Core offensive stats
            'goals': 3.0,           # Goals are most valuable
            'assists': 2.0,         # Assists are valuable
            'pp_points': 1.0,        # Bonus for PP goals (on top of base goal)
            # 'pp_assists': 1.0,      # Bonus for PP assists
            'sh_goals': 1.0,        # Bonus for SH goals (harder to get)
            # 'sh_assists': 1.0,      # Bonus for SH assists
            'sh_points': 1.0,        # Bonus for SH points (goal or assist)
            
            # Shots and offensive play
            'shots': 0.2,           # Shots have value
            # 'pp_shots': 0.2,        # PP shots slightly more valuable
            # 'sh_shots': 0.3,        # SH shots more valuable
            
            # Defensive/physical stats
            'hits': 0.2,            # Hits have value in some leagues
            'blocked_shots': 0.25,   # Blocked shots valuable
            # 'takeaways': 0.8,       # Takeaways are good
            # 'giveaways': -0.5,      # Giveaways are bad
            
            # Penalties
            # 'penalty_minutes': -0.3, # Penalty minutes hurt
            
            # Ice time (reflects usage and opportunity)
            # 'toi_per_game': 0.1,    # More TOI = more opportunity
            # 'pp_toi': 0.02,         # PP TOI very valuable per minute
            # 'sh_time_on_ice': 0.01, # SH TOI less valuable
        }
        
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
        
        # Base query parameters - include all fantasy scoring metrics
        base_params = {
            'select': '''
                player_id,date,season_id,team_id,position_code,player_name,
                goals,assists,pp_goals,pp_assists,sh_goals,sh_assists,
                shots,pp_shots,sh_shots,hits,blocked_shots,takeaways,giveaways,
                penalty_minutes,toi_per_game,pp_toi,sh_time_on_ice,
                points,shooting_percentage,plus_minus,
                shifts,pp_toi_pct_per_game,time_on_ice_per_shift,ev_time_on_ice,
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
        page_size = 1000
        offset = 0
        
        try:
            while True:
                print(f"Fetching page {offset // page_size + 1} (offset: {offset})")
                
                params = base_params.copy()
                params['limit'] = str(page_size)
                params['offset'] = str(offset)
                
                if limit and offset + page_size > limit:
                    params['limit'] = str(limit - offset)
                
                response = requests.get(url, headers=headers, params=params, timeout=30)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if not data:
                        print("No more data to fetch")
                        break
                    
                    all_data.extend(data)
                    print(f"Fetched {len(data)} records (total so far: {len(all_data)})")
                    
                    if limit and len(all_data) >= limit:
                        print(f"Reached user-specified limit of {limit}")
                        break
                    
                    if len(data) < page_size:
                        print("Reached end of data")
                        break
                    
                    offset += page_size
                    
                else:
                    print(f"Error: HTTP {response.status_code}")
                    print(f"Response: {response.text}")
                    raise Exception(f"Failed to fetch data: {response.status_code}")
            
            self.df = pd.DataFrame(all_data)
            self.df['date'] = pd.to_datetime(self.df['date'])
            
            print(f"\nSUCCESS: Loaded {len(self.df)} total records")
            print(f"Date range: {self.df['date'].min()} to {self.df['date'].max()}")
            print(f"Players: {self.df['player_id'].nunique()}")
            
            return self.df
            
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            raise
    
    def calculate_fantasy_points(self) -> pd.DataFrame:
        """Calculate fantasy points for each player game."""
        print("Calculating fantasy points...")
        
        # Fill NaN values with 0 for fantasy calculations
        fantasy_columns = list(self.fantasy_scoring.keys())
        for col in fantasy_columns:
            if col in self.df.columns:
                self.df[col] = self.df[col].fillna(0)
        
        # Calculate fantasy points
        self.df['fantasy_points'] = 0
        
        for metric, points in self.fantasy_scoring.items():
            if metric in self.df.columns:
                self.df['fantasy_points'] += self.df[metric] * points
                print(f"Added {metric} * {points} to fantasy points")
        
        # Round fantasy points
        self.df['fantasy_points'] = self.df['fantasy_points'].round(2)
        
        print(f"Fantasy points calculated!")
        print(f"Average fantasy points per game: {self.df['fantasy_points'].mean():.2f}")
        print(f"Max fantasy points in a game: {self.df['fantasy_points'].max():.2f}")
        print(f"Min fantasy points in a game: {self.df['fantasy_points'].min():.2f}")
        
        return self.df
    
    def calculate_percentiles(self) -> Dict:
        """Calculate fantasy score percentiles."""
        print("Calculating fantasy score percentiles...")
        
        percentiles = [5, 10, 25, 50, 75, 90, 95, 99]
        self.percentiles = {}
        
        for p in percentiles:
            self.percentiles[p] = np.percentile(self.df['fantasy_points'], p)
        
        print("Fantasy Score Percentiles:")
        for p, score in self.percentiles.items():
            print(f"{p}th percentile: {score:.2f} fantasy points")
        
        # Add percentile rank to each row
        self.df['fantasy_percentile'] = self.df['fantasy_points'].rank(pct=True) * 100
        
        # Create percentile bins
        self.df['fantasy_tier'] = pd.cut(
            self.df['fantasy_percentile'],
            bins=[0, 25, 50, 75, 90, 100],
            labels=['Bottom 25%', '25-50%', '50-75%', '75-90%', 'Top 10%']
        )
        
        return self.percentiles
    
    def analyze_high_fantasy_correlations(self) -> pd.Series:
        """Analyze what factors correlate with higher fantasy percentiles."""
        print("Analyzing correlations with fantasy percentiles...")
        
        # Select numeric columns for correlation analysis
        numeric_cols = self.df.select_dtypes(include=[np.number]).columns
        
        # Exclude fantasy scoring metrics to avoid recursion
        fantasy_metrics = list(self.fantasy_scoring.keys())
        
        # Also exclude ALL recursive metrics that are components of fantasy scoring
        exclude_cols = [
            # Identity and target metrics
            'player_id', 'season_id', 'team_id', 'fantasy_points', 'fantasy_percentile',
            
            # Direct fantasy scoring metrics
            'points', 'points_5v5', 'pp_points', 'sh_points',
            
            # All goal variations (goals are in fantasy scoring)
            'goals_5v5', 'pp_goals', 'sh_goals', 'gw_goals', 'empty_net_goals',
            
            # All assist variations (assists are in fantasy scoring)
            'assists_5v5', 'pp_assists', 'sh_assists', 'primary_assists_5v5',
            'secondary_assists_5v5', 'total_primary_assists', 'total_secondary_assists',
            
            # All shot variations (shots are in fantasy scoring)
            'pp_shots', 'sh_shots', 'shots_on_net_backhand', 'shots_on_net_wrist',
            'shots_on_net_snap', 'shots_on_net_slap', 'shots_on_net_deflected',
            'shots_on_net_tip_in', 'shots_on_net_wrap_around', 'shots_on_net_poke',
            'shots_on_net_bat', 'shots_on_net_between_legs', 'shots_on_net_cradle',
            'missed_shots', 'missed_shot_crossbar', 'missed_shot_goal_post',
            'missed_shot_over_net', 'missed_shot_short_side', 'missed_shot_wide_of_net',
            
            # All blocked shot variations (blocked_shots are in fantasy scoring)
            'blocks_per_60', 'blocks_per_game', 'shots_blocked_per_60',
            
            # All hit variations (hits are in fantasy scoring)
            'hits_per_60', 'hits_per_game', 'hits_taken', 'hits_taken_per_60',
            
            # All takeaway variations (takeaways are in fantasy scoring)
            'takeaways_per_60', 'takeaways_per_game',
            
            # All giveaway variations (giveaways are in fantasy scoring)
            'giveaways_per_60', 'giveaways_per_game',
            
            # All penalty variations (penalty_minutes are in fantasy scoring)
            'penalties', 'penalties_drawn', 'minor_penalties', 'major_penalties',
            'misconduct_penalties', 'game_misconduct_penalties', 'match_penalties',
            'net_penalties', 'penalty_seconds_per_game', 'penalty_minutes_per_game',
            'penalty_minutes_per_toi', 'penalties_drawn_per_60', 'penalties_taken_per_60',
            'net_penalties_per_60', 'net_minor_penalties_per_60',
            
            # All TOI variations (toi_per_game, pp_toi, sh_time_on_ice are in fantasy scoring)
            'es_toi_per_game', 'pp_toi_per_game', 'sh_toi_per_game',
            'toi_per_game_5v5', 'ot_time_on_ice', 'ot_time_on_ice_per_game',
            'time_on_ice_per_shift', 'shifts_per_game', 'shifts',
            
            # Shooting percentages (derived from goals/shots)
            'shooting_percentage', 'pp_shooting_percentage', 'sh_shooting_percentage',
            'shooting_percentage_5v5', 'shooting_pct_backhand', 'shooting_pct_wrist',
            'shooting_pct_snap', 'shooting_pct_slap', 'shooting_pct_deflected',
            'shooting_pct_tip_in', 'shooting_pct_wrap_around', 'shooting_pct_poke',
            'shooting_pct_bat', 'shooting_pct_between_legs', 'shooting_pct_cradle',
            
            # Per-game and per-60 variants of fantasy metrics
            'goals_per_game', 'assists_per_game', 'shots_per_game',
            'goals_per_60_5v5', 'assists_per_60_5v5', 'points_per_60_5v5',
            'pp_goals_per_60', 'pp_points_per_60', 'sh_goals_per_60', 'sh_points_per_60',
            'goals_per_60', 'total_assists_per_60', 'first_assists_per_60',
            'second_assists_per_60', 'total_points_per_60', 'shots_per_60',
            'pim_per_60', 'total_penalties_per_60', 'minor_penalties_per_60',
            'major_penalties_per_60', 'misconduct_penalties_per_60',
            
            # Goal type breakdowns (all variations of goals)
            'goals_backhand', 'goals_wrist', 'goals_snap', 'goals_slap',
            'goals_deflected', 'goals_tip_in', 'goals_wrap_around', 'goals_poke',
            'goals_bat', 'goals_between_legs', 'goals_cradle', 'first_goals',
            'ot_goals', 'empty_net_points', 'empty_net_assists',
            
            # Assist type breakdowns
            'primary_assists_per_game', 'secondary_assists_per_game',
            'pp_primary_assists', 'pp_secondary_assists', 'sh_primary_assists',
            'sh_secondary_assists', 'pp_primary_assists_per_60', 'pp_secondary_assists_per_60',
            'sh_primary_assists_per_60', 'sh_secondary_assists_per_60',
            'primary_assists_per_60_5v5', 'secondary_assists_per_60_5v5',
            
            # Plus/minus (affected by goals for/against)
            'plus_minus',
            
            # IPP (individual point percentage - derived from points)
            'ipp',
            
            # Any other derived metrics from fantasy components
            'goals_pct', 'pp_goals_for_per_60', 'pp_goals_against_per_60',
            'sh_individual_sat_for', 'sh_individual_sat_per_60',
            'pp_individual_sat_for', 'pp_individual_sat_per_60',
            'pp_shots_per_60', 'sh_shots_per_60',
            
        ] + fantasy_metrics
        
        # Focus on truly predictive factors that don't include fantasy components
        feature_cols = [col for col in numeric_cols if col not in exclude_cols]
        
        print(f"Analyzing {len(feature_cols)} truly predictive features for fantasy performance")
        print(f"Excluded {len(exclude_cols)} fantasy scoring and recursive metrics")
        
        # Show what we're actually analyzing
        print("\nFeatures being analyzed:")
        for i, col in enumerate(feature_cols, 1):
            print(f"{i:2d}. {col}")
        
        # Calculate correlations with fantasy percentile
        correlations = self.df[feature_cols].corrwith(self.df['fantasy_percentile'])
        
        # Remove NaN correlations and sort by absolute value
        correlations = correlations.dropna()
        self.correlation_results = correlations.reindex(
            correlations.abs().sort_values(ascending=False).index
        )
        
        print(f"\nCalculated correlations for {len(self.correlation_results)} features")
        return self.correlation_results
    
    def plot_fantasy_distribution(self) -> None:
        """Plot fantasy points distribution and analysis."""
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))
        
        # Fantasy points distribution
        axes[0,0].hist(self.df['fantasy_points'], bins=50, alpha=0.7, edgecolor='black')
        axes[0,0].set_xlabel('Fantasy Points per Game')
        axes[0,0].set_ylabel('Frequency')
        axes[0,0].set_title('Distribution of Fantasy Points per Game')
        axes[0,0].grid(True, alpha=0.3)
        
        # Add percentile lines
        for p in [25, 50, 75, 90, 95]:
            axes[0,0].axvline(self.percentiles[p], color='red', linestyle='--', alpha=0.7)
            axes[0,0].text(self.percentiles[p], axes[0,0].get_ylim()[1] * 0.8, f'{p}th', 
                          rotation=90, ha='right')
        
        # Fantasy points by position
        position_fantasy = self.df.groupby('position_code')['fantasy_points'].agg(['mean', 'count'])
        axes[0,1].bar(position_fantasy.index, position_fantasy['mean'])
        axes[0,1].set_xlabel('Position')
        axes[0,1].set_ylabel('Average Fantasy Points per Game')
        axes[0,1].set_title('Average Fantasy Points by Position')
        axes[0,1].grid(True, alpha=0.3)
        
        # Fantasy points over time
        daily_fantasy = self.df.groupby('date')['fantasy_points'].mean()
        axes[1,0].plot(daily_fantasy.index, daily_fantasy.values, marker='o', alpha=0.7)
        axes[1,0].set_xlabel('Date')
        axes[1,0].set_ylabel('Average Fantasy Points')
        axes[1,0].set_title('Fantasy Points Trend Over Time')
        axes[1,0].grid(True, alpha=0.3)
        axes[1,0].tick_params(axis='x', rotation=45)
        
        # Fantasy tier distribution
        tier_counts = self.df['fantasy_tier'].value_counts()
        axes[1,1].pie(tier_counts.values, labels=tier_counts.index, autopct='%1.1f%%')
        axes[1,1].set_title('Fantasy Performance Tiers')
        
        plt.tight_layout()
        plt.show()
    
    def plot_fantasy_correlations(self, top_n: int = 20) -> None:
        """Plot the top N correlations with fantasy percentiles."""
        top_corr = self.correlation_results.head(top_n)
        
        plt.figure(figsize=(12, 8))
        colors = ['red' if x < 0 else 'blue' for x in top_corr.values]
        bars = plt.barh(range(len(top_corr)), top_corr.values, color=colors, alpha=0.7)
        
        plt.yticks(range(len(top_corr)), top_corr.index)
        plt.xlabel('Correlation with Fantasy Percentile')
        plt.title(f'Top {top_n} Factors Correlated with Fantasy Performance')
        plt.grid(axis='x', alpha=0.3)
        
        # Add correlation values on bars
        for i, (bar, value) in enumerate(zip(bars, top_corr.values)):
            plt.text(value + (0.01 if value >= 0 else -0.01), i, 
                    f'{value:.3f}', va='center', 
                    ha='left' if value >= 0 else 'right')
        
        plt.tight_layout()
        plt.show()
    
    def analyze_by_fantasy_tier(self) -> None:
        """Analyze characteristics of different fantasy performance tiers."""
        print("\n" + "="*60)
        print("FANTASY PERFORMANCE TIER ANALYSIS")
        print("="*60)
        
        # Get top predictive factors
        top_factors = self.correlation_results.head(10).index.tolist()
        
        tier_analysis = self.df.groupby('fantasy_tier')[top_factors].mean()
        
        print("\nTop 10 Predictive Factors by Fantasy Tier:")
        print(tier_analysis.round(3))
        
        # Plot heatmap of tier characteristics
        plt.figure(figsize=(12, 8))
        
        # Normalize data for better visualization
        normalized_data = tier_analysis.T
        for col in normalized_data.columns:
            normalized_data[col] = (normalized_data[col] - normalized_data[col].min()) / (normalized_data[col].max() - normalized_data[col].min())
        
        sns.heatmap(normalized_data, annot=True, cmap='RdYlBu_r', center=0.5,
                    cbar_kws={'label': 'Normalized Value'})
        plt.title('Fantasy Performance Tier Characteristics\n(Normalized Values)')
        plt.xlabel('Fantasy Tier')
        plt.ylabel('Predictive Factors')
        plt.tight_layout()
        plt.show()
    
    def generate_fantasy_insights_report(self) -> None:
        """Generate a comprehensive fantasy insights report."""
        print("\n" + "="*60)
        print("FANTASY HOCKEY CORRELATION ANALYSIS REPORT")
        print("="*60)
        
        print(f"\nFANTASY SCORING SYSTEM:")
        print("Metric                    Points")
        print("-" * 35)
        for metric, points in self.fantasy_scoring.items():
            print(f"{metric:<25} {points:>6.1f}")
        
        print(f"\nDATASET SUMMARY:")
        print(f"- Total games analyzed: {len(self.df):,}")
        print(f"- Unique players: {self.df['player_id'].nunique():,}")
        print(f"- Date range: {self.df['date'].min()} to {self.df['date'].max()}")
        print(f"- Average fantasy points per game: {self.df['fantasy_points'].mean():.2f}")
        print(f"- Standard deviation: {self.df['fantasy_points'].std():.2f}")
        
        print(f"\nFANTASY PERCENTILES:")
        for p, score in self.percentiles.items():
            print(f"{p:2d}th percentile: {score:>6.2f} fantasy points")
        
        print(f"\nTOP 15 FACTORS CORRELATED WITH HIGH FANTASY PERFORMANCE:")
        positive_corr = self.correlation_results[self.correlation_results > 0].head(15)
        for i, (feature, corr) in enumerate(positive_corr.items(), 1):
            print(f"{i:2d}. {feature:<35} {corr:>6.3f}")
        
        print(f"\nFACTORS THAT HURT FANTASY PERFORMANCE:")
        negative_corr = self.correlation_results[self.correlation_results < 0].head(5)
        for i, (feature, corr) in enumerate(negative_corr.items(), 1):
            print(f"{i:2d}. {feature:<35} {corr:>6.3f}")
        
        # Position analysis
        print(f"\nFANTASY PERFORMANCE BY POSITION:")
        pos_stats = self.df.groupby('position_code')[['fantasy_points', 'fantasy_percentile']].agg(['count', 'mean', 'std'])
        print(pos_stats.round(2))
        
        # Top performers
        print(f"\nTOP 10 SINGLE-GAME FANTASY PERFORMANCES:")
        top_games = self.df.nlargest(10, 'fantasy_points')[['player_name', 'date', 'fantasy_points', 'goals', 'assists', 'shots']]
        print(top_games.to_string(index=False))
        
        print(f"\nKEY INSIGHTS:")
        if len(positive_corr) > 0:
            top_feature = positive_corr.index[0]
            top_corr_value = positive_corr.iloc[0]
            print(f"- Strongest predictor: {top_feature} (r={top_corr_value:.3f})")
        
        if any('toi' in feature.lower() for feature in positive_corr.index[:5]):
            print(f"- Ice time metrics are important for fantasy performance")
        
        if any('pp_' in feature for feature in positive_corr.index[:5]):
            print(f"- Power play usage correlates with fantasy success")
        
        if any('5v5' in feature for feature in positive_corr.index[:5]):
            print(f"- Even strength performance is predictive")
        
        print("="*60)
    
    def run_full_analysis(self, limit: Optional[int] = None) -> None:
        """Run the complete fantasy analysis pipeline."""
        print("Starting Fantasy Hockey Analysis...")
        
        # Load data
        self.load_data(limit=limit)
        
        # Clean data
        print("\nCleaning data...")
        numeric_columns = self.df.select_dtypes(include=[np.number]).columns
        self.df[numeric_columns] = self.df[numeric_columns].fillna(0)
        
        # Calculate fantasy points
        self.calculate_fantasy_points()
        
        # Calculate percentiles
        self.calculate_percentiles()
        
        # Analyze correlations
        self.analyze_high_fantasy_correlations()
        
        # Generate visualizations
        print("\nGenerating visualizations...")
        
        # 1. Fantasy distribution
        self.plot_fantasy_distribution()
        
        # 2. Fantasy correlations
        self.plot_fantasy_correlations(top_n=20)
        
        # 3. Tier analysis
        self.analyze_by_fantasy_tier()
        
        # 4. Generate insights report
        self.generate_fantasy_insights_report()
        
        print("\nFantasy analysis completed!")


if __name__ == "__main__":
    # Create analyzer and run analysis
    analyzer = FantasyPointsAnalyzer()
    
    # Run full analysis
    analyzer.run_full_analysis()  # Remove limit for full dataset