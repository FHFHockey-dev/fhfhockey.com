# C7 independent review — SITE-SOCIAL-SHARE SS1 (Game Grid Monday edition)

**Reviewer:** Claude C7 lane session (not the author). Read-only: no source edits, no Git, **no server or browser this ticket** (C4 holds :3110), no production. Evidence is in `r5-evidence/ss1/`.

**Verdict: accepted with limits.** The built default card and the two extra cards meet TJ's spec in CLAUDE-009/-010. The new `nst_team_stats` read is leak-free and bounded per request.

Two things are outstanding:
- The pickups card (the 50/30/20% tiers) and the hits/shots/blocks card are specced but **not built**. They need Codex contracts and TJ's direct approval for a production read.
- There is a cost observation on the unauthenticated API (below).

## Pins

- **Patches:** `SS1.patch` `33b1032a…db4b` and `SS1-2.patch` `6f6fabfe…6751` match.
- **Canonical tree:** all **16 lease files** in `HASHES-2.txt` equal the canonical working tree (`shasum -c`: 16 OK), and `SS1-2.patch` reverse-applies cleanly.
- **Unchanged at their CLAUDE-010 pins:** `pages/social-share/[format].tsx` `64d936a2…` and `pages/api/v1/social-share/[format].ts` `83d5b630…`.

## Executed

- **Vitest: 47/47 pass** (`ss1.json`).
  - SS1's `lib/socialShare` tests: schedule 24, mondayGrid 6, matchups 8. That is 38, reproducing SS1's 38/38.
  - My 9 server controls.
- **Not run by me:** the Playwright e2e, because no server was allowed. SS1's own `t2/results.json` shows **12/12 expected, 0 flaky**, covering:
  - square cells, 1080² PNGs and the pinned byte-stable default;
  - the gates for untrusted or unready inputs;
  - the missing-logo fallback.

  These are the owner's browser claims, consistent with the PNGs I inspected. An independent browser run needs the :3110 slot.

## Spec check (CLAUDE-009/-010)

| TJ requirement | Finding |
| --- | --- |
| Square 1:1 cards, screenshot-friendly, Download PNG | Met. The hero `monday-best-schedules-grid.png` and `t2/…streaming-matchups.png` are 1080×1080. The owner e2e asserts 1080×1080 on every export. |
| One clear default plus optional extras, not crammed | Met. The Graphic select defaults to the Best schedules grid. Easiest Schedules and Streaming Matchups are separate one-idea cards. |
| Rank best→worst by weekScore, with opponent logos in Mon–Sun columns | Met. The hero shows ranks 1–32 in two panels, with GP/OFF and a footer saying "Ranked by Game Grid Week Score". The owner unit test checks order = `snapshot.rows` and score = `calcWeekScore`. |
| Compact home/away so cells stay square | Met. Each cell is a square logo tile with an `@` badge for away games; off-nights have a green outline; there's a legend. Square geometry (`offsetWidth === offsetHeight`) is an owner e2e claim. |
| Easiest schedules section, targeted streaming matchups | Met (SS1-2). DEF is consumed read-only, and the owner unit test checks parity with Game Grid's `buildOpponentRatings`. |
| Pickups under 50/30/20% from `yahoo_players`; H/S/B specialists | **Not built.** There's a fixture contract only (`pickupsFixture.ts`), with tiers 50/30/20. This is correctly held for a contract and TJ's approval. |
| No automatic posting | Met. `rg` finds no `navigator.share`, social intent/API URL or POST in the SocialShare paths; the only "POST" is a test expecting 405. The page offers Download PNG and Copy alt text. |
| Unlinked preparation pages | Met. Outside the lease, `/social-share` appears only in the `lib/seo.js` noindex list and its test. The page and API send `noindex, nofollow` (S5). |

## The `nst_team_stats` server read (`lib/socialShare/server.ts` → Game Grid's `loadCurrentSeasonStats`)

| Property | Evidence |
| --- | --- |
| **Least privilege** | Uses `lib/supabase/public-client` (anon), not the service role. Read-only `select` of 13 columns, `season = X`, `situation = 'all'`, exact count, a completeness check, and per-row identity checks (code read). |
| **Leak-free output** | S1: rows given extra columns (`team_name`, `points`, `secret_note`) still produce API JSON with only `{gp, xgf, xga}` per team. Neither the name nor the secret appears. |
| **Failure isolation** | S2: when the loader rejects with DB detail, the schedule edition stays `ready`, opponents become `missing` with a generic reason, and no error text appears. S3: when the schedule fails, the parallel read's later rejection is handled (0 unhandled rejections). |
| **No read on rejected input** | S4: unsupported format, invalid `weekStart`, duplicate dates and dates outside the week make **0** stats reads. S5: an extra query key (400) and POST (405) make no reads. |
| **Bounded per request** | One read per valid GET (S5). It returns about 32 rows in one page of 500. The season is derived from `weekStart` (S1 `20262027`). |

**Observations, for SS1 and the release owner:**

- **SS1-O1 (cost):** `/api/v1/social-share/{game-grid,remaining-week}` is an **unauthenticated GET with `no-store`**. Every hit triggers 1 anon `nst_team_stats` read plus the existing NHL schedule read, with no caching or rate limit. The page is unlinked and noindexed, so traffic should be low, but the amplification is unbounded by design. Under the repo's Vercel and runtime cost rules, consider a short `s-maxage` or a per-week cache key before release.
- **SS1-O2:** the stats read starts before the schedule read and still runs when the schedule fails (S3: 1 call). That is one wasted read on failure.
- **SS1-O3:** any calendar `weekStart` is accepted (S6: 2099 → season `20982099`). The read is still a single bounded query, but the API could reject weeks far from the current season.
- **SS1-O4:** `fetchAllSupabasePages` has no explicit `limit`. The bound comes from the data (one season, one situation). An explicit `limit: 64` would make it unconditional.
- **Process:** the first live verification of this read needs TJ's direct approval, as SS1 states. I made no live read.

## Limits

- **Fixtures only:** fictional league week and fictional NST rates. The card images say so; this isn't real NHL data.
- **Judgement thresholds:** DEF ≤ 33 counts as soft, 72 h as fresh, 8 tiles per card. These are judgement calls flagged to TJ.
- **Not run:** browser, build or full suite.
