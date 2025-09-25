#!/usr/bin/env python3
"""
Top Scorers Relationship Analysis (Forwards vs Defensemen)

This script analyzes which metrics are most related to high point totals
for skaters, broken down by Forwards (C/L/R) and Defensemen (D), across the
20222023, 20232024, and 20242025 seasons.

Data sources (Supabase REST):
- wgo_skater_stats_totals: used to rank skaters by season points and assign percentile tiers
- player_totals_unified (materialized view): used to correlate non-trivial metrics with point percentile

What it does:
1) Pulls season totals for skaters and computes points percentile per group (F vs D)
2) Pulls season feature totals from player_totals_unified for the same players/seasons
3) Merges and computes correlations of features vs points percentile (per group)
4) Prints a concise report and can plot the top correlations

Usage:
    python top_scorers_relationship_analysis.py

Requirements:
    pip install pandas numpy matplotlib seaborn requests python-dotenv
"""

import os
from pathlib import Path
import warnings
from typing import Dict, List, Optional, Tuple


import numpy as np
import pandas as pd
import requests
import seaborn as sns
from dotenv import load_dotenv
import matplotlib.pyplot as plt

warnings.filterwarnings("ignore")


class TopScorersAnalyzer:
    def __init__(self,
                 seasons: Optional[List[int]] = None,
                 page_size: int = 1000):
        self.seasons = seasons or [20222023, 20232024, 20242025]
        self.page_size = page_size

        load_dotenv('/Users/tim/Desktop/fhfhockey.com/web/.env.local')
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
        self.wgo_df: Optional[pd.DataFrame] = None
        self.features_df: Optional[pd.DataFrame] = None
        self.merged_df: Optional[pd.DataFrame] = None
        self.correlations: Dict[str, pd.Series] = {}
        self.output_dir = Path(__file__).parent / 'output'
        self.output_dir.mkdir(parents=True, exist_ok=True)

        plt.style.use('seaborn-v0_8')
        sns.set_palette("husl")
        self._centered_share_cols: List[str] = []  # Track which share-percentage columns were centered, for optional splitting

    # -----------------------------
    # Data Loading Helpers
    # -----------------------------
    def _get(self, path: str, params: Dict[str, str]) -> requests.Response:
        url = f"{self.supabase_url}{path}"
        headers = {
            'apikey': self.supabase_key,
            'Authorization': f'Bearer {self.supabase_key}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
        return requests.get(url, headers=headers, params=params, timeout=30)

    def _paginate(self, path: str, base_params: Dict[str, str], limit: Optional[int] = None) -> List[Dict]:
        all_rows: List[Dict] = []
        offset = 0

        while True:
            params = dict(base_params)
            step = self.page_size
            if limit is not None:
                step = min(step, max(0, limit - len(all_rows)))
                if step <= 0:
                    break
            params['limit'] = str(step)
            params['offset'] = str(offset)

            resp = self._get(path, params)
            if resp.status_code != 200:
                raise RuntimeError(f"GET {path} failed: {resp.status_code} {resp.text}")

            batch = resp.json()
            if not batch:
                break
            all_rows.extend(batch)
            if limit is not None and len(all_rows) >= limit:
                break
            if len(batch) < self.page_size:
                break
            offset += self.page_size

        return all_rows

    # -----------------------------
    # Data Loading
    # -----------------------------
    def load_wgo_totals(self, limit: Optional[int] = None) -> pd.DataFrame:
        print("Loading season totals from wgo_skater_stats_totals…")

        seasons_expr = '(' + ','.join(str(s) for s in self.seasons) + ')'
        base_params = {
            # minimal fields required + useful identifiers
            'select': 'player_id,season,position_code,player_name,points,goals,assists,games_played',
            'position_code': 'in.(C,L,R,D)',
            'season': f'in.{seasons_expr}',
            'points': 'not.is.null',
            'order': 'season.asc,points.desc'
        }

        rows = self._paginate('/rest/v1/wgo_skater_stats_totals', base_params, limit=limit)
        df = pd.DataFrame(rows)
        if df.empty:
            raise ValueError("No data returned from wgo_skater_stats_totals")

        # Normalize position groups
        df['pos_group'] = np.where(df['position_code'].isin(['C', 'L', 'R']), 'F', 'D')

        # Add season_id to match player_totals_unified key (wgo.season is text)
        try:
            df['season_id'] = df['season'].astype(int)
        except Exception:
            # If season contains delimiters like '2022-2023', strip non-digits
            df['season_id'] = df['season'].astype(str).str.replace(r'\D', '', regex=True).astype(int)

        # Rank by points within pos_group across all requested seasons
        df['points_percentile'] = df.groupby('pos_group')['points'].rank(pct=True) * 100.0

        # Percentile tiers
        df['points_tier'] = pd.cut(
            df['points_percentile'],
            bins=[0, 25, 50, 75, 90, 95, 99, 100],
            labels=['Bottom 25%', '25-50%', '50-75%', '75-90%', '90-95%', '95-99%', 'Top 1%'],
            include_lowest=True
        )

        print(f"Loaded {len(df)} season-total rows for skaters across {len(self.seasons)} seasons")
        self.wgo_df = df
        return df

    def load_player_totals_unified(self, limit: Optional[int] = None) -> pd.DataFrame:
        print("Loading features from player_totals_unified…")

        seasons_expr = '(' + ','.join(str(s) for s in self.seasons) + ')'
        base_params = {
            'select': '*',
            'season_id': f'in.{seasons_expr}',
            'position_code': 'in.(C,L,R,D)',
            'order': 'season_id.asc,player_id.asc'
        }

        rows = self._paginate('/rest/v1/player_totals_unified', base_params, limit=limit)
        df = pd.DataFrame(rows)
        if df.empty:
            raise ValueError("No data returned from player_totals_unified")

        # Normalize position groups to match wgo
        df['pos_group'] = np.where(df['position_code'].isin(['C', 'L', 'R']), 'F', 'D')

        print(f"Loaded {len(df)} feature rows from player_totals_unified")
        self.features_df = df
        return df

    # -----------------------------
    # Processing & Correlations
    # -----------------------------
    def merge_datasets(self) -> pd.DataFrame:
        if self.wgo_df is None or self.features_df is None:
            raise RuntimeError("Call load_wgo_totals and load_player_totals_unified first")

        # Keep only keys + computed labels from wgo
        wgo_keys = self.wgo_df[['player_id', 'season_id', 'pos_group', 'points', 'goals', 'assists',
                                'points_percentile', 'points_tier']]

        merged = self.features_df.merge(
            wgo_keys,
            on=['player_id', 'season_id', 'pos_group'],
            how='inner',
            validate='m:1'
        )

        # Basic cleaning
        numeric_cols = merged.select_dtypes(include=[np.number]).columns
        merged[numeric_cols] = merged[numeric_cols].replace([np.inf, -np.inf], np.nan).fillna(0)

        self.merged_df = merged
        print(f"Merged dataset has {len(merged)} rows and {merged.shape[1]} columns")
        return merged

    def _center_share_percentages(self) -> List[str]:
        if self.merged_df is None:
            return []
        df = self.merged_df
        # Target GF/GA-style shares; exclude oi shooting/save % explicitly
        share_suffixes = [
            'cf_pct_all', 'ff_pct_all', 'sf_pct_all', 'gf_pct_all', 'xgf_pct_all',
            'scf_pct_all', 'hdcf_pct_all', 'hdgf_pct_all', 'mdcf_pct_all', 'mdgf_pct_all'
        ]
        explicit_cols = ['es_gf_pct']
        exclude_cols = {'nst_oi_shooting_pct_all', 'nst_oi_save_pct_all'}

        cols_to_center: List[str] = []
        for c in df.columns:
            lc = c.lower()
            if c in exclude_cols:
                continue
            if lc in explicit_cols or any(lc.endswith(suf) for suf in share_suffixes):
                cols_to_center.append(c)

        for c in cols_to_center:
            vals = df[c].astype(float)
            # Decide scale: 0..1 vs 0..100
            if np.nanmax(vals.values) > 1.01:
                df[c] = vals - 50.0
            else:
                df[c] = vals - 0.5

        # Save for downstream optional splitting
        self._centered_share_cols = cols_to_center
        return cols_to_center

    def _split_centered_shares(self) -> None:
        """Create asymmetric features from centered share-percentage columns.
        For each centered column X (centered around 0), add:
          - X_pos: max(X, 0)     (positive magnitude above 50%)
          - X_neg: max(-X, 0)    (negative magnitude below 50%)
        We keep original X as the symmetric version.
        """
        if self.merged_df is None or not self._centered_share_cols:
            return
        df = self.merged_df
        for c in self._centered_share_cols:
            vals = pd.to_numeric(df[c], errors='coerce').fillna(0.0)
            # Preserve percentage-family detection by inserting '_pct' substring in the name if missing
            # If original had '_pct' already (e.g., 'cf_pct_all'), appending suffix keeps '_pct' within name
            df[f"{c}_pos"] = np.maximum(vals, 0.0)
            df[f"{c}_neg"] = np.maximum(-vals, 0.0)

    def _feature_columns(self, cols: List[str], exclude_recursive: bool) -> List[str]:
        # Always exclude identifiers and the target
        base_exclude = set(['player_id', 'season_id', 'team_id', 'pos_group', 'points_percentile'])

        if not exclude_recursive:
            return [c for c in cols if c not in base_exclude]

        # Exclude recursive (target components and direct derivatives)
        recursive = set([
            # Direct totals
            'points', 'goals', 'assists',
            'points_all_situations', 'goals_all_situations', 'assists_all_situations',
            'pp_points', 'sh_points', 'pp_goals', 'pp_assists', 'sh_goals', 'sh_assists',
            'goals_5v5', 'assists_5v5', 'points_5v5', 'gw_goals',
            'total_primary_assists', 'total_secondary_assists',
            # Per-game and Per-60 of these
            'points_per_game', 'goals_per_game', 'assists_per_game',
            'points_per_60', 'goals_per_60', 'assists_per_60',
            'p_per_60_5v5', 'g_per_60_5v5', 'a_per_60_5v5', 'pp_g_per_60', 'pp_p_per_60',
            'nst_g_per_60_all_situations', 'nst_a_per_60_all_situations', 'nst_p_per_60_all_situations',
        ])

        exclude = base_exclude.union(recursive)
        return [c for c in cols if c not in exclude]

    def compute_correlations(self, exclude_recursive: bool = True) -> Dict[str, pd.Series]:
        if self.merged_df is None:
            raise RuntimeError("Call merge_datasets first")

        results: Dict[str, pd.Series] = {}
        for group in ['F', 'D']:
            sub = self.merged_df[self.merged_df['pos_group'] == group]
            if sub.empty:
                continue

            target = sub['points_percentile']
            numeric_cols = sub.select_dtypes(include=[np.number]).columns.tolist()
            feature_cols = self._feature_columns(numeric_cols, exclude_recursive=exclude_recursive)

            # Defensive: ensure we don't include the target itself or NaN-only cols
            X = sub[feature_cols]
            valid_cols = X.columns[X.notna().any()].tolist()
            X = X[valid_cols]

            corr = X.corrwith(target).dropna()
            corr = corr.reindex(corr.abs().sort_values(ascending=False).index)
            results[group] = corr
            print(f"Computed {len(corr)} correlations for group {group}")

        self.correlations = results
        return results

    # -----------------------------
    # Metric Family Analysis
    # -----------------------------
    def _categorize_metrics(self, cols: List[str], exclude_recursive: bool) -> Dict[str, List[str]]:
        feature_cols = self._feature_columns(cols, exclude_recursive=exclude_recursive)
        rates: List[str] = []
        percentages: List[str] = []
        counts: List[str] = []

        for c in feature_cols:
            lc = c.lower()
            if 'per_60' in lc:
                rates.append(c)
            elif ('_pct' in lc) or ('percentage' in lc) or lc.endswith('_pct') or lc.endswith('_pct_rates') or lc.endswith('_pct_all'):
                percentages.append(c)
            else:
                counts.append(c)
        return {'rates': rates, 'percentages': percentages, 'counts': counts}

    def compute_correlations_by_family(self, exclude_recursive: bool, tag_prefix: str) -> None:
        if self.merged_df is None:
            raise RuntimeError("Call merge_datasets first")

        for group in ['F', 'D']:
            sub = self.merged_df[self.merged_df['pos_group'] == group]
            if sub.empty:
                continue
            target = sub['points_percentile']
            numeric_cols = sub.select_dtypes(include=[np.number]).columns.tolist()
            families = self._categorize_metrics(numeric_cols, exclude_recursive=exclude_recursive)

            for fam_name, fam_cols in families.items():
                if not fam_cols:
                    continue
                X = sub[fam_cols]
                valid_cols = X.columns[X.notna().any()].tolist()
                X = X[valid_cols]
                corr = X.corrwith(target).dropna()
                corr = corr.reindex(corr.abs().sort_values(ascending=False).index)

                out_csv = self.output_dir / f'correlations_{tag_prefix}_{fam_name}_{group}.csv'
                corr.to_frame(name='correlation').reset_index().rename(columns={'index': 'metric'}).to_csv(out_csv, index=False)
                print(f"Saved {fam_name} correlations ({tag_prefix}) for group {group} -> {out_csv}")

                try:
                    self._plot_correlation_series(corr, title=f'{fam_name.title()} Correlations ({tag_prefix}) - {"Forwards" if group=="F" else "Defensemen"}',
                                                  out_png=out_csv.with_suffix('.png'))
                except Exception as e:
                    print(f"Warning: failed to plot {fam_name} correlations for {group} ({tag_prefix}): {e}")

    def save_correlations(self, corrs: Dict[str, pd.Series], tag: str) -> None:
        for group, series in corrs.items():
            out_path = self.output_dir / f'correlations_{tag}_{"F" if group=="F" else "D"}.csv'
            df_out = series.to_frame(name='correlation').reset_index().rename(columns={'index': 'metric'})
            df_out.to_csv(out_path, index=False)
            print(f"Saved correlations ({tag}) for group {group} -> {out_path}")

            # Also save a visualization (bar chart) for this CSV
            try:
                self._plot_correlation_series(series, title=f'Correlations ({tag}) - {"Forwards" if group=="F" else "Defensemen"}',
                                              out_png=out_path.with_suffix('.png'))
            except Exception as e:
                print(f"Warning: failed to plot correlations for {group} ({tag}): {e}")

    def analyze_percentile_buckets(self, exclude_recursive: bool = True) -> None:
        if self.merged_df is None:
            raise RuntimeError("Call merge_datasets first")

        # Define buckets explicitly to cover requested ranges
        bins = [0, 5, 10, 20, 50, 80, 90, 95, 100]
        labels = ['0-5%', '5-10%', '10-20%', '20-50%', '50-80%', '80-90%', '90-95%', '95-100%']
        df = self.merged_df.copy()
        df['percentile_bucket'] = pd.cut(df['points_percentile'], bins=bins, labels=labels, include_lowest=True, right=True)

        for group in ['F', 'D']:
            sub = df[df['pos_group'] == group]
            if sub.empty:
                continue
            numeric_cols = sub.select_dtypes(include=[np.number]).columns.tolist()
            feature_cols = self._feature_columns(numeric_cols, exclude_recursive=exclude_recursive)

            # Compute means by bucket
            means = sub.groupby('percentile_bucket')[feature_cols].mean().astype(float)
            out_path = self.output_dir / f'feature_means_by_bucket_{"no_recursive" if exclude_recursive else "all"}_{group}.csv'
            means.to_csv(out_path)
            print(f"Saved feature means by percentile bucket ({'no_recursive' if exclude_recursive else 'all'}) for group {group} -> {out_path}")

            # Also save a heatmap visualization for this CSV
            try:
                self._plot_bucket_means_heatmap(means, title=f'Feature Means by Percentile Bucket ({"No Recursive" if exclude_recursive else "All"}) - {"Forwards" if group=="F" else "Defensemen"}',
                                                out_png=out_path.with_suffix('.png'))
            except Exception as e:
                print(f"Warning: failed to plot bucket means for {group} ({'no_recursive' if exclude_recursive else 'all'}): {e}")

    # -----------------------------
    # Visualization Helpers
    # -----------------------------
    def _plot_correlation_series(self, series: pd.Series, title: str, out_png: Path) -> None:
        series = series.dropna()
        n = len(series)
        if n == 0:
            return
        height = max(6, 0.28 * n)
        plt.figure(figsize=(14, height))
        values = series.values
        colors = ['#d62728' if v < 0 else '#1f77b4' for v in values]
        plt.barh(range(n), values, color=colors, alpha=0.8)
        plt.yticks(range(n), series.index)
        plt.xlabel('Correlation with Points Percentile')
        plt.title(title)
        plt.grid(axis='x', alpha=0.3)
        # annotate sparsely to avoid clutter
        for i, v in enumerate(values):
            if i % max(1, n // 50) == 0:
                plt.text(v + (0.01 if v >= 0 else -0.01), i, f"{v:.3f}", va='center',
                         ha='left' if v >= 0 else 'right', fontsize=8)
        plt.tight_layout()
        plt.savefig(out_png, dpi=200)
        plt.close()

    def _plot_bucket_means_heatmap(self, means: pd.DataFrame, title: str, out_png: Path) -> None:
        df = means.copy()
        # Order rows by defined bucket order if possible
        if isinstance(df.index, pd.CategoricalIndex):
            df = df.loc[list(df.index.categories)]
        # Min-max normalize each column across buckets for comparability
        norm = df.copy().astype(float)
        for col in norm.columns:
            col_min = norm[col].min()
            col_max = norm[col].max()
            if pd.isna(col_min) or pd.isna(col_max) or col_max == col_min:
                norm[col] = 0.5
            else:
                norm[col] = (norm[col] - col_min) / (col_max - col_min)
        # Large number of metrics -> tall heatmap
        height = max(6, 0.25 * len(norm.columns))
        plt.figure(figsize=(16, height))
        sns.heatmap(norm.T, cmap='RdYlBu_r', vmin=0, vmax=1, cbar_kws={'label': 'Normalized (per-metric)'} )
        plt.title(title)
        plt.xlabel('Percentile Bucket')
        plt.ylabel('Metric')
        plt.tight_layout()
        plt.savefig(out_png, dpi=220)
        plt.close()

    def _plot_effect_sizes(self, series: pd.Series, title: str, out_png: Path) -> None:
        series = series.dropna()
        n = len(series)
        if n == 0:
            return
        height = max(6, 0.28 * n)
        plt.figure(figsize=(14, height))
        vals = series.values
        colors = ['#d62728' if v < 0 else '#1f77b4' for v in vals]
        plt.barh(range(n), vals, color=colors, alpha=0.8)
        plt.yticks(range(n), series.index)
        plt.xlabel("Cohen's d (Top 5% vs Rest)")
        plt.title(title)
        plt.grid(axis='x', alpha=0.3)
        for i, v in enumerate(vals):
            if i % max(1, n // 50) == 0:
                plt.text(v + (0.01 if v >= 0 else -0.01), i, f"{v:.3f}", va='center',
                         ha='left' if v >= 0 else 'right', fontsize=8)
        plt.tight_layout()
        plt.savefig(out_png, dpi=200)
        plt.close()

    def _plot_bar_series(self, series: pd.Series, xlabel: str, title: str, out_png: Path) -> None:
        series = series.dropna()
        n = len(series)
        if n == 0:
            return
        height = max(6, 0.28 * n)
        plt.figure(figsize=(14, height))
        vals = series.values
        colors = ['#d62728' if v < 0 else '#1f77b4' for v in vals]
        plt.barh(range(n), vals, color=colors, alpha=0.8)
        plt.yticks(range(n), series.index)
        plt.xlabel(xlabel)
        plt.title(title)
        plt.grid(axis='x', alpha=0.3)
        for i, v in enumerate(vals):
            if i % max(1, n // 50) == 0:
                plt.text(v + (0.01 if v >= 0 else -0.01), i, f"{v:.3f}", va='center',
                         ha='left' if v >= 0 else 'right', fontsize=8)
        plt.tight_layout()
        plt.savefig(out_png, dpi=200)
        plt.close()

    # -----------------------------
    # Top 5% vs Rest Analyses
    # -----------------------------
    def top5_vs_rest(self, exclude_recursive: bool, tag_prefix: str, by_family: bool = True) -> None:
        if self.merged_df is None:
            raise RuntimeError("Call merge_datasets first")

        for group in ['F', 'D']:
            sub = self.merged_df[self.merged_df['pos_group'] == group].copy()
            if sub.empty:
                continue
            sub['is_top5'] = (sub['points_percentile'] >= 95).astype(int)

            numeric_cols = sub.select_dtypes(include=[np.number]).columns.tolist()
            families = {'all': self._feature_columns(numeric_cols, exclude_recursive=exclude_recursive)}
            if by_family:
                fam_split = self._categorize_metrics(numeric_cols, exclude_recursive=exclude_recursive)
                families.update(fam_split)

            for fam_name, fam_cols in families.items():
                if not fam_cols:
                    continue
                X = sub[fam_cols]
                valid_cols = X.columns[X.notna().any()].tolist()
                X = X[valid_cols]
                y = sub['is_top5']

                # Point-biserial correlation == Pearson between binary and continuous
                corr = X.corrwith(y).dropna()
                corr = corr.reindex(corr.abs().sort_values(ascending=False).index)
                out_corr = self.output_dir / f'top5_vs_rest_corr_{tag_prefix}_{fam_name}_{group}.csv'
                corr.to_frame(name='point_biserial_corr').reset_index().rename(columns={'index': 'metric'}).to_csv(out_corr, index=False)
                try:
                    self._plot_correlation_series(corr, title=f'Top 5% vs Rest Correlation ({tag_prefix}, {fam_name}) - {"Forwards" if group=="F" else "Defensemen"}', out_png=out_corr.with_suffix('.png'))
                except Exception as e:
                    print(f"Warning: failed to plot top5 vs rest corr for {group} ({tag_prefix}/{fam_name}): {e}")

                # Cohen's d effect size
                top = sub[sub['is_top5'] == 1]
                rest = sub[sub['is_top5'] == 0]
                m1 = top[valid_cols].mean()
                m0 = rest[valid_cols].mean()
                s1 = top[valid_cols].std(ddof=1)
                s0 = rest[valid_cols].std(ddof=1)
                n1 = len(top)
                n0 = len(rest)
                sp = np.sqrt(((n1 - 1) * s1.pow(2) + (n0 - 1) * s0.pow(2)) / np.maximum(n1 + n0 - 2, 1))
                d = (m1 - m0) / sp.replace(0, np.nan)
                d = d.dropna().reindex(d.abs().sort_values(ascending=False).index)
                out_eff = self.output_dir / f'top5_vs_rest_effect_{tag_prefix}_{fam_name}_{group}.csv'
                d.to_frame(name="cohens_d").reset_index().rename(columns={'index': 'metric'}).to_csv(out_eff, index=False)
                try:
                    self._plot_effect_sizes(d, title=f'Top 5% vs Rest Effect Size ({tag_prefix}, {fam_name}) - {"Forwards" if group=="F" else "Defensemen"}', out_png=out_eff.with_suffix('.png'))
                except Exception as e:
                    print(f"Warning: failed to plot top5 vs rest effect sizes for {group} ({tag_prefix}/{fam_name}): {e}")

    # -----------------------------
    # Z-scored Correlations & Top5 vs Rest
    # -----------------------------
    def compute_correlations_zscore(self, exclude_recursive: bool, tag_prefix: str) -> None:
        if self.merged_df is None:
            raise RuntimeError("Call merge_datasets first")

        for group in ['F', 'D']:
            sub = self.merged_df[self.merged_df['pos_group'] == group]
            if sub.empty:
                continue
            target = sub['points_percentile']
            numeric_cols = sub.select_dtypes(include=[np.number]).columns.tolist()
            feature_cols = self._feature_columns(numeric_cols, exclude_recursive=exclude_recursive)
            X = sub[feature_cols].astype(float)
            Z = (X - X.mean()) / X.std(ddof=1)
            valid_cols = Z.columns[Z.notna().any()].tolist()
            Z = Z[valid_cols]
            corr = Z.corrwith(target).dropna()
            corr = corr.reindex(corr.abs().sort_values(ascending=False).index)
            out_csv = self.output_dir / f'correlations_{tag_prefix}_zscore_{group}.csv'
            corr.to_frame(name='correlation').reset_index().rename(columns={'index': 'metric'}).to_csv(out_csv, index=False)
            print(f"Saved z-score correlations ({tag_prefix}) for group {group} -> {out_csv}")
            try:
                self._plot_correlation_series(corr, title=f'Z-score Correlations ({tag_prefix}) - {"Forwards" if group=="F" else "Defensemen"}', out_png=out_csv.with_suffix('.png'))
            except Exception as e:
                print(f"Warning: failed to plot zscore correlations for {group} ({tag_prefix}): {e}")

            # Family splits under z-scored features
            families = self._categorize_metrics(numeric_cols, exclude_recursive=exclude_recursive)
            for fam_name, fam_cols in families.items():
                if not fam_cols:
                    continue
                cols_present = [c for c in fam_cols if c in Z.columns]
                if not cols_present:
                    continue
                Zf = Z[cols_present]
                vc = Zf.columns[Zf.notna().any()].tolist()
                Zf = Zf[vc]
                corr_f = Zf.corrwith(target).dropna()
                corr_f = corr_f.reindex(corr_f.abs().sort_values(ascending=False).index)
                out_f = self.output_dir / f'correlations_{tag_prefix}_zscore_{fam_name}_{group}.csv'
                corr_f.to_frame(name='correlation').reset_index().rename(columns={'index': 'metric'}).to_csv(out_f, index=False)
                print(f"Saved z-score {fam_name} correlations ({tag_prefix}) for group {group} -> {out_f}")
                try:
                    self._plot_correlation_series(corr_f, title=f'Z-score {fam_name.title()} Correlations ({tag_prefix}) - {"Forwards" if group=="F" else "Defensemen"}', out_png=out_f.with_suffix('.png'))
                except Exception as e:
                    print(f"Warning: failed to plot zscore family correlations for {group} ({tag_prefix}/{fam_name}): {e}")

    def top5_vs_rest_zscore(self, exclude_recursive: bool, tag_prefix: str, by_family: bool = True) -> None:
        if self.merged_df is None:
            raise RuntimeError("Call merge_datasets first")

        for group in ['F', 'D']:
            sub = self.merged_df[self.merged_df['pos_group'] == group].copy()
            if sub.empty:
                continue
            sub['is_top5'] = (sub['points_percentile'] >= 95).astype(int)

            numeric_cols = sub.select_dtypes(include=[np.number]).columns.tolist()
            families = {'all': self._feature_columns(numeric_cols, exclude_recursive=exclude_recursive)}
            if by_family:
                fam_split = self._categorize_metrics(numeric_cols, exclude_recursive=exclude_recursive)
                families.update(fam_split)

            for fam_name, fam_cols in families.items():
                if not fam_cols:
                    continue
                cols_present = [c for c in fam_cols if c in sub.columns]
                if not cols_present:
                    continue
                X = sub[cols_present].astype(float)
                Z = (X - X.mean()) / X.std(ddof=1)
                valid_cols = Z.columns[Z.notna().any()].tolist()
                Z = Z[valid_cols]
                y = sub['is_top5']

                # Mean z-difference between Top5 and Rest
                top = Z[y == 1]
                rest = Z[y == 0]
                mean_diff = (top.mean() - rest.mean()).dropna()
                mean_diff = mean_diff.reindex(mean_diff.abs().sort_values(ascending=False).index)
                out_md = self.output_dir / f'top5_vs_rest_mean_zdiff_{tag_prefix}_{fam_name}_{group}.csv'
                mean_diff.to_frame(name='mean_z_diff').reset_index().rename(columns={'index': 'metric'}).to_csv(out_md, index=False)
                print(f"Saved Top5 vs Rest mean z-diff ({tag_prefix}, {fam_name}) for group {group} -> {out_md}")
                try:
                    self._plot_bar_series(mean_diff, xlabel='Mean Z Difference (Top5 - Rest)', title=f'Top 5% vs Rest Mean Z-Diff ({tag_prefix}, {fam_name}) - {"Forwards" if group=="F" else "Defensemen"}', out_png=out_md.with_suffix('.png'))
                except Exception as e:
                    print(f"Warning: failed to plot mean z-diff for {group} ({tag_prefix}/{fam_name}): {e}")

    # -----------------------------
    # Z-scored Bucket Means
    # -----------------------------
    def analyze_zscore_bucket_means(self, exclude_recursive: bool = True) -> None:
        if self.merged_df is None:
            raise RuntimeError("Call merge_datasets first")

        bins = [0, 5, 10, 20, 50, 80, 90, 95, 100]
        labels = ['0-5%', '5-10%', '10-20%', '20-50%', '50-80%', '80-90%', '90-95%', '95-100%']
        df = self.merged_df.copy()
        df['percentile_bucket'] = pd.cut(df['points_percentile'], bins=bins, labels=labels, include_lowest=True, right=True)

        for group in ['F', 'D']:
            sub = df[df['pos_group'] == group].copy()
            if sub.empty:
                continue
            numeric_cols = sub.select_dtypes(include=[np.number]).columns.tolist()
            feature_cols = self._feature_columns(numeric_cols, exclude_recursive=exclude_recursive)
            # z-score per metric within group
            Z = sub[feature_cols].astype(float)
            Z = (Z - Z.mean()) / Z.std(ddof=1)
            z_means = Z.groupby(sub['percentile_bucket']).mean()
            tag = 'no_recursive' if exclude_recursive else 'all'
            out_csv = self.output_dir / f'feature_means_by_bucket_{tag}_{group}_zscore.csv'
            z_means.to_csv(out_csv)
            print(f"Saved z-score feature means by percentile bucket ({tag}) for group {group} -> {out_csv}")
            try:
                self._plot_bucket_means_heatmap(z_means, title=f'Z-Scored Feature Means by Percentile Bucket ({"No Recursive" if exclude_recursive else "All"}) - {"Forwards" if group=="F" else "Defensemen"}', out_png=out_csv.with_suffix('.png'))
            except Exception as e:
                print(f"Warning: failed to plot z-score bucket means for {group} ({tag}): {e}")

    # -----------------------------
    # Reporting & Plots
    # -----------------------------
    def print_report(self, top_n: int = 20) -> None:
        if not self.correlations:
            print("No correlations computed yet. Call compute_correlations().")
            return

        print("\n" + "=" * 60)
        print("TOP SCORERS RELATIONSHIP ANALYSIS REPORT")
        print("=" * 60)

        # Dataset summary
        if self.merged_df is not None:
            total_rows = len(self.merged_df)
            players = self.merged_df[['player_id', 'season_id']].drop_duplicates().shape[0]
            seasons = sorted(self.merged_df['season_id'].unique().tolist())
            print(f"Rows: {total_rows:,} | Player-seasons: {players:,} | Seasons: {', '.join(map(str, seasons))}")

        for group, label in [('F', 'Forwards'), ('D', 'Defensemen')]:
            if group not in self.correlations:
                continue
            corr = self.correlations[group]
            pos = corr[corr > 0].head(top_n)
            neg = corr[corr < 0].head(10)

            print("\n" + "-" * 60)
            print(f"Group: {label}")
            print("-" * 60)
            print(f"Top {len(pos)} positively related metrics to high points:")
            for i, (feat, val) in enumerate(pos.items(), 1):
                print(f"{i:2d}. {feat:<40} {val:>7.3f}")
            if len(neg) > 0:
                print(f"\nMetrics inversely related to high points:")
                for i, (feat, val) in enumerate(neg.items(), 1):
                    print(f"{i:2d}. {feat:<40} {val:>7.3f}")

    def plot_top_correlations(self, group: str, top_n: int = 20) -> None:
        if group not in self.correlations or self.correlations[group].empty:
            print(f"No correlations available for group {group}")
            return

        corr = self.correlations[group].head(top_n)
        plt.figure(figsize=(12, 7))
        colors = ['red' if v < 0 else 'blue' for v in corr.values]
        bars = plt.barh(range(len(corr)), corr.values, color=colors, alpha=0.75)
        plt.yticks(range(len(corr)), corr.index)
        plt.xlabel('Correlation with Points Percentile')
        plt.title(f'Top {top_n} Correlated Metrics - {"Forwards" if group=="F" else "Defensemen"}')
        plt.grid(axis='x', alpha=0.3)
        for i, (b, v) in enumerate(zip(bars, corr.values)):
            plt.text(v + (0.01 if v >= 0 else -0.01), i, f"{v:.3f}", va='center', ha='left' if v >= 0 else 'right')
        plt.tight_layout()
        plt.show()

    # -----------------------------
    # Context-specific correlations (AS, PP, 5v5, ES/EV)
    # -----------------------------
    def contextual_correlations(self, exclude_recursive: bool = True, top_n: int = 20) -> None:
        if self.merged_df is None:
            return
        # Define context mapping: target columns and metric name patterns
        contexts = {
            'AS': {
                'target_totals': [
                    'points_all_situations', 'goals_all_situations', 'assists_all_situations',
                    'points'  # fallback
                ],
                'feature_filters': ['_all_situations']
            },
            'PP': {
                'target_totals': ['pp_points', 'pp_goals', 'pp_assists'],
                'feature_filters': ['pp_', '_pp', 'powerplay']
            },
            '5v5': {
                'target_totals': [
                    'points_5v5', 'goals_5v5', 'assists_5v5',
                    'ev_points', 'ev_goals', 'ev_assists',
                    'es_points', 'es_goals', 'es_assists'
                ],
                'feature_filters': ['5v5', '_ev', '_es']
            },
            'ES': {
                'target_totals': [
                    'es_points', 'es_goals', 'es_assists',
                    'ev_points', 'ev_goals', 'ev_assists',
                    'points_5v5', 'goals_5v5', 'assists_5v5'
                ],
                'feature_filters': ['_es', '_ev', '5v5']
            }
        }
        # Columns to exclude always (ids and target percentile)
        base_exclude = set(['player_id', 'season_id', 'team_id', 'pos_group', 'points_percentile'])

        # We'll render a grouped, 2x2 plot of correlations for each group
        for group in ['F', 'D']:
            sub = self.merged_df[self.merged_df['pos_group'] == group].copy()
            if sub.empty:
                continue

            # Synthesize missing point totals where possible
            if 'points_5v5' not in sub.columns and {'goals_5v5','assists_5v5'}.issubset(sub.columns):
                sub['points_5v5'] = pd.to_numeric(sub['goals_5v5'], errors='coerce').fillna(0) + pd.to_numeric(sub['assists_5v5'], errors='coerce').fillna(0)
            if 'es_points' not in sub.columns and {'es_goals','es_assists'}.issubset(sub.columns):
                sub['es_points'] = pd.to_numeric(sub['es_goals'], errors='coerce').fillna(0) + pd.to_numeric(sub['es_assists'], errors='coerce').fillna(0)
            if 'ev_points' not in sub.columns and {'ev_goals','ev_assists'}.issubset(sub.columns):
                sub['ev_points'] = pd.to_numeric(sub['ev_goals'], errors='coerce').fillna(0) + pd.to_numeric(sub['ev_assists'], errors='coerce').fillna(0)
            if 'pp_points' not in sub.columns and {'pp_goals','pp_assists'}.issubset(sub.columns):
                sub['pp_points'] = pd.to_numeric(sub['pp_goals'], errors='coerce').fillna(0) + pd.to_numeric(sub['pp_assists'], errors='coerce').fillna(0)
            if 'points_all_situations' not in sub.columns and {'goals_all_situations','assists_all_situations'}.issubset(sub.columns):
                sub['points_all_situations'] = pd.to_numeric(sub['goals_all_situations'], errors='coerce').fillna(0) + pd.to_numeric(sub['assists_all_situations'], errors='coerce').fillna(0)

            fig, axes = plt.subplots(2, 2, figsize=(18, 12))
            fig.suptitle(f'Context-Specific Correlations (No-Recursive) - {"Forwards" if group=="F" else "Defensemen"}')
            ax_map = {'AS': (0,0), 'PP': (0,1), '5v5': (1,0), 'ES': (1,1)}

            for ctx_name, cfg in contexts.items():
                # Choose target as the relevant total points for the context
                target_cols = [c for c in cfg['target_totals'] if c in sub.columns]
                target = None
                chosen_target_name = None
                if target_cols:
                    chosen_target_name = target_cols[0]
                    target = sub[chosen_target_name].astype(float)
                else:
                    # Dynamic fallback: any 'points' column with context pattern
                    pats = cfg['feature_filters']
                    points_candidates = [c for c in sub.columns if ('points' in c.lower()) and any(p.lower() in c.lower() for p in pats)]
                    if points_candidates:
                        chosen_target_name = points_candidates[0]
                        target = sub[chosen_target_name].astype(float)
                    else:
                        # Try constructing from goals+assists in this context
                        goals_candidates = [c for c in sub.columns if ('goals' in c.lower()) and any(p.lower() in c.lower() for p in pats)]
                        assists_candidates = [c for c in sub.columns if ('assists' in c.lower()) and any(p.lower() in c.lower() for p in pats)]
                        if goals_candidates and assists_candidates:
                            gcol = goals_candidates[0]
                            acol = assists_candidates[0]
                            chosen_target_name = f"{ctx_name}_points_synth"
                            target = pd.to_numeric(sub[gcol], errors='coerce').fillna(0) + pd.to_numeric(sub[acol], errors='coerce').fillna(0)
                if target is None:
                    chosen_target_name = 'points_percentile'
                    target = sub['points_percentile'].astype(float)
                    print(f"Context {ctx_name} for group {group}: falling back to points_percentile as target")
                # Build candidate features by pattern
                numeric_cols = sub.select_dtypes(include=[np.number]).columns.tolist()
                # Apply our normal exclude list (and recursive if requested)
                candidates = [c for c in numeric_cols if c not in base_exclude]
                if exclude_recursive:
                    candidates = self._feature_columns(candidates, exclude_recursive=True)
                # Keep features whose names match this context
                pats = cfg['feature_filters']
                ctx_feats = [c for c in candidates if any(p.lower() in c.lower() for p in pats)]
                if not ctx_feats:
                    continue

                X = sub[ctx_feats]
                valid_cols = X.columns[X.notna().any()].tolist()
                X = X[valid_cols]
                if X.empty:
                    continue
                corr = X.corrwith(target).dropna()
                if corr.empty:
                    continue
                corr = corr.reindex(corr.abs().sort_values(ascending=False).index)
                out_csv = self.output_dir / f'context_corr_{ctx_name}_no_recursive_{group}.csv'
                corr.to_frame(name='correlation').reset_index().rename(columns={'index': 'metric'}).to_csv(out_csv, index=False)
                print(f"Saved context {ctx_name} correlations (no_recursive) for group {group} -> {out_csv}")
                # Also save a standalone per-context PNG
                try:
                    self._plot_correlation_series(corr, title=f'{ctx_name} Correlations (No-Recursive) - {"Forwards" if group=="F" else "Defensemen"}', out_png=out_csv.with_suffix('.png'))
                except Exception as e:
                    print(f"Warning: failed to plot per-context {ctx_name} for group {group}: {e}")
                # Plot into its quadrant
                r, c = ax_map[ctx_name]
                ax = axes[r][c]
                top = corr.head(top_n)
                vals = top.values
                colors = ['#d62728' if v < 0 else '#1f77b4' for v in vals]
                ax.barh(range(len(top)), vals, color=colors, alpha=0.8)
                ax.set_yticks(range(len(top)))
                ax.set_yticklabels(top.index, fontsize=8)
                ax.set_title(f'{ctx_name} (target: {chosen_target_name})')
                ax.grid(axis='x', alpha=0.3)
            plt.tight_layout(rect=[0, 0.03, 1, 0.95])
            out_png = self.output_dir / f'context_corr_no_recursive_grouped_{group}.png'
            plt.savefig(out_png, dpi=220)
            plt.close()

    # -----------------------------
    # Pipeline
    # -----------------------------
    def run(self, limit_wgo: Optional[int] = None, limit_features: Optional[int] = None, plot: bool = True, split_centered_shares: bool = True) -> None:
        self.load_wgo_totals(limit=limit_wgo)
        self.load_player_totals_unified(limit=limit_features)
        self.merge_datasets()
        # Center GF/GA-style share percentages (50% -> 0, 0.5 -> 0)
        self._center_share_percentages()
        # Optionally add asymmetric positive/negative magnitudes for centered share metrics
        if split_centered_shares:
            self._split_centered_shares()
        # Correlations with ALL metrics (including recursive)
        all_corrs = self.compute_correlations(exclude_recursive=False)
        self.save_correlations(all_corrs, tag='all_metrics')
        # Families for ALL metrics
        self.compute_correlations_by_family(exclude_recursive=False, tag_prefix='all_metrics')
        # Correlations with NO recursive metrics
        no_rec_corrs = self.compute_correlations(exclude_recursive=True)
        self.save_correlations(no_rec_corrs, tag='no_recursive')
        # Families for NO recursive metrics
        self.compute_correlations_by_family(exclude_recursive=True, tag_prefix='no_recursive')
        # Top 5% vs Rest (both all and no-recursive, with family splits)
        self.top5_vs_rest(exclude_recursive=False, tag_prefix='all_metrics', by_family=True)
        self.top5_vs_rest(exclude_recursive=True, tag_prefix='no_recursive', by_family=True)
        # Z-score correlations and family splits
        self.compute_correlations_zscore(exclude_recursive=False, tag_prefix='all_metrics')
        self.compute_correlations_zscore(exclude_recursive=True, tag_prefix='no_recursive')
        # Top 5% vs Rest mean z differences (all and no-recursive)
        self.top5_vs_rest_zscore(exclude_recursive=False, tag_prefix='all_metrics', by_family=True)
        self.top5_vs_rest_zscore(exclude_recursive=True, tag_prefix='no_recursive', by_family=True)
        # Print short report for no-recursive to keep console readable
        self.print_report(top_n=30)
        # Bucket analyses
        self.analyze_percentile_buckets(exclude_recursive=False)
        self.analyze_percentile_buckets(exclude_recursive=True)
        # Z-scored bucket means (all and no-recursive)
        self.analyze_zscore_bucket_means(exclude_recursive=False)
        self.analyze_zscore_bucket_means(exclude_recursive=True)
        # Contextual (AS, PP, 5v5, ES/EV) no-recursive correlations + grouped plot
        self.contextual_correlations(exclude_recursive=True, top_n=20)
        if plot:
            self.plot_top_correlations('F', top_n=30)
            self.plot_top_correlations('D', top_n=30)


if __name__ == "__main__":
    analyzer = TopScorersAnalyzer()
    analyzer.run(plot=True)
