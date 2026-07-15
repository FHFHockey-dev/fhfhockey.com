# Draft Ranker Launch and Operations Runbook

## Current state

The personal Draft Ranker, homepage pairwise module, explainable discovery, contribution collection, and public Community Ranking are independently kill-switched. Implementation and production schema do not imply production exposure. The approved rollout order is staff, allowlisted beta, wider authenticated beta, then the public aggregate.

The daily health job runs at 12:45 UTC through `/api/v1/db/draft-ranker-health` and writes the repository-standard cron audit. Community refresh runs separately at 12:15 UTC and applies daily/weekly cadence rules.

## Flags and entitlements

| Control | Purpose | Safe default |
| --- | --- | --- |
| `DRAFT_RANKER_ENABLED` | Master personal-ranker API/UI switch | Off |
| `DRAFT_RANKER_ROLLOUT_STAGE` | `off`, `staff`, `allowlist`, or `authenticated` | `off` in deployed environments |
| `DRAFT_RANKER_STAFF_USER_IDS` | Comma-separated exact account UUIDs for staff | Empty |
| `DRAFT_RANKER_BETA_USER_IDS` | Comma-separated exact account UUIDs added at allowlist stage | Empty |
| `DRAFT_RANKER_HOMEPAGE_ENABLED` | Homepage pairwise slot | Off |
| `DRAFT_RANKER_COMMUNITY_CONTRIBUTION_ENABLED` | Opted-in evidence eligibility | Off |
| `DRAFT_RANKER_DISCOVERY_ENABLED` | Explainable discovery cards | Off |
| `COMMUNITY_DRAFT_RANKINGS_ENABLED` | Aggregate public read API/page | Off |

The master flag is checked before authentication. After authentication, every personal-ranker API enforces the rollout stage server-side. Invalid rollout-stage values fail closed. Staff IDs are eligible in both staff and allowlist stages; beta IDs are eligible only in allowlist; authenticated admits any signed-in account. The public aggregate remains a separate signed-out-safe decision.

Never place allowlist IDs in a public environment variable or client bundle. Changing a deployed flag or allowlist requires an operator record and rollback owner.

## Cohort gates

### 1. Staff

Enable the master flag with rollout stage `staff`. Keep all secondary flags off initially, then enable discovery, homepage, and contribution one at a time.

Required evidence before allowlist expansion:

- at least five distinct staff accounts or 50 complete account journeys;
- zero cross-owner reads/writes and zero raw-comparison exposure;
- zero ordering corruption, unresolved deletion residue, or non-idempotent retries;
- less than 1% unexpected 5xx responses across ranker routes;
- p95 read latency below 750 ms and mutation latency below 1,500 ms under normal load;
- all daily health reports non-blocked and every warning understood;
- successful flag-disable and account-deletion drills.

### 2. Allowlisted beta

Set stage `allowlist` and add exact approved account UUIDs. Do not accept email addresses or display names as entitlement keys.

Required evidence before authenticated expansion:

- at least 25 distinct beta accounts, 500 successful mutations, and seven observed days;
- no privacy/security incident and no unresolved blocker-level health report;
- retry/conflict behavior produces no lost or duplicated ranking changes;
- support issues are classified and under 5% of active beta accounts;
- pairwise hard-limit and community-suppression rates are explainable;
- community output remains evidence-labeled and undrafted admission tests remain green.

### 3. Wider authenticated beta

Set stage `authenticated`. Retain the master and every secondary kill switch.

Required evidence before public aggregate exposure:

- at least 100 distinct accounts, 2,500 successful mutations, and 14 observed days;
- no cross-account data finding in logs or deletion drills;
- no unresolved model manipulation or identity-quality incident;
- refreshes, exports, and normalization remain within operational budgets;
- browser, mobile, keyboard, screen-reader, and reduced-motion checks pass;
- product owner approves the public aggregate wording and cold-start state.

### 4. Public aggregate

Enable `COMMUNITY_DRAFT_RANKINGS_ENABLED` independently. A market-seeded snapshot may be public only when it is explicitly described as prior Yahoo market data, never community consensus. Contribution collection can remain off even when aggregate reads are on.

## Daily health interpretation

- `healthy`: no actionable ranking, identity, placement, seed, or refresh condition.
- `attention`: a recoverable or explicitly quarantined condition exists. Review counts and samples before expansion.
- `blocked`: unsafe ordering keys or another integrity condition blocks cohort growth.

The report contains aggregate counts, ranking IDs needed for repair, at most 100 candidate player IDs for editorial review, current flag state, latest discovery/community runs, and no user IDs.

The ten Yahoo identity reviews intentionally left pending during DR-011 are expected quarantine, but keep the report at attention until editorial disposition.

## Repair controls

Admin endpoint: `/api/v1/db/draft-ranker-health`.

