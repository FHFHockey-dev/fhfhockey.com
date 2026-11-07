# Exact remaining hosted acceptance sequence — proposal only

No step below is authorized by the local implementation request, the previously completed catalog calls, or the combined FORGE/RSO approval. No hosted action was attempted for this increment. This document prepares decisions; it does not request a sleeping user's response or treat elapsed time as approval.

## 1. Current candidate and local prerequisite reconciliation

Accepted consumer code is pinned by `../consumer-binding-increment/owned-source-v2-sha256.json`, SHA256 `9cba26d4e4617532c14d784b2d39038dce3ba9a085a0c337a0c68345532deefb`. It is default-off, task SQL is staged, and no IFTTT release commit exists. A later deployment request must name an exact reconciled commit and all linked projects/triggers; the prior production release excluded this work.

The four staged SQL files require dependency order registry → qualification → occurrence identity → consumer binding. Their current hashes and the timestamp-order hazard are recorded in `../consumer-binding-increment/ACCEPTED-V2.md`. Do not copy them into active migrations in filename sort order, rename them, edit the root migration inventory or apply them without the migration owner and separate approval. SQL4 has two append-only tables and11 helper/RPC/trigger functions.

The previous approved presence call is terminal. Its five absent LineClaim relations were `line_source_captures`, `line_claim_revisions`, `line_claim_relations`, `line_entry_revisions`, `line_pp_decisions`. They are among the14 configured history sinks; absence is not complete clear history. Their existing local definitions belong to the root-owned `20261002134400_game_line_snapshots.sql`; do not invent duplicate schema. The migration owner must settle intended schema membership/deployment state.

One read-only forecast dependency changed after acceptance: `web/lib/player-forecasts/contributions.ts`, accepted hash `282c8b1e9c7362190c39a48b031e392afb6c2abaa45190d8f83d95d6319f9df7`, observed live hash `af6bbef4898cae4805c079deba37162269ee19bd648b6192a153bd3083c38f5b`. Its retained accepted snapshot is intact. The inspected diff adds catalog expiry admission fields/checks; this task preserves that owner's work and does not accept the new combined runtime. Final live hashes are also recorded by the reconciliation. The combined owner must provide the next exact dependency checkpoint and compatibility acceptance before release.

## 2. Concrete next catalog-read proposal

Target: Supabase project **fyhftlxokyjtpndbkfse**, after the linked project identity is reconfirmed as part of authorization. SQL: `catalog-prerequisites-proposal.sql`, SHA256 **761fa7e4b69efd41f56bde3b99fa52d4211e9150319cb1e08de11c2a5c40ffe6**. This is materially different SQL from either previous approved attempt and needs its own explicit IFTTT authorization.

Proposed execution budget: exactly one catalog-only call, concurrency one, no retry/fallback; READ ONLY transaction,5-second statement and2-second lock timeouts. Fixed23 relation names cover all14 history sinks plus raw receipts/jobs, schedule, dated identity and native news queue prerequisites. At most16 overloads of five named legacy RPCs are returned. Attached trigger definitions/functions, columns/defaults, constraints/indexes, RLS policies, standard-role privileges and function/config details are hashed server-side. No stored application values, function bodies, policy expressions, credentials or trigger execution are returned/invoked. Digests are comparison fingerprints, not authenticated history or cryptographic source provenance.

The SQL withholds its payload above7,900 data bytes or16 functions; the result including the SQL JSON envelope stays below8KiB. Provider transport/audit/logging overhead is separate and unknown. Four disposable-PG tests passed: catalog-only/no-helper-write behavior, missing relation, overload guard and size guard. Those dummy fixture fingerprints are not expected production fingerprints.

Stop after this call on error, guard/truncation, missing prerequisite, unknown/mismatched function/shape/ACL/security, or unresolved trigger/writer. Do not infer compatibility merely from a returned digest. Compare each digest to the intended authoritative deployed/local schema/version; any missing exact reference requires a separately bounded metadata package naming only the unresolved objects. No additional object-detail query or migration-history read is implicitly authorized by this proposal.

## 3. Authentic source and exact historical key inputs

The repository routes/configuration cover DFOFantasy and NHL_Rosters; that is not authentic intake acceptance. Proposed separate evidence budget: at most two existing applet configuration inspections and two existing activity-item inspections, read-only, no secret values; select at most two natural already-retained original tweet IDs from those records. No synthetic webhook, new acquisition, scraping, forced ingestion or bulk replay.

