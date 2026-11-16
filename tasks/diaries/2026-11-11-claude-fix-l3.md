# Diary: fix lane L3 (variance pages, roster matrix, TOI parser), 2026-11-11

## Scope
Brief: `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L3.md`. Findings W2-P0-8, W2-3 A3, W2-2 D6, D7, D8, D9, PR-U1/U2/U4, W2-3 A5, W3-3 D4, BA rule 5 (Supabase log). Decisions 10, 40, 73, 97, 98.
Owned: GoaliePage/**, pages/goalies.js (+ variance/goalies.js re-export), lib/supabase/GoaliePage/**, SkaterPage/**, pages/variance/skaters.tsx, RosterMatrix/**, lib/NHL/TOI.ts.

## Where
Branch octoberBranch, sole checkout. Claim line appended to CLAUDE-TO-CODEX.md (no Codex claims on these paths in the last 60 lines of CODEX-TO-CLAUDE.md).

## State / checks
- Start: all owned files clean.

## Next
Read skater variance code (W2-P0-8, A3).

## Blockers
None.

## Gotchas
- `TOI.ts` parseTime is read by three API routes (SustainabilityStats, CareerAverages, Teams) not owned by L3: callers' `|| 0` cannot be changed here.

## Checkpoint 1: skater variance (W2-P0-8, W2-3 A3)
- `individual_sat_for_per_60` comes from the NHL puck-possession report, whose TOI field is `timeOnIcePerGame5v5` (same row, stored as `toi_per_game_5v5`, seconds). iCF/60 now = Σ(rate×5v5 s/3600) ÷ Σ 5v5 s × 3600, labelled "iCF/60 (5v5)"; unknown if any game lacks either. Inference to flag: the 5v5 basis is read from the report's field set, not a saved NHL definition.
- IPP / ixG/60 columns and fields removed (never selected anyway); on-ice `nst_oi_cf_per_60` fallback removed.
- All per-60s use per-game (count, TOI) pairs; any unknown → null.
- Fail-first: HEAD source + new tests → 4 fail (undefined/14-type, 6 G/60, 4.74 HIT/60). Fixed → SkaterPage 24/24 pass.

## Checkpoint 2: /goalies (D6, D8, D9, PR-U1, PR-U2, PR-U4)
- D8/97: `buildLeagueWeeklyAverage` moved from goalies.js into goalieCalculations.ts; bar = starters only (≥1 GS, ≥1,200 s, NHL API timeOnIce seconds); SV%/GAA null on zero denominators. New `gradeGoalieWeek`: ties 0.5 credit, no comparable stat → null (unclassified). Page + GoalieList use it. Wks (eligibleWeeks) column added.
- Legacy `calculateWeeklyRanking` kept unchanged because `lib/socialShare/modules/goaliePeriod.ts` (not L3) reads it and its tests pin tie=Elite / zero-baseline=Abysmal → ticket to Chef.
- D9/98: SD null below 2 samples; value tier cohort = GS ≥ floor (default 5, page input "Value Tier Floor (GS)"); unknown parts → no tier, "Insufficient sample".
- D6/10: GSAA = ΣSA×(1−league SV%)−ΣGA per strength, league pooled from the fetched window's rows; per-game NST gsaa no longer selected.
- PR-U2: per-60s paired per game (NST toi minutes adapter); QS% over starts, unknown if any start's QS unknown. PR-U3 (distance weighting) not in brief: untouched.
- PR-U1: `fetchGoalieAdvancedMetricsRows` (season + date window, ordered, ranged pages of 1,000); page refetches when the applied range/week changes.
- Fail-first: HEAD goalie sources + new tests → 13 fail; now 35/35 pass. HEAD goalies.js bar for the relief fixture = (28+24+2)/3 = 18 (so 24 saves = Elite at HEAD).

## Checkpoint 3: roster matrix, TOI, log; commit
- RosterMatrix: new `rosterMatrixData.ts` (aggregateNstGoalieGamelog, buildRosterPlayer). GAA = GA×60/NST minutes; LD SV% and GSAA unknown (no LD saves stored; no per-game GSAA sum); NST NULL rates → undefined → "-"; age/height via WiGO playerBiography. HEAD values on the test fixture: GAA 205.71, LD SV% 42.9% (from HD saves), GSAA −1.0 (summed), height 5'12", age 25 (birthday on the day).
- TOI.ts parseTime: "20"→20, "20:30"→20.5, unknown NaN (number kept for 3 non-L3 callers; ticketed). HEAD: "20"→NaN, "20:75"→21.25.
- updateWeeklyData.ts: URL/key log lines deleted by exact-match sed; value never printed.
- Checks: vitest 56 files / 1,340 tests pass (GoaliePage, SkaterPage, RosterMatrix, TOI, socialShare, TeamTabNavigation, trueGoalieValue); `npm run typecheck` exit 0; eslint on 21 changed files exit 0. No .module.scss edits. Browser check not run: /goalies calls the NHL API from the client (provider calls not allowed).
- Commit ccb414c43 (22 files incl. only the L3 mailbox block; L2's uncommitted claim line left in the working tree).
- Hand-over + tickets: side-session-notes/…/L3-handover-2026-11-11.md.

## Next
Report to Chef; wait for verification.

## Checkpoint 4: Chef typecheck query
- Chef reported TOI.ts breaking typecheck in 3 callers. That was the intermediate `number | null` version; committed ccb414c43 returns `number` (NaN = unknown), and TOI.ts is clean. Typecheck re-run: exit 2, errors only in L2's uncommitted `lib/underlying-stats/teamStatsQueries.test.ts:193`. Sent Chef the caller ticket (pooled ΣShots/ΣTOI, null on unknown TOI).

## Checkpoint 5: Chef items (commit 8ec8bbe19)
- iCF/60 basis: no repo proof. The ingest is `skater/puckPossessions` (update-wgo-skaters.ts); only `faceoffPct5v5`/`timeOnIcePerGame5v5` name 5v5; schema docs give no definition; the test fixture (update-wgo-skaters.types.test.ts) is synthetic. Relabelled "iCF/60 (NHL puck-possession report)", field `individualCorsiForPer60`. **Open verification:** confirm from a saved NHL report definition (no provider call made) whether `individualSatForPer60` is 5v5 over `timeOnIcePerGame5v5`; only then restore a strength label.
- Teams route (granted): `pooledShotsPerSixty` Σshots/ΣTOI×60, null on unknown; 3 handler tests (2 fail on ccb414c43: 4.5 vs 5.5, 7.5 vs null). Other per-season means in that route (S%, xS%, IPP, oiSH%, secA%, oZS%) are also means of rates: not asked, noted for Chef.
- Checks: vitest 6 files / 64 tests pass; eslint exit 0; typecheck exit 2 with 45 errors, none in L3 files (rankings L5 and underlying-stats xG in progress).
- Callers 1–2 → L7; goaliePeriod.ts → L18 (per Chef).

## Checkpoint 6: Teams route career rates (lane close)
- Components from the repo's NST header maps (update-nst-player-reports.ts): all present on the page, so no value needed to be nulled for missing components.
- S%, xS%, secA%, oiSH%, oZS%, IPP pooled; count means null on unknown. 9 new tests fail on 8ec8bbe19, all 12 pass now. ESLint exit 0; typecheck exit 2 with 7 errors, all in L5 rankings tests.
- Lane closed after this commit. Open: verify the puck-possession iCF/60 strength basis (see checkpoint 5).
