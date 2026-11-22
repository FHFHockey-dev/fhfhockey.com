"""Offline regression checks for the parent study. Run with python3 -m unittest test_evaluation."""
import unittest

import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score

from evaluate import ALL_PROCESS, CUT, FULL, decision_frame
from evaluation_features import HERE, PILOT, load_input, make_features
from evaluation_model import cluster_gains


class EvaluationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw = load_input("pilot")
        cls.pilot = make_features(cls.raw)

    def test_pooled_replication_including_rank_ties(self):
        original = pd.read_csv(HERE.parent/"indicator-profiles.csv")
        for side in ["hot","cold"]:
            for question, old in [("onset","first_breach_next_then_confirm"), ("continue","continues_next"),
                                  ("exit","ends_next")]:
                rows, _ = decision_frame(self.pilot, "pilot", side, question)
                for m in PILOT + ["points"]:
                    v = rows.recent-rows.reference if m=="points" else rows[m+"_delta"]
                    expected = original.query("state == @side and question == @old and metric == @m").iloc[0]
                    use = rows[v.notna()]
                    self.assertEqual([use.y.sum(),len(use),use.player_id.nunique()],
                                     [expected.cases,expected.cases+expected.controls,expected.players])
                    self.assertAlmostEqual(roc_auc_score(use.y,v.dropna()),expected.auc_higher,places=12)

    def test_train_forecasts_mature_before_validation_and_forward_uses_only_future(self):
        forward = make_features(load_input("forward"))
        for side in ["hot","cold"]:
            for study,d in [("pilot", self.pilot), ("forward", forward)]:
                for q in ["onset","continue","exit"]:
                    x,_ = decision_frame(d,study,side,q)
                    self.assertTrue(x[x.scope=="train"].end.lt(CUT).all())
                    self.assertTrue(x[x.scope=="validation"].date.ge(CUT).all())
                    self.assertFalse(x.duplicated(["player_id","date"]).any())
                    if study == "forward":
                        for i in x.index[::max(1,len(x)//17)]:
                            five = d.iloc[i+1:i+6]
                            self.assertTrue(five.seq.eq(d.seq[i]).all())
                            self.assertEqual(x.end[i],five.date.iloc[-1])
                            gap = (five.points.mean()-d.reference[i]).round(8)
                            case = gap >= .4 if side == "hot" else gap <= -.4
                            self.assertEqual(x.y[i],int((not case) if q=="exit" else case))

    def test_prefix_features(self):
        v = self.raw[self.raw.player_name=="Alex DeBrincat"].reset_index(drop=True)
        end = np.flatnonzero(v.state.eq("hot")|v.state.eq("cold"))[-1]
        whole = make_features(v)
        prefix = make_features(v.iloc[:end+1]).iloc[-1]
        np.testing.assert_allclose(whole.loc[end,FULL+ALL_PROCESS].astype(float),
                                   prefix[FULL+ALL_PROCESS].astype(float), equal_nan=True)

    def test_weighted_cluster_bootstrap_on_ties(self):
        player = np.array([1,1,1,2,2,3,3,4,4])
        y = np.array([0,1,1,0,1,0,1,0,0])
        base = np.array([.1,.1,.3,.3,.4,.3,.4,.4,.1])
        candidate = np.array([.12,.11,.25,.18,.19,.33,.3,.5,.4])
        rng = np.random.default_rng(4271)
        expected = []
        for _ in range(50):
            sample = np.concatenate([np.flatnonzero(player == k+1) for k in rng.integers(4,size=4)])
            if np.unique(y[sample]).size == 2:
                expected.append(roc_auc_score(y[sample],candidate[sample])-roc_auc_score(y[sample],base[sample]))
        lo,hi,n = cluster_gains(y,base,candidate,player,draws=50)
        np.testing.assert_allclose([lo,hi],np.quantile(expected,[.025,.975]))
        self.assertEqual(n,len(expected))


if __name__ == "__main__":
    unittest.main()
