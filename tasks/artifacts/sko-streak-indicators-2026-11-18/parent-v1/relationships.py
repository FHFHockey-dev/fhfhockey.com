"""Descriptive relative-game profiles and same-player neutral comparisons, on verified identities."""
import numpy as np
import pandas as pd

from evaluation_features import HERE, load_input, make_features

KEY = ["player_id", "season_id", "game_id"]
METRICS = ["points", "gap", "shots_delta", "nst_ixg_delta", "ixg60_delta", "nst_icf_delta",
           "nst_hdcf_delta", "toi_per_game_delta", "es_toi_per_game_delta", "pp_toi_delta",
           "pp_fraction_delta", "goals_minus_ixg_delta", "shrunk_shoot_pct_delta",
           "total_primary_assists_delta", "total_secondary_assists_delta", "on_ice_finish_delta"]


def summarize(block):
    """Ratio of observed sums to observed counts, with player-cluster percentile intervals."""
    by = block.groupby("player_id")[METRICS]
    sums, counts = by.sum().to_numpy(), by.count().to_numpy()
    n = len(sums)
    rng = np.random.default_rng(18112026)
    weights = rng.multinomial(n, np.full(n, 1/n), size=600)
    denominators = weights @ counts
    draws = np.divide(weights @ sums, denominators, out=np.full(denominators.shape, np.nan),
                      where=denominators > 0)
    result = []
    for idx, metric in enumerate(METRICS):
        valid = np.isfinite(draws[:, idx])
        lo, hi = np.quantile(draws[valid, idx], [.025, .975]) if valid.any() else (np.nan, np.nan)
        present = block[metric].notna()
        result.append(dict(metric=metric, memberships=len(block), observed=int(present.sum()),
                           players=block.loc[present, "player_id"].nunique(),
                           episodes=block.loc[present, "episode_id"].nunique(),
                           mean=block[metric].mean(), ci_low=lo, ci_high=hi))
    return result


def main():
    games = make_features(load_input("forward"))
    phases = pd.read_csv(HERE / "phases.csv.gz")
    assert not phases.duplicated(["episode_id", "phase", "offset_gp"]).any()
    data = phases.merge(games[KEY + METRICS], on=KEY, validate="many_to_one", how="left", indicator=True)
    assert data._merge.eq("both").all()
    rows = []
    for (side, phase), block in data.groupby(["side", "phase"]):
        for row in summarize(block):
            rows.append(dict(side=side, phase=phase, offset="all", comparison="measured", **row))
        if phase in ("start_lead_in", "opening", "exit_window"):
            for offset, sub in block.groupby("offset_gp"):
                for row in summarize(sub):
                    rows.append(dict(side=side, phase=phase, offset=str(offset), comparison="measured", **row))
    # Interpretive comparison using the same player's neutral closes over the development season.
    # Future neutral games are allowed ONLY in this explanatory control, never in a predictor.
    neutral = games.loc[games.state.eq("neutral")].groupby(["player_id", "season_id"])[METRICS].mean()
    interior = data[data.phase.eq("interior")].set_index(["player_id", "season_id"]).copy()
    interior[METRICS] = interior[METRICS] - neutral.reindex(interior.index)
    for side, v in interior.reset_index().groupby("side"):
        for row in summarize(v):
            rows.append(dict(side=side, phase="interior", offset="all", comparison="vs_same_player_neutral", **row))
    pd.DataFrame(rows).to_csv(HERE / "phase-relationships.csv", index=False, float_format="%.6g")


if __name__ == "__main__":
    main()
