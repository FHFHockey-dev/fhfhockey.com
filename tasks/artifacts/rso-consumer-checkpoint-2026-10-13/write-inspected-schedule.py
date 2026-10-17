#!/usr/bin/env python3
"""User-run, one-shot guarded write. Auth is privately supplied; nothing is saved."""

import getpass
import json
import re
import subprocess
import sys
import warnings
from urllib.parse import urlencode

ENDPOINT = "https://fhfhockey.com/api/v1/db/update-roster-optimizer-schedule"
DATABASE_URL = "https://fyhftlxokyjtpndbkfse.supabase.co"
EXPECTED_SCOPE_HASH = "eab29c8c1413bc553908a01f0f5e6d760565ee58675d336931f7420b174e8b7c"
GAME_IDS = tuple(range(2026020084, 2026020141))
QUERY = {
    "mode": "bounded",
    "gameKey": "477",
    "startDate": "2026-10-11",
    "endDate": "2026-10-19",
    "dryRun": "false",
    "expectedScopeHash": EXPECTED_SCOPE_HASH,
    "seasonId": "20262027",
    "gameIds": ",".join(map(str, GAME_IDS)),
    "maxSides": "114",
}


def public_integer(value):
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def sanitize(payload, status):
    """Allowlist public acknowledgement/audit facts; never print raw response or headers."""
    result = {"httpStatus": status, "guardedWriteRequest": True, "approvedScopeHash": EXPECTED_SCOPE_HASH,
              "acknowledgement": "UNKNOWN", "databaseReadbackRequired": True, "automaticRetry": False}
    if not isinstance(payload, dict):
        result["result"] = "Unknown acknowledgement; raw body suppressed. Stop for database/audit readback."
        return result, False
    audit = payload.get("finalAudit")
    if isinstance(audit, dict) and audit.get("owner") == "withCronJobAudit" and audit.get("status") in ["persisted", "failed"]:
        result["finalAudit"] = {"owner": "withCronJobAudit", "status": audit["status"]}
    outcome = payload.get("writeOutcome")
    data = payload.get("data")
    if isinstance(data, dict):
        outcome = data.get("writeOutcome", outcome)
    if outcome in ["acknowledged", "not_attempted", "unknown"]:
        result["writeOutcome"] = outcome
    if payload.get("success") is not True or not isinstance(data, dict):
        error = payload.get("error")
        code = error.get("code") if isinstance(error, dict) else None
        if isinstance(code, str) and re.fullmatch(r"[A-Z_]{1,64}", code):
            result["errorCode"] = code
        if outcome == "not_attempted":
            result["acknowledgement"] = "NOT_ATTEMPTED"
            result["result"] = "Route reports no schedule write attempted. Stop; review source/scope and audit receipt."
        else:
            result["result"] = "Write failed or acknowledgement unknown. Stop for exact database/audit readback."
        return result, False
    scope = data.get("scope")
    scope = scope if isinstance(scope, dict) else {}
    ids = scope.get("gameIds")
    approved_ids = isinstance(ids, list) and all(public_integer(item) is not None for item in ids) and ids == list(GAME_IDS)
    range_valid = data.get("refreshRange") == {"startDate": QUERY["startDate"], "endDate": QUERY["endDate"]}
    result.update({
        "success": True, "dryRun": data.get("dryRun") if isinstance(data.get("dryRun"), bool) else None,
        "boundedModeMatches": data.get("mode") == "bounded", "gameKeyMatches": data.get("gameKey") == "477",
        "yahooSeasonMatches": data.get("yahooSeason") == "2026", "sourceSeasonMatches": data.get("sourceSeasonId") == 20262027,
        "rangeMatches": range_valid, "exact57GameIdsMatch": bool(approved_ids),
        "scopeSeasonId": public_integer(scope.get("seasonId")), "maximumSides": public_integer(scope.get("maxSides")),
        "sides": public_integer(scope.get("sides")), "rowsPlanned": public_integer(data.get("rowsPlanned")),
        "rowsUpserted": public_integer(data.get("rowsUpserted")), "rowsDeleted": public_integer(data.get("rowsDeleted")),
        "scopeHashMatchesInspection": scope.get("scopeHash") == EXPECTED_SCOPE_HASH,
        "warningsCount": len(data["warnings"]) if isinstance(data.get("warnings"), list) else None,
    })
    schedule_ack = (200 <= status < 300 and data.get("dryRun") is False and result["boundedModeMatches"]
                    and result["gameKeyMatches"] and result["yahooSeasonMatches"] and result["sourceSeasonMatches"]
                    and range_valid and approved_ids and scope.get("seasonId") == 20262027
                    and scope.get("maxSides") == 114 and scope.get("sides") == 114
                    and data.get("rowsPlanned") == 114 and data.get("rowsUpserted") == 114
                    and data.get("rowsDeleted") == 0 and outcome == "acknowledged"
                    and scope.get("scopeHash") == EXPECTED_SCOPE_HASH)
    if schedule_ack:
        result["acknowledgement"] = "SCHEDULE_ACKNOWLEDGED"
        result["result"] = "Schedule acknowledged; exact database readback and audit verification still required."
    else:
        result["result"] = "Scope or acknowledgement mismatch. Stop for exact database/audit readback."
    audit_ok = result.get("finalAudit", {}).get("status") == "persisted"
    if schedule_ack and not audit_ok:
        result["result"] = "Schedule acknowledged but audit failed/missing. Do not replay; inspect database/audit."
    return result, bool(schedule_ack and audit_ok)


