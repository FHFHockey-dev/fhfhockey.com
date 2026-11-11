# Wave 2 (9 passes): run order

Each prompt goes in a **new** Fable chat. Start Wave 2 **after** `BATCH-BC-CONSOLIDATED.md` is committed, because every prompt reads it.

- **Batch D:** w2-1 SQL cross-cut · w2-2 underlying-stats part 1 · w2-3 underlying-stats part 2
- **Batch E:** w2-4 rankings part 1 · w2-5 draft tools · w2-6 lines/TOI/PP units
- **Batch F:** w2-7 season forecasts part 2 · w2-8 season forecasts part 3 · w2-9 BLSH

Run at most 3 at once; they share one small production database. Each writes `master/audits/<name>.md`. Astra peer review follows, as in Wave 1.
