# Slice03 R1 — preserve pending outcomes at resource limits

2026-10-24. `octoberBranch`, base HEAD `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`. **Frozen for focused independent re-review, not accepted.** Corrects the single P2 S03-R1 from `../slice-03-review/REVIEW.md`. Original slice03 receipt/pins and original failing reviewer test/log remain unchanged; this revision supersedes only the affected candidate source pins and the waiting-budget semantics described below.

## Correction

Previously every claim charged `maxExecutionsPerUnit`. Two successful availability checks that returned `pending_outcomes` could exhaust that budget; the next claim marked the evaluation unit failed and displayed 100% processed work despite no available outcomes.

The store now tracks accepted pending checks separately. Claims still provisionally charge computation so a crashed/unacknowledged attempt remains bounded. A valid current-lease `pending_outcomes` acknowledgement transfers that charge to the availability-check counter. Duplicate, stale, cancelled, invalid-phase or expired replies cannot change either counter. Genuine executor failures keep their failure count and computation charge; waiting cannot reset them.

An independent availability cap stops the run operationally with `state: failed`, `lastEvent: outcome_check_budget`. It does **not** set a failed work unit: the unresolved evaluation remains successful=0, failed=0, pending=1 and percent=0. Results stay sealed, and no later claim revives the stopped run. The existing run deadline and retry delay remain in force. Cancellation can stop waiting without creating failed coverage.

## Contract and compatibility

- `limits.maxOutcomeChecksPerUnit` is a new optional positive safe integer. New callers may freeze an explicit independent check allowance.
- Legacy v1 manifests may omit it unchanged. Their existing frozen `maxExecutionsPerUnit` supplies a separate availability-check cap; no default property is inserted into the parsed manifest and its canonical hash remains identical. No previously accepted timestamp/manifest shape is rejected by this addition. There is no persistence migration or running hosted job.
- Computation attempts (including crashes/checkpoints/failures) retain their existing execution bound. Waiting consumes only the check allowance after a valid pending acknowledgement; actual failures retain the original retry bound.
- **Resource impact is explicit:** with execution cap E and check cap W, total claims have a finite upper bound of E+W, further limited by run deadline, lease/step bounds and retry delay. For an omitted legacy field W=E, so the conservative claim bound can rise from E to 2E. This is a local contract correction, not authorization to double a hosted budget. A future operating plan must budget both allowances independently before activation. There is no unlimited polling, removed execution limit or new provider request.
- A pending result means availability-only waiting, with no accepted computation/output. Work that performed an incomplete computation must checkpoint instead. The interface still trusts a reviewed executor; it does not independently prove outcome finality.

## Exact changed files

Under `web/lib/forge-testing-grounds/`:

1. `runnerContracts.ts`: optional independent outcome-check cap with legacy no-default/hash semantics.
2. `memoryRunStore.ts`: separate counter, current-lease charge transfer and non-coverage resource stop.
3. `boundedWorker.test.ts`: three focused regression groups covering omitted/explicit limits, bounded waiting, completion after pending checks, stale acknowledgements, retained genuine retry exhaustion and cancellation.

`runStore.ts`, `boundedWorker.ts`, all original slice03/reviewer artifacts and all slice04 UI code/artifacts remain unchanged. New revision artifacts: `OWNERSHIP.md`, this handoff, `EVIDENCE.json`, `checks.log`, and `r1.vitest.config.mts` with artifact-local generated test cache. Existing diary updated separately.

## Verification

- Original reviewer S03-R1 test **unchanged**, plus adjacent pending-run-deadline positive control: **2/2 passed**; eight unrelated reviewer controls intentionally skipped by this revision's test-name filter. Original failure remains in `../slice-03-review/boundaries.log`.
- Original owner runner tests plus three focused regressions: **19/19 passed** (original16 preserved).
- Scoped strict TypeScript and ESLint on the three affected files: **passed**, no output. Commands/results retained in `checks.log`. No failed correction checks, full-suite, UI/timestamp reruns or live execution.
- Frozen prior packets, UI and unchanged runner dependencies compared by SHA-256. Exact old/new candidate pins, dependency pins, original reviewer artifact hashes and final integrity results are in `EVIDENCE.json`.

No distributed durability, actual scheduling, auth integration, real outcomes or model improvement is claimed. The memory reference loses state on process exit; full hosted/pilot gates from slice03 remain open. No shared-source, package, schema, server/browser/build, production/provider/data, paid or Git action occurred. No denied/uncertain operation or running check remains.

Return this three-file revision to the same Sol reviewer for a bounded read-only re-review; Scout retains acceptance. Slice04's interactive preview remains independently available at `../slice-04/preview.html`; it imports none of the changed runner files.
