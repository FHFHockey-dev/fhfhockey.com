import contextlib
import importlib
import hashlib
import io
import json
import math
from pathlib import Path
import random
import shutil
import subprocess
import sys
import tempfile
import unittest

KIT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(KIT))
import score_gate as sg
from fixtures import DATE, capture, projection, write_fixture, write_json


def metric_row(game, player, truth, base, candidate, pos="F"):
    return {"key": (str(game), str(player)), "game": str(game), "pos": pos,
            "truth": {h: truth for h in sg.HEADS},
            "preds": {"f": {h: base for h in sg.HEADS}, "candidate": {h: candidate for h in sg.HEADS}}}


class CohortTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.args = write_fixture(self.root)

    def load(self):
        return sg.load_cohort(*self.args)

    def edit(self, relative, transform):
        path = self.root / relative
        data = json.loads(path.read_text())
        transform(data)
        write_json(path, data)

    def test_arbitrary_names_composite_identity_and_dressed_denominator(self):
        c = self.load()
        self.assertEqual(c["variants"], ["f", "candidate"])
        self.assertEqual(c["checks"]["dressed_paired_rows"], 36)
        self.assertEqual(c["checks"]["matched_games"], 3)
        self.assertEqual(sum(r["pos"] == "D" for r in c["rows"]), 11)
        self.assertEqual(sum(r["key"][1] == "1" for r in c["rows"]), 3)
        self.assertEqual(len(c["sha256"]), 8)

    def test_union_reports_both_unpaired_directions_and_undressed(self):
        self.edit(f"out/f/{DATE}-101.json", lambda c: c["intendedWrites"][0][1]["args"][0].extend([projection(101, 99), projection(101, 97)]))
        self.edit(f"out/candidate/{DATE}-101.json", lambda c: c["intendedWrites"][0][1]["args"][0].extend([projection(101, 99), projection(101, 98)]))
        self.edit("actuals.json", lambda xs: xs.append({**xs[0], "player_id": 96}))
        checks = self.load()["checks"]
        self.assertEqual(checks["drop_not_in_both"], 2)
        self.assertEqual(checks["drop_not_dressed"], 1)
        self.assertEqual(checks["source_actual_rows"], 37)
        self.assertEqual(checks["dressed_paired_rows"], 36)

    def test_horizon_filter_and_numeric_string_identity(self):
        self.edit(f"out/f/{DATE}-101.json", lambda c: c["intendedWrites"][0][1]["args"][0].append({**projection(101, 1), "horizon_games": 2}))
        self.edit("actuals.json", lambda xs: xs[0].update(game_id="0101", player_id="01"))
        self.assertEqual(len(self.load()["rows"]), 36)

    def test_actual_date_exclusion_and_hb_date_missingness(self):
        self.edit("actuals.json", lambda xs: xs[0].update(date="2026-10-19"))
        self.edit("hb.json", lambda xs: xs[1].update(date="2026-10-19"))
        c = self.load()
        self.assertEqual(len(c["rows"]), 35)
        self.assertEqual(c["checks"]["drop_actual_date_mismatch"], 1)
        self.assertEqual(c["checks"]["hb_date_mismatch"], 1)
        self.assertEqual(len(sg.use(c["rows"], "FP", c["variants"])), 34)
        self.assertEqual(len(sg.use(c["rows"], "G", c["variants"])), 35)

    def test_missing_category_paired_for_every_variant_and_fp(self):
        self.edit(f"out/candidate/{DATE}-101.json", lambda c: c["intendedWrites"][0][1]["args"][0][0].pop("proj_hits"))
        self.edit("hb.json", lambda xs: xs.pop(1))
        c = self.load()
        self.assertEqual(len(sg.use(c["rows"], "HIT", c["variants"])), 34)
        self.assertEqual(len(sg.use(c["rows"], "FP", c["variants"])), 34)
        self.assertEqual(len(sg.use(c["rows"], "SOG", c["variants"])), 36)

    def test_duplicate_actual_hb_capture_and_cross_file_fail(self):
        for path in ("actuals.json", "hb.json", f"out/f/{DATE}-101.json"):
            with self.subTest(path=path):
                original = (self.root / path).read_text()
                def duplicate(data):
                    xs = data if isinstance(data, list) else data["intendedWrites"][0][1]["args"][0]
                    xs.append(xs[0])
                self.edit(path, duplicate)
                with self.assertRaisesRegex(ValueError, "duplicate player-game"):
                    self.load()
                (self.root / path).write_text(original)
        for v in ("f", "candidate"):
            shutil.copyfile(self.root / f"out/{v}/{DATE}-101.json", self.root / f"out/{v}/{DATE}-extra.json")
        with self.assertRaisesRegex(ValueError, "repeated across"):
            self.load()

    def test_missing_capture_file_and_unmatched_replay_are_visible(self):
        (self.root / f"out/candidate/{DATE}-101.json").unlink()
        self.edit(f"out/f/{DATE}-102.json", lambda c: c["diagnostics"]["replay"].update(matched=False))
        c = self.load()
        self.assertEqual(c["checks"]["unpaired_capture_files_f"], 1)
        self.assertEqual(c["checks"]["replay_not_matched_f"], 1)
        self.assertEqual(len(c["rows"]), 25)

    def test_position_is_structural_not_regex_or_global_player_state(self):
        def change(c):
            for p in c["payload"]["reads"][0]["result"]["data"]:
                p["position"] = "D"
                p["extra"] = True
        for v in ("f", "candidate"):
            self.edit(f"out/{v}/{DATE}-101.json", change)
        c = self.load()
        self.assertEqual(sum(r["pos"] == "D" and r["game"] == "101" for r in c["rows"]), 11)
        self.assertEqual(sum(r["pos"] == "D" and r["game"] == "102" for r in c["rows"]), 4)

    def test_conflicting_positions_fail_unknowns_stay_unknown(self):
        self.edit(f"out/candidate/{DATE}-101.json", lambda c: c["payload"]["reads"][0]["result"]["data"][0].update(position="D"))
        with self.assertRaisesRegex(ValueError, "position mismatch"):
            self.load()
        for v in ("f", "candidate"):
            self.edit(f"out/{v}/{DATE}-101.json", lambda c: c["payload"].update(reads=[]))
        self.assertEqual(self.load()["checks"]["unknown_position_rows"], 11)

    def test_missing_date_invalid_identity_and_capture_date_fail(self):
        original = (self.root / "actuals.json").read_text()
        for key, value in (("date", None), ("game_id", True), ("player_id", 0)):
            with self.subTest(key=key):
                self.edit("actuals.json", lambda xs: xs[0].update({key: value}))
                with self.assertRaises(ValueError):
                    self.load()
                (self.root / "actuals.json").write_text(original)
        self.edit(f"out/f/{DATE}-101.json", lambda c: c["payload"].update(slateDate="2026-10-19"))
        with self.assertRaisesRegex(ValueError, "date disagrees"):
            self.load()

    def test_empty_pair_is_reportable_not_a_pass(self):
        for v in ("f", "candidate"):
            for p in (self.root / "out" / v).iterdir():
                p.unlink()
        c = self.load()
        self.assertEqual(c["rows"], [])
        self.assertFalse(sg.legacy_gate("FP", sg.stats([], "candidate", "FP")))


