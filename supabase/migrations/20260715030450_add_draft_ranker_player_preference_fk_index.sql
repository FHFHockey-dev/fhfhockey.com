-- DR-031: cover the composite ranking-owner foreign key.
-- Live migration ledger version: 20260715030450.
create index draft_player_preferences_ranking_owner_fk
    on public.draft_ranker_player_preferences (ranking_id, user_id);
