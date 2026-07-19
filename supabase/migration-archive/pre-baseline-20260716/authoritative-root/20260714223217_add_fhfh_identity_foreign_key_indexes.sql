-- Cover foreign keys created by the DR-010 identity registry migration.
-- These indexes support merge/review/admin workflows and keep parent-row
-- updates and deletes from requiring full scans of the child tables.

create index if not exists idx_fhfh_player_external_verified_by
    on public.fhfh_player_external_identities (verified_by);

create index if not exists idx_fhfh_player_identities_merged_into
    on public.fhfh_player_identities (merged_into_id);

create index if not exists idx_fhfh_player_identities_verified_by
    on public.fhfh_player_identities (verified_by);

create index if not exists idx_fhfh_player_review_resolved_player
    on public.fhfh_player_identity_review_queue (resolved_fhfh_player_id);

create index if not exists idx_fhfh_player_review_reviewed_by
    on public.fhfh_player_identity_review_queue (reviewed_by);

create index if not exists idx_fhfh_player_organization_nhl_team
    on public.fhfh_player_organization_history (nhl_team_id);
