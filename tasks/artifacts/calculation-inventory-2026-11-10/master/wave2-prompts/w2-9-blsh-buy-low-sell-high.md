# Fable Wave 2 audit prompt: w2-9 · blsh-buy-low-sell-high (slim)

Copy everything below the line into a **new** Fable session opened on `/Users/tim/Code/fhfhockey.com`. This is the token-lean version: the context is pre-digested, so read only what is listed.

---

You are auditing the mathematics and methodology of one calculation area of FHFHockey.com, a fantasy-hockey analytics site: Next.js in `web/`, Python in `functions/` and `modeling/`, SQL in `supabase/migrations/`, data in Supabase Postgres. Do a **skeptical, evidence-based audit**: is each calculation correct, true to its stated definition, logically sound, and consistent with how the hockey-analytics and fantasy communities define it? Where no community formula exists, judge internal soundness and honest labelling.

All paths below are under `tasks/artifacts/calculation-inventory-2026-11-10/master/` unless they start with `web/`, `functions/`, `modeling/` or `supabase/`.

## Read these, and only these, before the code
1. `RULES-DIGEST.md` (about 10 KB): owner decisions 1–68 and cross-cutting rules 1–12, one line each. **Binding**: where code differs from a decision, it is a defect. For this packet the key decisions are 32–35, 61 and 68 (what supported, sustainable production means, baselines from pre-window data only, list naming, window views, league reference); rules 1, 8 and 12 matter most here (provisional constants are hypotheses). Open `OWNER-DECISIONS.md` only to read the full text of a numbered decision you are applying.
2. `packets-slim/blsh-buy-low-sell-high.md`: your entries (boilerplate removed). The inventory's leads are hypotheses, not findings. Open `packets/blsh-buy-low-sell-high.md` only when a slim entry says "full text in the original packet" and you need it.
3. Upstream context: `BATCH-BC-CONSOLIDATED.md`, sections "W1-9 · Sustainability" and "W1-6 · FORGE projections, part 1" (the expectation side only) plus the rows of "Cross-packet defect map" that name BLSH, Sko or FORGE expectations. Upstream audits: `audits/sustainability-part1.md` and `audits/forge-projections-part1.md` (summaries and defects only).

**Do not read** `MASTER.md`, `TRIAGE.md`, `BATCH-A-CONSOLIDATED.md`, all of `BATCH-BC-CONSOLIDATED.md`, or other audits in full. What you need from them is here:
- Triage: Rank 20 (M): a frozen offline snapshot with documented provisional constants; season hard-coded; the Game Score variant is unlabelled. Confirmed issue C43 (L, not a math error): `web/lib/buyLowSellHigh/currentInput.ts:3`, `:192`, `:239`, `:243` and `currentWindows.ts:199` hard-code season 20262027, game-id year 2026 and a 2026-07-01 cutoff, so BLSH stops working next season until edited (M-BLSH-005, 014). Feeds: WGO, NST and FORGE expectations → BLSH page, trade comparison, cards. One loop to keep in mind: sustainability trend bands feed FORGE rates (M-FRG-056) while FORGE expectations feed BLSH/Sko. BLSH code under `web/scripts/blsh/**` belongs to Codex's BLSH lane: read it, change nothing.

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
Write `audits/blsh-buy-low-sell-high.md` with:
- section 0, the brief;
- a summary: verdict counts and the top 5 findings by user impact;
- a per-entry table with **one short line per entry** (id, verdict, evidence file:line, reach live/conditional/dormant/research, downstream). Sound entries need no prose;
- defects only in detail: fix, test, priority (P0 = user-visible wrong numbers now, P1, P2), reach;
- owner questions **not already answered by decisions 1–68**;
- limits.

Commit only that file on `octoberBranch` (no push). Finish with a short report: verdict counts, P0 defects, open questions.
