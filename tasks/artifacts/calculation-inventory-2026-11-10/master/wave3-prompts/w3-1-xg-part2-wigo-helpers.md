# Fable Wave 3 audit prompt: w3-1 · xG part 2, WiGO and stats helpers (slim)

Copy everything below the line into a **new** Fable session opened on `/Users/tim/Code/fhfhockey.com`. This is the token-lean version: the context is pre-digested, so read only what is listed.

---

You are auditing the mathematics and methodology of FHFHockey.com, a fantasy-hockey analytics site: Next.js in `web/`, Python in `functions/` and `modeling/`, SQL in `supabase/migrations/`, data in Supabase Postgres. Do a **skeptical, evidence-based audit**: is each calculation correct, true to its stated definition, logically sound, and consistent with how the hockey-analytics and fantasy communities define it? Where no community formula exists, judge internal soundness and honest labelling.

All paths below are under `tasks/artifacts/calculation-inventory-2026-11-10/master/` unless they start with `web/`, `functions/`, `modeling/` or `supabase/`.

## Read these, and only these, before the code
1. `RULES-DIGEST.md` (about 10 KB): owner decisions 1–68 and cross-cutting rules 1–12, one line each. **Binding**: where code differs from a decision, it is a defect. Key decisions here: 5–8, 12 and 17 (leaky champion, NST headline xG, empty net, 4 s rush, hidden heuristic xG, xSH%), plus rule 5 for null ranks. Open `OWNER-DECISIONS.md` only for the full text of a numbered decision you are applying. If `WAVE2-CONSOLIDATED.md` exists, read only its cross-cutting rules section and any decisions above 68.
2. Your entries (boilerplate removed; leads are hypotheses, not findings): `packets-slim/xg-part2.md`, `packets-slim/wigo.md`, `packets-slim/stats-helpers.md`. Open the matching file in `packets/` only when a slim entry says "full text in the original packet" and you need it.
3. Upstream context: `BATCH-A-CONSOLIDATED.md`, section "W1-1 · xG"; `audits/xg-part1.md` (summary and defects only); `audits/sql-cross-cut.md` (the M-WIGO rows only); `audits/rankings-part1.md` (only where it touches percentiles).

**Do not read** `MASTER.md`, `TRIAGE.md`, whole consolidation files, or other audits in full. What you need from them is here:
- xg-part2 (rank 26, S): approval gates need only 10 goals in the test and holdout splits (`web/scripts/train-nhl-xg-baseline.ts:333-334`; M-XG-066, 070); shot-map folding by the sign of x doesn't mirror the lateral axis (`web/components/ShotVisualization/ShotVisualization.tsx:398-412`; M-XG-052, likely, from part 1); rolling xG windows. Feeds the xG explorer and shot map.
- wigo (rank 25, S): the overall rating averages AS, ES and ST although AS contains both (`web/utils/calculateWigoRatings.ts:253-258`; M-WIGO-005, likely); all-situations Game Score. Feeds: NST season views, WGO → WiGO page. M-WIGO-001 and 003 are SQL, already covered by `audits/sql-cross-cut.md`.
- stats-helpers (rank 29, S): three percentile conventions across the site; C35 (L): `web/utils/projectionsRanking.ts:14-25` ranks null projected or actual fantasy points as 0, ties get sequential ranks, and skaters and goalies share one scale (M-HLP-005). Feeds WiGO, rankings, projections table.

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
Write `audits/xg-part2-wigo-helpers.md` with:
- section 0, the brief;
- a summary: verdict counts and the top 5 findings by user impact;
- a per-entry table with **one short line per entry** (id, verdict or "covered by …", evidence file:line, reach live/conditional/dormant/research, downstream). Sound and covered entries need no prose;
- defects only in detail: fix, test, priority (P0 = user-visible wrong numbers now, P1, P2), reach;
- owner questions **not already answered by the decisions**;
- limits.

Commit only that file on `octoberBranch` (no push). Finish with a short report: verdict counts, P0 defects, open questions.
