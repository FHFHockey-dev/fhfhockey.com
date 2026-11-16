begin;
set transaction read only;
set local statement_timeout = '5000';
with requested as (
  select generate_series(2026020001, 2026020298) as game_id
), checked as (
  select r.game_id,
    coalesce(m.input_status = 'complete'
      and m.relationship_status = 'complete' and m.derived_status = 'complete', false) as stages_complete,
    coalesce(m.input_materializer_version = 'projection-input-materializer-v3-penalty-clock'
      and m.relationship_algorithm_version = 'shift_relationship_materializer_v6_strength_segments'
      and m.derived_algorithm_version = 'projection-derived-materialization-v1', false) as versions_current,
    coalesce(m.input_version > 0 and m.relationship_version > 0 and m.derived_version > 0
      and m.input_fingerprint ~ '^[a-f0-9]{64}$'
      and m.relationship_fingerprint ~ '^[a-f0-9]{64}$'
      and m.derived_fingerprint ~ '^[a-f0-9]{64}$'
      and m.relationship_input_fingerprint = m.input_fingerprint
      and m.derived_input_fingerprint = m.input_fingerprint, false) as generations_match,
    coalesce(p.raw_payload_id = m.pbp_raw_payload_id and p.payload_hash = m.pbp_raw_payload_hash
      and p.snapshot_version = m.pbp_raw_snapshot_version
      and s.raw_payload_id = m.shift_raw_payload_id and s.payload_hash = m.shift_raw_payload_hash
      and s.snapshot_version = m.shift_raw_snapshot_version, false) as heads_current,
    coalesce(m.expected_play_rows > 0 and m.expected_play_rows = m.observed_play_rows
      and m.expected_strength_rows > 0 and m.expected_strength_rows = m.observed_strength_rows
      and m.expected_relationship_rows = m.expected_strength_rows
      and m.expected_relationship_rows = m.observed_relationship_rows
      and m.expected_player_rows > 0 and m.expected_player_rows = m.observed_player_rows
      and m.expected_team_rows = 2 and m.expected_team_rows = m.observed_team_rows
      and m.expected_goalie_rows >= 0 and m.expected_goalie_rows = m.observed_goalie_rows, false) as counts_match
  from requested r
  left join projection_game_materialization_status m on m.game_id = r.game_id
  left join nhl_api_game_payload_snapshot_heads p on p.game_id = r.game_id and p.endpoint = 'play-by-play'
  left join nhl_api_game_payload_snapshot_heads s on s.game_id = r.game_id and s.endpoint = 'shiftcharts'
)
select clock_timestamp() as checked_at, count(*) as requested_games,
  count(*) filter (where stages_complete and versions_current and generations_match and heads_current and counts_match) as qualified_games,
  count(*) filter (where stages_complete) as complete_games,
  count(*) filter (where versions_current) as current_version_games,
  count(*) filter (where generations_match) as matching_generation_games,
  count(*) filter (where heads_current) as current_head_games,
  count(*) filter (where counts_match) as matching_count_games,
  coalesce(jsonb_agg(to_jsonb(checked) order by game_id) filter
    (where not (stages_complete and versions_current and generations_match and heads_current and counts_match)), '[]'::jsonb) as exceptions
from checked;
commit;
