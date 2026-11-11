# Math audit → fix sprint: plan (TJ, 2026-11-11)

TJ's sequence, with his pop-up answers of 2026-11-11 applied. Chef owns steps 1 and 3 and starts step 4.

## Settled
- **Astra input to Wave 3:** each Wave 3 Fable chat reads its upstream Astra reviews: the verdict/decision and corrections/new-findings sections only, plus the Astra-merged consolidation sections.
- **Lane scope:** fix lanes cover **all three waves** (Wave 1 P0s and the rest, Wave 2, Wave 3), Fable plus Astra, grouped by code area so that one lane owns each set of files.
- **Production gates:** lanes fix and test locally. The sprint orchestrator batches production steps (migration, backfill, rebuild, env change, push/merge/deploy) and asks TJ **per action** by pop-up, under the standing rules.
- **Concurrency:** at most **4** fix lanes at once.

## Steps
0. **Wave 2 merge** (waiting on Astra's last three reviews): `WAVE2-CONSOLIDATED.md`, the same shape as the Batch A and B/C consolidations; new owner questions settled by pop-up. Wave 3 starts after it.
1. **Wave 3 Fable audits** (`wave3-prompts/`, slim): they use the upstream Astra reviews, audit as instructed, and end with a **final analysis and fix-agent handoff** (analysis, prioritised fixes with files, readers and tests, directional suggestions, fix-agent context, suggested lane). w3-7 waits for `OWNER-INTENT-SKO-VUDU.md`.
2. **Astra reviews each Wave 3 audit** (TJ runs it), into `W1-Astra-PR/w3-*.md`.
3. **Chef merges Fable and Astra findings into fix lanes:**
   - `FIX-LANES.md`, the index: lanes, order, dependencies, which can run in parallel;
   - `fix-lanes/<lane>.md`, one brief per lane: scope; owned files (exact paths, with no overlap between lanes); findings with sources (audit and Astra ids) and the corrected version where Astra disagreed; applicable decisions and rules; required tests; production steps needing approval; out of scope (Codex-owned paths such as `web/scripts/blsh/**` and Scout's lanes; anything needing an owner decision not yet made).
   - Lanes are ordered by the P0 list and dependencies: units and definitions first, then readers, then models and evaluation.
4. **New sprint orchestrator** (a new Opus session using `/orchestrator`). It starts one **Opus session per lane** (sessions, not subagents), at most 4 at once, from the lane briefs.
5. **Lanes fix** leaks, inefficiencies and inaccuracies locally in the sole checkout (`octoberBranch`, exact file ownership). Each lane: a focused diff; tests per brief (Vitest, `npm run typecheck`, ESLint on changed files, pytest for `functions/` and `modeling/`, the CSS Modules pure check where relevant); a context diary; commit locally, no push. Lanes follow `LANE-RULES.md` (read hygiene, NST limits/decision 14, no GIT_DIR, no secrets, never touch :3000) and the attribution rule (no LLM attribution in commits or PRs). Production steps go back to the orchestrator, which asks TJ.
6. **Sprint debrief:** the orchestrator writes `FIX-SPRINT-DEBRIEF.md` from top to bottom. It covers:
   - per lane: what changed (commits, files), findings fixed, deferred or declined (with reasons), and tests run with results;
   - production actions taken with approvals;
   - remaining risks;
   - owner decisions still open;
   - a cross-lane interaction check.
7. **Astra audits the whole sprint**, against the debrief, the lane briefs and the commit range.

## Standing constraints that still apply
- All non-fix implementation lanes remain paused (LANE-RULES pause, 2026-11-10) until TJ lifts it; this plan authorises the fix lanes only.
- Release mechanics are unchanged: a clean-export gate, the Vercel footprint check, and smoke tests of ≤ 5 sequential GETs, each by TJ's approval.
