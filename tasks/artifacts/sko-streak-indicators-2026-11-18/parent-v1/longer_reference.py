"""Post-hoc comparator: does process add information beyond a longer personal scoring history?"""
import hashlib
import json
from pathlib import Path

from evaluate import ALL_PROCESS, FULL, decision_frame, result_row
from evaluation_features import HERE, load_input, make_features
from evaluation_model import cluster_gains, fit_model
import numpy as np
import pandas as pd

HISTORY = Path.home() / "Documents/Codex/2026-10-27/task-3/current-refresh-20261029-01/dev-history-cache/dev-history.jsonl"
PIN = "da32a473923e7b9940032c7ee22c1292e73798c7dc242a956a0244233d020106"


def prior_rates():
    if hashlib.sha256(HISTORY.read_bytes()).hexdigest() != PIN:
        raise ValueError("Earlier development-history pin mismatch")
    rows = []
    with HISTORY.open() as source:
        for line in source:
            r = json.loads(line)
            season = r["season_id"]
            assert season in (20222023, 20232024)
            game = r["_research_game_id"] or r["game_id"]
            ok = (r["calendar"] == [season, r["date"], 2] and game is not None
                  and r["games_played"] == 1 and r["toi_per_game"] is not None and r["toi_per_game"] > 0
                  and all(isinstance(r[k], int) and r[k] >= 0 for k in ("goals", "assists")))
            rows.append((r["player_id"], season, game, r["date"], ok,
                         r["goals"] + r["assists"] if ok else np.nan))
    old = pd.DataFrame(rows, columns=["player_id","season_id","game_id","date","ok","points"])
    group = ["player_id", "season_id"]
    old["ok"] &= ~old.duplicated(group+["game_id"], keep=False) & ~old.duplicated(group+["date"], keep=False)
    # A partial catalog can select unusually productive games. Admit the season for this
    # skater only if *every* retained row resolves to a dated regular-season appearance.
    admitted = old[old.groupby(group).ok.transform("all")]
    count = old.groupby("season_id").size().rename("source_appearances").to_frame()
    count["all_keyed_player_season_appearances"] = admitted.groupby("season_id").size()
    count["admitted_players"] = admitted.groupby("season_id").player_id.nunique()
    count.to_csv(HERE/"longer-reference-history-coverage.csv")
    return admitted.groupby("player_id").points.agg(prior_scoring_rate="mean", prior_scoring_gp="size")


def main():
    d = make_features(load_input("forward"))
    priors = prior_rates()
    d = d.join(priors, on="player_id", validate="many_to_one")
    # Reset cumulative scoring at any unresolved within-season appearance boundary.
    by = d.groupby("seq", sort=False)
    d["current_scoring_gp"] = by.cumcount()+1
    d["current_scoring_rate"] = by.points.cumsum() / d.current_scoring_gp
    extra = ["current_scoring_rate", "current_scoring_gp", "prior_scoring_rate", "prior_scoring_gp"]
    frozen = pd.read_csv(HERE/"evaluation/forward/validation_predictions.csv.gz")
    direct = []
    rows = []
    for side in ("hot", "cold"):
        for question in ("onset", "continue", "exit"):
            x, _ = decision_frame(d, "forward", side, question)
            a, b = x[x.scope.eq("train")], x[x.scope.eq("validation")]
            predictions = []
            for name, cols in [("extended_scoring", FULL+extra), ("extended_with_process", FULL+extra+ALL_PROCESS)]:
                train_scores, scores, _, _ = fit_model(a,b,cols)
                predictions.append(scores)
                combined = dict(side=side, question=question, model=name, issues_with_prior=int(b.prior_scoring_rate.count()),
                                **result_row(b,scores,np.quantile(train_scores,.90)))
                if len(predictions) == 2:
                    paired = cluster_gains(b.y.to_numpy(), *predictions, b.player_id.to_numpy())
                    combined.update(delta_auc=combined["auc"]-rows[-1]["auc"], low95=paired[0], high95=paired[1])
                rows.append(combined)
            original = frozen[frozen.side.eq(side) & frozen.question.eq(question)].set_index(["player_id","game_id"])
            matched = original.loc[pd.MultiIndex.from_frame(b[["player_id","game_id"]])]
            assert np.array_equal(matched.y.to_numpy(), b.y.to_numpy())
            probs = matched.challenger.to_numpy()
            ci = cluster_gains(b.y.to_numpy(), predictions[0], probs, b.player_id.to_numpy())
            old = result_row(b, probs, matched.challenger_threshold.iloc[0])
            new = rows[-2]
            direct.append(dict(side=side, question=question, issues=len(b),
                               extended_scoring_auc=new["auc"], frozen_process_auc=old["auc"],
                               delta_auc=old["auc"]-new["auc"], low95=ci[0], high95=ci[1],
                               delta_ap=old["ap"]-new["ap"], delta_brier=old["brier"]-new["brier"]))
    pd.DataFrame(direct).to_csv(HERE/"longer-reference-frozen-pairs.csv", index=False, float_format="%.7g")
    pd.DataFrame(rows).to_csv(HERE/"longer-reference-results.csv", index=False, float_format="%.7g")


if __name__ == "__main__":
    main()
