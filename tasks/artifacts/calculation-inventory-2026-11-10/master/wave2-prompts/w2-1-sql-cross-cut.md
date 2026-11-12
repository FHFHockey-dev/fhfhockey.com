# Fable Wave 2 audit prompt: w2-1 · sql-cross-cut

Copy everything below the line into a **new** Fable session opened on `/Users/tim/Code/fhfhockey.com`.

---

You are auditing the mathematics and methodology of one calculation area of FHFHockey.com, a fantasy-hockey analytics site: Next.js in `web/`, Python in `functions/` and `modeling/`, SQL in `supabase/migrations/`, data in Supabase Postgres. Your job is a **skeptical, evidence-based audit**. Is each calculation correct, grounded in its stated definition, logically sound, and consistent with how the hockey-analytics and fantasy communities define it? Where no single community formula exists, judge internal soundness and honest labelling.

## Your scope
- Scope:
The owner asked for every SQL function or view that computes something. TRIAGE section 2 "SQL cross-cut" lists the entry ids spread over ten packets: M-TEAM-001–010, 017, 033, 034; M-UST-001–010, 038, 039; M-SUS-001, 002, 037–039; M-SKO-001–003, 016; M-FRG-001–003; M-PFC-001; M-LINE-001, 002, 004, 013; M-GST-001, 003; M-DRF-001, 002, 004, 047; M-WIGO-001, 003; M-MISC-001, 002; plus the Codex-only SQL records in player-forecasts parts 3–5 and rankings-part2. For each one:
(a) confirm the **deployed** definition with catalog reads (`pg_views`, `pg_matviews`, `pg_proc`; definitions only) and diff it against the repo migration;
(b) find its live readers in `web/`, `functions/` and pg_cron;
(c) check units, season and date filters, game-type filters, pooled versus averaged rates, and look-ahead.
Entries already audited inside Wave 1 packets may be cited rather than redone. Use the packets where these ids live, listed above, as your inputs.

## Read first (binding context)
- `tasks/artifacts/calculation-inventory-2026-11-10/master/OWNER-DECISIONS.md`: decisions 1–60 are the owner's intended contract. Where the code differs, it is a defect.
- `tasks/artifacts/calculation-inventory-2026-11-10/master/BATCH-A-CONSOLIDATED.md` and `tasks/artifacts/calculation-inventory-2026-11-10/master/BATCH-BC-CONSOLIDATED.md`: Wave 1 findings merged with peer reviews. Their cross-cutting rules are mandatory:
  - quote magnitudes as dated samples with their sample size;
  - treat AUC and Brier as alarms, not proofs;
  - test invariants must be mathematically right;
  - fix every reader, not just a flag;
  - unknowns stay unknown;
  - no deletion because of a math finding.
- `tasks/artifacts/calculation-inventory-2026-11-10/master/TRIAGE.md` (ranking, dependencies, section 4 undocumented intent) and `tasks/artifacts/calculation-inventory-2026-11-10/master/MASTER.md`. The inventory's "leads" are hypotheses, not findings.
- The Wave 1 audits in `tasks/artifacts/calculation-inventory-2026-11-10/master/audits/` that are upstream of your area: cite them rather than re-auditing them.

## Method
1. For every entry, read the code at the cited location (line numbers drift; re-locate by symbol) and trace the data from source to consumers.
2. Classify each entry: **sound**, **mis-specified** (works as coded, but not what it claims or intends), **wrong** (a defect), or **undetermined** (say what would settle it). Cite file:line for every claim.
3. For each defect, estimate its **magnitude** on real or fixture data where you can, and name the downstream readers.
4. Compare against the reference standards. Flag deliberate FHFH differences and whether the label says so.
5. Recommend a fix and a test for each defect. **Change no code.**
6. Keep your evidence reproducible. Save any query text and its id/date bounds into the report's limits section. Scratch scripts must be described well enough to re-run.

## Database rules (owner-approved)
- Read-only. Check `pg_stat_activity` before each heavier read; stop if more than 5 queries are active or any query has run longer than 10 s.
- Allowed: small LIMIT-ed reads by id or date; catalog reads (`pg_proc`, `pg_views`, `pg_matviews`); server-side aggregates on indexed columns.
- Not allowed: **no jsonb/payload reads, no whole-table jsonb detoast, no unbounded joins, no full scans of large tables**, no writes. (A Wave 1 auditor broke this once; the database crashed on 2026-11-09 after heavy diagnostic reads.)
- No NST, NHL API or Yahoo calls. Don't print secrets. Never set GIT_DIR. No migrations, cron routes or deployments.
- Keep sub-agents to a minimum: the owner's usage window is limited.

## Output
Write `tasks/artifacts/calculation-inventory-2026-11-10/master/audits/sql-cross-cut.md` with:
- section 0 (your brief, if you wrote one);
- a summary with verdict counts and the top 5 findings by user impact;
- the per-entry table (id, verdict, evidence, reference, magnitude, downstream);
- defects with fix, test and priority (P0 = user-visible wrong numbers now, P1, P2);
- owner questions not already answered by decisions 1–60;
- limits.

Commit only that file on `octoberBranch` (no push). Finish with a short report: verdict counts, P0 defects, and open questions.
