# 2026-11-06 claude — X intake safety net (fallback for the FxTwitter poller)

## Scope
Automatic fallback when the FxTwitter poller (`x-timeline-poll`) fails, hand-back on recovery, and a fallback for the
fallback. Side session of Chef (local_1fb55d9b). Chef owns `supabase/functions/x-timeline-poll/*` and the watchdog —
not edited; patch + hand-over in the shared notes folder `…/side-session-notes/local_1fb55d9b…/x-safety-net/`.

## Decisions (TJ pop-ups)
- v1 (IFTTT hot standby, per-post) REJECTED: "completely remove reliance on IFTTT".
- v2 APPROVED: L1 public FxTwitter → L2 self-hosted FxEmbed mirror (Cloudflare) per request → L3 twscrape + burner on
  TJ's **Raspberry Pi** (not Mac). Gap recovery via cursor paging. TJ wants step-by-step walkthroughs (another thread
  or Chef to walk him through).

## Where
- `octoberBranch`, HEAD 7e7e3dfd2 at start. Nothing committed.
- Design: `tasks/artifacts/x-intake-safety-net-design-2026-11-06.md`; walkthroughs `…-walkthroughs-2026-11-06.md`.
- New: `supabase/functions/_shared/{fxSources,fxGapRecovery,twscrapeStatus,xTimelineStore,xTimelineIngestRequest}.ts`,
  `supabase/functions/x-timeline-ingest/{index.ts,setup.sql}`, `tools/x-twscrape-fallback/*`,
  `web/__tests__/lib/xIntakeSafetyNet.test.ts`.

## Checks
- Vitest (env -u GIT_DIR): xIntakeSafetyNet 22/22, xTimelineFxtwitter 15/15. `npm run typecheck` exit 0. eslint test
  file exit 0. py_compile OK. Deno-shim tsc of proposed poller + ingest exit 0 (not real deno check).
- Live read-only: chain + gap recovery on DFO, 3 requests, cursor paging OK.

## Next / pending approvals
1. Chef applies `index.ts.proposed` (or tells me to).
2. TJ: Cloudflare account + FxEmbed deploy (walkthrough A) → mirror probe (~20 reads) → secret FXTWITTER_MIRROR_BASE →
   deploy poller v6.
3. setup.sql → migration + authority row; Vault `x_timeline_ingest_secret`; deploy `x-timeline-ingest`
   (verify_jwt=false; config.toml entry is Chef's); Pi setup (walkthrough B, TJ handles burner + cookies + secret).

## Insights / gotchas
- No free no-login alternative exists: syndication returns stale "top" posts; nitter.net 410; xcancel 451; vxtwitter
  CF challenge; FxTwitter search 0/10 when profile 2/10. Self-hosted FxEmbed: credentials optional ("lower rate limits").
- Web tsc rejects `.ts` import paths (TS5097) and Deno needs them → shared modules must be import-free (inject deps).
- A new file in supabase/migrations breaks `supportedBaselineMigration.test.ts` counts → SQL drafted beside the function.
- Vitest default env is jsdom; fetch-chain tests need `// @vitest-environment node` (AbortSignal.timeout).

## Update (after Chef's scope note)
- Chef relayed "fallback = one scraper from the five-repo list, least friction, not always-on". Put to TJ by pop-up:
  he kept **twscrape on the Raspberry Pi** (declined the GitHub Actions dispatch option) and **kept the FxEmbed mirror**.
  TJ has never used a Pi and it is not set up → added walkthrough part B0 (Imager, headless SSH, first boot).
- Told Chef; offered to switch the health RPC to read `x_timeline_alert_state` if Chef adds a 6-minute alert key.
- Chef review fix: recoverGap stops at the first stored row on a page (no older rows); a failed page/lookup or exhausted
  per-run page budget (6/run, 0 past half the 100 s budget) → "deferred" = store nothing (else the gap hides itself).
  Tests 24/24 + 15/15, typecheck exit 0, eslint 0, shim tsc 0. Health RPC header has the exact takeover rule.
- Chef 2nd review: deferral unbounded → removed "deferred" entirely; failures/budget → "abandoned" (store page 1 + what
  was recovered, report). Chef's 6-min newest-first_seen clock would abandon on the first try after any real outage, so
  not used. GAP_PAGES_PER_RUN 16 + half-budget gate. Tests 24/24 + 15/15, typecheck 0, eslint 0, shim tsc 0.
- Chef deployed poller v6 (~19:59 UTC, index.ts 7b02bf69…). New mode: stale feed (CCC stuck at 19:16 while the 19:42
  goalie post exists; not URL cache, not a reply). TJ pop-up: Pi cross-check every 15 min for switched accounts
  (`crossCheck` in x_timeline_account_health; fallback.py reads due ∪ crossCheck, max 7/run). Watchdog signal:
  shadow rows with raw_payload->>'provider'='twscrape' while the poller is ok for that account.
