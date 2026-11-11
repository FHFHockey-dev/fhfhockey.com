# Fable Wave 2 audit prompt: w2-2 · underlying-stats-summaries-part1

Copy everything below the line into a **new** Fable session opened on `/Users/tim/Code/fhfhockey.com`.

---

You are auditing the mathematics and methodology of one calculation area of FHFHockey.com, a fantasy-hockey analytics site: Next.js in `web/`, Python in `functions/` and `modeling/`, SQL in `supabase/migrations/`, data in Supabase Postgres. Your job is a **skeptical, evidence-based audit**. Is each calculation correct, grounded in its stated definition, logically sound, and consistent with how the hockey-analytics and fantasy communities define it? Where no single community formula exists, judge internal soundness and honest labelling.

## Your scope
- Packet: `tasks/artifacts/calculation-inventory-2026-11-10/master/packets/underlying-stats-summaries-part1.md` (entries, intent, references, fixtures, leads).
- Your brief: TRIAGE.md gives only a one-line reason for this packet (section 1 table row "underlying-stats-summaries-part1") plus the owner-intent gaps in section 4. **Write your own brief first, as section 0 of your report:** the questions to answer, the reference standards (credible public definitions, cited by name; don't invent citations), the fixtures and data to test with, and the done-criteria. Then execute it.

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
Write `tasks/artifacts/calculation-inventory-2026-11-10/master/audits/underlying-stats-summaries-part1.md` with:
- section 0 (your brief, if you wrote one);
- a summary with verdict counts and the top 5 findings by user impact;
- the per-entry table (id, verdict, evidence, reference, magnitude, downstream);
- defects with fix, test and priority (P0 = user-visible wrong numbers now, P1, P2);
- owner questions not already answered by decisions 1–60;
- limits.

Commit only that file on `octoberBranch` (no push). Finish with a short report: verdict counts, P0 defects, and open questions.
