# RSO isolated release preparation — 2026-11-01

The two forecast-lineage repairs now have isolated candidate verification and independent review. A third, test-only repair scopes the manual browser fixture's confirmation button to the setup panel. Manual continuity and connected refresh → Undo → reopen both pass locally. Daily-beta acceptance and producer admission remain incomplete for the specific reasons below.

## Exact candidate

- Selected committed base: `4965a872a9746b6129c9ac589c200560d01a1e23` (saved `origin/master`, recorded RC17/#401). This is a local reference, not a new remote/deployment observation.
- Final prospective Git tree: **`a77527cdc29fd994bc0e28a4b2d5ec1b87acbe14`**. No candidate commit exists yet. The tree was computed without writing Git objects/index/refs; the same algorithm reproduced the base tree first.
- Four source paths and SHA-256 pins: [CANDIDATE.json](CANDIDATE.json). Complete patch against the selected base: [combined-source.patch](combined-source.patch).
- Runtime change: `web/lib/player-forecasts/rsoUsePolicy.ts`; regression coverage in its test and `planningReproducibility.test.ts`; one scoped locator in `web/e2e/roster-schedule-optimizer.spec.ts`.
- The selected base and current HEAD had no committed differences in these four files. All other dirty/unreleased lane changes are excluded. The candidate is not a proposal to release the whole current checkout or reset either long-lived branch.
- Verification export: the manifest's unique temporary directory; no editing checkout/worktree or branch was created. It omitted tracked environment files and reused installed dependencies whose package/lockfile/Node-version inputs match the base. Local verification scaffolding and generated output are not part of the candidate tree.

The previous three-file tree `3dfa4f910b36dad47ea265cef9f1041b794ee915` is retained in `CANDIDATE-THREE-FILE.json`; the fourth file changes only the failed manual test locator.

## Evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Independent RSO review | No scoped defect; 76 tests passed independently | [Review](../../rso-blsh-independent-review-2026-11-01/REVIEW.md) |
| Isolated candidate affected suites | **400/400**, 7 files | [candidate-tests.json](candidate-tests.json), [log](candidate-tests.log) |
| Connected fixture refresh/Undo/reopen | Passed | [candidate-browser.json](candidate-browser.json), [log](candidate-browser.log) |
| Manual fixture review/recalculation/reload | Failed first on duplicate button locator; passed after one-line setup-region scoping | [manual-browser.json](manual-browser.json), [log](manual-browser.log) |
| TypeScript and original three-file lint | Previously passed; unchanged runtime/regression source evidence reused | [participation replay evidence](../participation-replay/EVIDENCE.json) |
| Changed E2E file lint and four-file whitespace check | Passed | [browser-test-lint.log](browser-test-lint.log); `git diff --check` |
| Producer scans, base and candidate | Both **195 modules, 0 findings**, 21 reviewed dynamic table sites | [baseline receipt](baseline-closure.json), [candidate receipt](candidate-closure.json) |

The browser checks executed Chromium against the isolated local Next dev server on loopback `:3162`, with synthetic accounts, intercepted provider/account requests, inert configuration and a Node loopback-only guard. The initial sandbox bind was denied before any server started; narrow escalation then succeeded. The only rerun was the failed manual case after its locator correction. Two local browser invocations, three case executions, two distinct passing cases. Existing Sass/autoprefixer and webpack-cache warnings were nonfatal. No production build, install, deploy, production request, provider request or database request occurred. No browser/server or heavy lock is retained.

## Producer admission: exact remaining engineering

Expected closure: **`7083dee0a966654e413bbb673daa07a9b50d938312e9807276014921f2991368`**. [closure-delta.json](closure-delta.json) proves the only changed closure member is `lib/player-forecasts/rsoUsePolicy.ts`; no members were added or removed. The fourth E2E overlay is outside this closure, and all 195 module bytes were checked unchanged after it was added.

Neither this closure nor the selected base's `cda1026d4113c98b87f7597ae2dc452549f69ae0e18f00017867ebfc799526d6` is in current `VERIFIED_FORGE_PRODUCER_CLOSURES`. This observation concerns the uncaptured-input allowlist path; captured-input admission is independent, and no live serving failure is inferred.

The receipts here use `source.kind = tree`; `source.head` is the verifier's canonical checkout HEAD, **not** an assertion that HEAD reproduces the export. They are preparation evidence and must not be copied into the allowlist as commit-backed receipts. The manifest binds the actual base/overlays. Exact required tuple and verifier hashes: [ADMISSION-REQUIREMENTS.json](ADMISSION-REQUIREMENTS.json).

After assigning custody, the release owner must:

1. Reconcile the selected release base with current release records; preserve unrelated dirty work. Commit the exact four-file candidate through the sole-checkout coordinated workflow. If its content/base changes, regenerate its tree and affected closure evidence.
2. Under the shared heavy slot, run the existing verifier on that full committed SHA, with an explicit new receipt path. First coordinate ownership of its deterministic `/private/tmp/forge-release-verify-<SHA>` export; the script replaces that directory.
3. Require `verified: true`, no findings, the expected closure, exact commit/tree and current verifier/walker hashes. Add that committed receipt and its hash to a matching `VERIFIED_FORGE_PRODUCER_CLOSURES` entry. Run `lib/projections/verifiedForgeReleases.test.ts` and nearest admission tests, then verify the final release candidate closure again. Admission files are outside the stamped closure.
4. Freeze the final candidate SHA and linked-project deployment fan-out for explicit release authorization. No native-use review is granted by producer admission.

Verifier command, from `web/`, after assigning the actual full candidate SHA and a new owned receipt path:

```sh
NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only \
  --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
  scripts/verify-forge-release-sha.ts "$rso_candidate_sha" --receipt "$rso_receipt_path"
```

## Ownership reconciliation

TJ's latest direction makes Codex owner of RSO. This task `01a19764-091f-763d-a983-8c692d79200b` returns the four-file candidate to orchestrator `01a189f6-9a3a-7235-a989-e1af4f47b014`; no writer remains active in this slice.

The historical producer owner `01a135c8-567b-71d2-b610-6b78f3cc40d7` handed integration/cadence to **Complete Forge RSO tasks**, `01a14283-f596-73c3-8590-37d198756c4b`. Direct reading succeeded on this continuation: the app identifies host `local`, status `notLoaded`; its last available execution is October 16 and failed at the usage limit after retained-input work. Referenced October-15 goal artifacts are absent from the current checkout. This establishes the historical handoff, not current active custody or current readiness.

Newer repository records in `cross-platform/2026-10-24-coordination/CLAUDE-LEASES.json` identify **PROV-GUARD**, status `idle`, with `verifiedForgeReleases.ts`, its test and both verifier scripts; it has no named session/thread. **FORGE-RESERVE**, marked `active`, retains writer custody for `run-forge-projections.ts`, session `local_23d80159-b2ab-48ee-beca-f0f030201073`; its own handoff note says it has been idle since October 26. These are legacy orchestrator custody records, not a confirmed live worker. `CODEX-LEASES.json`'s production-release coordinator is an older completed October-24 release record. Later mailboxes retain Claude Git/index custody.

**Required orchestration action:** record a current named Codex owner/transfer for the exact PROV-GUARD admission paths and local Git/index operation before committing/admitting. This is coordination engineering, not a new scientific/product decision or a reason to reactivate FORGE v2. No current acknowledgement was found, so none is claimed. The separate FORGE v2 thread `01a18a97-9309-70dc-993a-6cb9763cb011` is not assigned this v1 gate.

## Genuine acceptance and authorization still required

- **TJ personal manual/Yahoo beta acceptance:** local fixtures now cover continuity, but do not establish real provider data, current eligibility, goalie marks or full add/drop-loss acceptance. A genuine selected move with nonzero drop loss must survive refresh, review, Undo and save/reopen with legal slots/budgets and unknown forecasts retained.
- **Agent-driven Yahoo window:** adapt the existing `rso-wave2-2026-10-25/YAHOO/REAL-ACCOUNT-PLAN-2.md` to a specific date, current account/tab state and operator. Its historical estimate is about 135 Yahoo reads, ceiling 150; it is not present authorization and must be rechecked against current discovery paging. One tab; read-only; stop on rate limit, reauth, access denial, non-200, second tab or budget overrun. This is distinct from the five-request production smoke limit.
- **Native forecast qualification:** reuse frozen `rso-wave2-2026-10-25/FORGE-QUAL/scope.json`; identity is still unpinned. Obtain the first released `captured_live` revision and pin its actual method/code/config/artifact identity before the first capture under authorized bounds. Preserve the sealed October 23–30 period, 14-slate/500-game protocol and prescribed readback/settlement. Do not substitute this candidate's closure for missing model identity. The intended SOG claim is totals/comparison and Start Chart display; assignment/tiebreak remain denied. `RSO_USE_POLICY.reviews` stays empty pending evidence/review.
- **Production:** release target/project/environment/exact final SHA and cross-project fan-out need explicit current-task authorization. No deployment, push, activation, data repair or provider execution was attempted.

No action has an uncertain outcome. The initial local-port denial was resolved by approved narrow execution. The pending items are ownership allocation, a committed admission candidate, explicit production/provider authorization where applicable, and real qualification/acceptance evidence; no unanswered tool approval is pending.


Admission continuation: [ADMISSION-OWNER-REQUEST.md](ADMISSION-OWNER-REQUEST.md) reconciles the explicit retained local Git owner, identifies three committed closure differences at canonical HEAD, and provides the exact limited handoff request. `prepare-committed-admission.py` is ready for the real candidate SHA; its negative preflight checks pass. No commit/admission was manufactured or installed.


**Superseded release base after PR402:** see [AFTER402-HANDOFF.md](AFTER402-HANDOFF.md). The old candidate request is held. Replacement proposal preserves f17bea20d and all four unchanged RSO fixes; no replacement commit/release has been authorized or performed.
