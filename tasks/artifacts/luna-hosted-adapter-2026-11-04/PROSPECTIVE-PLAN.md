# Prospective Luna report — disabled local preparation

S03 and its missing raw receipt are no longer prerequisites. Use a newly retained, eligible report after a separately approved future capture window. No live capture or pilot is active. The new local builder operates only on supplied material and has no intake, database, environment, transport, enqueue or scheduler hooks.

## Local implementation

`web/lib/sources/lunaHosted/prepareDraft.ts` exports `prepareHostedLunaDraft`. It defaults off before reading material. With explicit local enablement it:

1. Bounds supplied material to 512,000 serialized bytes and clones it without mutation; requires UUID-shaped job/receipt/event IDs. These shapes do not prove database retention.
2. Reuses `prepareTweetReviewPacket` to bind supplied source/claims to the exact supplied receipt. Keeps original text, clocks, payload and all deterministic packet holds.
3. Requires causal-as-of identity evaluation matching the report clock, a non-future as-of relative to the explicit preparation time, at least one eligible canonical row after causal projection, and bounded unique/non-overlapping exact mention spans. Reuses `projectSavedPlayerIdentityEvidence`; it does not certify supplied evidence or invent historical teams/aliases. Full request/hint/candidate checks remain in the existing worker.
4. Forces `decisions:false` and `rules-and-synthetic-only`, serializes exact input/receipt JSON, computes existing hashes and validates through `validateHostedLunaJob`.
5. Returns an immutable `prepared_for_owner_review` draft with `canEnqueue:false`, `providerDispatchEnabled:false`, `sourceAuthenticated:false`, and no publishing/status/alias authority. Review requirements cannot be cleared by a caller flag or provenance string. Failure returns a generic hold without source text.

**Prepared does not mean eligible for the worker or authenticated.** A draft may retain candidate holds or mention metadata that the existing worker’s stricter request schema rejects before provider access.

This is a consistency checker and local artifact constructor. It does not implement the missing trusted loader or owner-only atomic staging operation. A successfully prepared envelope must not be inserted by an automated caller merely because validation passed. The output's `provenanceRef` is a locator supplied by the caller, not proof of approval or authorship. Draft contents include retained source data and belong in an owner-controlled location.

## Minimum prospective path

1. **Prepare dated context before the window.** Retain an approved bounded canonical player cohort, known-at times, approved aliases and independently evidenced dated memberships from the backend. A future report after that snapshot can use a causal cutoff; unknown subjects or missing historical context remain held. Current rosters alone are not historical proof.
2. **Receive a natural delivery through controlled retention.** After migration/route/configuration approval, use the existing bounded intake contract. Record its policy, source tuple, immutable receipt/event UUIDs, raw payload/text, publication and received clocks, classification and baseline/variant relationship, admission linkage and exact serialized hash. Do not manufacture a receipt from a legacy row or post ID. A timeout gets the existing bounded read reconciliation, never an automatic second write. An unresolved variant/correction stays held.
3. **Select one new eligible report.** Prefer explicit wording about one goalie and a resolvable original source. Retain the original capture and any direct correction under the approved source-use scope. Compare original post ID/account/text/clock with the delivery; shared webhook authentication, relay text agreement and an allowlist alone do not establish authorship. Human review may establish the approved evidence basis; the model cannot do so. If no eligible report arrives within the window/caps, stop without broadening the cohort or fabricating a sample.
4. **Read exactly that immutable receipt.** The recovered SQL6–8 contract identifies `ifttt_raw_receipt_variants`, `ifttt_intake_receipts` and the intake policy. Implement/review the exact-ID loader against those verified definitions and deployed prerequisites. An exact owner-selected read avoids needing SQL9's batch cursor for this first report. Do not read source bytes from the latest mutable carrier.
5. **Prepare locally, then review.** Feed the retained receipt, deterministic source/claims, bounded dated identity material and exact mentions into the draft builder. Record original-source/processing-scope evidence and owner approval separately, bound to the draft hash. Keep every ambiguity and source/game/time/conflict hold visible. This first report is an integration/development case, not accuracy validation or an untouched holdout.
6. **Stage only through an accepted owner-only transaction.** That operation is still to be implemented: reread authoritative receipt/approval evidence, atomically insert exact source+job, bind the specific Luna approval, enforce explicit enrollment count/byte bounds and deduplicate on approval+receipt revision+reference version. Exact duplicates reconcile to the same job; divergent bytes conflict. Lost commit acknowledgment gets a bounded read, not a new ID or automatic retry. Do not add a service-role or webhook body-based enqueue.
7. **Dispatch is a later separate step.** The actual route remains hardcoded disabled. A separately authorized bounded worker run can use only the staged job ID and dedicated worker authentication, with the existing full-reservation budget, concurrency one, zero retries and stop on uncertain outcome. It produces review results only; publication remains outside scope.

