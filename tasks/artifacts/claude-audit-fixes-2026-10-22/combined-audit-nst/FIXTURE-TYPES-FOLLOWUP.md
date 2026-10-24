# Reviewer fixture TypeScript follow-up

Two diagnostics come from the same callback in the unchanged NST R1 independent-review fixture. There is no application source diagnostic in the recorded all-file check.

- `TS2345`, copied fixture line **355**, column **41**: `mockImplementation` can return an invalid inferred combination `{ data: any[]; error: { message: string } }`. `originalRpc` returns a union of success (`data` array, `error: null`) and failure (`data: null`, error object). Spreading either result and unconditionally replacing `data` in the corruption branch can mix array data with a failure error, outside the mock's inferred contract.
- `TS18047`, line **359**, column **41**: `result.data[0]` dereferences the nullable failure arm without narrowing it.

Source/provenance: the parent-coordinated **NST continuation R1 independent reviewer** produced `tasks/artifacts/claude-audit-independent-review-2026-10-22/nst-continuation/r1/auditNstR1Additional.test.ts`. The review lane's diary is `tasks/diaries/2026-10-22-codex-nst-continuation-independent-review.md`. Local receipts do not encode a current worker/thread ID; parent retains current assignment/routing. This coordinator does not claim or transfer ownership.

The source artifact is **Git tracked**. It is **artifact-only**, outside `web/tsconfig.json`'s relative include roots; no reference to it was found in canonical `web/`. Canonical `web/__tests__/pages/api/v1/db/auditNstR1Additional.test.ts` does not exist and is not tracked. The failing path exists only because verification copied the artifact into that location in the isolated archive. The tracked artifact's hash is `18a2f3296c422478cc74c14f7f2571ba16a40337531426d11c7230b5c3013c0b`, matching the pinned copy.

Current `web/package.json` builds with `next build`; `web/next.config.js` has no TypeScript bypass or alternate tsconfig. Its sole explicit outside-web file-tracing include is the cron schedule Markdown file, not this fixture. Therefore this fixture is not part of the current application TypeScript program or an imported/shipped application module based on the inspected configuration and references. No production artifact or actual build was inspected, so this is not a claim about files physically retained by any deployment packaging system.

## Minimal owner follow-up, not applied

Scope: **one guard in this fixture's mismatched-acquisition-receipt test only**. Immediately after `const result = await originalRpc(name, args);`, preserve failed RPC results before corrupting a successful receipt:

```ts
if (result.error !== null) return result;
```

The existing success branch then has an array `data` and `error: null`, addressing both errors without casts, `ts-ignore`, widened mock types, weakened assertions or changed application code. It also keeps the test's intended distinction: corrupt a committed successful receipt; do not fabricate data for an RPC failure. This is a proposed correction, not an applied or newly verified fix.

Owner verification can be limited to the eight-case additional reviewer fixture plus a type check including that corrected fixture. Do not rerun all 770 cases solely for this guard. Preserve the original fixture/pinned combined archive and create a separately hashed reviewer follow-up receipt/version rather than silently mutating accepted evidence. No owner was contacted and no fixture was edited here.

No additional uncovered local critical-path defect was demonstrated. Existing A1 qualification, A3 completeness evidence, A4 storage, and NST rollout/recovery gates remain unchanged. All-file fixture cleanliness is a review-harness follow-up, not evidence that application TypeScript failed.

Pinned combined archive and candidate manifest were rehashed and remain unchanged. No tests, build, network, production, DB or NST calls were run for this diagnostic follow-up.

## Subsequent separate correction

The reviewer owner preserved the original and corrected the artifact with an early error guard. [Correction receipt](../../claude-audit-independent-review-2026-10-22/nst-continuation/r1/fixture-type-correction/RECEIPT.md) records8unchanged runtime cases and scoped TypeScript passing on corrected SHA-256 `3ac4eb83022c96dcb1330eae4170068c4ad46b98129693d2493055cdb35e4347`. The original combined archive and770-test evidence are unchanged; this reference does not claim a full-suite rerun.
