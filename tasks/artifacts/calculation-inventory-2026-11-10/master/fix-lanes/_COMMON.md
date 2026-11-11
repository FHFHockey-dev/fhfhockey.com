# Fix lanes: rules every lane follows (Chef, 2026-11-11)

Every lane brief in this folder inherits this page. Where a brief and this page differ, the brief is narrower and wins for that lane; nothing here is relaxed by a brief.

## Where things are
- Repo: `/Users/tim/Code/fhfhockey.com`, branch `octoberBranch`, the **sole checkout**. No new branches or worktrees. Other lanes edit the same checkout at the same time; exact file ownership keeps you apart.
- Audit sources (all under `tasks/artifacts/calculation-inventory-2026-11-10/master/`):
  - `RULES-DIGEST.md` (decisions 1–82 and rules 1–12, one line each), plus rules 13–21 in `WAVE2-CONSOLIDATED.md` and 22–26 in `WAVE3-CONSOLIDATED.md`.
  - `OWNER-DECISIONS.md`: full text of every decision; it wins on any conflict. `OWNER-INTENT-SKO-VUDU.md` is binding for sKO and VuDu.
  - Consolidations (the authoritative reading where Fable and Astra disagree): `BATCH-A-CONSOLIDATED.md` (W1-1 to W1-5), `BATCH-BC-CONSOLIDATED.md` (W1-6 to W1-12), `WAVE2-CONSOLIDATED.md` (W2-1 to W2-9), `WAVE3-CONSOLIDATED.md` (W3-1 to W3-7, each with an "E. Condensed fix-agent handoff").
  - Raw audits in `audits/` and Astra reviews in `W1-Astra-PR/`. Read them only for the finding you are fixing; the consolidation's corrected wording wins.
- Source shorthand in briefs: **BA** = Batch A consolidation, **BC** = Batch B/C, **W2** = Wave 2, **W3** = Wave 3, then the pass (for example "W2 §W2-2 A D1" = Wave 2 consolidation, section W2-2, table A, row D1).

## Hard rules
1. **Ownership.** Edit only the files your brief lists as owned (plus new test files beside them, and new files inside owned directories). A file another lane owns is read-only to you: if your fix needs it, send Chef a ticket naming the file, the change and why. Never edit another lane's dirty file.
2. **Codex-owned paths: never edit.** BLSH (`web/lib/buyLowSellHigh/**`, `web/scripts/blsh/**`, BLSH preview and trade pages, `web/components/blshTrade/**`, `web/lib/player-cards/retainedBlsh.ts`); `web/lib/player-forecasts/sourceObservations.ts`; `web/lib/player-forecasts/playerForecasts.test.ts`; `web/lib/cron/*`; `web/lib/projections/verifiedForgeReleases*`; `web/lib/integrations/yahoo/*`; and the LANE-RULES list: `web/pages/api/v1/db/{cron-report,update-line-sources,update-lines-ccc,run-projection-accuracy,update-goalie-projections-v2,manual-refresh-yahoo-token}.ts`, `forgeProducerIdentity.test.ts`, `web/scripts/forge-producer-closure.ts`, their tests under `web/__tests__/pages/api/v1/db/`. If a fix needs one, append a proposal to `tasks/artifacts/cross-platform/2026-10-24-coordination/CLAUDE-TO-CODEX.md` (heading `CLAUDE-FIX-<lane>-<finding>-20261111`, the exact change and test), mark the finding **blocked on Codex**, and tell Chef.
3. **Claim before editing.** At start, read the last 60 lines of `CODEX-TO-CLAUDE.md` in that folder. If Codex has claimed any of your owned paths since 2026-11-10, stop and tell Chef. Otherwise append one short claim entry to `CLAUDE-TO-CODEX.md` listing your owned paths (`CLAUDE-FIX-<lane>-CLAIM-20261111`). Commit that mailbox line with your first commit (explicit pathspec).
4. **No production actions.** No production writes, migrations, backfills, rebuilds, recomputes, env changes, cron or endpoint runs, pushes, merges or deploys. List what your fix needs under "Production steps" in your report; Chef asks TJ per action.
5. **Reads.** Bounded read-only SELECTs only where your brief allows them. First write the exact query in your diary; check `pg_stat_activity` and stop if more than 5 queries are active or any has run longer than 10 s; no jsonb/payload bulk reads, no unbounded joins, no full scans of large tables. Never print `SUPABASE_DB_URL`, `CRON_SECRET` or service keys.
6. **No provider calls** (NST, NHL API, Yahoo) unless your brief allows them; if it does, NST limits are 40/1 min, 80/5 min, 100/15 min, 180/60 min across all callers, a burst of ≤ 39 URLs then ≥ 60 s, two bursts in a row then 5 minutes.
7. **Git.** Commit only your own files with explicit pathspecs (`git commit -m "..." -- <paths>`). Never `git add -A`, `git commit -a`, branch switches, stashes, resets or rebases. No push. **No LLM attribution** in commit messages (no Co-Authored-By, no AI mention). Never set `GIT_DIR`.
8. **Dev servers.** A second dev server must use `PLAYWRIGHT_ISOLATED_NEXT=1` (`.next-playwright`), never port 3000; stop it by exact PID, never `pkill`.
9. **UI changes** follow `tasks/TASKS/rules/fhfh-styles.md` and `brand-style-cheat-sheet.md` (no toenail left borders, keep blue brand chrome, keep coloured rank digits, page width 90%).
10. **Deletion.** No legacy view, RPC, route or column is deleted because of a math finding (rule 6). Hide, label or fail closed instead.
11. **Questions** go to TJ only through AskUserQuestion pop-ups, recommended option first labelled "(Recommended)", no extra "Other" option. Chef asks the brief's Tier B questions at lane start and relays the answers; ask TJ yourself only if a new material ambiguity appears.
12. **Sub-work.** For independent sub-work, start new sessions with start_session (not Agent subagents); use subagents only for read-only research you synthesize yourself. Give every session you start these same rules and your brief.

