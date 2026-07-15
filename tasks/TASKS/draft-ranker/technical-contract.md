# DR-003 Draft Ranker Technical Contract

## Status and authority

Status: Frozen for the first implementation pass on 2026-07-14.

This contract translates the approved decisions in [decision-record.md](./decision-record.md) into database, API, ownership, concurrency, and security boundaries. It is subordinate to [product-strategy.md](./product-strategy.md) and [goal-prompt.md](./goal-prompt.md). Any implementation conflict must be resolved in favor of those product authorities and recorded in [progress.md](./progress.md).

## Naming and migration boundaries

- New canonical identities use the `fhfh_player_*` prefix.
- Account-backed draft-ranker tables use the `draft_*` prefix.
- New SQL belongs only in `supabase/migrations/`.
- Migrations are additive and must be generated through `supabase migration new`; filenames are not invented manually.
- Base identity tables are not directly exposed to `anon` or `authenticated`. User-facing identity data is returned through authenticated server APIs and, later, deliberately safe aggregate/public surfaces.
- User-owned tables include a denormalized `user_id uuid` plus composite ownership constraints so RLS does not depend on joining another user-owned table.
- All timestamps are `timestamptz` in UTC.
- All JSON contracts include a schema-version field when persisted or exported.

## Identity schema contract

### `fhfh_player_identities`

Purpose: stable FHFH identity independent of NHL, Yahoo, team, and projection-source identifiers.

Required columns:

