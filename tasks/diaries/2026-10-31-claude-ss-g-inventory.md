# SS lane G: goalie inventory diary

- Scope: SS 11.0 only. Files per `tasks/artifacts/social-share-expansion-2026-10-31/LANES.md`, lane G.
- Where: octoberBranch, canonical checkout. Receipt: `tasks/artifacts/social-share-expansion-2026-10-31/lanes/g-inventory.md`.
- State: all subtasks built, including TJ's server-only confirmation read through the starter-board resolver. Tests, lint, tsc and pure check pass; spec discovered with `--list`, not run in a browser; no live read through the server credential yet.
- Next: the lead runs the spec and the live read at 13.0, and decides whether v2 adds a conflicting state.
- Blockers: none for this lane. Writer sets `source_account` null, so reporter disagreement cannot be detected live; see the receipt.
- Gotcha: `trendSources.ts` imports the public Supabase client, so `goalieInventory.sources.ts` imports readers lazily inside the loader. Keep it that way, because the Start/Sit card imports search from it.
- Gotcha: the server guard is `typeof window`, so the test file runs in the node environment; jsdom would make it return no client.
- Gotcha: `source_url` and `expires_at` are null on every live observation, so no link or expiry can be shown yet.

## Visual rework
Bars on Risky Starts and rank chips plus status colours on Start/Sit, one-hue thirds scale shared through `rankBand`. Fit still needs the lead's real-data render; adjust `RISKY_TILE_LIMIT` or `START_SIT_ROW_LIMIT` if it clips.

## TJ review rework
Shared winner rule, Risky Starts to the mockup (`~/Desktop/Untitled-1.png`), Start/Sit green and red chips with logos and triangle. Removed the blue `RANK_BANDS`. Fit needs the lead's real-data render.

## Market lines
Stored DraftKings first, NHL `/now` fallback, in `riskyStarts.sources.ts`. Dated NHL paths 404. Expect "No line yet" for most of a 7-day window. Fit is tight on a 4-pairing tile with wrapped goalies; check the lead's render.

## Audit F2, F3, F8
Tied ranks, puck-drop expiry and DraftKings-only stored lines. Gotcha: a high-first competition rank can't be reversed across a tie, so `lowFirstRanks` sits on the detail, outside v1. Full `tsc` reports one error in `goalieRescue.sources.ts`, not this lane's file; reported to the lead.

## Period control
Risky Starts and Start/Sit take the shared control, any-week, with `days` still the default and no calendar read on it. Past dates are never read: a part-played week reads from today, so a past game with no start time can't list. Gotcha: a blank matchup uses the pager's cutoff, yesterday, so on the day after a week ends a blank week names the week just ended and shows the no-upcoming state until ▶. The fix is in `shared/periodWindow.ts`, not this lane; reported to the lead. Gotcha: `edition()` settings in the spec must carry the period fields, or the export block reads them as changed settings.

## SS-1103-G (TJ 11-03 notes, section 2)
Items 1 to 5 are built. Item 6, the late-feed note, waits on ss-contract's `completeThrough` and `pageNotes`; the lead will message. Gotcha: no observation names an account, so no handle shows; the receipt has the reads. Gotcha: the Start/Sit search spec fails with two "Search goalie or team" inputs, because of the uncommitted `PostStudio.tsx` edits in another lane, not this lane.
Item 6 is done: late nights are judged on WGO team games only, and an NST lag stays partial. Gotcha: if the late-night check included NST, a team with no NST rows would make every night incomplete, and both posts would go unavailable.
G2 (coloured text labels): done. Start/Sit status chips are its own, so unchanged. Renders are from fixtures, because a real edition reads past the 50-row cap.

## SS-1103-G3 (2026-11-03)
- e9c7eb902: the records read alone is caught (riskyStartsWithRecords); a build error now throws. 67/67 riskyStarts tests, eslint 0, typecheck clean for these files. Not pushed.

- Chef outcome (2026-11-07): this lane's work shipped in #402 (f17bea20d), #403 (295b384da) and #404 (354336347). Lane closed; diary can be retired.
