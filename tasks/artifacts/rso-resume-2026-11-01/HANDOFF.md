> Latest continuation: [participation replay repair](participation-replay/HANDOFF.md) contains the current combined source hashes and **400 passing tests**. The evidence below records the first checkpoint.

# RSO resume: native issuance lineage repair

Local implementation complete on `octoberBranch`; base HEAD `4589394f1965e746027865a602a63b9879db98aa`, handoff HEAD `85017934faf199bc33d45d065c5cfe8bd9cdddfc`. Three source/test files changed, uncommitted. TJ's current direction establishes Codex ownership of RSO and BLSH. This task handled RSO only.

## Reconciled checkpoint

- `.agents/skills` is absent. Repository AGENTS.md, mise-en-place.md, local Codex RSO memories, current master rows, both owner mailboxes/lease records, relevant diaries, the October 26 audit and actual source were checked. This was one bounded agent task, with no new worker dispatch.
- S1 distinct-drop alternatives (`081fcb849`), S2 future-impact engine (`9d70700ab`), S3 offline scenario inputs (`1a9aac33b`), and later alternative presentation (`c96c353d1`) already exist. They were preserved; no weekly re-ranking or informational-impact activation.
- The historical F1 single-SHA release admission approach has been replaced by verified producer-closure admission (`web/lib/projections/verifiedForgeReleases.ts`). F2 has separate capacity-selected comparison permission in `planning.ts`. F3 has stable method plus per-issuance checks in `rsoUsePolicy.ts`. F6 advances `nextAutoAt` by a bounded lease retry in `RosterScheduleOptimizer.tsx`. These findings were reconciled from current source; their original defects were not reimplemented or treated as still wholly open.
- No dirty baseline or competing current exact lease was found for the three selected files; the old exact FORGE-PROV lease is released. Own baselines and scope are in `OWNERSHIP.json`. A current-custody/exact-slice notice was appended to the Codex outgoing mailbox. No response or independent acceptance is claimed.

## Implemented

`web/lib/player-forecasts/rsoUsePolicy.ts` now refuses native `forge-issued-participation-v1:*` bindings without an `@revision`. Previously, removing that suffix still matched a stable-method review and skipped issuance validation. Three policy regression cases reproduced the loophole. Two planner cases (manual and Yahoo canonical inputs) reproduced a 12.5-point total after suffix removal.

The narrow guard requires the issued revision while retaining legacy exact-string lineage formats. Existing current-revision, next-revision, expiry, foreign-context, revocation, and empty-production-catalog tests pass. New planner regressions verify that a stripped binding leaves legal active schedule assignments available but projected/assignment values null, comparison ineligible, and quality recommendations withheld. Missing quality is never zero.

Changed source files:

- `web/lib/player-forecasts/rsoUsePolicy.ts`
- `web/lib/player-forecasts/rsoUsePolicy.test.ts`
- `web/lib/rosterScheduleOptimizer/planningReproducibility.test.ts`

The exact diff is `source.patch`; hashes and check results are in `EVIDENCE.json`.

## Verification actually run

- Before fix: **5 failing regression assertions**, including the two positive-control planner cases. `reproduction.log` preserves the failure. Initial integration setup omitted a decision-time clock pin and correctly expired the native issuance; that fixture setup was corrected before the recorded reproduction.
- **74/74** tests passed in policy and planning reproducibility files.
- **324/324** passed in planning contributions, shared planning data, daily manual acceptance, daily Yahoo acceptance, and fixture end-to-end acceptance. These are offline Vitest fixtures, not browser or live Yahoo acceptance.
- Scoped TypeScript check (affected files and their import graph) **passed**, under the shared heavy lock; lock released.
- ESLint on the three files **passed**; scoped `git diff --check` **passed**.
- Node **22.11.0**. No dependency installation, application build, whole-repository suite/typecheck, or browser run.
- **0** remote builds/deployments and **0** production/provider requests. No flags, model approvals, database records, Git refs/index or unrelated source changed.

## Remaining gates and precise next steps

1. **Local fix is complete; release is not authorized.** This policy file is listed in the existing verified FORGE producer closure receipt (`release-verification/eff1b377ae8c831705710758979cc67e9d38846b.json`). The eventual committed release candidate needs its exact producer closure verified/admitted through the existing workflow before an approved deployment. Do not list an uncommitted tree as admitted or reuse the previous closure hash. No admission list was changed here.
2. **Native forecast qualification remains explicit.** The production RSO review catalog is empty; this repair adds no target/use approval. Genuine player/goalie forecast acceptance and scoped prospective evidence are still required. The S3 flag defaults off and `LATER_IMPACT_CONTRACT.accepted` is false; offline contract acceptance is not numeric production authority.
3. **Daily-beta real-flow acceptance was not established by this task.** TJ should exercise a legal add/drop with whole-roster/drop-loss accounting and refresh → Undo → save/reopen. Yahoo live R2–R4/counter checks require a separately authorized bounded, single-tab window; current production/account state was not read. Reconcile any newer owner receipt before requesting or repeating that window.
4. **Next local owner action:** review the three-file diff and retain it in the next coordinated RSO candidate, alongside other accepted work. Preserve the dirty checkout. The old S1/S2/S3 stages do not need another implementation pass. BLSH continues in its separate Codex lane.

There is no pending or denied tool action and no uncertain mutation outcome. The remaining gates above concern release/activation and real-data acceptance, not completion of this local repair.


November 1 continuation: the latest four-file candidate, isolated producer closure, 400-test run, actual manual/connected fixture browser verification and exact ownership/admission next steps are in `tasks/artifacts/rso-resume-2026-11-01/release-prep/HANDOFF.md`. The additional source change is one manual E2E locator; forecast implementation pins above remain unchanged.
