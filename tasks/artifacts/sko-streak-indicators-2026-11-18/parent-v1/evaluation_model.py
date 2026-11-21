"""Frozen model fitting, paired player bootstrap and calibration summaries."""
import numpy as np
import pandas as pd
from scipy.special import logit
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.preprocessing import StandardScaler

from evaluation_features import FAMILY_COLS


def fit_model(train, val, columns, effects=False, export=None):
    y = train.y.to_numpy()
    if not columns:
        return np.full(len(train), y.mean()), np.full(len(val), y.mean()), [], []
    tr = train[columns].astype(float)
    va = val[columns].astype(float)
    missing = tr.isna().any()
    indicators = list(missing[missing].index)
    medians = tr.median().fillna(0)
    def prepare(x):
        return pd.concat([x.fillna(medians), x[indicators].isna().add_suffix("_missing").astype(float)], axis=1)
    tr, va = prepare(tr), prepare(va)
    constant = tr.nunique().le(1)
    omitted = list(tr.columns[constant])
    tr, va = tr.loc[:, ~constant], va.loc[:, ~constant]
    if tr.empty:
        return np.full(len(train), y.mean()), np.full(len(val), y.mean()), [], omitted
    scale = StandardScaler()
    x = scale.fit_transform(tr)
    regression = LogisticRegression(C=1, max_iter=1000, tol=1e-8).fit(x, y)
    if export is not None:
        export.update(raw_columns=columns, medians={c: float(medians[c]) for c in columns},
                      missing_indicators=indicators, design_columns=list(tr.columns),
                      center=scale.mean_.tolist(), scale=scale.scale_.tolist(),
                      coefficient=regression.coef_[0].tolist(), intercept=float(regression.intercept_[0]))
    if regression.n_iter_[0] >= regression.max_iter:
        raise RuntimeError("Optimizer did not converge")
    pt = regression.predict_proba(x)[:, 1]
    pv = regression.predict_proba(scale.transform(va))[:, 1]
    if not (np.isfinite(pt).all() and np.isfinite(pv).all()):
        raise ValueError("Non-finite model predictions")
    rows = []
    if effects:
        # Penalized M-estimator cluster sandwich, conditional on this training transform.
        design = np.column_stack([np.ones(len(x)), x])
        penalty = np.eye(design.shape[1])
        penalty[0, 0] = 0
        inverse = np.linalg.inv((design.T * (pt * (1 - pt))) @ design + penalty)
        _, clusters = np.unique(train.player_id, return_inverse=True)
        scores = np.zeros((clusters.max() + 1, design.shape[1]))
        np.add.at(scores, clusters, design * (y - pt)[:, None])
        # Penalized estimating equations include each observation's share of penalty.
        counts = np.bincount(clusters)
        scores -= counts[:, None] * (np.r_[0., regression.coef_[0]] / len(x))
        n = len(scores)
        cov = (inverse @ scores.T) @ (scores @ inverse) * n / (n-1)
        se = np.sqrt(np.maximum(0, cov.diagonal()[1:]))
        for i, col in enumerate(tr.columns):
            coef = regression.coef_[0, i]
            family = next((f for f, names in FAMILY_COLS.items()
                           if col.removesuffix("_missing") in names), "scoring")
            rows.append(dict(feature=col, family=family, coefficient=coef,
                             train_sd=scale.scale_[i], odds_ratio=np.exp(coef),
                             or_low=np.exp(coef-1.96*se[i]), or_high=np.exp(coef+1.96*se[i])))
    return pt, pv, rows, omitted


def basic(y, p):
    return dict(auc=roc_auc_score(y, p) if len(np.unique(y)) == 2 else np.nan,
                ap=average_precision_score(y, p) if sum(y) else np.nan,
                brier=np.mean((p-y)**2), mean_score=np.mean(p))


def calibration(y, p):
    z = logit(np.clip(p, 1e-9, 1-1e-9))
    if np.ptp(z) < 1e-10 or len(np.unique(y)) < 2:
        return np.nan, np.nan
    model = LogisticRegression(C=1e8, tol=1e-9, max_iter=500).fit(z[:, None], y)
    return model.intercept_[0], model.coef_[0,0]


def cluster_gains(y, base, model, player, seed=4271, draws=600):
    """Resample players, retaining paired predictions, ties and all repeated appearances."""
    _, ix = np.unique(player, return_inverse=True)
    n = ix.max() + 1
    rng = np.random.default_rng(seed)
    def sorted_score(p):
        order = np.argsort(p, kind="stable")
        starts = np.r_[0, np.where(np.diff(p[order]) != 0)[0]+1]
        return order, starts
    scores = [sorted_score(base), sorted_score(model)]
    values = []
    for _ in range(draws):
        w = np.bincount(rng.integers(n, size=n), minlength=n)[ix]
        positives, negatives = w @ y, w @ (1-y)
        if not positives or not negatives:
            continue
        aucs = []
        for order, starts in scores:
            pos = np.add.reduceat((w*y)[order], starts)
            neg = np.add.reduceat((w*(1-y))[order], starts)
            aucs.append(pos @ (np.cumsum(neg)-0.5*neg) / (positives*negatives))
        values.append(aucs[1]-aucs[0])
    return (*np.quantile(values, [.025,.975]), len(values)) if values else (np.nan,np.nan,0)