## How to fix and prove
- Focused diffs that extend nearby patterns. No speculative refactors, renames or cleanup outside the finding.
- **Fix every reader** (rule 4) and prove each fix **at the served reader** (rules 7, 14), not only at a writer or helper.
- Tests must be valid statistics (rules 11, 15, 24): algebraic identities on frozen fixtures whose correct answer differs from the defect's answer; held-out checks where a model changes. A test must **fail on the current code** before your fix (show it in your diary), must not encode an unchosen policy, and must not be an identity that holds by construction.
- Units are declared by adapters (rule 17); unknowns stay unknown (rules 5, 13, 22, 23); combine each quantity by its own algebra (rule 26); ranks never depend on input order (rule 20); issued evidence stays as issued and repairs are versioned successors (rule 21).
- Existing tests that pin the defect are updated with a one-line reason in the commit message, never deleted silently.

## Checks (run in `web/` unless stated)
- Vitest per file: `env -u GIT_DIR npm test -- <file>`.
- `npm run typecheck` (8 GB heap); read the **exit code**. Plain `npx tsc` runs out of memory and looks clean when grepped.
- ESLint on changed files: `npx eslint <files>`.
- pytest for `functions/` and `modeling/` changes (from the repo root or the package dir, as its README says).
- After any `.module.scss` edit, the CSS Modules pure check (sass + `postcss-modules-local-by-default` in `mode: "pure"`).
- SQL migrations are written as new files under `supabase/migrations/` and tested locally only (no `db push`, no remote apply).

## Diary and report
- Diary: `tasks/diaries/2026-11-11-claude-fix-<lane>.md` (lowercase lane id, e.g. `fix-l2`). Update it at start, at each checkpoint or decision, and before stopping. No secrets.
- Report to Chef with SendMessage to the Chef session id given in your start prompt, under about 2,000 characters per message: commit SHAs; each finding fixed, deferred, declined or blocked (with its id and reason); checks run with results and exit codes; readers updated; production steps needed (exact action, bounds); open questions. A report is a claim: Chef re-checks your diff and tests before accepting.
- Done means every finding in the brief is fixed with a failing-then-passing test, or explicitly deferred/blocked with a reason Chef accepts.
