# NST R1 reviewer fixture type correction

**Corrected and verified.** The artifact-only fixture now returns an RPC failure unchanged before the intentional successful-receipt corruption:

```ts
const result = await originalRpc(name, args);
if (result.error !== null) return result;
```

`originalRpc` returns a union of success (`data` array, `error: null`) and failure (`data: null`, error object). The guard narrows the branch before `data[0]` and prevents constructing an invalid combination of array data with a failure error. No casts, suppression, widened types or assertion changes were introduced. Removing that one inserted line reproduces the original file exactly.

- Original SHA-256: `18a2f3296c422478cc74c14f7f2571ba16a40337531426d11c7230b5c3013c0b` — preserved in [original-fixture.test.ts](original-fixture.test.ts).
- Corrected SHA-256: `3ac4eb83022c96dcb1330eae4170068c4ad46b98129693d2493055cdb35e4347` — [corrected artifact](../auditNstR1Additional.test.ts).
- Exact change: [fixture-only.patch](fixture-only.patch). Machine-readable evidence: [RECEIPT.json](RECEIPT.json).

Verification used Node **22.11.0/npm 10.9.0** in a fresh extraction of the combined archive, with all **3,365 original hashes** verified before copying in the corrected fixture, synthetic settings and network denial. Existing dependencies were reused.

| Check | Result |
|---|---|
| Eight unchanged runtime cases | **8 passed**, [receipt](eight-cases.json) |
| Strict scoped TypeScript including this fixture and transitive imports | **Passed**, exit 0, [receipt](fixture-typecheck.json) |
| Artifact diff whitespace | Passed |
| Historical review pins, combined manifest/archive and 31 accepted application files | Hashes unchanged |

The first scoped typecheck omitted the existing ambient `types/nhlRawGamecenter.d.ts`, causing three unrelated missing-export diagnostics. That [initial log](initial-fixture-typecheck.log) and config are preserved. Adding the unchanged declaration to the isolated [scoped config](scoped-tsconfig.json) resolved the setup problem; only the typecheck was rerun. The named fixture diagnostics are absent in the passing result. This is not a rerun of the full combined suite or all-file TypeScript check.

This receipt appends to the historical evidence; it does not rewrite earlier review verdicts or pins. The combined archive remains `1744faa8139dde75c8affd8457771b4eef7706725cddfa23019ae54996e6bf04`. The original combined snapshot still contains the old fixture; future verification may explicitly overlay the corrected artifact and record its new hash.

No application edits, production/NST/database requests, secrets, installs, commits, builds or deployment occurred. No blocker remains for this fixture correction; existing application rollout and qualification gates are unchanged.
