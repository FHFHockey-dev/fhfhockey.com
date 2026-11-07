# RSO next readiness slice: retained participation replay

Local repair complete; no pending/denied action or uncertain mutation. Same Codex RSO owner and exact three-file boundary as the preceding repair, registered before editing. This slice modifies two of those files; the earlier three-file missing-suffix repair remains intact. Canonical `octoberBranch`; uncommitted. Other lanes' changes were preserved.

## User-visible issue and fix

A baseline skater/goalie estimate can borrow participation from a reviewed issued forecast. On serialization, its aggregate revision identifies the rate inputs. The permission check incorrectly compared that aggregate revision with the issued participation revision. Replaying the same otherwise valid saved inputs changed forecast values to null and removed comparison permission.

Two new regressions reproduced the failure under native method-bound fixture reviews. `rsoUsePolicy.ts` now binds retained participation to its own issued revision and issue/expiry timestamps, recognizing only the existing `:participation`, `:appearance`, and `:start` suffixes. It keeps review scope, code/cutoff binding and downstream identity/admission checks unchanged. Native approvals are not added.

`planningReproducibility.test.ts` verifies skater points and goalie cases through resolve → JSON save/replay → legal manual/Yahoo-shaped planner evaluation. Longer-lived baseline rates do not extend participation permission. Wrong revision, absent/unknown suffix, foreign player, future issuance, expired participation and revoked review remain unknown/denied. These are offline fixtures, not live provider or browser acceptance.

## Evidence

- `reproduction.log`: both new regression cases fail before the fix (valid values become null on replay).
- `regressions.log`: both pass after the fix, including invalid-evidence variants and manual/Yahoo checks.
- `tests.log`: **400/400 tests, seven affected files, passed** on the combined current source. This is the latest total, not 400 additional unique tests beyond the earlier 398.
- Scoped TypeScript (`../tsconfig.json`, affected import graph) passed under the shared heavy lock; lock released.
- ESLint on the three combined candidate files passed; scoped diff whitespace check passed.
- `source.patch`: this slice only, relative to its recorded starting files. `combined-source.patch`: both RSO resume fixes relative to Git HEAD. `EVIDENCE.json`: exact current source hashes and checks.
- No app/browser/build/whole-repository checks, dependencies, Git index/ref changes, deployment, activation or production/provider/database requests. All remote usage: zero.

## Remaining gates and next owner action

The local slice is complete. The eventual committed candidate still needs exact FORGE producer-closure verification/admission before a separately authorized release; this policy file is in that closure. The production native review catalog remains empty and later-impact execution remains gated. No live daily-beta acceptance is inferred.

Parent/Codex RSO owner can review and batch the combined three-file candidate with other accepted work. The next meaningful acceptance step is TJ's genuine manual/Yahoo drop-add → refresh → Undo → save/reopen flow with supported forecasts; first reconcile newer real-account receipts, then obtain a bounded provider window only if needed. Forecast qualification and production activity need their own evidence/authorization. Avoid another general historical audit or rebuilding completed S1–S3 work.

## Bounded continuation check — 2026-11-01T14:09:43.396135+00:00

The parent requested another distinct slice only if actionable. All three source hashes still match `EVIDENCE.json`; both current owner mailboxes contain no newer RSO defect/handoff. No additional actionable defect was established. The master reload-flake row is historical relative to its already-released exact lease, not a new implementation task. Existing 400-test/type/lint results are reused on unchanged source; no repeat tests or source edits.

Stop here. The next requirements are:

1. **Separate release-owner work:** review `combined-source.patch`, select the exact committed candidate through the coordinated release workflow, run the existing `web/scripts/verify-forge-release-sha.ts <full-sha>` verifier and admit that committed producer closure in `web/lib/projections/verifiedForgeReleases.ts`. Then obtain explicit target-project/environment/branch/candidate-SHA release authorization and complete the repository deployment-cost inventory. No uncommitted closure admission or deploy is authorized here.
2. **TJ participation:** personally demonstrate a real legal add/drop with full-roster/drop-loss comparison, refresh, Undo, save and reopen. For agent-driven Yahoo acceptance, first reconcile later R2–R4 receipts and approve a bounded single-tab provider-read window; no provider requests have been made or queued by this task.
3. **Forecast-owner evidence:** applicable qualified native target/use reviews remain required before native forecast authority; later-impact numeric execution separately needs qualified witness/input acceptance. Keep absent forecasts unknown and the inactive gates explicit.

Status: prerequisites pending, not denied. No tool approval is pending and no mutation has an uncertain outcome. This task makes no claim that every possible local issue is exhausted; further work should begin from a concrete new defect or the required acceptance evidence.


November 1 continuation: the latest four-file candidate, isolated producer closure, 400-test run, actual manual/connected fixture browser verification and exact ownership/admission next steps are in `tasks/artifacts/rso-resume-2026-11-01/release-prep/HANDOFF.md`. The additional source change is one manual E2E locator; forecast implementation pins above remain unchanged.
