# Draft Ranker Release Manifest

## Purpose

This manifest defines the reviewed change boundary for DR-072. It exists to assemble a clean Draft Ranker release without committing or deploying unrelated work from the shared dirty workspace.

Recorded 2026-07-15:

- local branch: `octoberBranch`
- local base commit: `5743b6d808ff4cd9dd0cb01fef13863ac95f9f6d`
- approved merge commit: `722f1dff02b7a4b9486836b386c0b576f57c5cfd`
- current READY production deployment: `dpl_2jLGmBmqwYjXiJJVuLjUMYJLrz4D`
- current production base commit: `722f1dff02b7a4b9486836b386c0b576f57c5cfd`
- retained production rollback deployment: `dpl_HgjrBeCQVzDTsgryafBLzmXqGyjH`

The isolated release assembly began from the then-matching local/remote cleanup commit `5743b6d808ff4cd9dd0cb01fef13863ac95f9f6d`, which intentionally contains generated-artifact cleanup. PR #335 later advanced the remote branch to the approved merge commit recorded above without changing the source worktree's unrelated local state. Any later release workspace must begin from its then-current reviewed remote commit and rerun this manifest's classification and verification checks.

## Included release scope

The following current-workspace changes are part of the Draft Ranker release. The rules are intentionally narrow and collectively classified 102 dirty paths on 2026-07-15, including this manifest, with zero unclassified paths.

- `supabase/migrations/20260715050418_add_draft_ranker_pairwise_rate_controls.sql` is deleted and replaced by the live-ledger-aligned `20260715051533` version.
- `supabase/migrations/20260715051533_add_draft_ranker_pairwise_rate_controls.sql`
- `supabase/migrations/20260715055259_create_draft_ranker_discovery_materialization.sql`
- `supabase/migrations/20260715055404_add_draft_ranker_discovery_foreign_key_indexes.sql`
- `supabase/migrations/20260715061931_create_draft_ranker_community_snapshots.sql`
- `supabase/migrations/20260715062048_add_draft_ranker_community_foreign_key_indexes.sql`
- `supabase/migrations/20260715070405_add_draft_ranker_ordering_repair.sql`
- all changed or added files under `tasks/TASKS/draft-ranker/`
- all changed or added files under `web/__tests__/pages/api/v1/draft-ranker/`
- `web/__tests__/pages/api/v1/db/draft-ranker-health.test.ts`
- all changed or added files under `web/components/DraftRanker/`
- `web/components/Layout/Header/Header.module.scss`
- `web/hooks/useCommunityDraftRankings.ts`
- `web/hooks/useDraftDiscovery.ts`
- `web/hooks/useDraftPlayerActions.ts`
- `web/hooks/useDraftRanking.ts`
- all changed or added files under `web/lib/draft-ranker/`
- `web/lib/supabase/database-generated.types.ts`
- `web/lib/supabase/fhfhDraftRankerCommunityMigration.test.ts`
- `web/lib/supabase/fhfhDraftRankerDiscoveryMigration.test.ts`
- `web/lib/supabase/fhfhDraftRankerRateControlsMigration.test.ts`
- `web/lib/supabase/fhfhDraftRankerRepairMigration.test.ts`
- all changed or added files under `web/pages/api/v1/draft-ranker/`
- `web/pages/api/v1/db/draft-ranker-health.ts`
- `web/pages/api/v1/db/refresh-draft-ranker-community.ts`
- `web/pages/api/v1/db/refresh-draft-ranker-discovery.ts`
- `web/pages/community-draft-rankings.tsx`
- `web/vercel.json`

The following three changes are release prerequisites rather than Draft Ranker product behavior. They resolve repository-wide generated-type failures that otherwise prevent the reviewed artifact from building:

- `web/components/PlayerStats/PlayerRadarChart.tsx`
- `web/pages/api/v1/db/update-wgo-skaters.ts`
- `web/utils/fetchWigoPlayerStats.ts`

Each prerequisite must be reviewed as its own hunk and kept only while the clean release build proves it is necessary.

## Explicitly excluded workspace changes

These paths are not part of DR-072 and must not be staged, copied, committed, or deployed with its release:

- `.gitignore`
- `tasks/TASKS/dead-code-cleanup/**`
- `tasks/TASKS/super-goal/**`
- `web/lib/supabase/Upserts/Yahoo/__pycache__/**`
- `web/test-results/**`

Any new dirty path that does not match the included or excluded rules blocks assembly until it is classified explicitly. No wildcard may be widened merely to make an unclassified path disappear.

## Clean assembly procedure

