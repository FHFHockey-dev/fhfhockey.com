"""Offline forensic controls for the unchanged, reviewed pilot.

All transports and keys are synthetic; only disposable ledgers are written.
These controls cannot establish which synthetic failure occurred historically.
"""
import io
import json
from contextlib import closing
import socket
import sqlite3
import ssl
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "comparison-sequential-pilot-2026-10-19"))
import pilot
from test_pilot import candidates, clearance, extraction


class Reply:
    def __init__(self, raw=b"", failure=None):
        self.raw, self.failure = raw, failure

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self, _):
        if self.failure:
            raise self.failure
        return self.raw


class FailureBoundaries(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.directory = Path(self.tmp.name)
        for name, value in [
            ("STATE", self.directory / "state"),
            ("RULES_OUTPUT", self.directory / "rules.json"),
            ("EXECUTION_MANIFEST", self.directory / "manifest.json"),
        ]:
            p = patch.object(pilot, name, value)
            p.start()
            self.addCleanup(p.stop)
        self.network = patch.object(
            socket.socket, "connect", side_effect=AssertionError("offline only")
        ).start()
        self.addCleanup(patch.stopall)

    def execute(self, transport):
        with self.assertRaises((RuntimeError, ValueError)):
            pilot.run(
                clearance(), candidates(), self.directory / "run",
                transport=transport, key_loader=lambda: "offline-placeholder",
            )
        self.network.assert_not_called()
        path = pilot.STATE / "budget.sqlite"
        with closing(sqlite3.connect("file:" + str(path) + "?mode=ro", uri=True)) as db:
            row = db.execute(
                "SELECT state,error,response,actual FROM attempts"
            ).fetchone()
            self.assertEqual(db.execute("SELECT count(*) FROM attempts").fetchone()[0], 1)
        return row

    def collapsed(self, *, open_error=None, reply=None, construction_error=None):
        opener = Mock()
        opener.open.side_effect = open_error
        opener.open.return_value = reply
        wrapper = {}

        def transport(endpoint, payload, key):
            try:
                return pilot.post_once(endpoint, payload, key)
            except Exception as exc:
                wrapper["type"] = type(exc).__name__
                wrapper["message"] = str(exc)
                raise

        with patch.object(
            pilot.request, "build_opener", return_value=opener,
            side_effect=construction_error,
        ):
            row = self.execute(transport)
        self.assertEqual(row[:2], ("uncertain", "RuntimeError"))
        self.assertIsNone(row[3])
        retained = json.loads(row[2])
        self.assertIsNone(retained["response"])
        self.assertIsNone(retained["audit"])
        return wrapper, opener

    def test_dns_failure_has_same_retained_signature(self):
        wrapped, _ = self.collapsed(open_error=URLError(socket.gaierror(-2, "synthetic DNS failure")))
        self.assertEqual(wrapped["message"], "transport_or_reply_URLError")

    def test_tls_failure_has_same_retained_signature(self):
        wrapped, _ = self.collapsed(open_error=URLError(ssl.SSLCertVerificationError(1, "synthetic certificate failure")))
        self.assertEqual(wrapped["message"], "transport_or_reply_URLError")

    def test_http_status_and_request_id_are_lost(self):
        wrapped, _ = self.collapsed(open_error=HTTPError(
            "https://api.openai.com/v1/responses", 401, "synthetic error",
            {"x-request-id": "req_offline_control"}, io.BytesIO(b'{"error":{"code":"synthetic"}}'),
        ))
        self.assertEqual(wrapped["message"], "transport_or_reply_HTTPError")

    def test_response_read_timeout_has_same_retained_signature(self):
        wrapped, _ = self.collapsed(reply=Reply(failure=TimeoutError("synthetic read timeout")))
        self.assertEqual(wrapped["message"], "transport_or_reply_TimeoutError")

    def test_received_invalid_utf8_has_same_retained_signature(self):
        wrapped, _ = self.collapsed(reply=Reply(b"\xff"))
        self.assertEqual(wrapped["message"], "transport_or_reply_UnicodeDecodeError")

    def test_received_invalid_json_loses_existing_id_and_usage(self):
        wrapped, _ = self.collapsed(reply=Reply(b'{"id":"resp_offline","usage":{"input_tokens":1}} trailing'))
        self.assertEqual(wrapped["message"], "transport_or_reply_JSONDecodeError")

    def test_received_overflow_has_same_retained_signature(self):
        wrapped, _ = self.collapsed(reply=Reply(b" " * 1_048_577))
        self.assertEqual(wrapped["message"], "transport_or_reply_ValueError")

    def test_pre_open_runtime_error_also_has_same_signature(self):
        wrapped, opener = self.collapsed(construction_error=RuntimeError("synthetic construction failure"))
        self.assertEqual(wrapped["message"], "synthetic construction failure")
        opener.open.assert_not_called()

    def test_missing_usage_would_retain_the_parsed_response(self):
        body = extraction()
        del body["usage"]
        state, error, stored, actual = self.execute(lambda *_: (body, {"synthetic": True}))
        self.assertEqual((state, error, actual), ("uncertain", "ValueError", None))
        self.assertEqual(json.loads(stored)["response"], body)

    def test_schema_failure_after_usage_would_already_be_settled(self):
        body = extraction()
        parsed = json.loads(body["output"][0]["content"][0]["text"])
        parsed["claims"][0]["evidence"]["end"] = 999
        body["output"][0]["content"][0]["text"] = json.dumps(parsed)
        state, error, stored, actual = self.execute(lambda *_: (body, {"synthetic": True}))
        self.assertEqual((state, error), ("settled", None))
        self.assertGreater(actual, 0)
        self.assertEqual(json.loads(stored)["response"], body)

    def test_invalid_sealed_wire_would_record_value_error(self):
        def transport(endpoint, payload, key):
            return pilot.post_once(endpoint, pilot.SealedPayload(endpoint, payload.wire, "invalid"), key)
        state, error, stored, actual = self.execute(transport)
        self.assertEqual((state, error, actual), ("uncertain", "ValueError", None))
        self.assertIsNone(json.loads(stored)["response"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
