# Repository Agent Instructions

## Scope and Priorities

- Treat this file as the default for the repository. Follow more specific instructions if a nested `AGENTS.md` is added later.
- Make every meaningful action reduce uncertainty, advance the requested implementation, or verify its result. Reuse established conversation and repository context; do not repeat settled analysis.
- Keep work narrowly scoped. Avoid speculative features, unrelated cleanup, premature generalization, and broad exploration of the codebase.
- Prefer the smallest complete, maintainable diff. Preserve unrelated code, formatting, comments, and user changes already in the working tree.
- Stop when the requested outcome is complete and proportionate verification has passed. Do not continue with optional cleanup, broader checks, or extra improvements merely for additional confidence.

## Delegation and Review

- For substantial work that can be divided into independent, bounded tasks, follow [mise-en-place.md](mise-en-place.md). The lead agent (Chef) owns scope, staffing, integration, verification, and the final decision to deliver. Verify actual model and reasoning settings before delegation; Chef's reasoning effort must be higher than every worker's. Do not delegate a small or inseparable task merely to create parallel work.
- The optional [SPRINT-MODE.md](SPRINT-MODE.md) protocol applies only after the user issues `SPRINT MODE` as a command; `STOP SPRINT` stops it. Documentation, quotations, and discussion do not activate it. Normal pacing remains the default, and all existing repository rules and permissions remain in force.

## Branch Naming

- Use `/Users/tim/Code/fhfhockey.com` on `octoberBranch` as the sole local FHFH editing checkout and branch. Preserve `fhfhockey-october` and other historical worktrees without further edits. `master` is the release branch: reconcile accepted work into it, then sync `octoberBranch` from the released commit before continuing.
- Coordinate concurrent work through exact file ownership in the canonical checkout. Do not start another editing branch or worktree unless the user explicitly changes the sole-checkout instruction; preserve existing divergent history and unfinished work.
- Name new agent-created branches `chef/<descriptive-name>`, not `codex/`. Keep `master` and `octoberBranch` as the long-lived branches.
- Before deleting a branch, check for unmerged commits and unfinished work; preserve unique work before cleanup.

## Task Routing and Repository Map

- `web/`: primary Next.js application, API routes, Vitest tests, Playwright E2E tests, scripts, and most Supabase client/migration tooling.
- `cms/`: Sanity Studio.
- `functions/`: serverless functions; its documented local server is launched from the repository root.
- `webhooks/`: standalone webhook service for long-running/browser-backed tasks.
- `supabase/`, `migrations/`, and `sql/`: database configuration and SQL. Check which migration tree the relevant workflow uses before adding or moving SQL.
- `.github/workflows/`: CI evidence; the rankings Playwright workflow runs from `web/` with the Node version pinned in `web/.nvmrc` and npm.
- `tasks/`: plans, PRDs, and artifacts, not application runtime code. Consult only when the task names one or the implementation directly depends on it.

Start with named files, their nearest implementation/tests, and relevant configuration. Use imports as bounded navigation hints; follow imports-of-imports only while they can affect the current decision. Prefer `rg`, `rg --files`, exact paths, and narrow line ranges. Do not recursively inventory the repository or reread unchanged files without a new uncertainty.

## Commands

Run JavaScript application commands in the owning directory; there is no root package manifest. The commands below are available entry points, not a checklist; run only those justified by the affected surface.

### Web app (`web/`)

- Install reproducibly: `npm ci` (npm and `web/package-lock.json` are the sole package-manager authority; CI and local use Node 22.11.0 from `.nvmrc`).
- Develop: `npm run dev`; use `npm run dev:stable` if file watching reports `EMFILE` or generated `.next` files disappear.
- Local production build (exception only): `npm run build`; use it only under the criteria in Verification and Testing.
- Lint: `npm run lint`.
- Type-check: `npx tsc --noEmit`.
- Run one Vitest file: `npm test -- path/to/file.test.ts`; filter a test by name with `npm test -- -t "test name"`.
- Run the unit suite once: `npm run test:full` (equivalent verification entry point: `npm run verify:full`).
- List rankings E2E tests without launching Chromium: `npm run test:e2e:rankings -- --list`.
- Run rankings E2E: install once with `npm run e2e:install`, then run `npm run test:e2e:rankings`.
- In a sandbox with an unwritable browser cache, use `npm run e2e:install:workspace` and `npm run test:e2e:rankings:workspace`.
- Run all E2E specs only when broad browser coverage is justified: `npm run test:e2e`.
- Run Supabase CLI commands from `web/`; if npm-cache or telemetry writes fail in a sandbox, use `npm run supabase:safe -- <arguments>`.

