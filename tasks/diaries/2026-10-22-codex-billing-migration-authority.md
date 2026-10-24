# Billing migration-authority regression

- Scope: urgent offline verification of `supportedBaselineMigration.test.ts`, commit `fd58ba245`, current authority workflow, and billing approval evidence. Documentary registration only if explicit existing authority supports it; no migration/application edits, deletion, test weakening, commits, SQL execution or production.
- Where: canonical `octoberBranch`, starting HEAD `a565238f670edc4cf65da79ad52ba82ec41f3b71`. Commit `fd58ba2452c0175b201e50285df156cb7f91b4f4` adds the 274-line billing migration. Scoped tracked status is clean.
- Start: reread AGENTS; inspected branch/commit and located focused test. Coordinated exact file reservation and requested authority evidence from billing owner `01a15f1d-cb9f-7584-a4fd-2d1e9499f03f`.
- Next: read migration authority workflow, reproduce focused test offline, trace billing decision evidence, then prepare smallest compliant correction or exact approval requirement.
- Blockers/approval: source registration authority not yet established. Preserve D4 repair lane and all reviewed billing/forecast files.

## Findings and handoff
- Actual focused test ran once on Node 22.11.0: 20 passed / 1 failed, 99 active SQL files vs 98 authority rows; only the sandbox billing draft is extra. Current/commit/isolated-receipt hash matches `d78b385ec6b8acfbfcc6ba2909d5f558765cd90e8e4a18a2febab68bf146db12`.
- Read AUDIT-TASK-006 workflow: owner-reviewed class/hash/order/gate is required. Billing owner confirmed no canonical admission approval; only local authoring and isolated storage execution were approved. No registration performed.
- Parent steered to assessing relocation. Withdrew the never-applied registration artifact. Recommended a byte-preserving move to billing artifacts `drafts/`, four executable reference updates, and one provenance note; canonical authority/tests/summary and historical receipts remain untouched.
- Prepared `tasks/artifacts/billing-migration-authority-2026-10-22/PROPOSED-RELOCATION.patch`; `git apply --check` passed. Offline set comparison confirms excluding only the draft restores the existing 98-file authority. Patch not applied; actual test remains failed. Evidence and report saved alongside patch.
- Next: parent decision/authorization for reversible relocation, then hash check and focused baseline/monthly tests. No source/SQL migration edits, removals, registrations, test weakening, commits, DB or production actions occurred. No approval-review denial or uncertain action. Preserve diary for pending correction.

## Relocation authorized
- Parent authorized applying the exact prepared reversible relocation and four path refs/provenance note, preserving SQL bytes, authority, baseline assertions and historical receipts. No SQL execution/commit/production.
- Rechecked canonical checkout at `a565238f670edc4cf65da79ad52ba82ec41f3b71`: all 9 pinned source/reference/authority files and proposal patch match, scoped status clean, destination absent; `git apply --check` passed. Billing owner notified of narrow path ownership; no overlapping billing behavior changes.
- Next: apply exact patch, run baseline and fixture-backed monthly integration tests, syntax-only checks for three SQL/Auth harnesses, then final pins/diff receipt.

## Completed local correction
- Applied prepared relocation exactly. SQL moved to billing artifact `drafts/` with identical SHA-256 `d78b385ec6b8acfbfcc6ba2909d5f558765cd90e8e4a18a2febab68bf146db12`; four executable path refs and one provenance note updated. No authority/summary/baseline-assertion or historical receipt changes.
- Final single test run passed 84/84 (baseline 21, monthly integration 63), exit 0. All three artifact harnesses pass `node --check`; focused whitespace, exact reverse-patch dry check, active-file equality and preserved-hash checks passed.
- Exact before/after pins in `CHANGED-FILES.json`; final test JSON and applied `EVIDENCE.json` beside report. SQL remains a local draft; no SQL/service/credential/production/commit/history action. Parent handoff ready; no local implementation blocker or uncertain action.

## Independent-review correction
- Review P2 correctly found an indirect consumer: VERIFY-QUEUE.cjs still checks historical paths/hashes before and after SQL; the path-only monthly test edit fails its old hash, then the moved SQL path is missing. Existing independent offline reproduction accepted; do not rerun SQL.
- Parent authorized narrow runner/receipt fix and offline preflight tests. Starting HEAD `1db72ffc62bd73106a98e0146f3342346bbce69c`; reviewed runner pin `ce68ce9a2e137e6d6769a61994fa163f2f1da2a08334473d4ae26f1121669b14`. Preserve immutable historical manifests/receipts and all SQL/application/test bytes.
- Plan: add versioned relocation mapping anchored to historical manifest and accepted relocation receipt; strict before/after hash checks resolve both mapped entries and preserve all others. Add preflight-only runner mode before loading any target/client, with offline mutation-negative checks for both hash guard calls. Billing owner notified of runner ownership.

## P2 correction handoff
- Added pinned SOURCE-RELOCATION.v1.json with the two explicit mappings; runner validates predecessor/current hashes and historical/accepted-receipt anchors. Both pre/post guards use the same strict verifier. No suppressions. Future runtime results use new exclusive names, preserving old receipts.
- Actual `--preflight` passes seven inputs and exits before target/client load. Fourteen VM regression cases pass, covering all input/provenance mutation denials, missing retained SQL and post-check drift. Syntax/diff checks pass. No SQL/target/credentials/network loaded or used.
- Preserved SQL d78b385e…, old manifest f2c43890…, prior relocation receipt df600ab1…, five unaffected frozen inputs and authority/summary/test pins. Historical BEFORE/AFTER/RESULTS/FAILED receipts byte-match HEAD. Other accepted relocation files unchanged.
- Correction artifacts in `tasks/artifacts/billing-migration-authority-2026-10-22/queue-preflight-fix/`; runner pin `fe5e21a26ce2ac31a3bee44eb5ca45a408cca1e4b1ed3b1d72620ad58ae4bbe1`, versioned manifest `54b33decfb7dbf1173bb67c154665ff9c154982961be754c0eb7000b0e96efb2`. Concurrent HEAD now `0b6ef82e2a7223c25a9e75ddd1cb5db0a343c9f7`; file pins intact. Ready for independent re-review; full DB execution remains outside this fix.
