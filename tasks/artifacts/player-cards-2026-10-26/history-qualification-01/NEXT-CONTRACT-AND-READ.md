# Narrow next implementation: date binding and finality precision

This is an artifact-only contract candidate; no runtime or admission change.

## Two dates for one game

GAME-DATE-MAP.json binds all11official game-log rows to the schedule by gameId, season, type, date, team and opponent. Three source dates differ from UTC start dates. Keep sourceGameDate for NST date-row matching and utcStartDate for the explicitly proposed UTC calendar policy; both remain bound to the same official gameId. Do not rewrite stored date_scraped to UTC or use one date for both jobs. A complete-history receipt needs the source→calendar binding, not a self-asserted UTC label.

Existing nstCapture.ts indexes source rows by date_scraped but looks them up with game.date; windows.ts also treats game.date as UTC. Renaming that single field silently will lose the shifted-day rows or select the wrong calendar day. A bounded next change can introduce an explicit independently verified source-date binding while retaining canonical calendar dates. Duplicate/ambiguous mappings must remain missing. Current runtime stays fail-closed until that is reviewed.

## Minute-resolution official finality

The actual official GS report for2026020167 identifies the matching game, final result, date and teams and prints Start7:09MDT / End9:58MDT. The official landing supplies scheduled evening start01:00UTC and America/Denver offset-06. With the explicitly recorded diagnostic ambiguity bounds, the end is in [2026-10-24T03:58:00Z,2026-10-24T03:59:00Z). The report does not provide seconds or AM/PM; no admission is made. The conversion assumptions in REPORT-QUALIFICATION.json need review and must not be silently promoted into business facts.

The current FinalityReceipt only accepts an exact endedAt instant. Adding00seconds invents precision; substituting ingestion time invents meaning. The smallest contract addition is an official-report-end interval plus explicit precision, timezone/source bindings and reviewed AM/PM disambiguation. For a cutoff, a game is definitely completed when endUpperBound<=cutoff; definitely not complete when endLowerBound>cutoff; overlap remains unknown. Sorting/window rules must preserve that uncertainty rather than treating a bound as the exact actual end. Existing exact-second receipts remain supported.

This is an engineering evidence-contract change, not a request for a new owner ranking policy or a live activation. Parent independent review should accept the precise semantics before any actual admission.

## Smallest next public source read

Once the precision/date contract is reviewable, one official Game Summary for the next candidate game2026020151 provides a second timezone/date-boundary control:
GET https://www.nhl.com/scores/htmlreports/20262027/GS020151.HTM
Scope: that one game only; no DB/project/table, no player-data aggregation or NST calls. One execution, concurrency1,5srequest/15sprocess,2MiBbody, no redirects/retries/fanout. Preserve exact HTML/hash and validate expected displayed game0151, season20262027, TBL/VGK, source date2026-10-20, against GAME-DATE-MAP.json. Reject mismatches. This request is proposed only, not executed in this checkpoint.

No league-population query is proposed yet: provider definitions/null-zero semantics and compatible all-position data coverage must be settled before choosing a valid pool inventory. A roster snapshot or skater-only NST pos=S request would not meet the requested cohort contract.