Playwright starts `npm run dev:stable` on port 3100 unless `PLAYWRIGHT_BASE_URL` and `PLAYWRIGHT_SKIP_WEB_SERVER=1` point it at an existing deployment. Rankings E2E requires the Supabase variables shown in `.github/workflows/rankings-e2e.yml`. Do not claim browser execution succeeded when Chromium is blocked by the macOS sandbox; test discovery is a separate check.

### Other applications

- Sanity Studio (`cms/`): `npm run dev` for development. Run `npm run build` only when a local production build is necessary to verify build-specific behavior.
- Serverless functions (from repository root): `yarn vercel dev --cwd functions --listen 3003`.
- `webhooks/` has no functional test script; its current `npm test` intentionally exits with an error. Do not present it as verification.

Do not invent root-wide build, lint, format, or test commands. No repository formatting script is configured. Avoid dependency installation, lockfile regeneration, code generation, or long-running servers unless the task requires them. After a failed command, inspect the error and change the command, environment, assumption, or approach before retrying; do not rerun successful checks without a reason.

## Edit Policy

- Inspect the current diff before editing and preserve unrelated modifications.
- Prefer focused patches over full-file rewrites. Extend nearby patterns before introducing an abstraction.
- Avoid generated-looking churn: unrelated formatting, import reordering, renaming, or comment changes.
- Do not modify manifests, lockfiles, generated output, CI, or tooling unless the requested change requires it.
- Check the final diff for accidental collateral changes.

## Verification and Testing

- Match verification to impact. Start with the affected file, symbol, Vitest file, Playwright spec, route, or package; escalate only when shared behavior or repository convention justifies it.
- Add or update tests when behavior changes, a bug needs regression coverage, or an established convention requires it. Prefer extending the nearest relevant test over creating a new test file; do not add duplicate or low-value tests.
- For `web/` TypeScript changes, run the narrowest relevant test first, then `npx tsc --noEmit` and/or `npm run lint` when the affected surface warrants them. Run a local `npm run build` only when it is absolutely necessary to verify build-specific behavior that narrower checks cannot cover; do not run it merely as a final confidence check.
- Treat every remote Vercel build or deployment, including preview and production, as a costly external action. Never trigger one as routine verification or through another action known to create a deployment unless the user explicitly authorized that remote build in the current task.
- For browser behavior, prefer the relevant Playwright spec. Use `--list` only to verify discovery; it does not verify runtime behavior.
- For Markdown or instruction-only changes, inspect the rendered content/diff and validate referenced commands against manifests/configuration; do not run application suites solely because documentation changed.
- Report checks as passed, failed, not run, or blocked. Never claim a command or behavior was verified unless it was actually run or directly observed.

## Vercel Usage and Cost Controls

