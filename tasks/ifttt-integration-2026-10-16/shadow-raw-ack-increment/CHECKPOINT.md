# Shadow raw/job integration candidate

Local implementation complete for this bounded increment; **independent review pending**. No production or hosted action occurred. Branch `octoberBranch`, HEAD `a8f58de6178e282acd3a71851c66f4a56b119f14`; no staging, commit, reset, synchronization, push or deployment. All prior accepted/rejected review evidence is preserved.

## Changed behavior

The actual `processTweetClaimShadowBatch` hook now carries software-extracted observation IDs per raw event, after the real context/qualification/commit path retained them. It calls a transaction through the existing job lease; raw processed status and exact acknowledgment in `tweet_pipeline_jobs.payload` commit together. The hook requires explicit shadow mode plus interpretation enabled, matches raw event ID/tweet/payload, and rejects processed/deferred overlap before writes. Future-evaluation grouping remains by original receipt lineage; it was not replaced by raw-job grouping.

The new `tweetClaimRawAcknowledgment.ts` wrapper is disabled by default. On a lost RPC reply it makes one bounded job read and, only for an exact completed receipt of this owner/input/observation set, one raw-row read. It verifies post identity, raw payload and receipt clock to microsecond precision using the existing clock helper. It does not retry the mutation or dispatch. Readback outages/conflicts remain errors. The existing job helper protects committed completion from route-catch failure handling.

The staged SQL uses server-clock expiry both before settlement and at the final job update, locks job then raw row, restricts tables and payload/ID sizes, and requires committed immutable observation evidence with exact raw-event metadata, tweet ID, input payload and receipt clock. It refuses omitted evidence for the same raw event, malformed prior job payload, missing/stale owners, old completion without a protocol receipt and conflicting repeat acknowledgment. Another raw receipt of the same post is kept separate. The transaction never alters immutable observations, native effects, consumers, forecasts or delivery state.

Owned runtime/test changes: `web/lib/sources/tweetClaimRegistry.ts`, `tweetProcessingJobs.ts`, new `tweetClaimRawAcknowledgment.ts`, and the nearest `tweetClaimQualificationStorage.test.ts`. The former unleased raw-ACK test used `pendingEvents: []`; it is now an explicit refusal test, while eleven new integration cases exercise actual job claims and atomic settlement. Before/diff artifacts preserve the old source. No API route or goal-owned forecast file changed in this increment.

## Verification

- Final focused run: **118/118 pass**: eleven integrated pipeline/default-off cases, 26 SQL contract cases, 40 nearest registry/qualification cases, 41 affected mocked-route cases. This is one bounded six-file run, not full52 or the web suite.
- The integrated cases use actual extraction, context/commit/occurrence RPCs, jobs and raw settlement, with synthetic directory/game/dated-history fixtures. Both raw tables work. They prove lost-reply readback without a second settlement RPC; unavailable/conflicting readback; server-expired lease despite a backdated app clock; rollback of raw status on a later job-write fault; and a fresh-owner retry preserving the exact previous observation/effect rows.
- SQL cases use directly seeded synthetic retained observations and actual raw/job definitions. They add wrong raw-event metadata, omitted/conflicting clocks, two distinct receipts, microsecond clock mutation, malformed job payload, owner/concurrency, rollback and role denial checks. These are not authentic-intake proofs.
- Scoped TypeScript and three-runtime-file ESLint pass, exit 0. An earlier missing/null tweet-ID return annotation failed scoped TSC and was corrected; its log is retained. No full compiler/build/browser suite was run.
- Concrete before/after: the new overlapping processed/deferred test initially failed because the hook resolved and could reset raw status after completing the job. `evidence/before-overlap-results.json` retains that failure (one run, 36 skipped); final preflight rejects before mutation and all 118 pass. Earlier logs/outputs are retained, not rewritten into current acceptance.
- Fifteen owner dependencies were captured again, all equal to accepted compatibility inputs (including actual contributions hash `1f08…`). Captured TS modules and raw fixture SQL are used; before/after live/snapshot hashes are recorded. The goalie-policy addition remains outside IFTTT's acceptance.
- Disposable PG17 only, private Unix sockets/TCP disabled, fresh schemas, network-denial harness, two test workers. All owner test/compiler/PG processes are finished and clusters removed.

## Pending gates

The new source/SQL candidate needs independent review. The RPC protects its own path; arbitrary direct service-role job/raw writes are not universally prohibited by this change. Complete deployed writer/fence/schema/ACL and real history/identity/source coverage remain mandatory gates. Deferred/rejected raw finalization and legacy publishing still have their earlier separate-write/application-clock boundaries; this increment closes processed **shadow** raw/job completion only. HTTP receipt durability, external queue acknowledgments and native external-effect exactly-once are not claimed.

All five SQL proposals remain task-local, outside active migration trees. See `ROLLOUT-GATES.md`; no production DDL, live ingestion/dispatch/replay/correction, cohort/flag/cron activation or credentials were authorized. Authentic future labels/metrics are still unopened/inactive. Historical ledger remains 225/227 matching assertions across 50/52 rows with original ambiguous CR011/CR051 failures and separate approved positives preserved.
