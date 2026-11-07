# Stale doc pointers from today's local commits (read-only scan, 2026-10-25)

Scope: `git log origin/octoberBranch..HEAD` on octoberBranch (13 commits, tip `48809914a`). No docs were edited; no Git mutations; no tests run.

## What changed in path terms

`git diff -M --name-status origin/octoberBranch..HEAD`, excluding added `tasks/artifacts` files, shows **one deletion and no renames**:

- `D web/e2e/wigo-single-viewport.spec.ts`, deleted in `4436789f1`. Its replacement is `web/e2e/wigo-one-page.spec.ts` plus `web/e2e/fixtures/wigo/{schema.json,wigoFixtures.ts}`. The WiGO redesign receipt (`tasks/artifacts/wigo-redesign-2026-10-25/RECEIPT.md:110`) says why: the old spec asserted the retired 1920-only layout and read live Supabase.

New (added) paths, which nothing can point at stale yet: `web/lib/player-cards/{evidenceAdmissions,evidenceBundle,evidenceLoader}.ts` and tests, `web/lib/socialShare/streak.ts` and test, `web/lib/forge-testing-grounds/runStoreContract.ts` and test, `web/lib/underlying-stats/playerStatsRefreshWindow.test.ts`, `web/components/WiGO/ToiLineChart.test.tsx`. All other touched files are modifications at the same path, so path pointers to them still resolve.

## Stale references, with proposed replacements

Live indexes and checklists (worth fixing):

| # | File:line | Current text | Proposed replacement |
| --- | --- | --- | --- |
| 1 | `tasks/tasks-prd-in-season-trust-clarity-decision-workflow.md:8` | `…existing writer/fetch/metadata/DIFF/table tests and \`web/e2e/wigo-single-viewport.spec.ts\`.` | `…existing writer/fetch/metadata/DIFF/table tests and \`web/e2e/wigo-one-page.spec.ts\` (replaced \`wigo-single-viewport.spec.ts\` in \`4436789f1\`).` |
| 2 | `tasks/tasks-prd-in-season-trust-clarity-decision-workflow.md:119` (4.x acceptance) | `Extend existing WiGO viewport E2E for compact metadata, comparison changes and selection races.` | `Extend existing WiGO one-page E2E (\`web/e2e/wigo-one-page.spec.ts\`, offline fixtures in \`web/e2e/fixtures/wigo/\`) for compact metadata, comparison changes and selection races.` |

Both docs are in the C6 lease (README `a03ee0d0…`, PRD `e4fc2b9e…` as of the C6 receipt), so edit them through that owner.

## Pointers that mention the deleted spec but should stay

These are dated historical records of what was true when written. Do not rewrite. Optionally add a one-line "superseded by" note.

| File:line | Why it stays |
| --- | --- |
| `tasks/TASKS/wigo-single-viewport/report.md:54` and `:65` | 2026-09-19 verification report for the retired 37-column 1920×1080 layout. The command at `:65` can no longer run. Optional note under `## Evidence`: "The spec named here was deleted in `4436789f1`; see `tasks/artifacts/wigo-redesign-2026-10-25/RECEIPT.md`." |
| `tasks/tasks-README.md:188` | Contains only the evidence directory `tasks/TASKS/wigo-single-viewport/evidence/`, which still exists (tracked screenshots). Not stale. The spec name does not appear in this line. |
| `tasks/artifacts/wigo-redesign-2026-10-25/*`, `…/2026-10-24-coordination/{CLAUDE-TO-CODEX.md:1066,CLAUDE-LEASES.json:1143,handoffs/C7/RECEIPT-WIGO.md}`, `tasks/artifacts/today-plan-2026-10-25/C1/SNAPSHOT-MANIFEST.sha256` | Receipts and manifests of the deletion itself. Immutable. |
| `output/**/{original-overlay-inventory,source-manifest,initial-status}` | Frozen October 2 manifests. Immutable. |

## Checked and clean

- No `package.json` script, `playwright.config`, `.github/workflows`, `README.md`, `AGENTS.md`, `web/README.md` or `docs/` text names the deleted spec (`rg` over those).
- Every `web/e2e/*.spec.ts`, `web/{components,lib,utils,hooks,pages}/…` path named in `README.md`, `AGENTS.md`, `web/README.md`, `docs/`, `tasks/*.md`, `tasks/handoff-2026-10-20/` and `tasks/today-plan-2026-10-25.md` resolves, except the items below. These are not caused by today's commits; the scan was for path existence only.
- Docs describing social-share, Goalie Share, healthy-reserves, player-cards or Testing Grounds behaviour were not read for semantic drift, only for removed or renamed paths.

## Missing paths found that are not from today's commits (FYI only)

| File:line | Path | Note |
| --- | --- | --- |
| `tasks/tasks-prd-forge-daily-pipeline.md:6` | `web/lib/player-forecasts/nhlSourceCapture.ts` | Never existed in any ref (`git log --all` empty). It is a planned or described module, not a removed one. Needs the doc owner to confirm. |
| `tasks/handoff-2026-10-20/HANDOFF-2026-10-20.md:597` | `web/components/RosterScheduleOptimizer/RosterPlayerRow.ts` | Real file is `RosterPlayerRow.tsx` (extension typo in the 10-20 handoff, which is a historical doc). Not today's change. |
| `tasks/tasks-prd-shareable-player-cards.md:11–13` | `web/lib/player-cards/`, `web/pages/player-cards.tsx` | Described as "proposed … confirm absent". `web/lib/player-cards/` now exists (today's `9dbc55afb` and `4d37b51c9`); `web/pages/player-cards.tsx` still does not. Task 1.2 is already checked, so no edit is required. Optional: add the three new `evidence*.ts` files to its Relevant Files list. |
