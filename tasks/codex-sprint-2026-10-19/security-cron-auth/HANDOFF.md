# C-F2 handoff — bounded implementation ready for Chef review

Owner: `01a1566f-c3e3-7fc0-9dd4-2f71a4a62233`. Runtime `session_meta.id` matches own `CODEX_THREAD_ID`; `turn_context.model=gpt-6.1-sol`, `effort=high`. Branch observed: `octoberBranch`. All edits remain uncommitted. Ownership is released to Chef for review.

## Result and evidence boundary

Reordered **74 of the 96 A! inventory callers** so the default export is `adminOnly(withCronJobAudit(...))`. The Teams route stored `adminOnly` in its local handler variable; moved that same auth boundary to its export. Authentication remains the real existing admin/cron/local-dev middleware. Existing admitted handler composition, method logic, options, job names, response payloads/statuses and operational auditing are preserved. Rejected 401/403 calls no longer enter the audit wrapper on these callers.

**22 A! consumers are explicitly excluded below; F2 is not globally resolved.** Chef separately reserved cron-report. No shared audit/auth helper was edited. No production/deployed behavior is claimed.

`SOURCE-CHECK.json` records final route SHA-256 values and source comparison results: every clean original matched its pre-edit hash/HEAD; every admitted handler expression and audit-option expression remains byte-identical; source outside the moved wrapper is unchanged. For P6 team-daily, reversing this lane's single export replacement reproduces its exact pre-edit dirty SHA-256, preserving all deadline/source changes. This is source evidence across 74 callers, with synthetic runtime evidence for two representative actual exports (named handler with options and inline handler), rather than a claim of exercising all 74 business operations.

## Checks actually run

| Check | Result |
| --- | --- |
| `cd web && npm test -- __tests__/pages/api/v1/db/cron-audit-wrappers.test.ts` | PASS, exit 0; 18 tests. Includes 74-caller AST source completeness, actual named/inline exports with missing/malformed/invalid user tokens and non-admin role: unchanged 401/403 and zero audit/business calls; valid cron/admin admission: one audit and business operation; admitted method rejection: unchanged 405/Allow/body and one failure audit. Existing schedule coverage checks remain passing. |
| `cd web && npm test -- __tests__/pages/api/v1/db/update-nst-team-daily.test.ts` | PASS, exit 0; all 7 existing P6 mocked tests. Test's dotenv module is mocked; no local secret file loaded. Existing test file unchanged by C-F2. |
| One-off local TypeScript AST/source comparison against BASELINE.json | PASS, exit 0; 74/74 ordering, unchanged handlers/options/non-wrapper source, P6 dirty source preserved, all three shared helper hashes unchanged. Receipt: SOURCE-CHECK.json. |
| `git diff --check -- <the 74 owned routes> <existing focused test>` | PASS, exit 0; explicitly scoped path list from BASELINE.json. |
| Global typecheck/lint/build/full suites/browser/network/provider/hosted checks | NOT RUN; Chef owns global checks; network/builds prohibited. |

No failed test, retry, running process or unresolved local blocker remains. First focused suite was session 94345; final poll confirmed exit 0. P6 suite completed directly with exit 0. No Git mutation, package/config/generated output change, hosted request, deployment, migration or provider request was made.

Supabase auth guidance was consulted from the installed Supabase skill. Ticket's explicit local-only constraint superseded its generic outbound docs/query steps; all clients and business dependencies used in behavioral checks were synthetic mocks.

## Exact files changed by C-F2

