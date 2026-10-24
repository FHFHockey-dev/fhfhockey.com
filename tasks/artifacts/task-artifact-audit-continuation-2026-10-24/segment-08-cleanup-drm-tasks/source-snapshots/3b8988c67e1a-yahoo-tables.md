yahoo_game_keys:

```sql
create table public.yahoo_game_keys (
  game_id integer not null,
  game_key text not null,
  name text null,
  code text null,
  type text null,
  url text null,
  season integer null,
  is_registration_over integer null,
  is_game_over integer null,
  is_offseason integer null,
  contest_group_id integer null,
  current_week integer null,
  editorial_season integer null,
  game_weeks jsonb null,
  has_schedule integer null,
  is_contest_over integer null,
  is_contest_reg_active integer null,
  is_live_draft_lobby_active integer null,
  leagues jsonb null,
  picks_status text null,
  players jsonb null,
  position_types jsonb null,
  roster_positions jsonb null,
  scenario_generator integer null,
  stat_categories jsonb null,
  teams jsonb null,
  last_updated timestamp with time zone null default now(),
  constraint yahoo_game_keys_pkey primary key (game_id)
) TABLESPACE pg_default;
```


yahoo_players:
```sql
create table public.yahoo_players (
  player_name character varying(255) null,
  player_id character varying(255) null,
  draft_analysis jsonb null,
  average_draft_pick double precision null,
  average_draft_round double precision null,
  average_draft_cost double precision null,
  percent_drafted double precision null,
  editorial_player_key character varying(255) null,
  editorial_team_abbreviation character varying(10) null,
  editorial_team_full_name character varying(255) null,
  eligible_positions jsonb null,
  display_position text null,
  headshot_url text null,
  injury_note text null,
  full_name character varying(255) null,
  percent_ownership double precision null,
  player_key character varying(255) not null,
  position_type character varying(50) null,
  status character varying(10) null,
  status_full character varying(255) null,
  last_updated timestamp without time zone null default now(),
  uniform_number smallint null,
  ownership_timeline jsonb null default '[]'::jsonb,
  game_id integer null,
  season integer null,
  constraint yahoo_players_pkey primary key (player_key)
) TABLESPACE pg_default;

create unique INDEX IF not exists yahoo_players_player_key_key on public.yahoo_players using btree (player_key) TABLESPACE pg_default;

create unique INDEX IF not exists yahoo_players_player_id_season_key on public.yahoo_players using btree (player_id, season) TABLESPACE pg_default;

create index IF not exists yp_by_season on public.yahoo_players using btree (season) TABLESPACE pg_default;

create index IF not exists yplayers_name_norm_btree on public.yahoo_players using btree (immutable_unaccent (lower((player_name)::text))) TABLESPACE pg_default;

create index IF not exists yplayers_name_norm_trgm on public.yahoo_players using gin (
  immutable_unaccent (lower((player_name)::text)) gin_trgm_ops
) TABLESPACE pg_default;
```


yahoo_api_credentials:
```sql
create table public.yahoo_api_credentials (
  id serial not null,
  consumer_key text not null,
  consumer_secret text not null,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint yahoo_api_credentials_pkey primary key (id)
) TABLESPACE pg_default;
```

yahoo_matchup_weeks:
```sql
create table public.yahoo_matchup_weeks (
  id serial not null,
  game_key text not null,
  game_id text null,
  name text null,
  code text null,
  type text null,
  url text null,
  season text not null,
  week integer not null,
  start_date date null,
  end_date date null,
  inserted_at timestamp with time zone not null default now(),
  constraint yahoo_matchup_weeks_pkey primary key (id)
) TABLESPACE pg_default;

create unique INDEX IF not exists yahoo_matchup_weeks_game_season_week_key on public.yahoo_matchup_weeks using btree (game_key, season, week) TABLESPACE pg_default;
```

yahoo_names:
```sql
create table public.yahoo_names (
  player_id character varying(255) null,
  player_name character varying(255) null,
  first_name text null,
  last_name text null
) TABLESPACE pg_default;
```


