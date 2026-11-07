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

## Next
- After tonight's games (~05:00Z 11-08): rerun Q1; if claims > 0, Q2 for goalie slot order; GET /api/v1/lines/projected and /lines/<team> (<=5 sequential reads); write receipt tasks/artifacts/lines-p3-game-night-2026-11-08.md (MTL 189/187/191).
- If claims stay 0 after game night: diagnose processor (projectionReportFromSource null? units empty?) before P4.
- Then P4 pop-up.

## Blockers / approvals
- Item 6/7 wait on tonight's game night.
- Item 8 approved by TJ (pop-up) and done.

## Insights
- tweet_player_events writer only wrote injury events; that is why Beck had 0.
- availabilityScope "game" keeps these rows out of the injury prior-status query.
- FxTwitter /2/profile is case-sensitive: lowercase handles give false 404s.
