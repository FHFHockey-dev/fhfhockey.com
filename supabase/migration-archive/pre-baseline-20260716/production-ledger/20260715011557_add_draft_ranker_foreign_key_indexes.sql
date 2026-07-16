-- DR-012 follow-up: cover every ownership/evidence foreign key reported by
-- the Supabase performance advisor after the approved foundation apply.

create index draft_rankings_target_season_fk
    on public.draft_rankings (target_season_id);

create index draft_entries_ranking_owner_fk
    on public.draft_ranking_entries (ranking_id, user_id);

create index draft_events_ranking_owner_fk
    on public.draft_ranking_events (ranking_id, user_id);

create index draft_seed_runs_source_season_fk
    on public.draft_ranking_seed_runs (source_season_id);
create index draft_seed_runs_ranking_owner_fk
    on public.draft_ranking_seed_runs (ranking_id, user_id);

create index draft_watchlist_ranking_owner_fk
    on public.draft_ranking_watchlist (ranking_id, user_id);

create index draft_pair_prompts_ranking_owner_fk
    on public.draft_ranker_pair_prompts (ranking_id, user_id, season_id);
create index draft_pair_prompts_low_player_fk
    on public.draft_ranker_pair_prompts (low_player_id);
create index draft_pair_prompts_high_player_fk
    on public.draft_ranker_pair_prompts (high_player_id);

create index draft_pair_comps_prompt_fk
    on public.draft_ranker_pair_comparisons (
        prompt_id, user_id, ranking_id, season_id, low_player_id, high_player_id
    );
create index draft_pair_comps_ranking_owner_fk
    on public.draft_ranker_pair_comparisons (ranking_id, user_id, season_id);
create index draft_pair_comps_low_player_fk
    on public.draft_ranker_pair_comparisons (low_player_id);
create index draft_pair_comps_high_player_fk
    on public.draft_ranker_pair_comparisons (high_player_id);

create index draft_pair_prefs_comparison_fk
    on public.draft_ranker_pair_preferences (
        comparison_id, user_id, ranking_id, season_id, low_player_id, high_player_id
    );
create index draft_pair_prefs_ranking_owner_fk
    on public.draft_ranker_pair_preferences (ranking_id, user_id, season_id);
create index draft_pair_prefs_low_player_fk
    on public.draft_ranker_pair_preferences (low_player_id);
create index draft_pair_prefs_high_player_fk
    on public.draft_ranker_pair_preferences (high_player_id);
create index draft_pair_prefs_preferred_player_fk
    on public.draft_ranker_pair_preferences (preferred_player_id);

create index draft_placement_ranking_owner_fk
    on public.draft_ranker_placement_sessions (ranking_id, user_id);
create index draft_placement_player_fk
    on public.draft_ranker_placement_sessions (fhfh_player_id);
;
