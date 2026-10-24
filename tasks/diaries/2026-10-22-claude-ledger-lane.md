# Ledger lane (Claude) — 2026-10-22

**Scope:** FORGE improvements task 1 (land Codex's paired scoreboard), then 6.3 (`market` ledger source). Chef: `local_08a0bf1c`.

**Where:** `/Users/tim/Code/fhfhockey.com` on `octoberBranch`. Lane files: `servedForecastLedger.ts`(+test), `pages/api/v1/forge/scoreboard.ts`, `tests/api/forge-scoreboard.test.ts`, snapshot/settle routes + tests, the new migration, `supportedBaselineMigration.test.ts`.

## Log
- Start: task 1 working-tree bytes match Codex SOURCE-PINS (base 84cb1229); no HEAD drift in lane files since.
- Task 1 checks: 32/32 focused tests, eslint 0, full `tsc --noEmit` under heavy lock exit 0. Committed `96e381ee0`. Confirmed dressed-only FP (`errors(dressedRows)`), expected-FP deciles (`fpBins` on forecast FP), pairwise joins; per-source `scoreLedger` remains only as `unpaired_descriptive_only`. Partial: F/D slices and TOI/PP-TOI opportunity/rate split (not persisted).
- 6.3 design: `market` rows (one per served player-game with pre-game prices). `exp_<head>` = implied mean (bisection under FORGE's distribution), so `scorePairedLedger` gives paired mean errors with market as reference. New jsonb `market_lines`: per prop head line, de-vigged P(over|no push), books, each served source's P(over) at that line (via `compareModelWithMarket`); goalie `team_win` = median Shin-devigged h2h vs bridge team-xG, scored on starts only, never as exp_win_prob. `scoreMarketLedger`: Brier/log loss/skill on same events; pushes, DNP, non-starts excluded. Quotes must be observed ≤ snapshot and < puck drop; decimal odds dropped by devig guards.
- Guard: `LEDGER_MARKET_ENABLED = false` → snapshot reads no prices/writes no market rows; scoreboard doesn't select `market_lines`. Market upsert runs after served rows; failure → 207 with marketError, served rows kept.
- Migration 99 drafted `supabase/migrations/20261022175519_forge_served_forecast_ledger_market_source.sql`, authority row pending; baseline test 99/6 pending. Settle route unchanged (source-agnostic; outcomes derived at scoring).
- Gotcha: snapshot uses morning (12:30Z) prices, not closing lines. Closing needs a pre-puck-drop capture — open decision.
- Gotcha: tree has Codex's uncommitted deletion of `20261021210000_in_season_sandbox_billing.sql` (not in authority); baseline test passes only with that deletion present.
- 6.3 committed `64b6bb8db` (flag off). Checks: 63/63 focused (ledger 26, scoreboard 6, snapshot 6, settle 4, baseline 21), eslint 0, full tsc: only error is another lane's uncommitted `planningReproducibility.test.ts`.
- TJ approved (pop-up) apply + flag on. Pre-check read OK (constraint name, no column, 1,596 rows). Applied → ledger 20261022181002; readback OK. Renamed file to ledger version, authority row 99 applied (66 applied, 5 pending), super-goal summary updated, flag true: `6f2f3ac58`.
- Next: nothing in-lane until ~2026-10-29 (task 3, FP audit Q3/Q4, needs TJ approval). Market rows start only after the next release (not pushed).
- Open: closing-line capture (snapshot is 12:30Z prices); props empty in prod so early market rows are mostly goalie team_win; HEAD-only baseline test depends on Codex's uncommitted deletion of `20261021210000_in_season_sandbox_billing.sql`.