class MetricTests(unittest.TestCase):
    def test_numeric_nulls_booleans_nonfinite_and_zero(self):
        for bad in (None, "", True, False, "bad", float("nan"), float("inf"), "-inf", [], {}):
            self.assertIsNone(sg.num(bad))
        self.assertEqual(sg.num(0), 0)
        self.assertEqual(sg.num("0"), 0)
        h = sg.heads_of(projection(1, 1, 0))
        self.assertTrue(all(v == 0 for v in h.values()))
        row = projection(1, 1)
        row.pop("proj_blocks")
        self.assertIsNone(sg.heads_of(row)["FP"])
        self.assertAlmostEqual(sg.heads_of(projection(1, 1))["FP"], 3.535)

    def test_bias_rmse_relative_bias_are_distinct(self):
        rows = [metric_row(1, 1, 2, 1, 3), metric_row(2, 1, 4, 6, 4)]
        s = sg.stats(rows, "f", "G")
        self.assertEqual(s["bias"], .5)
        self.assertEqual(s["mae"], 1.5)
        self.assertAlmostEqual(s["rmse"], math.sqrt(2.5))
        self.assertAlmostEqual(s["rel"], 7/6 - 1)

    def test_deciles_own_forecast_floor_boundaries_and_ties(self):
        rows = [metric_row(1, i, i * 2, i, 22-i) for i in range(1, 22)]
        a, c = sg.deciles(rows, "f", "G"), sg.deciles(rows, "candidate", "G")
        self.assertEqual([d["n"] for d in a], [2]*9 + [3])
        self.assertTrue(all(d["ratio"] == 2 for d in a))
        self.assertAlmostEqual(c[9]["ratio"], 12/60)
        tied = [metric_row(1, i, i, 1, 1) for i in (3, 1, 2)]
        self.assertEqual(sg.deciles(tied, "f", "G"), sg.deciles(list(reversed(tied)), "f", "G"))
        self.assertEqual(sg.deciles(tied, "f", "G")[0]["n"], 0)

    def test_game_cluster_sampling_keeps_all_players_and_multiplicity(self):
        rows = [metric_row(1, 1, 1, 1, 2), metric_row(1, 2, 2, 2, 4), metric_row(2, 3, 10, 10, 0)]
        samples = list(sg.cluster_samples(rows, reps=40))
        oracle = random.Random(1)
        expected_sizes = []
        for _ in range(40):
            ids = [oracle.choice(["1", "2"]) for _ in range(2)]
            expected_sizes.append(sum(2 if g == "1" else 1 for g in ids))
        self.assertEqual([len(s) for s in samples], expected_sizes)
        self.assertTrue(any(len(s) == 4 for s in samples))
        for sample in samples:
            self.assertEqual(sum(r["key"] == ("1", "1") for r in sample), sum(r["key"] == ("1", "2") for r in sample))

    def test_bootstrap_default_seed_reps_and_independent_delta_oracle(self):
        rows = [metric_row(1, 1, 1, 1, 2), metric_row(1, 2, 2, 2, 4), metric_row(2, 3, 10, 10, 0)]
        result = sg.bootstrap(rows, "G", "f", "candidate")
        rnd = random.Random(1)
        bias, rmse = [], []
        for _ in range(2000):
            errors = []
            for _ in range(2):
                errors.extend([1, 2] if rnd.choice([1, 2]) == 1 else [-10])
            bias.append(sum(errors)/len(errors))
            rmse.append(math.sqrt(sum(x*x for x in errors)/len(errors)))
        for name, values in (("delta_bias", bias), ("delta_rmse", rmse)):
            values.sort()
            self.assertEqual(result[name]["bounds"], (values[50], values[1949]))
            self.assertEqual(result[name]["reps"], 2000)
        self.assertEqual(result, sg.bootstrap(rows, "G", "f", "candidate"))
        self.assertNotEqual(list(sg.cluster_samples(rows, 40, 1)), list(sg.cluster_samples(rows, 40, 2)))

    def test_bootstrap_variant_names_cannot_overwrite_bookkeeping(self):
        rows = [metric_row(1, 1, 1, 1, 2), metric_row(2, 2, 3, 4, 3)]
        expected = sg.bootstrap(rows, "G", "f", "candidate", reps=40)
        pairs = [("delta_bias", "trial"), ("baseline", "delta_bias"),
                 ("delta_rmse", "trial"), ("baseline", "delta_rmse"),
                 ("delta_bias", "delta_rmse"), ("delta_rmse", "delta_bias"),
                 ("variants", "trial"), ("baseline", "variants")]
        for base, cand in pairs:
            with self.subTest(base=base, candidate=cand):
                renamed = [{**r, "preds": {base: r["preds"]["f"], cand: r["preds"]["candidate"]}} for r in rows]
                result = sg.bootstrap(renamed, "G", base, cand, reps=40)
                self.assertEqual(set(result), {"delta_bias", "delta_rmse", "variants"})
                for key in ("delta_bias", "delta_rmse"):
                    self.assertEqual(result[key], expected[key])
                self.assertEqual(result["variants"][base], expected["variants"]["f"])
                self.assertEqual(result["variants"][cand], expected["variants"]["candidate"])

    def test_bootstrap_uses_only_common_head_eligible_game_clusters(self):
        rows = [metric_row(1, 1, 2, 1, 2), metric_row(2, 1, 10, 9, 10)]
        rows[1]["preds"]["candidate"]["G"] = None
        eligible = sg.use(rows, "G", ["f", "candidate"])
        self.assertEqual([r["game"] for r in eligible], ["1"])
        result = sg.bootstrap(eligible, "G", "f", "candidate", reps=40)
        self.assertEqual(result["delta_bias"]["bounds"], (1, 1))
        self.assertEqual(result["delta_rmse"]["bounds"], (-1, -1))

    def test_zero_missing_and_empty_bootstrap_are_explicit(self):
        zero = [metric_row(1, 1, 0, 0, 0)]
        s = sg.stats(zero, "f", "G")
        self.assertEqual(s["rmse"], 0)
        self.assertIsNone(s["rel"])
        self.assertIsNone(s["top"])
        result = sg.bootstrap(zero, "G", "f", "candidate", reps=40)
        self.assertEqual(result["delta_rmse"]["bounds"], (0, 0))
        self.assertIsNone(result["variants"]["candidate"]["top"]["bounds"])
        empty = sg.bootstrap([], "G", "f", "candidate", reps=40)
        self.assertEqual(empty["delta_bias"]["valid_reps"], 0)
        partly_undefined = sg.interval([1]*1999 + [None])
        self.assertIsNone(partly_undefined["bounds"])
        self.assertEqual(partly_undefined["valid_reps"], 1999)

    def test_mz_actual_on_predicted_slope_intercept_and_degeneracy(self):
        rows = [metric_row(1, x, 2*x+3, x, x*2) for x in range(1, 11)]
        self.assertEqual(sg.mz(rows, "f", "G")["slope"], 2)
        self.assertEqual(sg.mz(rows, "f", "G")["intercept"], 3)
        self.assertEqual(sg.mz(rows, "candidate", "G")["slope"], 1)
        self.assertEqual(sg.mz([], "f", "G")["reason"], "empty paired category")
        self.assertEqual(sg.mz([metric_row(1, 1, 2, 1, 1)], "f", "G")["reason"], "constant predictions")

    def test_d_representation_preserves_floor_and_unknown_denominator(self):
        rows = [metric_row(1, i, i, i, 22-i, "D" if i > 19 else "?") for i in range(1, 22)]
        result = sg.defense_share(rows, "f")
        self.assertEqual(result, {"top_n": 2, "top_d": 2, "all_n": 21, "all_d": 2, "unknown_n": 19})
        self.assertEqual(sg.defense_share(rows, "candidate")["top_d"], 0)
        self.assertEqual(sg.defense_share(rows), result)

    def test_legacy_thresholds_unchanged_and_unavailable_fails(self):
        self.assertTrue(sg.legacy_gate("FP", {"rel": .10, "top": 1.0}))
        self.assertFalse(sg.legacy_gate("FP", {"rel": .10001, "top": 1.0}))
        self.assertTrue(sg.legacy_gate("G", {"rel": 2, "top": .95}))
        self.assertFalse(sg.legacy_gate("G", {"rel": 0, "top": .89999}))
        self.assertFalse(sg.legacy_gate("FP", {"rel": None, "top": 1.0}))
        self.assertFalse(sg.legacy_gate("G", {"rel": 0, "top": None}))


