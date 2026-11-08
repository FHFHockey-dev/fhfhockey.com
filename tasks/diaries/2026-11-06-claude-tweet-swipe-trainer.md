# 2026-11-06 · Claude · Tweet swipe trainer

## Scope
Swipe "trainer" mode on /db/tweet-pattern-review: one tweet per card with the parser's extraction, confidence,
per-player match confidence, inline alias fixes, answer-key record per verdict, and a regression runner.
Not touching supabase/functions/x-timeline-poll/* (other session). No commits, no pushes, no Vercel.

## Decisions (TJ pop-up, 2026-11-06)
- Answer key lives in tweet_pattern_review_items.metadata.answerKey (+ review_assignments). No migration.
- Shadow-only tweets (119 of 185 shadow posts) show as cards; a review row is inserted only on verdict.
- Wrong / near-match names: queue into lineup_unresolved_player_names, then resolve through the existing
  /api/v1/db/player-name-aliases POST (default "resolve" = learns the alias for future mentions).

## Where
- Branch octoberBranch (shared checkout, many other lanes dirty). Files owned by this lane:
  web/lib/sources/tweetSwipeTrainer.ts (+ .test.ts), web/lib/sources/tweetSwipeTrainerServer.ts,
  web/components/TweetSwipeTrainer/*, web/pages/db/tweet-pattern-review.tsx (mode toggle only),
  web/pages/api/v1/db/tweet-pattern-review.ts (trainer GET/POST branches), web/scripts/tweet-trainer-regression.ts.
- Parser replayed: buildLinesCccSourceFromIftttEvent (linesCccIngestion.ts) + matchTweetNewsPhrases.
- Identity basis: resolvePlayerIdentity (full_name/alias/initial/surname).

- Dev server (TJ pop-up): own server on :3120 with PLAYER_FORECAST_ISOLATED_NEXT=1 (.next-player-forecasts) +
  TWEET_PIPELINE_INTERPRETATION_ENABLED=true, because another lane's :3110 already owns .next-playwright.

## State (built, uncommitted)
- lib/sources/tweetSwipeTrainer.ts: parse replay, per-player + per-card confidence (audit section 5: 100 minus
  penalties, bands 85/60), answer-key record (subset of audit section 6), compare, replayAnswerKey.
- lib/sources/tweetSwipeTrainerServer.ts: queue (amber first), shadow-only cards, verdict save, alias queueing,
  30-min roster+parse cache. API: GET ?mode=trainer, POST trainer-verdict / trainer-queue-alias.
- components/TweetSwipeTrainer/*: deck (swipe, arrows, prefetch), card, correction editor, alias fix panel.
- scripts/tweet-trainer-regression.ts (read-only; forces interpretation path unless --legacy).
- Checks: Vitest trainer lib 9/9, component 5/5, admin-gate 14/14. Lint exit 0 (warnings elsewhere).
  Final typecheck exit 0 (earlier runs failed only in another lane's teamStream.test.ts). Pure-selector check ok.
- Real-data probe (read-only): queue 2.4-4.4 s per 10 cards; 1,405 line combos / 1,822 goalies / 637 injuries /
  191 transactions pending.

## Gotchas
- The production parser (interpretation path) costs ~200-600 ms per tweet, so the server caches parses and
  pre-types shadow posts with classifyGameDayTweet + phrase rules before a full parse.
- Local .env has no TWEET_PIPELINE_INTERPRETATION_ENABLED, so a plain local run judges the legacy path.

## Verified on real data (2026-11-06)
- Screenshots on TJ's :3000 server (Google sign-in returns to :3000, so :3120 could not hold a session):
  desktop card, correction editor + alias fix panel, phone width. Nothing saved; no verdicts written yet.
- :3120 stopped by PID (47631/47632). :3000 and :3110 untouched.
- UI fixes after screenshots: action buttons inline above the card (site bottom nav covers fixed bars), "Confirm"
  only below 70 (audit threshold), card column 960 px.
- Regression script dry run: 0 labelled tweets, interpretation path, exit 0.

## Next
TJ labels tweets; then run scripts/tweet-trainer-regression.ts --output=<file> to set a baseline.
Not done: alias "Confirm" for near matches is only offered below 70; DFO goalie marker gap etc. are parser fixes
(audit), not trainer work.

## Superstyle run + commit (2026-11-06)
Passes 0-8 done on the trainer (see commit message). TJ additions: names-to-place tray (click/drag),
extraSkaters answer-key field, starter/backup goalies, LW/C/RW editor grid with full-width phones,
in-editor alias resolving. Committed locally as 7e7e3dfd2 (14 files, no diaries). Not pushed.
Next: TJ labels tweets; then run the regression script with --output to set a baseline.

## TJ's first-card critique (2026-11-06, uncommitted)
- Rosters were stale since 2026-09-19: cron job 6 (update-players-job) called /api/v1/db/update-players without
  dryRun=false, and the route defaults to a dry run (since 4af8764de, 09-18). With TJ's approval: cron.alter_job(6)
  now uses ?dryRun=false and a 300s timeout; one run via pg_net (request 1830) returned 200. Wood -> SEA,
  Wright -> NSH; 42 roster rows changed. Not handled by the route: players who leave NHL rosters entirely.
- New PlayerCombobox (list under the field, team first, "Search all players"), replacing every datalist.
- Lineup cards always show Starter/Backup goalies and an Extra skaters row (parser reads no extras yet).
- Swipes only for touch/pen; mouse drags select text.
- After a name fix on the card: POST trainer-reparse clears the roster/alias cache and re-reads the card, so
  "Correct" judges the reading shown. Key hint now says what each verdict means.
- Checks: typecheck 0, eslint 0, 35 tests (deck 12, lib 9, page 14), pure OK. One cold-run flake in the
  arrow-right test (1s waitFor) -> timeout raised to 3s.
- Unplaced-names penalty (TJ yes): lineups lose 5 per matched player in no spot, max 25; confidence version
  trainer-2026-11-06.2. Kraken card 93 -> 68 (amber, now first in queue). Lib 10/10, deck 12/12.
- Card placements (TJ): dotted Starter/Backup spots (when the parser left them empty), Extra forwards and Extra
  defensemen trays. Pick a dropped/other name (click) then a spot, or drag on desktop; x removes; "Fix this name"
  from the pick hint. Any placement turns the verdict into "Save with placements" (saved as wrong + merged answer);
  the editor starts from the merged answer. Answer key: extraSkaters split into extraForwards/extraDefensemen
  (0 records existed). Tests: deck 13, lib 10. Typecheck/eslint 0. Live: Kraken card placements shown, not saved.
- Finding: alias API refuses surname aliases shared league-wide (Gaudreau, Wood queued by TJ, still pending);
  the trainer doesn't offer the API's assign-this-occurrence path yet. Both now match via the refreshed roster.
- TJ approved items 1-3. Items 1+2 (slot-position tie-break in the parser; surname+team+position aliases with a
  migration TJ approves first) went to session position-aware-names (local_9ac129f2-129e-4c3b-81fc-b4409ff20401),
  same checkout, told not to touch trainer files.
- Item 3 done here: an alias refusal ("surname has multiple identities") now explains itself and offers
  "Use for this tweet only" (alias API action assign_occurrence) in the card fix panel and the editor resolve rows;
  fix panel says when a surname match needs no alias. Deck 14/14, lib 10/10, typecheck 0, eslint 0. Not run live
  (a refusal needs a real alias attempt).
- Gap TJ hit (Tavares return tweet): the answer key has no team field, so a correction can't record TOR.

## 2026-11-06 — power-play units + category-driven editor (uncommitted)
- Lib: `powerPlay` on TrainerParse (from `metadata.powerPlayUnits`, PP1 before PP2 by labels) and TrainerExtraction (old records read as []); compared like lines; PP slots count as placed; PP tweets scored "x of 2 power-play units" instead of "x of 7 ES units". Score version → trainer-2026-11-06.3.
- Card: "Power play" PP1/PP2 rows (5 columns, `.lineGridWide`); goalie/extra spots and pick hint hidden on PP tweets.
- Editor: `layoutFor(category, subcategory)` → lines | powerPlay | goalie | players. Only that layout's spots show and save; a category change clears hidden spots, fills new ones from the parse (or the freed names in order) and returns leftovers to the tray. PP grid QB/LW/RW/Bumper/Net.
- Checks: lib 11/11, component 16/16, typecheck 0, eslint 0, pure-check ok. Live: Isles PP card (stefen_rosner) shows PP1/PP2, confidence 93; editor shows only the PP grid at 800 and 375 (no page overflow). Not saved.
- Gotcha: lib `tweetSwipeTrainer.ts` can't be imported as a value in components (node crypto); `isPowerPlaySubcategory` is duplicated in TrainerCard.tsx.
- Open: at 375 the 5 PP fields are 62px, so long names clip even at the 10px floor.
- position-aware-names session (local_9ac129f2) done: parser position tie-break + `position_group` alias column (migration applied to prod with TJ's OK); its tests + trainer tests 106/106 here.
- Trainer wired to it: when a plain alias is refused, card fix panel and editor ResolveRow offer "Learn for <TEAM> forwards/defensemen/goalies only" (sends `positionGroup`), then "Use for this tweet only". Scoped aliases only apply where the parser knows the spot, so plain aliases stay the default. Component 16/16, typecheck 0, eslint 0. Not live-checked (needs a real shared-surname refusal).
- Sabres PP2 tweet (TJ): added `offPowerPlay` to the extraction (compared as a set, old records → []); editor PP layout has an "Off the power play" list; tray chips get × ("not a player in this tweet", undo line) and an "Add a name the parser missed" field; suggestPlayers falls back to close surname spellings (edit distance 1, or 2 for 6+ letters) so "Kuluch" suggests Jiri Kulich. PP units keep their numbers on save (empty PP1 stays []). Tests 28/28, tsc 0, eslint 0; live: Kuluch → Jiri Kulich suggestion shown (nothing saved).
- Parser follow-up (not trainer lane): "power play" in text matches Owen Power as a named player.

- Committed 2026-11-06 (TJ pop-up): parser d80b8e5f6, trainer a2556bbb6. Not pushed. Lines IGA chef told (Lane D unblocked).

- Lane E (Lines IGA chef ticket, TJ pop-up): answer key v2 committed 4218359a8 (context, game binding, scope, PP swaps; v1 still reads, unjudged; regression byField). Not pushed. Typecheck red only on the Lines lane test abbreviation-header.test.tsx. Gotcha: plain substring checks on "practice" vs "morning skate" come from the interpretation context; "ahead of <team>" is not read as an opponent.

- UPL/Ellis feedback (parent relay): trainer surfaces unread list-line names (UPL), goalieLines + 2 goalie penalties (confidence v .4: real card 93 -> 65), card goalie move/swap + empty-spot roster Search, editor Move (swap on fixed spots). Parser goalie order sent to Lines chef Lane D. 36 tests, typecheck 0. UNCOMMITTED: lib/sources/tweetSwipeTrainer(.test).ts, components/TweetSwipeTrainer/{TrainerCard,CorrectionEditor,TweetSwipeTrainer.test}.tsx, module.scss. Gotcha: test env runs the legacy path, where "Pickard\nSkinner" parses both goalies; prod interpretation drops UPL.
- Committed cf5de3224 (TJ "Commit them"). Not pushed.

- Skeleton (TJ): card always shows L1-L4 x3, D1-D3 x2, Starter/Backup/Extra goalie + extra F/D; CardPlacements now {spots: "G:i"/"F:r:c"/"D:r:c", extras, goaliesSet}. Editor gets Extra goalie. Comma goalie lists read as the goalie block. Blais/Tomasino "0 no player": rosters 20262027 lack them on OTT (players.team_id MTL/PIT) because update-players dry-ran until 11-06; alias cannot attach until roster sync (cron 02:00 UTC, dryRun=false now). Trainer now says so after saving (offRosterNote). 37 tests, typecheck 0. UNCOMMITTED.
- Committed skeleton work (TJ "Commit them"). Not pushed.
