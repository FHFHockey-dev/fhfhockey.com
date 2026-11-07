# DO LATER

Parked by TJ. These are not approved to start. Each one waits until TJ picks it up again.

## X intake safety net, layer 3 (twscrape + burner on an always-on home machine) — parked 2026-11-06

**Why parked:** TJ's Pi is an original Raspberry Pi 1 Model B (board says "Raspberry Pi (c) 2011.12"). It has no Wi-Fi,
and Ethernet isn't possible where it sits.

**State:**
- The burner X account `@shadowBurnPi` exists, made by TJ. Its cookies have not been copied anywhere.
- The code is built locally and uncommitted: `tools/x-twscrape-fallback/*`, `supabase/functions/x-timeline-ingest/*`,
  `supabase/functions/_shared/*`, and the `[functions.x-timeline-ingest]` entry in `supabase/config.toml`.
- Nothing has been applied or deployed: `setup.sql`, the Vault secret `x_timeline_ingest_secret` and `x-timeline-ingest` are all still pending.
- The Mac has Raspberry Pi Imager and an SSH key (`~/.ssh/id_ed25519`, made for the Pi).

**To resume, pick a host:**
- a USB Wi-Fi dongle for the Pi 1 (about $10, e.g. Edimax EW-7811Un; flash Raspberry Pi OS Lite **32-bit**; piwheels
  has armv6l wheels for curl-cffi);
- or a Pi Zero 2 W (about $30 with PSU and card; walkthrough as written);
- or this Mac via launchd (runs only while it's awake; needs a plist).

Then follow `tasks/artifacts/x-intake-safety-net-walkthroughs-2026-11-06.md` Part B, from step 3. Context is in
`tasks/diaries/2026-11-06-claude-x-safety-net-setup.md`.

## X intake safety net, layer 2 (FxEmbed mirror) — unused, 2026-11-06

`https://fhfh-fx.timbranson515.workers.dev` (code in `~/Code/fxembed-mirror`) is deployed and answers. Without an X
login, though, it returns old "top" posts, not the latest ones. **Never set `FXTWITTER_MIRROR_BASE` to it in guest mode.**
Wiring in any mirror first needs (1) a burner's credentials in FxEmbed, preferably a second burner, and (2) a
freshness guard in the poller's fetch chain.
