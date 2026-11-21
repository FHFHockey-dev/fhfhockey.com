"""As-of-close predictors for the authorized 2024–25 skater-points experiment."""
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
RAW = HERE.parents[3] / "web/scripts/output/sko_features.parquet"
KEY = ["player_id", "season_id", "date"]
PILOT = ["shots", "nst_ixg", "pp_toi", "toi_per_game", "missed_shots"]
FAMILIES = {
    "deployment": ["toi_per_game", "es_toi_per_game", "pp_toi", "pp_fraction"],
    "generation": ["shots", "missed_shots", "nst_icf", "nst_ixg", "ixg60", "nst_hdcf"],
    "conversion": ["goals_minus_ixg", "shrunk_shoot_pct", "total_primary_assists",
                   "total_secondary_assists", "on_ice_finish"],
    "context": ["rest_days", "team_change"],
}
TRANSFORMS = ["level", "delta", "direction"]
FAMILY_COLS = {family: [f"{m}_{t}" for m in metrics for t in TRANSFORMS]
               for family, metrics in FAMILIES.items()}
KNOWN = ["neutral", "cold", "hot"]


def roll(series, group, width, lag=0):
    values = series.groupby(group, sort=False).shift(lag) if lag else series
    result = values.groupby(group, sort=False).rolling(width, min_periods=width).mean()
    return result.droplevel(0).reindex(series.index)


def load_input(study):
    raw_columns = ["player_id", "season_id", "date", "shots", "missed_shots", "goals",
                   "nst_ixg", "nst_icf", "nst_hdcf", "nst_toi", "toi_per_game",
                   "es_toi_per_game", "pp_toi", "total_primary_assists", "total_secondary_assists",
                   "nst_oi_gf", "nst_oi_sf", "team_id", "position_code"]
    if study == "forward":
        raw = pd.read_csv(HERE / "process.csv.gz", parse_dates=["date"], float_precision="round_trip")
        path = HERE / "games.csv.gz"
    elif study == "pilot":
        raw = pd.read_parquet(RAW, columns=raw_columns, filters=[("season_id", "=", 20242025)])
        raw["date"] = pd.to_datetime(raw.date)
        path = HERE.parent / "games.csv.gz"
    else:
        raise ValueError(study)
    games = pd.read_csv(path, parse_dates=["date"], float_precision="round_trip")
    assert games.season_id.eq(20242025).all() and not games.duplicated(KEY).any()
    assert raw.season_id.eq(20242025).all() and not raw.duplicated(KEY).any()
    if study == "pilot":
        gap = (games.recent - games.reference).round(8)
        games["flag"] = np.select([gap >= .4, gap <= -.4], ["hot", "cold"], default="neutral")
    join_key = KEY + (["game_id"] if study == "forward" else [])
    join_cols = join_key + [c for c in raw_columns if c not in games.columns]
    merged = games.merge(raw[join_cols], on=join_key, how="left", validate="one_to_one", indicator=True)
    if not merged.pop("_merge").eq("both").all():
        raise ValueError("At least one process row could not be reconciled to its game")

    return merged.sort_values(KEY).reset_index(drop=True)


def make_features(d):
    d = d.copy()
    # Global integer groups also handle segment identifiers local to a player.
    seg = d.groupby(["player_id", "season_id", "segment"], sort=False).ngroup()
    d["seq"] = seg
    g = d.groupby("seq", sort=False)
    assert g.date.apply(lambda s: s.is_monotonic_increasing and s.is_unique).all()
    d["gap"] = (d.recent - d.reference).round(8)
    d["prior_gap"] = d.gap.groupby(seg).shift()
    d["recent20"] = roll(d.points, seg, 20)
    age = (d.state.ne(g.state.shift()) | seg.ne(seg.shift())).cumsum()
    d["age"] = d.groupby(age).cumcount() + 1
    d["prior_hot"] = g.state.shift().eq("hot").astype(float)
    d["prior_cold"] = g.state.shift().eq("cold").astype(float)
    d["rolloff1"] = g.points.shift(4)
    d["rolloff2"] = g.points.shift(3)
    d["ref_rolloff1"] = g.points.shift(24)
    d["ref_rolloff2"] = g.points.shift(23)
    d["rest_days"] = g.date.diff().dt.days.sub(1)
    prev_team = g.team_id.shift()
    d["team_change"] = d.team_id.ne(prev_team).where(prev_team.notna() & d.team_id.notna())
    d["team_change"] = pd.to_numeric(d.team_change, errors="coerce")
    d["goals_minus_ixg"] = d.goals - d.nst_ixg

    # Use aggregate exposures for rates, with units preserved across windows.
    def summary(m, width, lag):
        def mean(col):
            return roll(d[col], seg, width, lag)
        if m == "pp_fraction":
            return mean("pp_toi") / mean("toi_per_game").replace(0, np.nan)
        if m == "ixg60":
            return 3600 * mean("nst_ixg") / mean("nst_toi").replace(0, np.nan)
        if m == "on_ice_finish":
            return 100 * mean("nst_oi_gf") / mean("nst_oi_sf").replace(0, np.nan)
        if m == "shrunk_shoot_pct":
            # Same fixed 2 goals / 20 shots prior for each personal window.
            return 100 * (width * mean("goals") + 2) / (width * mean("shots") + 20)
        return mean(m)

    features = {}
    for family in FAMILIES.values():
        for metric in family:
            recent = summary(metric, 5, 0)
            features[metric + "_level"] = recent
            features[metric + "_delta"] = recent - summary(metric, 20, 5)
            features[metric + "_direction"] = summary(metric, 2, 0) - summary(metric, 3, 2)
    # Original pilot comparisons must use its literal saved deltas, including missingness.
    for metric in PILOT:
        col = metric + "_delta"
        if col in d:
            np.testing.assert_allclose(features[col], d[col], atol=1e-10, equal_nan=True)
            features[col] = d.pop(col)
    return pd.concat([d, pd.DataFrame(features, index=d.index)], axis=1)
