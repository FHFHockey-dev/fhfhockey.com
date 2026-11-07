# X intake safety net: design v2 (2026-11-06)

**For:** TJ.
**Status:** v2 **approved by TJ (pop-up, 2026-11-06)**, with layer 3 = **twscrape on a Raspberry Pi**. Built locally (uncommitted). Nothing is applied or deployed. Setup steps: `x-intake-safety-net-walkthroughs-2026-11-06.md`.

**Your decisions so far (pop-up, 2026-11-06):**
- **No IFTTT hot standby.** The goal is to remove IFTTT completely.
- **Layer 2 is a self-hosted FxEmbed.**
- **Layer 3 is twscrape with a burner account, on a Raspberry Pi** (not the Mac). TJ wants step-by-step walkthroughs for both setups.

**Context:** the FxTwitter poller `x-timeline-poll` feeds the live queue for accounts switched to `fxtwitter` (`nhl_rosters` since 18:50 UTC). FxTwitter has no SLA. **When probed at 19:15 UTC, public FxTwitter answered only 2 of 10 profile requests and 0 of 10 search requests.**

## 1. What I checked

| Option | Login needed? | Free? | Result |
|---|---|---|---|
| twscrape (vladkens) | **Yes**, `auth_token` + `ct0` cookies | Yes | `user_tweets` works. Python. Needs a burner account. |
| Scweet (Altimis) | **Yes**, an `auth_token` cookie (no password login) | Yes; its Apify version is paid | Python, built on X's GraphQL. Same burner problem. |
| x-timeline-scraper (StephanAkkerman) | **Yes** | Yes | Reads only your own Home feed. Not usable. |
| data-scrape/x-tweet-scraper | Not stated | — | A generic README plus a sponsored ad. Not credible. |
| Xquik | API key | **No**, from a $10 top-up | Excluded. |
| **Self-hosted FxEmbed** | Optional. It "works best" with X credentials; without them it has "lower rate limits". | Yes: Cloudflare Workers free plan, 100k requests/day | MIT. **Same API as the poller.** Untested: profile feeds without credentials. |
| X syndication timeline | No | Yes | **Dead end:** it returns old "top" posts. The newest was from 2026-10-22. |
| Nitter, xcancel RSS, vxtwitter | No | Yes | **Dead ends:** 410 Gone; 451 suspended; Cloudflare challenge. |
| FxTwitter `/2/search?q=from:` | No | Yes | **0 of 10** at 19:15 while the profile feed managed 2 of 10. It fails along with the profile feed, so it is no independent fallback. |

**Hosts for a Python tool (only twscrape needs one):**
- **TJ's Mac (launchd):** residential IP, so the lowest risk of the account being locked. It stops when the Mac sleeps.
- **GitHub Actions:** free, since the repo is public. But runs are at least 5 minutes apart, often 5–30 minutes late, and come from datacenter IPs, which raise the lock risk.
- **Free VMs and PaaS:** datacenter IPs too, and free tiers that sleep.

## 2. The layers

| # | Source | Where it runs | Login | Takes over | Hands back |
|---|---|---|---|---|---|
| 1 | Public FxTwitter `api.fxtwitter.com` | the existing poller (Supabase Edge, every 2 minutes) | none | — | — |
| 2 | **Self-hosted FxEmbed mirror** | Cloudflare Worker, free; the same poller calls it | none (guest) at first | **per request:** as soon as the public API misses an account in a run | **per request:** every run tries the public API first again |
| 3 | **twscrape + burner** | TJ's Raspberry Pi (systemd timer, every 4 minutes) | burner cookies | when layers 1 and 2 both have had no good read of an account for 6 minutes | as soon as layer 1 or 2 reads it again |
| — | **Gap recovery** (not a source) | the poller | none | after any outage | — |

### 2.1 Layer 2 rule (stateless, per account per run)

1. The public API gets **1 attempt**.
2. If it misses, the mirror gets **up to 3**.
3. If the mirror also fails, the public API gets 1 more attempt.

The wrapper-repost lookup (`/2/status/{id}`) uses the same chain.

- **No duplicates are possible.** Both sources run the same code and return the same ids. The shadow table's `(source_key, tweet_id)` key and the queue's unique keys already deduplicate.
- **No state, so no flapping.** Each run's result records `via: "public" | "mirror"` per account, so the watchdog can see which source served it.
- **Load:** at most about 7 × 3 × 720 ≈ 15,000 mirror requests a day, against the free plan's 100,000. The public API's own limit is 1,000 a minute per IP, and we use far less.
- **Inert until set up:** the mirror is used only while the edge-function secret `FXTWITTER_MIRROR_BASE` is set.

### 2.2 Gap recovery (built now; essential without IFTTT)

After an outage, the 20-post page may no longer reach the last post stored. So:
- after a good read, if **none** of the page's ids are already stored for that account, and the account has older rows;
- follow `cursor.bottom` (the documented `?cursor=` parameter) for up to **4 more pages (100 posts)**;
- stop at the first page that contains a known id.

The recovered posts are first sightings, so for a switched account they are queued once, through the existing `rowsToEnqueue` rule.

