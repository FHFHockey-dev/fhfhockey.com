-- predictions_sko stores model outputs for Sustainability K-Value Outlook
create table if not exists public.predictions_sko (
  id bigserial primary key,
  player_id bigint not null,
  as_of_date date not null,
  horizon_games integer not null default 5,
  pred_points double precision null,
  pred_points_per_game double precision null,
  stability_cv double precision null,
  stability_multiplier double precision null,
  sko double precision null,
  top_features jsonb null,
  model_name text null,
  model_version text null,
  created_at timestamp with time zone not null default now(),
  unique (player_id, as_of_date, horizon_games)
);

create index if not exists idx_predictions_sko_player_date on public.predictions_sko (player_id, as_of_date desc);