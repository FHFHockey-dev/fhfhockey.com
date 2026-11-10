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

## Decisions after W1-1 (TJ, 2026-11-10, by pop-up)
5. **Leaky champion xG model cfg9bac2706**: leave it serving for now. Demotion waits for the fix plan, as its own approved step with a registry backup.
6. **Headline xG**: **Natural Stat Trick's xG (labelled as NST) is the headline** until a leak-free, converged in-house model is approved. The bucket heuristic (0.18/0.08/0.02 with a 0.25 goal floor) is to be retired.
7. **Empty-net shots**: **excluded** from team, player and goalie xG totals (and from GSAx/xGA) and **reported separately**. The model should distinguish shooting at an empty net from the shooter's own net being empty.
8. **Rush definition**: **4-second window**, no faceoff sources (the common MoneyPuck-style convention).

## Codex cross-check of W1-1 (relayed by TJ, 2026-11-10)
- Confirmed: the champion's 0.934 AUC is inflated by outcome leakage. The corrected candidate is 0.712 overall and 0.736 at even strength on 17,834 held-out shots. The 0.748–0.761 refit is a small-sample experiment, not a production result.
- Agreed: FORGE's team xG prior falls back to another source, so it does not read the leaky model through the env override.
- **Fix-plan constraint:** demoting cfg9bac2706 in the registry will **not** hide its existing aggregates, because some pages read them directly. The xG fix must enumerate and handle **every consumer** of the old aggregates (team Metrics Timeline, homepage game analytics, xG Lab and any others) rather than relying on the champion flag.