- GET: read-only aggregate health report.
- `normalize_ordering`: requires ranking ID, current version, UUID operation ID, reason, and exact `NORMALIZE_ORDERING` confirmation. The service-only transaction locks the board, writes deterministic `row_number * 1024` keys, increments the version only when needed, and records before/after state in the immutable event log.
- `queue_identity_review`: requires a verified existing player ID, reason, UUID operation ID, and exact `QUEUE_IDENTITY_REVIEW` confirmation. It opens or reuses an editorial identity-conflict item. It never creates, merges, archives, or remaps a player.
- `rebuild_community_snapshot`: defaults to dry run and requires exact `REBUILD_COMMUNITY` confirmation. A persisted run writes a new immutable snapshot; it never edits the prior snapshot.

Take an export or database backup before a confirmed ordering repair on a real account. Compare entry count, first/last player, and version before and after. Do not repair a stale version; reload and re-diagnose.

## Privacy and deletion drill

For a disposable approved account:

1. initialize and edit a real board;
2. create watchlist, placement, prompt, comparison, consent, export, and rate-event records;
3. withdraw contribution consent and rebuild the aggregate dry run;
4. delete the account through the supported Auth path;
5. verify zero rows remain in account-owned ranker tables and Auth;
6. rebuild the aggregate and confirm accepted evidence drops;
7. verify the public API contains no user IDs, pseudonymous keys, or private histories.

Snapshots remain immutable audit artifacts, but rebuilt aggregate results must no longer reflect deleted or opted-out evidence.

## Rollback

1. Disable the affected secondary flag; disable `DRAFT_RANKER_ENABLED` for a personal-data or integrity incident.
2. Set rollout stage `off` and clear both allowlists.
3. Pause the health/community cron entries only if the job itself is unsafe; ordinary read failure is not a reason to delete data.
4. Preserve ranking events, rate decisions, refresh runs, snapshots, and the last known-good export.
5. Diagnose with the read-only health report and a dry-run community rebuild.
6. Repair only with exact confirmation, current versions, reason, backup, and audited operation IDs.
7. Re-enable one cohort/flag at a time after targeted tests and advisor review.

Database migrations are additive. Routine rollback is flag/job disablement, not destructive down-migration. Dropping the DR-071 function is safe only after callers are disabled; dropping ownership or snapshot tables is outside routine rollback and requires a separately approved destructive plan.

## Production approval checklist

- [x] Focused Draft Ranker suites and full feasible repository checks pass.
- [x] Live migration ledger matches local versions.
- [x] Supabase function privileges, RLS, advisors, and foreign-key indexes pass.
- [x] Account journey, export, opt-out, deletion, and rollback drills pass.
- [x] Desktop/mobile visual and accessibility verification passes in a browser-capable environment.
- [x] Community red-team calibration passes and residual coordinated-account risk is accepted.
- [x] Current health report is reviewed; every attention item is documented.
- [x] The paths in [release-manifest.md](./release-manifest.md) have been assembled from a clean current remote base into a reviewed READY production deployment that serves the feature routes with every rollout flag off.
- [ ] Named operator, support owner, rollback owner, cohort IDs, and observation window are recorded.
- [x] Product owner explicitly approves the production cohort expansion.

Local release evidence on 2026-07-15: 228/228 focused Draft Ranker tests, 18/18 affected WIGO regressions, full TypeScript, and the production build pass. The Community Ranking and authenticated board/export surfaces pass desktop and iPhone 14 Pro Max (430×932) inspection. The mobile document has no page-level horizontal overflow; its wide ranking table remains intentionally and independently scrollable. Two disposable account journeys ended with zero Auth or account-owned residue. Product-owner approval for staff-stage production expansion is recorded.

A read-only Vercel preflight on 2026-07-15 found that the READY production deployment predates Draft Ranker and the live `/draft-rankings` route returns 404. [release-manifest.md](./release-manifest.md) classifies every dirty path and records a clean isolated assembly from current remote base `5743b6d808ff4cd9dd0cb01fef13863ac95f9f6d`: 102 included paths, zero conflicts/collisions, 228/228 Draft Ranker tests, 54/54 broader WIGO tests, passing TypeScript, and a complete 83-page production build.

The scoped product commit `c78059b6de6671a0e594afe1e60d5e42421b5db4` was published in PR [#335](https://github.com/FHFHockey-dev/fhfhockey.com/pull/335), approved by the product owner, and merged as `722f1dff02b7a4b9486836b386c0b576f57c5cfd`. Vercel production deployment `dpl_2jLGmBmqwYjXiJJVuLjUMYJLrz4D` is READY from that exact merge SHA. Both feature routes return HTTP 200, both checked APIs fail closed with HTTP 503 `draft_ranker_disabled`, homepage props keep the module disabled, rendered homepage inspection finds no Draft Ranker exposure, and the production error/fatal log audit is empty. The previous production deployment `dpl_HgjrBeCQVzDTsgryafBLzmXqGyjH` is retained for rollback. All rollout keys remain absent/fail-closed. Staff exposure remains prohibited until the unchecked named-owner, exact cohort UUID, and observation-window item is complete.
