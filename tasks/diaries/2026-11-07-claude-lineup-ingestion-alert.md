# 2026-11-07 Claude: lineup-ingestion alert

## Scope
Side session of X chef (local_1fb55d9b). Investigate + fix TJ's lineup-ingestion alert: (1) CAR extras row shifts D pairs,
(2) FLA ambiguous "Schwindt" leaves L4 blank, (3) DAL Hryckowian/Taylor gaps, (4) MTL "IN/OUT" wrapper and
Reinhardt "vs. Washington" subject-team attribution. Read-only on prod; no writes/replays/deploys without TJ.

## Where
- octoberBranch, HEAD fb7d6601e at start. Dirty files at start belong to x-fallback-gha (twscrape, x-timeline-ingest, GHA).
- Likely files: web/lib/sources/linesCccIngestion.ts, tweetInterpretation.ts, lineupSourceIngestion.ts + tests.

## State / checks
- Replay script (scratch, uncommitted, delete at end): web/scripts/.scratch-lineup-alert-replay.ts (read-only, interpretation forced).
- CAR root cause: prose bullet "...his impressive 10-1 start." has a hyphen -> reviewShape es_defense, no hits so not shortRow
  -> takes D ordinal 1. Real pairs become #2..#4, #4 cut by 3-pair limit. Extras row Deslauriers-Staal is excluded (null number),
  not the cause. Consumers: no forecast snapshot (needs gameId + game context); line combos not written under interpretation;
  public projected set needs D#1 so never published; rail shows raw text only.
- FLA/DAL Hryckowian root cause: stale `rosters` (camp 44s from 09-19 still is_current; RPC upsert_current_roster_membership
  ends only on team change). NHL current: FLA has only Cole Schwindt; DAL only Justin Hryckowian. Taylor (Trey, 8485468) has
  only a 2025-26 roster row and is not on NHL DAL current roster either.
- MTL: "IN - Owen Beck" line read as review D row (queues "in"); OUT name keeps "(personal) <url>" so Anderson unresolved.
- Reinhardt: lineup-class news item with one player -> roster density needs >=2 -> falls to text hint "Washington".
  Korchinski "vs. Carolina" -> CAR, same bug.
- Shared: draws_in / IN-OUT changes never become tweet_player_events (Beck has 0 events today).

- Fixes (uncommitted): tweetInterpretation.ts (name-row gate on reviewShape; 2-name row with a forward claims no D slot;
  IN/OUT rows skipped as units; IN/OUT names drop trailing link + reason), linesCccIngestion.ts (resolveTeamFromLeadPlayerItem:
  "Full Name: ..." item -> that player's team when other teams appear only after vs./against/at/@). Tests in both .test.ts.
- Replay after fix: CAR D1-3 correct; MTL Beck in / Anderson out, no "IN"; Reinhardt -> FLA with draws_in resolved.
- Checks: new tests fail on HEAD, pass now; vitest lib/sources+lib/lines+LineCombinations+api lines+player-forecasts
  2757 pass / 39 skip; trainer regression vs HEAD baseline 0 fixed / 0 broken; typecheck exit 0; eslint clean.
- Public impact found in data: Reinhardt report filed under WSH (tweet_projection_reports team 15) and Korchinski under CAR,
  so their raw text is in those teams' report rails (code path; live page not checked).

- TJ pop-ups: roster fix here, keep history, commit no push. Parser commit 040c59341 (4 files).
- Roster-ending change built + tested, then measured: 532 rows ended, 230 players left with no current row
  (getPlayer throws; ~15 is_current consumers). TJ (2nd pop-up): park it. Patch saved to the notes folder; files reverted.
  Safer design proposed as card task_552f95bd (roster-last-seen).
- Findings note: side-session-notes/local_1fb55d9b.../lineup-ingestion-alert-2026-11-07.md. Scratch replay script deleted.

## Next
- None here. Release/push of 040c59341 needs TJ. Queue noise dismissal (b733f310, 44ef8dd0, d18b9430) is TJ's call.
- Open follow-up (Lines plan): draws_in / IN-OUT changes -> player events (Beck has 0 events).

## Blockers / approvals
- Push/release, queue dismissals and the roster-last-seen migration all need TJ.

## Insights
- A hyphen in prose ("10-1") was enough to claim a D slot: review shape must require a name-only row.
- The NHL roster API 403s Python urllib's default UA; curl works.
- update-players never ends send-downs; is_current has ~15 consumers, so don't change its meaning casually.

## Checkpoint 2026-11-07 ~19:45 UTC (parent inventory)
- roster-last-seen migration 20261107192933 is now APPLIED (TJ approved; authority row 119). Its reader/tie-break
  code is uncommitted in web/lib/sources/*. Stamps fill on the next nightly update-players run.
