# Fable Wave 3 audit prompt: w3-3 · Miscellaneous calculations (slim)

Copy everything below the line into a **new** Fable session opened on `/Users/tim/Code/fhfhockey.com`. This is the token-lean version: the context is pre-digested, so read only what is listed.

---

You are auditing the mathematics and methodology of FHFHockey.com, a fantasy-hockey analytics site: Next.js in `web/`, Python in `functions/` and `modeling/`, SQL in `supabase/migrations/`, data in Supabase Postgres. Do a **skeptical, evidence-based audit**: is each calculation correct, true to its stated definition, logically sound, and consistent with how the hockey-analytics and fantasy communities define it? Where no community formula exists, judge internal soundness and honest labelling.

All paths below are under `tasks/artifacts/calculation-inventory-2026-11-10/master/` unless they start with `web/`, `functions/`, `modeling/` or `supabase/`.

## Read these, and only these, before the code
1. `RULES-DIGEST.md` (about 10 KB): owner decisions 1–68 and cross-cutting rules 1–12, one line each. **Binding**: where code differs from a decision, it is a defect. Key decisions here: the ones the entries touch (look them up in the digest by topic); rules 4, 6 and 8 matter most (every reader, no deletion from a math finding, reach labels for legacy routes). Open `OWNER-DECISIONS.md` only for the full text of a numbered decision you are applying. If `WAVE2-CONSOLIDATED.md` exists, read only its cross-cutting rules section and any decisions above 68.
2. Your entries (boilerplate removed; leads are hypotheses, not findings): `packets-slim/misc-other.md`. Open the matching file in `packets/` only when a slim entry says "full text in the original packet" and you need it.
3. Upstream context: `audits/sql-cross-cut.md` (the M-MISC rows only). Cite other Wave 1/2 audits by name only if an entry is a copy of something they already covered.

4. **Upstream Astra peer reviews** (owner-required): `W1-Astra-PR/w2-1-sql-cross-cut.md`. In each, read only its verdict or decision section and its corrections / new-findings sections; skip the per-entry disposition, fixture and verification sections. Where Astra corrected or withdrew an upstream finding, use the corrected version and cite the review. Treat Astra's new findings in your area as leads to confirm or refute.

**Do not read** `MASTER.md`, `TRIAGE.md`, whole consolidation files, or other audits in full. What you need from them is here:
- misc-other (rank 30, M): social-share and legacy helpers; one confirmed 60× unit error in a legacy averages route. C42 (L): `web/lib/api/averages/statsService.ts:158` and `web/lib/api/averages/helpers.ts:121-125` parse TOI to seconds and then compute SOG/60 = SOG ÷ TOI × 60 (M-MISC-007), 60× low; live readers not confirmed, so settle reach first. M-MISC-001 and 002 are SQL, already covered by `audits/sql-cross-cut.md`.
- Not maths, noted only: `web/lib/supabase/GoaliePage/updateWeeklyData.ts:16-17` logs the Supabase URL and a key value (a legacy script). Note it in limits; don't print or copy the value.

## Method
- **Write a short brief first** as section 0 (≤ 15 lines): questions, reference standards (credible public definitions cited by name; don't invent citations), the fixtures/data you'll use, done-criteria.
- For each entry: locate the code by symbol (line numbers drift), and read **only the function and its direct callers** with `rg -n` and narrow `sed -n` ranges, not whole files. Trace data from source to consumers.
- Classify each entry: **sound**, **mis-specified** (works as coded, but not what it claims or intends), **wrong** (a defect), or **undetermined** (say what would settle it). Cite file:line.
- For each defect: magnitude on real or fixture data where you can (dated, with sample size), downstream readers, a fix, and a valid test. **Change no code.**
- Where an entry repeats code an earlier audit already judged, write "covered by <audit> <finding id>" and move on.
- Keep evidence reproducible: put query text and id/date bounds in the limits section.
- Apply Astra's upstream corrections. Where your evidence disagrees with Astra or with an upstream audit, say so with evidence; don't silently pick one.
- **No sub-agents.** Work in one pass. Don't re-read a file you have already read.

## Database rules (owner-approved)
- Read-only. Check `pg_stat_activity` before each heavier read; stop if more than 5 queries are active or any has run longer than 10 s.
- Allowed: small LIMIT-ed reads by id or date; catalog reads (`pg_proc`, `pg_views`, `pg_matviews`); server-side aggregates on indexed columns.
- Not allowed: jsonb/payload reads, whole-table jsonb detoast, unbounded joins, full scans of large tables, any writes.
- No NST, NHL API or Yahoo calls. Don't print secrets. Never set GIT_DIR. No migrations, cron routes or deployments.

## Output (keep it tight: about 20 KB, never more than 32 KB)
Write `audits/misc-other.md` with:
- section 0, the brief;
- a summary: verdict counts and the top 5 findings by user impact;
- a per-entry table with **one short line per entry** (id, verdict or "covered by …", evidence file:line, reach live/conditional/dormant/research, downstream). Sound and covered entries need no prose;
- defects only in detail: fix, test, priority (P0 = user-visible wrong numbers now, P1, P2), reach;
- owner questions **not already answered by the decisions**;
- limits;
- **Final analysis and fix-agent handoff** (the last section; Opus fix agents will work from it, one lane per code area, without re-reading this audit's evidence):
  - final analysis: what is actually wrong in this area and why, in a few paragraphs, with Astra's upstream corrections applied;
  - recommendations and proposed fixes, ordered by priority, each naming the files and symbols to change, every reader to update (rule 4), and the test that proves it;
  - directional suggestions: longer-term improvements that are not defects (label them as such);
  - context a fix agent needs: owner decisions that apply, traps (units, scales, null handling, ownership such as Codex-owned paths), what must not be changed, which steps need a production action (migration, backfill, rebuild, env change) and therefore the owner's approval, and the suggested fix lane.

Commit only that file on `octoberBranch` (no push). Finish with a short report: verdict counts, P0 defects, open questions, and the fix lanes you suggest.