## Minimum activation choices

These are prospective decisions, not settings applied by this task:

- **Capture scope and operational effect:** exact existing applet/source tuples, acceptable original-reporter evidence, and permitted use of the report in the later API review. Existing pilot configuration is global: out-of-scope receivers refuse deliveries, and processing follow-ups pause while it is configured. Either approve a short retain-only window covering the active applets, or commission a separately isolated retention design before activation. A single-route scope does not isolate these effects.
- **Window and bounds:** future start/end, maximum intake attempts/receipts, one owner-selected eligible report plus its directly related revision evidence, and a named stop owner. Keep the capture limit distinct from model-call authority. No policy values are silently registered or borrowed from the expired development ledger.
- **Optional later model pilot:** exact project/environment/candidate, one Responses-only report, explicit aggregate call/spend cap including historical uncertain exposure, finite validity and stop owner. Choose those values only after the current endpoint/pricing and credential prerequisites are verified. No paid authority is needed for the local draft builder.

## Technical prerequisites before activation

- Recover/review SQL6–8 from local Git, reconcile their migration authority/order and actual deployed schema, ownership, inherited grants, immutability, writer compatibility and RPC timeout/PostgREST behavior. Recovery is not application approval. SQL9 is optional for this one-report path and its recovered correction still carries a pending independent-review marker.
- Implement and test the exact-ID receipt/context loader and owner-only transactional staging boundary; the pure builder does not replace them. Verify source-use evidence and dated context are available for the selected new report.
- Verify exact release/project targeting, dedicated worker authentication and credential readiness without exposing secrets. Deployment, policy registration, route-gate changes, live capture and paid execution each remain unperformed. Existing IFTTT receiver secrets must not become the Luna worker secret.

## Recovered source references

SQL6–8 are available with the original named paths at commit `1057b4a162e5a2b17b853aed0d5f69390cfd34ea`; their SHA-256 values match the saved acceptance receipts:

- SQL6: `789772078e3b8405539358e07413cf2fd4cf6d80a82513911bf989f8c02b0483`
- SQL7: `ab5d686589f78815326b1b0c942975206cfc1cc4e6288fdfa64646e4289f8c5e`
- SQL8: `7c6c5e093fdaa1b0ccef15228eccda1b60096d4a74662fb0ad84e0302be01e4a`

Corrected SQL9 at commit `5ae65fc1349f99b3eaf01f5844b64961d4d995cd`, `tasks/ifttt-integration-2026-10-16/review-sidecar-recovery-2026-10-19/supabase/migrations/20261019160708_ifttt_review_sidecar_preparation.sql`, matches historical source-pins SHA-256 `3223747dc31edf6e5bb14b4b4247cc1349e650c07096031a7005cc8376e712d2`. Its source manifest says owner-tested correction, independent re-review pending. No files were restored or SQL applied in this slice.

## Isolated retention versus the global retain-only switch

This is a local design comparison, not implemented capture behavior or a configuration change. The global effects are established by current `iftttIntakePolicy.ts:59-85`, `lineSourceIftttReceiver.ts:145,249-255,315-351`, and `replay-player-aliases.ts:41`. Recovered SQL6 also inserts into the existing raw event tables (lines 100-111 at commit `1057b4a162e5a2b17b853aed0d5f69390cfd34ea`). The current packet/mapper accept only `line_source_ifttt_events` and `lines_ccc_ifttt_events` as event sources.

| Decision dimension | Existing global retain-only mode | Smallest independently isolated capture proposal |
| --- | --- | --- |
| Delivery entry | Existing applets and existing receivers, global pilot configuration | One additional dedicated endpoint and an additional approved applet action/duplicate delivery, preserving the existing applet path |
| Storage | SQL6–8 immutable receipts plus existing raw event carriers and admission map | Separate private immutable archive and its own owner-registered capture policy/counters; no inserts into legacy raw tables or processing queues |
| Normal processing | In-scope delivery retained only; out-of-scope delivery refused; pending/current-day replay follow-ups wait | Existing receiver/scheduler/replay paths remain unchanged; isolated failure affects only the extra capture |
| Reuse | Stronger existing local implementation/review coverage; known retained receipt contract | Reuse pure parsing/time/consistency utilities where applicable; existing receiver/SQL6 gateway cannot simply be reused because it writes legacy carriers |
| New work | Migration/release/deployed verification and trusted loader/stager still needed | New handler/auth, private retention transaction, separate receipt lineage contract, loader adaptation and synthetic/DB verification; not a drop-in env flag |
| Source authenticity | Delivery secret and receipt consistency are insufficient | Same limitation; a dedicated delivery secret also cannot authenticate the original reporter |
| Main risk | Operational interruption, excluded deliveries, and later processing of pending carriers when pilot configuration ends | Additional exposed endpoint, duplicate/reordered/missing deliveries, storage/cost bounds and new contract surface; same deployment/DB still shares infrastructure load |

