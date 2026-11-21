"""Offline descriptive pilot. Run from the repository root with pandas, pyarrow and matplotlib."""
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Patch

out = Path(__file__).parent
source = Path("web/scripts/output/sko_features.parquet")
metrics = ["shots", "nst_ixg", "pp_toi", "toi_per_game", "missed_shots"]
keys = ["player_id", "player_name", "season_id", "date", "season_game_number"]
d = pd.read_parquet(source, columns=keys + ["points", "games_played"] + metrics)
d = d.sort_values(["player_id", "season_id", "date"]).reset_index(drop=True)
assert not d.duplicated(["player_id", "season_id", "date"]).any() and d.games_played.eq(1).all()
grp = d.groupby(["player_id", "season_id"])
d["segment"] = grp.season_game_number.diff().ne(1).cumsum()
g = d.groupby("segment")
for metric in ["points"] + metrics:
    recent = g[metric].transform(lambda s: s.rolling(5).mean())
    reference = g[metric].transform(lambda s: s.shift(5).rolling(20).mean())
    d[metric + "_delta"] = recent - reference
    if metric == "points":
        d["recent"], d["reference"] = recent, reference

# A state is known at the end of the second successive qualifying game.
gap = d.points_delta.round(8)
flag = pd.Series(np.select([gap >= .4, gap <= -.4], ["hot", "cold"], default="neutral"), index=d.index)
previous_flag = flag.groupby(d.segment).shift()
d["state"] = np.where(flag.eq(previous_flag), flag, "neutral")
d.loc[gap.isna() | gap.groupby(d.segment).shift().isna(), "state"] = "unavailable"
d["prev"] = g.state.shift()
d["next"] = g.state.shift(-1)
d["run"] = (d.state.ne(d.prev) | d.segment.ne(d.segment.shift())).cumsum()
d["episode_id"] = ""
events, offsets = [], []
for _, block in d[d.state.isin(["hot", "cold"])].groupby("run"):
    a, b = block.index[[0, -1]]
    row = d.loc[a]
    ident = f"{row.player_id}-{row.season_id}-{pd.Timestamp(row.date):%Y%m%d}-{row.state}"
    d.loc[a:b, "episode_id"] = ident
    observed_entry = row.prev in ("neutral","hot","cold")
    observed_exit = d.at[b,"next"] in ("neutral","hot","cold")
    events.append([ident,row.player_id,row.state,row.date,d.at[b,"date"],len(block),observed_entry,observed_exit])
    def emit(anchor, phase, lo, hi):
        for off in range(lo, hi+1):
            j = anchor + off
            if j in d.index and d.at[j,"segment"] == row.segment:
                offsets.append([ident,phase,off,d.at[j,"date"],d.at[j,"state"]])
    if observed_entry:
        emit(a,"before_start",-5,-1)
        emit(a,"first_five_inside",0,min(4,b-a))
    emit(a,"during",0,b-a)
    if observed_exit:
        emit(b+1,"exit_window",-2,2)
episodes = pd.DataFrame(events,columns=["episode_id","player_id","state","first_confirmed","last_inside","length","observed_entry","observed_exit"])
episodes.to_csv(out/"episodes.csv",index=False)
windows = pd.DataFrame(offsets,columns=["episode_id","phase","offset_gp","date","state_on_date"])
windows.to_csv(out/"event_windows.csv.gz",index=False)
window_values = windows.merge(episodes[["episode_id","player_id","state"]],on="episode_id",validate="many_to_one").merge(d[["player_id","date"]+[m+"_delta" for m in metrics]],on=["player_id","date"],validate="many_to_one")
window_values.melt(id_vars=["state","phase","offset_gp"],value_vars=[m+"_delta" for m in metrics],var_name="metric",value_name="change").groupby(["state","phase","offset_gp","metric"]).change.agg(["count","mean","median"]).to_csv(out/"phase-profiles.csv")
assert episodes.episode_id.is_unique
assert len(windows.query("phase == 'exit_window' and offset_gp == 0")) == episodes.observed_exit.sum()
d[keys+["segment","points","recent","reference","state","episode_id"]+[m+"_delta" for m in metrics]].to_csv(out/"games.csv.gz",index=False)

