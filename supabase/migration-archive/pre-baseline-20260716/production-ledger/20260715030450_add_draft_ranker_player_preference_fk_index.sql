-- DR-031: cover the composite ranking-owner foreign key.
create index draft_player_preferences_ranking_owner_fk
    on public.draft_ranker_player_preferences (ranking_id, user_id);
;
