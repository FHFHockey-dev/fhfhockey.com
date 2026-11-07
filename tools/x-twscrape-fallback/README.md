# x-twscrape-fallback

Layer 3 of the FHFH X intake safety net: twscrape with the burner account, run by GitHub Actions every 15 minutes
(`.github/workflows/x-twscrape-fallback.yml`, cron `7,22,37,52 * * * *`). It reads the 7 tracked accounts and posts
what it reads to the `x-timeline-ingest` edge function.

**Shadow mode (now).** The edge function's `observe` mode writes only `x_timeline_twscrape_observations`, never
`x_timeline_shadow_posts`, the line queues or `social_share_x_posts`. Live `ingest` is refused there until the function
secret `X_TIMELINE_INGEST_LIVE=1` is set. `compare.sql` compares the observations with Layer 1 (FxTwitter).

- Design: `tasks/artifacts/x-intake-safety-net-design-2026-11-06.md`. SQL: `supabase/functions/x-timeline-ingest/setup.sql`.
- Each run rebuilds the twscrape pool from the `X_BURNER_COOKIES` repository secret (a runner starts empty). The
  accounts' X user ids are public and committed in `fallback.py`.
- Each account is read back to an overlap with its anchor (the newest observed timeline id), up to 5 pages of 40.
- The job turns red when any account's read, any post to the edge function, or any page-back fails.
- The repository is public, so the logs are: the script prints counts, X post ids and error class names only.

Repository secrets (Settings → Secrets and variables → Actions):
- `X_INGEST_SECRET`: the value of Vault secret `x_timeline_ingest_secret`.
- `X_BURNER_COOKIES`: the burner's X cookies, at least `auth_token` and `ct0`, as a Cookie header
  (`auth_token=…; ct0=…`) or a browser-extension JSON export.

Local check without X or the network: `python3 -m unittest -v test_fallback` in this folder.

The earlier Raspberry Pi setup (systemd timer, `.env`, `accounts.db`) is parked (`tasks/DO-LATER.md`); its files are in
git history at `ff5159adb`.
