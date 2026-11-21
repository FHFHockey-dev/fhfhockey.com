"""Build Sko skater-points development histories. Reads only pinned 2024–25 raw captures."""
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[3]
CAPTURE = Path.home() / "Documents/Claude/2026-11-04/blsh-baseline/capture-20242025"
PILOT = ROOT / "web/scripts/output/sko_features.parquet"
NHL_LOG = ROOT / "tasks/artifacts/wigo-legacy-identity-repair-2026-11-07/source/8476425-20242025.json"
HASHES = {
    "games.csv": "88aa2c17299d033e12946e73d4e125332057fe971b0dc01d9bfcbccea24080af",
    "wgo.csv": "f7ee8eef66d020d7f1bf02d3859ca9b4015c1a637199494918375da7e6082459",
    "nst_individual.csv": "1965a0c921fc6329eadb994eb36d37d19239b6db868a3ec879d5b9b51e4c21ed",
    "nst_onice.csv": "4026f06bb5dd4c49f8ea6d67e379ea277d1a59bbf9e8250823648206597a0093",
}
POLICY = "sko-skater-nhl-points-as-g1a1-r5p20-040-c2-v1"
KEY = ["player_id", "season_id", "date"]
GAMEKEY = ["player_id", "season_id", "game_id"]
SIDES = ("hot", "cold")


def verify(path, expected):
    assert hashlib.sha256(path.read_bytes()).hexdigest() == expected, f"Input changed: {path.name}"


def appearance_ledger():
    w = pd.read_csv(CAPTURE / "wgo.csv").rename(columns={"team_abbrev": "team"})
    calendar = pd.read_csv(CAPTURE / "games.csv").query("type == 2")
    joined = w.merge(calendar, left_on=["game_id", "season_id", "date"], right_on=["id", "seasonId", "date"],
                     how="left", validate="many_to_one")
    assert joined.type.eq(2).all() and set(w.game_id) == set(calendar.id)
    assert w.season_id.eq(20242025).all() and w.games_played.eq(1).all()
    assert not w.duplicated(KEY).any() and not w.duplicated(GAMEKEY).any()
    assert (w.toi_per_game > 0).all() and w.points.eq(w.goals + w.assists).all()
    assert (w.assists == w.total_primary_assists + w.total_secondary_assists).all()
    sheets = w.groupby(["game_id", "date", "team"], as_index=False).size().rename(columns={"size": "skaters"})
    assert sheets.groupby("game_id").size().eq(2).all() and sheets.groupby("team").size().eq(82).all()
    opponents = sheets.merge(sheets[["game_id", "team"]].rename(columns={"team": "opponent"}), on="game_id")
    w = w.merge(opponents.query("opponent != team")[["game_id", "team", "opponent"]],
                on=["game_id", "team"], validate="many_to_one").sort_values(KEY).reset_index(drop=True)
    # Independent NHL player-log spot check limited to a single unreserved season source.
    log = json.loads(NHL_LOG.read_text())
    assert log["seasonId"] == 20242025 and log["gameTypeId"] == 2
    actual = w.loc[w.player_id.eq(8476425), ["game_id", "date", "team", "opponent", "points", "goals", "assists", "shots"]]
    archived = pd.DataFrame(log["gameLog"]).rename(columns={"gameId":"game_id","gameDate":"date","teamAbbrev":"team","opponentAbbrev":"opponent"})
    pd.testing.assert_frame_equal(actual.sort_values("game_id").reset_index(drop=True),
                                  archived[actual.columns].sort_values("game_id").reset_index(drop=True))
    return w, sheets


