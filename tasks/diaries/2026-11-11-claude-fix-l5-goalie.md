# L5a goalie matrix and splits (Claude, 2026-11-11)

## Scope
Sub-session L5a of fix lane L5. Findings: W2-P0-9 (GSAA/60 unit + aggregate), W2-4 D9 (one Vollman QS; RBS per dec 106), dec 104 (one strength per view, hide Value Signal), dec 98 (visible sample floor).
Owned: `web/lib/rankings/{goalieMatrix,goalieMethodology,goaliePopulation,splits}.ts` + tests, `web/lib/splits/**`, `web/components/Rankings/{GoalieMatrixTable.tsx,GoalieTeamMatrixTable.test.tsx,SplitsPanel.tsx}`.

## Where
Branch octoberBranch, sole checkout. No code edits and no commits yet. L5 lead's CLAUDE-FIX-L5-CLAIM-20261111 already covers these paths (no new mailbox line needed). Codex mailbox: no claims on these paths since 11-10.

## State
Stopped on usage limit after the read-and-design pass. Nothing changed in code.

## Design (ready to implement)
1. GSAA (W2-P0-9, `goalieMatrix.ts` aggregateGoalieGameRows ~:727 and metricValue ~:621):
   - Unit adapter: `nst_*_counts_toi` is NST minutes (writer `update-nst-goalies.ts:114-116,478-497`; baseline view projects n5c.toi as-is). Rename `nst5v5ToiSeconds` to minutes; rate = GSAA x 60 / minutes. No magnitude rule.
   - Aggregate (dec 10): GSAA = SA x (1 - L) - GA from NST 5v5 counts (shots_against, goals_against); L = league SV% at the same strength over the goalie's window date range [min, max selected date] from population rows (L = 1 - sum GA / sum SA). Stop reading `nst_5v5_counts_gsaa`. League baseline = covered subset of rows with NST SA+GA, with coverage in meta and warning `partial_league_save_baseline` when not full (rule 13 labelled covered subset; strict would null the column because official relief rows lack NST rows).
   - Test fixture: goalie SA 25, GA 2, TOI 48.05 min; other goalie same date SA 2475, GA 159 -> GSAA -0.39 exactly, GSAA/60 -0.486992716 (current code with nst gsaa -0.39 gives -29.22). Second fixture: two dates with different daily league SV%, per-row NST gsaa summed vs aggregate differ. Relief stint fixture: 3.25 min.
   - Existing test "matches independently calculated pooled arithmetic" (gsaa_per_60 = 3, value signal 2.5) and "signed saved-goals" (gsaa -2) pin the defect: update with reason.
2. Strength (dec 104): add request param `strength: "5v5" | "all"` (default 5v5). Same metric keys, per-view column labels/sources; `nst_all_counts_*` columns exist in goalie_stats_unified. 5v5 view: SV%, Rel SV%, GSAx, GSAA/60, xGA/Shot, HD SV% (all 5v5 NST), FHFH 5v5 Bad Start % (new key, GSAx <= -2), FHFH Steal % (5v5, win and GSAx >= 1), Start Share. All view: official SV%, NST all-strength GSAx/GSAA/60/xGA/Shot/HD SV%, Vollman QS%, Vollman RBS% (SV% < .850), Start Share. Remove Value Signal from METRIC_COLUMNS (keep helper and key type). A known key not in the view falls back to save_percentage instead of 400.
3. Vollman QS (D9, dec 40): one function in goalieMethodology.ts; credited starter only; missing shots or league average = unavailable. Matrix: league avg = official all-situations regular-season SV% through as-of from population rows. Splits (`splitsServer.ts:825` uses .910 and longest-TOI starter): credited starter from wgo_goalie_stats.games_started by game_id; league avg from a season wgo_goalie_stats read limited to regular-season games (select `type` in fetchCurrentSeasonGames).
   - OPEN, material: web check (Sports-Reference blog 2014, Hockey-Reference with Vollman) says QS = SV% at least league average, or >= .885 when facing 20 or fewer shots; RBS = SV% < .850. Decision 40 text says "above" league average and ".885 when allowing <= 2 GA". Ask TJ by pop-up which to use (recommend the original, as decision 40 says to verify against it).
4. Sample floor (dec 98): UI already shows lowerable "Min Starts"/"Min Shots", but the page sends the skater defaults (season min GP 10; minToi "300" seconds sent as min_shots 300). API default min_starts 3 -> 5. In GoalieMatrixTable, below-floor rows currently show "No sample"/"Source pending"; label them "Insufficient sample" and show the raw value without rank.

## Tickets for L5 lead (not sent yet)
- rankingUrlState.ts: send `strength` on goalie path; parseGoalieMetric accept new FHFH bad-start key; goalie defaults min starts 5, min shots 100 (not minToi seconds).
- RankingsFilters.tsx: show Strength select (5v5/All) for goalies.
- pages/rankings.tsx:435-447 goalie methodology text mentions value signal and "Min N shots".
- L4a: committed season goalie view repeats minutes x 3600 (`production_schema_baseline.sql:11399-11404`, nst_all_gsaa_per_60, nst_5v5_gsaa_per_60, gaa, etc.) and sums per-game GSAA.

## Next
Ask TJ the QS boundary question, then implement 1 -> 4 with failing-first tests.

## Gotchas
- Do not copy the factor fix into `playerImpactRatings.ts`.
- goaliesGameStats (Splits source) has no starter flag.

## Checkpoint 2 (resumed after limit; lead: follow dec 40 as written, tickets accepted)
- goalieMethodology.ts: classifyVollmanQualityStart (above league avg, or >= .885 with <= 2 GA; original wording in comment), classifyVollmanReallyBadStart (< .850), calculateLeagueSavePct. Tests 13 pass.
- goalieMatrix.ts: strength param (5v5 default | all), per-strength columns, Value Signal hidden, new key fhfh_5v5_bad_start_rate, Vollman QS/RBS in all view, GSAA aggregate + NST minutes adapter, min_starts default 5, meta.strength + meta.sampleFloor. goaliePopulation.ts: nst_all_counts_* passthrough.
- Fail-first proof (HEAD copy in a temp file, deleted): GSAA fixture -29.219563 vs -0.486993; window baseline -12 vs 0.2; relief 1107.69 vs -11.08; Vollman QS 0 vs 0.5. After fix: 102 pass (matrix, methodology, population).
- Next: Splits server, GoalieMatrixTable "Insufficient sample", typecheck/lint, commit, ticket.

## Checkpoint 3 (committed)
- Commit e023c5ee5 (9 files, explicit pathspecs). Splits: shared Vollman QS, credited starter from wgo_goalie_stats, league SV% from regular-season official logs (new splitsServer.test.ts, 4 tests). Table: "Insufficient sample" state (fails on HEAD, passes now).
- Checks: vitest 10 related files: 149 pass, 1 fail (`__tests__/pages/rankings.test.tsx` percentile sentence; lead's wording, not L5a). typecheck exit 2: only `__tests__/pages/rankings.test.tsx` fixture (strength, fhfh key) -> in ticket. eslint changed files exit 0.
- Ticket: side-session-notes/local_78a99adf.../L5a-goalie-ticket-2026-11-11.md.
- Commit 96a935599: TJ chose original Vollman QS (>= avg, or >= .885 with <= 20 shots); boundary tests added.