class PortabilityTests(unittest.TestCase):
    def test_imports_have_no_scoring_side_effect(self):
        for module in ("score_pair", "gate_ci", "mz"):
            with contextlib.redirect_stdout(io.StringIO()) as output:
                importlib.reload(importlib.import_module(module))
            self.assertEqual(output.getvalue(), "")

    def test_scripts_run_from_isolated_copy_without_siblings(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for name in ("score_gate.py", "score_pair.py", "gate_ci.py", "mz.py"):
                shutil.copyfile(KIT / name, root / name)
            args = write_fixture(root)
            # Make every head empty, including F/D groups, for CLI degeneracy coverage.
            for v in ("f", "candidate"):
                for path in (root / "out" / v).iterdir():
                    write_json(path, capture([]))
            commands = [("score_pair.py", list(args)), ("gate_ci.py", list(args)),
                        ("mz.py", [args[0], "f,candidate", args[3], args[4]]),
                        ("score_gate.py", [args[0], args[3], args[4], "--base", "f", "--candidate", "candidate"])]
            for script, argv in commands:
                with self.subTest(script=script):
                    done = subprocess.run([sys.executable, "-B", str(root / script), *map(str, argv)], cwd="/tmp", capture_output=True, text=True)
                    self.assertEqual(done.returncode, 0, done.stderr)
                    self.assertIn("unavailable", done.stdout)
                    self.assertIn("does not establish model qualification", done.stdout)
                    self.assertNotIn("nan", done.stdout.lower())

    def test_adversarial_variant_names_run_all_bootstrap_reports(self):
        import gate_ci
        import score_pair
        pairs = [("delta_bias", "trial"), ("baseline", "delta_bias"),
                 ("delta_rmse", "trial"), ("baseline", "delta_rmse"),
                 ("delta_bias", "delta_rmse"), ("variants", "delta_bias")]
        for base, cand in pairs:
            with tempfile.TemporaryDirectory() as temp, self.subTest(base=base, candidate=cand):
                args = write_fixture(temp, (base, cand))
                for report in (score_pair.main, gate_ci.main):
                    with contextlib.redirect_stdout(io.StringIO()) as output:
                        report(*args)
                    self.assertIn("2000 replicates, seed 1", output.getvalue())
                    self.assertIn(base, output.getvalue())
                    self.assertIn(cand, output.getvalue())
                with contextlib.redirect_stdout(io.StringIO()) as output:
                    sg.main(args[0], args[3], args[4], base, cand)
                self.assertIn("Legacy Task2 numerical checks", output.getvalue())

    def test_legacy_pair_reference_on_complete_synthetic_cohort(self):
        with tempfile.TemporaryDirectory() as temp:
            args = write_fixture(temp)
            cohort = sg.load_cohort(*args)
            reference = json.loads((KIT / "tests" / "legacy_reference.json").read_text())
            self.assertEqual(reference["fixture_sha256"], hashlib.sha256((KIT / "tests" / "fixtures.py").read_bytes()).hexdigest())
            fp_rows = sg.use(cohort["rows"], "FP", cohort["variants"])
            actual_d = sg.defense_share(fp_rows)
            d_lines = []
            for v in cohort["variants"]:
                d = sg.defense_share(fp_rows, v)
                d_lines.append(f"{v}: D in top FP decile {d['top_d']}/{d['top_n']}; D share of all rows {d['all_d']}/{d['all_n']}; actual-top-decile D {actual_d['top_d']}")
            self.assertEqual(d_lines, reference["legacy_mz_d_lines"])
            for group in ("all", "F", "D"):
                group_rows = [r for r in cohort["rows"] if group == "all" or r["pos"] == group]
                for h in sg.HEADS:
                    rows = sg.use(group_rows, h, cohort["variants"])
                    a, c = sg.stats(rows, "f", h), sg.stats(rows, "candidate", h)
                    boot = sg.bootstrap(rows, h, "f", "candidate")
                    if group == "all":
                        for v in cohort["variants"]:
                            values = sg.stats(rows, v, h)
                            self.assertEqual([
                                f"{values['rel']:+.1%} {sg.ci(boot['variants'][v]['rel'], '+.1%')}",
                                f"{values['top']:.3f} {sg.ci(boot['variants'][v]['top'], '.3f')}"
                            ], reference["ci"][h][v])
                        if h in reference["mz"]:
                            cells = []
                            for v in cohort["variants"]:
                                m = sg.mz(rows, v, h)
                                cells.append(f"{m['slope']:.3f} ({m['intercept']:+.3f})")
                            self.assertEqual(cells, reference["mz"][h])
                    expected = reference["pair"][group][h]
                    actual = [str(len(rows))]
                    for metric, spec in (("bias", "+.4f"), ("rel", "+.1%"), ("rmse", ".4f")):
                        actual.append(f"{a[metric] if a[metric] is not None else math.nan:{spec}} → {c[metric] if c[metric] is not None else math.nan:{spec}}")
                    actual.append(f"{a['top']:.3f} → {c['top']:.3f} {sg.ci(boot['variants']['candidate']['top'], '.3f')}")
                    actual.append(f"{c['bias']-a['bias']:+.4f} {sg.ci(boot['delta_bias'], '+.4f')}")
                    actual.append(f"{c['rmse']-a['rmse']:+.4f} {sg.ci(boot['delta_rmse'], '+.4f')}")
                    self.assertEqual(actual, expected, (group, h))
                    for v in cohort["variants"]:
                        self.assertEqual([sg.fmt(d['ratio'], '.2f') for d in sg.deciles(rows, v, h)], reference["deciles"][group][h][v])


if __name__ == "__main__":
    unittest.main()
