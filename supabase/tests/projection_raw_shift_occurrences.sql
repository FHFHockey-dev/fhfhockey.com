-- Run with psql -X -v ON_ERROR_STOP=1 after installing the capture function in
-- a fresh disposable database. Never point this fixture at an application DB.
-- Uses synthetic hashes and a two-row fixture matching raw0056's exact tuple.
do $$ begin
  if current_database() <> 'projection_raw_shift_occurrences_test' then
    raise exception 'Disposable projection_raw_shift_occurrences_test database required';
  end if;
end $$;

begin;
insert into public.games(id,date) values
  (2026010056,'2026-09-26'), (2026010057,'2026-09-26');

create function pg_temp.capture_fixture(
  target_game bigint, shifts jsonb, shift_hash text default repeat('b',64)
) returns jsonb language plpgsql as $$
declare receipt record;
begin
  select * into receipt from public.capture_projection_raw_source_snapshots_v1(
    target_game, 20262027, date '2026-09-26',
    'https://api-web.nhle.com/v1/gamecenter/' || target_game || '/play-by-play',
    repeat('a',64), jsonb_build_object('id',target_game,'season',20262027,
      'gameDate','2026-09-26','plays',jsonb_build_array(jsonb_build_object('eventId',1))),
    'https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=' || target_game,
    shift_hash, shifts
  );
  return to_jsonb(receipt);
end $$;

create function pg_temp.expect_rejection(shifts jsonb, expected_message text,
  shift_hash text default repeat('c',64)) returns void language plpgsql as $$
begin
  begin
    perform pg_temp.capture_fixture(2026010056,shifts,shift_hash);
    raise exception 'Expected rejection did not occur: %',expected_message;
  exception when others then
    if sqlerrm <> expected_message then raise; end if;
  end;
end $$;

set local role service_role;
do $$
declare
  row_one jsonb := '{"id":1,"gameId":2026010056,"playerId":8481554,"teamId":55,"shiftNumber":5,"period":2,"startTime":"00:58","endTime":"01:48","duration":"00:50","typeCode":517}';
  row_two jsonb;
  duplicate_payload jsonb;
  distinct_payload jsonb;
  neighbor_payload jsonb;
  first_receipt jsonb;
  retry_receipt jsonb;
  distinct_receipt jsonb;
  raw_snapshot jsonb;
  neighbor_raw_before jsonb;
  neighbor_heads_before jsonb;
  target_raw_before jsonb;
  target_heads_before jsonb;
