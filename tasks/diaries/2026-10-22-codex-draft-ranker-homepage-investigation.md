# Draft Ranker homepage investigation

- Scope: explain production visibility after the in-season hide request; trace homepage/navigation gates, season source, local history and release evidence. Narrow local fixes and offline checks only; no commit, push, deployment, production requests, DB, credentials, or dependency changes.
- Where: canonical `/Users/tim/Code/fhfhockey.com`, `octoberBranch`, starting HEAD `16bada8670d3d1f536cdae928f69b5294bc12e81`.
- State: read AGENTS.md, mise-en-place.md, SPRINT-MODE.md; `.agents/skills` is absent in this checkout. Existing extensive concurrent changes are outside homepage scope and must be preserved. Parent owns sprint register/usage watcher; P07 owns RSO files.
- Initial evidence: homepage currently gates Draft Ranker on `draftRankerHomepageEnabled && isOffseason`. Parent reports public server-readable homepage fetch lacks Draft Ranker but includes Draft Dashboard; rendered/authenticated behavior remains unverified.
- Ownership: this diary only so far; reserve any source/test paths before editing. No application changes made.
- Next: inspect gate inputs, all homepage/navigation entry points and existing tests; compare local refs and promised-hide history/release evidence.
- Blockers: production deployment SHA and rendered client evidence not supplied; no causal claim about cache or deployment yet.

## Checkpoint — release omission demonstrated

- `cc3be5c09f062ea855adc0676293c134156f6b14` (2026-10-19) adds only the offseason condition and an in-season regression across `web/pages/index.tsx` / `web/__tests__/index.test.tsx`; both are already present and clean locally.
- Cached `origin/master` is R23 `6d5664f761132ab479a7febec60548d0fa9ee6ff`; its homepage/test blobs equal local master `457435eb3` and lack the gate/test. `origin/octoberBranch` and local octoberBranch contain them. No ref fetch or remote call was made.
- R5 manifest F3 explicitly excludes homepage/test from that scoped release (`tasks/artifacts/release-r5-2026-10-19/MANIFEST.md:185`). This is a demonstrated release inclusion gap, not evidence of a broken current local gate.
- `.agents/skills` absent here; inspected the sole ancestor `/Users/tim/.agents/skills/reverse-engineer-anything/SKILL.md`. It explicitly excludes ordinary complete source-repository analysis, so REA is not applied.
- Reserve writes: `tasks/artifacts/draft-ranker-homepage-investigation-2026-10-22/{REPORT.md,hide-ranker.patch,offline-network-guard.cjs,verification.log}` and this diary only. No application, shared register, or P07 writes needed.
- Next: focused offline homepage/ranker tests under installed Node 22.11.0/npm 10.9.0; capture minimal patch from existing commit and hand off. Exact production SHA and rendered post-hydration state remain parent evidence gaps.

## Handoff checkpoint

- Completed: scoped source/history/season/nav inspection, release omission established, two-file patch extracted without changing application files. Nine tests in two files pass under Node 22.11.0/npm 10.9.0 with outbound network guard; log and full report in the reserved artifact folder. Reverse patch applicability and scoped unchanged diff checks pass.
- Cause precision: R23 remote-tracking release source lacks the existing hide gate. Actual production deployment SHA still unconfirmed; SSR text cannot see `ClientOnly` ranker. No cache cause claimed.
- Local verification process `36762` finished with exit 0; no operation remains running. No source paths or shared register owned; artifact/diary writes complete.
- Parent next: review REPORT.md and hide-ranker.patch, reconcile exact production deployment/alias metadata, record task in sprint register, include minimal fix in authorized release. No commit/push/deploy/production/DB action attempted here.
- Keep diary while deployment acceptance remains pending. Parent owns sprint/usage watcher and final delivery.

## Follow-up — local R23 receipts and release applicability

- Parent requests existing local R23 deployment SHA/time/domain evidence only, an explicit release-needed handoff row, and offline patch applicability against cached master.
- Scope remains artifact/diary only; reserve additional `tasks/artifacts/draft-ranker-homepage-investigation-2026-10-22/patch-applicability.log` and temporary `/tmp/draft-ranker-patch-check.*` fixture files. No current-checkout application edit, Git ref mutation, live service call, or deployment.
- Next: locate local R23 release receipts; pin cached master and test exact patch against disposable source-file snapshots, then update handoff with evidence limits.

- Follow-up result: local task row 6.2 identifies live R23 `6d5664f76`; diary records the same. Exact commit time is 14:46:49 UTC; recompute completion 15:11:51 UTC and diary commit 15:23:21 UTC are historical record times, not deployment times. No R23 deployment ID/domain binding/exact deployment timestamp found in checked local records. No current alias verification claimed.
- Patch applicability passed on disposable snapshots of both `master` `457435eb3` and `origin/master` `6d5664f76`, including actual application to fixtures, preserved modes, retained moment-timezone import, and exact regression test bytes. Initial content-only fixture mode warning resolved by preserving Git modes; final log has no warning. Fixtures deleted; canonical files unchanged.
- REPORT.md now has explicit RELEASE NEEDED row for parent ledger/release owner. `patch-applicability.log` preserves commands, results, source pins, and hashes. No running process or live call; ownership released except diary retained for pending release acceptance.
