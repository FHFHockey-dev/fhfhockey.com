# x-twscrape-fallback

Layer 3 of the FHFH X intake safety net: twscrape with a burner account, run on TJ's Raspberry Pi every 4 minutes by
systemd. It reads X only while the poller (public FxTwitter, then the self-hosted mirror) has had no good read of a
switched account for 6 minutes, and posts the tweets to the `x-timeline-ingest` edge function.

- Design: `tasks/artifacts/x-intake-safety-net-design-2026-11-06.md`
- Setup, step by step: `tasks/artifacts/x-intake-safety-net-walkthroughs-2026-11-06.md` (part B)

Files: `fallback.py` (stdlib + twscrape), `requirements.txt`, `.env.example`, the systemd `.service` and `.timer`.
`.env`, `accounts.db` (the burner's cookies) and `user_ids.json` stay on the Pi and are git-ignored.
