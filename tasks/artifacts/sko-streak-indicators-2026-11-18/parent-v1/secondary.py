"""Continuous secondary outcomes under the frozen FHFH Standard and house Game Score contracts."""
import hashlib
import json
import subprocess
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CAPTURE = Path.home() / "Documents/Claude/2026-11-04/blsh-baseline/capture-20242025/wgo.csv"
SOURCE = "f7ee8eef66d020d7f1bf02d3859ca9b4015c1a637199494918375da7e6082459"
TRACKS = ["fhfh_standard_fp_v1", "fhfh_game_score_all_situation_goals_v1"]


def game_outcomes():
    if hashlib.sha256(CAPTURE.read_bytes()).hexdigest() != SOURCE:
        raise ValueError("WGO development capture differs from the reviewed receipt")
    wgo = pd.read_csv(CAPTURE)
    # Execute the versioned scorer without calling a BLSH reader or deploying anything.
    js = """
    import {readFileSync} from 'node:fs';
    import {outcomes} from './web/lib/buyLowSellHigh/productionReference.ts';
    const rows = JSON.parse(readFileSync(0, 'utf8'));
    process.stdout.write(JSON.stringify(rows.map(row => {
      const [fp, points, gs] = outcomes(row);
      return [fp.value, points.value, gs.value];
    })));
    """
    scores = subprocess.run(
        ["node", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--input-type=module", "-e", js],
        input=wgo.to_json(orient="records"), capture_output=True, text=True, check=True, cwd=ROOT,
    )
    values = pd.DataFrame(json.loads(scores.stdout), columns=[TRACKS[0], "scorer_points", TRACKS[1]])
    return pd.concat([wgo[["player_id", "season_id", "game_id"]], values], axis=1)


def paired_interval(frame):
    clusters = frame.groupby("player_id").improvement.agg(["sum", "size"]).to_numpy()
    draws = np.random.default_rng(181126).integers(0, len(clusters), size=(1000, len(clusters)))
    samples = clusters[draws].sum(axis=1)
    return np.quantile(samples[:, 0] / samples[:, 1], [0.025, 0.975])


def main():
    keys = ["player_id", "season_id", "game_id"]
    games = pd.read_csv(HERE / "games.csv.gz", parse_dates=["date"])
    games = games.merge(game_outcomes(), on=keys, validate="one_to_one", how="left")
    assert games.scorer_points.equals(games.points.astype(games.scorer_points.dtype))
    games.sort_values(["player_id", "season_id", "date", "game_id"], inplace=True)
    group = ["player_id", "season_id", "segment"]
    validation = games.date.ge("2025-03-01") & games.state.isin(["neutral", "hot", "cold"])
    rows = []
    for metric in TRACKS:
        by = games.groupby(group)[metric]
        # All operations preserve appearances with a missing statistic as explicit holes.
        games["recent"] = by.transform(lambda s: s.rolling(5).mean())
        games["reference"] = by.transform(lambda s: s.shift(5).rolling(20).mean())
        games["future"] = by.transform(lambda s: s.rolling(5).mean().shift(-5))
        valid = games[validation].dropna(subset=["recent", "reference", "future"]).copy()
        valid["recent_error"] = (valid.recent - valid.future) ** 2
        valid["reference_error"] = (valid.reference - valid.future) ** 2
        valid["improvement"] = valid.reference_error - valid.recent_error
        for state in ["all", "neutral", "hot", "cold"]:
            v = valid if state == "all" else valid[valid.state == state]
            risk = validation if state == "all" else validation & games.state.eq(state)
            row = dict(metric=metric, nhl_points_state=state, season_track_values=int(games[metric].count()),
                       candidate_issues=int(risk.sum()), complete_issues=len(v), players=v.player_id.nunique())
            if len(v):
                lo, hi = paired_interval(v)
                row.update(recent_mean=v.recent.mean(), reference_mean=v.reference.mean(), future_mean=v.future.mean(),
                           future_minus_reference=(v.future-v.reference).mean(), recent_mse=v.recent_error.mean(),
                           reference_mse=v.reference_error.mean(), mse_gain=v.improvement.mean(), low95=lo, high95=hi)
            rows.append(row)
    pd.DataFrame(rows).to_csv(HERE / "secondary-results.csv", index=False, float_format="%.6f")


if __name__ == "__main__":
    main()
