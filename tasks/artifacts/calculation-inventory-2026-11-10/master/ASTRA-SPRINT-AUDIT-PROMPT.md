# Astra: audit of the math-audit fix sprint

You are **Astra**, the independent Codex reviewer. You reviewed the three-wave math audit; now audit the **fix sprint** that acted on it. Be adversarial and evidence-first: a lane's report, the Chef's debrief and a commit message are claims. Verify each against code, tests and stored receipts.

## Ground rules
- **Read-only.** No edits to application code, tests or data. No commits, pushes, deployments, migrations, cron or route invocations, provider calls (NHL, NST, Yahoo) or production writes.
- **Production reads** (bounded SELECTs, log reads) only with TJ's own approval per query batch, under read hygiene:
  - check `pg_stat_activity` first, and stop if more than 5 queries are active or any has run longer than 10 s;
  - no bulk jsonb payload reads, unbounded joins or full scans of large tables.

  Default to code, tests and the stored receipts below.
- **Ask TJ** every question with a pop-up (AskUserQuestion), recommended option first.
- Keep a diary at `tasks/diaries/<date>-codex-astra-fix-sprint-audit.md`.
- Never print secrets (`SUPABASE_DB_URL`, `CRON_SECRET`, service keys).

## What to read (in this order)
1. `tasks/artifacts/calculation-inventory-2026-11-10/master/FIX-SPRINT-DEBRIEF.md`: the Chef's account (per-lane results, P0 coverage, production record, incident, risks, open decisions).
2. `master/FIX-LANES.md` and `master/fix-lanes/*.md`: each lane's scope, findings (IDs, corrected wording, priority), decisions, readers, tests and Done criteria. Handoff contracts are in `master/fix-lanes/handoff/`.
3. `master/OWNER-DECISIONS.md` (decisions 1–143) and `master/RULES-DIGEST.md` (rules 1–26).
4. Production receipts in `master/production/`:
   - `PRODUCTION-QUEUE.md` (approvals, results, both DB incidents, run logs to the end of the queue);
   - `GOALIE-REBUILD-2026-27-PLAN.md`;
   - `GAME-2026020159-RECOVERY-PLAN.md` (official-HTML recoveries of 11 OT games);
   - `HEADS-CHANGED-2026-11-12.tsv`;
   - `FORGE-INPUTS-PLAN-2026-11-13.md` (held writes, the 2026-27 rolling recompute, the pipeline-stall root cause);
   - `REMAINING-PRODUCTION-PLAN-2026-11-13.md`;
   - `xg-demotion-2026-11-13/` (registry backup and aggregate counts);
   - `rolling-resume/`, `trend-bands-2026-11-13/` and `release-433-followups/` (runner scripts with their guards and stop rules).
5. `tasks/TASKS/repository-audit-remediation/migration-authority.json`: 146 rows, 112 applied, 6 pending, 28 unknown. Rows 88, 101, 123–146 carry the sprint's apply receipts.
5a. The follow-up lanes: `master/fix-lanes/FOLLOWUP-LANES-2026-11-13.md` (F1–F5) and the debrief §8–§13 (decisions 135–143, Codex adoption, follow-up ticket status).
6. Coordination: `tasks/artifacts/cross-platform/2026-10-24-coordination/CLAUDE-TO-CODEX.md` and `CODEX-TO-CLAUDE.md`, from `CLAUDE-FIX-SPRINT-START-20261111` onward.
7. The Chef diary `tasks/diaries/2026-11-11-claude-fix-sprint-chef.md` and lane diaries `tasks/diaries/2026-11-1?-claude-fix-*.md`. These are working notes, not acceptance evidence.

## Commit range
- **Released:** master `1cdb1dc8f..631a00c19`, PR #430, a squash of candidate `27edf8381`. Per-lane commits on octoberBranch are listed in the debrief §6 and the lane briefs.
- **Follow-up release:** master `4243bcd4e..502a93b4c`, PR #431, a squash of candidate `981953daa` (octoberBranch `ec85232a1` without diaries). It covers the follow-up lanes (flag release, decisions 135–143) and Codex work the Chef adopted (areas 5–11). Per-lane commits on octoberBranch run after `c577225e2`.
- **Third release:** master `502a93b4c..e1ab46318`, PR #432, a squash of candidate `10bec8b32`. It covers the rolling-forge pipeline stall fix (`a25f3f542`), Codex areas 4 (`97685d418`), 3 (`b4a9fcf42`) and 2 (`7b3d328ba`), and the TeamDetails test fix (`7234e9682`).
- **Fourth release:** master `e1ab46318..4d9b6a10d`, PR #433, a squash of candidate `359789456` (octoberBranch `cd5604159` without diaries). It covers the follow-up lanes:
  - F1 CTPI v2 writer: `197612873`, `d8efc67a5`;
  - F2 SOS v2: `c894bb616`, `244645342`, and F2b `ebfc82bc7`;
  - F3 Lines 5v5: `ff873398d`;
  - F4 game finality: `94e4c7c67`, `073a5905e`;
  - W2-3 D13: `33b919192`.

  Migrations 144–146 were applied before the merge. Production steps and readbacks are in `production/PRODUCTION-QUEUE.md` and debrief §3.