def continuity(w, sheets):
    """GP counts recorded played games. Team sheets alone cannot establish scratch status."""
    team_dates = {club: z.sort_values("date") for club,z in sheets.groupby("team")}
    grouped = w.groupby(["player_id", "season_id"], sort=False)
    w["appearance_gp"] = grouped.cumcount() + 1
    previous_date, previous_team = grouped.date.shift(), grouped.team.shift()
    w["team_changed"] = previous_team.notna() & w.team.ne(previous_team)
    w["boundary_reason"] = np.where(previous_date.isna(), "first_recorded_season_appearance", "")
    # Enumerate internal same-club gaps using team-calendar indexes. Resolve neither an
    # unobserved scratch reason nor precise roster service dates across a trade.
    team_index = {(r.team, r.date): i for club, z in team_dates.items() for i,r in enumerate(z.itertuples())}
    gaps = []
    for row in w.itertuples():
        i = row.Index
        if pd.isna(previous_date.iat[i]):
            continue
        old_team, old_date = previous_team.iat[i], previous_date.iat[i]
        if row.team == old_team:
            start, end = team_index[(old_team, old_date)] + 1, team_index[(row.team, row.date)]
            if start >= end:
                continue
            between = team_dates[row.team].iloc[start:end]
            status = "no_recorded_appearance"
        else:
            between = pd.concat([z.loc[(z.date > old_date) & (z.date < row.date)]
                                 for z in (team_dates[old_team], team_dates[row.team])])
            status = "affiliation_unknown_between_clubs"
        uncertain = between.skaters.lt(18)
        if uncertain.any():
            w.at[i, "boundary_reason"] = "possible_missing_appearance_on_short_team_sheet"
        for r in between.itertuples():
            gaps.append((row.player_id, row.season_id, r.game_id, r.date, r.team, r.skaters, status,
                         r.skaters < 18, row.game_id))
    w["segment"] = w.boundary_reason.ne("").cumsum()
    return pd.DataFrame(gaps, columns=["player_id","season_id","game_id","date","team","listed_skaters",
                                       "status","possible_missing_appearance","next_played_game_id"])


def label_games(d):
    d = d.copy()
    g = d.groupby("segment", sort=False)
    def rolling(shift, width):
        shifted = g.points.shift(shift)
        return shifted.groupby(d.segment).rolling(width).mean().droplevel(0).reindex(d.index)
    d["recent"], d["reference"] = rolling(0,5), rolling(5,20)
    gap = (d.recent - d.reference).round(8)
    d["flag"] = np.select([gap.isna(),gap >= .4,gap <= -.4], ["unavailable","hot","cold"], default="neutral")
    last_flag = g.flag.shift()
    d["state"] = np.select([d.flag.eq("unavailable") | last_flag.fillna("unavailable").eq("unavailable"),
                            d.flag.eq(last_flag)], ["unavailable",d.flag], default="neutral")
    prev = g.state.shift()
    origin = g.boundary_reason.transform("first").ne("first_recorded_season_appearance")
    entry = d.state.isin(SIDES) & d.state.ne(prev)
    unknown = entry & prev.eq("unavailable") & origin
    # A close on the first calculable flag after a *history gap* cannot locate its
    # first breach; the direction and first confirmable close are nevertheless visible.
    breach = d.flag.isin(SIDES) & d.flag.ne(last_flag) & ~(origin & last_flag.eq("unavailable"))
    d["breach"] = d.flag.where(breach, "")
    d["confirmation"] = d.state.where(entry, "")
    d["exit"] = prev.where(prev.isin(SIDES) & d.state.ne(prev), "")
    runs = (d.state.ne(prev) | d.segment.ne(d.segment.shift())).cumsum()
    ids = (POLICY + "/" + d.player_id.astype(str) + "/" + d.season_id.astype(str) + "/" + d.state + "/" +
           np.where(unknown,"boundary-","") + d.game_id.astype(str))
    d["episode_id"] = ids.where(entry).groupby(runs).transform("first").fillna("")
    d["start_unknown"] = unknown.groupby(runs).transform("max")
    d["rule_version"] = POLICY
    return d


def episode_phases(d):
    episodes, phases = [], []
    for eid,b in d[d.episode_id.ne("")].groupby("episode_id", sort=False):
        a, z = b.index[[0,-1]]
        first, last = d.loc[a], d.loc[z]
        exited = z+1 in d.index and d.at[z+1,"segment"] == first.segment
        entered = not first.start_unknown
        side = first.state
        episodes.append((eid, side, first.player_id, first.season_id, first.segment,
                         int(d.at[a-1,"game_id"]) if entered else None, int(first.game_id), int(last.game_id),
                         int(d.at[z+1,"game_id"]) if exited else None, entered, exited, len(b), POLICY))
        def emit(phase, anchor, offsets):
            for offset in offsets:
                idx = anchor + offset
                if idx in d.index and d.at[idx,"segment"] == first.segment:
                    phases.append((eid,side,first.player_id,first.season_id,phase,offset,
                                   d.at[idx,"game_id"],d.at[idx,"date"]))
        if entered:
            emit("start_lead_in", a, range(-5,0))
            emit("opening", a, range(min(len(b),5)))
        emit("during", a, range(len(b)))
        emit("interior", a, range(1,len(b)))  # first observable state excluded even if true entry censored
        if exited:
            emit("last_inside", z, [0])
            emit("first_outside", z+1, [0])
            emit("exit_window", z+1, range(-2,3))
    e = pd.DataFrame(episodes, columns=["episode_id","side","player_id","season_id","segment","first_breach_game_id",
                                        "first_confirmable_game_id","last_observed_inside_game_id","first_outside_game_id",
                                        "observed_entry","observed_exit","observed_length_gp","rule_version"])
    for col in ["first_breach_game_id","first_outside_game_id"]:
        e[col] = e[col].astype("Int64")
    ph = pd.DataFrame(phases, columns=["episode_id","side","player_id","season_id","phase","offset_gp","game_id","date"])
    return e, ph


