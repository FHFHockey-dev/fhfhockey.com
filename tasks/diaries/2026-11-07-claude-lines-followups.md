# Lines follow-ups and game-night acceptance (2026-11-07)

Session: Lines engine follow-ups (child of Chef local_c4e6c533). Rules: side-session-notes/local_c4e6c533-…/LANE-RULES.md.

## Scope
Own: web/lib/lines/** (incl. authority.ts), web/lib/sources/linesCccIngestion*, web/lib/sources/tweetInterpretation* and tests.
Items: 1 swap claims → IGA + tweet_player_events; 2 verify 32 club handles + fixture test; 3 Discord selector; 4 goalie slot order; 5 first_seen_at; 6 P3 game-night SELECTs + receipt; 7 P4 pop-up; 8 queue dismissals pop-up.

## Where
octoberBranch, canonical checkout. Commits: 63a91d568 (items 1+2), 488ed468d (item 3), 1cfdfabd7 (item 4 goalie-order test).

## State
- Read lane rules, Chef diary, plan, inventory.
- Item 1 design: lineup changes (in_for, draws_in, draws_out, lineup_in_out) become relationship claims with `lineupChange` (ids in/out only, no unit, no number). Kind comes from the producer: in-game game context → iga, else entry (never selected into an entry unit). Events: participation/observed, availabilityScope "game", availability available/out; tweetProjectionStorage writes them (outside my list; minimal filter change, flag to Chef).

## Checkpoint 1
- Item 1 done (63a91d568). tweetProjectionStorage.ts touched (outside list): writer filter + key suffix.
- Item 2: FxTwitter /2/profile lookup is case-sensitive (lowercase gives false 404s). Ledger web/lib/lines/fixtures/clubHandles.ledger.json. mnwild -> minnesotawild; nhlcanes removed (598 followers, unverified; club is @Canes).
- Item 3 (488ed468d): grid moved into .matrixViewport; descendant selector in lib/lines/matrixCapture.ts.
- Item 4: engine sorts by unitKey (goalie:1 < goalie:2); UI EsGroups only filters. Engine test added. Real-feed check folded into item 6.
- Item 5: deployed x-timeline-poll v8 (2026-11-07 03:33Z) writes raw_payload.first_seen_at; ingestion reads it. Confirmed.
- Typecheck: only error is lib/lines/beatReporterInference.ts (beat-reporter lane, not mine).

## Item 6 queries (pre-approved bounded read-only)
Q1: select 'line_source_captures' t, count(*), max(created_at) from line_source_captures union all ... for line_claim_revisions, line_entry_revisions, line_pp_decisions, line_game_state_observations, line_claim_relations.
Q2: payload of the latest line_entry_revisions row with goalie units (slot order), limit 3.

## Checkpoint 2 (21:45Z)
- Baseline Q1 (21:37Z): captures 0, claims 0, relations 0; entry revisions 36 (20 games, 24 teams), PP decisions 72, state observations 2560. First entry revision 21:12:10Z: P3 started with the first processor run after #414, so 0 claims is one run's worth, not yet a fault.
- Prod env: LINES_OBSERVATIONS_ENABLED=true (plain), TWEET_PIPELINE_INTERPRETATION_ENABLED and _PUBLISHING_ENABLED present (sensitive, values not read).
- Item 8: #414 READY (dpl_Eq1QaL9X, 00ea36b39); 040c59341 content in master (via bf5d36294). TJ pop-up: "Dismiss all 3". UPDATE lineup_unresolved_player_names set status='ignored' on b733f310/44ef8dd0/d18b9430 (status=pending guard): 3 rows, read back ignored 21:43:22Z.

## Chef ticket 1: beat reporters (0c9aa09f3)
- AUTHORITY_SEED: BEAT_REPORTER_HANDLES (170) as beat, then club + TEAM_RUN_ACCOUNTS as team.
- Bios checked live. TJ pop-up: "None of those", so only penguinspr is team. chgo_blackhawks (CHGO Sports, independent media), canucksinsider and pensinsidescoop stay beat.
- lib/lines tests 138/138; typecheck exit 0; eslint 0.

## Chef ticket 2: AHL Wolf Pack accepted as NYR (d28c4a76c)
- Trace (read-only): lines_ccc_ifttt_events 646d925c (fxtwitter, CcCMiddleton). The wrapper says "AHL Wolf Pack lines / AHL Wolf Pack Starting Goalie: Callum Tung"; the quote by TheKeeganJarvis (2119182685557977428) says "Wolf Pack lines tonight at Syracuse: ... #HFDvsSYR | #NYR", with no league marker.
  -> the first pass (buildLinesCccSourceFromIftttEvent, wrapper text) gives rejected_non_nhl; refreshLinesCccSourceFromPrimaryText re-runs the league check on the quoted text only, so the AHL label is dropped there and #NYR resolves to NYR. lines_ccc row: primary_text_source quoted_oembed, status accepted.
  -> 1 claim f2006d68… (es_defense #2, team 3, game null, 5 review reasons, never eligible), capture 124f265b…; no entry/PP/relation refs.
- Fix: the refresh also checks wrapper enriched/raw text. The test fails on HEAD and passes now. Wider vitest 1484 pass; typecheck 0; eslint 0.
- TJ pop-ups: delete both evidence rows (approved), but the SQL prompt was declined, so nothing ran (read-back: rows 1/1, triggers O). TJ: "I'll run it myself", so the SQL is in tasks/artifacts/lines-ahl-wolfpack-2026-11-07/delete-bad-claim.sql. lines_ccc row marked rejected_non_nhl / explicit_non_nhl_league_marker (done, read back).

## Chef ticket 3: reporter handle on validated goalie/injury rows (fe7eb77be)
- tweetProjectionStorage wrote validated_events rows with source_account null. sourceObservations groups reporters by source_account || source_key, so every validated report counted as one "validated_events" reporter.
- Fix: validatedEventReporter = the handle from verifiedOriginalTweetUrl(report.originalUrl); relay or pending original -> null; quote posts -> null (capturePlayerForecastSourceRows credits the quoted author). Scout's sourceObservations.ts untouched.
- Gotcha: my first version used sourceAttribution (sourceHandle) and credited "relayreporter" on a post whose URL is GameDayGoalies with attribution pending. The writer test "keeps direct pending attribution unresolved" caught it; switched to the verified original URL.
- Updated deliberately: projectedLineups.test goalie/injury children now expect "reporter"; PP stays null. Social-share tests already cover both a named reporter (reporter0/reporter1 conflict) and the null fallback; unchanged.
- vitest lib/sources+lines+socialShare+player-forecasts+update-lines-ccc/line-sources: 4011 pass / 39 skip; typecheck 0; eslint 0.

## Chef ticket 4 (URGENT): P3 load took prod Supabase down (c74e53c03)
- Cause: processor looped over the whole scheduled slate on every per-minute and per-webhook call: full games history, every stored state row (hydrateLineGameStates), an NHL call, a new state row per call (state_id hashes observedAt), and a reconcile with full claim and PP history reads.
- Fix in lib/lines only: source teams only (empty call = 0 DB); games window -21d/+3d; latest state = 1 row per near game; a state younger than 5 min is reused; reconcile only on a newly inserted claim or a real phase change (the raw stored phase, not stateAtRead-aged); claims read since the window; PP latest = 1 row per unit.
- Counts (16 teams, 8 games): empty 112+16 NHL -> 0+0; one source 118+16 -> 14+1; repeat at +1 min 118+16 -> 8+0.
- Tests: processorLoad.test.ts (4). storage.test mocks updated (upsert().select, entry-read count). 1549 pass; typecheck 0; eslint 0.
- Trade-offs: a frozen entry now persists only when that team gets a new source or a phase change (read-time freeze covers display). The GET service path (P4) still reads full history (hydrateLineGameStates, fetchLineGames, fetchEntryHistory): bound it before P4.
- Not touched: Vercel env, crons, update-line-sources/ccc.

## Next
- After tonight's games (~05:00Z 11-08): rerun Q1; if claims > 0, Q2 for goalie slot order; GET /api/v1/lines/projected and /lines/<team> (<=5 sequential reads); write receipt tasks/artifacts/lines-p3-game-night-2026-11-08.md (MTL 189/187/191).
- If claims stay 0 after game night: diagnose processor (projectionReportFromSource null? units empty?) before P4.
- Then P4 pop-up.

## Blockers / approvals
- P3 is off and the crons are paused (Chef). P4 stays off. The game-night receipt waits until P3 is back on.
- Item 6/7 wait on tonight's game night.
- Item 8 approved by TJ (pop-up) and done.

## Insights
- tweet_player_events writer only wrote injury events; that is why Beck had 0.
- availabilityScope "game" keeps these rows out of the injury prior-status query.
- FxTwitter /2/profile is case-sensitive: lowercase handles give false 404s.