- Minimize both build usage and runtime usage (function CPU, memory duration, requests, and data transfer). CLI commands, dashboard actions, Git-triggered deployments, cron jobs, and direct API calls can consume the same underlying paid resources; changing the trigger is not a cost exemption.
- Default to local development, focused tests, fixtures/mocks, and existing logs or cached results. Keep tests isolated from production databases and services; local execution alone does not make a test safe or free. Batch related fixes into one locally verified release candidate. Do not use repeated remote builds or deployments to discover errors that local checks can catch.
- Use the local dev server for iterative UI previews and QA. Automatic Git preview deployments are disabled by user direction; do not re-enable them or create manual remote previews without explicit authorization. Production verification is limited to an approved release candidate and the bounded smoke-test budget below; do not use production for experiments or unreviewed changes.
- Preview builds, production deployments, redeploys, and pushes or merges known to trigger them require explicit current-task authorization for that remote action. A request to edit, test, commit, or audit does not authorize deployment. Confirm the target project, environment, branch, and exact candidate SHA before the approved release.
- Before an authorized push or merge, inventory every linked Vercel project and its root directory, branch trigger, and ignored-build behavior. Record the expected deployment entries and builds across all projects, including companion CMS/functions projects; distinguish ignored or canceled entries from completed builds and do not assume one push means one build. If unrelated projects would build, propose a targeted skip/filter plan for approval before publishing; do not silently disable projects or integrations.
- Before triggering or retrying a deployment, inspect the existing deployment and build status for that exact SHA and environment. Reuse a suitable successful deployment and wait for an in-progress one. Do not launch duplicate CLI, dashboard, or Git builds. Inspect the failure first; retry only after a relevant correction or evidence of a transient failure, within the authorized scope.
- Keep documentation-only and instruction-only work build-free. Use an already-approved, verified no-build workflow when publishing it; otherwise keep the change local and explain the blocker. Do not silently change Git integration, ignored-build rules, project settings, credentials, or deployment configuration to suppress builds.
- Prefer bounded, read-only observability for production diagnosis: inspect existing logs, deployment metadata, usage records, and job status before making application requests. A GET request or a dry-run option is not proof that an endpoint is cheap or read-only; inspect its behavior first.
- Do not invoke cron, ETL, ingestion, refresh, rebuild, recompute, sync, or publishing endpoints merely for QA, and do not repeatedly run them to poll progress. Use fixtures locally and existing job records remotely. Any necessary production execution must have explicit authorization and known bounds for dates, records, batches, concurrency, runtime, writes, and downstream fan-out. Keep NST requests at least 21 seconds apart across participating jobs; do not reduce spacing or enable bursts as a cost optimization.
- For an authorized production smoke test, default to at most five sequential read-only application requests (concurrency one), with exact routes and a stopping condition stated before execution; explain and obtain approval for a larger budget; reuse warm/cached read paths where they answer the question. Stop once the check is conclusive. No heavy production load tests, repeated full browser crawls, cache-busting loops, or unbounded polling without separate explicit authorization.
- Preserve essential cron coverage, data freshness, and health/reporting jobs. Do not blanket-disable schedules to reduce a bill. Propose targeted changes only after checking per-route usage, invocation frequency, duration, overlapping runs, and required freshness; explain the operational tradeoff and obtain approval before changing production schedules or settings.
- Before expensive remote validation, summarize why narrower checks are insufficient, the expected resource usage and limits, and any unknown cost. Report actual builds/deployments and bounded production requests performed, with unresolved cost attribution clearly labeled. Do not claim savings or blame a route without supporting usage evidence.

## Architecture Rules

- Keep responsibilities localized and preserve existing boundaries among the web app, CMS, functions, webhooks, and database assets.
- Do not add unrelated responsibilities to central files. Split a focused module or component only when the touched file is becoming materially difficult to reason about.
- Prefer direct, readable control flow. Avoid unnecessary wrappers, factories, indirection, global frameworks, and one-use helpers that do not isolate meaningful behavior.
- Reuse a stable existing implementation rather than duplicate business logic, but do not force reuse across incompatible boundaries or create circular dependencies.
- Do not solve a local issue with a broad refactor. If correctness truly requires a large or high-risk refactor, explain its necessity and scope before proceeding.

## Boundaries and Planning

- For review, audit, explanation, diagnosis, or planning requests, inspect and report without modifying code unless the user also asks for implementation. For change, fix, or build requests, make the requested local changes and run proportionate non-destructive verification without asking first.
- Ask only when a material ambiguity cannot be resolved from repository/conversation evidence and a wrong choice risks destructive changes or substantial rework. Otherwise choose the safest reversible repository-consistent interpretation and state the assumption afterward.
- Treat database publishes, non-dry-run backfills/recomputes, remote migration pushes, production changes, credential handling, destructive operations, and other irreversible external actions as ask-first unless explicitly authorized.
- For broad rolling-player recomputes, preserve the bounds documented in `web/README.md`; composite publishing defaults to `dryRun=true` and should remain dry-run unless an intentional publish is authorized.
- Use a brief plan only for complex, multi-stage work with meaningful dependencies or risks. Do not create a planning artifact for routine fixes; consult existing `tasks/` material only when relevant.

## Communication and Inefficient Work

- Limit progress updates to material findings, blockers, changed assumptions, and decisions that need input. Do not narrate every command or restate prior conclusions.
- Keep the final response implementation-focused: what changed, where, checks actually run, and unresolved limitations or assumptions. Do not paste complete created files unless asked.
- If repeated exploration or retries stop producing useful progress, stop and preserve the findings. Identify the exact unresolved issue and give the user a copy-paste-ready prompt for the external ChatGPT app containing the objective, relevant repository context, attempts and errors, settled decisions, constraints, and the precise question. Instruct ChatGPT to request any missing files, excerpts, logs, or configuration before recommending a solution. Use this handoff only when continued execution is genuinely low-yield, not merely difficult.
