begin;

create table if not exists public.nst_team_gamelogs_as_counts (
  id bigserial primary key,
  team_abbreviation text not null,
  team_name text not null,
  season_id integer not null,
  date date not null,
  situation text not null default 'all',
  gp integer null,
  toi_seconds integer null,
  toi_per_gp_seconds integer null,
  wins integer null,
  losses integer null,
  otl integer null,
  row_wins integer null,
  points integer null,
  point_pct double precision null,
  cf integer null,
  ca integer null,
  cf_pct double precision null,
  cf_per_60 double precision null,
  ca_per_60 double precision null,
  ff integer null,
  fa integer null,
  ff_pct double precision null,
  ff_per_60 double precision null,
  fa_per_60 double precision null,
  sf integer null,
  sa integer null,
  sf_pct double precision null,
  sf_per_60 double precision null,
  sa_per_60 double precision null,
  gf integer null,
  ga integer null,
  gf_pct double precision null,
  gf_per_60 double precision null,
  ga_per_60 double precision null,
  xgf double precision null,
  xga double precision null,
  xgf_pct double precision null,
  xgf_per_60 double precision null,
  xga_per_60 double precision null,
  scf integer null,
  sca integer null,
  scf_pct double precision null,
  scf_per_60 double precision null,
  sca_per_60 double precision null,
  scsf integer null,
  scsa integer null,
  scsf_pct double precision null,
  scsf_per_60 double precision null,
  scsa_per_60 double precision null,
  scgf integer null,
  scga integer null,
  scgf_pct double precision null,
  scgf_per_60 double precision null,
  scga_per_60 double precision null,
  scsh_pct double precision null,
  scsv_pct double precision null,
  hdcf integer null,
  hdca integer null,
  hdcf_pct double precision null,
  hdcf_per_60 double precision null,
  hdca_per_60 double precision null,
  hdsf integer null,
  hdsa integer null,
  hdsf_pct double precision null,
  hdsf_per_60 double precision null,
  hdsa_per_60 double precision null,
  hdgf integer null,
  hdga integer null,
  hdgf_pct double precision null,
  hdgf_per_60 double precision null,
  hdga_per_60 double precision null,
  hdsh_pct double precision null,
  hdsv_pct double precision null,
  mdcf integer null,
  mdca integer null,
  mdcf_pct double precision null,
  mdcf_per_60 double precision null,
  mdca_per_60 double precision null,
  mdsf integer null,
  mdsa integer null,
  mdsf_pct double precision null,
  mdsf_per_60 double precision null,
  mdsa_per_60 double precision null,
  mdgf integer null,
  mdga integer null,
  mdgf_pct double precision null,
  mdgf_per_60 double precision null,
  mdga_per_60 double precision null,
  mdsh_pct double precision null,
  mdsv_pct double precision null,
  ldcf integer null,
  ldca integer null,
  ldcf_pct double precision null,
  ldcf_per_60 double precision null,
  ldca_per_60 double precision null,
  ldsf integer null,
  ldsa integer null,
  ldsf_pct double precision null,
  ldsf_per_60 double precision null,
  ldsa_per_60 double precision null,
  ldgf integer null,
  ldga integer null,
  ldgf_pct double precision null,
  ldgf_per_60 double precision null,
  ldga_per_60 double precision null,
  ldsh_pct double precision null,
  ldsv_pct double precision null,
  sh_pct double precision null,
  sv_pct double precision null,
  pdo double precision null,
  created_at timestamp without time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone not null default CURRENT_TIMESTAMP,
  constraint nst_team_gamelogs_as_counts_unique unique (team_abbreviation, date)
);

create index if not exists idx_nst_team_gamelogs_as_counts_date on public.nst_team_gamelogs_as_counts (date desc);
create index if not exists idx_nst_team_gamelogs_as_counts_season on public.nst_team_gamelogs_as_counts (season_id, date desc);

create table if not exists public.nst_team_gamelogs_as_rates (
  like public.nst_team_gamelogs_as_counts including defaults including storage
);

alter table public.nst_team_gamelogs_as_rates
  alter column situation set default 'all';

alter table public.nst_team_gamelogs_as_rates
  add constraint nst_team_gamelogs_as_rates_unique unique (team_abbreviation, date);

