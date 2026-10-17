#!/usr/bin/env python3
"""User-run fixed-scope inspection, explicit confirmation, then one guarded write."""

import getpass
import json
import re
import subprocess
import sys
import warnings
import time
from urllib.parse import urlencode

ENDPOINT = "https://fhfhockey.com/api/v1/db/update-roster-optimizer-schedule"
DATABASE_URL = "https://fyhftlxokyjtpndbkfse.supabase.co"
GAME_IDS = tuple(range(2026020084, 2026020141))
QUERY = {
    "mode": "bounded",
    "gameKey": "477",
    "startDate": "2026-10-11",
    "endDate": "2026-10-19",
    "dryRun": "true",
    "seasonId": "20262027",
    "gameIds": ",".join(map(str, GAME_IDS)),
    "maxSides": "114",
}


def public_integer(value):
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def sanitize_inspection(payload, status):
    """Print only allowlisted public scope/result facts, never arbitrary server text."""
    result = {"httpStatus": status, "inspectionOnly": True}
    if not isinstance(payload, dict):
        result["result"] = "Non-JSON or unexpected response; raw body suppressed."
        return result, False
    data = payload.get("data")
    if payload.get("success") is not True or not isinstance(data, dict):
        error = payload.get("error")
        code = error.get("code") if isinstance(error, dict) else None
        if isinstance(code, str) and re.fullmatch(r"[A-Z_]{1,64}", code):
            result["errorCode"] = code
        result["result"] = "Inspection failed; raw response and headers suppressed."
        return result, False
    scope = data.get("scope")
    scope = scope if isinstance(scope, dict) else {}
    ids = scope.get("gameIds")
    ids_valid = isinstance(ids, list) and all(public_integer(item) is not None for item in ids)
    approved_ids = ids_valid and ids == list(GAME_IDS)
    scope_hash = scope.get("scopeHash")
    hash_valid = isinstance(scope_hash, str) and re.fullmatch(r"[0-9a-f]{64}", scope_hash)
    range_valid = data.get("refreshRange") == {"startDate": QUERY["startDate"], "endDate": QUERY["endDate"]}
    result.update({
        "success": True,
        "dryRun": data.get("dryRun") is True,
        "boundedModeMatches": data.get("mode") == "bounded",
        "gameKeyMatches": data.get("gameKey") == "477",
        "yahooSeasonMatches": data.get("yahooSeason") == "2026",
        "sourceSeasonMatches": data.get("sourceSeasonId") == 20262027,
        "rangeMatches": range_valid,
        "exact57GameIdsMatch": bool(approved_ids),
        "scopeSeasonId": public_integer(scope.get("seasonId")),
        "maximumSides": public_integer(scope.get("maxSides")),
        "sides": public_integer(scope.get("sides")),
        "rowsPlanned": public_integer(data.get("rowsPlanned")),
        "rowsUpserted": public_integer(data.get("rowsUpserted")),
        "rowsDeleted": public_integer(data.get("rowsDeleted")),
        "writeNotAttempted": data.get("writeOutcome") == "not_attempted",
        "warningsCount": len(data["warnings"]) if isinstance(data.get("warnings"), list) else None,
    })
    if hash_valid:
        result["scopeHash"] = scope_hash
    valid = (200 <= status < 300 and result["dryRun"] and result["boundedModeMatches"]
             and result["gameKeyMatches"] and result["yahooSeasonMatches"]
             and result["sourceSeasonMatches"] and range_valid and approved_ids
             and scope.get("seasonId") == 20262027 and scope.get("maxSides") == 114
             and scope.get("sides") == 114 and data.get("rowsPlanned") == 114
             and public_integer(data.get("rowsUpserted")) == 0 and public_integer(data.get("rowsDeleted")) == 0
             and data.get("writeOutcome") == "not_attempted" and bool(hash_valid)
             and result["warningsCount"] == 0)
    result["scopeChecksPassed"] = bool(valid)
    result["result"] = "Fresh fixed-scope inspection passed. No write submitted; terminal confirmation required." if valid else "Scope or response mismatch; stop."
    return result, bool(valid)


