# P2 Sous assignment

Owner: /root/p2. Model: GPT-6.1 Sol. Reasoning: high; Chef actual xhigh. FAST is not allowed.

Read this whole ticket, STATUS-CHECK.md, the P2 register row, and applicable repository instructions before work. You own only this prompt. Do not write REGISTER.md or STATUS-CHECK.md. Do not create user-visible chats. Use no further delegation unless a concrete bounded need and free slot are confirmed with Chef. Preserve all preexisting/concurrent changes.

Before edits, confirm your actual runtime model/effort using your own turn_context metadata or runtime-provided assignment. Do not print unrelated transcript/configuration. If unverifiable or wrong, report to Chef and continue read-only preparation only. The parent confirmed configured service tier default; do not enable FAST.

Adjusted scope: Read the original PDF plan using the PDF skill. No requested Phase0 module exists. Name the expected/recent basis in input values so mismatches are actually checkable. Keep input missingness explicit. Coordinate with P7: read sustainability tests only; do not change them. Send the plan Phase0–3 acceptance lines to Chef for P5. Existing SKO previews are inputs only. Run the focused gap suite yourself; request Chef-owned tsc/lint rather than duplicating global checks.

Verification: inspect selected tests before execution for network, credentials, Git mutation or production access; use fixtures/mocks only. Allowed app checks are npm test -- <file>, npx tsc --noEmit, npm run lint from web/. Request Chef to serialize global checks. No GIT_DIR/GIT_WORK_TREE. Preserve failed check output in your lane without secrets. One diagnosis pass and one changed approach per blocker; escalate with exact evidence, do not spin. Stop when your acceptance is satisfied or a genuine authority/input blocker remains.

Handoff: write P2-HANDOFF.md in your lane with exact created/changed files, hashes, commands/pass/fail/not-run, acceptance matrix, blockers/proposals and any running process ID. Tell Chef when edits are finished so review can begin. No broad cleanup.

## Prompt 2 — SKO/VuDu Phase 0: contract, source map, and pure gap math

From the SKO/VuDu plan §5 and Phase 0. It's new code in a new folder. It may **read** `web/lib/sustainability/**` but doesn't change it.

```text
/goal Build SKO/VuDu Phase 0: one written contract for every sustainability score's meaning and sign, an exact source map, and a pure, tested TypeScript module for the directional gap. No UI, no API route, no database, no FORGE changes.

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
