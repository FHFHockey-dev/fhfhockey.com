# PRD: GDL Suite Ingestion and First-Arrival Lineup Integration

## Introduction/Overview

The GDL Suite initiative expands FHFH's tweet-derived lineup ingestion beyond the existing Complete Hockey News (`CCC`) path to three GameDay accounts: `GameDayGoalies`, `GameDayLines`, and `GameDayNewsNHL`. It must preserve every source event for audit while presenting and writing the earliest valid source for a team/date/game/signal bucket.

The generic raw-event, receiver, parser, and snapshot foundation is already implemented through `line_source_ifttt_events`, `line_source_snapshots`, the source-specific IFTTT routes, and `/api/v1/db/update-line-sources`. Remaining work generalizes `/twitterEmbeds`, integrates safe winners into canonical `lineCombinations`, verifies unresolved-name review, improves parser coverage from harvested evidence, adds roster-move signals and operational backfill support, and validates the complete rollout.

This PRD was derived from `tasks/TASKS/lines-gdl-ingestion/tasks-prd-gdl-suite-ingestion.md`, the completed Lines/CCC initiative, and current repository implementation because the initiative previously had no dedicated PRD.

## Goals

1. Ingest raw events from all three GDL Suite accounts without weakening or replacing the CCC path.
2. Normalize accepted and rejected events into source-attributed snapshots using shared parsing, roster matching, provenance, and unresolved-name handling.
3. Select display and downstream winners by first valid arrival rather than hard-coded source preference.
4. Feed high-confidence lineup, practice-line, and applicable goalie signals into the existing `lineCombinations` game/team/player-ID contract without breaking consumers.
5. Preserve rejected, ambiguous, and non-winning rows for operator audit and parser improvement.
6. Support bounded catch-up processing, failure-safe immediate processing, operational queries, and a cron safety net.
7. Verify schema, routes, parsing, alerts, source attribution, and end-to-end behavior with current implementation evidence.

## User Stories

- As a lineup user, I want the earliest trustworthy lineup or starter update displayed regardless of which supported account posted it first.
- As an operator, I want every source event and parser decision retained so I can diagnose missed, duplicate, ambiguous, or rejected updates.
- As an operator, I want unresolved player names to enter one shared review flow with enough provenance to resolve and reprocess them.
- As a downstream model consumer, I want `lineCombinations` to receive only accepted, high-confidence, contract-compatible updates.
- As a maintainer, I want source-specific hints to tune one shared pipeline rather than creating divergent parsers for every account.

## Functional Requirements

1. The system must support `GameDayGoalies`, `GameDayLines`, and `GameDayNewsNHL` as distinct configured sources in the `gdl_suite` source group.
2. Each IFTTT receiver must validate its configured secret, deduplicate by stable event/tweet identity, persist the raw event before optional processing, and retain the full payload plus received/updated timestamps.
3. Raw events must preserve source group/key/account, username, tweet text, tweet URL and ID, creation labels/timestamps, processing state, and raw payload.
4. The generic processor must support one source account, all GDL accounts, or all configured sources without duplicating shared CCC/GDT parsing logic.
5. Processing must reuse tweet-ID/URL normalization, oEmbed caching/backoff, quoted-post resolution, classification, NHL filtering, roster matching, unresolved-name queueing, rejected-row persistence, and event-status updates.
6. Source hints may upgrade otherwise-`other` rows conservatively for goalie, lineup/practice, or injury/transaction language, but must not override an explicit parser classification; applied hints must be recorded in metadata.
7. Accepted and rejected snapshots must retain source group/key/account at the top level and in metadata, and capture keys must avoid cross-source collisions.
8. First-arrival buckets must use snapshot date, resolved team, game when known, normalized signal type, and subtype where necessary.
9. Initial normalized signal types must cover `lineup`, `goalie_start`, `injury`, `practice_lines`, and `power_play`, with explicit roster-move subtypes added only when evidence supports them.
10. Only accepted observed rows may win a display or downstream bucket. Rejected and ambiguous rows must remain queryable but must not drive user-facing selection or `lineCombinations` writes.
11. Winner ordering must use exact tweet-posted time when available, fall back to received/observed time when necessary, and break ties deterministically by source key, tweet ID, and capture key.
12. `/twitterEmbeds` must load accepted rows from every configured tweet-line source, group them by the canonical bucket, render the first-arrival winner, show its source label, preserve auto-refresh, and retain access to non-winning source evidence.
13. The system must define a single reusable first-arrival helper/contract shared by `/twitterEmbeds` and `lineCombinations` updates so selection cannot drift between display and persistence.
14. Before writing tweet-derived data, the implementation must verify the canonical `lineCombinations` array fields, game/team identity semantics, provenance behavior, writers, and consumers. The stale snake-case `line_combinations` table is historical evidence, not the active downstream contract.
15. `lineCombinations` writes may use accepted lineup/practice-line rows and explicitly supported high-confidence goalie-only updates. Lower-confidence injury/transaction signals must remain metadata or domain-specific records unless a downstream contract is approved.
16. A winning snapshot must map into the existing flattened player-ID arrays (`forwards`, `defensemen`, `goalies`) keyed by `gameId` and `teamId`, with additive provenance fields that do not break existing readers.
17. Non-winning source provenance must remain available after a winner is written.
18. Unresolved-name queue rows must include source key/account, source URL, tweet ID, team context, and parser reason for both CCC and GDL sources.
19. The existing alias-review page and save/reprocess path must work source-agnostically without duplicated provider-specific resolution code.
20. Parser changes must be driven by accepted, rejected, and ambiguous harvested examples and protected by focused fixtures before regex or keyword logic changes.
21. Supported roster-move handling must cover high-confidence call-up, assignment/sent-down, healthy-scratch/removal, trade, waiver, signing, activation, return, and IR language while keeping uncertain signals in metadata.
22. Player names in roster-move signals must be cross-referenced against canonical roster/player data; unresolved names must remain explicit.
23. The processor must offer production-safe bounded catch-up parameters for pending configured sources by date and must paginate Supabase/PostgREST reads until a short page when result sets can exceed the page cap.
24. `process=true` must never prevent the raw event from being stored when oEmbed fetching, parsing, or downstream persistence fails; processing failures must remain retryable and observable.
25. Operator documentation must include IFTTT configuration, pending/accepted/rejected/winner queries, `lineCombinations` verification, retry/backfill behavior, and the cron safety-net recommendation.
26. End-to-end validation must cover source receivers, parser/classification cases, duplicates, quotes, rejected/ambiguous rows, schema indexes/constraints, first-arrival display, unresolved-name handling, and `lineCombinations` output.
27. Production/provider actions—including IFTTT applet creation, live controlled events, deployed secrets, SQL application, or production email verification—must use the super-goal pause/manual-action protocol.