def sanitize_write(payload, status, expected_scope_hash):
    """Allowlist public acknowledgement/audit facts; never print raw response or headers."""
    result = {"httpStatus": status, "guardedWriteRequest": True, "approvedScopeHash": expected_scope_hash,
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
        "scopeHashMatchesInspection": scope.get("scopeHash") == expected_scope_hash,
        "warningsCount": len(data["warnings"]) if isinstance(data.get("warnings"), list) else None,
    })
    schedule_ack = (200 <= status < 300 and data.get("dryRun") is False and result["boundedModeMatches"]
                    and result["gameKeyMatches"] and result["yahooSeasonMatches"] and result["sourceSeasonMatches"]
                    and range_valid and approved_ids and scope.get("seasonId") == 20262027
                    and scope.get("maxSides") == 114 and scope.get("sides") == 114
                    and data.get("rowsPlanned") == 114 and data.get("rowsUpserted") == 114
                    and public_integer(data.get("rowsDeleted")) == 0 and outcome == "acknowledged"
                    and scope.get("scopeHash") == expected_scope_hash)
    if schedule_ack:
        result["acknowledgement"] = "SCHEDULE_ACKNOWLEDGED"
        result["result"] = "Schedule acknowledged; exact database readback and audit verification still required."
    else:
        result["result"] = "Scope or acknowledgement mismatch. Stop for exact database/audit readback."
    audit_ok = result.get("finalAudit", {}).get("status") == "persisted"
    if schedule_ack and not audit_ok:
        result["result"] = "Schedule acknowledged but audit failed/missing. Do not replay; inspect database/audit."
    return result, bool(schedule_ack and audit_ok)


def request_once(query, config, writing):
    """One request; never expose transport output or retry either phase."""
    command = ["/usr/bin/curl", "--disable", "--silent", "--proto", "=https", "--tlsv1.2",
               "--request", "POST", "--data", "", "--header", "Accept: application/json",
               "--connect-timeout", "10", "--max-time", "245", "--retry", "0",
               "--max-filesize", "262144", "--write-out", "\n%{http_code}",
               "--config", "-", ENDPOINT + "?" + urlencode(query)]
    try:
        response = subprocess.run(command, input=config, capture_output=True, text=True,
                                  timeout=250, check=False)
    except (OSError, subprocess.TimeoutExpired, KeyboardInterrupt, UnicodeError):
        response = None
    if response is None or response.returncode != 0:
        print(json.dumps({"guardedWriteRequest": writing, "automaticRetry": False,
                          "acknowledgement": "UNKNOWN" if writing else "NO_WRITE_SUBMITTED",
                          "databaseReadbackRequired": writing,
                          "result": "Transport failed; raw output suppressed. Stop without retry."
                          + (" Exact database/audit readback required." if writing else " No write submitted.")}, indent=2))
        return None, 0, False
    body, separator, raw_status = response.stdout.rpartition("\n")
    status = int(raw_status) if separator and re.fullmatch(r"\d{3}", raw_status) else 0
    try:
        payload = json.loads(body)
    except (ValueError, TypeError):
        payload = None
    return payload, status, True


def main():
    if len(sys.argv) != 1 or not sys.stdin.isatty():
        print("Run without arguments in a private interactive terminal; never pipe credentials.")
        return 2
    print("ONE fixed-scope inspection, then explicit confirmation before ONE guarded write.")
    print("Game477/Yahoo2026/NHL20262027; Oct11–19; games2026020084–2026020140;57games/114sides.")
    print("At most114schedule upserts plus one audit; no deletions, redirects or retries.")
    try:
        confirmed = input("Confirm PUBLIC database URL (no key/token): ").strip().rstrip("/")
        if confirmed != DATABASE_URL:
            print("Destination mismatch. No request made.")
            return 2
        with warnings.catch_warnings(), open("/dev/tty", "w") as terminal:
            warnings.simplefilter("error", getpass.GetPassWarning)
            bearer = getpass.getpass("Existing private admin/cron bearer (hidden): ", stream=terminal)
    except (OSError, EOFError, KeyboardInterrupt, getpass.GetPassWarning):
        print("Cancelled/no private terminal. No request made.")
        return 2
    if not bearer or not re.fullmatch(r"[A-Za-z0-9._~+/=-]+", bearer):
        print("Invalid bearer format. No request made; value suppressed.")
        return 2
    config = 'header = "Authorization: Bearer ' + bearer + '"\n'
    bearer = None
    try:
        payload, status, received = request_once(QUERY, config, False)
        if not received:
            return 1
        inspected, valid = sanitize_inspection(payload, status)
        print(json.dumps(inspected, indent=2))
        if not valid:
            print("Inspection mismatch. STOP; no write submitted.")
            return 1
        expected_hash = inspected["scopeHash"]
        phrase = "WRITE 114 " + expected_hash[:12]
        deadline = time.monotonic() + 120
        print("Review the sanitized scope above. Confirmation expires after120seconds.")
        try:
            answer = input("To submit ONE hash-bound write, type " + phrase + ": ")
        except (EOFError, KeyboardInterrupt):
            print("Cancelled. No write submitted.")
            return 2
        if answer != phrase or time.monotonic() > deadline:
            print("Confirmation missing/expired. No write submitted. Stop; no automatic reinspection.")
            return 2
        write_query = {**QUERY, "dryRun": "false", "expectedScopeHash": expected_hash}
        payload, status, received = request_once(write_query, config, True)
        if not received:
            return 1
        result, valid = sanitize_write(payload, status, expected_hash)
        print(json.dumps(result, indent=2))
        return 0 if valid else 1
    finally:
        config = None


if __name__ == "__main__":
    raise SystemExit(main())