create index if not exists idx_nst_team_gamelogs_as_rates_date on public.nst_team_gamelogs_as_rates (date desc);
create index if not exists idx_nst_team_gamelogs_as_rates_season on public.nst_team_gamelogs_as_rates (season_id, date desc);

create table if not exists public.nst_team_gamelogs_es_counts (
  like public.nst_team_gamelogs_as_counts including defaults including storage
);

alter table public.nst_team_gamelogs_es_counts
  alter column situation set default '5v5';

alter table public.nst_team_gamelogs_es_counts
  add constraint nst_team_gamelogs_es_counts_unique unique (team_abbreviation, date);

create index if not exists idx_nst_team_gamelogs_es_counts_date on public.nst_team_gamelogs_es_counts (date desc);
create index if not exists idx_nst_team_gamelogs_es_counts_season on public.nst_team_gamelogs_es_counts (season_id, date desc);

create table if not exists public.nst_team_gamelogs_es_rates (
  like public.nst_team_gamelogs_as_counts including defaults including storage
);

alter table public.nst_team_gamelogs_es_rates
  alter column situation set default '5v5';

alter table public.nst_team_gamelogs_es_rates
  add constraint nst_team_gamelogs_es_rates_unique unique (team_abbreviation, date);

create index if not exists idx_nst_team_gamelogs_es_rates_date on public.nst_team_gamelogs_es_rates (date desc);
create index if not exists idx_nst_team_gamelogs_es_rates_season on public.nst_team_gamelogs_es_rates (season_id, date desc);

create table if not exists public.nst_team_gamelogs_pp_counts (
  like public.nst_team_gamelogs_as_counts including defaults including storage
);

alter table public.nst_team_gamelogs_pp_counts
  alter column situation set default 'pp';

alter table public.nst_team_gamelogs_pp_counts
  add constraint nst_team_gamelogs_pp_counts_unique unique (team_abbreviation, date);

create index if not exists idx_nst_team_gamelogs_pp_counts_date on public.nst_team_gamelogs_pp_counts (date desc);
create index if not exists idx_nst_team_gamelogs_pp_counts_season on public.nst_team_gamelogs_pp_counts (season_id, date desc);

create table if not exists public.nst_team_gamelogs_pp_rates (
  like public.nst_team_gamelogs_as_counts including defaults including storage
);

alter table public.nst_team_gamelogs_pp_rates
  alter column situation set default 'pp';

alter table public.nst_team_gamelogs_pp_rates
  add constraint nst_team_gamelogs_pp_rates_unique unique (team_abbreviation, date);

create index if not exists idx_nst_team_gamelogs_pp_rates_date on public.nst_team_gamelogs_pp_rates (date desc);
create index if not exists idx_nst_team_gamelogs_pp_rates_season on public.nst_team_gamelogs_pp_rates (season_id, date desc);

create table if not exists public.nst_team_gamelogs_pk_counts (
  like public.nst_team_gamelogs_as_counts including defaults including storage
);

alter table public.nst_team_gamelogs_pk_counts
  alter column situation set default 'pk';

alter table public.nst_team_gamelogs_pk_counts
  add constraint nst_team_gamelogs_pk_counts_unique unique (team_abbreviation, date);

create index if not exists idx_nst_team_gamelogs_pk_counts_date on public.nst_team_gamelogs_pk_counts (date desc);
create index if not exists idx_nst_team_gamelogs_pk_counts_season on public.nst_team_gamelogs_pk_counts (season_id, date desc);

create table if not exists public.nst_team_gamelogs_pk_rates (
  like public.nst_team_gamelogs_as_counts including defaults including storage
);

alter table public.nst_team_gamelogs_pk_rates
  alter column situation set default 'pk';

alter table public.nst_team_gamelogs_pk_rates
  add constraint nst_team_gamelogs_pk_rates_unique unique (team_abbreviation, date);

create index if not exists idx_nst_team_gamelogs_pk_rates_date on public.nst_team_gamelogs_pk_rates (date desc);
create index if not exists idx_nst_team_gamelogs_pk_rates_season on public.nst_team_gamelogs_pk_rates (season_id, date desc);

commit;
