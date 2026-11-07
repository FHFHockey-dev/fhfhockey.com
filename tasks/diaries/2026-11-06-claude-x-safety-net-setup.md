# 2026-11-06 claude — X intake safety net: guided setup with TJ

## Scope
Walk TJ through `tasks/artifacts/x-intake-safety-net-walkthroughs-2026-11-06.md` one step at a time:
Part A (FxEmbed mirror on Cloudflare Workers), Part B (twscrape + burner on the Pi). TJ handles every account,
cookie and secret; Claude never sees them. Production steps only after a pop-up approval, recorded below.
Started by session local_c3bcbbcc. Chef (local_1fb55d9b) owns `supabase/functions/x-timeline-poll/*`.

## Where
- `octoberBranch` (shared checkout). Nothing committed; no branch switch; no push; no Vercel builds.
- Code under setup (uncommitted, from the x-safety-net session): `supabase/functions/_shared/*`,
  `supabase/functions/x-timeline-ingest/*`, `tools/x-twscrape-fallback/*`.
- Poller v6 patch: `…/side-session-notes/local_1fb55d9b…/x-safety-net/index.ts.proposed` (Chef applies first).

## Progress
- [x] A1 Cloudflare account (TJ). Subdomain auto-registered on first deploy: `timbranson515.workers.dev`.
- [x] A2–A6 (TJ chose "you run it"): cloned FxEmbed 26b995e3 to `~/Code/fxembed-mirror`, `npm ci` OK on Node 22.11
  (no nvm; EBADENGINE warnings only), wrangler.toml name `fhfh-fx`, account_id removed (single account, auto),
  analytics block removed; `.env` API_HOST_LIST = `fhfh-fx.timbranson515.workers.dev`. TJ did `wrangler login`
  (terminal tab c1). Deployed twice; live version 5c0726ea. `https://fhfh-fx.timbranson515.workers.dev/` → 301 JSON.
- Chef has applied poller v6 locally (`x-timeline-poll/index.ts` and `supabase/config.toml` modified, uncommitted).
- [x] A7 mirror probe — APPROVED by TJ pop-up ~20:15 UTC ("Run the probe"). Ran 20 GETs, 3 s apart, + 1 extra
  diagnostic GET (GameDayLines), so 21 in total; disclosed to TJ. Result: **20/20 HTTP 200 but guest mode FAILS on freshness.**
  Feeds come back in non-chronological "top" order, years old (GameDayLines 2019–2024). Newest post per account from the mirror vs
  the stored `x_timeline_shadow_posts` max(tweet_created_at), all 7 posted today: DFO 17:52 vs 19:20; NHL_Rosters 10-27 vs
  11-06 20:03; CcC 10-12 vs 11-06 19:16; the others are older. **Do NOT set FXTWITTER_MIRROR_BASE with a guest-mode
  mirror:** the chain would treat a stale 200 as a good read and store years-old posts as new rows.
  **TJ decided (pop-up): "Layer 3 only".** The mirror stays deployed but unused; FXTWITTER_MIRROR_BASE is NOT set
  (step A8 secret skipped). Poller v6 without the secret = v5 + gap recovery; its deploy is still a separate approval.
  Follow-up idea: a freshness guard in `fetchFxChain`/the poller (reject feeds with no post newer than X), needed
  before any mirror is ever wired in.
- [x] A8 secret FXTWITTER_MIRROR_BASE: SKIPPED (TJ chose "Layer 3 only"); not set.
- [x] Poller v6: TJ chose "Deploy v6 now". When I checked, **production already ran v6** (x-timeline-poll version 6,
  deployed 19:58:55 UTC by another session; source identical to the local `index.ts` = `index.ts.proposed`). I did
  NOT deploy. Deno download for a check was blocked (auto-mode classifier; TJ answered "no preference"). Substitute
  check: Vitest `xIntakeSafetyNet` 24/24. Health over the last 60 min (to 23:40 UTC): 29 runs, 16 fully ok, 181/203 reads
  ok, all `via: public`, 22 misses (public FxTwitter flakiness), gap `none` 203/203. No mirror in use.
- [~] B1 burner `@shadowBurnPi` made by TJ (no cookies copied). Pi = **Raspberry Pi 1 Model B** (2011.12), no Wi-Fi,
  no Ethernet possible → **TJ parked layer 3 in `tasks/DO-LATER.md`** (pop-up: "Skip layer 3 for now").
  Mac setup done for later: Raspberry Pi Imager 2.0.12 (brew cask, approved); `~/.ssh/id_ed25519` (approved).
- [ ] B2–B8 and B6 (setup.sql, Vault secret, x-timeline-ingest deploy): NOT done; parked.

## Approvals log (all by AskUserQuestion pop-up, 2026-11-06)
- Mirror probe (20 reads): approved; ran 21 (1 extra diagnostic, disclosed).
- Layer 2 decision: "Layer 3 only" (mirror unused, secret never set).
- Imager install + SSH key: approved.
- Layer 3: "Skip for now, park in DO LATER".
- Poller v6 deploy: approved, but already live; no deploy by this session.
- Not done, never approved: FXTWITTER_MIRROR_BASE, setup.sql, Vault x_timeline_ingest_secret, x-timeline-ingest deploy.

## State at hand-off
Retire this diary only once layer 3 resumes and the outcome is recorded. Parked items are in `tasks/DO-LATER.md`.

## Insights / gotchas
- FxEmbed `npm run deploy` = `wrangler deploy --no-bundle`; wrangler.toml `[build] command = "npm run build"`
  runs the esbuild first, which bakes `.env` in. So `.env` (API_HOST_LIST) must be edited before deploy, and any
  `.env` change needs a redeploy.
- zsh: `echo =====` fails (`=` expansion); use `echo '-----'`.
