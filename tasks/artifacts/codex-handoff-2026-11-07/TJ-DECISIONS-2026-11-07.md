# TJ decisions, 2026-11-07 (Chef session local_c4e6c533, via pop-ups)

Release
- Curated Claude release on top of master (toenail pages, roster last-seen + parser fix 040c59341, X Layer 3 ingest, chrome tokens, Luna 24 paths, L4/L5). Not a full octoberBranch merge.
- Claude assumes ownership of the open Codex lanes EXCEPT the four Scout retains (cron/FORGE release b4033ad65 + goalie/FORGE recovery, WiGO repair follow-up, Yahoo ownership/refresh, FxTwitter forecast dedupe; hands off sourceObservations.ts + playerForecasts.test.ts). Codex hands off the rest via CODEX-HANDOFF-PROMPTS.md (prompts 0, 5–11).
- Codex-owned dirty files stay out of this release and are not committed by Claude now.
- Apply the Luna reservation fix (43b3c87b blobs, 234M) before release.
- X Layer 3: TJ sets all 4 secrets/variables himself; a new lane walks him through each one. Never set X_TIMELINE_INGEST_LIVE.

Lines
- P4 LINES_ENTRY_SERVING_ENABLED: after one game night of P3 data, with the following release.
- P5 LINES_PP_CARRY_FORWARD_ENABLED: after P4 is confirmed, its own release.
- Beat reporters: infer reporters and team associations one at a time in a quickly scaffolded web page, an offshoot of /db/tweet-pattern-review?mode=trainer.
- Lines /superstyle edit pass: now, fresh session.

Style
- Controls checkbox edge -> $border-control-color (done in the chrome-token commit).
- Load Roboto Condensed 500/600/700.
- Toenail backlog: /superstyle per page, Medium first.
- Game Grid desktop /superstyle pass at 1440.

Data ops
- PP rerun 09-29..10-30: size first, then ask.
- NST goalie HD/GS backfill: check whether already done; if not, size + ask, then run (one burst < 40 requests).
- Lineup queue items b733f310, 44ef8dd0, d18b9430: dismiss after 040c59341 is live (ask before the write).
- Bounded read-only production checks allowed (SELECT-only + one Vercel metadata read; exact query in the lane diary).

Housekeeping
- Cleanup stage 2: archive + relink RECEIPT-1..16.
- Archive idle sessions whose work is released; keep sessions with open items.
- Retire six-lane candidate04 + L3 plan, the L3 r3 / L5 r2 reviews, and retirable diaries (keep refs).
- SS 5.6 Player vs Player: TJ supplies one sourced matchup.
- web/web: keep as is (owner-retained default; not asked).

2026-11-08 (TJ): Codex owns the BLSH and RSO lanes (handoff prompts 6 and 9 withdrawn).
