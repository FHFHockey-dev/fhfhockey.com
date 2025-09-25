-- predictions_sko_metrics stores nightly evaluation metrics per model + stat
create table if not exists public.predictions_sko_metrics (
  id bigserial primary key,
  run_id text not null,
  as_of_date date not null,
  horizon_games integer not null default 5,
  stat_key text not null,
  model_name text not null,
  sample_size integer not null,
  mae double precision not null,
  mape double precision null,
  rmse double precision null,
  spearman_r double precision null,
  margin_of_error double precision null,
  hit_rate_within_moe double precision null,
  created_at timestamptz not null default now(),
  unique (as_of_date, horizon_games, stat_key, model_name)
);

create index if not exists idx_predictions_sko_metrics_as_of
  on public.predictions_sko_metrics (as_of_date desc, stat_key, model_name);

-- predictions_sko_predictions keeps holdout prediction vs actual comparisons
create table if not exists public.predictions_sko_predictions (
  id bigserial primary key,
  run_id text not null,
  as_of_date date not null,
  horizon_games integer not null default 5,
  stat_key text not null,
  model_name text not null,
  player_id bigint not null,
  predicted double precision null,
  actual double precision null,
  created_at timestamptz not null default now(),
  unique (run_id, as_of_date, horizon_games, stat_key, model_name, player_id)
);

create index if not exists idx_predictions_sko_predictions_as_of
  on public.predictions_sko_predictions (as_of_date desc, stat_key, model_name);
