# Diary: fix lane L7 (sustainability, trend bands, /charts) — Claude, started 2026-11-12

## Scope
W1 P0 #23 (band TOI fallback 60x), #24 (Sandbox band status vs own interval), #25 (/charts career averages), plus brief P1/P2 rows where cheap; L3 parseTime caller tickets. Brief: tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L7.md. Chef: local_78a99adf.

## Where
octoberBranch, sole checkout. Claim appended to CLAUDE-TO-CODEX.md (CLAUDE-FIX-L7-CLAIM-20261111); no Codex claim on L7 paths in last 60 lines of CODEX-TO-CLAUDE.md.

## Constraints
FORGE (L9a: skater-queries.ts, trend-adjustments.ts) reads band status with own-value-vs-own-interval test; inert today. Don't switch FORGE on unvalidated.

## Log
- 2026-11-12: read brief, rules, decisions 17/26/32-37/61/68/90, BC W1-9, W2-1 F2, W3-6. Claimed.
- Checkpoint 1 (band): bandCalculator rewritten collectors (WGO counts/WGO seconds, NST counts/NST seconds, 5v5 pts/toi_per_game_5v5, unknown=null, out-of-domain=null), fixed window membership (gamesAgo < N), matched-pair baselines (no ES-GF / ev fallbacks), beta value = posterior mean, percentile=null, model v3. New lib/sustainability/usualRange.ts: NB / beta-binomial predictive central 80% from PRE-WINDOW seasons (season_id < snapshot season), stored in distribution.usualRange; value/ci_lower/ci_upper keep posterior meaning so FORGE stays inert.
- Test __tests__/pages/api/v1/sustainability/trend-bands-values.test.ts: 8/8 FAIL on HEAD bandCalculator (EWMA 0.614 vs 10 for #23 = Astra 0.61), 8/8 pass after.
- Checkpoint 2: Sandbox (3 places) reads status from distribution.usualRange via readUsualRange (unknown when absent: pre-rebuild rows drop out of band chart/streaks, cards say "Usual range unavailable"); entitySurfaceServer comparisons use observed (N3). Fantasy Score (FHFH default) label (N6). #25 CareerAverages pooled (computeCareerAverages; completed seasons only; xS%=ixG/iFF; OZS%=OZ/(OZ+DZ); NBSP header match). SustainabilityStats: unknown->null, xS% ixG/iFF, SOG/60 null on unknown TOI. score.ts F2 per-metric pooling. All new tests fail on HEAD versions, pass now. FORGE guard test: hot usual range -> FORGE within_band_neutral.
- Mailbox: claim already in HEAD (committed inside L15's 412e9870f); working-tree diff on CLAUDE-TO-CODEX.md is another session's dedupe: do not commit it.
- Deferred: A2 all-missing score (needs nullable score/guardrail state), A4/A5 priors as-of + league prior versioning (decision 68), A6 normal variance floor, normal-metric usual range (no baseline dispersion), D9 PDO, N5 forecast intervals (decision 37 unserved), D13 quintiles (schema ticket), position prior for rookies (decision 34), D5 baseline payloads.
- 2026-11-12 Chef round 2 (b5ee2aca0 verified): A2 + D12 (chart granted).
  - A2: guardrails.assessSustainabilityScoreCoverage: blocked when no luck or no skill input known (my choice of "below coverage", reported); partial -> degraded "guardrail_partial_inputs" + inputCoverage. Producer skips blocked rows (rebuild-score reports rows_skipped_insufficient_inputs); null eb_z no longer reads 0. Served: trends feed drops blocked (dashboard/FORGE page), read.ts player/summary null + score_state, leaderboard excludes, Sandbox list excludes / selected row score null. s_100 NOT NULL in DB: no migration needed. 5 tests fail on HEAD, pass.
  - D12: lib/sustainability/careerComparison.ts (usual range per window vs pooled career); routes return components; chart colours red only outside range in unsustainable direction, grey = insufficient; xS% description = ixG ÷ iFF × 100. Render test fails on HEAD chart.
