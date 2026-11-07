#!/usr/bin/env python3
"""Layer 3 of the FHFH X intake safety net: twscrape with a burner account, on TJ's Raspberry Pi.

Design: tasks/artifacts/x-intake-safety-net-design-2026-11-06.md. A systemd timer runs this every 4 minutes. Each run:

1. asks the x-timeline-ingest edge function which accounts to read: those switched to the scraper with no good poller
   read (public FxTwitter or the self-hosted mirror) for 6 minutes ("due", a takeover), and, once every 15 minutes,
   every switched account ("crossCheck"), because a feed can answer normally and still be stale;
2. if there are none, exits at once without touching X;
3. otherwise reads each due account's latest 20 posts with twscrape and posts them to the edge function, which maps
   them with the poller's own code. Duplicates are ignored there, so re-sending posts is harmless.

Config comes from .env beside this file (see .env.example). The burner's cookies live only in accounts.db, added by TJ
with `twscrape add_cookie` (README.md). This script never reads, prints or sends them anywhere but X.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
HANDLES = {
    "dfofantasy": "DFOFantasy",
    "nhl_rosters": "NHL_Rosters",
    "ccc": "CcCMiddleton",
    "gamedaylines": "GameDayLines",
    "gamedaynewsnhl": "GameDayNewsNHL",
    "gamedaygoalies": "GameDayGoalies",
    "fhfhockey": "FHFHockey",
}
MAX_ACCOUNTS_PER_RUN = 7  # At most 7 UserTweets requests a run (one per tracked account), far below X's per-account limits.


def load_env() -> dict[str, str]:
    values: dict[str, str] = {}
    env_file = HERE / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                values[key.strip()] = value.strip().strip('"').strip("'")
    values.update({key: value for key, value in os.environ.items() if key.startswith("X_")})
    return values


def post(url: str, secret: str, payload: dict, timeout: int = 45) -> tuple[int, dict]:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        method="POST",
        headers={"Content-Type": "application/json", "x-fhfh-ingest-secret": secret,
                 "User-Agent": "fhfhockey-twscrape-fallback"},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as error:
        try:
            return error.code, json.loads(error.read() or b"{}")
        except ValueError:
            return error.code, {}


def log(event: str, **fields) -> None:
    print(json.dumps({"event": event, **fields}), flush=True)


async def read_account(api, handle: str, ids: dict[str, int]) -> list[dict]:
    from twscrape import gather

    user_id = ids.get(handle)
    if user_id is None:
        user = await api.user_by_login(handle)
        if user is None:
            raise RuntimeError(f"user_by_login returned nothing for {handle}")
        user_id = ids[handle] = user.id
    tweets = await gather(api.user_tweets(user_id, limit=20))
    # Tweet.json() is json.dumps(asdict(tweet), default=str): datetimes become "2026-11-06 19:06:38+00:00".
    return [json.loads(tweet.json()) for tweet in tweets][:100]


async def main() -> int:
    env = load_env()
    url, secret = env.get("X_INGEST_URL"), env.get("X_INGEST_SECRET")
    if not url or not secret:
        log("config_missing", need=["X_INGEST_URL", "X_INGEST_SECRET"])
        return 2

    forced = [key for key in env.get("X_FALLBACK_FORCE", "").split(",") if key in HANDLES]
    reason: dict[str, str] = {}
    if forced:
        due = forced
    else:
        status, health = post(url, secret, {"mode": "health"})
        if status != 200 or not health.get("ok"):
            log("health_failed", status=status)
            return 1
        accounts = [item for item in health.get("accounts", []) if item.get("sourceKey") in HANDLES]
        due = [item["sourceKey"] for item in accounts if item.get("due")]
        due += [item["sourceKey"] for item in accounts if item.get("crossCheck") and item["sourceKey"] not in due]
        reason = {item["sourceKey"]: "takeover" if item.get("due") else "cross_check" for item in accounts}
    if not due:
        log("idle")
        return 0

    from twscrape import API

    api = API(str(HERE / "accounts.db"), raise_when_no_account=False)
    ids_file = HERE / "user_ids.json"
    ids: dict[str, int] = json.loads(ids_file.read_text()) if ids_file.exists() else {}
    failures = 0
    for source_key in due[:MAX_ACCOUNTS_PER_RUN]:
        handle = HANDLES[source_key]
        try:
            tweets = await read_account(api, handle, ids)
        except Exception as error:  # twscrape raises on locked or missing accounts; keep going with the others.
            failures += 1
            log("read_failed", sourceKey=source_key, error=type(error).__name__)
            continue
        status, result = post(url, secret, {"mode": "ingest", "sourceKey": source_key, "tweets": tweets})
        if status not in (200, 207):
            failures += 1
        log("ingested", sourceKey=source_key, reason=reason.get(source_key, "forced"), status=status, read=len(tweets),
            inserted=result.get("inserted"), enqueued=result.get("enqueued"), error=result.get("error"))
    ids_file.write_text(json.dumps(ids))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