def process(w):
    pcols = ["season_game_number","materialized_at","points","goals","shots","toi_per_game","missed_shots",
             "nst_toi","nst_ixg","nst_icf","nst_hdcf","nst_oi_gf","nst_oi_sf","has_nst_counts","has_nst_counts_oi"]
    p = pd.read_parquet(PILOT, columns=KEY+pcols, filters=[("season_id","=",20242025)])
    p.date = p.date.astype(str)
    assert not p.duplicated(KEY).any()
    j = w.merge(p, on=KEY, how="left", suffixes=("","_pilot"), validate="one_to_one")
    kept = j.season_game_number.notna()
    assert kept.sum() == len(p) and all(j.loc[kept,k].eq(j.loc[kept,k+"_pilot"]).all()
                                          for k in ["points","goals","shots","toi_per_game"])
    n = pd.read_csv(CAPTURE / "nst_individual.csv").rename(columns={"season":"season_id","date_scraped":"date"})
    oi = pd.read_csv(CAPTURE / "nst_onice.csv").rename(columns={"season":"season_id","date_scraped":"date"})
    assert not n.duplicated(KEY).any() and not oi.duplicated(KEY).any()
    # NST-only appearances with a WGO cohort ID inside the season would contradict our ledger.
    outside = n.loc[n.date.between(w.date.min(),w.date.max())].merge(w[KEY], on=KEY, how="left", indicator=True)
    orphan = outside[outside._merge.eq("left_only")]
    assert not orphan.player_id.isin(w.player_id).any()
    for frame, cols, suffix in [(n,["gp","toi","shots","goals","ixg"],"_nst"), (oi,["gp","toi"],"_oi")]:
        j = j.merge(frame[KEY+cols].rename(columns={c:c+suffix for c in cols}), on=KEY, how="left", validate="one_to_one")
    aligned = j.gp_nst.eq(1) & j.toi_nst.eq(j.toi_per_game) & j.goals_nst.eq(j.goals) & j.shots_nst.eq(j.shots)
    indiv = (aligned & j.has_nst_counts.eq(True) & j.nst_toi.eq(j.toi_nst) &
             np.isclose(j.nst_ixg, j.ixg_nst, atol=1e-7, rtol=0))
    onice = j.gp_oi.eq(1) & j.toi_oi.eq(j.toi_per_game) & j.has_nst_counts_oi.eq(True)
    for col in ["nst_icf","nst_hdcf"]:
        j[col] = j[col].where(indiv)
    for col in ["nst_oi_sf","nst_oi_gf"]:
        j[col] = j[col].where(onice)
    j["nst_ixg"], j["nst_toi"] = j.ixg_nst.where(aligned), j.toi_nst.where(aligned)
    j["pp_toi"], j["team_id"] = j.pp_toi_per_game, j.team
    fields = ["team_id","shots","goals","assists","toi_per_game","es_toi_per_game","pp_toi","total_primary_assists",
              "total_secondary_assists","missed_shots","nst_ixg","nst_toi","nst_icf","nst_hdcf","nst_oi_gf","nst_oi_sf"]
    # Relate the original source ordinals to independently identified player/season games.
    q = j[kept].copy()
    g = q.groupby("player_id")
    q["previous_game_id"] = g.game_id.shift().astype("Int64")
    q["previous_ordinal"] = g.season_game_number.shift().astype("Int64")
    q["intervening_appearances"] = (g.appearance_gp.diff() - 1).astype("Int64")
    resets = q[q.previous_ordinal.notna() & (q.season_game_number-q.previous_ordinal).ne(1)]
    audits = {"pilot_rows_reconciled":len(q), "pilot_gaps_with_intervening_gp":int(q.intervening_appearances.gt(0).sum()),
              "pilot_ordinal_resets":len(resets),"nst_unmatched_regular_date_rows_outside_wgo_cohort":len(orphan),
              "nst_unmatched_ids":sorted(map(int,orphan.player_id.unique())),
              "raw_nst_match":int(j.gp_nst.eq(1).sum()),"nst_individual_gate_pass":int(aligned.sum()),
              "nst_pilot_count_gate_pass":int(indiv.sum()),"nst_pilot_onice_gate_pass":int(onice.sum()),
              "pilot_materialized_at":sorted(map(str,p.materialized_at.unique()))}
    return (j[KEY+["game_id"]+fields],resets[KEY+["game_id","previous_game_id","season_game_number",
                                                "previous_ordinal","appearance_gp","intervening_appearances"]],audits)


