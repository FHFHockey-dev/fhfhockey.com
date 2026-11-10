# Fable triage pass: prompt (copy everything below the line into a Fable 5.2 session opened on /Users/tim/Code/fhfhockey.com)

---

You are the triage lead for a mathematics and methodology audit of FHFHockey.com, a fantasy-hockey analytics site. A Next.js app lives in `web/`, Python models in `functions/` and `modeling/`, and SQL in `supabase/migrations/`. Production data is in a Supabase Postgres project. This pass decides **where the full audit should look first**. Don't audit everything now.

## Inputs (read in this order)
1. `tasks/artifacts/calculation-inventory-2026-11-10/master/MASTER.md`: 1,358 calculations in 24 families, with coverage stats and a per-family table.
2. `master/MERGE-NOTES.md`: how two independent inventories (Opus and Codex) were merged. The merge was mechanical: "Opus only" and "Codex only" counts are upper bounds, and conflicts are under-detected.
3. `master/packets/*.md`: 35 audit packets. Each one holds that family's entries, their stated intent, references and fixtures, and the leads.
4. `../AUDIT-CONTEXT.md`: intended goal or contract per metric. UNDOCUMENTED marks a missing intent.
5. `master/master.json` and `master/crosswalk.csv`: machine-readable, if you need them.
6. Codex's original package (read-only reference): `~/Library/Application Support/Claude/side-session-notes/local_c4e6c533-96aa-4670-aedf-8a5331a449da/codex-calc-inventory-2026-11-10/README.md`.

Treat every "lead" (red flag or unknown) as an unverified hypothesis. Several will be wrong.

## What to do
For each of the 35 packets:
1. Skim the entries and the leads. For the 3–5 highest-severity leads, open the cited code (file:line) and classify each one: **confirmed**, **likely**, **unlikely** or **false**, with a one-line reason and the exact location.
2. Score:
   - **Risk** (1–5): how likely the math is wrong, unsound or mis-specified relative to its stated intent, AND relative to how the hockey-analytics or fantasy community defines the metric. For xG there is no single community formula; judge it on internal soundness and on clearly stating what it includes and excludes (shot location, distance, angle, shot type, rebound, rush, strength, score state, shooter and goalie effects, training data, calibration, and leakage).
   - **Impact** (1–5): user-facing reach (which pages, decisions and fantasy recommendations depend on it), how far errors fan out downstream, and whether it's live, flagged off, research or legacy.
   - **Effort** (S/M/L) for a full audit.
3. Note cross-packet dependencies, for example xG feeding underlying stats, rankings, sustainability and FORGE, so the auditors work in dependency order.

Priority areas the owner named: expected goals; RSO and the FORGE projection pipeline; BLSH; sKO and VuDu; weekScore and fantasy scoring; VORP/VONA/VBD (draft tools); sustainability; game win probability; team power ratings, CTPI and SOS; and every SQL function or view that computes something.

## Output
Write `tasks/artifacts/calculation-inventory-2026-11-10/master/TRIAGE.md` with:
1. **Ranked table** of all 35 packets: risk, impact, effort, the reason in one line, and dependencies.
2. **Wave plan**: Wave 1 is the highest risk × impact, sized for about 8–12 auditor passes; then Wave 2 and Wave 3. For each packet in Wave 1, write an audit brief: the questions to answer, the reference standard to compare against (cite the credible public definitions you'd use), the fixtures or data to test with, and the "done" criteria.
3. **Confirmed-at-a-glance issues**: anything you confirmed while triaging, with file:line, why it's wrong, and the expected magnitude. Don't fix anything.
4. **Undocumented intent**: metrics whose purpose isn't written down anywhere, where the owner must state the intended definition before an audit can judge correctness.
5. **Open questions for the owner**, kept short.

## Rules
- READ-ONLY. Don't edit code. Don't run migrations, writes, cron routes or deployments. Don't call NST, the NHL API or Yahoo.
- The production database is small and crashed recently after heavy diagnostic reads. Don't query data tables. If you must confirm a deployed SQL definition, run at most a few catalog queries (`pg_proc`, `pg_views`, `pg_matviews` definitions only).
- Don't print secrets from `web/.env.local`. Never set GIT_DIR.
- You may commit only `TRIAGE.md` on `octoberBranch` (no push), or leave it uncommitted for the orchestrator (Chef) to commit.
- When done, report back with: the Wave 1 list, the count of confirmed issues, and the top 5 findings.
