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
3. `master/OWNER-DECISIONS.md` (decisions 1–139) and `master/RULES-DIGEST.md` (rules 1–26).
4. Production receipts in `master/production/`:
   - `PRODUCTION-QUEUE.md` (approvals, results, incident, remaining steps);
   - `GOALIE-REBUILD-2026-27-PLAN.md`;
   - `GAME-2026020159-RECOVERY-PLAN.md` (official-HTML recoveries of 11 OT games);
   - `HEADS-CHANGED-2026-11-12.tsv`.
5. `tasks/TASKS/repository-audit-remediation/migration-authority.json`: rows 88 and 125–141 carry the apply receipts.
6. Coordination: `tasks/artifacts/cross-platform/2026-10-24-coordination/CLAUDE-TO-CODEX.md` and `CODEX-TO-CLAUDE.md`, from `CLAUDE-FIX-SPRINT-START-20261111` onward.
7. The Chef diary `tasks/diaries/2026-11-11-claude-fix-sprint-chef.md` and lane diaries `tasks/diaries/2026-11-1?-claude-fix-*.md`. These are working notes, not acceptance evidence.

## Commit range
- **Released:** master `1cdb1dc8f..631a00c19`, PR #430, a squash of candidate `27edf8381`. Per-lane commits on octoberBranch are listed in the debrief §6 and the lane briefs.
- **After the release (not yet released):** octoberBranch commits after `c577225e2`. These are follow-up lanes (flag release, decisions 135–138) and Chef records.
- Codex releases in between (`866b90bc4` DRM, `4243bcd4e` Goalie Grid) are out of scope, except where they touch fix-sprint files or data.

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
7. **The migrations.** For rows 125–141: does each applied definition match its source file (sha256 in the authority row), and are the readback and rollback claims credible from the proofs in `supabase/tests/l4a_*`? Note 141 superseding 135's playoff blanking.
8. **Open risks the debrief may understate**, for example:
   - the FORGE trend-band reader turned inert, a live output change;
   - no in-house xG for new games (decision 99);
   - PP share withheld;
   - 2025-26 data still on strength v1;
   - legacy-route usage unknown (the log check was inconclusive).

## Output
Write `tasks/artifacts/calculation-inventory-2026-11-10/master/ASTRA-FIX-SPRINT-AUDIT.md` with:
1. A verdict per lane (accept / accept with findings / reject), with short reasons.
2. A findings table, most severe first: ID | severity (P0/P1/P2) | lane | claim checked | evidence (file:line, commit, test, receipt) | what's wrong | suggested fix.
3. A P0 table confirming or disputing the debrief's statuses.
4. Production-action review: each action vs its approval and receipt.
5. Items you couldn't verify without a production read, with the exact read you'd need (for TJ to approve or decline).
6. A short list of anything that should block the next release or rebuild.

Post a pointer and summary to `CODEX-TO-CLAUDE.md` as `ASTRA-FIX-SPRINT-AUDIT-<date>`.
