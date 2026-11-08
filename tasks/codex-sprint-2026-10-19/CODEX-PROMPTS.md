# Codex sprint prompt pack — 2026-10-19

Sources combined:

- `~/Downloads/SKO-VuDu-directional-plan.pdf` (Scout, 2026-10-15): SKO/VuDu research plan, Phases 0–3.
- `tasks/TASKS/super-goal/tasks-prd-fhfh-comprehensive-completion-audit-optimization.md` (same as the Downloads copy): 73 open `- [ ]` rows.
- `tasks/master-reconciliation-2026-10-17/REGISTER.md`: 109 rows (reconciled inventory).

## What is still unfinished, and who owns it

| Lane | Open work | Owner |
|---|---|---|
| FORGE / RSO / Start Chart | Register 1–31, Game Grid 32–37 (they consume FORGE), sustainability-audit NEW 10.0 and 13.0 (FORGE contamination/coverage), SKO/VuDu **Phase 1+** (it must consume FORGE's per-game expectations) | **Claude: "Code handoff review" session. Codex does not touch these.** |
| SKO/VuDu Phase 0 | Sign/semantics contract, source map, pure gap/score math with tests. Doesn't need FORGE output | Codex, prompt 2 |
| Repo audit/cleanup | Branch and worktree preservation inventory (register 94), path ledger of unreleased non-`tasks/` paths (95), side-branch salvage reports (7, 30, 41, 62, 72, 81), dead-code report | Codex, prompts 1, 3, 4 |
| Master-list hygiene | 6 template rows from `generate-tasks.mdc` that are counted as open; stale overlay paragraphs | Codex, prompt 5 |
| Cron/NST observability | C0076 (four routes have scheduler runs but no `cron_job_audit` rows), register 44/51 | Codex, prompt 6 |
| Sustainability, non-FORGE | Audit NEW 2.0, 6.0, 7.0, 8.0, 9.0 (local work is done; each still needs a deployed receipt), model 5.2 backtest (blocked: 0 projection rows) | Codex, prompt 7: local verification and a receipts plan only |
| Security (read-only) | A-AUTH NEW 46 PKCE, register 84 | Codex, prompt 8 |
| Yahoo ingestion 6.0/6.4/8.x, DRM NEW 20–39 | RSO reads the Yahoo tables; DRM is mostly deployed-canary gates | **Queued. Don't start until the RSO acceptance pass is done** |
| Needs you, not an agent | Credential rotation (Auth NEW 17, IFTTT NEW 13–18), ParlayAPI key, refund/pricing policy, owner/privacy facts, Gmail usage summary, release approvals | TJ |
| Parked | Register 97–103, 107 | Nobody |

---

## Paste this block at the top of every prompt (the fence)

```text
HARD RULES (read before anything else):
- Repo: /Users/tim/Code/fhfhockey.com, branch octoberBranch. Another agent (Claude) is editing in this same checkout right now.
- DO NOT run: git commit, git stash, git checkout, git switch, git reset, git restore, git clean, git rebase, git merge, git pull, git push, git worktree add/remove, git branch -d/-D. Read-only git only (status, log, diff, show, branch --list, merge-base, cherry -v).
- DO NOT edit, format, or move any file under these paths. Reading them is fine:
    web/lib/projections/**
    web/lib/rosterScheduleOptimizer/**
    web/lib/rosterScheduleData/**
    web/lib/in-season/**
    web/components/RosterScheduleOptimizer/**
    web/pages/start-chart.tsx, web/pages/api/v1/start-chart.ts
    web/pages/game-grid/**, web/pages/api/v1/forge/**, web/pages/api/v1/roster-schedule-optimizer/**
    web/pages/api/v1/db/run-projection*.ts, web/pages/api/v1/db/run-*forge*.ts
    web/__tests__/components/RosterScheduleOptimizer/**, web/__tests__/pages/api/v1/db/run-*
    supabase/migrations/**, migrations/**, sql/**
    web/package.json, web/package-lock.json, tsconfig*, vitest/playwright configs, .github/**, vercel.json
    tasks/sprint-2026-10-18/**, tasks/master-reconciliation-2026-10-17/**, tasks/artifacts/forge-team-context-fix-2026-10-19/**
- If the task seems to need a fenced file: STOP and write the needed change as a proposal in your report.
- No production or hosted calls of any kind: no Supabase MCP/CLI against the hosted project, no Vercel deploys, builds, or API calls, no route invocations against fhfhockey.com, no provider/Yahoo/NST/IFTTT requests. Local files, local tests, and fixtures only.
- No npm install, no lockfile changes, no `npm run build`. Allowed checks: `npm test -- <file>`, `npx tsc --noEmit`, `npm run lint` (run from web/).
- Never set GIT_DIR or GIT_WORK_TREE while running tests.
- Leave your changes uncommitted. End with an exact list of every file you created or changed, the checks you ran with pass/fail, and anything you could not verify.
- Write your notes and reports only under tasks/codex-sprint-2026-10-19/<your-lane>/.
```

---

## Prompt 0 — sprint kickoff (paste first, in the parent Codex thread)

```text
/plan
SPRINT MODE

You are the parent (Chef) for a Codex sprint in /Users/tim/Code/fhfhockey.com. Read AGENTS.md, SPRINT-MODE.md, mise-en-place.md and tasks/codex-sprint-2026-10-19/CODEX-PROMPTS.md before doing anything.

[paste HARD RULES block]

Your job:
0. FIRST, before any other step: run "Prompt S — status check" from CODEX-PROMPTS.md yourself (don't delegate it), and write tasks/codex-sprint-2026-10-19/STATUS-CHECK.md. Then adjust prompts 1–8 to match what it finds: skip a prompt whose work is already done, and narrow one whose inputs changed. Record each adjustment in the register. Do not start step 1 until STATUS-CHECK.md exists.
1. Create tasks/codex-sprint-2026-10-19/REGISTER.md as the sprint's one register. You are its only writer. Add one row for each of prompts 1–8 in CODEX-PROMPTS.md, using the SPRINT-MODE.md template fields. Put the "Queued" and "Needs TJ" rows from the lane table in as status blocked/parked, and use STATUS-CHECK.md to fill in their current status.
2. Assign prompts 1–8 to worker threads; each worker gets its prompt plus the HARD RULES block. Any two prompts that would edit the same file go to the same worker.
3. Review every worker report against its acceptance criteria before marking a row verified. A worker's report is evidence, not proof: re-run its focused tests yourself.
4. Do not create new work beyond prompts 1–8. When they are all done or blocked, stop and give me a summary: what was verified, what is blocked, and on what decision.

Do not touch the Claude-owned paths in the fence, even to "fix" something you notice there. Record it in the register as a note for TJ instead.
```

---

## Prompt S — Status check of TJ's sign-off and approval items (run before prompts 1–8)

Prompt 0 tells the parent to run this first. You can also paste it on its own.

```text
/goal Before any sprint work, find the current status of every item below using only local evidence (this repository, its task files, and git), and write tasks/codex-sprint-2026-10-19/STATUS-CHECK.md. Read-only: change nothing except that one file.

[paste HARD RULES block]
Extra rules for this check:
- Never open, print, or search for secret values. For the credential items, look only for dated receipts in tasks/ and commit messages that say a rotation or retirement happened. Never read .env* files and never try a key.
- No hosted, production, or provider calls. If the only way to learn an item's status is a production read, the status is "UNKNOWN: needs production read". Then write the exact read-only query or page that would answer it, and stop there.
- The baseline is tasks/master-reconciliation-2026-10-17/REGISTER.md (dated 2026-10-17). Search for anything newer: `git log --since=2026-10-17 --format='%h %ad %s' --date=short`, files changed under tasks/ since then, and tasks/sprint-2026-10-18/**. Read those files; don't edit them.

For each item, give one of these statuses:
- DONE: cite the evidence (file:line or commit).
- READY TO MARK OFF: the evidence supports closing it, but no one has updated the row yet.
- STILL NEEDS TJ: say exactly what action or decision is needed.
- BLOCKED: name the blocker.
- UNKNOWN: say what would answer it.

A. Rows that may be ready to mark off or reclassify
  A1 Master rows SRC::tasks/TASKS/rules/generate-tasks.mdc::C0001–C0006: are they still counted as open template rows?
  A2 Register #94: is the 2026-10-17 ref sync still accurate? Compare `git rev-parse master origin/master octoberBranch` with the register's claim, and check whether octoberBranch now contains master's tip.
  A3 Register #92: SHA-matched deployments. Look for any newer local receipt; don't call Vercel.
  A4 Register #4: is PP auditor 7e8ff2f8 still an ancestor of origin/master?
  A5 Register #88: is 3f6dd959 an ancestor of origin/master? Has a homepage acceptance brief been written anywhere under tasks/?
  A6 Register #97–103, #107: any sign that someone resumed them since 2026-10-17?
  A7 Register #104–109: any evidence in this repo for Beacon, Pipeline Proxy GPT, CRT/halftone assets, or guest/episode ideas?

B. Things only TJ can do (look for receipts only)
  B1 Auth NEW 17.0–17.3 (master C0084–C0087): Supabase service-role, Yahoo, Resend, database, and Google service-account rotation
  B2 Auth NEW 51.0 (C0208): plaintext credentials in old sent mail
  B3 GDL/IFTTT NEW 13.0–18.0 (C0076–C0081): retiring the Webhooks key. Has the pre-reconnect key been confirmed rejected?
  B4 GDL 10.4 (C0067) controlled applet events, and 14.0 (C0077) applet payload repair
  B5 GDL 6.2 (C0040): alias-review email triggered in production
  B6 Three Pillars 13.0/13.3 (C0066/C0069): ParlayAPI key and a live prop market row
  B7 Register #90: the Gmail "Weekly Usage Summary" email. Has it been shared or saved under tasks/?

C. Decisions from TJ (has a decision been recorded anywhere since 2026-10-17?)
  C1 #7: integrate 9592e2e6? Also check: is it an ancestor of octoberBranch now?
  C2 #41: integrate 8b6332? Do the physicalShiftIntervals*.ts files exist now?
  C3 #72/#81: is 76d507e still wanted?
  C4 #30: Start Chart display name. What does the <title> in web/pages/start-chart.tsx say now?
  C5 #24: the next Yahoo acceptance window (the Oct 12–18 window has closed)
  C6 #27: RSO daily-beta gate values
  C7 #60/#61/#73: proration rounding, refunds, post-cutoff collection, February promo
  C8 #84: operator/contact, retention, and tracking facts
  C9 #91: purpose of the empty-root fhfhockey.com Vercel project, and Node 20 vs 22. Read cms/ and functions/ package.json engines plus any .nvmrc; don't call Vercel.
  C10 #51: NST throughput, 6 URLs or 20 datasets
  C11 #58: whether to merge the two morning-report schedules
  C12 #36/#62/#78: rights for market/odds data, social redistribution, and ESPN
  C13 #77: paid API for live DUST

D. Production and external authorizations (has each been granted or run since 2026-10-17?)
  D1 #17: read-only `supabase migration list` against hosted. Do local migration files now exist for 20261004132508, 20261004132526, 20261004234756?
  D2 New runs: #2 goalie-start experiment, #15 fresh native run, #16 capture activation/budget, #18 daily prospective program, #35 slate-crowding evaluation
  D3 Production writes: #42 repair of game 2026020031, #79 one-game 140-row materialization, #40 genuine save, #38 hosted IFTTT activation
  D4 Deployed checks: DRM NEW 20–39 canaries (master C0046–C0065), Yahoo 8.3 (C0055), cron C0076 natural receipt
  D5 Release scope (#14, #45, #95, #96): for each of 6767073e, 569245ef, 26468a9f, 90ae40f0, 5c28f7e8b, cfaac232e4, 6e14053f, 1ddef915d, is it on octoberBranch, and is it now an ancestor of origin/master?

Deliverable format: tasks/codex-sprint-2026-10-19/STATUS-CHECK.md
1. A summary block: counts per status, and a short "TJ action list" ordered by priority. P0 credential items first, then decisions that unblock FORGE (C1), then everything else.
2. One table per section (A–D): ID | item | status | evidence (file:line, commit, or command + output) | what's needed next.
3. "Impact on prompts 1–8": which prompts to skip, narrow, or keep as written because of what you found.

Acceptance: every item A1–D5 has exactly one status and evidence or a reason; every git claim shows the command that backs it; the only changed file is STATUS-CHECK.md (`git status --porcelain` otherwise identical before and after). Stop when the file is written.
```

---

## Prompt 1 — Branch, worktree, and stash preservation inventory (read-only)

Register row 94. No collision risk: it doesn't write to any branch.

```text
/goal Produce a complete, read-only preservation inventory of every local branch, worktree, and stash in /Users/tim/Code/fhfhockey.com, so TJ can later approve cleanup safely. Delete nothing.

[paste HARD RULES block]

Steps:
1. List every local branch (`git branch --list`), every worktree (`git worktree list --porcelain`), and every stash (`git stash list`; read only, never pop or drop).
2. For each branch, record: tip SHA, last commit date, `git rev-list --count octoberBranch..<branch>` (commits not on octoberBranch), and whether those commits' content is already in octoberBranch (`git cherry -v octoberBranch <branch>`: lines starting with "-" are already present).
3. For each worktree: path, branch, whether the path still exists, and whether it has uncommitted changes (`git -C <path> status --porcelain | wc -l`). If the path is missing, mark it "prunable"; don't prune it.
4. Classify each item: SAFE-TO-DELETE-LATER (0 unique commits, no dirty files), HAS-UNIQUE-WORK (list the subjects), or UNKNOWN.

Deliverable: tasks/codex-sprint-2026-10-19/inventory/BRANCH-WORKTREE-INVENTORY.md with one table per category, plus a summary count at the top.
Acceptance: every branch, worktree, and stash appears exactly once; the counts match the git output; no git state changed (`git status` and `git stash list` are identical before and after).
Stop when the file is written. Don't propose deletion commands.
```

## Prompt 2 — SKO/VuDu Phase 0: contract, source map, and pure gap math

From the SKO/VuDu plan §5 and Phase 0. It's new code in a new folder. It may **read** `web/lib/sustainability/**` but doesn't change it.

```text
/goal Build SKO/VuDu Phase 0: one written contract for every sustainability score's meaning and sign, an exact source map, and a pure, tested TypeScript module for the directional gap. No UI, no API route, no database, no FORGE changes.

[paste HARD RULES block]
Also do not edit web/lib/sustainability/** or web/pages/skoCharts.tsx, web/pages/buy-low-sell-high/**, web/pages/sko-element/**, web/pages/trends/**. Read them only.

Background, settled decisions (do not re-debate):
- Product names: "SKO Outlook" (skaters) and "VuDu" (goalies). The precise metric name is "Sustainability Gap".
- Primary baseline label is "Expected Production". Never use "True Value" or "True Production".
- Gap D = M − R, where M = expected comparable rate and R = recent comparable rate, on the SAME denominator (per scheduled team game, per appearance, per 60, or per 100 on-net shots). Positive D = expected rebound, negative = expected cooling. For lower-is-better stats (GA rate, GAA), flip the orientation for the favorable-outlook display.
- Display score = 100 * tanh(D / s), with s > 0 a fixed scale per (target, horizon, basis). It is a display normalization: NOT a probability, NOT confidence. 0 means no modeled gap, not "stable".
- VuDu starting gap = 100 * (expected save probability − comparable recent save rate), shown as saves per 100 on-net shots. Compute SV% and GAA from totals, never by averaging ratios.
- Confidence stays separate: sample size, coverage, model uncertainty. Never fold it into the score.
- Labels: "Rebound watch" / "Cooling watch". NOT "Buy low" / "Sell high" (that needs market data, which is Phase 3).
- No streak probability, duration forecast, or "stabilizes after N games" rule.

Steps:
1. Read web/lib/sustainability/** (model.ts, config.ts, bands.ts, bandCalculator.ts, guardrails.ts, distribution.ts and their tests) and the pages listed above. Write tasks/codex-sprint-2026-10-19/sko-vudu/PHASE0-CONTRACT.md with:
   a. A table of EVERY existing score/label/band: file:line, current formula, sign convention, the UI wording that shows it, and whether the wording matches the sign. The plan already reports one mismatch: one reader calls a high score "overperforming" while other UI calls it "Durable". Find and cite every one.
   b. Known defects to confirm or refute with file:line: full-season reference queries with no as-of cutoff; missing inputs coerced to 0; serving paths that don't enforce the active model/config or freshness; personalized priors that exist but aren't used by the canonical window builder.
   c. A source map: each input stat → table/column → unit → strength state → as-of behavior.
   d. The new contract (the settled decisions above), written as rules.
2. Create web/lib/sko/gap.ts (new folder) with pure functions only:
   - `sustainabilityGap({ expected, recent, basis, lowerIsBetter })` → `{ gap, orientedGap, basis }`; throws if the inputs carry different bases.
   - `displayScore(orientedGap, scale)` → 100*tanh(gap/scale); throws on scale <= 0 or non-finite input.
   - `vuduSaveGap({ expectedSaveProb, recentSaves, recentShotsOnNet })` → saves per 100 shots; returns null (not 0) when shots = 0.
   - `rateFromTotals(numerator, denominator)`, returns null on a 0 denominator, never 0.
   - `watchLabel(orientedGap, threshold)` → "Rebound watch" | "Cooling watch" | null.
3. Create web/lib/sko/gap.test.ts. It must include these four named cases from the plan, plus the worked examples:
   - hot-but-supported (recent high, expected also high → small gap)
   - hot-and-overextended (recent 1.2, expected 0.8, scale 0.4 → D = -0.4, score ≈ -76)
   - cold-with-improving-role (recent 0.4, expected 0.8, scale 0.4 → ≈ +76)
   - cold-with-declining-role (recent low, expected also low → near 0; assert the label is null, not "Rebound watch")
   - lower-is-better orientation flip; mismatched-basis throws; missing data returns null, not 0.
4. Run: `npm test -- lib/sko/gap.test.ts`, `npx tsc --noEmit`, `npm run lint` (from web/).

Acceptance: the contract file cites file:line for every claim; gap.test.ts passes; tsc and lint introduce no new errors; nothing outside web/lib/sko/** and tasks/codex-sprint-2026-10-19/sko-vudu/** changed.
Out of scope (do NOT start): Phase 1 (consuming FORGE, building pages), Phase 2 backtests, Phase 3 market layer, choosing real values for `s`.
```

## Prompt 3 — Unreleased-path ledger (read-only)

Register row 95.

```text
/goal Write a path-level ledger of every non-tasks/ path that differs between origin/master and octoberBranch, so TJ can choose the next release scope. Read-only.

[paste HARD RULES block]

Steps:
1. `git diff --name-status origin/master...octoberBranch -- . ':!tasks'` (three dots). Do NOT include the uncommitted working tree; that belongs to the other agent.
2. For each path record: status (A/M/D/R), top-level area (web/pages, web/lib/<subdir>, web/components/<subdir>, supabase, cms, functions, webhooks, other), the commit(s) that last touched it on octoberBranch (`git log --format='%h %ad %s' --date=short origin/master..octoberBranch -- <path> | head -3`), and whether a test file for it exists.
3. Group by feature area (FORGE, RSO, Start Chart, Game Grid, Sustainability/SKO, Cron/NST, Yahoo, Draft, Social, Auth, UX/other). For each group, give a one-line risk note: does it include migrations, cron routes, or writer endpoints?

Deliverable: tasks/codex-sprint-2026-10-19/inventory/UNRELEASED-PATH-LEDGER.md (summary table first, then the full per-path table).
Acceptance: the path count equals `git diff --name-only origin/master...octoberBranch -- . ':!tasks' | wc -l`; every path appears exactly once.
Don't recommend a release; don't run any build.
```

## Prompt 4 — Side-branch salvage report (read-only)

Register rows 7, 30, 41, 62, 72, 81.

```text
/goal For six side-branch commits that the reconciled register flags as not fully integrated, report exactly what content is missing from octoberBranch and whether it still applies. Read-only; don't cherry-pick or apply anything.

[paste HARD RULES block]

Commits (register row → commit, branch if known):
- 7, 8 → 9592e2e6 (chef/forecast-m1-caller-integration). FORGE: report only; a decision on it belongs to the Claude session.
- 30 → 894fe7ea (chef/start-chart-consumer). Start Chart: report only, same as above.
- 41 → 8b6332 (forge cron-chain branches; adds physicalShiftIntervals*.ts)
- 62 → 2331cc1 (chef/social-share-tools; ~11% not present)
- 72, 81 → 76d507e (draft/WiGO; ~39% present)
- Also try to find 3d15e65e, 9984caf, c983535e, f3520f0, 0a6fed7: search `git log --all`, `git fsck --lost-found` (read-only), and every worktree listed by `git worktree list`. Report found / not found.

For each commit: the files it touched; for each file, whether it exists on octoberBranch and whether its added lines are present (`git show <sha> -- <file>` compared with the current file); `git apply --check --reverse` and `git apply --check` results (dry-run only, via `git show <sha> | git apply --check`); and a verdict: FULLY-PRESENT / PARTIAL (list the missing hunks) / ABSENT / CONFLICTS.

Deliverable: tasks/codex-sprint-2026-10-19/inventory/SIDE-BRANCH-SALVAGE.md.
Acceptance: each commit has a verdict backed by command output; the working tree is unchanged (`git status --porcelain` identical before and after).
```

## Prompt 5 — Master task list hygiene (docs only)

```text
/goal Fix false-open rows and stale navigation in tasks/TASKS/super-goal/tasks-prd-fhfh-comprehensive-completion-audit-optimization.md without changing any real task's status.

[paste HARD RULES block]
This lane may edit ONLY: tasks/TASKS/super-goal/tasks-prd-fhfh-comprehensive-completion-audit-optimization.md and tasks/TASKS/rules/generate-tasks.mdc. Make no other edits.

Steps:
1. The six rows `SRC::tasks/TASKS/rules/generate-tasks.mdc::C0001–C0006` are template placeholders ("Parent Task Title", "[Sub-task description 1.1]"), not tasks. Reclassify them as non-actionable template rows, using the file's existing exception/non-actionable convention (search the file for how other non-actionable rows are marked; copy that pattern exactly). Update the raw/actionable/mechanical counts in a NEW dated overlay paragraph at the top. Do not edit old paragraphs; they are append-only.
2. Add a short dated overlay paragraph (2026-10-19) that points to tasks/master-reconciliation-2026-10-17/REGISTER.md as the current reconciled register, and to the SKO/VuDu plan as a new initiative "SKO-VUDU" whose Phase 0 is being worked in tasks/codex-sprint-2026-10-19/sko-vudu/.
3. Add a "NEW" row under "## NEW Tasks" for SKO-VUDU with four children (Phase 0–3) copied from the plan's acceptance lines. Only Phase 0 is in progress; Phases 1–3 depend on the FORGE shared forecast release.
4. Count `- [ ]` and `- [x]` before and after; report both.

Acceptance: the only change in checkbox state is the six template rows plus the new SKO-VUDU rows; `git diff --stat` shows only the two allowed files; no historical paragraph changed (check with `git diff` that every removed line is a template row).
```

## Prompt 6 — Cron route-audit gap C0076 (local diagnosis + local fix)

```text
/goal Explain locally why four cron routes can run on schedule without writing cron_job_audit rows (master C0076: update-standings-details, update-nst-goalies, update-nst-team-daily, update-nst-team-daily-incremental), and fix it locally if the cause is in route code. No production access.

[paste HARD RULES block]
Allowed edits: the route files behind those four jobs (web/pages/api/v1/db/update-standings-details/**, update-nst-goalies.ts, update-nst-team-daily.ts; "incremental" has no file of its own, so find out which route and parameters job 328 calls), the shared audit wrapper web/lib/cron/withCronJobAudit.ts, and their tests. If the wrapper is imported by any fenced path (`rg withCronJobAudit web/pages/api/v1/db/run-*`), you may still read it, but limit wrapper edits to additive, backward-compatible changes and say so in your report.

Steps:
1. Read the four routes and withCronJobAudit/adminOnly. Find every early return, redirect, timeout, or streaming/res.end path that could exit before the audit row is written (e.g. a response sent before `await`, maxDuration exceeded, an exception thrown before the wrapper, a 307 at the edge, a method mismatch).
2. Check the scheduler side read-only: find these jobs' cron definitions in the repo (rg the job names / numbers 43, 99, 275, 328 in web/, supabase/, sql/, tasks/) and compare the URL/method they call with what the route accepts.
3. Write a failing Vitest test that reproduces the gap for the most likely cause, then make it pass with the smallest change. Extend the nearest existing wrapper/route test; don't create a duplicate file if one exists.
4. Run the focused tests, `npx tsc --noEmit`, and `npm run lint`.

Deliverable: tasks/codex-sprint-2026-10-19/cron-c0076/DIAGNOSIS.md (causes ranked, with file:line evidence; what is confirmed vs suspected) plus the code/test diff.
Acceptance: either a reproduced and fixed cause with a passing regression test, or a documented "not reproducible locally" with the exact production read needed (for TJ to approve). Do not mark C0076 closed; it still needs a natural deployed receipt.
NST rule: never add code that makes NST requests closer than 21 seconds apart.
```

## Prompt 7 — Sustainability audit: local re-verification and receipts plan (non-FORGE items)

```text
/goal For sustainability-trends audit rows NEW 2.0, 6.0, 7.0, 8.0, 9.0 (C0044, C0048–C0051 in tasks/TASKS/three-pillars-analytics/sustainability/tasks-prd-sustainability-trends-audit.md), confirm the local fix is still present and tested, and write the exact read-only production receipt each row still needs. Do NOT work on NEW 10.0 or NEW 13.0 (they involve FORGE; Claude owns them).

[paste HARD RULES block]
Allowed edits: test files under web/lib/sustainability/** only (to add a missing regression), and files under tasks/codex-sprint-2026-10-19/sustainability/.

Steps, per row:
1. Quote the row's claimed local fix. Find it in code (file:line) and the test that covers it. Run that test.
2. If no test covers it, add the smallest regression test next to the existing tests. Don't change the source.
3. Write the receipt it still needs: the exact table, columns, filter, and date window for a single read-only SQL query, or the exact log query, plus the pass condition. Don't run it.
4. Also check model row 5.2 / NEW 7.0 (C0077, C0088): confirm that the blocker (0 projection rows vs score rows) is still stated correctly in code/docs, and describe what data would unblock it. Don't run a backtest.

Deliverable: tasks/codex-sprint-2026-10-19/sustainability/RECEIPTS-PLAN.md (one section per row: code evidence, test result, pending receipt, pass condition).
Acceptance: every row has a file:line and a test result; no source file changed; no checkbox closed in any task list.
```

## Prompt 8 — Security read-only review (auth, PKCE, public data)

```text
/goal Do a read-only security review of the web app's auth and API boundaries, focused on A-AUTH NEW 46.0 (OAuth PKCE migration) and public routes that can trigger writes. Report only; change no code.

[paste HARD RULES block]
Never open, print, copy, or search for secret values (.env*, keys, tokens). If you see one, don't repeat it. Report only "a secret appears at <file>:<line>".

Steps:
1. Find the Supabase browser/server auth setup and callback/reset routes (rg "flowType|exchangeCodeForSession|verifyOtp|token_hash" web/). Check: is PKCE explicit; are callback `next`/return paths validated against open redirects; are codes and tokens scrubbed from the URL after exchange.
2. List every route under web/pages/api/** that writes to the database or calls an external provider, and whether it is wrapped by adminOnly / a cron secret / user auth. Flag any writer reachable without auth. Report fenced (Claude-owned) routes but don't propose edits to them; mark those "for Claude session".
3. Check for service-role client imports in any file that can be bundled for the browser (components/, pages/ non-api, hooks/).

Deliverable: tasks/codex-sprint-2026-10-19/security/AUTH-API-REVIEW.md with findings ranked P0–P3, each with file:line, a concrete exploit scenario, and a suggested fix. Separate confirmed findings from suspected ones.
Acceptance: every finding has file:line evidence; zero code changes (`git diff --stat` empty for code).
```

---

## Queued: release these only after Claude's RSO/FORGE acceptance pass

- **Yahoo ingestion 6.0 / 6.4 / 8.x** (`update-yahoo-*` routes): RSO's `web/lib/rosterScheduleData/query.ts` reads the Yahoo tables, so writer changes could shift RSO acceptance data mid-test.
- **DRM NEW 20–39**: their local work is done; the remaining gates are deployed canaries that need your approval.
- **SKO/VuDu Phase 1**: needs FORGE's versioned per-game expectations to be serving first.

## Needs TJ (no agent can do these)

Credential rotation (Auth NEW 17.x, IFTTT NEW 13–18), the ParlayAPI key (3P 13.x), refund/proration policy (register 60–61, 73), operator/privacy facts (84), the Gmail usage summary (90), the Start Chart display name (30), and every release/deploy approval.
