# DR-002 Execution Boundary and Baseline

## Status

Completed on 2026-07-14. This document records the safe implementation boundary for the FHFH Draft Ranker before any product schema or application work begins.

## Git and worktree baseline

- Repository: `/Users/tim/Code/fhfhockey.com`
- Current branch: `octoberBranch`
- Current HEAD: `3d6d5ca1` (`bigun`)
- No repository-level `AGENTS.md` file was found.
- Baseline `git status` contained 156 tracked changes and 1,656 untracked files. Excluding the repository-local `.npm-cache/`, 312 changed or untracked paths remained.
- The worktree was already dirty before draft-ranker execution began. All unrelated changes are user-owned and must be preserved.
- No branch switch, stash, clean, reset, staging operation, or worktree relocation is authorized as part of DR-002.

## Selected isolation strategy

Implementation will remain in the existing shared checkout and use strict path isolation:

1. Prefer new draft-ranker-specific paths under `tasks/TASKS/draft-ranker/`, `web/lib/draft-ranker/`, `web/components/DraftRanker/`, `web/pages/api/v1/draft-ranker/`, and `web/pages/draft-rankings/`.
2. Add new database migrations only under the canonical `supabase/migrations/` directory and only through the Supabase CLI migration generator.
3. Before editing an existing shared file, run a path-specific status and diff audit and preserve all unrelated hunks.
4. Do not stage or commit unrelated paths.
5. Do not modify legacy migration copies under root `migrations/` or `web/supabase/migrations/` for new ranker work.
6. Do not edit the duplicate untracked `tasks/TASKS/draft-ranker/repository-record.md`; `repository-audit.md` is the approved canonical audit.

This is safer than creating a clean worktree from `HEAD`, because a clean worktree would omit the current untracked planning package and numerous uncommitted architectural changes that are authoritative for this shared session.

## Known overlapping paths

The following future ranker integration points already contain unrelated changes or are shared infrastructure:

| Path | Baseline state | Boundary |
| --- | --- | --- |
| `web/lib/supabase/database-generated.types.ts` | Modified | Do not regenerate or overwrite until the schema is approved and the existing diff is reviewed. |
| `web/pages/index.tsx` | Modified | Do not touch before DR-042; re-audit and preserve all homepage work. |
| `web/contexts/AuthProviderContext/index.tsx` | Modified | Avoid for the ranker foundation; use existing public context contract. |
| `web/pages/draft-dashboard.tsx` | Modified | Reuse utilities only; do not merge ranker persistence into this page. |
| `web/pages/_app.tsx` | Shared, currently not reported modified | TanStack Query is already global; no ranker provider change is planned. |
| `web/vercel.json` | Shared, currently not reported modified | Do not touch before the community snapshot cron phase. |
| `supabase/migrations/` | Contains untracked migrations | Generate unique later migrations; never rename, reorder, or rewrite unrelated migration files. |

## Canonical migration path and ledger state

`supabase/migrations/` is the canonical migration directory, as established by the completed auth/settings migration-reconciliation work in `tasks/TASKS/auth-user-settings-platform/tasks-prd-auth-user-settings-platform.md`.

The linked Supabase migration ledger contained 17 entries at audit time. The local canonical directory contained 10 SQL files. Five auth/settings versions match the live ledger exactly. Several other local files describe changes that are live under different migration versions, and one local migration was not yet present in the live ledger:

- Local `20260712214739_xg_execution_leases.sql`; live ledger version `20260712223015`.
- Local `20260712230000_fix_xg_execution_lease_acquire_conflict.sql`; live ledger version `20260712223129`.
- Local `20260712234009_add_xg_flurry_adjusted_aggregate_columns.sql`; live ledger version `20260712234959`.
- Local `20260714183159_create_tweet_news_inference_state.sql`; live ledger version `20260714183806`.
- Local `20260714211247_fix_immutable_unaccent_search_path.sql` was not present in the live ledger at audit time.

Consequences:

- Migration filename presence is not proof that production applied the same version.
- The live migration ledger and live schema must be checked before every ranker apply.
- Draft-ranker migrations must be additive and use versions later than all existing local files.
- Existing ledger drift is not repaired inside the draft-ranker scope unless it directly blocks a ranker migration and receives separate approval.

## Live Supabase baseline

Project ID: `fyhftlxokyjtpndbkfse`.

At audit time:

- PostgreSQL: 15.1, 64-bit.
- Extensions required by the proposed identity/search design are present: `pg_trgm 1.6`, `pgcrypto 1.3`, and `unaccent 1.1`.
- No planned draft-ranker or FHFH identity tables existed.
- `players`: 3,544 rows.
- `rosters`: 4,075 rows, of which 3,900 are current.
- `yahoo_players`: 2,827 rows.
- `yahoo_nhl_player_map`: 1,857 rows.
- `user_profiles`: 14 rows.
- `user_settings`: 14 rows.
- `players` still uses a non-null `bigint id` representing the NHL identity.
- Nine duplicate `players.fullName` groups exist.
- 897 player rows have no current `team_id`.

## Yahoo seed-quality baseline

For `yahoo_players.season = 2025`:

- 1,494 rows exist and all 1,494 contain a non-null `draft_analysis` object.
- 1,327 rows have a non-null scalar `average_draft_pick`.
- Only 320 rows have a positive scalar `average_draft_pick`.
- Only 242 rows have a positive numeric `draft_analysis.preseason_average_pick`.
- 1,252 rows have a missing, non-numeric, or non-positive preseason value.
- 240 positive preseason rows currently map to an NHL/FHFH seed candidate through the existing Yahoo mapping, while 315 positive scalar rows map successfully.

Therefore, neither non-null scalar presence nor a JSON object is sufficient proof of usable ADP. DR-020 must use an explicit positive numeric contract and must record whether a seeded entry came from verified preseason ADP or a transparent fallback used to fill the required top 250.

## Security-advisor baseline

The current project-wide advisor baseline contains pre-existing findings outside the draft-ranker scope:

- 191 security findings: 76 `security_definer_view` errors, 55 RLS-without-policy informational findings, 32 mutable function search-path warnings, 8 anonymous and 8 authenticated executable `SECURITY DEFINER` function warnings, and other configuration warnings.
- `public.execute_sql(sql_statement text)` is `SECURITY DEFINER` and executable by `PUBLIC`, `anon`, `authenticated`, and `service_role`.
- `public.truncate_rolling_player_game_metrics()` is `SECURITY DEFINER` and executable by `anon` and `authenticated`.
- Supabase reports leaked-password protection disabled.
- Supabase reports the Postgres 15 build has security patches available.
- 391 performance findings exist, dominated by unused indexes and unindexed foreign keys.

These findings predate the draft ranker. DR-003 must ensure the ranker adds no new advisor findings. Broad remediation remains a separate project, but the publicly executable `execute_sql` function is a launch-security gate because it can undermine the isolation expected from new ranker RLS and RPCs.

Official guidance used for the ranker contract:

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)
- [Supabase security-definer view advisor](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0010_security_definer_view)

## DR-002 acceptance evidence

- Unrelated changes were inventoried and preserved.
- A path-isolated implementation strategy was selected.
- Canonical migration ownership was confirmed.
- Local/live migration drift was recorded rather than altered.
- Live identity, account, Yahoo, extension, and advisor baselines were rechecked.
- No database, branch, staging, or product-code mutation occurred.
