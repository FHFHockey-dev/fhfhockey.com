"""Offline development evaluation. From this folder: python3 evaluate.py [pilot|forward]."""
import argparse
import os

# Small linear algebra jobs are much faster and reproducible with one worker.
for variable in ["OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "VECLIB_MAXIMUM_THREADS", "MKL_NUM_THREADS"]:
    os.environ[variable] = "1"

import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score

from evaluation_features import FAMILY_COLS, HERE, KNOWN, PILOT, load_input, make_features
from evaluation_model import basic, calibration, cluster_gains, fit_model

CUT = pd.Timestamp("2025-03-01")
LEVEL = ["reference", "gap"]  # recent = reference + gap; avoid exact redundancy
PERSIST = LEVEL + ["prior_gap", "age", "prior_hot", "prior_cold"]
FULL = PERSIST + ["rolloff1", "rolloff2", "ref_rolloff1", "ref_rolloff2"]
ALL_PROCESS = [col for cols in FAMILY_COLS.values() for col in cols]


def decision_frame(d, study, side, question):
    g = d.groupby("seq", sort=False)
    nxt = g.state.shift(-1)
    onset = question == "onset"
    risk = d.state.eq("neutral") & d.flag.eq("neutral") if onset else d.state.eq(side)
    horizon = (2 if onset else 1) if study == "pilot" else 5
    end = g.date.shift(-horizon)
    if study == "pilot":
        known = nxt.isin(KNOWN)
        event = nxt.eq(side)
        if onset:
            second = g.state.shift(-2)
            known &= second.isin(KNOWN)
            event = g.flag.shift(-1).eq(side) & second.eq(side)
    else:
        future = pd.concat([g.points.shift(-k) for k in range(1,6)], axis=1)
        known = future.notna().all(axis=1)
        gap = (future.mean(axis=1) - d.reference).round(8)
        event = gap.ge(.4) if side == "hot" else gap.le(-.4)
    if question == "exit":
        event = ~event
    usable = risk & known & end.notna()
    x = d.loc[usable].copy()
    x["y"] = event[usable].astype(int)
    x["end"] = end[usable]
    x["horizon"] = horizon
    x["future_episode"] = pd.NA
    x["chart_marker_lead"] = np.nan
    # Descriptive evaluation auxiliaries never enter training predictors.
    for k in range(1, horizon+1):
        state = g.state.shift(-k)
        if onset:
            hit = state.eq(side)
        elif question == "exit":
            hit = state.isin(KNOWN) & state.ne(side)
        else:
            hit = state.eq(side)
        take = x.chart_marker_lead.isna() & hit.loc[x.index]
        idx = x.index[take]
        x.loc[idx,"chart_marker_lead"] = k
        if onset:
            x.loc[idx,"future_episode"] = g.episode_id.shift(-k).loc[idx]
    x["scope"] = np.select([x.end.lt(CUT), x.date.ge(CUT)], ["train","validation"], default="purged")
    assert x.index.is_unique and x.end.gt(x.date).all()
    return x, int(risk.sum())


def counts(v):
    return dict(rows=len(v), events=int(v.y.sum()), prevalence=v.y.mean(),
                players=v.player_id.nunique(), issue_episodes=v.episode_id.dropna().nunique(),
                upcoming_chart_episodes=v.future_episode.dropna().nunique())


def result_row(v, p, cutoff):
    y = v.y.to_numpy()
    alert = p >= cutoff
    correct = alert & (y == 1)
    intercept, slope = calibration(y, p)
    lead = v.loc[correct,"chart_marker_lead"].dropna()
    return dict(**counts(v), **basic(y, p), cal_intercept=intercept, cal_slope=slope,
                threshold=cutoff, alerts=int(alert.sum()), alert_rate=alert.mean(),
                hits=int(correct.sum()), precision=y[alert].mean() if alert.any() else np.nan,
                recall=correct.sum()/y.sum() if y.sum() else np.nan,
                target_starts_gp=1, target_resolves_gp=int(v.horizon.iloc[0]),
                hits_with_chart_marker=int(len(lead)), marker_median_lead_gp=lead.median() if len(lead) else np.nan)


def write_output(rows, dest):
    pd.DataFrame(rows).to_csv(dest, index=False, float_format="%.9g")


def run(study):
    if not (HERE/"FREEZE.md").exists():
        raise RuntimeError("Missing frozen protocol")
    out = HERE / "evaluation" / study
    out.mkdir(parents=True, exist_ok=True)
    d = make_features(load_input(study))
    results, gains, effects, coverage, subgroups, bins, pooled, omissions = [], [], [], [], [], [], [], []
    feature_coverage = []
    predictions = []
    validation_keys = set()
    for side in ["hot", "cold"]:
        for question in ["onset", "continue", "exit"]:
            key = dict(study=study, side=side, question=question)
            x, candidates = decision_frame(d, study, side, question)
            if study == "pilot":
                x["pilot_points_delta"] = x.recent - x.reference
                for metric in PILOT + ["points"]:
                    col = "pilot_points_delta" if metric == "points" else metric + "_delta"
                    use = x.dropna(subset=[col])
                    pooled.append(dict(**key, metric=metric, **counts(use),
                                       auc_higher=roc_auc_score(use.y, use[col])))
                # Literal held-out single-feature comparisons require simultaneous common support.
                common = x[[m+"_delta" for m in PILOT]].notna().all(axis=1)
            else:
                common = pd.Series(True, index=x.index)
            for scope in ["train","purged","validation"]:
                in_scope = x.scope.eq(scope)
                coverage.append(dict(**key, scope=scope, at_risk_before_followup=candidates,
                                     complete_followup_all_dates=len(x), before_common_support=int(in_scope.sum()),
                                     **counts(x[in_scope & common])))
            train, val = x[x.scope.eq("train") & common], x[x.scope.eq("validation") & common]
            if min(train.y.nunique(), val.y.nunique()) < 2:
                raise ValueError(("insufficient class support",key,counts(train),counts(val)))
            for col in ALL_PROCESS:
                feature_coverage.append(dict(**key, feature=col, train_rows=len(train),
                    train_observed=int(train[col].notna().sum()), validation_rows=len(val),
                    validation_observed=int(val[col].notna().sum())))
            validation_keys.update(val.index)
            specs = dict(prevalence=[], level=LEVEL, persistence=PERSIST, scoring=FULL,
                         challenger=FULL+ALL_PROCESS)
            for family, columns in FAMILY_COLS.items():
                specs["without_"+family] = FULL + [c for c in ALL_PROCESS if c not in columns]
            if study == "pilot":
                for m in PILOT + ["points"]:
                    specs["single_"+m] = ["pilot_points_delta" if m=="points" else m+"_delta"]
            scores, rows = {}, {}
            pred = val[["player_id","player_name","season_id","date","points","recent","reference","state",
                        "episode_id","future_episode","chart_marker_lead","age","end","y","horizon"]].copy()
            if "game_id" in val:
                pred["game_id"] = val.game_id
            for col,value in key.items():
                pred[col] = value
            for name, columns in specs.items():
                pt, pv, coeffs, omitted = fit_model(train, val, columns, effects=name=="challenger")
                cutoff = np.quantile(pt, .90)
                scores[name] = pv
                rows[name] = result_row(val,pv,cutoff)
                if name.startswith("single_"):
                    rows[name]["raw_auc_higher"] = roc_auc_score(val.y,val[columns[0]])
                results.append(dict(**key, model=name, **rows[name]))
                if name in ["scoring","challenger"]:
                    pred[name] = pv
                    pred[name+"_threshold"] = cutoff
                    pred[name+"_alert"] = pv >= cutoff
                    # Fixed probability bins (including sparse and empty bins).
                    group = np.minimum((pv*10).astype(int),9)
                    for i in range(10):
                        idx = group==i
                        bins.append(dict(**key, model=name, lower=i/10, upper=(i+1)/10,
                                         rows=int(idx.sum()), predicted=pv[idx].mean() if idx.any() else np.nan,
                                         observed=val.y.to_numpy()[idx].mean() if idx.any() else np.nan))
                if coeffs:
                    effects.extend(dict(**key, train_rows=len(train), train_events=int(train.y.sum()),
                                        train_players=train.player_id.nunique(), **r) for r in coeffs)
                if omitted:
                    omissions.append(dict(**key, model=name, constant_train_fields="|".join(omitted)))
            comparisons = [(b, "challenger") for b in ["level", "persistence", "scoring"]] + [("without_"+f, "challenger") for f in FAMILY_COLS]
            for base, candidate in comparisons:
                lo, hi, n = cluster_gains(val.y.to_numpy(), scores[base], scores[candidate], val.player_id.to_numpy())
                gains.append(dict(**key, baseline=base, candidate=candidate,
                                  delta_auc=rows[candidate]["auc"]-rows[base]["auc"],
                                  ci_low=lo, ci_high=hi, bootstrap_draws=n,
                                  delta_ap=rows[candidate]["ap"]-rows[base]["ap"],
                                  delta_brier=rows[candidate]["brier"]-rows[base]["brier"]))
            subgroup_masks = {"F": val.position_code.isin(["F","C","L","R","LW","RW"]),
                              "D": val.position_code.eq("D"), "reference_below_0.5":val.reference.lt(.5),
                              "reference_at_least_0.5":val.reference.ge(.5)}
            role_known = val[["pp_toi_delta","toi_per_game_delta"]].notna().all(axis=1)
            role_change = val.pp_toi_delta.abs().ge(60) | val.toi_per_game_delta.abs().ge(120)
            subgroup_masks.update(usage_changed=role_known & role_change, usage_stable=role_known & ~role_change)
            for group, mask in subgroup_masks.items():
                part = val.loc[mask]
                if part.empty:
                    continue
                row = dict(**key, group=group, **counts(part))
                # Counts always shown. Metrics require >=10 events AND >=10 non-events.
                if min(part.y.sum(),(1-part.y).sum()) >= 10:
                    for model in ["scoring","challenger"]:
                        met = result_row(part,scores[model][mask],rows[model]["threshold"])
                        for field in ["auc","ap","brier","precision","recall","alerts"]:
                            row[model+"_"+field] = met[field]
                subgroups.append(row)
            predictions.append(pred)
    for name, data in dict(metrics=results, paired_gains=gains, effects=effects, subgroups=subgroups,
                           calibration=bins, feature_coverage=feature_coverage, coverage=coverage, constant_fields=omissions).items():
        write_output(data,out/(name+".csv"))
    if study == "pilot":
        write_output(pooled,out/"literal_pooled.csv")
    keys = ["player_id","season_id","date","player_name","state","position_code"] + (["game_id"] if "game_id" in d else [])
    features = d.loc[sorted(validation_keys), keys+FULL+ALL_PROCESS]
    features.to_csv(out/"validation_features.csv.gz",index=False,float_format="%.9g",compression={"method":"gzip","mtime":0})
    pd.concat(predictions,ignore_index=True).to_csv(out/"validation_predictions.csv.gz",index=False,
            float_format="%.15g",compression={"method":"gzip","mtime":0})
    print(study, len(d), "source rows;",len(features),"distinct validation appearances")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("study", choices=["pilot","forward","both"], nargs="?", default="both")
    arg = parser.parse_args().study
    for name in ["pilot","forward"] if arg=="both" else [arg]:
        run(name)