def main():
    if len(sys.argv) != 1:
        print("Run without arguments. Never supply a credential on the command line.", file=sys.stderr)
        return 2
    if not sys.stdin.isatty():
        print("An interactive private terminal is required; do not pipe credentials.", file=sys.stderr)
        return 2
    print("One GUARDED PRODUCTION WRITE:57games/at most114team sides plus one audit. No retry or redirect.")
    print("Use only the already confirmed production destination. A fresh inspected hash is pinned; any drift stops the route.")
    confirmed = input("Enter only that PUBLIC database URL (not a key or token): ").strip().rstrip("/")
    if confirmed != DATABASE_URL:
        print("Destination not confirmed. No request made.")
        return 2
    print("Use an existing admin session bearer or cron bearer from your trusted private client.")
    print("It will not echo. Do not run in a recorded/shared terminal. If unavailable, cancel now.")
    try:
        with warnings.catch_warnings(), open("/dev/tty", "w") as terminal:
            warnings.simplefilter("error", getpass.GetPassWarning)
            bearer = getpass.getpass("Private bearer (hidden): ", stream=terminal)
    except (OSError, EOFError, KeyboardInterrupt, getpass.GetPassWarning):
        print("Cancelled or no private terminal. No request made.")
        return 2
    if not bearer or any(character.isspace() for character in bearer) or not re.fullmatch(r"[A-Za-z0-9._~+/=-]+", bearer):
        print("Invalid bearer format. No request made; value suppressed.")
        return 2
    # Authorization stays in this process/pipe, never argv, environment, a file or logs.
    # --disable ignores ~/.curlrc; no redirects, cookies, verbose output, trace or retries.
    config = 'header = "Authorization: Bearer ' + bearer + '"\n'
    command = ["/usr/bin/curl", "--disable", "--silent", "--proto", "=https", "--tlsv1.2",
               "--request", "POST", "--data", "", "--header", "Accept: application/json",
               "--connect-timeout", "10", "--max-time", "245", "--retry", "0",
               "--max-filesize", "262144", "--write-out", "\n%{http_code}",
               "--config", "-", ENDPOINT + "?" + urlencode(QUERY)]
    try:
        response = subprocess.run(command, input=config, capture_output=True, text=True, timeout=250, check=False)
    except (OSError, subprocess.TimeoutExpired, KeyboardInterrupt, UnicodeError):
        print(json.dumps({"guardedWriteRequest": True, "acknowledgement": "UNKNOWN", "databaseReadbackRequired": True, "result": "Transport failed or timed out. Stop; do not retry. Exact database/audit readback required."}, indent=2))
        return 1
    finally:
        bearer = None
        config = None
    if response.returncode != 0:
        print(json.dumps({"guardedWriteRequest": True, "acknowledgement": "UNKNOWN", "databaseReadbackRequired": True, "curlExit": response.returncode,
                          "result": "Transport failed; raw body/stderr/headers suppressed. Stop; do not retry before database/audit readback."}, indent=2))
        return 1
    raw_body, separator, raw_status = response.stdout.rpartition("\n")
    status = int(raw_status) if separator and re.fullmatch(r"\d{3}", raw_status) else 0
    try:
        payload = json.loads(raw_body)
    except (ValueError, TypeError):
        payload = None
    public_result, valid = sanitize(payload, status)
    print(json.dumps(public_result, indent=2))
    return 0 if valid else 1


if __name__ == "__main__":
    raise SystemExit(main())
