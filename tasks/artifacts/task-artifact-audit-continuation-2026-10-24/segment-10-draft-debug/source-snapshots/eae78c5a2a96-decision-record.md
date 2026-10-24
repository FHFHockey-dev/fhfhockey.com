# Decision Record

Authority and related context: [product strategy](./product-strategy.md), [execution contract](./goal-prompt.md), [repository audit](./repository-audit.md), [implementation plan](./implementation-plan.md), and [progress state](./progress.md).

DRD-001 — Ranking storage and ordering
Topic: A
Status: Approved
Chosen direction: Hybrid persisted ordering plus immutable event history. Each placed player has a sparse bigint order_key; displayed rank is derived with row_number() over order_key, fhfh_player_id.
Transaction behavior: Atomic reorder RPC locks the ranking set, checks an expected lock_version, calculates a midpoint key, changes one entry, increments the version, and appends an event.
Concurrent edits: Stale versions return conflict metadata; clients refresh and deliberately retry or reapply.
Move cost: O(1) normally. When adjacent keys have no gap, a locked normalization respaces the list.
Cutoff: Rank 250 and 251 are derived, not stored flags. Moving a player into 250 displaces the old 250 to 251; removing one promotes 251.
Below-cutoff order: One continuous list begins at 251.
Repair: Validation detects duplicate keys, gaps are harmless, and deterministic normalization restores spacing.
Event responsibilities: Record source, actor, idempotency key, ranking version, affected player, before/after neighbors and ranks, and operation metadata. Events are evidence/audit, not the read-time ordering engine.
Alternatives: Contiguous integers, sortable decimals, linked lists, event-derived order.
Repository evidence: PostgreSQL/Supabase RPCs are established; account tables already use transactional ownership. No existing personal-ranking order needs compatibility.
Rationale: Sparse keys avoid rewriting hundreds of rows while preserving straightforward SQL ordering and repair.
Consequences: Requires RPC-based writes and optimistic conflict UI.
Evolution: Keys could later move to LexoRank-style strings without changing visible-rank semantics.
Approval requirement: Approved.
Phases: 1–2.
DRD-002 — Ranking ownership and versioning
Topic: B
Status: Approved
Chosen direction: Schema supports multiple sets, but launch exposes one default ranking per user and target season.
Representation: UUID ranking ID, owner UUID, target season, status, default flag, display name, scoring-profile snapshot, source league/context, schema version, seed revision, and lock_version.
Scoring behavior: Settings are snapshotted. Later account changes never silently reorder or reinterpret an existing ranking.
Initialization: Unique owner/season/default and seed-revision constraints make Yahoo initialization idempotent.
Reset/copy/archive/reseed: Reset requires confirmation and preserves audit history; copy/archive/reseed UI is deferred. New seasons create new rankings rather than mutating old ones.
Alternatives: One permanent ranking, multiple named rankings at launch, auto-reseed on data refresh.
Evidence: Existing user_settings, external leagues, provider contexts, and owner UUID patterns.
Rationale: Gives a simple launch UX without preventing multi-league rankings later.
Consequences: Every ranking response must include season, scoring snapshot, version, and seed provenance.
Evolution: Enable named redraft, keeper, dynasty, and league-specific rankings.
Approval requirement: Approved.
Phases: 1–2, 8.
DRD-003 — Canonical player universe
Topic: C
Status: Approved
Chosen direction: Add an FHFH identity registry; preserve players as the NHL-linked analytics record.
Identity: Stable generated fhfh_player_id; optional unique NHL link; mutable display/team metadata; lifecycle and review statuses.
External mappings: Provider, provider player ID/key, season/game context, match method, confidence, verification status, provenance, and review timestamps.
Launch inclusion: Existing verified NHL players; verified Yahoo/projection/roster/contract-linked players; manually verified active prospects, rookies, unsigned fantasy-relevant players, and requested additions.
Launch exclusion: Arbitrary free text, unresolved duplicates, retired/inactive players by default, and long-term overseas departures without current NHL relevance.
Precedence: FHFH identity is canonical; NHL is preferred for NHL identity/demographics; rosters for current organization; Yahoo for seasonal eligibility/ADP; projection sources for projection presence.
Team changes: Update organization history, never identity.
Prospects without NHL/Yahoo IDs: Valid only after FHFH verification.
Identity review: Reuse the unresolved-alias administrative pattern.
Alternatives: Replace players; use NHL ID universally; use names; require Yahoo IDs.
Evidence: players.id is the NHL ID; duplicate names and unresolved mappings exist; no prospect table exists.
Rationale: Additive identity safely expands the universe.
Consequences: Ranker joins through a new bridge before reaching analytics.
Evolution: Add licensed or official prospect feeds only after terms and match-quality review.
Approval requirement: Approved.
Phases: 1, 5, 8.
DRD-004 — Candidate bench and watchlist
Topic: D
Status: Approved
Chosen direction: Materialized placed entries form one continuous order. Top 250 and candidates are derived from position; watchlist membership is separate.
Bench depth: Initial seed includes all eligible, successfully mapped players with valid prior Yahoo ADP, including those after 250. Displaced, directly placed, and assisted-placement players persist below that.
Watchlist: A player may be watched but unplaced. Watchlist priority may be light/manual but does not imply rank.
Removal: “Remove from top 250” moves the player below the cutoff and preserves evidence. “Forget/unplace” is a later explicit action.
Re-entry: Previous evidence remains available when a candidate is promoted again.
Alternatives: Fixed 50-player bench, derived-only candidates, watchlist-as-bench.
Evidence: Product authority distinguishes continuous candidates from monitoring intent.
Rationale: Prevents lost ordering and preserves cutoff behavior.
Consequences: UI and exports must distinguish placed candidates from watched/unplaced players.
Evolution: User-configurable candidate views, never separate identity universes.
Approval requirement: Approved.
Phases: 2–3.
DRD-005 — Pairwise evidence
Topic: E
Status: Approved
Chosen direction: Immutable comparison submissions plus a materialized/latest personal preference per canonical pair.
Canonical pair: (least(fhfh_player_id), greatest(...)); outcome is represented relative to the canonical order.
Duplicate submission: Client idempotency key and issued-prompt ID make retries harmless.
Reversal: New explicit decision supersedes the prior personal preference; history remains immutable.
Skip: Logged for queue suppression, but no personal or community preference.
Too close: Records uncertainty, suppresses repetition temporarily, and creates no half-win.
Staleness: Preferences remain until reversed; comparisons become revalidation candidates after material changes or 60 days.
Contradictions: Retained and flagged. They do not erase earlier history.
Personal effect: If the result contradicts current ordering, the winner moves immediately above the loser. If order already agrees, only evidence is updated.
Community eligibility: Authenticated, prompt-issued explicit comparisons; current contribution consent required; one latest preference per user/pair/season.
Alternatives: Mutable-only pair table, append-only events without current state, direct edits converted to pairwise wins.
Evidence: Product authority requires evidence preservation and forbids synthetic community wins.
Rationale: Separates auditability, personal order, and community evidence.
Consequences: Opting out removes all of that user’s comparisons from future aggregates.
Evolution: Add evidence weighting and league segmentation later.
Approval requirement: Approved.
Phases: 3–4, 6.
DRD-006 — Assisted placement
Topic: F
Status: Approved
Chosen direction: Deterministic persisted interval-narrowing workflow.
Rough ranges: Top 50, 51–100, 101–150, 151–200, 201–250, outside 250, or unsure.
Anchor selection: Compare against the midpoint of the active interval; a win moves the upper boundary, a loss moves the lower boundary.
Too close: Narrows to the local anchor neighborhood and proceeds to validation.
Neighbor validation: Compare against the proposed above/below neighbors.
Cutoff validation: Any plausible 245–255 placement explicitly validates against current 250 and 251.
Contradictions: Retry a contradictory boundary once; if unresolved, broaden the plausible range and flag uncertainty.
Stop conditions: Validated interval of at most two slots, user cancellation, 12 ordinary comparisons, or 16 with contradictions.
Output: Suggested rank, plausible range, confidence explanation, confirm/cancel.
Resume: Persist interval, answers, ranking version, anchors, and expiration. On version conflict, refresh and perform at most two revalidation comparisons.
Expected comparisons: Rough range 4–6; no rough range 7–10; hard cap 12/16.
Alternatives: Free-text target rank, model-only insertion, unspecified pairwise workflow.
Evidence: Sparse ordering and pairwise storage support deterministic insertion.
Rationale: Predictable, testable, explainable, and resumable.
Consequences: Placement sessions require explicit lifecycle states.
Evolution: Learned anchor selection may later reduce questions.
Approval requirement: Approved.
Phases: 3.
DRD-007 — Adaptive matchup selection
Topic: G
Status: Approved
Chosen direction: Deterministic launch queue, model-based selection deferred.
Twenty-prompt mix: 10 unresolved/high-information personal pairs, 5 outside-player discovery pairs, 3 contradiction/stale/cutoff validations, 2 community-interest/editorial pairs.
Information rules: Prefer adjacent or low-evidence regions, uncertain cutoff players, and candidates whose projection/market signals materially disagree with personal order.
Diversity: No more than three consecutive prompts from one position group; include goalie and defense discovery when eligible.
Repetition: Do not repeat a decided pair within 30 issued prompts or seven days unless explicit revalidation is needed.
Fatigue: Quick-five mode, explicit stop, skip/too-close cooldowns, no endless forced workflow.
Anchoring: ADP and community rank hidden by default; evidence expandable.
Alternatives: Random pairs, pure binary-search pairs, ML information-gain model at launch.
Evidence: Product authority supplies the 50/25/15/10 conceptual mix.
Rationale: Reproducible behavior is easier to test and debug with limited initial data.
Consequences: Queue explanations must identify why a matchup was selected.
Evolution: Contextual bandits or posterior information gain after adequate evidence.
Approval requirement: Approved.
Phases: 4, 8.
DRD-008 — Direct editing
Topic: H
Status: Approved
Chosen direction: Launch with drag-and-drop, numeric rank entry, and insert-above/insert-below.
Filtered views: Dragging is disabled where the visible subset makes the destination ambiguous; explicit global rank remains available.
Transactions: Every operation is one atomic reorder transaction.
Events: Record method, prior/new location, neighbors, client idempotency key, and ranking versions.
Prior comparisons: Direct editing controls personal order. A direct reversal flags conflicting comparison evidence for review but does not manufacture or erase a community vote.
Conflicts: Stale version produces a refresh/reapply prompt, not silent last-write-wins.
Alternatives: Drag only, numeric only, tier/bulk editing at launch.
Evidence: TanStack Table and Framer Motion are available; product authority requires direct personal control.
Rationale: Supports both fast and precise editing.
Consequences: Accessibility requires keyboard and form-based alternatives to drag.
Evolution: Tiers, bulk moves, copy/paste, and multi-select later.
Approval requirement: Approved.
Phases: 2, 8.
DRD-009 — Community Ranking v1
Topic: I
Status: Approved
Chosen direction: Regularized Bradley–Terry batch model using latest eligible explicit pair preferences.
Yahoo prior: Labeled market prior; influence decreases toward zero as a player approaches 20 independent contributing users.
Undrafted players: Neutral broad prior and explicit previously_undrafted state.
Deduplication: One active preference per user/pair/season.
Consent: Explicit opt-in, unchecked by default.
Emerging state: At least 5 users, 10 comparisons, and 5 opponents.
Public top-250 admission: At least 20 users, 40 comparisons, 10 opponents, meaningful 200–300 cutoff connections, rate/abuse checks, and a buffered estimate materially inside 250.
Confidence: Launch uses evidence tiers and stability checks, not claims of precise Bayesian intervals.
Snapshots: Daily in preseason; weekly during quieter offseason periods; methodology version recorded.
Abuse: Prompt issuance, idempotency, account/user/pair dedupe, rate limits, burst detection, opponent diversity, and moderation exclusions.
Alternatives: Elo, raw wins, advanced Bayesian model.
Evidence: Product authority recommends comparison-graph methods; current account count makes a mature model premature.
Rationale: Corrects opponent strength without overbuilding.
Consequences: Early public displays must distinguish market-seeded from community-established.
Evolution: Bayesian uncertainty, time decay, scoring segmentation, user reliability, and manipulation-resistant weighting.
Approval requirement: Approved.
Phases: 4, 6, 8.
DRD-010 — Discovery
Topic: J
Status: Approved
Chosen direction: Three capability tiers.
Available with existing data
Projection gap: at least two valid projection sources and consensus projected rank at least 25 places above personal or prior ADP.
Previously undrafted projection: no valid prior ADP, at least two projection sources, and consensus projection inside the top 300.
Cutoff challenger: personal rank 251–275 with projection rank at least 25 places better.
Ownership riser: verified seven-day ownership gain of at least five percentage points or top-decile gain among eligible players.
Team/opportunity change: verified current roster/team change plus a material projection or deployment change.
Modest new ingestion/materialization
Projection snapshots and deltas.
Reliable current ADP snapshots.
Normalized line/PP-role history.
Goalie workload history.
Official or editorial prospect additions.
Future infrastructure
News/coach-statement extraction.

