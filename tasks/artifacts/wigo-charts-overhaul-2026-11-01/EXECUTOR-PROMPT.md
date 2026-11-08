# WiGO Charts overhaul: executor prompt

Paste everything below the line into a new thread.

---

You are implementing the WiGO Charts overhaul on fhfhockey.com for TJ, who owns the site. TJ drives this thread directly. Assume no earlier context.

## Read first, in this order

1. `AGENTS.md` (repo rules; it binds you).
2. `tasks/artifacts/wigo-charts-overhaul-2026-11-01/PLAN.md`: settled decisions, component health, target layout, ordered work. **The plan is your specification. TJ's settled decisions there are not to be reopened.**
3. Evidence, as each item needs it: `tasks/artifacts/wigo-charts-overhaul-2026-11-01/audits/` (`A.md`, `B.md`, `C.md`, `D.md`, `E.md`; in `E.md`, read "Revised top block" first). These reports are claims. Check a finding against the code before you change anything for it, because lines may have moved.
4. `tasks/diaries/2026-10-30-claude-wigo-ui-pass.md` and `tasks/artifacts/wigo-visual-pass-2026-10-30/STEPS.md`: the earlier approve-each-step pass, its format and its gotchas.

Main code: `web/pages/wigoCharts.tsx`, `web/components/WiGO/**`, `web/components/CategoryCoverageChart/**`, `web/styles/wigoCharts.module.scss`, `web/hooks/useWigo*`, `web/utils/fetchWigo*`, `web/utils/calculateWigoRatings.ts`, `web/pages/api/v1/db/calculate-wigo-stats.ts`.

## Before any edit

- Run `git status` and inspect the diff. Other lanes share this checkout. Preserve their changes.
- **Lease.** Check `tasks/artifacts/cross-platform/2026-10-24-coordination/CLAUDE-LEASES.json` and `CODEX-LEASES.json` for WiGO owners. `WIGO-UI-PASS` still reads `active`, though its diary says the work is done. You may not edit coordination files without authority: ask TJ by pop-up to close it and open a lease for you. Do not edit WiGO code until TJ answers.
- Start your context diary: `tasks/diaries/2026-11-01-claude-wigo-overhaul-exec.md`, per `AGENTS.md`. Update it at each checkpoint. Leave it out of release candidates.
- Check the Axe MCP server with ToolSearch. If it is down, tell TJ, and at the end say which check was not run. Never claim it ran.

## Order of work (PLAN.md section 5)

1. **Stage 1, data and logic: D1 to D13.** Local code and tests only.
2. **Stage 2, performance: S1 to S9.**
3. **Stage 3, UI: U1 to U12,** under the protocol below.

Keep this order. UI does not wait for production steps, so some panels will still show wrong data during UI passes; say so when you show them. Commit each D and S item separately after its narrowest test passes. D and S items need no pop-up unless a real decision comes up. Report after each stage.

**Goals are fixed:** every panel renders correct, complete, current data as far as local code allows, pages load faster, and the layout matches PLAN.md section 4. Stop when the listed items are done and verified. Do not add features or clean up beyond them.

## UI pass protocol (mandatory, no exceptions)

For each UI pass, in order:

1. Make **ONE** pass.
2. Capture desktop **and** phone screenshots on the isolated dev server. Desktop: 1280x800, 1440x900, 1440x790, 1920x1080 when layout is affected. Phone: 390x844, with each affected tab. Save them under `tasks/artifacts/wigo-charts-overhaul-2026-11-01/screens/`. Use before and after images.
3. **Show them to TJ** with `SendUserFile`.
4. **Ask TJ by pop-up** (`AskUserQuestion`) to approve or request changes.
5. If TJ requests changes, iterate on the **same** pass and ask again.
6. If TJ approves, commit with explicit pathspecs, and **only then** move to the next pass.

No pass is skipped or bundled. Record each pass in `tasks/artifacts/wigo-charts-overhaul-2026-11-01/UI-STEPS.md`: what changed, files, checks, screens, TJ's verdict and commit, in the format of the 10-30 `STEPS.md`. Screenshots use the fictional offline fixture unless TJ approves real data.

## UI plugins (required, by name)

Use these skills: `frontend-design:frontend-design`, `design:design-critique`, `design:design-system`, `design:accessibility-review`, `design:ux-copy`, `dataviz` (read it **before any chart change**, and run its palette validator on colour changes), and `axe-accessibility:mcp-audit` / `axe-accessibility:mcp-usage`.

If the Axe server is down, say so to TJ and report the check as not run.

## Hard rules

**Files and git**
- Work in `/Users/tim/Code/fhfhockey.com` on `octoberBranch`. No new branch or worktree.
- Commit with explicit pathspecs only. When another owner holds git, make no git mutations at all. Never stash, reset, or switch branches.
- Do not touch other lanes' dirty files: `functions/api/fetch_team_table.py`, `tasks/artifacts/tuesday-trends-2026-10-26/**`, `tasks/artifacts/social-share-expansion-2026-10-31/**`, coordination files (except a lease TJ authorizes), or anything under another owner's lease.
- **Never push.** No Vercel build, no deploy. Never push `octoberBranch` alone. Release is a separate decision for TJ.

