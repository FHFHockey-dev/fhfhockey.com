# Lines / DRM release preparation

Preparation only. No commit, push, remote build, deployment, flag change or database write authorized by this document.

## Independently reviewable Lines scope

The four exact paths and SHA-256 pins in CANDIDATE.json remain unchanged and verified in RELEASE-PREPARATION.json. Two runtime files plus their two tests only. Both runtime diffs against recorded origin/master are exactly the narrow local correction, with no extra local-branch runtime changes in those paths.

Team-only legacy requests with no reports today can show the latest retained report day within seven prior Eastern dates. Dates and an explicit not-confirmed-for-today warning remain visible. Game-specific selection, canonical snapshots, flags, ingestion and schemas do not change. Prior 47 relevant tests, full-web TypeScript, scoped ESLint and diff checks passed. No new-code browser or production verification claimed.

## DRM reconciliation is separate

The old 54-file DRM inventory has 17 mismatched files, enumerated with old/current hashes in RELEASE-PREPARATION.json. History library/API and their tests still match. History UI/style/test and the mounting page do not; further shared matrix/reader/style/test files also changed. This is not a ready-to-release 54-file candidate. Do not stage entire mixed files, overwrite owner changes, or reuse old pins as acceptance. Owner diary says TJ requested leaving work uncommitted.

History UI directly depends on ObservedUnits/sharedClock, diagnostics, formatScopeDate and observedDeployment types. It cannot be safely treated as only an isolated API plus three UI files; owner must reconcile the complete current DRM reader/UI dependency closure and tests, then pin that combined scope.

## Required release approval packet

1. Ask whether to advance the isolated Lines correction alone or wait for combined DRM approval. Do not interpret this choice as blanket permission to commit DRM.
2. Before a publishing approval, prepare an exact release SHA from the accepted scope using the repository's agreed release workflow. Preserve all other local commits and dirty work. No SHA exists yet for these uncommitted changes.
3. Verify current remote project/build inventory. Local root and web links name fhfhockey; functions has a separate functions-fhfhockey link. These files do not prove current remote Git linkage or build fan-out. Prior remote metadata read was forbidden; do not assume one push triggers only one build or change ignore settings to suppress builds.
4. Approval wording once those fields are established: "Approve publishing Lines release <exact SHA>, containing only the four reviewed files, to fhfhockey.com through <verified project/build scope>? This enables the dated seven-day fallback, leaves all pipeline flags unchanged, and excludes DRM and unrelated work. Allow up to three sequential read-only smoke requests, stopping on the first failure?" State actual expected build count and any unknown cost before asking. DRM needs its own explicit combined scope if included.
5. Suggested post-release smoke: one team-only legacy request, one known-game legacy request, and one Lines page. No cron, ingestion, observation-gate changes or provider replay. Confirm selected routes are still bounded before execution. Existing reports may change naturally, so validate response scope/disclosure rather than hard-code a historic count. Roll back only the accepted release through an approved workflow if failed; do not alter production data.

No new production requests were performed in this preparation pass.

## Batched RSO + Lines preparation

BATCHED-LINES-RSO-INVENTORY.json records the exact eight-file union of this candidate and rso-objective-switch-2026-11-12/CANDIDATE.json. All eight hashes match their owners' pins. No duplicate paths or overlap with the 54-file DRM inventory. Every tracked pre-change version in HEAD matches recorded origin/master for these paths, so the narrow changes do not require unrelated local branch commits. Do not release whole HEAD.

The RSO dependency introduced by the component is hasKnownPointsComparison from planning.ts, included in its own four-file scope; it does not depend on Lines changes. Lines adds no new imports. Both fixes remain independently revertible. No manifest, schema, flag or deployment configuration changes are included. RSO owner records 279 component/streaming tests, final targeted toggle checks, full-web types, and lint with zero errors/six existing warnings. These and the Lines results verify local pinned sources, not a newly assembled isolated release tree.

Recommended batch: the eight pinned source/test files only, excluding DRM. Before publishing approval, create/review the exact release candidate under the agreed integration workflow, verify its tree contains only this scope against the release base, run narrow combined checks if assembled-tree context differs, and verify remote build fan-out. Then request approval naming both the RSO objective toggle correction and the dated Lines fallback, exact SHA and actual build scope. No release action performed here.