**Rules, after Chef's review (2026-11-06):**
- On the page that reaches a stored post, only the rows **above** that post are added. Rows below it are older than the last post stored; they could predate the shadow or come from an earlier outage, so they are never queued as current news.
- **Abandoned:** if an older page or a lookup fails, or the run's page budget runs out (16 older pages per run across all accounts, and none once the run is past half its 100-second budget), the run stores page 1 plus whatever it recovered, and reports `gap: "abandoned"`. Older missed posts may be lost. A gap is never carried over to the next run: storing page 1 hides the gap from later runs, and holding page 1 back would delay fresh posts. An earlier draft held page 1 back ("deferred"); Chef showed it could starve an account.
- **Unrecovered:** after 4 older pages, or when there's no cursor to go further, the run stores what it found and reports `gap: "unrecovered"`.

**Limit:** an outage longer than about 120 posts for one account (around a day for DFO) leaves the oldest posts unrecovered. The run reports this as `gap: "unrecovered"`, so the watchdog can email you.

### 2.3 Layer 3 options (TJ chose (a), on a Raspberry Pi)

- **(a) twscrape + a burner account on your Mac.**
  - **What it is:** a launchd job every 2 minutes. It reads an account only when layers 1 and 2 have had no good read of it for 6 minutes, so it is idle normally and the burner is spared.
  - **How it reuses the mapper:** it converts each twscrape tweet into FxTwitter's status shape and posts the batch to a new, secret-protected edge endpoint. That endpoint runs the **same TypeScript mapper and queue logic**, so there is one mapping, not two.
  - **Independence:** it fails independently of Cloudflare and FxTwitter.
  - **Your part:** make the burner account, and paste its cookies into a local file that only you edit.
- **(b) Burner credentials in your FxEmbed mirror.**
  - No new code: FxEmbed's `credentials.json` is encrypted with your `CREDENTIAL_KEY`.
  - It runs on the same Cloudflare host as layer 2, so it is not independent of it.
  - Datacenter IPs make a lock more likely.
- **(c) No layer 3 for now.** Layers 1 and 2 plus gap recovery and the watchdog email. Revisit if the mirror proves unreliable.

### 2.4 Stale feeds: the 15-minute cross-check (TJ, pop-up, 2026-11-06)

**Found by Chef after v6 went live:** FxTwitter's CCC feed stopped at a 19:16 UTC post, while the 19:42 "NHL Starting Goalies" post existed and `/2/status/{id}` returned it.
- Every request still succeeds, so neither the poller, the watchdog nor the takeover rule notices.
- It is not a URL cache: other `count` values and other letter cases return the same page, with no cache headers.
- It is not a reply either: the post has no `replying_to`.
- Your mirror may be stale the same way, so only a logged-in read is independent.

**Rule:** the health RPC also returns `crossCheck` for every switched account during the first 5 minutes of each 15-minute block. The Pi then reads that account whatever the poller says. Any post the shadow lacked is stored and queued once, as usual.
- **Cost:** about 28 X reads an hour from the burner, against roughly 7.5 an hour if it ran only on outages.
- **Signal:** rows the Pi adds carry `raw_payload->>'provider' = 'twscrape'`. Such a row, while the poller reports that account ok, means the feed was stale. That gives the watchdog an alert key.

## 3. What changes where

| File | Owner | Change |
|---|---|---|
| `supabase/functions/_shared/fxSources.ts` (new) | this lane | The source chain: public, then mirror, then public. Pure apart from `fetch`, with an injectable fetch for tests. |
| `supabase/functions/_shared/fxGapRecovery.ts` (new) | this lane | Deciding whether to page, the cursor URL, and merging pages. Pure. |
| `supabase/functions/x-timeline-poll/index.ts`, `fxtwitter.ts` | **Chef** (I send a patch) | Use the chain for the feed and status fetches, run gap recovery after a good read, and add `via` and `gap` to the results. |
| Chef's watchdog | note to Chef | Optional alerts: `mirror_serving` (the mirror carried more than half of the runs in an hour) and `gap_unrecovered`. |
| Layer 3 | this lane | `supabase/functions/x-timeline-ingest/` (edge endpoint and its draft SQL `setup.sql`), `supabase/functions/_shared/{twscrapeStatus,xTimelineStore,xTimelineIngestRequest}.ts`, and `tools/x-twscrape-fallback/` (Python, systemd service and timer). |
| Tests | this lane | Vitest: the chain order and attempt counts, the gap decision and paging, mapping of mirror bodies. Then `npm run typecheck`. |

**Out of scope here** (it's the cutover plan's P6 and P7): FHFHockey to `social_share_x_posts`, and turning off the applets. This design depends on IFTTT for nothing.

## 4. Production steps (each waits for your approval)

1. **Cloudflare:** you create a free account. I script the FxEmbed deploy with `wrangler` for your approval, using no X credentials.
2. **Mirror probe:** about 20 read-only requests to the mirror's profile endpoint for the 7 accounts, to see whether guest mode reads profile feeds.
3. **Edge function v6:** deploy the chain and gap recovery, then set the secret `FXTWITTER_MIRROR_BASE`. Without the secret, v6 behaves like v5, except for gap recovery.
4. **Layer 3** as you choose. For (a): the burner cookies, which you handle; the new ingest function deploy; its Vault secret; and loading the launchd job.

No migration and no Vercel build is needed for layers 1 and 2.
