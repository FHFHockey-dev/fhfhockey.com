# Fable Wave 3 audit prompt: w3-6 · Sustainability, rolling and rankings part 2 (slim, cross-check)

Copy everything below the line into a **new** Fable session opened on `/Users/tim/Code/fhfhockey.com`. This is the token-lean version: the context is pre-digested, so read only what is listed.

---

You are auditing the mathematics and methodology of FHFHockey.com, a fantasy-hockey analytics site: Next.js in `web/`, Python in `functions/` and `modeling/`, SQL in `supabase/migrations/`, data in Supabase Postgres. Do a **skeptical, evidence-based audit**: is each calculation correct, true to its stated definition, logically sound, and consistent with how the hockey-analytics and fantasy communities define it? Where no community formula exists, judge internal soundness and honest labelling.

All paths below are under `tasks/artifacts/calculation-inventory-2026-11-10/master/` unless they start with `web/`, `functions/`, `modeling/` or `supabase/`.

## Read these, and only these, before the code
1. `RULES-DIGEST.md` (about 10 KB): owner decisions 1–68 and cross-cutting rules 1–12, one line each. **Binding**: where code differs from a decision, it is a defect. Key decisions here: 16–18, 23, 32–36, 61 and 68 (availability, xSH%, calendar windows, luck, the sustainability definition, baselines and windows). Open `OWNER-DECISIONS.md` only for the full text of a numbered decision you are applying. If `WAVE2-CONSOLIDATED.md` exists, read only its cross-cutting rules section and any decisions above 68.
2. Your entries (boilerplate removed; leads are hypotheses, not findings): `packets-slim/sustainability-part2.md`, `packets-slim/rolling-player-averages-trends-part2.md`, `packets-slim/rankings-part2.md`. Open the matching file in `packets/` only when a slim entry says "full text in the original packet" and you need it.
3. Upstream context: `BATCH-A-CONSOLIDATED.md`, section "W1-3 · Rolling"; `BATCH-BC-CONSOLIDATED.md`, section "W1-9 · Sustainability"; `audits/rolling-player-averages-trends-part1.md`, `audits/sustainability-part1.md` and `audits/rankings-part1.md` (per-entry tables and defects).

**Do not read** `MASTER.md`, `TRIAGE.md`, whole consolidation files, or other audits in full. What you need from them is here:
- sustainability-part2 (rank 23, S): Codex-only band-metric records; inherits the part 1 baseline problem.
- rolling-player-averages-trends-part2 (rank 24, S): Codex-only per-metric records; inherits part 1's unit issues. Related confirmed issues: C39 (H) the trend per-60 fallback assumes minutes (`web/lib/trends/playerTrendCalculator.ts:251-255`, `:270-274`; M-ROLL-018); C40 (L) `shooting_pct` is 0–100 and returns 0 with no shots while `expected_sh_pct` is 0–1 and returns null (M-ROLL-005).
- rankings-part2 (rank 34, S): five Codex-only records.

## Method: cross-check mode
These are Codex-only records that re-describe code the part 1/2 audits already judged, at a finer grain. Your job is to make sure nothing slipped through, not to re-audit what is already done.
- **Write a short brief first** as section 0 (≤ 10 lines).
- For each record: find the upstream audit entry or finding that covers the same code (same function or file range). If it is covered and the record adds nothing, write one line: "covered by <audit> <id>". If the record shows something the upstream audit missed or got wrong, audit that point properly.
- Locate code by symbol and read **only the function involved** with `rg -n` and narrow `sed -n` ranges, not whole files.
- For each new or contradicting point: classify it (**sound**, **mis-specified**, **wrong** or **undetermined**), cite file:line, and give the magnitude where you can (dated, with sample size), downstream readers, a fix and a valid test. **Change no code.**
- **No sub-agents.** Work in one pass. Don't re-read a file you have already read.

## Database rules (owner-approved)
- Read-only. Check `pg_stat_activity` before each heavier read; stop if more than 5 queries are active or any has run longer than 10 s.
- Allowed: small LIMIT-ed reads by id or date; catalog reads (`pg_proc`, `pg_views`, `pg_matviews`); server-side aggregates on indexed columns.
- Not allowed: jsonb/payload reads, whole-table jsonb detoast, unbounded joins, full scans of large tables, any writes.
- No NST, NHL API or Yahoo calls. Don't print secrets. Never set GIT_DIR. No migrations, cron routes or deployments.

## Output (keep it tight: about 10 KB, never more than 18 KB)
Write `audits/sus-rolling-rankings-part2-crosscheck.md` with:
- section 0, the brief;
- a summary: verdict counts (including how many are covered upstream) and the top 5 findings by user impact;
- a per-entry table with **one short line per entry** (id, verdict or "covered by …", evidence file:line, reach live/conditional/dormant/research, downstream). Sound and covered entries need no prose;
- defects only in detail: fix, test, priority (P0 = user-visible wrong numbers now, P1, P2), reach;
- owner questions **not already answered by the decisions**;
- limits.

Commit only that file on `octoberBranch` (no push). Finish with a short report: verdict counts, P0 defects, open questions.