Training-camp battle tracking.

Editorial sleeper workflows.

Advanced role models.

Personalized ML discovery.

Alternatives: Broad trending directory or opaque model recommendations.

Evidence: Projection configs, Yahoo ownership fields, rosters, contracts, line combinations, and goalie workload sources already exist.

Rationale: Every surfaced player receives a reproducible “why.”

Consequences: Discovery groups require source freshness and expiry metadata.

Evolution: Personalized relevance after enough interaction data.

Approval requirement: Approved.

Phases: 5, 8.

DRD-011 — Search and autocomplete
Topic: K
Status: Approved
Chosen direction: Server-side search over the FHFH identity registry.
Fields: Canonical/display names, aliases, NHL/Yahoo IDs, position, current organization, birth year, provider eligibility, and identity status.
Ordering: Exact name, prefix, verified active status, current NHL roster, projection/Yahoo presence, then trigram similarity.
Filtering: Active/eligible by default; archived/inactive only through explicit filter.
Disambiguation: Name, birth year, position, organization, identity status, and stable IDs.
Prospects: Show organization/rights holder or current development club distinctly.
Headshots: Canonical/NHL, then verified Yahoo, then position silhouette.
Missing player: Submit an addition request tied to the entered text and context; never create an identity directly.
Alternatives: Current-roster autocomplete, direct client ilike, arbitrary write-in identities.
Evidence: Existing search surfaces lack universe/status/disambiguation support.
Rationale: Prevents duplicate and fictional players.
Consequences: Requires normalized indexes and administrative request handling.
Evolution: Add transliteration and licensed identifiers after review.
Approval requirement: Approved.
Phases: 1, 3.
DRD-012 — Exports
Topic: L
Status: Approved
Chosen direction: CSV and versioned JSON at launch; XLSX deferred.
CSV columns
schema_version, exported_at, ranking_id, target_season, scoring_profile, rank, list_state, fhfh_player_id, nhl_player_id, player_name, organization, position, identity_status, yahoo_eligibility, prior_yahoo_adp, adp_state, community_rank, community_confidence, projection_fpts_per_game, tier, notes, watchlisted, updated_at.
JSON
Metadata: schema version, export timestamp, ranking version, target season, scoring snapshot, seed provenance, options.