yahoo_nhl_player_map_mat:
| column_name       | data_type         | is_nullable | column_default | character_maximum_length |
| ----------------- | ----------------- | ----------- | -------------- | ------------------------ |
| nhl_player_id     | text              | YES         | null           | null                     |
| nhl_player_name   | text              | YES         | null           | null                     |
| yahoo_player_id   | character varying | YES         | null           | 255                      |
| yahoo_player_name | character varying | YES         | null           | 255                      |
| yahoo_team        | character varying | YES         | null           | 10                       |


yahoo_player_keys:
| column_name  | data_type                   | is_nullable | column_default | character_maximum_length |
| ------------ | --------------------------- | ----------- | -------------- | ------------------------ |
| player_key   | character varying           | NO          | null           | 255                      |
| player_id    | integer                     | YES         | null           | null                     |
| player_name  | character varying           | YES         | null           | 255                      |
| last_updated | timestamp without time zone | NO          | now()          | null                     |

yahoo_player_ownership_history:
| column_name    | data_type                | is_nullable | column_default | character_maximum_length |
| -------------- | ------------------------ | ----------- | -------------- | ------------------------ |
| player_key     | text                     | NO          | null           | null                     |
| ownership_date | date                     | NO          | null           | null                     |
| ownership_pct  | double precision         | YES         | null           | null                     |
| source         | text                     | YES         | 'yahoo'::text  | null                     |
| inserted_at    | timestamp with time zone | YES         | now()          | null                     |

yahoo_positions:
| column_name         | data_type | is_nullable | column_default | character_maximum_length |
| ------------------- | --------- | ----------- | -------------- | ------------------------ |
| player_key          | text      | NO          | null           | null                     |
| player_id           | bigint    | YES         | null           | null                     |
| full_name           | text      | YES         | null           | null                     |
| display_position    | text      | YES         | null           | null                     |
| editorial_team_abbr | text      | YES         | null           | null                     |
| team_full_name      | text      | YES         | null           | null                     |
| team_abbr           | text      | YES         | null           | null                     |
| position_type       | text      | YES         | null           | null                     |
| primary_position    | text      | YES         | null           | null                     |
| uniform_number      | text      | YES         | null           | null                     |
| status              | text      | YES         | null           | null                     |

## 2026-08-24 live-draft overlay

The canonical root migrations and current TypeScript source override older audit snapshots in this document. `20260813015112_yahoo_live_draft_companion.sql` adds owner-scoped `yahoo_draft_sessions` and authoritative current-slot `yahoo_draft_picks`; both force RLS, allow authenticated owner reads only, reserve mutation/RPC execution for service role, and are the only live-draft tables published to Supabase Realtime.

The additive, not-yet-deployed `20260824152127_yahoo_live_draft_production_hardening.sql` adds worker heartbeat/nudge fields, pick mapping revision/correction confirmation, service-only one-time `yahoo_oauth_transactions`, per-account `yahoo_token_refresh_leases`, and short-retention pseudonymous `yahoo_draft_poll_observations`. It also adds OAuth transaction, refresh lease, worker nudge, identity reconciliation, and cleanup RPCs. OAuth state and browser binding are stored only as SHA-256 hashes; poll observations contain no tokens or raw provider payload.

`fhfh_player_external_identities` is the Yahoo mapping authority. `yahoo_players` remains seasonal provider data. The hardening migration changes `yahoo_nhl_player_map_read` into a compatibility projection that begins with unambiguous verified canonical identities and exact full Yahoo player keys, and exposes `fhfh_player_id` so the dashboard can prefer it over NHL and Yahoo fallbacks. Legacy mapping rows may decorate statistics only after canonical NHL and Yahoo identities agree.

Generated types in `web/lib/supabase/database-generated.types.ts` include both live tables and the hardening overlay. Current worker, retention, rehearsal, rollout, and rollback requirements are in `live-draft-runbook.md`. Keep `YAHOO_LIVE_DRAFT_PROVIDER_VALIDATED=false` and broad rollout off until the target migration, durable worker deployment, and controlled Yahoo rehearsal meet the documented thresholds.
