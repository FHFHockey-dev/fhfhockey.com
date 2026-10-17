#!/usr/bin/env python3
"""User-run, one-shot read-only inspection. Never imports credentials or writes files."""

import getpass
import json
import re
import subprocess
import sys
import warnings
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


def sanitize(payload, status):
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
             and data.get("rowsUpserted") == 0 and data.get("rowsDeleted") == 0
             and data.get("writeOutcome") == "not_attempted" and bool(hash_valid))
    result["scopeChecksPassed"] = bool(valid)
    result["result"] = "Inspection ready for separate review; no write was submitted." if valid else "Scope or response mismatch; stop."
    return result, bool(valid)


def main():
    if len(sys.argv) != 1:
        print("Run without arguments. Never supply a credential on the command line.", file=sys.stderr)
        return 2
    if not sys.stdin.isatty():
        print("An interactive private terminal is required; do not pipe credentials.", file=sys.stderr)
        return 2
    print("One read-only production inspection; no write fallback, retry, redirect or credential file.")
    print("First privately verify the deployed NEXT_PUBLIC_SUPABASE_URL in your existing operator configuration.")
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
    except (OSError, subprocess.TimeoutExpired, KeyboardInterrupt):
        print(json.dumps({"inspectionOnly": True, "result": "Transport failed or timed out; no write submitted. Do not retry automatically."}, indent=2))
        return 1
    finally:
        bearer = None
        config = None
    if response.returncode != 0:
        print(json.dumps({"inspectionOnly": True, "curlExit": response.returncode,
                          "result": "Transport failed; raw body/stderr/headers suppressed. No write submitted."}, indent=2))
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
