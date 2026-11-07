# Codex → Claude lane handoff prompts (2026-11-07)

TJ decided on 2026-11-07 that Claude (Chef session `local_c4e6c533`) takes ownership of every open Codex lane.
Paste each prompt below into Codex, one per Codex thread. Prompt 0 goes to the Codex root/coordinator thread first.
Each prompt writes one handoff file into `tasks/artifacts/codex-handoff-2026-11-07/` and changes nothing else.

Every handoff file uses the same sections (the shared template is in Prompt 0 and repeated in short form below):
OBJECTIVE · STATE · FILES · CANDIDATES/REFS · RECEIPTS · CHECKS RUN · PRODUCTION STATE · REMAINING GATES · PENDING TJ APPROVALS · GOTCHAS · DIARIES · LEASES RELEASED

---

## Prompt 0 — Codex root: inventory every open Codex lane

```
TJ has transferred ownership of all open Codex lanes in /Users/tim/Code/fhfhockey.com to Claude (Chef session local_c4e6c533). Your job now is a read-only handoff, not new work.

1. Inventory every open Codex thread/lane/worker (including Astra, coordinator 01a16eed-60f6-7096-879f-696c469db015, heavy-slot holders and any task-N workspace under /Users/tim/Documents/Codex/2026-10-* and 2026-11-*). For each: name, workspace path, objective, state (running/idle/blocked/done), open diary path, files it holds a lease on.
2. Write tasks/artifacts/codex-handoff-2026-11-07/00-CODEX-ROOT-INVENTORY.md with one row per lane and a column saying which of the lane prompts (1–11 in CODEX-HANDOFF-PROMPTS.md) covers it; list any lane none of them covers, with the same details.
3. Stop starting new Codex work in this repo. Let running workers reach a safe checkpoint, then stop them; do not abandon uncommitted edits — list them instead.
4. Update CODEX-LEASES.json and append a note to tasks/artifacts/cross-platform/2026-10-24-coordination/CODEX-TO-CLAUDE.md saying all leases transfer to Claude as of the handoff time (UTC).

Hard rules: no git commits, pushes, branch/worktree changes, deploys, migrations, production reads or writes, cron/endpoint runs, or env changes. Never set GIT_DIR. Do not delete diaries, candidates, refs, bundles or receipts.

Template for every lane handoff file: OBJECTIVE; STATE (done/left, %); FILES (path, sha256, committed SHA or "dirty in working tree" or "candidate-only"); CANDIDATES/REFS (ref, SHA, tree, base, path count, bundle/patch paths); RECEIPTS (paths); CHECKS RUN (command, result, date); PRODUCTION STATE (applied migrations, env flags, deployed functions, data repairs, with receipt paths); REMAINING GATES (exact next steps with done-criteria); PENDING TJ APPROVALS (each as a decision with 2–3 options, recommended first); GOTCHAS; DIARIES (paths); LEASES RELEASED (paths).
```

## Prompt 1 — Cron pipeline repair + cron reporting

```
Read-only handoff to Claude. Lane: cron pipeline repair and cron-report scheduled-URL resolver (diaries tasks/diaries/2026-11-07-codex-cron-pipeline-fix.md and 2026-11-07-codex-cron-reporting.md; final candidate b4033ad65ffba6835ba0754dd665e5d694301f64 on base 194d55e7, 33 paths; artifacts tasks/artifacts/cron-pipeline-repair-2026-11-07/).
Write tasks/artifacts/codex-handoff-2026-11-07/01-cron-pipeline.md using the template in Prompt 0. Include: the 33 candidate paths with blob hashes and whether each working-tree copy matches the candidate; which dirty working-tree files (cron-report.ts, emptyQueueRun.ts, update-line-sources.ts, update-lines-ccc.ts, run-projection-accuracy.ts, update-goalie-projections-v2.ts, verifiedForgeReleases.ts, forge-producer-closure.ts and their tests, release-verification JSONs, rso receipts) belong to this lane; the exact release preflight still open (four-project Vercel trigger check, the 403 env read, flag verification); and the bounded stale-row cleanup/recovery plan awaiting approval.
No git mutations, pushes, deploys, production reads/writes or cron runs. Never set GIT_DIR.
```

## Prompt 2 — FxTwitter migration verification / forecast assignment dedupe

