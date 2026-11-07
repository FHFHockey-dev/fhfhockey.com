#!/usr/bin/env python3
"""Layer 3 of the FHFH X intake safety net: twscrape with a burner account, on GitHub Actions every 15 minutes.

Design: tasks/artifacts/x-intake-safety-net-design-2026-11-06.md. The workflow is
.github/workflows/x-twscrape-fallback.yml. Each run:

1. builds a fresh twscrape account pool from the X_BURNER_COOKIES secret (a runner starts empty every time);
2. asks the x-timeline-ingest edge function for each account's anchor: the newest timeline id already observed;
3. reads each account's timeline with twscrape, paging back (40 posts a page) until a page overlaps the anchor;
4. posts what it read to the edge function.

Modes (X_FALLBACK_MODE):
- shadow (the default): every tracked account, every run, posted with mode "observe". The edge function writes only
  x_timeline_twscrape_observations, never the shadow posts, the line queues or social_share_x_posts.
- live (not used yet): mode "ingest" for the accounts switched to the scraper. The edge function refuses it until
  X_TIMELINE_INGEST_LIVE is set there.

The run fails (exit 1, a red job) when any account's read, any post to the edge function, or any page-back fails.

The repository is public, so the job's logs are public: this script prints only event names, source keys, counts,
X post ids and error class names. It never prints cookies, secrets, request bodies or responses.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

# The tracked accounts (POLLED_ACCOUNTS in supabase/functions/x-timeline-poll/fxtwitter.ts) and their public X user
# ids, from FxTwitter's author.id in x_timeline_shadow_posts (2026-11-07). Committing them saves a UserByScreenName
# request per account per run.
ACCOUNTS = {
    "dfofantasy": ("DFOFantasy", 70896608),
    "nhl_rosters": ("NHL_Rosters", 2606458386),
    "ccc": ("CcCMiddleton", 825802740362121216),
    "gamedaylines": ("GameDayLines", 1032067680361177089),
    "gamedaynewsnhl": ("GameDayNewsNHL", 1427348155687964678),
    "gamedaygoalies": ("GameDayGoalies", 1428385008444710913),
    "fhfhockey": ("FHFHockey", 855606126410432512),
}
MAX_PAGES = 5  # 200 posts at most per account per run: well past a few dropped 15-minute runs, inside X's limits.
CHUNK = 50  # Tweets per request to the edge function (it takes at most 100 and 2 MB).
POOL_LABEL = "burner"  # twscrape's key for the account; any label works with cookie login.


def log(event: str, **fields) -> None:
    print(json.dumps({"event": event, **fields}), flush=True)


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
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        return 0, {"error": type(error).__name__}


def reached_overlap(page_ids: list[int], anchor: int | None, page_number: int) -> bool:
    """True once a page reaches the anchor. Page 1 may lead with an old pinned post, so it needs two posts at or
    below the anchor; a later page needs one. Without an anchor (the first run) page 1 is enough."""
    if anchor is None:
        return True
    at_or_below = sum(1 for post_id in page_ids if post_id <= anchor)
    return at_or_below >= (2 if page_number == 1 else 1)


async def read_account(api, user_id: int, anchor: int | None) -> tuple[list[dict], int, bool]:
    """The account's posts back to the anchor: (tweets as JSON, pages read, overlap reached)."""
    from contextlib import aclosing

    from twscrape.models import parse_tweets

    seen: dict[int, dict] = {}
    pages, overlap = 0, False
    async with aclosing(api.user_tweets_raw(user_id)) as raw_pages:
        async for response in raw_pages:
            pages += 1
            page = list(parse_tweets(response))
            for tweet in page:
                # Tweet.json() is json.dumps(asdict(tweet), default=str): datetimes become "2026-11-06 19:06:38+00:00".
                seen.setdefault(tweet.id, json.loads(tweet.json()))
            # tweet.id is the timeline entry's id: for a repost, the wrapper's (the repost time).
            if reached_overlap([tweet.id for tweet in page], anchor, pages):
                overlap = True
                break
            if pages >= MAX_PAGES:
                break
    return list(seen.values()), pages, overlap


