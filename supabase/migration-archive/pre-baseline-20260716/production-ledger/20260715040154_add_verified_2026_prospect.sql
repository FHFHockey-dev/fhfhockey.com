-- DR-033: add a real, explicitly reviewed non-ADP prospect so launch search,
-- watchlist, and assisted placement cover players outside Yahoo's draft pool.
--
-- Editorial evidence (checked 2026-07-14): NHL.com's first-round signing
-- tracker identifies Caleb Malhotra as the unsigned No. 3 selection of the
-- Vancouver Canucks and says he will play for Boston University.
-- https://www.nhl.com/news/2026-nhl-draft-1st-round-pick-signings-tracker

do $$
declare
    v_player_id bigint;
    v_vancouver_team_id smallint;
    v_editorial_key constant text := 'nhl-draft-2026-003-caleb-malhotra';
    v_source_url constant text :=
        'https://www.nhl.com/news/2026-nhl-draft-1st-round-pick-signings-tracker';
begin
    select team.id
    into v_vancouver_team_id
    from public.teams team
    where team.abbreviation = 'VAN';

    if v_vancouver_team_id is null then
        raise exception 'Cannot verify Caleb Malhotra: Vancouver Canucks team is missing';
    end if;

    select identity.id
    into v_player_id
    from public.fhfh_player_identities identity
    where identity.source_provenance ->> 'editorial_key' = v_editorial_key
    order by identity.id
    limit 1;

    if v_player_id is null then
        insert into public.fhfh_player_identities (
            canonical_name,
            first_name,
            last_name,
            canonical_position,
            current_nhl_team_id,
            current_organization_name,
            current_organization_type,
            lifecycle_status,
            verification_status,
            source_provenance,
            verified_at
        ) values (
            'Caleb Malhotra',
            'Caleb',
            'Malhotra',
            'C'::public."NHL_Position_Code",
            v_vancouver_team_id,
            'Boston University',
            'ncaa',
            'active_prospect',
            'verified',
            jsonb_build_object(
                'editorial_key', v_editorial_key,
                'source', 'NHL.com',
                'source_url', v_source_url,
                'source_checked_at', '2026-07-14',
                'draft_year', 2026,
                'draft_round', 1,
                'draft_pick', 3,
                'nhl_rights_holder', 'Vancouver Canucks',
                'contract_status', 'unsigned',
                'development_organization', 'Boston University'
            ),
            now()
        )
        returning id into v_player_id;
    end if;

    insert into public.fhfh_player_organization_history (
        fhfh_player_id,
        nhl_team_id,
        organization_name,
        organization_type,
        is_current,
        source,
        source_confidence,
        source_provenance
    )
    select
        v_player_id,
        v_vancouver_team_id,
        'Boston University',
        'ncaa',
        true,
        'fhfh_editorial:nhl_2026_first_round_tracker',
        1.0000,
        jsonb_build_object(
            'editorial_key', v_editorial_key,
            'source_url', v_source_url,
            'source_checked_at', '2026-07-14',
            'nhl_rights_holder', 'Vancouver Canucks'
        )
    where not exists (
        select 1
        from public.fhfh_player_organization_history history
        where history.fhfh_player_id = v_player_id
          and history.source = 'fhfh_editorial:nhl_2026_first_round_tracker'
          and history.is_current
    );

    insert into public.fhfh_player_identity_review_queue (
        review_type,
        raw_name,
        submitted_context,
        candidate_fhfh_player_ids,
        source_evidence,
        dedupe_key,
        status,
        resolution_action,
        resolved_fhfh_player_id,
        resolution_notes,
        reviewed_at,
        reviewed_by_system
    )
    select
        'player_addition',
        'Caleb Malhotra',
        jsonb_build_object(
            'requested_for', 'draft_ranker_launch_prospect_pool',
            'editorial_key', v_editorial_key
        ),
        array[v_player_id],
        jsonb_build_object(
            'source', 'NHL.com',
            'source_url', v_source_url,
            'source_checked_at', '2026-07-14'
        ),
        'editorial:' || v_editorial_key,
        'resolved',
        'created_verified_identity',
        v_player_id,
        'Verified from the official NHL 2026 first-round signing tracker.',
        now(),
        'system:fhfh_editorial_review_v1'
    where not exists (
        select 1
        from public.fhfh_player_identity_review_queue review
        where review.dedupe_key = 'editorial:' || v_editorial_key
    );
end;
$$;

-- Rollback: delete the resolved editorial review and organization-history row,
-- then delete the identity only when no user ranking data references it.
;
