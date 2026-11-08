# Cron pipeline repair: local handoff, November 7, 2026

## Verified defect and repair

- Goalie writer built current/future candidates from all current-season team histories. Nico Daws (8482076) appears in both NJD and WPG history, producing duplicate key `(2026020291, 8482076)` for their November 10 game. Read-only stored-source reconstruction reproduced exactly 224 raw candidates, then 216 after the current-team rule, with zero duplicate keys and zero uncovered game sides. This is not a replay of the original NHL response.
- The writer now filters current/future history candidates using current-season current rosters, treats historical identity separately, rejects duplicate keys across the entire write set before chunking, and stops without writes on ambiguous/incomplete roster reads, failed log fetches, or absent eligible game/team history. Unrostered historical candidates are excluded rather than confused with read failure. After all replacement upserts succeed, the writer prunes only exact rejected source triples (game, old team, player); failures stop pruning and return non-success. Including the old team prevents deleting a valid new-team row sharing the upsert key.
- Calibration incorrectly demanded an exclusion label in run-start metrics even though the producer deliberately does not set it there. It now proves the exact latest run through existing snapshot/verified-producer admission, retaining the rolling-history and atomic latest-run guards. It neither chooses an older fallback nor writes a provenance label.
- Accuracy remains in the producer hash. Only its exact read-only import edge to admission is excluded, avoiding self-reference. Direct or alternate producer admission imports still fail. Independently reviewed.
- Deployed commit c09aa95ace52f8da26ef9ee1b2e635dc0245f201 reproduced the live abb563452f17dbcd802a5debd8af86425a01775bf2fb9693c9a14fb9f468f454 stamp: 195 modules, zero verifier findings. Its receipt-backed closure is locally admitted. All eight existing admitted receipts were reverified; only walker hashes changed, original closures reproduced.
- Reporting resolves the schedule's limited dynamic-date SQL URL grammar instead of misclassifying actual power-play/other date-window receipts. Core cron-history and audit reads start concurrently within their existing shared deadline, eliminating demonstrated serial starvation. Existing weekly-not-due and lineup-tally fixes are retained.

## Exact isolated candidate and verification

- Final candidate: `b4033ad65ffba6835ba0754dd665e5d694301f64`, tree `766a20dd8ca872685b88c5f816b022ab912315ef`, based on verified remote master `194d55e720f1a715904c252e750d96af9533ef20`. It supersedes provisional `a0d4ca1043`.
- Local ref: `refs/candidates/cron-pipeline-repair-20261107`. Bundle, full patch, exact 33-path checksum manifest and logs are beside this handoff; see `CANDIDATE.json`. The bundle requires the exact base commit and verifies successfully.
- Producer commit `d9fcc711e12d2902cd6b646ce38888a43e606f2b` is receipt-admitted. The final exact commit independently reproduces the same closure `2676c5366cfc08fa7aaec4a1d4369e6f51caf3018bf2fca3f7d358faceb5c746`: 195 modules, zero findings. Admission and its receipt remain outside the producer closure.
- Exact final export: all 424 tests across 14 affected suites pass. Whole-web `npm run typecheck`, scoped ESLint, diff checks and independent boundary/integration review pass. Full unit suite, local production build and remote build were not run.
- Tests include source snapshot flag-on/off and actual claim contention/exhaustion in both processors. Empty-poll suppression now requires explicit zero pre-intake/pre-claim `eventsFetched`; unknown/nonzero fetches and source snapshot reconciliation retain audits.
- Initial export checks had omitted unchanged SQL/JSON/cross-root fixture dependencies; those exact candidate files were added to the export, without source changes. The final complete check run is clean.
- Earlier Yahoo/WiGO diagnostic fixtures also passed 97 tests; those routes were not modified or added to this release. These checks are not deployed recovery or predictive qualification.
- Shared octoberBranch HEAD and index match their recorded pre-sealing state. Other owners' working changes are preserved. No new editing branch/worktree was created.