Before preparing executable history SQL, bind the exact original/relay IDs, retained raw receipt and parent/report keys, one game/team, source publication/receipt times, and read cutoff to those natural records. Those values are currently missing; they must not be guessed from the synthetic oracle. Sealed future cohorts/outcomes are excluded from this historical audit.

## 4. Exact-key history and fencing acceptance

After schema compatibility and exact keys exist, prepare and independently review a new concrete SQL/parameter hash, then obtain separate read authorization. Proposed bound: one REPEATABLE READ READ ONLY transaction;5-second statement/2-second lock timeouts; at most two natural receipts, eight linked snapshots and100 exact-game official identity records; all14 history sinks, each limited to257 scoped rows with a257th-row truncation guard. Cap returned application evidence at64KiB, concurrency one, no retry. A guard, missing column/table, mismatch or incomplete identity leaves the history unknown. This is a bound for a future exact-key package, not executable SQL authorization now.

`writer-reference-hints.json` is a bounded static code-reference index, including read references. It is not a complete writer inventory or fence. `webhooks/` is absent in this checkout. The audit must enumerate the actual deployed route/cron/worker/RPC/trigger writers, other hosts/Edge services/direct clients, deployed SHAs/configuration and retention/deletion paths. Establish complete retention from original publication through readback and a real scoped write fence across that interval/readback. Current empty tables, process inactivity, a lease timeout or nonempty proof strings do not establish absence. Unknown outside writers, prior deletions or unfenced activity leave history unknown.

No scheduler disable, lock/fence mutation, history seeding, legacy mapping import or correction is approved. Any required fence change or `tweet_claim_legacy_history` insertion needs a separate exact mutation proposal and approval. Every mapping must preserve exact immutable payloads and original action/effect/transition IDs; ambiguous or partial effects stay held. Relays are not independent corroboration.

## 5. Queue and acknowledgment acceptance

The accepted local contract is native snapshot/assignment/queue/news receipt plus consumer-outbox acknowledgment. It does not establish raw receiver-job acknowledgment, external transport completion or forecast computation/publication.

Using only separately approved exact-key reads, match the retained parent/action payload, canonical/native effect and transition, native snapshot/assignment UUIDs, every queue scope/ID/high-watermark/source-capture binding and immutable consumer receipt. A known applied receipt suppresses resend even if the schedule later changes. Unknown/partial native history cannot become no-dispatch proof from current emptiness.

Separately inspect the existing raw receipt and `tweet_pipeline_jobs` key/status/owner/lease/attempts, plus native inference/news queue status and processed watermark where that deployed schema supports it. A processed raw receipt, complete ingest job and a durable native receipt are distinct facts. Pending/failed/unknown queue completion remains incomplete; do not requeue, invoke workers/cron or modify processing status as QA. Any resume or repair needs exact original keys, full immutable read sets, bounded mutation/fan-out and separate approval. External acknowledgment/receipt retention needs the actual external consumer contract; no exactly-once external-effects promise follows from these tests.

A useful next local increment is a fault-injected receiver-job/consumer-receipt integration using the existing job helper and SQL, with source ownership coordination. It is outside the original52 projection ledger and has not been implemented/reviewed in this reconciliation. Existing accepted shadow raw-status ack-loss tests remain bounded evidence only.

## 6. Future evaluation and eventual activation

Keep the prior prospective protocol default-off. Proposed first evidence-only cohort remains25 natural receipts over24 hours, registered with a fresh start at least one hour after successful registration, exact parser/source pins, admission/capture count/time bounds, complete labels and an authenticated export receipt. Do not expose sealed outcomes, label historical development receipts as new holdout data, or report metrics before genuine future samples exist. No cohort/cron was activated.

DDL, deployment, environment/caller/flag/cohort activation, live processing, one-effect native dispatch, replay/correction, compensation and publication each require their own exact approved candidate and resource/fan-out bounds. Inserting native queue rows can wake existing workers and triggers; local queue tests do not authorize that production cost or downstream work. The supported first capability remains one retained injury-out player and at most ten consistent scheduled game scopes. Hold all other inputs as exceptions; do not broaden the slice during activation.
