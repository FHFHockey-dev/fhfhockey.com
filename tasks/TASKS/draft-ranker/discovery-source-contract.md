# DR-050 Discovery Source Contract

## Status and authority

Status: Frozen for launch implementation on 2026-07-15.

This contract implements approved decision DRD-010 and is subordinate to [product-strategy.md](./product-strategy.md), [decision-record.md](./decision-record.md), and [technical-contract.md](./technical-contract.md). It is a read-only contract over upstream systems: discovery may materialize derived rows, but it must not repair, rename, overwrite, or silently reinterpret any projection, Yahoo, NHL, roster, contract, deployment, or performance source.

The launch target season is `20262027`. A source that cannot prove its season, observed-at time, identity, or required values is unavailable for that signal. Request-time timestamps never substitute for source timestamps.

## Common freshness and failure contract

Every materialized discovery signal stores:

- target season and signal type;
- FHFH and NHL player IDs;
- algorithm version and exact threshold version;
- source table names and source identifiers;
- source season/date, observed-at timestamp, computed-at timestamp, and expiry;
- structured numeric evidence and a stable reason code;
- a source-health state of `available`, `stale`, `season_mismatch`, `insufficient_sources`, `unmapped`, or `unavailable`.

Only `available` rows whose `expires_at` is in the future may be served. Null, non-finite, zero-as-missing, invalid identity, stale, or season-mismatched inputs fail closed for the affected signal; they never become zero-valued evidence. Refresh is replace-by-run for one target season so deleted, expired, and no-longer-eligible signals disappear deterministically.

The service records per-source row count, mapped-player count, eligible-player count, source date, age, health state, and warning codes. The refresh route reports per-group inserted counts, skipped counts, duration, and failures through the existing cron audit convention.

## Projection consensus

Repository sources:

- Registry: `web/lib/projectionsConfig/projectionSourcesConfig.ts`.
- Scoring defaults: `web/lib/projectionsConfig/fantasyPointsConfig.ts`.
- External source tables currently registered: the ten `PROJECTIONS_20252026_*` tables for Apples & Ginos, Cullen, DFO, DTZ, FHFH, Kubota, and Laidlaw skaters/goalies.
- Identity join: each valid positive `player_id` maps to `players.id`, then to a verified, unmerged `fhfh_player_identities.nhl_player_id`.

Launch computation:

1. A projection source is eligible only when its declared season equals the ranking target season. The season is taken from the versioned source registry, never inferred from row content or the current date.
2. Collapse exact duplicate player IDs within one source deterministically; conflicting duplicates make that source/player unavailable and are counted in source health.
3. Compute each source's standard FHFH fantasy total from the source's mapped stats using the repository defaults (`G=3`, `A=2`, `PPP=1`, `SOG=0.2`, `HIT=0.2`, `BLK=0.25`; goalie `GA=-1`, `SV=0.2`, `SO=3`, `W=4`). A source/player needs at least one finite non-zero-weight stat and positive projected games when a per-game value is used.
4. Rank eligible skaters and goalies together by fantasy points per projected game, then projected total, then NHL player ID. Ties use SQL competition rank followed by stable ID ordering. Each source contributes one rank per player.
5. Consensus rank is the median of source ranks. At least two independent eligible sources are required; source count and source display names are persisted for transparency.
6. A projection source snapshot expires after 72 hours during preseason/regular season and after 14 days during the offseason. A source without a trustworthy observed-at timestamp is unavailable, not perpetually fresh.

Current audit finding: the live registry has `837` distinct projected NHL IDs, `729` with at least two sources, but all registered tables encode `20252026` and have no trustworthy source-level observed-at field. Therefore projection-backed discovery for target `20262027` is correctly unavailable until versioned 2026–27 projection inputs and source timestamps are ingested. The existing source tables remain untouched.

## Yahoo ADP and previously-undrafted state

Repository sources:

- `yahoo_players.season = 2025`, matching the already-approved DR-020 seed contract for target `20262027`.
- Verified mapping through `fhfh_player_external_identities(provider = 'yahoo')`.
- `draft_analysis.preseason_average_pick` when positive numeric, then positive `average_draft_pick` as a labeled fallback.

Rules:

- `prior_adp` is the positive preseason value when present, otherwise the positive scalar fallback.
- `previously_undrafted` means no valid positive value from either field. It does not mean rank 999 and never fabricates ADP.
- Yahoo ADP is a prior-season comparison value, so its season must be the prior start year (`2025`) for target `20262027`; it is not subject to the projection freshness SLA.
- Missing or unresolved Yahoo identity produces unavailable ADP evidence but does not exclude a verified player from the broader canonical universe.

Current audit finding: `yahoo_players.season = 2025` has `1,494` rows, `320` with positive scalar ADP, and a latest row update of `2026-07-14`. The initialization contract already proves at least 250 verified mapped seed candidates without synthetic ADP.

## Personal cutoff context

Repository source: `draft_ranking_entries` ordered by `(order_key, fhfh_player_id)` for the authenticated owner's active `draft_rankings` row.

Rules:

- Personal rank is derived with `row_number()` and never stored as a cutoff boolean.
- Cutoff-challenger eligibility is personal rank `251–275` and an available consensus projection rank at least 25 places better.
- The personal position is joined only in the owner-authenticated discovery API. It is not persisted in shared discovery rows or exposed in public source-health output.
- A concurrent reorder changes the API result immediately; no discovery refresh is required.

## Yahoo ownership movement

Repository sources:

