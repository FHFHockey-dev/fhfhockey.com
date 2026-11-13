#!/usr/bin/env python3
"""Fixture tests for power-g5v5-loop.py's guard windows (no database, secrets or network).

Loads only the window constants and functions from the runner (the runner itself connects to the database
when imported), with a fake clock, guard and stop.
Run:  python3 -I tasks/artifacts/calculation-inventory-2026-11-10/master/production/power-g5v5-2026-11-13/test_power_g5v5_loop.py
"""
import ast, calendar, os, time, types, unittest

RUNNER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "power-g5v5-loop.py")
NAMES = {"WINDOWS", "CALL_MARGIN_MIN", "START_MARGIN_MIN", "window_at", "write_gate"}


class Stopped(Exception):
    def __init__(self, code, reason, **kw):
        super().__init__(reason)
        self.code, self.reason, self.kw = code, reason, kw


class Clock:
    def __init__(self, hh, mm, ss=0):
        self.t = calendar.timegm((2026, 11, 14, hh, mm, ss, 0, 0, 0))  # seconds since the epoch, UTC

    def gmtime(self):
        return time.gmtime(self.t)


def load(clock, guard_wait_s=0):
    """The runner's window code bound to a fake clock; guard() advances the clock by guard_wait_s."""
    with open(RUNNER) as fh:
        tree = ast.parse(fh.read())
    body = [n for n in tree.body
            if (isinstance(n, ast.Assign) and any(getattr(t, "id", None) in NAMES for t in n.targets))
            or (isinstance(n, ast.FunctionDef) and n.name in NAMES)]
    calls = {"guard": 0}

    def guard():
        calls["guard"] += 1
        clock.t += guard_wait_s

    def stop(code, reason, **kw):
        raise Stopped(code, reason, **kw)

    ns = {"time": types.SimpleNamespace(gmtime=clock.gmtime), "guard": guard, "stop": stop}
    exec(compile(ast.Module(body=body, type_ignores=[]), RUNNER, "exec"), ns)
    missing = NAMES - set(ns)
    if missing:
        raise AssertionError(f"runner no longer defines {sorted(missing)}")
    return ns, calls


class WriteGateClockCrossing(unittest.TestCase):
    def test_guard_wait_crossing_0910_stops_before_the_write(self):
        # 09:08:30 is clear (09:25 window is 16.5 min away); two 60 s guard waits reach 09:10:30.
        clock = Clock(9, 8, 30)
        ns, calls = load(clock, guard_wait_s=120)
        with self.assertRaises(Stopped) as cm:
            ns["write_gate"]("2026-10-15")
        self.assertEqual(cm.exception.code, 4)
        self.assertIn("after the DB guard wait", cm.exception.reason)
        self.assertEqual(cm.exception.kw.get("resume_from"), "2026-10-15")
        self.assertEqual(calls["guard"], 1)

    def test_clear_before_and_after_guard_lets_the_write_proceed(self):
        clock = Clock(8, 40)
        ns, calls = load(clock, guard_wait_s=120)
        ns["write_gate"]("2026-10-15")  # no stop
        self.assertEqual(calls["guard"], 1)

    def test_already_inside_the_call_margin_stops_before_the_guard(self):
        clock = Clock(9, 10)
        ns, calls = load(clock)
        with self.assertRaises(Stopped) as cm:
            ns["write_gate"]("2026-10-15")
        self.assertEqual(cm.exception.code, 4)
        self.assertNotIn("after the DB guard wait", cm.exception.reason)
        self.assertEqual(calls["guard"], 0)

    def test_cron_283_itself_is_inside_a_window(self):
        ns, _ = load(Clock(10, 15))
        self.assertTrue(ns["window_at"](0).startswith("09:25-11:00"))


class WindowArithmetic(unittest.TestCase):
    CASES = [  # (hh, mm, margin, expected window prefix or None)
        (7, 44, 15, None), (7, 45, 15, "08:00"), (8, 19, 0, "08:00"), (8, 20, 0, None),
        (9, 9, 15, None), (9, 10, 15, "09:25"), (10, 59, 0, "09:25"), (11, 0, 0, None),
        (11, 0, 15, "11:15"), (11, 39, 0, "11:15"), (11, 40, 0, None), (23, 50, 25, None),
        # start margin (25): a run started at an allowed time ends before the 15-min call margin
        (7, 34, 25, None), (7, 35, 25, "08:00"), (8, 59, 25, None), (9, 0, 25, "09:25"),
        (11, 40, 25, None), (16, 31, 25, None),
    ]

    def test_cases(self):
        for hh, mm, margin, exp in self.CASES:
            ns, _ = load(Clock(hh, mm))
            got = ns["window_at"](margin)
            with self.subTest(at=f"{hh:02d}:{mm:02d}", margin=margin):
                if exp is None:
                    self.assertIsNone(got)
                else:
                    self.assertTrue(got and got.startswith(exp), got)

    def test_margins(self):
        ns, _ = load(Clock(12, 0))
        self.assertEqual(ns["CALL_MARGIN_MIN"], 15)
        self.assertGreaterEqual(ns["START_MARGIN_MIN"] - ns["CALL_MARGIN_MIN"], 9)  # covers an ~8 min run


if __name__ == "__main__":
    unittest.main(verbosity=2)