1. Start from a clean checkout of the current reviewed `origin/octoberBranch` commit. Record its SHA.
2. Transfer only the included paths and the explicit deletion from this manifest. Never copy the repository root or the entire dirty worktree.
3. Resolve conflicts against the current remote branch one file at a time. Preserve unrelated remote changes.
4. Confirm the migration filenames exactly match the live Supabase migration ledger. Never reapply a live migration under a second timestamp.
5. Inspect `git status --short` and the staged diff. Every path must be explained by this manifest.
6. Run the verification gate below from `web/`.
7. Create a reviewable commit whose message references DR-072. Do not include credentials, local Supabase link state, test artifacts, or environment files.
8. Obtain a READY preview deployment with all Draft Ranker flags off. Complete the closed-state smoke test before promotion.
9. Promote the exact verified artifact to production. Record deployment ID, commit SHA, operator, time, and the retained rollback deployment before staff exposure.

## Verification gate

Run from the repository root unless noted:

```sh
git diff --check
cd web
npx vitest run --pool=forks --maxWorkers=1 --minWorkers=1 $(
  rg --files |
    rg '(^__tests__/pages/api/v1/draft-ranker/|^__tests__/pages/api/v1/db/draft-ranker-health\.test\.ts$|^components/DraftRanker/.*\.test\.tsx$|^components/HomePage/HomepageDraftRanker\.test\.tsx$|^lib/draft-ranker/.*\.test\.ts$|^lib/supabase/fhfhDraftRanker.*Migration\.test\.ts$)'
)
npx vitest run --pool=forks --maxWorkers=1 --minWorkers=1 $(
  rg --files |
    rg '(Wigo|WIGO|wigo|wgo).*test\.(ts|tsx)$'
)
npx tsc --noEmit
npm run build
```

The first command currently resolves to exactly 49 focused Draft Ranker test files; the second deliberately runs the broader current ten-file WIGO regression set. Record the resolved file counts and results with the release commit. On 2026-07-15 the commands passed 228/228 focused Draft Ranker tests and 54/54 broader WIGO tests. The repository TypeScript check and full production build also pass.

## Flag-off deployment contract

The artifact must first deploy with these server values:

```text
DRAFT_RANKER_ENABLED=false
DRAFT_RANKER_ROLLOUT_STAGE=off
DRAFT_RANKER_STAFF_USER_IDS=
DRAFT_RANKER_BETA_USER_IDS=
DRAFT_RANKER_HOMEPAGE_ENABLED=false
DRAFT_RANKER_DISCOVERY_ENABLED=false
DRAFT_RANKER_COMMUNITY_CONTRIBUTION_ENABLED=false
COMMUNITY_DRAFT_RANKINGS_ENABLED=false
```

Do not place cohort UUIDs in client-visible variables or source control. Pairwise rate variables may remain absent to use reviewed server defaults.

The server contract treats missing or invalid rollout keys as the same fail-closed state shown above. Production inspection before promotion found all eight Draft Ranker rollout keys absent, including both cohort lists, so no configuration mutation was needed and no user was eligible. Explicitly setting the listed values remains equivalent.

## Closed-state production smoke test

Before entering a staff UUID or changing the rollout stage:

- `/draft-rankings` returns the real route rather than 404.
- `/community-draft-rankings` returns the real route rather than 404.
- `GET /api/v1/draft-ranker` returns HTTP 503 with code `draft_ranker_disabled`.
- `GET /api/v1/draft-ranker/community` returns HTTP 503 with code `draft_ranker_disabled`.
- the homepage does not render the pairwise module.
- no anonymous or authenticated account can mutate Draft Ranker state.
- the health endpoint is available only through its existing server/admin authorization contract and exposes no account UUIDs.
- production logs show no new Draft Ranker 5xx cluster after the smoke requests.

Record the exact deployment ID and smoke-test evidence in [progress.md](./progress.md) before checking the READY-deployment item in [launch-runbook.md](./launch-runbook.md).

## Current production evidence