def feature_availability(raw):
    catalog = {
        "team_id": ("NHL club abbreviation", "WGO", "all"),
        "shots": ("shots on goal", "WGO", "all"),
        "goals": ("goals", "WGO", "all"),
        "assists": ("assists", "WGO", "all"),
        "toi_per_game": ("seconds", "WGO", "all"),
        "es_toi_per_game": ("seconds", "WGO", "even strength"),
        "pp_toi": ("seconds", "WGO", "power play"),
        "total_primary_assists": ("first assists", "WGO", "all"),
        "total_secondary_assists": ("second assists", "WGO", "all"),
        "missed_shots": ("missed shots", "pilot NHL", "all"),
        "nst_ixg": ("individual expected goals", "NST counts", "all"),
        "nst_toi": ("exposure seconds", "NST counts", "all"),
        "nst_icf": ("individual shot attempts", "pilot NST individual", "all"),
        "nst_hdcf": ("individual high-danger chances", "pilot NST individual", "all"),
        "nst_oi_gf": ("team goals for while on ice", "pilot NST on-ice", "all"),
        "nst_oi_sf": ("team shots for while on ice", "pilot NST on-ice", "all"),
    }
    assert set(catalog) == set(raw.columns) - set(KEY + ["game_id"])
    rows = []
    for name, (unit, source, strength) in catalog.items():
        capture = ("2025-09-26T08:00:00.050318Z" if source.startswith("pilot") else
                   "2026-11-04T00:09:23.279303Z")
        rows.append((name,unit,strength,source,capture,"unverified",len(raw),int(raw[name].count())))
    return pd.DataFrame(rows,columns=["column","unit_per_appearance","strength","source","retained_at",
                                      "available_at_game_close","total_appearances","nonnull_appearances"])


def main():
    for name, digest in HASHES.items():
        verify(CAPTURE/name, digest)
    verify(PILOT, "f857dc15ba0eb667aa02f59c9eb26c5223e34cf96e02dbff5625d72fdd7db4a5")
    w, sheets = appearance_ledger()
    gaps = continuity(w, sheets)
    raw, resets, audit = process(w)
    gamecols = GAMEKEY+["player_name","date","team","opponent","position_code","appearance_gp","segment",
                        "team_changed","boundary_reason","points"]
    games = label_games(w[gamecols])
    episodes, phases = episode_phases(games)
    for name,frame in [("games",games),("process",raw),("phases",phases),("team-game-gaps",gaps)]:
        frame.to_csv(OUT/f"{name}.csv.gz",index=False,compression={"method":"gzip","mtime":0})
    feature_availability(raw).to_csv(OUT/"feature-availability.csv",index=False)
    episodes.to_csv(OUT/"episodes.csv",index=False)
    resets.to_csv(OUT/"ordinal-resets.csv",index=False)
    support = phases.groupby(["side","phase","offset_gp"],as_index=False).agg(
        memberships=("episode_id","size"),episodes=("episode_id","nunique"),players=("player_id","nunique"))
    support.to_csv(OUT/"phase-denominators.csv",index=False)
    audit.update({"game_rows":len(games),"players":int(w.player_id.nunique()),"official_games":int(w.game_id.nunique()),
                  "season":20242025,"short_team_sheets":int(sheets.skaters.lt(18).sum()),
                  "uncertain_continuity_resets":int(w.boundary_reason.str.startswith("possible_").sum()),
                  "team_changes":int(w.team_changed.sum()),"state_counts":games.state.value_counts().to_dict(),
                  "episodes":len(episodes),"phase_memberships":len(phases),
                  "raw_support":raw.drop(columns=KEY+["game_id"]).count().to_dict()})
    (OUT/"data-audit.json").write_text(json.dumps(audit, indent=2)+"\n")
    print(json.dumps({k:audit[k] for k in ["game_rows","players","official_games","episodes","state_counts"]}))


if __name__ == "__main__":
    main()
