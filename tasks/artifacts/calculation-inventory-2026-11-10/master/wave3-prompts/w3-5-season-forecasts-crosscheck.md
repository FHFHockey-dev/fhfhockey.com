# Fable Wave 3 audit prompt: w3-5 · Season forecasts parts 4 and 5 (slim, cross-check)

Copy everything below the line into a **new** Fable session opened on `/Users/tim/Code/fhfhockey.com`. This is the token-lean version: the context is pre-digested, so read only what is listed.

---

You are auditing the mathematics and methodology of FHFHockey.com, a fantasy-hockey analytics site: Next.js in `web/`, Python in `functions/` and `modeling/`, SQL in `supabase/migrations/`, data in Supabase Postgres. Do a **skeptical, evidence-based audit**: is each calculation correct, true to its stated definition, logically sound, and consistent with how the hockey-analytics and fantasy communities define it? Where no community formula exists, judge internal soundness and honest labelling.

All paths below are under `tasks/artifacts/calculation-inventory-2026-11-10/master/` unless they start with `web/`, `functions/`, `modeling/` or `supabase/`.

## Read these, and only these, before the code
1. `RULES-DIGEST.md` (about 10 KB): owner decisions 1–68 and cross-cutting rules 1–12, one line each. **Binding**: where code differs from a decision, it is a defect. Key decisions here: 38, 39, 41 and 65 (native path, consumed lockbox, ledger basis, proper scores); rules 2, 9 and 10. Open `OWNER-DECISIONS.md` only for the full text of a numbered decision you are applying. If `WAVE2-CONSOLIDATED.md` exists, read only its cross-cutting rules section and any decisions above 68.
2. Your entries (boilerplate removed; leads are hypotheses, not findings): `packets-slim/player-forecasts-season-part4.md`, `packets-slim/player-forecasts-season-part5.md`. Open the matching file in `packets/` only when a slim entry says "full text in the original packet" and you need it.
3. Upstream context: `BATCH-BC-CONSOLIDATED.md`, section "W1-8 · Player forecasts and season models"; `audits/player-forecasts-season-part1.md`, `audits/player-forecasts-season-part2.md`, `audits/player-forecasts-season-part3.md` and `audits/sql-cross-cut.md` (per-entry tables and defects). Once it exists, `WAVE2-CONSOLIDATED.md` supersedes the Wave 2 audits it covers.

4. **Upstream Astra peer reviews** (owner-required): `W1-Astra-PR/player-forecasts-season.md`, `W1-Astra-PR/w2-player-forecasts-season-part2.md`, `W1-Astra-PR/w2-player-forecasts-season-part3.md`, `W1-Astra-PR/w2-1-sql-cross-cut.md`. In each, read only its verdict or decision section and its corrections / new-findings sections; skip the per-entry disposition, fixture and verification sections. Where Astra corrected or withdrew an upstream finding, use the corrected version and cite the review. Treat Astra's new findings in your area as leads to confirm or refute.

**Do not read** `MASTER.md`, `TRIAGE.md`, whole consolidation files, or other audits in full. What you need from them is here:
- player-forecasts-season-part4 (rank 22, M): Codex-only season primitives and derived metrics; no leads of their own.
- player-forecasts-season-part5 (rank 33, S): 24 Codex-only records (SQL runtime features, diagnostics). Their SQL was covered by `audits/sql-cross-cut.md`.

## Method: cross-check mode
These are Codex-only records that re-describe code the part 1/2 audits already judged, at a finer grain. Your job is to make sure nothing slipped through, not to re-audit what is already done.
- **Write a short brief first** as section 0 (≤ 10 lines).
- For each record: find the upstream audit entry or finding that covers the same code (same function or file range). If it is covered and the record adds nothing, write one line: "covered by <audit> <id>". If the record shows something the upstream audit missed or got wrong, audit that point properly.
- Locate code by symbol and read **only the function involved** with `rg -n` and narrow `sed -n` ranges, not whole files.
- For each new or contradicting point: classify it (**sound**, **mis-specified**, **wrong** or **undetermined**), cite file:line, and give the magnitude where you can (dated, with sample size), downstream readers, a fix and a valid test. **Change no code.**
- Apply Astra's upstream corrections. Where your evidence disagrees with Astra or with an upstream audit, say so with evidence; don't silently pick one.
- **No sub-agents.** Work in one pass. Don't re-read a file you have already read.

## Database rules (owner-approved)
- Read-only. Check `pg_stat_activity` before each heavier read; stop if more than 5 queries are active or any has run longer than 10 s.
- Allowed: small LIMIT-ed reads by id or date; catalog reads (`pg_proc`, `pg_views`, `pg_matviews`); server-side aggregates on indexed columns.
- Not allowed: jsonb/payload reads, whole-table jsonb detoast, unbounded joins, full scans of large tables, any writes.
- No NST, NHL API or Yahoo calls. Don't print secrets. Never set GIT_DIR. No migrations, cron routes or deployments.

## Output (keep it tight: about 15 KB, never more than 25 KB)
Write `audits/player-forecasts-season-part4-5-crosscheck.md` with:
- section 0, the brief;
- a summary: verdict counts (including how many are covered upstream) and the top 5 findings by user impact;
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