PR [#335](https://github.com/FHFHockey-dev/fhfhockey.com/pull/335) was approved by the product owner and merged as `722f1dff02b7a4b9486836b386c0b576f57c5cfd`. Its tree exactly matches the approved PR-head tree `21c199f1f00dce7d856fd92fd5bdcffc0d8c6580`. READY preview `dpl_5wzgM43KU7Re4FTZZ8GgHhDQYRmw` was promoted through Vercel into production deployment `dpl_2jLGmBmqwYjXiJJVuLjUMYJLrz4D`, which records `action: promote`, the original preview ID, and the verified merge SHA. Vercel marked it READY at `2026-07-15T15:19:26.084Z` and assigned `fhfhockey.com`, `www.fhfhockey.com`, and `fhfhockey.vercel.app` without alias error.

The flag-off production smoke then passed: both feature routes returned HTTP 200; both checked APIs returned HTTP 503 with code `draft_ranker_disabled`; homepage server props reported `draftRankerHomepageEnabled: false`; a rendered browser check found zero Draft Ranker text on the homepage and displayed the real account-backed signed-out page; and deployment-scoped error/fatal logs plus grouped runtime errors were empty. The prior READY production deployment `dpl_HgjrBeCQVzDTsgryafBLzmXqGyjH` remains the retained rollback candidate. No rollout key, cohort UUID, secondary feature flag, or public aggregate flag was enabled.

## Publication and preview evidence

The authorized scoped release was published on 2026-07-15 without promoting or changing production:

- branch: `codex/draft-ranker-release-20260715`
- product commit: `c78059b6de6671a0e594afe1e60d5e42421b5db4`
- draft pull request: [#335](https://github.com/FHFHockey-dev/fhfhockey.com/pull/335), targeting `octoberBranch`
- READY preview deployment: `dpl_BSTN4KU4zhqKR8UFkRPFwqKHpMiL`
- GitHub checks: all five reported Vercel checks passed for the product commit

The protected READY preview passed the flag-off closed-state smoke test. `/draft-rankings` and `/community-draft-rankings` each returned HTTP 200; `GET /api/v1/draft-ranker` and `GET /api/v1/draft-ranker/community` each returned HTTP 503 with code `draft_ranker_disabled`; and the homepage server props reported `draftRankerHomepageEnabled: false`. A deployment-scoped query after these requests found no error or fatal runtime logs. No production deployment was promoted, no rollout flag was changed, and no cohort was exposed.

## Merge and promotion evidence

- product-owner approval commit: `963bc33b0abebc4473746fa4f3573b3ce2c607e4`
- merged pull request: [#335](https://github.com/FHFHockey-dev/fhfhockey.com/pull/335)
- merge commit: `722f1dff02b7a4b9486836b386c0b576f57c5cfd`
- approved/merged tree: `21c199f1f00dce7d856fd92fd5bdcffc0d8c6580`
- promoted READY preview: `dpl_5wzgM43KU7Re4FTZZ8GgHhDQYRmw`
- READY production deployment: `dpl_2jLGmBmqwYjXiJJVuLjUMYJLrz4D`
- production operator: `fhfhockey-dev`, with Codex acting under the recorded product-owner approval
- READY time: `2026-07-15T15:19:26.084Z`
- retained rollback deployment: `dpl_HgjrBeCQVzDTsgryafBLzmXqGyjH`
- rollout state: all Draft Ranker keys absent and fail-closed; no cohort exposed

## Isolated assembly evidence

On 2026-07-15 the manifest was assembled in a separate clean clone of remote commit `0ed825fb30f5c6f329cd0dc169d2d9b2ca975e0f` on local-only branch `codex/draft-ranker-release-20260715`.

- 102 scoped paths transferred: 52 tracked changes and 50 additions.
- the local and remote checkpoint versions had zero differences across the 52 tracked base paths.
- the 50 additions had zero collisions with remote files.
- all unrelated source-workspace paths were excluded, including planning work, test artifacts, and generated Python caches.
- `git diff --check` passed.
- 49 focused files passed 228/228 Draft Ranker tests.
- ten broader WIGO files passed 54/54 tests.
- `npx tsc --noEmit` passed.
- `npm run build` compiled, generated all 83 static pages, and completed sitemap generation.

The clean clone's Corepack bootstrap encountered a package-signing key mismatch before dependency installation. `package.json` and `pnpm-lock.yaml` were byte-identical to the already verified workspace, so the isolated verification reused that exact installed dependency tree through a temporary ignored symlink. Static generation also used a temporary ignored link to the existing `.env.local`; no credential or environment file entered the release scope.

Immediately before authorized publication, remote `octoberBranch` advanced to cleanup commit `5743b6d808ff4cd9dd0cb01fef13863ac95f9f6d`. The candidate was discarded and rebuilt from a new clean clone of that exact commit. All 102 paths transferred again with zero collisions; 228/228 Draft Ranker tests, 54/54 broader WIGO tests, TypeScript, all 83 static pages, and sitemap generation passed again on the refreshed base.

At assembly time the isolated branch had not been staged, committed, pushed, or deployed. The user then installed GitHub CLI 2.96.0, authenticated as `TjsUsername` over HTTPS with repository access, and explicitly authorized publishing the prepared Draft Ranker branch and draft PR. The scoped 102-path change set was staged as 101 Git records because the migration replacement normalized to one rename, committed as `c78059b6de6671a0e594afe1e60d5e42421b5db4`, pushed, and opened as draft PR [#335](https://github.com/FHFHockey-dev/fhfhockey.com/pull/335). Production deployment and cohort exposure remain separate runbook gates.