## Honest unresolved inputs

- Yahoo persisted 1,610 profiles: 579 observed ownership values and 1,031 unknown values. No fetch/persistence failure was established. Existing code preserves unknowns and blocks incomplete export.
- WiGO: 33 valid active-cohort players encounter 273 legacy rows across 184 dates. Each lacks game ID, team and opponent. Current ingestion validates identity; retained legacy rows require authoritative source repair, not guessed IDs, skipped players, or converted zeroes.
- Final bounded audit found underlying-stats success at 09:35 (3,762 rows) and game-scoring success at 11:40; different scheduler/audit names and dynamic URL matching caused false UNKNOWN reports. NST goalie still has no matching receipt and remains unverified, not a confirmed execution failure. Current and origin/master source already have wrappers. No route rerun was performed to manufacture evidence.

## Release and recovery gates

1. Local candidate isolation and producer verification/admission are complete. Release this exact candidate only; do not publish the entire octoberBranch. No migrations, package changes, unreleased NST/poller/X/roster/style work or Yahoo refresh patch are included. Preserve the commit-backed producer evidence; changing source requires a new verification.
2. Live dashboard follow-up verified all four roots and Production master / Preview disabled settings. Source ignore overrides and prior cancellation logs support four deployment entries, one web build and three skips/cancellations. Remote master remains194d55e and no exact candidate deployment exists. Recheck for drift immediately before an approved publication; see FLAG-AND-DEPLOYMENT-PREFLIGHT.json.
3. TJ confirmed Production `LINES_OBSERVATIONS_ENABLED=true`. Its consumers and six append-oriented write targets/RPC are present. The next deployment uses this value; no flag edit is needed. Public entry serving and PP carry-forward remain separately gated. Release consent should acknowledge recurring capture/reconciliation and the new scheduled exact-key goalie cleanup. See RELEASE-PREFLIGHT.md.
4. Obtain explicit current-task release approval for the exact SHA, web project, production environment, master publication and verified linked-project footprint. No push, merge, build or deployment occurred here.
5. Production recovery needs a separate fresh bounded scope and approval, including removals. Four observed stale `(game_id, team_id, player_id)` keys are `(2026020267,3,8477484)`, `(2026020270,1,8482076)`, `(2026020279,1,8482076)`, `(2026020283,3,8477484)`. Reverify them and all rejected candidate predicates before mutation. The observed 224→216 reconstruction implies eight rejected candidates, only four then matched persisted stale rows. Cleanup is exact-key after successful upserts, not a full-table sweep.
6. November 7's rolling stage exhausted two attempts. Do not blindly reset it or replay uncertain leases. After fresh read-only scope checks, an approved recovery can refresh the bounded goalie window once, verify priors, then use sequential single-date/game-ID FORGE batches with ordinary preflight and explicit runtime/call limits. Partial/failed/uncertain results stop for review. Calibration retains exact latest-run and rolling/proof guards.
7. Verify persisted identity/freshness, expected FORGE dates, exact producer proof and calibration results, then a normal subsequent report. WiGO historical repair and Yahoo authentication hardening remain separate work. No production write, replay or cron change was made by this lane.

## Source paths

- web/pages/api/v1/db/update-goalie-projections-v2.ts and existing test
- web/pages/api/v1/db/run-projection-accuracy.ts and existing test
- web/scripts/forge-producer-closure.ts
- web/lib/projections/forgeProducerIdentity.test.ts
- web/lib/projections/verifiedForgeReleases.ts and existing test
- Eight existing receipt paths referenced by verifiedForgeReleases.ts, plus this directory's c09 receipt
- web/pages/api/v1/db/cron-report.ts and existing test
- web/lib/cron/scheduledHttpUrl.ts and test
- Curated report/audit/reader/no-op prerequisites and both processor summaries/tests; exact complete path list is in CANDIDATE.json

Local candidate commit objects and a private candidate ref were created. No shared branch/index mutation, push, production mutation or deployment was performed by this task.
