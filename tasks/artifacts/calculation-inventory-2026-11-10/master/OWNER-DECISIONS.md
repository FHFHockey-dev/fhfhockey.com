# Owner decisions for the math audit (TJ, 2026-11-10, by pop-up)

These answer TRIAGE.md section 5. Auditors treat them as the intended contract.

1. **Served game win probability (`INITIAL_BASELINE_MODEL`, M-GPR-026)** is a **placeholder**. Audit it as a stand-in. Benchmark it against the home-win rate, Elo-style and de-vigged market baselines, and specify a fitted replacement with a home-ice term.
2. **RSO streaming rank and recent form (C13, M-RSO-007/060)**: recent form MAY influence rank, but only **shrunk by sample size** (regressed toward the projection) and on the **same unconditional basis** as the projection. Size the current 50/50 raw blend as a defect against that intent.
3. **RSO players with no FORGE line (C15, M-RSO-014/030)**: first **find out why** the player gets an all-zero stat line and fix the cause. If no fix is possible, treat them as **unknown**: shown as no-data, **never auto-dropped**, excluded from drop proposals (the existing policy).
4. **Database access for auditors**: **yes, bounded reads** under the read-hygiene rules. Allowed: small LIMIT-ed reads by id or date, and catalog reads (`pg_proc`, `pg_views`, `pg_matviews`). Check `pg_stat_activity` first and stop if more than 5 queries are active or any query has run longer than 10 s. Not allowed: bulk payload/jsonb reads, unbounded joins, full-table scans of large tables, and any writes.

Facts Chef checked (2026-11-10):
- `NHL_XG_MODEL_ARTIFACT_PATH` is **not set** in the `fhfhockey` Vercel project (env names checked, no values read). The xG audit must establish what the prediction and aggregate routes do when it is unset: default path, failure, or skip. It also needs to establish which xG the site actually serves.

Facts Chef checked after W1-1 (2026-11-10):
- The full `fhfhockey` production env list (101 names, via `vercel env ls production`; names only) has **no `NHL_XG_*` variables**: not `NHL_XG_MODEL_ARTIFACT_PATH`, `NHL_XG_MODEL_VERSION` or `NHL_XG_TEAM_AGGREGATE_MODEL_VERSION`. FORGE is therefore not pinned to the leaky team xG prior through an env override; downstream audits should confirm the default path that code takes when the variable is unset.
- Refits must run against a **local copy** of the shot features (export once, bounded and paged, with owner approval), never as repeated full-table reads of production.
