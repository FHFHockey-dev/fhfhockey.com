"""Exercise the retained original constructor with an in-process HTTP stub.

No key loader, ledger, provider, local server or network socket is used.
"""
import hashlib
import json
import socket
import sys
import types
from pathlib import Path
from unittest.mock import patch
from urllib import request


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "comparison-diagnostic-fix-2026-10-19/before/pilot.py"
raw = SOURCE.read_bytes()
assert hashlib.sha256(raw).hexdigest() == "640db83c58c2045c65f2935d69fe63e7d75ea23402bef8a994b27cf9354daba9"


def deny_network(event, _):
    if event in ("socket.connect", "socket.getaddrinfo", "socket.bind"):
        raise AssertionError("offline transport control forbids socket activity")


sys.addaudithook(deny_network)
original = types.ModuleType("offline_original_pilot")
# Original file location resolves only the unchanged retained resource paths.
# The executed source bytes above are the original frozen revision.
original.__file__ = str(ROOT / "comparison-sequential-pilot-2026-10-19/pilot.py")
sys.modules[original.__name__] = original
exec(compile(raw, str(SOURCE), "exec"), original.__dict__)
payload = json.loads((ROOT / "comparison-pilot-rules-2026-10-19/pilot-extraction-request.json").read_text())
expected = hashlib.sha256(original.canonical(payload).encode()).hexdigest()
seen = []
stub_body = {"id": "resp_OFFLINE_CONTROL", "model": "gpt-6-luna", "status": "completed",
             "usage": {"input_tokens": 1, "output_tokens": 1, "total_tokens": 2}, "output": []}


class StubReply:
    headers = {"x-request-id": "req_OFFLINE_CONTROL"}

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self, limit):
        assert limit == 1_048_577
        return json.dumps(stub_body).encode()


def local_open(opener, req, data=None, timeout=socket._GLOBAL_DEFAULT_TIMEOUT):
    # Real TLS-context, build_opener and Request constructors ran before here.
    assert req.full_url == "https://api.openai.com/v1/responses"
    assert req.method == "POST" and timeout == 20 and data is None
    assert req.get_header("Authorization") == "Bearer OFFLINE_SYNTHETIC_ONLY"
    assert hashlib.sha256(req.data).hexdigest() == expected
    tls = [h for h in opener.handlers if isinstance(h, request.HTTPSHandler)]
    assert len(tls) == 1 and tls[0]._context.check_hostname
    assert tls[0]._context.verify_mode == original.ssl.CERT_REQUIRED
    seen.append({"wireSha256": expected, "method": req.method, "timeoutSeconds": timeout,
                 "tlsHostnameVerification": True, "tlsCertificatesRequired": True})
    return StubReply()


with patch.object(request.OpenerDirector, "open", local_open):
    body, audit = original.post_once("responses", payload, "OFFLINE_SYNTHETIC_ONLY")
assert body == stub_body and audit["headersRetained"] is False and len(seen) == 1
print(json.dumps({"status": "original_constructor_and_reply_parser_passed_offline",
                  "sourceSha256": hashlib.sha256(raw).hexdigest(), "control": seen[0],
                  "realKeyRead": False, "ledgerOpened": False, "networkCalls": 0,
                  "stubCalls": 1, "localHttpServer": False,
                  "limitation": "No DNS/TLS handshake, actual HTTP socket send or provider ran; this does not identify the original failure."}, indent=2))