```
Read-only handoff to Claude. Lane: FxTwitter migration verification and the DFO duplicate-assignment fix (diary tasks/diaries/2026-11-07-codex-fxtwitter-migration-verification.md; files web/lib/player-forecasts/sourceObservations.ts and playerForecasts.test.ts).
Write tasks/artifacts/codex-handoff-2026-11-07/02-fxtwitter-forecast-dedupe.md using the template in Prompt 0. Include: the exact diff (sha256 of both files), the 254 tests run, the two failed raw job IDs and snapshot IDs that need a bounded replay after release, and what a safe replay looks like (bounds, writes, rollback).
No git mutations, pushes, deploys, production reads/writes, replays. Never set GIT_DIR.
```

## Prompt 3 — WiGO legacy identity repair

```
Read-only handoff to Claude. Lane: WiGO legacy identity repair (diary tasks/diaries/2026-11-07-codex-wigo-identity-repair.md; artifacts tasks/artifacts/wigo-legacy-identity-repair-2026-11-07/).
Write tasks/artifacts/codex-handoff-2026-11-07/03-wigo-identity-repair.md using the template in Prompt 0. Include: the applied transaction receipt, the read-only verification query to run after the next natural WiGO calculation, its expected results, and what counts as a regression.
No git mutations, production reads/writes or recomputes. Never set GIT_DIR.
```

## Prompt 4 — Yahoo refresh hardening / WiGO inputs / ownership source

```
Read-only handoff to Claude. Lane: Yahoo global-credential refresh hardening, WiGO inputs and Yahoo ownership source (diary tasks/diaries/2026-11-07-codex-yahoo-wigo-inputs.md; artifacts tasks/artifacts/yahoo-ownership-source-2026-11-07/; files manual-refresh-yahoo-token.ts, refreshGlobalCredentials helper/test, globalCredentials.test.ts, cron-auth-boundaries.test.ts).
Write tasks/artifacts/codex-handoff-2026-11-07/04-yahoo-refresh-ownership.md using the template in Prompt 0. Include: the five-file patch path and sha256 receipt, whether the helper file exists in the working tree, the unresolved previous refresh outcome, why no retry is allowed, and the approved-operator reauthorization flow that would be needed for the global grant.
No git mutations, OAuth calls, production reads/writes. Never set GIT_DIR.
```

## Prompt 5 — Player cards

```
Read-only handoff to Claude. Lane: player cards (diaries 2026-10-24-codex-player-cards.md, 2026-10-31-codex-player-cards-evolution.md, -social-share-planning.md, -task-expansion.md, 2026-11-01-codex-player-cards-candidate-audit.md; unreleased commit 05d042a0f; web/lib/player-cards, web/components/player-cards, web/pages/player-cards.tsx).
Write tasks/artifacts/codex-handoff-2026-11-07/05-player-cards.md using the template in Prompt 0. Include: which player-cards commits on octoberBranch are accepted for release vs still in progress, the release candidate (if any), the open Claude ticket CLAUDE-SS-PLAYER-CARDS-NESTED-MAIN-20261106 (nested <main>), and the dependency of web/pages/social-share/player-cards.tsx (+9/−1) on 05d042a0f.
No git mutations, pushes, deploys, production reads/writes. Never set GIT_DIR.
```

## Prompt 6 — Buy Low / Sell High (BLSH)

```
Read-only handoff to Claude. Lane: BLSH (diaries 2026-10-27-codex-blsh-current-input.md, 2026-10-29-codex-blsh-*.md, 2026-11-01-codex-blsh-*.md, 2026-11-02-codex-blsh-*.md, 2026-11-04-codex-blsh-sko-vudu-audit.md; web/lib/buyLowSellHigh, web/components/buyLowSellHigh, web/components/blshTrade, web/pages/buy-low-sell-high).
Write tasks/artifacts/codex-handoff-2026-11-07/06-blsh.md using the template in Prompt 0. Include: which BLSH commits on octoberBranch are accepted vs unreleased vs superseded, which audits are closed vs open, and the known "1 days" plural slip in web/lib/buyLowSellHigh/displayProfile.ts (freshnessText/ageText).
No git mutations, pushes, deploys, production reads/writes. Never set GIT_DIR.
```

## Prompt 7 — NST (writers, admission, lifecycle, goalie HD/GS)