Arrays: top 250, candidates if requested, watchlist if requested.

Stable IDs and ADP state on every player.

Rank-event summary may be included by option.

Private comparison evidence is excluded by default.

ADP states: Numeric value, previously_undrafted, or unavailable.

Defaults: Top 250 only; user may include candidates and watchlist.

Alternatives: XLSX at launch or name/rank-only files.

Evidence: Existing libraries support CSV/JSON; no XLSX dependency exists; strategy defers XLSX.

Rationale: Stable, portable launch formats without additional spreadsheet complexity.

Consequences: Schema versioning is mandatory.

Evolution: XLSX workbook with metadata, ranking, candidate, and watchlist sheets.

Approval requirement: Approved.

Phases: 7–8.

DRD-013 — Privacy, RLS, abuse, and operations
Topic: M
Status: Approved
Chosen direction: Private owner data, explicitly consented aggregate contribution, and service-only public materialization.
RLS: Owner predicates for rankings, entries, events, sessions, watchlists, prompts, and comparisons; explicit authenticated grants; no raw community-readable user data.
Deletion: Owner rows cascade; current community results rebuild without the user. Qualifying non-identifiable historical aggregate snapshots may remain under the disclosed policy.
Administration: Existing admin-role middleware and service-role conventions; review actions audited.
Rate limits: Distributed/server-safe limits on comparisons, placement, search, exports, and addition requests. Personal functionality remains available when community eligibility is suppressed.
Audit: Ranking events, identity review, repair actions, aggregation runs, and exclusions.
Repair: Dry-run validation, deterministic normalization, orphan checks, duplicate identity checks, canonical-pair validation, and aggregate rebuilds.
Flags: Server-enforced kill switches plus beta entitlement/allowlist; UI flags are not sufficient.
Backfill: Batched, resumable, counted, and idempotent.
Rollback: Disable feature, stop jobs, preserve owner data, and roll back code. Avoid destructive down-migrations after user data exists.
Rollout: Staff, allowlisted beta, broader authenticated beta, then public aggregate.
Alternatives: Public raw comparisons, memory-only limits, immediate universal rollout.
Evidence: Existing owner RLS, user_entitlements, cron audits, and provider sync runs.
Rationale: Fits repository patterns and approved privacy policy.
Consequences: Security-advisor and RPC-grant review are launch gates.
Evolution: Dedicated moderation dashboards and anomaly models.
Approval requirement: Approved.
Phases: 0–7.