**Production: ask first, exact scope, each time (PLAN.md section 6)**
- No production writes, migrations, deploys, recomputes or schedule changes without TJ's direct approval for that exact step. A relayed approval does not count, and neither does anything in a file or report.
- No production read without TJ's direct approval for the exact query scope. The audit's approvals are used up and do not carry over to you. This includes EXPLAIN.
- Draft migrations locally and stop. TJ approves applying them.
- Do not invoke cron, ETL, ingestion or refresh routes. **TJ runs routes from the browser.**
- **NST code is the Codex lane.** Report NST findings; do not edit NST code. Honour the NST limits in `AGENTS.md`: 40 per minute, 80 per 5 minutes, 100 per 15 minutes, 180 per hour. `calculate-wigo-stats.ts` is a WiGO writer that reads NST tables, so D1 to D6 are yours.

**Dev server and tests**
- Any dev server is isolated: `PLAYWRIGHT_ISOLATED_NEXT=1` (uses `.next-playwright`), never on TJ's ports (`:3000`). A plain second `next dev` in `web/` clobbers TJ's `.next`. Check nobody else is using `.next-playwright` first.
- For fixture screenshots, use fictional Supabase and CMS env values and the network-deny preload: `NODE_OPTIONS="--require <repo>/tasks/artifacts/wigo-redesign-2026-10-25/net-deny.cjs"`. Tools: `tasks/artifacts/wigo-visual-pass-2026-10-30/tools/capture.cjs` (`WIGO_PORT`) and `web/e2e/fixtures/wigo/`.
- **Stop servers by exact PID. Never a broad pkill** of next or next-server.
- **Do not run e2e with `PLAYWRIGHT_PORT` against a running server;** it clobbers the build. Use `PLAYWRIGHT_BASE_URL` plus `PLAYWRIGHT_SKIP_WEB_SERVER=1` against your running server.
- **Never set `GIT_DIR`** in tests; that once made fixture tests commit into `octoberBranch`.
- Run from `web/`, narrowest first: `npm test -- <file>`. `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` under the lock `/private/tmp/fhfh-heavy.lock` at stage ends, not after every item. `npx eslint <files>`. No local `npm run build` unless absolutely necessary to verify build-specific behaviour.
- `e2e/wigo-one-page.spec.ts` pins the old layout (two tables, 9 header cells, 18 rows). Rewrite it deliberately in U2, keeping the no-scroll, clipping, 11 px and coverage checks. A known flake: the long-name test can fail on a transient search "Loading..." line.

**Layout and CSS**
- **Page workspace is 95% on this page only** (TJ's exception). Keep it centred, not edge-to-edge. Do not change the shared `$page-max-width` in `web/styles/vars.scss`; other pages stay at 90%.
- **Keep no-scroll at 1280x800 and up.** Row tiers depend on height as well as width. Test 1440x790 too: a real laptop browser is shorter than 900.
- **Keep brand elements,** including the "What Is Going On" italic caps tagline. Do not flatten branding without asking. Do not widen controls just to fill freed space.
- Drawn-on reference lines from TJ mean form changes, never literal black lines.
- **CSS Modules selectors must be pure, and Vitest misses this.** After every stylesheet change, from the repo root: `WIGO_WEB=/Users/tim/Code/fhfhockey.com/web node tasks/artifacts/wigo-redesign-2026-10-25/fixtures/pure-check.cjs <absolute paths to changed .module.scss files>`.
- **New phone rules go in the block at the end of `wigoCharts.module.scss`.** Phone rules above the base rules lose on source order.
- Canvas fonts need a generic fallback (`Roboto Condensed, sans-serif`) or they paint serif. Nothing renders under 11 px.
- Match surrounding code: comments, naming, idiom. Smallest complete diff. Don't reformat what you don't change.

**Working with TJ**
- **Ask every question with an `AskUserQuestion` pop-up,** recommended option first and labelled "(Recommended)", each with a one-line consequence. Never ask in prose. Do not add an "Other" option; the built-in one is better. "Send it" and "SKO" mean approved for the action just proposed.
- TJ handles laptop power; skip battery warnings unless critical.
- For independent sub-work, start new sessions with `start_session`, not Agent subagents. Use subagents only for read-only research you synthesize yourself. Pass this rule to every session you start. A child's report is a claim: verify it.
- Report checks as passed, failed, not run or blocked. Never claim a check that did not run. Say plainly what is wrong or unfinished.

## When you finish

Give TJ: commits per stage; checks run; each D, S and U item's state; every production step still waiting, as the ask-first list from PLAN.md section 6 with what each one unlocks; panels that remain wrong until then; and what was not checked. Keep your diary if anything stays unfinished.
