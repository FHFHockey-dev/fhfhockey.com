"""Unit tests for fallback.py's pure parts (no twscrape needed): python3 -m unittest -v (from this folder)."""
import asyncio
import os
import unittest
from unittest import mock

import fallback


class ReachedOverlap(unittest.TestCase):
    def test_first_run_reads_one_page(self):
        self.assertTrue(fallback.reached_overlap([30, 20], None, 1))

    def test_page_one_needs_two_posts_at_or_below_the_anchor(self):
        # An old pinned post alone is not an overlap.
        self.assertFalse(fallback.reached_overlap([5, 90, 80], 50, 1))
        self.assertTrue(fallback.reached_overlap([5, 90, 50], 50, 1))

    def test_later_pages_need_one(self):
        self.assertFalse(fallback.reached_overlap([70, 60], 50, 2))
        self.assertTrue(fallback.reached_overlap([60, 40], 50, 2))


class Main(unittest.TestCase):
    def run_main(self, env, posts):
        calls = []

        def fake_post(url, secret, payload, timeout=45):
            calls.append(payload)
            return posts(payload)

        with mock.patch.dict(os.environ, env, clear=True), mock.patch.object(fallback, "post", fake_post):
            return asyncio.run(fallback.main()), calls

    def test_missing_config_exits_2_without_calls(self):
        code, calls = self.run_main({}, lambda payload: (200, {}))
        self.assertEqual((code, calls), (2, []))

    def test_failed_anchors_fail_the_run_before_touching_x(self):
        env = {"X_INGEST_URL": "https://example.invalid", "X_INGEST_SECRET": "s", "X_BURNER_COOKIES": "c"}
        code, calls = self.run_main(env, lambda payload: (500, {"ok": False}))
        self.assertEqual(code, 1)
        self.assertEqual([call["mode"] for call in calls], ["anchors"])

    def test_shadow_posts_observe_only_and_207_fails_the_run(self):
        env = {"X_INGEST_URL": "https://example.invalid", "X_INGEST_SECRET": "s", "X_BURNER_COOKIES": "c",
               "X_RUN_ID": "123-1"}

        async def fake_read(api, user_id, anchor):
            return [{"id": 9, "id_str": "9"}], 1, True

        def answers(payload):
            if payload["mode"] == "anchors":
                return 200, {"ok": True, "anchors": {}}
            if payload["sourceKey"] == "ccc":
                return 207, {"ok": False, "error": "store_failed"}
            return 200, {"ok": True, "inserted": 1, "mapped": 1}

        async def fake_api(cookies):
            return object()

        with mock.patch.object(fallback, "read_account", fake_read), mock.patch.object(fallback, "build_api", fake_api):
            code, calls = self.run_main(env, answers)
        self.assertEqual(code, 1)
        modes = {call["mode"] for call in calls[1:]}
        self.assertEqual(modes, {"observe"})
        self.assertEqual(len(calls), 1 + len(fallback.ACCOUNTS))
        self.assertTrue(all(call["runId"] == "123-1" for call in calls[1:]))

    def test_a_gap_that_paging_cannot_close_fails_the_run(self):
        env = {"X_INGEST_URL": "https://example.invalid", "X_INGEST_SECRET": "s", "X_BURNER_COOKIES": "c"}

        async def fake_read(api, user_id, anchor):
            return [{"id": 900}], fallback.MAX_PAGES, anchor is None

        async def fake_api(cookies):
            return object()

        def answers(payload):
            if payload["mode"] == "anchors":
                return 200, {"ok": True, "anchors": {"dfofantasy": "100"}}
            return 200, {"ok": True, "inserted": 0, "mapped": 1}

        with mock.patch.object(fallback, "read_account", fake_read), mock.patch.object(fallback, "build_api", fake_api):
            code, _ = self.run_main(env, answers)
        self.assertEqual(code, 1)


if __name__ == "__main__":
    unittest.main()