# AUC is directional: >.5 means larger feature values favour the named event.
# Each skater-game counts once per contrast. Only descriptive, retrospective discrimination.
results = []
known = ["neutral","hot","cold"]
for side in ["hot","cold"]:
    for question, risk, case in [
        ("first_breach_next_then_confirm",d.state.eq("neutral") & flag.eq("neutral") & d.next.isin(known) & g.state.shift(-2).isin(known),flag.groupby(d.segment).shift(-1).eq(side) & g.state.shift(-2).eq(side)),
        ("onset_next",d.state.eq("neutral") & d.next.isin(known),d.next.eq(side)),
        ("during_observed",d.state.eq("neutral") | (d.state.eq(side)&d.prev.eq(side)),d.state.eq(side)),
        ("continues_next",d.state.eq(side)&d.next.isin(known),d.next.eq(side)),
        ("ends_next",d.state.eq(side)&d.next.isin(known),~d.next.eq(side))
    ]:
        for metric in metrics + ["points"]:
            v=d.loc[risk,metric+"_delta"].dropna()
            y=case.loc[v.index]
            n1,n0=int(y.sum()),int((~y).sum())
            auc=(v.rank()[y].sum()-n1*(n1+1)/2)/(n1*n0)
            results.append([side,question,metric,n1,n0,d.loc[v.index,"player_id"].nunique(),v[y].mean(),v[~y].mean(),auc])
pd.DataFrame(results,columns=["state","question","metric","cases","controls","players","mean_case_change","mean_control_change","auc_higher"]).to_csv(out/"indicator-profiles.csv",index=False)

# Show one real skater, preserving both source segments and their independent warm-ups.
v=d[d.player_name.eq("Alex DeBrincat")].copy().reset_index(drop=True)
colors={"hot":"#f3b8a2","cold":"#abd6f5","unavailable":"#e7eaed","neutral":"white"}
fig,ax=plt.subplots(figsize=(12,4.8),layout="constrained")
for _,z in v.groupby("run",sort=False):
    ax.axvspan(z.index[0]-.5,z.index[-1]+.5,color=colors[z.state.iloc[0]],linewidth=0)
bars=ax.bar(v.index,v.points,color="#41586a",width=.62,label="Points in game")
for i,(_,z) in enumerate(v.groupby("segment",sort=False)):
    ax.plot(z.index,z.recent,color="#873718",linewidth=2,label="Last 5 GP average" if i==0 else None)
    ax.plot(z.index,z.reference,color="#1a584b",linestyle="--",label="Prior 20 GP average" if i==0 else None)
    if i: ax.axvline(z.index[0]-.5,color="#656b70",ls=":",lw=1.4)
ticks=np.arange(0,len(v),8);ax.set_xticks(ticks,[pd.Timestamp(x).strftime("%b %d") for x in v.date.iloc[ticks]])
ax.set(xlabel="Player appearances in the retained 2024–25 file",ylabel="Points per game",xlim=(-.5,len(v)-.5))
ax.set_title("Alex DeBrincat  |  Observed scoring streaks",loc="left",fontweight="bold")
handles,labels=ax.get_legend_handles_labels()
ax.legend(handles+[Patch(color=colors[k],label=t) for k,t in [("hot","Hot"),("cold","Cold"),("unavailable","Insufficient history")]],labels+["Hot","Cold","Insufficient history"],loc="upper center",bbox_to_anchor=(.5,-.18),ncol=6,frameon=False)
ax.spines[['top','right']].set_visible(False)
fig.savefig(out/"debrincat-streaks.png",dpi=155)
print(len(d),d.player_id.nunique(),d.state.value_counts().to_dict(),episodes.groupby("state")[["observed_entry","observed_exit"]].agg(["count","sum"]).to_dict(),v.state.value_counts().to_dict())
