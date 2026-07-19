-- Advisor-driven FK coverage for DR-061 community snapshot tables.

create index draft_community_results_snapshot_season_fk
on public.draft_ranker_community_player_results (snapshot_id, target_season_id);

create index draft_community_exclusions_user_fk
on public.draft_ranker_community_moderation_exclusions (user_id);

create index draft_community_exclusions_comparison_fk
on public.draft_ranker_community_moderation_exclusions (comparison_id);

create index draft_community_exclusions_low_player_fk
on public.draft_ranker_community_moderation_exclusions (low_player_id);

create index draft_community_exclusions_high_player_fk
on public.draft_ranker_community_moderation_exclusions (high_player_id);

-- Rollback: these indexes are additive and may be dropped independently.
;
