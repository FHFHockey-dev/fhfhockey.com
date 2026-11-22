import http.server, json, os, sys
STATE, MODE = sys.argv[2], sys.argv[3]
OLD = "The schema must be one of the following: public, storage, graphql_public, analytics"
class H(http.server.BaseHTTPRequestHandler):
    def _r(self, code, obj):
        b = json.dumps(obj).encode(); self.send_response(code); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def _do(self):
        n = int(self.headers.get("Content-Length") or 0); n and self.rfile.read(n)
        prof = self.headers.get("Accept-Profile") or self.headers.get("Content-Profile") or ""
        tok = (self.headers.get("Authorization") or "").startswith("Bearer ")
        p = self.path
        if prof == "blsh_no_such_schema":
            msg = OLD if os.path.exists(os.path.join(STATE, "unexposed")) else OLD + ", blsh_replay_api"
            return self._r(406, {"code": "PGRST106", "message": msg})
        if prof == "pgsodium":
            if MODE == "pgsodium_token_200" and tok: return self._r(200, [])
            return self._r(406, {"code": "PGRST106", "message": "stub"})
        if prof in ("cron", "blsh_replay"): return self._r(406, {"code": "PGRST106", "message": "stub"})
        if "blsh_replay_iso_probe_absent" in p: return self._r(404, {"code": "PGRST205", "message": "stub"}) if tok else self._r(404, {})  # hosted: anon gets 404 {}
        if "rpc/blsh_replay_fixture_v1" in p:
            if tok or MODE == "anon_rpc_200": return self._r(200, {})
            return self._r(401, {"code": "42501", "message": "stub"})
        return self._r(500, {"code": "stub_unhandled", "message": p})
    do_GET = do_POST = do_DELETE = _do
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
