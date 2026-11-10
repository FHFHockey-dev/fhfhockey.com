# Fable Wave 1 audit prompt: W1-10 · game-predictions-odds (Batch C)

Copy everything below the line into a Fable 5.2 session opened on /Users/tim/Code/fhfhockey.com.

---

You are auditing the mathematics and methodology of one calculation family on FHFHockey.com, a fantasy-hockey analytics site: Next.js in `web/`, Python in `functions/` and `modeling/`, SQL in `supabase/migrations/`, data in Supabase Postgres. Your job is a **skeptical, evidence-based audit**. Is each calculation correct, grounded in its stated definition, logically sound, and consistent with how the hockey-analytics and fantasy communities define the metric? Where no single community formula exists, judge internal soundness and honest labelling.

## Your packet
- Packet: `tasks/artifacts/calculation-inventory-2026-11-10/master/packets/game-predictions-odds.md` (entries, intent, references, fixtures, leads).
- Your brief: `tasks/artifacts/calculation-inventory-2026-11-10/master/TRIAGE.md`, section 2, **"W1-10 · game-predictions-odds"**: its questions, reference standard, fixtures and done-criteria are your scope. Section 3 lists issues already confirmed in your area. Verify them, size them, and don't re-litigate the ones that are clearly right.
- Owner decisions (the intended contract where intent was missing): `tasks/artifacts/calculation-inventory-2026-11-10/master/OWNER-DECISIONS.md`.
- Background: `tasks/artifacts/calculation-inventory-2026-11-10/master/MASTER.md`, `tasks/artifacts/calculation-inventory-2026-11-10/master/MERGE-NOTES.md`, `tasks/artifacts/calculation-inventory-2026-11-10/master/../AUDIT-CONTEXT.md`. The inventory's "leads" are hypotheses, not findings.
- Upstream audits to read first: Batch A and B reports in tasks/artifacts/calculation-inventory-2026-11-10/master/audits/. Read the ones that exist before you start.

## Method
1. For every entry in the packet, read the code at the cited location (line numbers may have drifted; re-locate by symbol) and follow the data from its source to its consumers.
2. Classify each entry: **sound**, **mis-specified** (works as coded, but not what it claims or intends), **wrong** (a defect), or **undetermined** (say what would settle it). Cite file:line for every claim.
3. For each defect, estimate its **magnitude** on real or fixture data where you can. Bounded DB reads are allowed (rules below). Say who and what downstream is affected.
4. Compare against the reference standards in your brief. Cite them by name, and don't invent citations. Flag where FHFH deliberately differs and whether the label says so.
5. Recommend a fix for each defect and a test that would catch it. **Don't change any code.**

## Database rules (owner-approved)
- Read-only. Before each heavier read, check `pg_stat_activity`; stop if more than 5 queries are active or any query has run longer than 10 s.
- Allowed: small LIMIT-ed reads by id or date; catalog reads (`pg_proc`, `pg_views`, `pg_matviews`).
- Not allowed: bulk jsonb/payload reads, unbounded joins, full scans of large tables, and any writes. The production DB is small and crashed on 2026-11-09 after heavy diagnostic reads.
- No NST, NHL API or Yahoo calls. Don't print secrets from `web/.env.local`. Never set GIT_DIR. No migrations, cron routes or deployments.

## Output
Write `tasks/artifacts/calculation-inventory-2026-11-10/master/audits/game-predictions-odds.md` with:
1. A summary: counts of sound, mis-specified, wrong and undetermined, and the top 5 findings by user impact.
2. A per-entry table: id, verdict, evidence (file:line), the reference standard compared against, magnitude, and downstream impact.
3. Defects, each with: the fix recommendation, the test to add, and its priority (P0 = user-visible wrong numbers, P1, P2).
4. Questions for the owner, kept short.
5. Limits: what you could not verify, and why.

You may commit only that file on `octoberBranch` (no push), or leave it uncommitted for Chef. Finish with a short report: verdict counts, P0 defects, and open questions.
