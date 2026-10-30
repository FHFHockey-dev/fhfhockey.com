# SS1 — Game Grid social-share, Monday "Best schedules + streamers" edition (Claude)

- Scope: CLAUDE-20261024-009/-010. Default square card = compact logo grid ranked by Game Grid weekScore, Mon–Sun opponent logos, compact home/away marks. Extra cards specced; at most one built. Fixtures only.
- Where: octoberBranch @ 2a5092d37 (dirty; no Git writes). Lease: web/lib/socialShare/**, web/components/SocialShare/**, web/pages/social-share/[format].tsx, web/pages/api/v1/social-share/[format].ts, web/e2e/social-share.spec.ts (+new files), handoffs/SS1/.
- Baseline lease hashes re-verified 10/10 against CLAUDE-010 at start.

## Log
- Start: read spec, module, e2e spec, C7 receipt (run recipe: own isolated :3110 + deny preload + PLAYWRIGHT_SKIP_WEB_SERVER=1).
- Design: grid card = two 16-row panels (ranks 1–16 | 17–32), 46px square cells, opponent logos downscaled client-side to data URLs (fast, embeddable export), "@" badge = away, tinted cell = home, green outline = off-night. Untrusted editions: alphabetical, no ranks, "Ranking unavailable". Default card for game-grid only; remaining-week keeps leaders default.
- Extra cards: spec all five in handoffs/SS1/EXTRA-CARDS.md; build none beyond default (existing leaders card already covers games remaining/off-nights). Easiest/streaming/pickups/specialists need Codex-owned data contracts.

## Next
- Implement mondayGrid.ts + fixture + vitest, component card, e2e, run, receipt.

## Gotchas
- Playwright webServer probe hits '/', whose SSR reads prod; never use default webServer mode.

## State at handoff (2026-10-24 ~11:50 EDT)
- Default grid card built; vitest 29/29; e2e 9/9 on isolated :3110 (skip-server + deny preload); fidelity 0.63%; eslint 0; full tsc: only 2 out-of-lease Luna errors.
- Extra cards specced (EXTRA-CARDS.md), 0 built. Server stopped; :3110 free.
- Receipt, patch (sha 33b1032a…), HASHES.txt in handoffs/SS1/. Awaiting Codex acceptance + C7 review; keep this diary until accepted.
- Gotcha: the first e2e run after an SCSS/TSX edit can capture pre-HMR output; curl the page first, then rerun.

## Ticket 2 (2026-10-24 ~12:30 EDT): Easiest Schedules + Streaming Matchups
- Built both cards (Graphic select options); DEF = Game Grid percentileMap semantics, parity-tested vs buildOpponentRatings.
- New server read path loadCurrentSeasonStats (nst_team_stats) built but never exercised; needs TJ approval to verify live; flagged in RECEIPT-2.
- Default grid byte-stable: pinned sha 7f4cf9c0… before and after (asserted in e2e).
- Pickups fixture contract only (pickupsFixture.ts).
- vitest 38/38; e2e 12/12 on isolated :3110 (skip-server, deny preload); eslint 0; CSS pure OK; tsc (heavy lock) only 2 out-of-lease Luna errors.
- SS1-2.patch 6f6fabfe… on top of SS1.patch 33b1032a…; HASHES-2.txt; RECEIPT-2.md. :3110 released for C1.
- Gotcha: zsh doesn't word-split $VARS; use a bash script for file loops.

## Ticket 3 (2026-10-24 ~13:15 EDT): C7 SS1-O1..O4
- O1 shareCacheControl (≤300 s s-maxage + ≤300 s swr, bounded by expiresAt−600 s; 60 s while opponents unready; no-store otherwise). O2 stats read after schedule success. O3 season window prev/current/next → 400. O4 local loader teamRates.ts with limit 64 (Game Grid loader is Codex-owned, no limit param).
- vitest 45/45; eslint 0; tsc only Luna errors. SS1-3.patch b15dd3aa… verified (18/18). RECEIPT-3.md written.
- NEXT: e2e 12/12 + pinned sha on :3110 once C1 releases the slot; update RECEIPT-3 "Pending e2e".
- 17:13Z: e2e 12/12 on :3110; pinned grid 7f4cf9c0… + easiest d91622b6… + stream 2676d8b2… identical before (patch -R SS1-3) and after. SS1-3.patch final b6dee9e2… (supersedes b15dd3aa…). Server stopped, :3110 released. RECEIPT-3 updated. Awaiting Codex acceptance; keep diary.

## Ticket 4 (2026-10-24 ~13:50 EDT): Pickups x3 tiers + Category Specialists
- Built on fixtures shaped as Pick<> of yahoo_players / yahoo_nhl_player_map_read / wgo_skater_stats_totals / wgo_goalie_stats_totals. Rule: top-10 Week Score teams; rate = points_per_game (skaters) / quality_starts_pct (goalies); strictest-first tiers; specialists per-game = total ÷ GP.
- No live read path (ownership is a Codex contract); read plan documented in RECEIPT-4.
- vitest 53/53; e2e 14/14 on :3110 with 7 pinned hashes asserted (3 old unchanged, 4 new anchors); CSS pure OK; eslint 0; tsc only Luna errors. SS1-4.patch 0b39b560… (20/20). :3110 released 17:46:30Z.
- Gotcha: a comparator whose metric depends on one side's group is not a total order; sort within groups.

## Ticket 5 (2026-10-24 ~14:05 EDT): C7 SS1-4 findings
- F1 per-player freshness gate (+ majority-stale ⇒ layer stale; as-of = oldest included); O1 true bands 30–49/20–29/<20 (no spill-over; floor display); O2 primary-position rule; O3 e2e "Only 1 qualifies".
- vitest 55/55; e2e 15/15 with 7 pinned hashes (only 3 pickup PNGs changed: 17f84737/46c00e20/c50ad5f8); CSS pure OK; tsc only Luna errors. SS1-5.patch a36c1b4f… (20/20). :3110 released 18:04:57Z.
- Gotcha: fixture yahoo[0] has IR status by design; pick eligible rows in tests by status.

## Ticket 6 (2026-10-24, PAUSED mid-ticket: usage limit)
- Done (uncommitted, in lease): Wednesday edition (remaining-week default grid; edition-aware eyebrows; CardHeader shows "COVERS THU–SUN" + data-covered when selection != full week; Monday full-week DOM unchanged). Tuesday Trends: lib/socialShare/trends.ts (+trends.test.ts, trendsFixture.ts) from rolling_player_game_metrics (L5 vs season: P/GP, TOI/GP, PP share, SOG/60, iCF/60=shot_attempts_per_60, ixG/60; line/PP unit vs 5 games earlier) + Yahoo ownership movers (ownership-trends rule, 5 days; adds/drops stated as unavailable). tuesday-trends now a SCHEDULE_FORMAT (schedule read, no team-rate read); TrendCard UI + SCSS (CSS pure OK); export gates trends/movers. Unit tests pass; eslint clean.
- NOT done: e2e run (4 new tests + pinned Wednesday/Tuesday test written, never run), Monday pinned hashes re-check (7f4cf9c0 grid, d91622b6, 2676d8b2, 17f84737, 46c00e20, c50ad5f8, 2b5cd4a3), tsc under heavy lock, SS1-6.patch (base = HEAD+SS1..SS1-5; script pattern in scratchpad make-patch5.sh), RECEIPT-6.md. :3110 server NOT running.
- Next: start isolated :3110 (deny preload), run full spec with the 3 Monday pinned env vars, fix failures, record Wednesday/Tuesday anchors, then patch + receipt.
- Resumed (~14:50 EDT): lease re-checked (only own ticket-6 edits); vitest 62/62; e2e 19/19 with 18 pinned hashes asserted (Monday 7 unchanged; Wednesday 7 + Tuesday 4 new, repeatable); CSS pure OK; eslint 0; tsc only Luna errors. SS1-6.patch ca5bcbd1… (23/23). RECEIPT-6.md written. :3110 released 18:54:51Z. Awaiting Codex acceptance + C7 review.

## Ticket 7 (2026-10-24 ~15:20 EDT): SS1-6-O1
- tuesday-trends API now blocked with zero upstream reads (UPSTREAM_READ_FORMATS; buildBlockedSnapshot + TUESDAY_NOT_CONNECTED); client says "not connected". Fixture rendering unchanged (SCHEDULE_FORMATS keeps Tuesday).
- vitest 62/62 (zero-read test); e2e 20/20 with all 18 pinned hashes unchanged; CSS pure OK; tsc only Luna errors. SS1-7.patch a64adc99… (23/23). RECEIPT-7.md lists tunables. :3110 released 19:16:39Z.

## Ticket 8 (2026-10-24 ~15:40 EDT): diagnosis + live player layer
- Diagnosis: game-day editions expire after 15 min; expired was shown as generic "schedule edition is not ready". Fixed messaging (scheduleReason). Schedule feed itself ready (live: 0 reasons).
- playerSources.ts: anon read-only selects (yahoo_players <50% season top-10 teams, WGO skaters/goalies, yahoo_nhl_player_map_read chunks), explicit limits fail-closed; server reads only after ready schedule; trimPlayerLayer keeps only shown players + selectedDates.
- Live check (TJ pop-up approved incl. nst_team_stats + map view): 2 API GETs (strict-mode double), both ready, players ready (25 shown); stopped at first correct render. PNGs in t8/live.
- vitest 68/68; mocked e2e 20/20 with 18 pinned hashes unchanged; CSS OK; tsc only Luna errors. SS1-8.patch e230e43d… (25/25). :3110 released 19:33:42Z.

## Ticket 9 (2026-10-24 ~16:00 EDT): C7 SS1-8 limits
- RECEIPT-8-CORRECTION.md (concurrent API pair; 4 local GETs). fetchEdition single in-flight per URL (+StrictMode component test, negative control failed with 2 calls as expected; e2e #21 one call per load). live-harness/ serial guard (concurrency 1, page+API counted, exit 2 on violation, no warm-up GET). editionLabel date-aware eyebrow.
- vitest 72/72; e2e 22/22 with 18 pinned (Monday unchanged; Wed/Tue new anchors, pinned on own posting days); CSS OK; tsc only Luna errors. SS1-9.patch 364a3118… (29/29). :3110 released 19:53:52Z. No live requests.

## Ticket 10 (2026-10-24 ~16:20 EDT): TJ's direct flair request
- Confirmed pickups use Yahoo-global rostered %, not league FAs. TJ pop-up: fill short lists from a wider team pool.
- Built TeamBanner stripes (teamsInfo), player banners + L5 GP (rolling/wgo_goalie_stats, shown players only), fill-3 wider pool, grid score tiers + off-night columns + cherry-pick borders, Easiest banners, Streaming evidence (GF/GA, SF/SA ranks, B2B, storm flags), leaders banners + week row.
- vitest 75/75; e2e 23/23 with 18 pinned (Mon/Wed new by design, Tue unchanged); CSS OK; tsc only Luna errors. SS1-10.patch afe52ca0… (30/30). :3110 released 20:15:27Z. New live reads need a TJ-approved bounded check.

## Ticket 11 (2026-10-24 ~16:30 EDT): C7 SS1-10 F1/F2
- F1: recentState ready|unavailable; tiles say "Recent form unavailable" on failed/over-limit reads; cache capped at 60 s. Regressions (reject, over-limit, empty-success) server + unit + e2e #24.
- F2: eyebrow "Pickups · top-10 schedules first"; alt text names the wider pool.
- vitest 77/77; e2e 24/24 with 18 pins (only 6 pickup PNGs changed, eyebrow text); CSS OK; tsc only Luna. SS1-11.patch c614d891… (30/30). :3110 released 20:28:50Z.

## Ticket 12 (2026-10-24 ~16:40 EDT): GP/OFF count colours (TJ)
- countTiers/editionCountTiers: highest green, 2nd white, between yellow, lowest red; 2 values green/red; 1 value neutral; ties share; untrusted neutral. Applied to grid, leaders, easiest, tiles, stream, Tuesday GP.
- vitest 80/80; e2e 25/25 with 18 pins (17 changed, Tuesday Movers unchanged); CSS OK; tsc only Luna. SS1-12.patch e7e5d226… (30/30). :3110 released 20:38:28Z.

## Ticket 13 (2026-10-24 ~17:00 EDT): schedule-aware streaming tier list (TJ)
- TJ pop-up: pairs ordered by Week Score. Strict = one (GP, OFF) pair per tier, top 3; widen = T1 alone, T2/T3 fold in the next pair (TJ's week: T2 = WPG+LAK+OTT, T3 = 3/2 + 3/1).
- New tiers.ts/tiers.test.ts; TierListCard (tier bars + team-colour list rows, 15-row budget, "+N more"); graphic options tiers / tiers-wide. Live trimmed layer -> card unavailable (tierPlayersAvailable).
- Custody gotcha: a Codex social-access worker holds page/API routes, editionFetch, schedule.test.ts, SocialShare.test.tsx and the new access files until handback. Untouched. Tried adding tier rows to trimPlayerLayer; it broke reserved schedule.test.ts, so reverted (players.ts/types.ts = SS1-12).
- vitest 131/131; ESLint 0; CSS pure OK; tsc only Luna. SS1-13.patch e0a1a46c… (my 5 files). RECEIPT-13.md (PARTIAL). :3110 released 21:31:14Z.
- BLOCKED: e2e/PNGs, because SocialShareAccessGate needs a signed-in social editor (all e2e affected). Asked the orchestrator: wait for the Codex handback with an e2e auth fixture, or authorize an SS1 e2e auth mock.
- Next: after unblocking, run the full e2e on isolated :3110, pin the tier PNGs and confirm the other 18 pins; after handback, keep tier rows in the live trim and update the reserved tests.
- 17:45 addendum: the orchestrator OK'd B (network-only auth mock). Not possible: the client uses detectSessionInUrl false + PKCE, and getSession reads localStorage only, so page.route has nothing to answer. Fell back to A; no files changed. Possible next step: a storageState fixture (needs approval). RECEIPT-13 addendum written.

## Ticket 14 (2026-10-24 ~18:00 EDT): live tier-list support + ticket 13 e2e
- trimEditionPlayers (tiers.ts) keeps pickups + specialists + both tier modes' shown rows and records tierCounts; server.ts uses it. Cap TRIMMED_PLAYERS_MAX 66. streamingTiers splits trimmed layers by the server counts and lists nobody if counts are missing or mismatched. No new reads.
- E2E behind the real gate: fictional session in Supabase storage + mocked auth/role on http://supabase.e2e.invalid (same mechanism as Codex), bearer required, .invalid guard. Negative test #27. Did not adopt CODEX-058's helper (port 3140 and old spec base); adopted its CSS correction exactly (scss = 07622368).
- vitest 133/133; e2e 27/27 with 22 pins (18 unchanged, 4 new tier pins); CSS OK; eslint 0; tsc only Luna (needs an 8 GB heap). SS1-14.patch 7f87b795… (8/8). RECEIPT-14.md. :3110 released 22:31:38Z.
- Gotcha: rebuilt the pre-edit schedule.test.ts by reversing my edits; it matched Codex's pin 29a8d4f8.

## Ticket 15 (2026-10-24 ~19:10 EDT): reset fix, L5 ranking, role chips, plan
- Reset cause: auth-js fires SIGNED_IN on tab return → AuthProvider sets isRoleLoading → the gate unmounts the studio. Fix: selection in the URL (shallow) + in-memory per-user edition restore. Gate change written as BOUNDARY-REQUEST-15-GATE.md (read-only for me).
- score.ts: L5 FP/GP (fantasyPointsConfig) × opportunity (line/pair, PP, relative TOI). Roles come from existing rolling_player_game_metrics columns. Bounded pool (≤132) → L5 read → rank → trim (≤66). bounded() pages at ≤1000 rows.
- Neon chips; formula in the footers; tier row 35px. Plan doc written (D).
- vitest 141/141; e2e 28/28, 22 pins (10 unchanged, 12 new by design); CSS OK; eslint 0; tsc only Luna. SS1-15.patch bc07718b… (16/16). RECEIPT-15.md. :3110 released 23:08:13Z.
- Gotcha: a synthetic visibilitychange must bubble (auth-js listens on window). The scoped tsc grep missed errors; always run the full tsc.

## Ticket 16 (2026-10-24 ~20:05 EDT): C7 SS1-15 F1–F4 (pre-production gate)
- F1 isCalendarDate (round-trip) for ?week; F2 unique order tiebreaks (player_id / goalie_id); F3 tier footer copy; F4 PP3 chip (orange), no chip for a null unit (roleChipList).
- F5 found while verifying: the URL dropped dates during a load (flaky e2e #28); now keeps them.
- vitest 148/148; e2e 28/28 ×3 runs, 22 pins (9 changed, 13 unchanged); CSS OK; eslint 0; tsc only Luna. SS1-16.patch 9be42ca4… (5/5). RECEIPT-16.md. :3110 released 00:03:39Z.

## Ticket 17 (2026-10-25 ~11:10 EDT): "Recent form unavailable" + meta captions
- Built in snapshot /private/tmp/fhfh-ss1-t17/web (HEAD 1ee5127dc; env files deleted unread; fictional CMS_URL needed). Server :3140.
- Code: the recent read is one Promise.all and the error was swallowed. Grain: one row per player per date (both PKs); anon grants, RLS policies and columns OK.
- TJ-approved 3 live selects: all OK (rolling count 5093, goalie 307, ≤233 ms). Not reproduced; the production-only factors are the in-list and paging. hits/blocks L5 null live.
- Fix: allSettled per source, caps lookback+1, recentState partial plus recentUnavailable, a server log line. Removed 12 meta captions (listed in the receipt).
- vitest 162/162; e2e 29/29, 22 pins (18 changed, Tuesday unchanged); CSS OK; eslint 0; tsc 0. SS1-17.patch 095cecb4… vs HEAD (9/9). RECEIPT-17.md. :3140 released 15:06:19Z.
- Next: Codex integrates; after deploy, read the Vercel runtime logs for "[social-share]" to name the cause.
