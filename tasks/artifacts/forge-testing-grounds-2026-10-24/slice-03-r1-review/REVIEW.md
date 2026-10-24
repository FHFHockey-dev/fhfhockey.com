# ACCEPT WITH LIMITS — S03-R1 correction

**S03-R1/P2 is resolved on this frozen three-file revision.** The exact original failed control now passes: repeated pending checks stop with `outcome_check_budget`, while unresolved evaluation coverage stays successful=0/failed=0/pending=1/percent=0. No new correction defect reproduced. Scout retains acceptance and integration authority; the in-memory runner's existing hosted/auth/durability/scientific limits remain.

## Exact identity and preserved evidence

| File under `web/lib/forge-testing-grounds/` | Reviewed SHA-256 |
| --- | --- |
| `runnerContracts.ts` | `eaefa7e188004b89fc305f886f9673316e1650107179795d0994caea81777eeb` |
| `memoryRunStore.ts` | `085abad213e05d0d2a973d54197896cd54a2d72c2d218ede70b3f95d5ccb9fdc` |
| `boundedWorker.test.ts` | `7a4cd4194686bb16823542d35e9a49f4c6d459480ec2a1d76a0d9a91b39833eb` |

Canonical `octoberBranch` HEAD remains `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`; source hashes identify the uncommitted revision. **88/88 source/dependency/reference/protected/reviewer/artifact pins matched at start and end, no drift.** The three declared before-pins agree with original slice03 EVIDENCE. All original reviewer checksum entries, failed assertion/log and old owner packets remain unchanged. Slice04 received protected-hash checks only; no UI inspection/test.

Explicitly supplied receipt hashes also match unchanged:

- HANDOFF.md: `944706d9da7f935a6f67fe4753790bf7eef25013d696673716c95dcbc0a75124`
- EVIDENCE.json: `c35fb395b92cfc094270617b3d42150476cd7a0ab0191df00e691ea8aec83fa9`

[PINS.start.json](PINS.start.json), [PINS.end.json](PINS.end.json) retain every expected/actual value. Original CHANGES REQUIRED remains valid history for the old memoryRunStore pin; this report supersedes S03-R1 only for the new hashes.

## What the correction and independent controls establish

A claim provisionally charges computation. Only a valid, current, unexpired, uncancelled evaluation `pending_outcomes` acknowledgement refunds that claim's provisional charge and increments a separate outcome-check counter. Phase validation and fencing precede the transfer. Genuine failures/checkpoints/crashes retain their computation charges, and genuine failure counts are not reset by waiting. A waiting-cap stop preserves pending coverage rather than setting `failedUnit`.

One focused independent invocation passed **11 controls**, with **24 unrelated tests intentionally skipped**:

- Exact unchanged original S03-R1 and adjacent pending-deadline control: **2/2 passed**.
- Three owner regression groups added for this correction: **3/3 passed**; original sixteen owner cases skipped, not rerun.
- New independent controls in [budgets.test.ts](budgets.test.ts): **6/6 passed**. These verify omitted-field hash/shape compatibility and invalid explicit caps; finite waiting-cap stop, sealing and no revival; duplicate/stale pending acknowledgements cannot double-charge/refund; expired worker replies cannot refund genuine crashed attempts; invalid-phase replies cannot refund computation; genuine failure exhaustion survives intervening waiting; active cancellation preserves unresolved coverage.

No failed reviewer check, retry, weakened assertion or source repair in this re-review. The original failed run is still protected in slice-03-review/boundaries.log.

## Resource/compatibility qualification

`maxOutcomeChecksPerUnit` is optional and remains absent from a parsed legacy manifest when omitted. No default property changes its canonical hash. Its omission uses the frozen execution cap E as a separate waiting cap W. This preserves serialized identity, **not identical runtime allowance**.

The conservative total-claim bound is **E+W**; omitted legacy limits can therefore allow up to **2E** rather than the former E bound. Waiting refunds a provisional computation count, not elapsed CPU or money. The deadline, lease, step timeout, retry delay and both finite caps still apply; genuine failures/crashes remain bounded. This increase is explicitly disclosed in the owner handoff and is acceptable as a local correction with no hosted jobs or activation. It must be budgeted and approved independently before hosted execution; no previous resource approval is inferred.

The executor must use `pending_outcomes` only for availability waiting; incomplete computation must checkpoint. The trusted internal executor contract, synthetic labeling and settlement assertions are not independently authenticated or scientifically validated here. No real data, finality, probability/model qualification, distributed persistence, request/session/worker authorization, UI or full-dashboard acceptance follows. Memory loss on process exit and lack of hard CPU preemption/whole-store retention remain as documented in slice03.

## Actual commands/results

Cwd `web/`, existing Node 22.11.0/npm 10.9.0. Exact argv/timing and artifact-local cache/log overrides in [COMMANDS.json](COMMANDS.json).

```sh
npm test -- --run --config ../tasks/artifacts/forge-testing-grounds-2026-10-24/slice-03-r1-review/review.vitest.config.mts --maxWorkers=1 --no-file-parallelism
```

**Passed, exit 0: 11 passed / 24 intentionally skipped**, three files. Original two controls are executed unchanged through a reviewer-owned filter/config; [budgets.log](budgets.log) retains actual output.

```sh
npx --no-install tsc --noEmit --strict --skipLibCheck --target es2015 --lib dom,dom.iterable,esnext --module esnext --moduleResolution bundler --esModuleInterop lib/forge-testing-grounds/runnerContracts.ts lib/forge-testing-grounds/memoryRunStore.ts lib/forge-testing-grounds/boundedWorker.test.ts
npx --no-install eslint --report-unused-disable-directives-severity warn lib/forge-testing-grounds/runnerContracts.ts lib/forge-testing-grounds/memoryRunStore.ts lib/forge-testing-grounds/boundedWorker.test.ts
```

**Passed, exit 0 each**, empty [scoped-ts.log](scoped-ts.log) / [scoped-lint.log](scoped-lint.log). This is explicit-file verification, not application-wide checks or independent rerun of the owner's full 19-case claim.

Only this reviewer namespace and existing diary append were written. No owner/shared source, old evidence, config/package/migration, coordination/master/ledger or Git mutation; no broad suite, server/browser, hosted database, provider/model/production/paid call or subagent. No blocked, denied, pending-approval or running review action. Return this exact revision to Scout; further implementation/activation keeps its separate gates.