- `web/pages/api/Teams/nst-team-stats.ts`
- `web/pages/api/v1/db/backfill-goalie-underlying-season.ts`
- `web/pages/api/v1/db/backfill-player-underlying-season.ts`
- `web/pages/api/v1/db/backfill-team-underlying-season.ts`
- `web/pages/api/v1/db/calculate-wigo-stats.ts`
- `web/pages/api/v1/db/catch-up-goalie-underlying.ts`
- `web/pages/api/v1/db/catch-up-player-underlying.ts`
- `web/pages/api/v1/db/catch-up-team-underlying.ts`
- `web/pages/api/v1/db/cron/update-stats-cron.ts`
- `web/pages/api/v1/db/draft-ranker-health.ts`
- `web/pages/api/v1/db/powerPlayTimeFrame.ts`
- `web/pages/api/v1/db/refresh-draft-ranker-community.ts`
- `web/pages/api/v1/db/refresh-draft-ranker-discovery.ts`
- `web/pages/api/v1/db/register-nhl-xg-model.ts`
- `web/pages/api/v1/db/run-fetch-wgo-data.ts`
- `web/pages/api/v1/db/sustainability/rebuild-baselines.ts`
- `web/pages/api/v1/db/update-PbP.ts`
- `web/pages/api/v1/db/update-entity-metric-rankings.ts`
- `web/pages/api/v1/db/update-games.ts`
- `web/pages/api/v1/db/update-goalie-underlying-stats.ts`
- `web/pages/api/v1/db/update-goalie-underlying-summaries.ts`
- `web/pages/api/v1/db/update-line-combinations/[id].ts`
- `web/pages/api/v1/db/update-line-combinations/index.ts`
- `web/pages/api/v1/db/update-lineup-deployment-tallies.ts`
- `web/pages/api/v1/db/update-market-prices.ts`
- `web/pages/api/v1/db/update-nhl-edge-stats.ts`
- `web/pages/api/v1/db/update-nhl-play-by-play.ts`
- `web/pages/api/v1/db/update-nhl-shift-charts.ts`
- `web/pages/api/v1/db/update-nhl-xg-aggregates.ts`
- `web/pages/api/v1/db/update-nhl-xg-shot-predictions.ts`
- `web/pages/api/v1/db/update-nhlscraper-contracts.ts`
- `web/pages/api/v1/db/update-nst-current-season.ts`
- `web/pages/api/v1/db/update-nst-goalies.ts`
- `web/pages/api/v1/db/update-nst-team-daily.ts`
- `web/pages/api/v1/db/update-player-impact-ratings.ts`
- `web/pages/api/v1/db/update-player-trend-metrics.ts`
- `web/pages/api/v1/db/update-player-underlying-stats.ts`
- `web/pages/api/v1/db/update-player-underlying-summaries.ts`
- `web/pages/api/v1/db/update-player/[playerId].ts`
- `web/pages/api/v1/db/update-players.ts`
- `web/pages/api/v1/db/update-power-play-combinations/[gameId].ts`
- `web/pages/api/v1/db/update-power-play-combinations/index.ts`
- `web/pages/api/v1/db/update-rolling-games.ts`
- `web/pages/api/v1/db/update-season-stats.ts`
- `web/pages/api/v1/db/update-seasons.ts`
- `web/pages/api/v1/db/update-shifts.ts`
- `web/pages/api/v1/db/update-skater-composite-ratings.ts`
- `web/pages/api/v1/db/update-sko-stats.ts`
- `web/pages/api/v1/db/update-standings-details/index.ts`
- `web/pages/api/v1/db/update-stats/[gameId].ts`
- `web/pages/api/v1/db/update-team-ctpi-daily.ts`
- `web/pages/api/v1/db/update-team-power-ratings.ts`
- `web/pages/api/v1/db/update-team-sos.ts`
- `web/pages/api/v1/db/update-team-unit-toi.ts`
- `web/pages/api/v1/db/update-team-yearly-summary.ts`
- `web/pages/api/v1/db/update-wgo-averages.ts`
- `web/pages/api/v1/db/update-wgo-goalie-totals.ts`
- `web/pages/api/v1/db/upsert-csv.ts`
- `web/pages/api/v1/game-predictions/accuracy-loop.ts`
- `web/pages/api/v1/game-predictions/backfill-feature-snapshots.ts`
- `web/pages/api/v1/game-predictions/backtest-ablation.ts`
- `web/pages/api/v1/game-predictions/backtest.ts`
- `web/pages/api/v1/game-predictions/feature-signal-analysis.ts`
- `web/pages/api/v1/game-predictions/forecast.ts`
- `web/pages/api/v1/game-predictions/generate.ts`
- `web/pages/api/v1/game-predictions/import-market-odds.ts`
- `web/pages/api/v1/game-predictions/ingest-espn-odds.ts`
- `web/pages/api/v1/game-predictions/promote-model-version.ts`
- `web/pages/api/v1/game-predictions/score.ts`
- `web/pages/api/v1/sustainability/process-recompute-queue.ts`
- `web/pages/api/v1/sustainability/rebuild-priors.ts`
- `web/pages/api/v1/sustainability/rebuild-score.ts`
- `web/pages/api/v1/sustainability/rebuild-trend-bands.ts`
- `web/pages/api/v1/sustainability/rebuild-window-z.ts`
- `web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts`

