# 2026-11-06 · Claude · Tweet parsing audit + swipe trainer (Chef)

## Scope
TJ wants (1) a written audit of tweet recognition: line combos (name match, F lines vs D pairs, extras, goalies,
single-line / in-game changes), goalie confirmed vs projected, injuries (new / status update / return), and moves
(trades, call-ups, waivers); (2) a swipe "trainer" that shows each tweet with the parser's extraction and builds an
answer key for regression-scoring parser changes.

## Decisions (TJ pop-up, 2026-11-06)
- Swipe right = correct; left = wrong, opens the correction editor.
- Trainer is a mode on the existing /db/tweet-pattern-review page (one answer key).
- Audit and trainer run in parallel sessions.
- Queue: line combos first, then the next type. Show a per-tweet confidence rating. Wire in /db/player-aliases so name
  mismatches and uncertain near matches are fixed on the card: "a one-stop shop".

## Where
- Existing pieces: pages/db/tweet-pattern-review.tsx, pages/api/v1/db/tweet-pattern-review.ts,
  lib/sources/tweetPatternReview.ts (categories), tweetNewsPhraseDictionary.ts (auto/review/support rules),
  tweetPlayerEvents.ts (injury states), lineSourceProcessing.ts / lineSourceLineCombinations.ts, tweetNewsInference.ts
  (optional LLM), playerAliasReview.ts + pages/db/player-aliases.tsx, fixtures tweetClassificationLabels.json and
  tweetLunaAdjudicatedLibrary.json.
- Tweet source: x_timeline_shadow_posts (full text, nested repost handle).

## State
- parse-audit done: tasks/artifacts/tweet-parsing-audit-2026-11-06.md (8 High fixes, confidence score, answer-key type).
- swipe-trainer done (uncommitted): /db/tweet-pattern-review?mode=trainer; answer key in
  tweet_pattern_review_items.metadata.answerKey (no migration); web/scripts/tweet-trainer-regression.ts. Chef reran
  tweetSwipeTrainer.test.ts + TweetSwipeTrainer.test.tsx: 14/14 pass.
- Proposed (not started): parse-fixes card for the audit's High items.

## Next
TJ labels tweets, then run the regression script for a baseline. Nothing committed.
- 11-07: TJ trainer feedback (Sabres warmup card, UPL/Ellis) routed to swipe-trainer: move placed chips between spots,
  show unmatched tokens with alias + add-player search per empty spot, two-goalie order rule (first = starter), and a
  confidence penalty for an unresolved goalie token or empty backup.
- 11-07 01:14 UTC (TJ asked): ran roster sync = cron job 6's own command (update-players?dryRun=false, Vault secret
  unseen), pg_net request 234 -> 200 "Successfully updated the players & rosters tables". Tomasino (8481577) and Sammy
  Blais (8478104) still not on OTT: NHL /v1/roster/OTT/current (24 players) omits them though their /player landing
  says currentTeam OTT. Sync mirrors the team roster, so it can't move them until NHL updates it.
- Alias "Amadio" -> Philip Tomasino (OTT, id 1148082c…, saved 01:07) is wrong: Michael Amadio is on OTT's roster.
  TJ approved deleting it, but the execute_sql delete was declined by the permission check; NOT deleted. Handed TJ
  the one-row delete to run himself. Keep Tomasino->Tomasino and Blais->Sammy Blais (OTT).
- TJ ran the fix in the SQL editor: the review row ad64d90b (SunGarrioch "Amadio") was set to ignored with metadata.reverted,
  then the Amadio->Tomasino alias was deleted (it had been blocked by FK lineup_unresolved_player_names_resolved_alias_id_fkey).
- 11-07 (TJ "Run it for me"): NHL team rosters (OTT/PIT/MTL) omit Tomasino and Sammy Blais though their NHL player
  pages say OTT, so no sync run could move them (TJ's dryRun=false URL at 01:59 and the 02:00 cron both succeeded
  without change). Ran upsert_current_roster_membership(8481577,20262027,9,62) and (8478104,20262027,9,79), plus
  players.team_id=9 for both. The sync never removes players, so the rows stay until NHL lists them elsewhere.
  Side finding: the /db Players/Rosters button calls update-players without dryRun=false (dry run only); update-players
  is not on the /db/runner allowlist.
