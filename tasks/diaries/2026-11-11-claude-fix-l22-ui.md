# 2026-11-11 · Claude · fix L22 UI sub-lane (market odds + decision 42 notice)

## Scope
Sub-lane of L22 (parent session local_6a79c316…). Owned: NEW `web/lib/game-predictions/marketOdds.ts` (+ test), `web/components/GamePreview/**`, `web/pages/stats/game/**`, `web/pages/game/[gameId].tsx` + `GamePage.module.scss` only if needed.
Findings: BC W1-10 A odds pairing (P2); decision 42 notice + labelled market (TJ: keep labelled); 50/50 display.

## Where
Branch octoberBranch, sole checkout. Mailbox claim already made by parent (CLAUDE-FIX-L22-CLAIM-20261111), no Codex overlap on these paths.

## Decisions
- Source format for NHL `/schedule/{date}` offers: signed integer |v|≥100 = American; unsigned value with decimal point and >1 = decimal; unsigned integer ("150") = ambiguous → unavailable; anything else invalid.
- One provider for both sides: order 9, 8, then lowest providerId; a provider with duplicate offers on a side, an invalid/ambiguous price, or a book sum outside devig.ts [MIN_VALID_BOOK_SUM, MAX_VALID_BOOK_SUM] is skipped. No complete pair → unavailable (never cross-book).
- De-vig method: proportional (devig.ts `devigProportional`). Display rounding via `homepageWinPair.displayedWinPair` (sums to 100; 50/50 → tie).
- Colouring on both pages is by side (away secondary, home primary), not by favourite, so item 3 needs no colour change; covered by a 50/50 test.
- Started games (schedule gameState not FUT/PRE): odds treated as stale → unavailable state (decision 42 "stale → unavailable").

## State / checks
- (start) reading done.
- Fail-first (pre-fix code): `GamePreview.test.tsx` 3 new tests fail (no notice; cross-book fixture provider 9 away / 8 home still renders "BOS 44%" bar instead of the unavailable state; untimed schedule still renders). `__tests__/pages/stats/game/[gameId].test.tsx` 2 fail (no notice/heading; cross-book renders bar, "Market odds unavailable." absent). `marketOdds.test.ts` fails: module does not exist (import unresolved).

- Implemented `marketOdds.ts` (+17 tests), GamePreview + stats page use it; notice + "Market win probability" heading + "De-vigged sportsbook odds · <partner> · as of <client fetch time>" sub-label; schedule fetchers stamp `fhfhFetchedAt`; no fetch time → unavailable.
- Tests pass: marketOdds 17, GamePreview 8, stats page 2 (27 total). eslint on 6 changed files exit 0. CSS Modules pure check OK on both .module.scss.
- Rendered check: isolated `PLAYWRIGHT_ISOLATED_NEXT=1 next dev -p 3117` (stopped by PIDs 57912/57876/57851), Playwright with all /api answered by fixtures and every external host aborted (no NHL calls). /stats/game and /game at 1440 and 375, same-book and cross-book: notice shown everywhere; same-book "BOS 44% / NYR 56%" + "De-vigged sportsbook odds · DraftKings · as of 8:56 PM"; cross-book unavailable state; 0 px horizontal overflow. Script + shots in session scratchpad.
- No /game page edit needed (renders GamePreview; Poisson chart still imported, unrendered).

- `npm run typecheck` exit 2: 60 errors, 0 in my files (14 in lib/game-predictions/accountability.test.ts from the parent's uncommitted `tieGames` change; rest DraftDashboard / draft-pro / draftDashboard / useVORPCalculations / projectionsRanking / fantasy-projections).
- Committed 99c42265b (8 files, explicit pathspecs, no push). Diary left uncommitted (working notes).

## Next
Parent L22 verifies; retire this diary once accepted.
