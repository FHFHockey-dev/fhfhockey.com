# Independent shadow raw/job acknowledgment review v1

Rejected for R18: a successful RPC reply can certify an acknowledgment that contradicts the raw row or was never persisted in the job. The frozen source manifest is `shadow-raw-ack-increment/owned-source-v1-sha256.json`, SHA256 `72e36e2e1ea8b405222f5f9d9517f60c6406265df2caa19e16ce66f82106ea23` (103 source/test/task-SQL pins plus15 captured dependencies).

## R18 — verify actual persisted protocol postconditions before returning success (P1)

SQL5 builds a receipt before its raw/job updates, then uses final UPDATE FOUND as acknowledgment of job completion and returns the prebuilt receipt. PostgreSQL BEFORE UPDATE triggers can alter stored NEW values without raising or causing zero matched rows. The function does not re-read/compare actual raw status, post identity, receipt clock/payload/marker and actual same-owner complete job/payload receipt before returning. The wrapper validates the returned object but takes its normal successful reply without the stricter persisted job/raw readback used after response loss.

Three independent private-PG assertions failed:

| Injected intra-transaction fault | Actual result | Evidence |
| --- | --- | --- |
| BEFORE raw UPDATE increments NEW.received_at by1microsecond | SQL succeeds; raw processed/job complete; returned receipt uses the old clock | `evidence/R18-sql-raw-clock.json` |
| BEFORE final job UPDATE removes NEW.payload.tweetClaimShadowAck | SQL succeeds; raw processed/job complete; persisted job payload is{} despite returned receipt | `evidence/R18-sql-job-ack.json` |
| Same raw-clock trigger through real extraction/context/qualification/commit and processTweetClaimShadowBatch | Actual hook resolves eventsProcessed1 and delivery not_requested despite raw clock/retained receipt differing by1microsecond | `evidence/R18-actual-hook.json` |

The faults execute inside this RPC's own writes, before transaction commit; they are not arbitrary post-commit direct-service rewrites and do not demand universal writer fencing. They also do not assert that production currently installs these triggers. Existing trigger inventory remains a separate gate, but a matched update alone does not establish this protocol's promised persisted acknowledgment. The successful-reply path currently accepts a state that its own lost-reply raw readback would reject.

Verify the exact actual stored raw and job postconditions after trigger execution and before returning/committing success; any mismatch must raise and roll back the raw/job transaction. Keep the same strict observation/input binding, same-owner receipt recovery and no-second-mutation behavior. Rerun these unchanged three regression assertions plus the four positive nearby controls and normal37 after a corrected pin.

## Checks and accepted observations

The unchanged new37 cases pass:11 actual pipeline/default-off and26 SQL contracts (36 private-PG +1 default-off). Scoped TypeScript passes, exit0, including the independent test copies. Nearby7 produce4 passes/3 failures. No nearest40 or mocked-route41 rerun was needed after this concrete blocker; the owner's118-case result remains reported owner evidence, not an independent118-pass claim.

Positive nearby controls prove that a job expiry or owner change injected during the raw UPDATE makes the final job predicate fail and rolls both transaction writes back. Real hook evidence-clock movement between qualification and settlement is held without completing raw/job; observations stay retained. A lost reply whose job readback owner was replaced remains unresolved and invokes only one settlement mutation. Standard37 also exercise both raw tables, two distinct receipts of one post, actual context/commit integration, overlap rejection, fresh-owner retry, missing/omitted evidence, microsecond clocks, role denial and reply/readback faults.

These observations support meaningful improvements in current leased processed-shadow settlement. They do not close R18. Earlier raw job acknowledgment and captured native consumer verdicts remain valid for their retained candidate bytes and boundaries; they are not substituted for acceptance of this new RPC/hook.

## Integrity, release and remaining gates

Final pre-release rehash verifies all103 source pins,15 owner and reviewer snapshot copies,69 owner artifact files and1382 prior reviewer files plus status addendum unchanged. The owner artifact manifest SHA256 is `3e7c12361962d554537abcb8cd9aded6ee6b067c6ebcd8b397b188228e7b201b`. Copied new37 harnesses are byte-identical. Native/claim planners/reducers and SQL1–4 are unchanged. Only the declared old95 paths changed: tweetClaimRegistry.ts, tweetProcessingJobs.ts and the nearest qualification storage test; the new runtime wrapper and SQL5 are separately pinned. Captured dependencies retain the accepted1f08 contributions slice; goalie-policy behavior remains outside scope.

All103 source and15 snapshot review holds were released immediately after final checks, before report-only writing, so the owner may correct the candidate. The full reviewed bytes and failures are retained here; later owner edits do not alter this verdict. This review root and every earlier review root will remain frozen. No source/shared-test/SQL edit, staging or commit occurred. No review compiler/test/private PG cluster remains active. All test clusters used disposable private Unix sockets, disabled TCP, captured raw/job schema and network-denial setup, and stopped/removed their cluster.

After R18 correction, deployment still requires exact schema/trigger/complete ACL and all-writer/history/identity/source evidence, migration ownership and dependency ordering, and separate operational approvals. SQL5 remains task-local outside active migration trees; do not install its earlier unwired draft too. The processed shadow path is distinct from legacy publishing and deferred/rejected completion; those retain separate-write/application-clock limits. HTTP receipt durability, external queue exactly-once, authentic future cohort labels/metrics, production dispatch/replay/publication and full52 integrated acceptance are not established. The historical225/227 ledger and separate approved game positives remain unchanged.

## Reproduction

From web/, set IFTTT_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin. Run copied integration.test.ts and raw-settlement.test.ts with this root's vitest.compatibility.config.mjs for the unchanged37. Run nearby-sql.test.ts and nearby-integration.test.ts with -t nearby for4pass/3fail. Retained logs and JSON include all outcomes. Scoped compiler project is this root's tsconfig.json. The copied compatibility resolver uses this review's exact snapshots and observational markers only; no original snapshot or assertion was edited.
