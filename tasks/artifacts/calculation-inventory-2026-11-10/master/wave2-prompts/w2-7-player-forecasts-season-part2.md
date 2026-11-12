# Fable Wave 2 audit prompt: w2-7 · player-forecasts-season-part2 (slim)

Copy everything below the line into a **new** Fable session opened on `/Users/tim/Code/fhfhockey.com`. This is the token-lean version: the context is pre-digested, so read only what is listed.

---

You are auditing the mathematics and methodology of one calculation area of FHFHockey.com, a fantasy-hockey analytics site: Next.js in `web/`, Python in `functions/` and `modeling/`, SQL in `supabase/migrations/`, data in Supabase Postgres. Do a **skeptical, evidence-based audit**: is each calculation correct, true to its stated definition, logically sound, and consistent with how the hockey-analytics and fantasy communities define it? Where no community formula exists, judge internal soundness and honest labelling.

All paths below are under `tasks/artifacts/calculation-inventory-2026-11-10/master/` unless they start with `web/`, `functions/`, `modeling/` or `supabase/`.

## Read these, and only these, before the code
1. `RULES-DIGEST.md` (about 10 KB): owner decisions 1–68 and cross-cutting rules 1–12, one line each. **Binding**: where code differs from a decision, it is a defect. For this packet the key decisions are 38, 39, 41 and 65 (native path, consumed lockbox and uncalibrated labels, ledger basis, proper scores); rules 2, 9, 10 and 11 matter most here. Open `OWNER-DECISIONS.md` only to read the full text of a numbered decision you are applying.
2. `packets-slim/player-forecasts-season-part2.md`: your entries (boilerplate removed). The inventory's leads are hypotheses, not findings. Open `packets/player-forecasts-season-part2.md` only when a slim entry says "full text in the original packet" and you need it.
3. Upstream context: `BATCH-BC-CONSOLIDATED.md`, section "W1-8 · Player forecasts and season models" plus the rows of "Cross-packet defect map" and "Wave 1 P0 list" that name M-PFC. Upstream audit: `audits/player-forecasts-season-part1.md` (read its summary and defects only; cite it, don't re-audit).

**Do not read** `MASTER.md`, `TRIAGE.md`, `BATCH-A-CONSOLIDATED.md`, all of `BATCH-BC-CONSOLIDATED.md`, or other audits in full. What you need from them is here:
- Triage: Rank 16 (L): Python season model: circular GLM features, selection and reporting on the same folds, non-standard labels. Feeds: season labels SQL, PBP → season artifact, fantasy projections page. Owner question still open: which Python season artifact is served on the fantasy projections page (most `modeling/player_forecasts` entries have status unknown). Settle it from code and config first.

## Method
- **Write a short brief first** as section 0 (≤ 15 lines): questions, reference standards (credible public definitions cited by name; don't invent citations), the fixtures/data you'll use, done-criteria.
- For each entry: locate the code by symbol (line numbers drift), and read **only the function and its direct callers** with `rg -n` and narrow `sed -n` ranges, not whole files. Trace data from source to consumers.
- Classify each entry: **sound**, **mis-specified** (works as coded, but not what it claims or intends), **wrong** (a defect), or **undetermined** (say what would settle it). Cite file:line.
- For each defect: magnitude on real or fixture data where you can (dated, with sample size), downstream readers, a fix, and a valid test. **Change no code.**
- Keep evidence reproducible: put query text and id/date bounds in the limits section.
- **No sub-agents.** Work in one pass. Don't re-read a file you have already read.

## Database rules (owner-approved)
- Read-only. Check `pg_stat_activity` before each heavier read; stop if more than 5 queries are active or any has run longer than 10 s.
- Allowed: small LIMIT-ed reads by id or date; catalog reads (`pg_proc`, `pg_views`, `pg_matviews`); server-side aggregates on indexed columns.
- Not allowed: jsonb/payload reads, whole-table jsonb detoast, unbounded joins, full scans of large tables, any writes.
- No NST, NHL API or Yahoo calls. Don't print secrets. Never set GIT_DIR. No migrations, cron routes or deployments.

## Output (keep it tight: about 15 KB, never more than 25 KB)
Write `audits/player-forecasts-season-part2.md` with:
- section 0, the brief;
- a summary: verdict counts and the top 5 findings by user impact;
- a per-entry table with **one short line per entry** (id, verdict, evidence file:line, reach live/conditional/dormant/research, downstream). Sound entries need no prose;
- defects only in detail: fix, test, priority (P0 = user-visible wrong numbers now, P1, P2), reach;
- owner questions **not already answered by decisions 1–68**;
- limits.

Commit only that file on `octoberBranch` (no push). Finish with a short report: verdict counts, P0 defects, open questions.
