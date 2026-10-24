# Queue relocation R1 independent review

**Qualified acceptance.** R1 closes the single P2 from the [original review](../REVIEW.md). No remaining defect was found in this narrow correction. Acceptance covers local relocation and offline integrity verification; it does not establish successful SQL execution or authorize database work.

The runner now pins `SOURCE-RELOCATION.v1.json` and verifies the historical manifest and original relocation receipt before deriving the seven current input hashes. The integration-test mapping matches the previously reviewed path-only edit. The SQL mapping retains exactly the original SQL hash at the draft path. The five other frozen inputs retain their historical hashes. The same `verifySourceHashes()` function checks all three provenance anchors and all seven inputs both before and after database work.

The `--preflight` branch exits before importing the database client or reading target configuration. Historical receipts remain untouched. Future full runs use distinct versioned result paths, reject occupied destinations before loading a database client, and use exclusive writes. The SQL execution body is unchanged by this correction.

## Checks actually run

- Actual runner `--preflight`: passed, seven exact current inputs. [Output](ACTUAL-PREFLIGHT.json).
- Re-executed all **14 owner-authored regressions** under Node **22.11.0**: passed. These cover mutations to each input and provenance anchor, missing retained SQL, and changes detected by the final hash guard. Their VM permits only bounded local source reads and built-in modules. [TAP](OWNER-REGRESSIONS.tap).
- **Five independent cases**: passed. The original exact preflight excerpt still reproduces the old integration-test hash assertion; the old SQL path still produces `ENOENT` while the draft retains its original hash. The actual R1 source accepts the independently derived seven-input map through both verification calls. Occupied success and failure receipt destinations each reject before any target/client load. [Fixture](OFFLINE-REVIEW.cjs), [TAP](INDEPENDENT-ORACLES.tap).
- Runner syntax and scoped diff whitespace: passed.
- Fourteen candidate/preserved file pins match at both ends of this review. Five historical queue receipts/manifests match the original relocation base; the original independent review and its failure evidence are unchanged. No new SQL-execution result files were created. [Exact hashes and receipt](RECEIPT.json).

The earlier 98/98 registry-parity acceptance remains supported by the unchanged authority, assertions, SQL draft and non-runner relocation pins. No broad application suites or SQL checks were rerun for this artifact-runner correction.

Runner SHA-256: `fe5e21a26ce2ac31a3bee44eb5ca45a408cca1e4b1ed3b1d72620ad58ae4bbe1`.

Relocation manifest SHA-256: `54b33decfb7dbf1173bb67c154665ff9c154982961be754c0eb7000b0e96efb2`.

SQL SHA-256: `d78b385ec6b8acfbfcc6ba2909d5f558765cd90e8e4a18a2febab68bf146db12`.

No application edits, target-configuration or credential reads, database-client loads, SQL execution, network/production/NST requests, commits, or deployment. This review wrote only its own artifacts and diary. No blockers.