Focused test final SHA-256: `50dc68fe434edcf95e9483761349e9e3b91591e52b55c7878d03e0da1da58195`. Route hashes: SOURCE-CHECK.json. Baseline/source-helper hashes: BASELINE.json.

## Exact lane files created by C-F2

- `tasks/codex-sprint-2026-10-19/security-cron-auth/OWNERSHIP.md`
- `tasks/codex-sprint-2026-10-19/security-cron-auth/BASELINE.json`
- `tasks/codex-sprint-2026-10-19/security-cron-auth/SOURCE-CHECK.json`
- `tasks/codex-sprint-2026-10-19/security-cron-auth/HANDOFF.md`

Preexisting C-F2-TICKET.md was read only. REGISTER.md and all other-owner notes remain outside ownership.

## Every excluded A! consumer

| Inventory row | Source path | Reason |
| --- | --- | --- |
| 18 | `web/pages/api/internal/sync-yahoo-players-to-sheet.ts` | Yahoo internal-secret sheet writer; bespoke auth also outside export-only scope |
| 93 | `web/pages/api/v1/db/auto-news-feed-items.ts` | Active adjacent owner: auto-news-feed-items |
| 97 | `web/pages/api/v1/db/build-projection-derived-v2.ts` | Active adjacent owner and fenced projection/FORGE imports |
| 103 | `web/pages/api/v1/db/cron-report.ts` | Chef reserved cron-report for email-contract task |
| 104 | `web/pages/api/v1/db/cron/update-roster-optimizer-schedule-daily.ts` | Active adjacent RSO owner; untracked route and fenced rosterScheduleData imports |
| 108 | `web/pages/api/v1/db/ingest-projection-inputs.ts` | Active adjacent owner and fenced projection/FORGE imports |
| 109 | `web/pages/api/v1/db/manual-refresh-yahoo-token.ts` | Yahoo token route |
| 119 | `web/pages/api/v1/db/run-projection-accuracy.ts` | Literal run-projection* fence and projection imports |
| 120 | `web/pages/api/v1/db/run-projection-v2.ts` | Literal run-projection* fence and projection imports |
| 121 | `web/pages/api/v1/db/run-rolling-forge-pipeline.ts` | Literal run-*forge* fence and projection/FORGE imports |
| 127 | `web/pages/api/v1/db/sweep-gamecenter-normalization.ts` | Active adjacent sweep-gamecenter-normalization owner |
| 132 | `web/pages/api/v1/db/update-game-goal-projections/index.ts` | Projection consumer; conservative Claude adjacency exclusion |
| 134 | `web/pages/api/v1/db/update-goalie-projections-v2.ts` | Projection consumer with fenced projection import |
| 141 | `web/pages/api/v1/db/update-line-sources.ts` | Active adjacent update-line-sources owner; tweet/IFTTT and projection adjacency |
| 142 | `web/pages/api/v1/db/update-lines-ccc.ts` | Active adjacent update-lines-ccc owner; tweet/IFTTT adjacency |
| 144 | `web/pages/api/v1/db/update-lineup-source-provenance.ts` | Lineup source/tweet provenance consumer; conservative IFTTT adjacency exclusion |
| 169 | `web/pages/api/v1/db/update-player-statuses.ts` | Tweet/news status provenance consumer; conservative IFTTT adjacency exclusion |
| 179 | `web/pages/api/v1/db/update-rolling-player-averages.ts` | FORGE pipeline dependency; conservative Claude adjacency exclusion |
| 194 | `web/pages/api/v1/db/update-teams.ts` | FORGE link dependency; conservative Claude adjacency exclusion |
| 200 | `web/pages/api/v1/db/update-yahoo-players.ts` | Yahoo player writer |
| 201 | `web/pages/api/v1/db/update-yahoo-weeks.ts` | Yahoo week writer |
| 257 | `web/pages/api/v1/ml/update-predictions-sko.ts` | SKO prediction control consumer; conservative adjacent pipeline ownership exclusion |

Ownership released: all 74 declared callers and the focused test, plus this lane receipt. Shared wrappers and excluded callers retain their prior/other-owner state; any further F2 work there requires the appropriate owner and fences to clear.
