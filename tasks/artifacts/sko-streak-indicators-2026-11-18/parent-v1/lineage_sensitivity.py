"""Post-hoc source-lineage sensitivity and portable replay of frozen B hot-onset models."""
import json

from evaluate import (ALL_PROCESS, CUT, FULL, HERE, decision_frame, load_input, make_features,
                      result_row, write_output)
from evaluation_model import cluster_gains, fit_model

import numpy as np
import pandas as pd
from scipy.special import expit

PILOT_ONLY = ["missed_shots", "nst_icf", "nst_hdcf", "on_ice_finish"]
OUT = HERE / "evaluation" / "forward"
HOT_MODEL_FILE = OUT / "frozen-hot-onset-models.json"


def replay(export, data):
    terms = []
    for name, center, scale, coefficient in zip(export["design_columns"], export["center"],
                                                 export["scale"], export["coefficient"], strict=True):
        if name.endswith("_missing"):
            value = data[name.removesuffix("_missing")].isna().astype(float)
        else:
            value = data[name].fillna(export["medians"][name])
        terms.append((value.to_numpy() - center) * coefficient / scale)
    return expit(export["intercept"] + np.sum(terms,axis=0))


def main():
    d = make_features(load_input("forward"))
    prior = pd.read_csv(OUT/"validation_predictions.csv.gz",parse_dates=["date"],float_precision="round_trip")
    prior_metrics = pd.read_csv(OUT/"metrics.csv",float_precision="round_trip")
    portable = dict(version="development-sko-skater-points-B1", side="hot", question="onset",
                    season_id=20242025, validation_start=str(CUT.date()), policy="train_p90_ties_included",
                    scope="offline research only", models={})
    included = [c for c in ALL_PROCESS if not any(c.startswith(m+"_") for m in PILOT_ONLY)]
    assert len(ALL_PROCESS) - len(included) == 12
    metrics, gains, replay_checks = [], [], []
    for side in ["hot","cold"]:
        for question in ["onset","continue","exit"]:
            key = dict(side=side,question=question)
            x,_ = decision_frame(d,"forward",side,question)
            train, val = x[x.scope.eq("train")], x[x.scope.eq("validation")]
            v = prior[(prior.side==side)&(prior.question==question)]
            np.testing.assert_array_equal(v[["player_id","game_id","y"]],val[["player_id","game_id","y"]])
            pt,pv,_,_ = fit_model(train,val,FULL+included)
            threshold = np.quantile(pt,.9)
            policies = {"sensitivity_train_p90": threshold, "primary_numeric":v.challenger_threshold.iat[0]}
            for label, cutoff in policies.items():
                metrics.append(dict(**key, threshold_policy=label, **result_row(val,pv,cutoff)))
            for comparator in ["scoring","challenger"]:
                comp = v[comparator].to_numpy()
                original = prior_metrics[(prior_metrics.side==side)&(prior_metrics.question==question)
                                         &(prior_metrics.model==comparator)].iloc[0]
                lo,hi,n = cluster_gains(val.y.to_numpy(),comp,pv,val.player_id.to_numpy())
                gains.append(dict(**key, comparator=comparator, delta_auc=metrics[-1]["auc"]-original.auc,
                                  ci_low=lo,ci_high=hi,bootstrap_draws=n,
                                  delta_ap=metrics[-1]["ap"]-original.ap,
                                  delta_brier=metrics[-1]["brier"]-original.brier))
            if side=="hot" and question=="onset":
                for name, columns in [("scoring",FULL),("challenger",FULL+ALL_PROCESS)]:
                    export = {}
                    raw_t,raw_v,_,_ = fit_model(train,val,columns,export=export)
                    export["threshold"] = float(np.quantile(raw_t,.9))
                    portable["models"][name] = export
                    np.testing.assert_allclose(raw_v,v[name],rtol=0,atol=1e-11)
                HOT_MODEL_FILE.write_text(json.dumps(portable,indent=2,allow_nan=False)+"\n")
                readback = json.loads(HOT_MODEL_FILE.read_text())
                for name, model in readback["models"].items():
                    prob = replay(model,val)
                    err = float(np.abs(prob-v[name].to_numpy()).max())
                    np.testing.assert_allclose(prob,v[name],rtol=0,atol=1e-11)
                    decisions = prob>=model["threshold"]
                    np.testing.assert_array_equal(decisions,v[name+"_alert"])
                    replay_checks.append(dict(model=name, rows=len(val), max_absolute_error=err,
                                              reproduced_alerts=int(decisions.sum()),alert_disagreements=0))
    write_output(metrics,OUT/"lineage-sensitivity-metrics.csv")
    write_output(gains,OUT/"lineage-sensitivity-gains.csv")
    write_output(replay_checks,OUT/"frozen-hot-onset-replay.csv")
    print("Complete source-lineage sensitivity and frozen model replay")


if __name__ == "__main__":
    main()