begin
  row_two := jsonb_set(row_one,'{id}','2');
  duplicate_payload := jsonb_build_object('source','json-api','total',2,
    'data',jsonb_build_array(row_one,row_two));
  neighbor_payload := jsonb_build_object('source','json-api','total',1,
    'data',jsonb_build_array(jsonb_set(row_one,'{gameId}','2026010057')));
  perform pg_temp.capture_fixture(2026010057,neighbor_payload,repeat('d',64));
  select jsonb_agg(to_jsonb(r) order by id) into neighbor_raw_before
    from public.nhl_api_game_payloads_raw r where game_id=2026010057;
  select jsonb_agg(to_jsonb(h) order by endpoint) into neighbor_heads_before
    from public.nhl_api_game_payload_snapshot_heads h where game_id=2026010057;

  -- Exact duplicate intervals remain two ordered raw occurrences under one hash.
  first_receipt := pg_temp.capture_fixture(2026010056,duplicate_payload);
  select to_jsonb(r) into raw_snapshot from public.nhl_api_game_payloads_raw r
    where id=(first_receipt->>'shift_raw_payload_id')::bigint;
  assert raw_snapshot->'payload' = duplicate_payload, 'Raw occurrence payload changed';
  assert jsonb_array_length(raw_snapshot->'payload'->'data') = 2, 'Raw count changed';
  assert raw_snapshot->>'payload_hash' = repeat('b',64), 'Raw hash changed';
  assert raw_snapshot->'payload'->'data'->0->>'id' = '1', 'Raw order changed';
  assert raw_snapshot->'payload'->'data'->1->>'id' = '2', 'Provider occurrences collapsed';
  raise notice 'PASS exact duplicate occurrence/hash/count/order preservation';

  retry_receipt := pg_temp.capture_fixture(2026010056,duplicate_payload);
  assert retry_receipt = first_receipt, 'Retry changed raw identity or version';
  assert (select count(*) from public.nhl_api_game_payloads_raw where game_id=2026010056)=2,
    'Retry inserted another raw snapshot';
  raise notice 'PASS exact retry idempotency';

  -- Nonidentical tuples are preserved as evidence and never collapsed into a
  -- duplicate. This is raw admission only, not normalized interval acceptance.
  distinct_payload := jsonb_set(duplicate_payload,'{data,1,endTime}','"01:49"');
  distinct_payload := jsonb_set(distinct_payload,'{data,1,duration}','"00:51"');
  perform pg_temp.expect_rejection(distinct_payload,'PROJECTION_RAW_SHIFT_HASH_COLLISION',repeat('b',64));
  distinct_receipt := pg_temp.capture_fixture(2026010056,distinct_payload,repeat('e',64));
  select to_jsonb(r) into raw_snapshot from public.nhl_api_game_payloads_raw r
    where id=(distinct_receipt->>'shift_raw_payload_id')::bigint;
  assert raw_snapshot->'payload' = distinct_payload, 'Nonidentical evidence collapsed';
  assert distinct_receipt->>'shift_raw_payload_id' <> first_receipt->>'shift_raw_payload_id',
    'Different payload reused immutable identity';
  assert (distinct_receipt->>'shift_raw_snapshot_version')::bigint =
    (first_receipt->>'shift_raw_snapshot_version')::bigint+1, 'New snapshot version not advanced';
  raise notice 'PASS nonidentical identity retention and hash collision rejection';

  select jsonb_agg(to_jsonb(r) order by id) into target_raw_before
    from public.nhl_api_game_payloads_raw r where game_id=2026010056;
  select jsonb_agg(to_jsonb(h) order by endpoint) into target_heads_before
    from public.nhl_api_game_payload_snapshot_heads h where game_id=2026010056;

  perform pg_temp.expect_rejection(jsonb_set(duplicate_payload,'{data,1,gameId}','2026010057'),
    'INVALID_PROJECTION_RAW_SHIFT_ROWS');
  perform pg_temp.expect_rejection(jsonb_set(duplicate_payload,'{data,1,playerId}','0'),
    'INVALID_PROJECTION_RAW_SHIFT_ROWS');
  perform pg_temp.expect_rejection(jsonb_set(duplicate_payload,'{data,1}',row_two-'typeCode'),
    'INVALID_PROJECTION_RAW_SHIFT_ROWS');
  perform pg_temp.expect_rejection(jsonb_set(duplicate_payload,'{total}','3'),
    'INVALID_PROJECTION_RAW_SHIFT_PAYLOAD');
  perform pg_temp.expect_rejection(jsonb_set(duplicate_payload,'{source}','"html"'),
    'INVALID_PROJECTION_RAW_SHIFT_PAYLOAD');
  perform pg_temp.expect_rejection(jsonb_set(duplicate_payload,'{data,1,playerId}','"invalid"'),
    'invalid input syntax for type bigint: "invalid"');
  perform pg_temp.expect_rejection(duplicate_payload,'INVALID_PROJECTION_RAW_SNAPSHOT_IDENTITY','invalid');
  raise notice 'PASS foreign identity, nonpositive identity, missing field, count, source, type and hash rejection';

  assert (select jsonb_agg(to_jsonb(r) order by id) from public.nhl_api_game_payloads_raw r
    where game_id=2026010056) = target_raw_before, 'Rejected capture changed target raw snapshots';
  assert (select jsonb_agg(to_jsonb(h) order by endpoint) from public.nhl_api_game_payload_snapshot_heads h
    where game_id=2026010056) = target_heads_before, 'Rejected capture advanced target heads';
  assert (select jsonb_agg(to_jsonb(r) order by id) from public.nhl_api_game_payloads_raw r
    where game_id=2026010057) = neighbor_raw_before, 'Neighboring raw snapshots changed';
  assert (select jsonb_agg(to_jsonb(h) order by endpoint) from public.nhl_api_game_payload_snapshot_heads h
    where game_id=2026010057) = neighbor_heads_before, 'Neighboring heads changed';
  raise notice 'PASS rejection atomicity and neighboring game preservation';

  -- The existing raw mutation trigger and writer privileges remain intact.
  begin
    update public.nhl_api_game_payloads_raw set payload='{}' where game_id=2026010056;
    raise exception 'Expected immutable UPDATE rejection did not occur';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS unchanged service-role raw mutation boundary';
end $$;
reset role;
rollback;
