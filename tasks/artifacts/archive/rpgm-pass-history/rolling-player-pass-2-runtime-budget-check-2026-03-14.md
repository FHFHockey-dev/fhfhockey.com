## Rolling Player Runtime Budget Check - 2026-03-14

### Goal

Add a script-level runtime check that fails clearly when the daily rolling-player path exceeds the agreed runtime envelope.

### Implementation

Added:

- [check-rolling-player-runtime-budget.ts](/Users/tim/Code/fhfhockey.com/web/scripts/check-rolling-player-runtime-budget.ts)
- package script:
  - `npm run check:rolling-player-runtime-budget -- --profile daily_incremental --date YYYY-MM-DD`

### Script Behavior

- runs the real `fetchRollingPlayerAverages.main(...)` path
- supports:
  - `--profile daily_incremental|overnight|targeted_repair`
  - `--date YYYY-MM-DD`
  - `--startDate YYYY-MM-DD`
  - `--endDate YYYY-MM-DD`
  - optional overrides for:
    - `--playerConcurrency`
    - `--upsertBatchSize`
    - `--upsertConcurrency`
    - `--budgetMs`
- prints a structured summary with:
  - measured duration
  - configured budget
  - `withinBudget`
- exits non-zero when the measured runtime exceeds the profile budget

### Verified Daily Check

Command:

```bash
npm run check:rolling-player-runtime-budget -- --profile daily_incremental --date 2026-03-12
```

Observed result:

- profile: `daily_incremental`
- date window: `2026-03-12` to `2026-03-12`
- processed players: `504`
- rows upserted: `2016`
- duration: `104182ms` (`1m 44s`)
- budget: `270000ms` (`4m 30s`)
- `withinBudget: true`

### Operational Interpretation

- this is now a real enforcement surface, not just a benchmark artifact
- it gives operators and follow-up tasks a single command that can fail clearly if the daily runtime regresses beyond the agreed envelope
- it is intentionally separate from the default full-suite verification because it hits the live rolling pipeline
