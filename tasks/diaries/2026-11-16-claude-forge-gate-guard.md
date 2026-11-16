# 2026-11-16 Claude: FORGE gate guard (C1 prevention + H2)

## Scope
- Production build check in `web/next.config.js`: stamped producer closure listed in `VERIFIED_FORGE_PRODUCER_CLOSURES`,
  and a commit SHA present (H2). Pure function + unit tests.
- Daily cron report: flag when today's ET slate has no fresh servable FORGE run, with reasons.
- Owned: `web/next.config.js`, new helper script, `web/pages/api/v1/db/cron-report.ts`, `web/lib/cron/cronReportFlags.ts`,
  `web/components/CronReportEmail/**`, tests for these. Off-limits: closure/verify scripts, allowlist, externalInputProof,
  rollingForgePipelineRunState, pregameCapture.

## Where
- Branch `octoberBranch` (shared checkout). Base `b296d52af`.
- Closure before edits: `9944628e…` (239 modules, 0 findings); listed. `lib/cron/cronReportFlags.ts`, cron-report and
  CronReportEmail are outside the closure. `lib/projections/projectionPipelineState.ts` and
  `lib/rollingForgePipelineRunState.ts` are inside (import only, never edit).

## State / decisions
- TJ (pop-up): FAIL production builds, NO override; previews/local warn only. Cron alert is the runtime backstop.
- TJ (pop-up): Chef to check handoffs + worktree diffs for an exact-file carve-out. Chef reply (17:5xZ): cron-report.ts,
  its test, CronAuditEmail.tsx, its test, next.config.js all CLEAR for the FORGE proof alert / build guard only;
  carve-out recorded in the Chef's diary. Keep edits additive (lease-46 frozen candidate must still rebase); leave the
  closure stamping lines in next.config.js as they are. Lease files untouched.
- New files: `web/scripts/forge-build-admission.ts` (+ test, 9 pass), `web/lib/cron/forgeServingHealth.ts` (pure),
  `web/lib/cron/forgeServingHealth.server.ts` (reader).
- Pipeline lane commit 3dc9ae1ba changed the closure (now 8461033…, unlisted): a live "unlisted" case for wiring checks.
- Alert must fire on 11-13..11-15 (served 11-09 runs still covered those dates): alert on newest run for today being
  withheld / no run created today, not merely "any servable run".
- Query budget: forge_runs (as_of today, attribution columns) + rolling pipeline state; `loadExternalInputProof` only on
  the about-to-alert path.

- Wired: next.config.js `checkForgeBuildAdmission` (guard only; stamping lines untouched), cron-report.ts (reader
  beside poller/backlog, subject wrapper, email prop, JSON key), CronAuditEmail.tsx (section + critical headline).
  New `components/CronReportEmail/ForgeServingSection.tsx`.

## Checks (17:4xZ–18:0xZ)
- Vitest: forge-build-admission 9/9; forgeServingHealth 14/14; forgeServingHealth.server 4/4; CronAuditEmail 17/17;
  cron-report 127/127.
- next.config.js wiring via `node -e` (no build): local no-env warn; prod+unlisted throw; preview no-SHA warn; dev phase
  skips; export of b296d52af (closure 9944628e, listed) prod+SHA pass, prod no-SHA throw, checker missing throw.
- Closure `--json`: none of my files are modules (closure itself keeps moving with other lanes' WIP).
- eslint on all touched files: exit 0. Typecheck: lock busy (exit 75) at 17:48Z; retry loop running.

- Commits: `114494bf7` (guard + alert + tests), `b7f107043` (unknown status downgrades subject; committed
  next.config.js stop/warn spawn test; VERCEL_ENV in guard logs). Not pushed.
- Narrow tsc (scratch tsconfig over all touched files + imports): exit 0. Vitest after b7f1070: admission 12/12,
  serving 15/15. Closure --json: none of my files are modules, 0 findings.
- Hand-over note: side-session-notes/.../gate-guard-handover.md.

- Full `lockf -k -t 0 … npm run typecheck`: exit 0 at ~17:56Z (attempt 15, after both commits' edits).

## Next
- Report to Chef. Keep this diary until the Chef releases the commits; then retire it.

## Blockers / approvals
- None open. No build, deploy, push, prod read or email send done.

## Gotchas
- Build-time SHA check cannot see runtime env: a build-only GIT_SHA passes while runs stamp `local:unknown`.
- Gate on `VERCEL_ENV === "production"`, not NODE_ENV (local `next build` is also production phase).
