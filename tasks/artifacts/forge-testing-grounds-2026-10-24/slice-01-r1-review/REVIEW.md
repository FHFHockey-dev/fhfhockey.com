# ACCEPT WITH LIMITS — slice 01 R1 precision correction

**R1/P2 is resolved for these new source pins.** Both exact, unchanged original counterexamples now reject the invalid ordering. Six additional independent precision controls pass. No new defect reproduced; Scout retains acceptance/integration authority. This acceptance covers the operational precision correction only, with the original pure-helper integration limits still in force.

| File | Reviewed SHA-256 |
| --- | --- |
| `web/lib/forge-testing-grounds/operationalProgress.ts` | `60fdf02b9c1480b1c3a3066e5ebf4f22254bc9c7902c154300ce77015939b5c7` |
| `web/lib/forge-testing-grounds/operationalProgress.test.ts` | `886d74890917da528fe1c787889d274f7cf004b3061606d406d5edfa973a33fd` |

Canonical `octoberBranch` HEAD `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`. There is no candidate commit; the hashes identify this uncommitted pair. The two declared before-pins match the original slice-01 EVIDENCE records.

**55/55 actual file comparisons matched at start and end:** 27 candidate/dependency/additional-dependency/R1-artifact pins and 28 unchanged protected pins. Protected files include the original failure logs/tests/receipt, old owner packets, dataHealth and slice-02 ownerPolicy files. New EVIDENCE itself and runtime/config pins are additionally recorded and unchanged. See [PINS.start.json](PINS.start.json) / [PINS.end.json](PINS.end.json). Original old-pin CHANGES REQUIRED evidence remains byte-identical; this report supersedes its R1 finding only for the new hashes.

## Precision inspection and independent controls

The original `z.string().datetime({ offset: true })` schema and serialized timestamp strings are preserved. New arithmetic extracts whole UTC seconds and numeric offsets, then compares the full decimal fraction at a common BigInt scale. Differences of whole seconds remain safely integral over the accepted four-digit year range. This fixes start/finish/heartbeat, event/snapshot, monitor/snapshot and strict-greater-than staleness decisions without millisecond/microsecond truncation. Display-only numeric elapsed/heartbeat ages are separate and explicitly approximate.

Actual independent checks:

- Original R1 heartbeat-before-start and event-after-snapshot controls: **2/2 passed**, original reviewer source unchanged.
- New precision controls: **6/6 passed**. Hand-declared ordering/equality cases cover unequal fraction lengths and second carries, 30-digit fractions/trailing zeros, all three stage orderings and event types, minute precision, colon/no-colon/quarter-hour offsets, day/year/epoch boundaries, monitoring clock before/equal/after snapshot, and malformed timestamps/threshold policies.
- At a 1ms staleness boundary, below/equal instants remain recent and an instant later by a 30-digit fractional increment is stale, even though numeric display ages round to the same value. Boundary decisions therefore do not inherit display rounding.

No full outcome/data-health/policy suite or the owner's reported 27-test run was repeated; its result remains owner evidence. Earlier independent nonprecision passes remain tied to the earlier verified scope, and unchanged protected pins were checked. The six new controls live only in [precision.test.ts](precision.test.ts).

## Commands and results

Node v22.11.0, npm 10.9.0, cwd `web/`. Exact argv, durations and artifact-local cache/log overrides in [COMMANDS.json](COMMANDS.json).

```sh
npm test -- --run --config ../tasks/artifacts/forge-testing-grounds-2026-10-24/slice-01-r1-review/review.vitest.config.mts --maxWorkers=1 --no-file-parallelism
```

**Passed, exit 0: 8 passed / 18 intentionally skipped**, two files. Config selects the unchanged two `[R1]` cases and six `[R1-review]` cases. [precision.log](precision.log) retains actual output. No failed reviewer check, correction or rerun in this re-review.

```sh
npx --no-install tsc --noEmit --strict --skipLibCheck --target es2015 --module esnext --moduleResolution bundler --esModuleInterop lib/forge-testing-grounds/operationalProgress.ts lib/forge-testing-grounds/operationalProgress.test.ts
npx --no-install eslint --report-unused-disable-directives-severity warn lib/forge-testing-grounds/operationalProgress.ts lib/forge-testing-grounds/operationalProgress.test.ts
```

**Passed, exit 0 each**, empty [scoped-ts.log](scoped-ts.log) / [scoped-lint.log](scoped-lint.log). Compiler target was not raised. Owner's receipt documents its prior TS2791 unsupported-bigint-exponentiation failure and Vite precollection read-path failure; those remain in its unchanged checks.log/EVIDENCE. This review did not reproduce or erase those historical attempts. Original two reviewer failures remain in the old, protected slice-01-review/boundaries.log.

## Limits and handoff

Numeric duration displays retain ordinary floating-point precision; extremely small positive intervals may display as zero or round at a threshold. Current status decisions use exact comparisons, so callers must continue to use those decisions rather than recomputing status from display numbers.

No durable acceptance store, retry uniqueness, checkpoint/fencing, authentication, actual session integration, cohort completeness, scientific chronology, sealing, reveal or real-data integration is accepted by this timestamp correction. Slice-02 acceptance remains local policy-only. Runner direction A and the owner's new runner namespace are outside this re-review; no host, maintenance route, model pilot or production execution is approved here.

No owner source/test, shared auth/config/tooling, coordination/master/ledger, Git/index/ref or old reviewer artifact was written. No Next/server/browser/full-suite/build/provider/production/paid call, repair or subagent. Claude's leased Next/resource paths were untouched. Only this isolated reviewer namespace and an append to the existing reviewer diary were written.

No blocked/denied check, pending approval or running operation remains. Return to Scout for acceptance of the exact new pair; preserve the original findings as history.
