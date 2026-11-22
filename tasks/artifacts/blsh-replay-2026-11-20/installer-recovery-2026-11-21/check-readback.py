#!/usr/bin/env python3
"""Check a hosted readback-replay-get.sql output against the R2/R2c step-6 (first) or step-7 (repeat) pass conditions.
Usage: python3 -I check-readback.py READBACK.json first|repeat [FIRST_READBACK.json]   Prints JSON; exit 0 only if all pass."""
import json, sys

SHA = "c922514df647ca30ae5b64dfa0f0fd32a754aeb1"
WANT = {"storage": 28, "receipts": 2, "nativeRuns": 1, "contextRuns": 1, "nativeObjects": 20, "contextObjects": 8}


def load(p):
    t = open(p).read()
    return json.JSONDecoder().raw_decode(t[t.index("{"):])[0]


def g(o, *ks):
    for k in ks:
        if not isinstance(o, dict) or k not in o: return None
        o = o[k]
    return o


rb, mode = load(sys.argv[1]), sys.argv[2]
reqs = {r["jobName"]: r for r in rb.get("requests", [])}
suffix = "" if mode == "first" else "-repeat"
nat, ctx = reqs.get("blsh-replay-native-20261119" + suffix), reqs.get("blsh-replay-context-20261119" + suffix)
nb = json.loads(nat["body"]) if nat and nat.get("body") else {}
cb = json.loads(ctx["body"]) if ctx and ctx.get("body") else {}
c = {
    "jobs_unscheduled": rb.get("jobs") == [],
    "native_http_200": bool(nat) and nat["statusCode"] == 200 and not nat["timedOut"] and nat["errorMsg"] is None,
    "context_http_200": bool(ctx) and ctx["statusCode"] == 200 and not ctx["timedOut"] and ctx["errorMsg"] is None,
    "native_sha": nb.get("sha") == SHA, "context_sha": cb.get("sha") == SHA,
    "fixture_partial": g(rb, "fixtureLabels", "fixtureStatus") == "PARTIAL" and len(g(rb, "fixtureLabels", "asOfUnverified") or []) == 6,
}
nr, cr = nb.get("receipt", {}), cb.get("receipt", {})
if mode == "first":
    c.update({
        "native_finished": nb.get("status") == "replay_native_finished",
        "native_packet_complete": g(nr, "native", "body", "state") == "packet_complete_pending_review",
        "native_objects_20": g(nr, "summary", "native", "objects") == 20,
        "native_fixtures_ok": bool(nr.get("fixture")) and all(f.get("ok") for f in nr.get("fixture", [])),
        "native_only_supabase_outbound": nr.get("nonSandboxOutbound") == [] and all(h.endswith(".supabase.co") or h.startswith("127.0.0.1:") for h in nr.get("outboundHosts", [])),  # 127.0.0.1 = gate 5.5 observer self-test (in-process loopback), as in the local proof
        "native_receipt_written": nr.get("receiptWritten") is True,
        "context_finished": cb.get("status") == "replay_context_finished",
        "context_logical_day": cr.get("logicalIngressDay") == "2026-11-20",
        "context_tampered_403": g(cr, "context", "tamperedGrant", "http") == 403,
        "context_unapproved_403": g(cr, "context", "unapprovedGrant", "http") == 403,
        "context_mismatched_date_refused": g(cr, "context", "mismatchedDateGrant", "body", "reason") == "outside_approved_date",
        "context_live_route_rejects": g(cr, "context", "liveRouteWithTestGrant", "body", "state") != "packet_complete_pending_review",
        "context_packet_complete": g(cr, "context", "grant", "body", "state") == "packet_complete_pending_review",
        "context_objects_8": g(cr, "summary", "context", "objects") == 8,
        "context_reader_ok": g(cr, "readers", "context", "ok") is True,
        "context_receipt_written": cr.get("receiptWritten") is True,
        "sandbox_counts": rb.get("sandbox") == WANT,
    })
else:
    first = load(sys.argv[3])
    c.update({
        "repeat_native_already_claimed": g(nr, "native", "body", "skipped") == "already_claimed",
        "repeat_context_already_claimed": g(cr, "context", "grant", "body", "reason") == "already_claimed",
        "repeat_no_receipts": nr.get("receiptWritten") is False and cr.get("receiptWritten") is False,
        "counts_identical_to_first": rb.get("sandbox") == first.get("sandbox") == WANT,
    })
out = {"mode": mode, "pass": all(c.values()), "failed": [k for k, v in c.items() if not v], "checks": c,
       "nativeElapsedMs": nb.get("elapsedMs"), "contextElapsedMs": cb.get("elapsedMs"), "deploymentId": nb.get("deploymentId"),
       "liveRouteWithTestGrant": g(cr, "context", "liveRouteWithTestGrant"), "sandbox": rb.get("sandbox"), "otherCronJobs": rb.get("otherCronJobs")}
print(json.dumps(out, indent=1, default=str))
sys.exit(0 if out["pass"] else 1)