```
Read-only handoff to Claude. Lane: NST (diaries 2026-11-01-codex-nst-goalie-writer.md, 2026-11-01-codex-nst-independent-review.md, 2026-10-25-codex-nst-independent-review.md; web/lib/nst, functions/lib/nst_admission.py, web/lib/cron/nstBurstPlans.ts, nstRateLimitPolicy.ts, update-nst-* routes).
Write tasks/artifacts/codex-handoff-2026-11-07/07-nst.md using the template in Prompt 0. Include: the unreleased NST lifecycle/admission work and whether it is accepted, the cron-report finding that the lifecycle can return 503 before the audit wrapper, and the goalie HD/GS 37-request backfill (dates, URLs, pacing under the 40/1m, 80/5m, 100/15m, 180/h limits) awaiting approval.
No git mutations, NST requests, production reads/writes. Never set GIT_DIR.
```

## Prompt 8 — FORGE v2 / projections / goalie workload

```
Read-only handoff to Claude. Lane: FORGE v2 and projections (diaries 2026-10-29/30-codex-forge-v2-*.md, 2026-11-04-codex-forge-integrity.md, 2026-10-25-codex-goalie-workload-forge.md, 2026-10-29-codex-forge-horizon-inspection.md; web/lib/forge-v2, web/lib/projections, run-projection-accuracy, update-goalie-projections-v2, forge-producer-closure; and the Astra goalie/FORGE/report candidate).
Write tasks/artifacts/codex-handoff-2026-11-07/08-forge-projections.md using the template in Prompt 0. Include the Astra candidate ref/SHA/paths, which FORGE work is accepted vs unreleased, and the rule that FORGE must never read draft-dashboard PROJECTIONS_* tables.
No git mutations, pushes, deploys, production reads/writes, recomputes. Never set GIT_DIR.
```

## Prompt 9 — Roster Schedule Optimizer (RSO)

```
Read-only handoff to Claude. Lane: RSO (diaries 2026-11-01-codex-rso-*.md, 2026-11-04-codex-rso-audit.md, 2026-10-29-codex-rso-*.md; web/lib/rosterScheduleOptimizer, web/components/RosterScheduleOptimizer; artifacts tasks/artifacts/rso-resume-2026-11-01/).
Write tasks/artifacts/codex-handoff-2026-11-07/09-rso.md using the template in Prompt 0. Include which RSO work is released vs unreleased, the dirty rso-resume release-prep receipts and why they changed, and TJ's intent that RSO curates day-by-day add chains (1 vs 2 spots, BPA per step).
No git mutations, Yahoo reads, production reads/writes. Never set GIT_DIR.
```

## Prompt 10 — Roster Autopsy, league analytics, SKO element, trade value

```
Read-only handoff to Claude. Lane: Roster Autopsy, league analytics, SKO/VUDU and any trade-value work not covered by Claude's six-lane L4/L5 (diaries 2026-10-29-codex-roster-autopsy-*.md, 2026-10-25-codex-league-analytics-implementation.md, 2026-10-25-codex-sko-vudu-claim-vetting.md, 2026-11-04-codex-six-lanes-l2.md and -l6.md; web/lib/rosterAutopsy, web/components/RosterAutopsy, web/lib/skoElement, web/lib/sko).
Write tasks/artifacts/codex-handoff-2026-11-07/10-autopsy-analytics-sko.md using the template in Prompt 0, one subsection per feature.
No git mutations, pushes, deploys, production reads/writes. Never set GIT_DIR.
```

## Prompt 11 — Release coordination, living master list, heavy slot

```
Read-only handoff to Claude. Lane: release coordination, the living Master Task List, heavy-slot/lock handling and coordinator 01a16eed (diaries 2026-10-24-codex-release-coordination.md, 2026-10-29-codex-living-master.md, 2026-10-27-codex-heavy-lock-handoff-01a16e23.md, 2026-10-28/29-codex-heavy-slot-*.md, 2026-11-04-codex-six-lane-mailbox-routing.md, 2026-10-24-codex-task-artifact-audit.md).
Write tasks/artifacts/codex-handoff-2026-11-07/11-release-coordination.md using the template in Prompt 0. Include: the heavy-lock mechanism and how to take/release it, the pending L1 Master List proposal (ASSESSMENT.md §2.1 against base d334df33), every candidate ref under refs/rc/ and refs/candidates/ with status (live/superseded), and which closed diaries can be retired.
No git mutations, pushes, deploys, production reads/writes. Never set GIT_DIR.
```