**Recommended if uninterrupted ordinary intake is required:** design the independently isolated archive. If a short, explicit global pause is acceptable, the existing mode has less new implementation work. Neither is activated here. A `process=false` query or copying the existing receiver with another source key is not isolation: those paths still feed legacy raw tables that other processors can discover. Adding a synchronous archive write to the existing receiver couples capture failure/latency to ordinary deliveries; adding fire-and-forget work lacks a durable retention guarantee.

### Exact proposed isolated scope

1. One new route, proposed `web/pages/api/v1/sources/ifttt/luna-capture.ts`, backed by new `web/lib/sources/lunaHosted/capture.ts` and `capture.test.ts`. Keep it code-disabled initially. Accept POST only, a bounded explicitly versioned content body, a separate header credential, and a single owner-selected applet scope. Never inherit the shared-secret fallback, log/store authentication headers, fetch original URLs, call a processor or invoke Luna. Header capability and duplicate-action availability must be checked against the actual applet setup before promising this route can receive deliveries.
2. One task-local SQL proposal and assertion harness under `tasks/artifacts/luna-hosted-adapter-2026-11-04/`, with exact filenames/custody agreed before implementation. A separate private schema owns a finite capture policy and immutable receipts. The bounded write transaction serializes attempt/receipt/byte admission and durable stop; exact duplicates return one receipt, changed content for the same delivered post is a distinct held variant. Preserve received clock, supplied publication clock and clock basis, delivered post identity, source tuple, exact content payload and hashes. Acknowledgment uncertainty gets one bounded read reconciliation, no automatic mutation retry. No trigger, FK write, direct insert or queue fanout touches legacy raw/semantic/publication tables.
3. A truthful receipt type is a prerequisite to consuming that archive. Current `TweetReviewReceipt.eventTable` and mapping lineage checks accept only the two legacy tables. Do **not** label an isolated receipt as a legacy event or invent a legacy event UUID. A separately reviewed discriminated isolated-receipt variant would need exact custody for `tweetReviewSidecar.ts`, `tweetDecisionReviewMapping.ts` and their nearest tests, plus the new archive loader and draft-boundary tests. Preserve existing legacy semantics. If that contract extension is declined, the isolated archive can retain evidence but cannot feed the present worker. No such shared edits are authorized or made by this slice.
4. Owner-only receipt/context loading and atomic job staging remain separate from receipt capture. Capture cannot set `sourceAuthenticated`, clear holds, stage jobs, reserve model budget or activate the hosted route. Original-source evidence, permitted use and dated player context must still be reviewed for the selected report.

These proposed paths are not reserved by the current six-path grant and have not been created. No new schema migration, credential, applet or configuration is part of the completed test-only follow-up.

### Evidence needed to decide and implement

- Owner decision: tolerate a bounded global pause, or require uninterrupted intake. For the latter, identify one existing applet and confirm an additional delivery can be configured without replacing its original action; determine any plan/cost limit and supported header/body configuration. No applet change is authorized by this comparison.
- Read-only operational inventory under separate authority: actual deployed receiver/schema versions, raw consumers/triggers/writers, active applet tuples and normal request/byte volume. This determines pause impact or isolated capacity; local source alone does not prove deployed behavior.
- Freeze exact scope, window, attempts/receipts/bytes, duplicate/variant policy and stop owner. Stopping capture must not disable ordinary intake. No catch-all cohort or infinite retries.
- Local acceptance for the isolated proposal: disabled/no-key/no-DB behavior, wrong-secret/body/scope refusal, one receipt under concurrent duplicate delivery, held variants, exact raw retention, cap/window/stop serialization, uncertain-ack read reconciliation, immutable-table/role denials and proof that ordinary raw tables/queues/processor spies remain untouched. Test original and duplicate applet delivery independently; neither ordering nor exactly-once arrival is assumed.
- Independent review of the new receipt discrimination and legacy regression cases before staging is permitted. Deployed permissions/retention/deadline compatibility and exact release/activation authority remain later gates.
