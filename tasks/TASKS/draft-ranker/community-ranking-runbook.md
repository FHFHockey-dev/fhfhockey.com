# Community Ranking v1 Runbook

## Status and safety boundary

Community Ranking v1 is implemented through DR-063 and remains dark-launched behind `COMMUNITY_DRAFT_RANKINGS_ENABLED`. The scheduled aggregate refresh exists, but public production exposure is a Phase 7 rollout decision. The personal Draft Ranker and community contribution flags remain independent.

The public surface is aggregate-only. It must never expose account IDs, pseudonymous job keys, raw comparisons, consent history, moderation evidence, or per-user histories. A signed-in request may add only that account's current personal rank and aggregate-to-personal delta.

## Pinned launch model

- Model: `regularized-bradley-terry-v1` in `web/lib/draft-ranker/communityModel.ts`.
- Evidence: the latest eligible preference for each pseudonymous user and canonical player pair.
- Collection eligibility: prompt-issued comparison, active contribution consent, rate eligible, and not actively moderated.
- Direct ranking edits: never community evidence.
- Prior: verified prior-season Yahoo ADP; its weight decays to zero at 20 independent users.
- Previously undrafted players: neutral broad prior, never a synthetic ADP.
- Emerging: at least 5 independent users, 10 comparisons, and 5 distinct opponents.
- Established: at least 20 independent users, 40 comparisons, 10 distinct opponents, and at least 2 cutoff opponents on each side of No. 250.
- Public top-250 admission from community evidence: established evidence and conservative rank at or above the cutoff.
- Market cold start: prior-season Yahoo top 250 remains eligible until a player has established evidence.

These rules are product methodology. Changing them requires the approval checkpoint defined in DRD-009 and DR-060.

## Refresh pipeline

1. `web/lib/draft-ranker/communityServer.ts` loads the verified rankable universe, prior Yahoo ADP, current eligible pair preferences, active consent, and active moderation exclusions.
2. Raw account IDs are transformed with an HMAC and domain separation before model input. They are never persisted in aggregate results.
3. The deterministic model returns scores, evidence states, admission decisions, and a stable source fingerprint.
4. `public.replace_draft_ranker_community_snapshot(...)` writes one immutable run, snapshot, and full aggregate result set atomically.
5. Operation IDs and payload hashes make retries idempotent. Reusing an operation ID with different input is a conflict.
6. `GET /api/v1/db/refresh-draft-ranker-community?scheduled=true` is the Vercel cron entry and requires `CRON_SECRET`. Ordinary GET is dry-run only; an audited admin POST is required for a manual persisted refresh.

Cadence is daily from August 15 through October 15 and weekly otherwise. Weekly scheduled refreshes run on Sunday. A forced manual run must include an operational reason in its audit context.

## Cold-start baseline

The first persisted 2026–27 snapshot was produced on July 15, 2026:

- Snapshot: `2dfdff1e-718c-4fec-946f-fd89f48f2a88`
- Run: `74cfb373-10e2-452c-bcb1-58a9120ae3dd`
- Operation: `c0432992-0a72-41c3-9565-9a82ed6d86b8`
- Candidate universe: 1,148 verified players
- Verified Yahoo market rows displayed: 313
- Public market-seeded ranks: 250
- Previously undrafted candidates: 835
- Eligible community comparisons: 0

This is an honest market-seeded baseline, not community consensus. The UI and API must retain that label until eligible evidence exists.

## Health checks

For every completed refresh verify:

- exactly one completed run and one snapshot for a new operation;
- one aggregate result per distinct candidate and unique model ranks;
- no duplicate non-null public ranks and no public rank outside 1–250;
- snapshot counts equal result-table counts;
- accepted, excluded, and deduplicated counts reconcile with source summaries;
- the model converged and the model version equals the pinned launch version;
- no user-identity fields occur in the public API payload;
- latency, failure, cold-start, and evidence-state counts are present in audit output;
- Supabase security advisors have no target security errors and foreign keys remain indexed.

Alert or stop rollout when a refresh fails, does not converge, changes candidate count unexpectedly, produces public-rank gaps/duplicates, sharply changes admission counts without corresponding evidence, or cannot reconcile consent/deletion exclusions.

## Moderation and exclusion procedure

Only service/admin operations may write `draft_ranker_community_moderation_exclusions`. Every exclusion requires a bounded `reason_code`, actor, scope, evidence reference in metadata, and optional expiry.

Supported scopes are:

- `user`: excludes that account's otherwise eligible comparisons for the target season;
- `comparison`: excludes one immutable comparison;
- `pair`: excludes all evidence for one canonical low/high pair.

Canonicalize pairs so `low_player_id < high_player_id`. Prefer the narrowest scope supported by the evidence. Never automatically merge identities or delete private comparison history as a moderation shortcut.

After adding, expiring, or deactivating an exclusion, run a dry-run refresh, compare source/exclusion summaries and affected ranks, then persist a new snapshot. Keep the prior immutable snapshot for audit and rollback. Deactivating an exclusion requires the same actor/reason discipline as creating it.

## Consent withdrawal and account deletion

Consent withdrawal makes prior comparisons ineligible on the next rebuild without erasing the user's private history. Account deletion cascades owned source rows. In both cases:

1. confirm the source row or account is no longer eligible;
2. run a dry-run refresh and verify accepted counts decrease as expected;
3. persist a replacement snapshot;
4. verify public aggregate output contains no residual contribution effect beyond unrelated users' evidence;
5. record before/after counts and snapshot IDs in the audit trail.

The synthetic DR-063 suite proves model recomputation drops withdrawn evidence rather than carrying forward an event-derived score.

## Abuse calibration and residual risk

`web/lib/draft-ranker/communityRedTeam.test.ts` is the launch calibration gate. It verifies duplicate-flood deduplication, sparse-graph rejection, consent-removal rebuilds, rate-suppressed bursts, both-side cutoff coverage, and moderation removal.

The model cannot determine that multiple otherwise valid accounts are controlled by one actor. Thresholds increase the cost of coordinated manipulation, but account-level burst detection, rate decisions, account-age/support review, operational anomaly monitoring, and moderation remain necessary. A coordinated cohort that is not detected can satisfy the mathematical evidence threshold. This residual blocks an unmonitored broad release; it does not justify publishing account-level data.

## Rollback and kill switches

- Disable `COMMUNITY_DRAFT_RANKINGS_ENABLED` to fail the public API closed without deleting snapshots.
- Remove or pause the Vercel cron entry to stop future refreshes.
- Preserve immutable runs, snapshots, and results for diagnosis.
- Re-enable the prior known-good public flag only after API, integrity, advisor, and calibration checks pass.
- Never roll back by editing a published snapshot in place. Publish a newly audited snapshot from corrected inputs.
- Database rollback is reserved for pre-release schema failure and follows the reviewed DR-061 dependency order; it is not the routine model rollback mechanism.

## Release gate

Broad exposure requires DR-071 health tooling, the DR-072 staged cohorts, the DR-073 end-to-end privacy/rollback drill, and explicit production rollout approval. Market-seeded output may be tested internally, but it must not be described as crowd consensus.
