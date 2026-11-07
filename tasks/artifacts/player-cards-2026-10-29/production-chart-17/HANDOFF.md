# Checkpoint17 — Production by Game

Usable current route: http://127.0.0.1:3125/player-cards/live?playerId=8476453&season=20262027&count=5&cardFormat=production-by-game . Explicit Load uses the existing bounded current NHL adapter.

Saved observed example (no fresh NHL calls): http://127.0.0.1:3125/player-cards/production-example?playerId=8476453&season=20262027&count=5&cardFormat=production-by-game . Click Load NHL results. This route intentionally replays Kucherov's2026-10-29 17:43UTC capture and labels it retained/not current. Other players use the current route, not this saved example.

## Implemented
Fourth selectable suite **Production by Game**, not an empty tab: actual window goals/assists/points/shots totals; point stacks partition goals/assists for each qualified appearance, chronological oldest→newest. Zero-point appearances retain a visible0/marker. Shared0–5point scale; larger totals stay labeled with an overflow arrow while drawing is capped. Dates are provider game dates; appearance spacing is explicitly not proportional calendar time. Chart scale, chronology, selected raw game evidence and metric definitions are in the same PNG snapshot manifest. Missing input never becomes an empty zero chart.

Approved1200×1020 artwork/header/layout outside analytics remains unchanged. Header pixels for BOTH sequential portrait treatments match checkpoint15 exactly, including player crop, logo and outline stack. Controls stay outside export. No invented overall rating, xG, isolated impact, league population or forecast.

## Verification actually run
-40Vitest/4files PASS, scopedTypeScript andESLint PASS. First test-only TS union-property access failed; corrected to property-presence assertion, firstreceipt preserved.
-After readability adjustment for3digit totals/overflow labels,15affectedUItests + render + actualbrowser rerun PASS.
-3 browser groups: saved NHL load, actual selected-game bars/rawtotals/chronology and manifest, both1200×1020PNG exports, exact headerpixel parity15, social File byte equality,5/10/20 cachedwindow changes, category switching,11/20shortsample,390/320 reflow and≥44px category control. Currentlive route exposes category withoutautomaticfetch. No network/source contract edits and **zero new NHL/provider/database reads** this slice.
-Final PNG inspected directly; desktop/mobile screenshots saved. Full phone-width card fineprint requireszoom, unchanged from accepted layout.200%zoom/RTL not verified.

## Source / runtime
Six owned paths in SOURCE-PINS.json/source.patch, including one absent-before chart component and appended taskplan. Base/currentHEADc91d8445; no Git actions. Previous source is untracked/dirty work, not impliedcommitted: correction to16handoff wording. Source custody checked; Claude PC historicallease released, no new conflictingwriter seen. BLSHpriority honored; testsacquiredonlyfreeheavy slot and released promptly.

Owned previewPID23434,127.0.0.1:3125, detached/noautorestart. HTML SHA376104ba91f90a178ccff25168dad63e91c215c9cf876f2217eb18d9d2f85bfb. Refresh helper initially matched oldreadylog and raced newstartup; checked actual23434listener andreadbacks, no duplicateprocess/restart. Latest current16 route remains byte-identical. KEEP-RUNTIME.json retains all old dependencies plus17. Keep source/captures/screenshots/manifests; no deletion/moving.

## Remaining / limits
This is descriptive observed production. No additional source was needed; all-NHL rank/N/percentile, NSTxG/onice/strengthsplits, actualendtime/historicalcutoff, milestonehistory, sustainability/impact/goalie suites remain unqualified. Current live loading from16 remainsavailable with5mincache and12GET/min/60GET/server-life cap, one3GETboundedload atatime. The saved example is intentionallyonlyKucherov and cannotqualifyotherplayers. Thursday remainsdownstream of cardacceptance. No new visualmodes/BLSHcrossover/dependencies/Git/deploy/uploads or deniedmessage retry.
