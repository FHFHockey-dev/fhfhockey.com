-- DR-051 follow-up: cover the two foreign-key paths identified by the live
-- Supabase performance advisor after the discovery materialization landed.

create index draft_discovery_consensus_player_fk
on public.draft_ranker_discovery_projection_consensus (fhfh_player_id);

create index draft_discovery_runs_requested_by_fk
on public.draft_ranker_discovery_refresh_runs (requested_by)
where requested_by is not null;