## Non-Goals (Out of Scope)

- Replacing or removing the working CCC production path during this initiative.
- Preferring CCC or any GDL account when another accepted source arrived first.
- Discarding later, rejected, or ambiguous source evidence.
- Letting low-confidence roster news mutate canonical line combinations automatically.
- Depending on live X/oEmbed responses in automated tests.
- Replaying current-state lineup sources as dishonest historical observations.
- Reviving stale snake-case `line_combinations` as a competing downstream contract when canonical consumers use `lineCombinations`.

## Design Considerations

- Source labels must be visible on first-arrival cards so users understand provenance.
- Non-winning evidence may use a secondary detail/debug surface; it must not crowd the primary winner card.
- Existing `/twitterEmbeds` refresh behavior and FHFH styling should remain intact.
- Loading, empty, partial-source, stale, and error states must distinguish no data from failed source retrieval.
- Operator/debug views must make rejection reasons and unresolved-name state understandable without exposing secrets.

## Technical Considerations

- The hybrid bridge is authoritative: CCC remains on its current path while new sources use generic tables/routes until later evidence justifies migration.
- Shared implementation includes `lineSourceIftttReceiver.ts`, `lineSourceProcessing.ts`, `tweetLineupParsing.ts`, `lineupSourceIngestion.ts`, and the generic `update-line-sources` route.
- Current generic oEmbed metadata still uses a legacy CCC-named key; rename/abstraction should be targeted and regression-tested rather than rewritten speculatively.
- `lineCombinations` is the canonical current game/team lineup table consumed by the lines UI, rolling metrics, projection, goalie, Start Chart, and deployment builders. The separate snake-case `line_combinations` table contains stale historical tweet rows and has no verified active consumer; it must not become a parallel writer target.
- Supabase reads of event/snapshot/history tables are unbounded by nature and require explicit pagination or a documented bounded query.
- Raw-event persistence precedes processing to preserve idempotent retry and failure recovery.
- Source timestamps can have different precision; deterministic fallbacks and tie-breaking are required.

## Success Metrics

- All three GDL receivers store deduplicated source-attributed raw events and can invoke the generic processor safely.
- Accepted/rejected snapshots preserve complete provenance and parser status.
- First-arrival selection produces the same winner for display and downstream mapping under deterministic tests.
- `/twitterEmbeds` shows multi-source winners with source labels and working refresh/error/empty states.
- Supported winner rows update `lineCombinations` without breaking current consumers.
- Unresolved names can be emailed, reviewed, saved, and reprocessed through the shared path.
- Catch-up and scheduled processing are bounded, observable, retryable, and pagination-safe.
- Focused tests and controlled rollout evidence cover all three accounts plus CCC compatibility.

## Open Questions

1. Whether high-confidence goalie-only snapshots should directly update the existing `goalies` field or remain a separate canonical starter signal must be resolved from current writer/consumer evidence before implementation.
2. Whether non-winning snapshots appear inline or only on a debug/detail surface may be chosen during `/twitterEmbeds` implementation as long as provenance remains accessible.
3. Live IFTTT applet, deployed-secret, production SQL, and email verification remain manual checkpoints and do not authorize exposing credentials in task artifacts or chat.
