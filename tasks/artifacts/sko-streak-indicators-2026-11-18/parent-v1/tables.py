"""Generate paired comparison tables, a floor sensitivity and two cutoff-fixed player examples."""
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score

HERE = Path(__file__).resolve().parent
SIDES = ("hot", "cold")
DECISIONS = ("onset", "continue", "exit")


def pct(value):
    return f"{100*value:.1f}%"


def signed(value):
    return f"{value:+.3f}"


def headline():
    lines = ["# Development results by decision", "",
             "AUC measures ranking. Average precision (AP) is compared with event prevalence. "
             "Lower Brier is better. Intervals for paired AUC gains resample skaters with all their appearances together. "
             "The A and B populations and outcomes differ. All twelve research contrasts remain unqualified. See the [long-history comparison](longer-reference-frozen-pairs.csv) for the stronger scoring comparator tested after the frozen analysis.", ""]
    for study, title in [("pilot", "A · Pilot's rolling labels"), ("forward", "B · Next five played games")]:
        path = HERE / "evaluation" / study
        metrics = pd.read_csv(path / "metrics.csv").set_index(["side", "question", "model"]).sort_index()
        gains = pd.read_csv(path / "paired_gains.csv").query("baseline == 'scoring'").set_index(["side", "question"])
        lines += [f"## {title}", "",
                  "| Decision | Events / issues | Players | Scoring AUC | + process AUC | Paired Δ [95% CI] | AP vs prevalence | Brier (scoring → process) | Correct / alerts | Lead (GP) | Product |",
                  "|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|"]
        supporting = []
        for side in SIDES:
            for q in DECISIONS:
                base, model = (metrics.loc[side, q, m] for m in ("scoring", "challenger"))
                g = gains.loc[side, q]
                lead = ("1 to breach, 2 to confirm" if q == "onset" else "1 to decision") if study == "pilot" else "1 to first, 5 to verdict"
                label = f"{side.capitalize()} {q if q != 'continue' else 'continuation'}"
                status = "Development signal; stronger comparator unresolved" if (study, side, q) == ("forward", "hot", "onset") else "Development gate missed"
                lines += [f"| {label} | {int(model.events):,} / {int(model.rows):,} | {int(model.players)} | "
                          f"{base.auc:.3f} | {model.auc:.3f} | {signed(g.delta_auc)} [{signed(g.ci_low)}, {signed(g.ci_high)}] | "
                          f"{model.ap:.3f} vs {model.prevalence:.3f} | {base.brier:.3f} → {model.brier:.3f} | "
                          f"{int(model.hits)} / {int(model.alerts)} | {lead} | {status} |"]
                baselines = metrics.loc[side, q].loc[["prevalence", "level", "persistence", "scoring"]]
                best = baselines.auc.idxmax()
                supporting += [f"| {label} | {int(model.issue_episodes)} / {int(model.upcoming_chart_episodes)} | "
                               f"{pct(model.alert_rate)} / {pct(model.precision)} / {pct(model.recall)} | "
                               f"{model.mean_score:.3f} / {model.prevalence:.3f} | "
                               f"{model.cal_intercept:.2f} / {model.cal_slope:.2f} | {base.ap:.3f} → {model.ap:.3f} | "
                               f"{best} ({baselines.loc[best,'auc']:.3f}) |"]
        lines += ["", "| Decision | Episodes at issue / seen ahead¹ | Alert rate / precision / recall | Mean estimate / observed rate | Calibration intercept / slope | AP (scoring → process) | Highest scoring-only AUC² |",
                  "|---|---:|---:|---:|---:|---:|---|", *supporting, "",
                  f"[All baseline stages, challengers and performance](evaluation/{study}/metrics.csv) · "
                  f"[Paired and ablation intervals](evaluation/{study}/paired_gains.csv) · "
                  f"[Calibration bins](evaluation/{study}/calibration.csv) · [Subgroups](evaluation/{study}/subgroups.csv) · "
                  f"[Training effects with uncertainty](evaluation/{study}/effects.csv) · "
                  f"[Eligibility and purge counts](evaluation/{study}/coverage.csv)", ""]
    lines += ["¹ For active decisions, count distinct confirmed episodes at issue. For onset, the issue is neutral. "
              "Count distinct same-side chart episodes encountered within the horizon. B production blocks can qualify without a chart episode. "
              "Count each player-game once per decision. Consecutive warnings in a sustained run are distinct issues.",
              "", "² This is a descriptive comparison of the four prespecified baselines on validation. The comparator in the paired table is frozen. "
              "An ideal calibration intercept/slope is 0/1. Intervals condition on the fitted development models. "
              "Opponents and league-wide calendar shocks can correlate across player clusters."]
    (HERE / "RESULTS.md").write_text("\n".join(lines) + "\n")


