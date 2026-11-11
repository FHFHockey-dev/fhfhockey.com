# Fable Wave 3 audit prompt: w3-7 · sKO and VuDu (slim)

Copy everything below the line into a **new** Fable session opened on `/Users/tim/Code/fhfhockey.com`. This is the token-lean version: the context is pre-digested, so read only what is listed.

**Do not start this one until `OWNER-INTENT-SKO-VUDU.md` exists** (TJ writes what sKO and VuDu are meant to be: which of the four "sKO" things is canonical, what VuDu should compute, and who uses them). Without it the auditor can only call these entries undetermined.

---

You are auditing the mathematics and methodology of FHFHockey.com, a fantasy-hockey analytics site: Next.js in `web/`, Python in `functions/` and `modeling/`, SQL in `supabase/migrations/`, data in Supabase Postgres. Do a **skeptical, evidence-based audit**: is each calculation correct, true to its stated definition, logically sound, and consistent with how the hockey-analytics and fantasy communities define it? Where no community formula exists, judge internal soundness and honest labelling.

All paths below are under `tasks/artifacts/calculation-inventory-2026-11-10/master/` unless they start with `web/`, `functions/`, `modeling/` or `supabase/`.

## Read these, and only these, before the code
1. `RULES-DIGEST.md` (about 10 KB): owner decisions 1–68 and cross-cutting rules 1–12, one line each. **Binding**: where code differs from a decision, it is a defect. Key decisions here: 32–35 (sustainability definition), plus whatever the owner's intent file states; rules 6 and 8 (no deletion from a math finding; label legacy, quarantined and fixture-stage reach). Open `OWNER-DECISIONS.md` only for the full text of a numbered decision you are applying. If `WAVE2-CONSOLIDATED.md` exists, read only its cross-cutting rules section and any decisions above 68.
2. Your entries (boilerplate removed; leads are hypotheses, not findings): `packets-slim/sko.md`, `packets-slim/vudu.md`. Open the matching file in `packets/` only when a slim entry says "full text in the original packet" and you need it.
3. Upstream context: `OWNER-INTENT-SKO-VUDU.md` (the owner's definitions: **binding**, read it first); `audits/blsh-buy-low-sell-high.md` (Sko Element and watchlists) and `audits/sql-cross-cut.md` (M-SKO rows), summaries and defects only.

**Do not read** `MASTER.md`, `TRIAGE.md`, whole consolidation files, or other audits in full. What you need from them is here:
- sko (rank 27, S): almost all legacy, quarantined or fixture-stage; "sKO" names four unrelated things (a legacy points × stability score, the Sko Element contract, the sustainability "sKO score model v3", and `combineSKO`). C44 (L): `web/pages/api/v1/ml/update-predictions-sko.ts:112-118`, `:342` stores a standard deviation in a column named `stability_cv` (M-SKO-004, 024); flagged off. M-SKO-001–003 and 016 are SQL, already covered by `audits/sql-cross-cut.md`.
- vudu (rank 35, S): no live gap is computed anywhere; fixture pass-through.

## Method
- **Write a short brief first** as section 0 (≤ 15 lines): questions, reference standards (credible public definitions cited by name; don't invent citations), the fixtures/data you'll use, done-criteria.
- For each entry: locate the code by symbol (line numbers drift), and read **only the function and its direct callers** with `rg -n` and narrow `sed -n` ranges, not whole files. Trace data from source to consumers.
- Classify each entry: **sound**, **mis-specified** (works as coded, but not what it claims or intends), **wrong** (a defect), or **undetermined** (say what would settle it). Cite file:line.
- For each defect: magnitude on real or fixture data where you can (dated, with sample size), downstream readers, a fix, and a valid test. **Change no code.**
- Where an entry repeats code an earlier audit already judged, write "covered by <audit> <finding id>" and move on.
- Keep evidence reproducible: put query text and id/date bounds in the limits section.
- **No sub-agents.** Work in one pass. Don't re-read a file you have already read.

## Database rules (owner-approved)
- Read-only. Check `pg_stat_activity` before each heavier read; stop if more than 5 queries are active or any has run longer than 10 s.
- Allowed: small LIMIT-ed reads by id or date; catalog reads (`pg_proc`, `pg_views`, `pg_matviews`); server-side aggregates on indexed columns.
- Not allowed: jsonb/payload reads, whole-table jsonb detoast, unbounded joins, full scans of large tables, any writes.
- No NST, NHL API or Yahoo calls. Don't print secrets. Never set GIT_DIR. No migrations, cron routes or deployments.

## Output (keep it tight: about 15 KB, never more than 25 KB)
Write `audits/sko-vudu.md` with:
- section 0, the brief;
- a summary: verdict counts and the top 5 findings by user impact;
- a per-entry table with **one short line per entry** (id, verdict or "covered by …", evidence file:line, reach live/conditional/dormant/research, downstream). Sound and covered entries need no prose;
- defects only in detail: fix, test, priority (P0 = user-visible wrong numbers now, P1, P2), reach;
- owner questions **not already answered by the decisions**;
- limits.

Commit only that file on `octoberBranch` (no push). Finish with a short report: verdict counts, P0 defects, open questions.
