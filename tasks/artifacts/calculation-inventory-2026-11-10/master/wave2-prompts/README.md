# Wave 2 (9 passes): run order

Each prompt goes in a **new** Fable chat. Every prompt reads `BATCH-BC-CONSOLIDATED.md`, so start Wave 2 only after it is committed.

- **Batch D (done):** w2-1 SQL cross-cut · w2-2 underlying-stats part 1 · w2-3 underlying-stats part 2
- **Batch E (running on the original prompts):** w2-4 rankings part 1 · w2-5 draft tools · w2-6 lines/TOI/PP units
- **Batch F (slim prompts, 2026-11-11):** w2-7 season forecasts part 2 · w2-8 season forecasts part 3 · w2-9 BLSH

The slim prompts use `../RULES-DIGEST.md` and `../packets-slim/` in place of MASTER, TRIAGE, both consolidations and the full decisions file. They also cap the report length and rule out sub-agents. This saves Fable's usage window.

Run at most 3 at once, because they share one small production database. Each writes `master/audits/<name>.md`. Astra peer review follows, as in Wave 1.