def examples():
    folder = HERE / "evaluation/forward"
    predictions = pd.read_csv(folder / "validation_predictions.csv.gz", parse_dates=["date"])
    risk = predictions.query("question == 'onset' and side == 'hot'").sort_values(["date", "player_id"])
    features = pd.read_csv(folder / "validation_features.csv.gz", parse_dates=["date"])
    games = pd.read_csv(HERE / "games.csv.gz", parse_dates=["date"])
    chosen, outcomes = [], []
    for y in (1, 0):
        pool = risk[risk.challenger_alert & risk.y.eq(y)]
        alex = pool[pool.player_name.eq("Alex DeBrincat")]
        row = (alex if len(alex) else pool).iloc[0]
        key = (features.player_id.eq(row.player_id) & features.game_id.eq(row.game_id))
        all_features = features[key].iloc[0]
        issue_fields = ["side", "question", "study", "points", "recent", "reference", "age",
                        "scoring", "scoring_threshold", "scoring_alert", "challenger", "challenger_threshold", "challenger_alert"]
        example = {**all_features.to_dict(), **row[issue_fields].to_dict()}
        chosen.append(example)
        player = games[games.player_id.eq(row.player_id)].sort_values("date").reset_index(drop=True)
        k = player.index[player.game_id.eq(row.game_id)][0]
        block = player.iloc[k:k+6]
        assert len(block) == 6 and block.segment.nunique() == 1
        assert int(round(block.points.iloc[1:].mean() - row.reference, 8) >= .40) == y
        for offset, g in enumerate(block.itertuples()):
            outcomes.append(dict(example="hit" if y else "false_alert", player=row.player_name, issue_date=row.date.date(),
                                 offset_gp=offset, game_id=g.game_id, opponent=g.opponent, date=g.date.date(),
                                 points=g.points, last5=g.recent, chart_reference=g.reference, state=g.state,
                                 breach=g.breach, confirmation=g.confirmation, exit=g.exit))
    pd.DataFrame(chosen).to_csv(HERE / "example-issue-evidence.csv", index=False)
    pd.DataFrame(outcomes).to_csv(HERE / "example-followup.csv", index=False)
    # A nonnegative points total cannot clear a -0.40 cutoff if the frozen reference is below 0.40.
    cold = predictions.query("side == 'cold' and question == 'onset'")
    rows = []
    for name, part in cold.groupby(np.where(cold.reference.ge(.40), "reachable", "below_floor")):
        row = dict(group=name, issues=len(part), players=part.player_id.nunique(), events=part.y.sum(),
                   scoring_alerts=part.scoring_alert.sum(), process_alerts=part.challenger_alert.sum())
        if name == "below_floor":
            assert not part.y.any()
        if part.y.nunique() == 2:
            for model in ("scoring", "challenger"):
                row[model+"_auc"] = roc_auc_score(part.y, part[model])
                row[model+"_ap"] = average_precision_score(part.y, part[model])
        rows.append(row)
    pd.DataFrame(rows).to_csv(HERE / "cold-onset-floor.csv", index=False, float_format="%.6f")


if __name__ == "__main__":
    headline()
    examples()