- Primary launch source: `yahoo_players.ownership_timeline` on `season = 2025`, whose points use `{date, value}` and whose parent row exposes `last_updated`.
- Durable historical table `yahoo_player_ownership_daily` is health evidence only until current-season coverage resumes; its live data currently ends `2025-04-17`.
- Identity: verified Yahoo external identity mapping, not name matching.

Rules:

- Select the latest finite ownership point and the closest point at or before seven calendar days earlier.
- Require a baseline between 6 and 10 days before the latest point and no future-dated points.
- Surface a player when the gain is at least five percentage points or is in the top decile among players with valid seven-day baselines. Zero change is valid but not a riser.
- Timeline evidence expires 48 hours after its latest point in season/preseason and seven days during the offseason. A refresh that merely repeats unchanged data does not extend source freshness.
- Persist latest, baseline, delta, dates, eligible-pool size, and top-decile threshold.

Current audit finding: all `1,494` season-2025 timelines contain a valid seven-day baseline and end on `2026-07-14`; the audited seven-day changes are currently flat, so the correct ownership-riser group is empty rather than stale or fabricated.

## Team and opportunity change

Repository sources:

- Current identity/team: `fhfh_player_identities.current_nhl_team_id` and canonical `players.team_id`.
- Verified prior team: latest regular-season `nhl_api_game_roster_spots` row for the immediately previous NHL season.
- Current roster/news event: `forge_roster_events`, restricted to stored event types and confidence.
- Deployment baseline: `player_lineup_deployment_tallies` for the immediately previous NHL season, including line/unit, share, and `last_game_date`.
- Contract evidence: `nhl_player_contracts`, only `resolution_status = 'matched'` with target season inside the contract interval.
- Projection corroboration: available target-season projection consensus as defined above.

Rules:

- A team-change candidate requires a verified current team different from the player's latest prior-season roster team, plus either a target-season projection improvement of at least 25 ranks or a stored current `LINE_CHANGE`, `PP_UNIT_CHANGE`, `CALLUP`, `RETURN`, or goalie-start event with confidence at least `0.75`.
- An opportunity-change candidate without a team change requires a stored event with confidence at least `0.75` plus either a projection improvement of at least 25 ranks or a material deployment delta: top-six/PP1 promotion, projected goalie-starter opportunity, or at least a 0.15 share increase against a stored baseline.
- Contract rows may corroborate team/eligibility but never alone assert a role change. Unmatched contract rows are ignored and counted.
- Event evidence expires at `effective_to` when present, otherwise after seven days; a team change corroborated by fresh target-season projections expires with the projection source.
- The prior-season roster and deployment baselines are historical facts and do not become stale, but they must be season-exact.

Current audit finding: previous-season roster spots cover `1,063` players through `2026-06-14`; deployment tallies cover `940` players through `2026-06-14`; contracts contain `851` target-season-active rows but `5,039` unresolved rows; `forge_roster_events` is empty; and target-season projection inputs are unavailable. Therefore opportunity-change discovery currently fails closed.

## Launch signal definitions

| Signal | Exact threshold | Required sources | Null/stale behavior |
| --- | --- | --- | --- |
| `projection_gap` | At least two sources and consensus rank at least 25 places better than personal rank, or prior ADP when personal rank is absent | Target-season projection consensus plus owner rank or prior Yahoo ADP | Suppress without current projection consensus or comparison rank |
| `previously_undrafted` | No valid prior ADP, at least two sources, consensus rank `<= 300` | Target-season projection consensus plus prior Yahoo ADP state | Suppress when ADP state is unknown or projection consensus unavailable |
| `cutoff_challenger` | Personal rank `251–275`; consensus rank at least 25 better | Target-season projection consensus plus owner rank | Derived per request; suppress on either missing input |
| `ownership_riser` | Seven-day gain `>= 5` percentage points or top-decile positive gain | Fresh Yahoo ownership timeline | Suppress flat, invalid, future, or stale timelines |
| `opportunity_change` | Verified team/event change plus material projection/deployment corroboration | Current identity/team, prior roster/deployment, event or current projection, optional matched contract | Suppress unverified identity, unmatched-only contract, stale event, or absent corroboration |

## Refresh and operations

- Refresh route: admin/cron authenticated and service-role write path only, wrapped in `withCronJobAudit`.
- Default cadence: daily at 09:00 UTC in the offseason, every six hours during preseason, and daily in-season. Do not add the schedule until the derived refresh is proven in dry-run and the feature flag remains off.
- A source-health-only dry run performs all reads and calculations without inserting or deleting derived rows.
- A successful materialization is idempotent for `(target_season_id, source_fingerprint, algorithm_version)` and atomically replaces the current run.
- A partial source failure suppresses only dependent groups and records the degraded state; it does not reuse expired rows.
- Rollback stops the job, disables `DRAFT_RANKER_DISCOVERY_ENABLED`, and clears or drops only rebuildable discovery tables. Upstream sources are never rolled back or changed.

## Deferred source improvements

These are not launch blockers for the ranker itself, but their dependent discovery groups remain unavailable until they exist:

- versioned 2026–27 projection tables or a normalized projection snapshot with trustworthy observed-at metadata;
- normalized projection deltas across snapshots;
- current durable Yahoo ownership snapshots in `yahoo_player_ownership_daily`;
- populated, provenance-backed `forge_roster_events` or normalized line/PP-role history;
- goalie workload history and official/editorial prospect additions;
- news, coach-statement, training-camp, or machine-learning signals.