- `id bigint generated always as identity primary key`
- `nhl_player_id bigint null unique references players(id) on update restrict on delete restrict`
- `canonical_name text not null`
- `first_name text null`
- `last_name text null`
- `birth_date date null`
- `canonical_position public."NHL_Position_Code" null`
- `current_nhl_team_id smallint null references teams(id) on update restrict on delete set null`
- `current_organization_name text null`
- `current_organization_type text not null`
- `lifecycle_status text not null`
- `verification_status text not null`
- `headshot_url text null`
- `merged_into_id bigint null references fhfh_player_identities(id) on delete restrict`
- `source_provenance jsonb not null default '{}'::jsonb`
- `verified_at timestamptz null`
- `verified_by uuid null references auth.users(id) on delete set null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Allowed organization types:

`nhl`, `ahl`, `echl`, `chl`, `ncaa`, `europe`, `international`, `unsigned`, `other`, `unknown`.

Allowed lifecycle statuses:

`active_nhl`, `active_prospect`, `unsigned_relevant`, `inactive`, `retired`, `overseas`, `deceased`, `review_required`.

Allowed verification statuses:

`verified`, `provisional`, `review_required`, `rejected`, `merged`.

Constraints:

- `canonical_name` is nonblank after trimming.
- `merged_into_id` is required exactly when `verification_status = 'merged'` and cannot equal `id`.
- A verified rankable identity must not be merged or rejected.
- Names, teams, positions, and headshots are mutable metadata; they never define identity uniqueness.

Indexes:

- Unique partial index on `nhl_player_id where nhl_player_id is not null`.
- B-tree indexes on verification/lifecycle status, NHL team, and lower canonical name.
- Trigram/unaccent search indexes are added only after the live immutable-unaccent function and search plan are verified under DR-030.

### `fhfh_player_external_identities`

Purpose: provider- and context-aware external identifiers.

Required columns:

- `id uuid primary key default gen_random_uuid()`
- `fhfh_player_id bigint not null references fhfh_player_identities(id) on delete cascade`
- `provider text not null`
- `external_player_id text not null`
- `context_key text not null default 'global'`
- `season_id bigint null references seasons(id) on delete restrict`
- `is_primary boolean not null default false`
- `match_method text not null`
- `match_confidence numeric(5,4) null`
- `verification_status text not null`
- `source_provenance jsonb not null default '{}'::jsonb`
- `verified_at timestamptz null`
- `verified_by uuid null references auth.users(id) on delete set null`
- `created_at`, `updated_at`

Constraints and uniqueness:

- Unique `(provider, context_key, external_player_id)` prevents one external identity from mapping to multiple FHFH players in the same context.
- Unique `(fhfh_player_id, provider, context_key, external_player_id)` prevents duplicates on rerun.
- Confidence is between zero and one when present.
- `verified`, `review_required`, `rejected`, and `superseded` are the mapping statuses.
- Automatic mapping may create `review_required`; only deterministic NHL-ID equality or explicit review may create `verified`.

Provider examples:

- `nhl`
- `yahoo`
- `projection:ag`
- `projection:cullen`
- `projection:dom`
- `contract:nhlscraper`
- Future providers use new values without altering the canonical player ID.

### `fhfh_player_identity_aliases`

Purpose: searchable alternate names with provenance, without making aliases identities.

Key fields: FHFH player ID, alias, normalized alias, language/source, verification status, provenance, timestamps. A unique normalized alias is not required because duplicate human names are valid.

### `fhfh_player_organization_history`

Purpose: mutable team/development-club history without identity churn.

Key fields: FHFH player ID, optional NHL team ID, organization name/type, effective dates, source, confidence, current flag, timestamps. At most one open current record exists per player/source context.

### `fhfh_player_identity_review_queue`

Purpose: unresolved mappings and player-addition requests.

Key fields: UUID ID, review type, submitted raw identity context, candidate FHFH IDs, source/evidence JSON, status, resolution, reviewer, timestamps. This table is admin/service-only.

## Rankability contract

An identity is rankable at launch when all are true:

1. `verification_status = 'verified'`.
2. It is not merged or rejected.
3. Lifecycle is `active_nhl`, `active_prospect`, or `unsigned_relevant`; an existing user may retain an identity later marked inactive, but it is excluded from default new discovery and active export.
4. The identity came from an existing verified NHL record, a verified external mapping, or explicit FHFH editorial review.

Arbitrary free text can create only a review request, never an identity or ranking entry.

## Ranking ownership schema contract

### `draft_rankings`

Purpose: one versioned personal ranking set.

Key fields:

- UUID ID and `user_id uuid references auth.users(id) on delete cascade`.
- `target_season_id bigint references seasons(id)`; launch target is `20262027`.
- Name, status, `is_default`, scoring-profile JSON snapshot, optional external league/team context, schema version, seed revision, `lock_version bigint default 0`, and timestamps.
- Unique `(id, user_id)` supports composite child ownership.
- One active default per `(user_id, target_season_id)` through a partial unique index.

### `draft_ranking_entries`

Purpose: persisted continuous order covering top 250 and candidates.

Key fields:

- `ranking_id`, `user_id`, `fhfh_player_id`, and `order_key bigint`.
- Seed source, seed ADP, seed rank, optional tier/notes, first/last interaction timestamps, created/updated timestamps.
- Primary key `(ranking_id, fhfh_player_id)`.
- Unique `(ranking_id, order_key)`.
- Composite FK `(ranking_id, user_id)` to `draft_rankings`.

Top-250 membership is derived with `row_number() over (partition by ranking_id order by order_key, fhfh_player_id)`. It is never stored as a mutable boolean.

### `draft_ranking_events`

Purpose: immutable audit/evidence history.

Key fields: UUID ID, ranking/user/player, event type, source, operation ID, expected/resulting versions, before/after neighbor/rank JSON, metadata, created timestamp.

- Unique `(ranking_id, operation_id)` makes retries idempotent.
- Authenticated users may select and insert their own events only through approved RPC/API paths.
- No authenticated update or delete policy exists.

### `draft_ranking_seed_runs`

Purpose: idempotent initialization and provenance.

Unique `(ranking_id, seed_revision)`. Store source season, source counts, invalid/unmapped counts, fallback counts, status, and result/error summary.

### `draft_ranking_watchlist`

Purpose: owner monitoring state independent of ranking placement.

Unique `(ranking_id, fhfh_player_id)`, with user ID, priority, note, source/reason, timestamps.

## Pairwise and placement schema contract

### `draft_ranker_contribution_preferences`

One row per user. Stores explicit contribution opt-in, privacy-policy version, consent timestamps, revocation timestamp, and update source. Default is false.

### `draft_ranker_pair_prompts`

Server-issued prompt with user/ranking/season, canonical low/high player IDs, queue mode/reason, algorithm version, issue/expiry timestamps, and completion state. Prompt IDs are unguessable UUIDs.

### `draft_ranker_pair_comparisons`

Immutable submissions with prompt ID, user/ranking/season, canonical pair, outcome (`low`, `high`, `too_close`, `skip`), client operation ID, consent-policy snapshot, community-eligibility decision/reason, ranking-version context, and timestamp.

- Unique `(user_id, client_operation_id)` prevents duplicate retries.
- Pair order always satisfies `low_player_id < high_player_id`.
- `skip` and `too_close` never create a preference or community win.

### `draft_ranker_pair_preferences`

Materialized latest explicit personal preference per `(user_id, ranking_id, season_id, low_player_id, high_player_id)`. It points to the comparison that established it. A reversal replaces this materialized row but never deletes comparison history.

### `draft_ranker_placement_sessions`

Stores owner/ranking/player, status, initial rough range, current interval, plausible range, question count, contradiction count, ranking version, issued anchors/answers JSON, expiry, and timestamps. At most one active session exists per ranking/player.

## Yahoo initialization contract

For target season `20262027`, prior Yahoo season `2025` is used.

Candidate selection:

1. Use only `yahoo_players.season = 2025` rows mapped through a verified FHFH external identity.
2. Parse `draft_analysis.preseason_average_pick` only when it is a positive numeric value.
3. When verified preseason ADP is absent, a positive `average_draft_pick` may be used as the transparent fallback `yahoo_prior_average_pick_fallback` so the required top 250 can be initialized.
4. Zero, null, `"-"`, non-numeric, and non-positive values are not ADP.
5. Seed value is the positive preseason value when available, otherwise the positive fallback value.
6. Sort by seed value ascending, then preseason-source before fallback on an exact tie, then stable FHFH player ID.
7. Persist every valid mapped candidate in this order, not only 250. The visible cutoff is derived.
8. If fewer than 250 verified mapped candidates remain, initialization fails closed with an operator-visible data-quality error; it must not invent projection or editorial ADP.

Current evidence shows 240 mapped positive preseason values and 315 mapped positive scalar values, so the approved fallback can produce a complete top 250 without synthetic ADP.

Initialization is one atomic operation per ranking and seed revision. A retry returns the existing completed result. A failed seed run may be retried after the failure is recorded and the underlying mapping issue is corrected.

## Ordering and transaction contract

- Initial keys use a fixed sparse stride of `1,048,576`.
- The authoritative order is `order_key, fhfh_player_id`.
- A normal move locks the ranking row `for update`, verifies `expected_lock_version`, computes a midpoint key, updates one entry, increments `lock_version`, and appends one event in the same transaction.
- At the list ends, use adjacent key plus/minus the stride with overflow checks.
- If two neighboring keys have no integer gap, normalize the ranking transactionally to stride-spaced keys, append a normalization event, then perform the requested move.
- Stale expected versions fail with a stable conflict code. There is no silent last-write-wins.
- Rank 250/251 displacement is a consequence of order; no special membership writes occur.

## RPC privilege contract

- Prefer `SECURITY INVOKER` for all user-callable ranker functions.
- Every function receives ownership from `auth.uid()`; it never accepts a trusted client-supplied owner ID.
- Revoke function execution from `PUBLIC` and `anon`; grant only the exact signature to `authenticated`.
- Set an explicit safe search path on every function, even invoker functions.
- Any future `SECURITY DEFINER` function requires a separate security review, a non-exposed schema where practical, a fixed empty/safe search path, explicit owner checks, revoked default execution, and advisor verification.
- Service-role-only maintenance functions receive no `anon` or `authenticated` execute grant.

## RLS and grant matrix

### Identity and review tables

- Enable RLS.
- Revoke all from `anon` and `authenticated` at launch.
- Service role/admin server routes own mutations and safe reads.
- No raw provenance or review evidence is public.

### User-owned ranking tables

- Grant only required table privileges to `authenticated`.
- Every SELECT policy uses `to authenticated using ((select auth.uid()) = user_id)`.
- INSERT uses `with check` on the same predicate.
- UPDATE uses both `using` and `with check`.
- DELETE is allowed only where the product explicitly supports deletion; immutable event/comparison tables have no authenticated delete policy.
- Index every `user_id` used by policy and every composite ownership FK.

### Community/public tables

- Not created in the foundation migration.
- Later aggregate tables contain no user ID.
- Public views use `security_invoker = true` or remain API-only.
- Raw comparisons and user-level histories are never granted to `anon`.

## API surface contract

All ranker routes live under `/api/v1/draft-ranker/` and use `requireApiUser`.

Launch route families:

- `GET /api/v1/draft-ranker` — current default ranking bootstrap/state.
- `POST /api/v1/draft-ranker/initialize` — idempotent seed.
- `POST /api/v1/draft-ranker/reorder` — move-to-rank or insert relative to a player.
- `GET /api/v1/draft-ranker/search` — canonical identity search.
- `POST /api/v1/draft-ranker/player-requests` — request identity review.
- `/watchlist` — owner list/add/update/remove.
- `/placement` — begin/read/answer/confirm/cancel persisted placement.
- `/pairwise/queue` and `/pairwise/respond` — issued prompts and idempotent responses.
- `/exports/csv` and `/exports/json` — owner-only versioned exports.

The page never sends or trusts `user_id`. It sends ranking IDs, operation IDs, expected versions, and bounded action payloads.

## Request and response contract

Successful JSON response:

```json
{
  "data": {},
  "requestId": "uuid-or-platform-request-id"
}
```

Error response:

```json
{
  "error": {
    "code": "stable_machine_code",
    "message": "Safe user-facing message",
    "requestId": "uuid-or-platform-request-id",
    "details": {}
  }
}
```

Status rules:

- `400`: malformed or semantically invalid request.
- `401`: missing/expired authentication.
- `403`: authenticated but action disallowed.
- `404`: owner-scoped resource absent; do not reveal another user's resource.
- `409`: idempotency conflict, stale ranking version, or active-placement conflict.
- `422`: valid request cannot satisfy identity/seed/placement invariants.
- `429`: rate limit with `Retry-After`.
- `500`: unexpected internal failure with redacted details.

Mutation requests use a UUID `operationId` in the body. The server rejects reuse with a different payload and returns the original successful result for an identical retry where supported.

## Concurrency contract

- Ranking mutations require `expectedVersion`.
- The database ranking row is locked before reading neighbors.
- The returned payload includes the resulting version and affected visible ranks.
- On 409, the client invalidates the TanStack Query cache, reloads, and offers deliberate reapply. It does not automatically replay a move against changed neighbors.
- Placement confirmation may automatically revalidate at most two anchors after a version change, as approved in DRD-006.

## Deletion and retention contract

- Deleting an auth user cascades rankings, entries, watchlists, sessions, prompts, comparisons, preferences, and consent rows.
- Current community aggregates are rebuilt without deleted or opted-out users.
- Qualifying anonymous historical aggregate snapshots may remain only under the approved disclosed privacy policy and never contain user IDs.
- Deleting/unplacing one player from a ranking never deletes immutable event or comparison evidence. “Remove from top 250” moves the player below the cutoff.
- Identity merges/supersession preserve old external mapping and review history; they do not hard-delete historical player references.

## Feature-flag contract

- `DRAFT_RANKER_ENABLED` is a server-enforced kill switch and defaults false until rollout.
- `DRAFT_RANKER_HOMEPAGE_ENABLED`, `DRAFT_RANKER_DISCOVERY_ENABLED`, and `COMMUNITY_DRAFT_RANKINGS_ENABLED` are independent later switches.
- Beta access may additionally require a `user_entitlements` key such as `draft_ranker_beta`.
- Client rendering flags never substitute for API authorization or server kill switches.

## Threat model and required mitigations

| Threat | Required mitigation |
| --- | --- |
| Cross-user object access | RLS, composite ownership FKs, `requireApiUser`, no trusted client user ID, 404 owner-scoped responses. |
| Service-role leakage | Service client stays server-only; no `NEXT_PUBLIC_` secret; no service key in logs or responses. |
| Public privileged RPC | Invoker functions, revoke `PUBLIC`/`anon`, exact authenticated grants, fixed search path, advisor checks. |
| Arbitrary/fake player creation | Search only verified canonical IDs; free text creates review requests only. |
| Duplicate/same-name merge | Stable IDs, birth/position/org evidence, ambiguous matches remain review-required. |
| Race and lost update | Ranking row lock, expected version, atomic event write, 409 conflict. |
| Retry/replay duplication | UUID operation IDs, unique constraints, payload consistency checks. |
| Community vote fabrication | Only current explicit prompt-issued preferences with active consent; direct movement/displacement excluded. |
| Bot/coordinated manipulation | Distributed limits, one user/pair preference, prompt expiry, burst/opponent-diversity checks, moderation exclusion. |
| Private behavioral disclosure | Raw comparisons owner/service-only; aggregate thresholds; no public user IDs. |
| Unsafe identity provenance exposure | Base identity/review tables API-only and service/admin-read at launch. |
| Migration drift | Compare live ledger/schema immediately before apply; do not infer apply state from filenames. |

## Required verification matrix

Before foundation rollout:

1. Migration applies from a production-equivalent baseline and re-runs safely where intended.
2. Existing NHL player/roster APIs remain unchanged.
3. A verified prospect without NHL/Yahoo ID can exist.
4. Duplicate names can coexist and remain distinguishable.
5. `anon` cannot read or mutate identity/review/owner tables or execute ranker functions.
6. User A cannot select, insert, update, delete, reorder, watch, compare, or resume User B's data.
7. UPDATE policies have matching SELECT plus `USING`/`WITH CHECK` coverage.
8. Immutable events/comparisons cannot be edited or deleted by authenticated users.
9. Reused operation IDs do not duplicate state.
10. Concurrent ranking versions yield one success and one controlled conflict.
11. Account deletion cascades owner data and schedules/requires aggregate rebuild.
12. Supabase advisors show no new ranker security/performance findings.
13. Generated TypeScript types compile without overwriting unrelated changes.
14. Feature-off APIs fail closed and UI surfaces remain absent.

## DR-003 completion decision

The schema, API, RLS, RPC, idempotency, error, deletion, observability, and rollback boundaries are sufficiently concrete to draft the additive DR-010 identity migration. No live migration may be applied until that migration is presented at the recorded approval checkpoint.