- **Scope of this pass:** everything through master `4d9b6a10d` (#433). Work still in flight on 2026-11-13 is **out of scope for now**: Claude lanes F5–F8 (CTPI v2 validation, Game Grid odds labels and reserve projections, finality consumers and PK heads, Lines leftovers) and the Codex dev items in `master/fix-lanes/CODEX-DEV-2026-11-13.md`. The Chef ships them in one final release that evening and sends you a short addendum covering it.
- Codex releases in between (`866b90bc4` DRM, `4243bcd4e` Goalie Grid) are out of scope, except where they touch fix-sprint files or data. The adopted areas are in scope only where they touch fix-sprint files: area 3 changes L9b's `goalie-queries.ts` and L18's `creaseShift.ts`.

## What to audit
1. **Every finding the debrief marks fixed, per lane.** Does the code implement the corrected wording (Astra's corrections, where applicable)? Is there a test that fails on the pre-fix code and passes now (rule 11: valid statistics, algebraic identities on frozen fixtures, held-out checks where a model changes)? Were **all readers** updated (rule 4)? List any fix that is only a label, only tested by a tautology, or misses a reader.
2. **Partly fixed, deferred and declined items.** Is each reason sound and owner-sanctioned (a decision number or Chef acceptance)? Is anything deferred that a P0 actually needed?
3. **P0 coverage** (debrief §5: 45 P0s). Confirm or dispute each status, especially W1 #14, #16, #17, #27 and W3-P0-1 (partly), and the "fixed in code, data pending a rebuild" P0s.
4. **Units, scales and nulls** (rules 5, 13, 17, 21): unknown stays unknown, rates and shares pooled by their own denominators, explicit unit adapters, and versioned changes to issued history.
5. **Cross-lane consistency.** One shared definition per concept (strength state, EN, GSAA, mid-rank percentiles, QS, OT rule, odds pairing, the calendar policy) with no lane re-deriving its own. Release-together sets (§4.2) respected.
6. **Production actions vs approvals.** Each migration, rebuild, re-normalization, recovery and cron change matches an explicit TJ approval, its stated bounds and its readback. In particular:
   - the 2026-11-12 incident (DB hang and crash recovery under the windowed re-normalization): were the stop and resume decisions right, and is the state after recovery provably clean (no half-written games)?
   - the official-HTML OT recoveries: qualification rigour (identity, overlaps, coverage, ES and GS TOI), raw snapshots preserved, no fabrication;
   - summary rebuilds: built from the intended (v2) events; formulaRevision 2 coverage complete.
   - the 2026-11-13 restore of the production alias from Codex's temporary H1 CLI deployment;
   - the pg_cron 305 / Vercel cron 6 derived-build overlap at 10:05 UTC (debrief §7). 305 was moved to 10:25; confirm the fix and that it doesn't collide with anything else;
   - DB incident 2 (2026-11-13 01:55Z) and the paced runners used afterwards;
   - the 2026-11-13 actions:
     - the 2026-27 rolling recompute and the 2025-26 goalie partition rebuild;
     - indexes 123 and 124, and power ratings v3;
     - the xG champion retirement (decision 5), composites v3 publish, rankings and the team_unit_toi snapshot;
     - the trend-band history;
     - migrations 101 and 142–146;
     - release #433 and its post-release runs: game state, the CTPI v2 backfill, the first SOS v2 snapshot;
   - the pipeline stall fix (`a25f3f542`): was the root cause right? The 11-13 10:05 run completed every stage.
7. **The migrations.** For rows 101, 123–146: does each applied definition match its source file (sha256 in the authority row), and are the readback and rollback claims credible from the proofs in `supabase/tests/` (`l4a_*`, `f1_*`, `f2_*`, `f4_*`)? Note 141 superseding 135's playoff blanking. Also check that 144 and 145 freeze issued v1 history without changing any row (rule 21).
8. **Open risks the debrief may understate**, for example:
   - the FORGE trend-band reader turned inert, a live output change;
   - no in-house xG at all: there is no v2 model, and the champion was retired on 11-13;
   - PP share withheld;
   - 2025-26 data still on strength v1;
   - legacy-route usage unknown (the log check is pending);
   - Recent Team Form (CTPI) serves no rows until v2 is approved (lane F5);
   - the NST identity gap for one player on 2 dates, and WiGO rejecting 2 historic WGO rows;
   - SOS v2 counts 84 fixtures per team, because 2026-27 is an 84-game season.

## Output
Write `tasks/artifacts/calculation-inventory-2026-11-10/master/ASTRA-FIX-SPRINT-AUDIT.md` with:
1. A verdict per lane (accept / accept with findings / reject), with short reasons.
2. A findings table, most severe first: ID | severity (P0/P1/P2) | lane | claim checked | evidence (file:line, commit, test, receipt) | what's wrong | suggested fix.
3. A P0 table confirming or disputing the debrief's statuses.
4. Production-action review: each action vs its approval and receipt.
5. Items you couldn't verify without a production read, with the exact read you'd need (for TJ to approve or decline).
6. A short list of anything that should block the next release or rebuild.

Post a pointer and summary to `CODEX-TO-CLAUDE.md` as `ASTRA-FIX-SPRINT-AUDIT-<date>`.
