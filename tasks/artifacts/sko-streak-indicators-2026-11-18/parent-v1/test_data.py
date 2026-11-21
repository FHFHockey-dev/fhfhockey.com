"""Run with the repository .venv Python and unittest against the saved development files."""
import unittest

import pandas as pd

from data import GAMEKEY, OUT, POLICY, SIDES, label_games


class StreakData(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.games = pd.read_csv(OUT/"games.csv.gz",keep_default_na=False,
                                na_values={"recent":[""],"reference":[""]})
        cls.episodes = pd.read_csv(OUT/"episodes.csv")
        cls.phases = pd.read_csv(OUT/"phases.csv.gz")

    def test_official_identity_and_segment_coverage(self):
        d = self.games
        self.assertFalse(d.duplicated(GAMEKEY).any())
        self.assertEqual(len(d), 47224)
        self.assertEqual(d.player_id.nunique(), 920)
        teams = d[["game_id","team","opponent"]].drop_duplicates()
        self.assertTrue(teams.groupby("game_id").size().eq(2).all())
        self.assertEqual(set(teams.itertuples(index=False,name=None)),
                         set(teams[["game_id","opponent","team"]].itertuples(index=False,name=None)))
        self.assertTrue(d.appearance_gp.eq(d.groupby(["player_id","season_id"]).cumcount()+1).all())
        resets = pd.read_csv(OUT/"ordinal-resets.csv")
        self.assertEqual(len(resets),549)
        self.assertTrue(resets.intervening_appearances.eq(0).all())
        self.assertTrue(resets.season_game_number.eq(15).all())
        self.assertEqual(d.loc[d.boundary_reason.str.startswith("possible_"),"segment"].nunique(),19)

    def test_independent_integer_threshold_and_two_close_states(self):
        # Compare with integer arithmetic for every row, including exact ties at ±0.40.
        for _, z in self.games.groupby("segment", sort=False):
            points = z.points.to_numpy()
            prev = "unavailable"
            for i,row in enumerate(z.itertuples()):
                gap20 = 4*sum(points[i-4:i+1])-sum(points[i-24:i-4]) if i>=24 else None
                flag = ("unavailable" if gap20 is None else "hot" if gap20>=8 else "cold" if gap20<=-8 else "neutral")
                state = ("unavailable" if i<25 else flag if flag==prev else "neutral")
                self.assertEqual((row.flag,row.state),(flag,state))
                prev = flag

    def test_prefix_stability_through_boundary_and_exit(self):
        # The original real player, a left-censored run and a right-censored run.
        for pid in [8479337,8477493,8470621]:
            d = self.games.loc[self.games.player_id.eq(pid)].reset_index(drop=True)
            for end in range(1,len(d)+1):
                r = label_games(d.iloc[:end])
                latest = d.iloc[end-1]
                for col in ["state","flag","breach","confirmation","exit","episode_id","start_unknown"]:
                    self.assertEqual(r[col].iloc[-1],latest[col])
        self.assertTrue(self.games.start_unknown.any())
        self.assertTrue((~self.episodes.observed_exit).any())

    def test_memberships_offsets_and_censoring(self):
        d,e,p = self.games,self.episodes,self.phases
        self.assertTrue(e.episode_id.is_unique)
        self.assertTrue(e.rule_version.eq(POLICY).all())
        self.assertFalse(p.duplicated(["episode_id","phase","offset_gp"]).any())
        self.assertTrue(set(e.side)==set(SIDES))
        games = d.set_index(["player_id","season_id","game_id"])
        ph = p.join(games[["segment","appearance_gp","state"]],on=GAMEKEY,validate="many_to_one")
        anchors = e.join(games.appearance_gp.rename("start_gp"),on=["player_id","season_id","first_confirmable_game_id"])
        anchors["exit_gp"] = anchors.start_gp+anchors.observed_length_gp
        joined = ph.merge(anchors[["episode_id","start_gp","exit_gp","segment","observed_entry","observed_exit"]],
                          on="episode_id",suffixes=("","_episode"),validate="many_to_one")
        self.assertTrue(joined.segment.eq(joined.segment_episode).all())
        exposed = joined.phase.isin(["exit_window","first_outside","last_inside"])
        self.assertTrue(joined.loc[exposed,"observed_exit"].all())
        self.assertTrue(joined.loc[joined.phase.isin(["start_lead_in","opening"]),"observed_entry"].all())
        expected = joined.start_gp.where(~exposed,joined.exit_gp)-joined.phase.eq("last_inside").astype(int)
        self.assertTrue(joined.appearance_gp.eq(expected+joined.offset_gp).all())
        inside = joined.phase.isin(["opening","during","interior","last_inside"])
        self.assertTrue(joined.loc[inside,"state"].eq(joined.loc[inside,"side"]).all())
        self.assertTrue(e.first_outside_game_id.notna().eq(e.observed_exit).all())
        self.assertTrue(e.first_breach_game_id.notna().eq(e.observed_entry).all())
        self.assertEqual(len(p[p.phase.eq("during")]),len(d[d.state.isin(SIDES)]))
        self.assertTrue((e.observed_length_gp==1).any())
        short = set(e.loc[(e.observed_length_gp==1)&e.observed_entry,"episode_id"])
        self.assertFalse(p[p.phase.eq("interior")].episode_id.isin(short).any())
        self.assertTrue(p[p.phase.eq("opening") & p.episode_id.isin(short)].offset_gp.eq(0).all())


if __name__ == "__main__":
    unittest.main()