async def build_api(cookies: str):
    os.environ.setdefault("TWS_TELEMETRY", "0")  # twscrape's PostHog usage telemetry: off.
    from twscrape import API, set_log_level

    set_log_level("WARNING")
    db_file = str(Path(tempfile.mkdtemp(prefix="twscrape-")) / "accounts.db")
    # raise_when_no_account: fail fast when the burner is locked or rate limited, instead of waiting for a reset.
    api = API(db_file, raise_when_no_account=True)
    await api.pool.add_account_cookies(POOL_LABEL, cookies)
    return api


async def main() -> int:
    url, secret = os.environ.get("X_INGEST_URL"), os.environ.get("X_INGEST_SECRET")
    cookies = os.environ.get("X_BURNER_COOKIES", "")
    mode = os.environ.get("X_FALLBACK_MODE", "shadow")
    run_id = os.environ.get("X_RUN_ID") or "local"
    missing = [name for name, value in
               (("X_INGEST_URL", url), ("X_INGEST_SECRET", secret), ("X_BURNER_COOKIES", cookies)) if not value]
    if missing:
        log("config_missing", need=missing)
        return 2
    if mode not in ("shadow", "live"):
        log("config_invalid", field="X_FALLBACK_MODE")
        return 2

    status, result = post(url, secret, {"mode": "anchors"})
    if status != 200 or not result.get("ok"):
        log("anchors_failed", status=status, error=result.get("error"))
        return 1
    anchors = {key: int(value) for key, value in (result.get("anchors") or {}).items()
               if key in ACCOUNTS and isinstance(value, str) and value.isdigit()}

    keys = list(ACCOUNTS)
    if mode == "live":
        status, health = post(url, secret, {"mode": "health"})
        if status != 200 or not health.get("ok"):
            log("health_failed", status=status)
            return 1
        # The job runs only every 15 minutes, so every switched account is read every run (takeover and cross-check).
        keys = [item["sourceKey"] for item in health.get("accounts", [])
                if item.get("sourceKey") in ACCOUNTS and item.get("switched")]
        if not keys:
            log("idle")
            return 0

    try:
        api = await build_api(cookies)
    except Exception as error:  # A malformed cookie secret; the message is not printed, it could quote the value.
        log("cookies_invalid", error=type(error).__name__)
        return 1

    failures: list[str] = []
    for source_key in keys:
        _, user_id = ACCOUNTS[source_key]
        anchor = anchors.get(source_key)
        try:
            tweets, pages, overlap = await read_account(api, user_id, anchor)
        except Exception as error:  # Locked, banned, rate limited or a parse failure: report it and go on.
            failures.append(source_key)
            log("read_failed", sourceKey=source_key, error=type(error).__name__)
            continue
        ids = sorted(int(tweet["id"]) for tweet in tweets if str(tweet.get("id", "")).isdigit())
        inserted, mapped, post_failed = 0, 0, False
        for start in range(0, len(tweets), CHUNK):
            chunk = tweets[start:start + CHUNK]
            payload = ({"mode": "observe", "sourceKey": source_key, "runId": run_id, "tweets": chunk}
                       if mode == "shadow" else {"mode": "ingest", "sourceKey": source_key, "tweets": chunk})
            status, result = post(url, secret, payload)
            # Only 200 with ok is success: live ingest answers 207 when the store or the enqueue failed.
            if status != 200 or not result.get("ok"):
                post_failed = True
                log("post_failed", sourceKey=source_key, status=status, error=result.get("error"),
                    enqueueError=result.get("enqueueError"))
                continue
            inserted += result.get("inserted") or 0
            mapped += result.get("mapped") or result.get("seen") or 0
        gap = anchor is not None and not overlap
        if gap:
            log("gap_unrecovered", sourceKey=source_key, pages=pages, anchor=str(anchor))
        if post_failed or gap:
            failures.append(source_key)
        log("read", sourceKey=source_key, mode=mode, pages=pages, read=len(tweets), mapped=mapped, inserted=inserted,
            overlap=overlap, anchor=str(anchor) if anchor else None, newest=str(ids[-1]) if ids else None)

    log("done", mode=mode, accounts=len(keys), failed=failures)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
