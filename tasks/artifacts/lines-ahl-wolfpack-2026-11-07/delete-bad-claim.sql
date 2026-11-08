-- AHL Wolf Pack post (tweet 2119183971926130848) accepted as NYR: remove its one Lines evidence claim and capture.
-- TJ-approved 2026-11-07; TJ runs this in the Supabase SQL editor. One transaction: any error rolls everything back.
do $$
declare n int;
begin
  alter table public.line_claim_revisions disable trigger immutable_evidence;
  alter table public.line_source_captures disable trigger immutable_evidence;
  delete from public.line_claim_revisions where claim_id = 'f2006d68a802d8655a97e3052c3551c93787fb04e82b01ade40f47061c0486e7';
  get diagnostics n = row_count; if n <> 1 then raise exception 'expected 1 claim row, got %', n; end if;
  delete from public.line_source_captures where capture_id = '124f265bb229645d21ae30b1792a18ceb7b58040200944bebc7c48f7e9d0c8be';
  get diagnostics n = row_count; if n <> 1 then raise exception 'expected 1 capture row, got %', n; end if;
  alter table public.line_claim_revisions enable trigger immutable_evidence;
  alter table public.line_source_captures enable trigger immutable_evidence;
end $$;

-- Read-back: expect 0, 0, and both triggers 'O' (enabled).
select (select count(*) from public.line_claim_revisions where claim_id = 'f2006d68a802d8655a97e3052c3551c93787fb04e82b01ade40f47061c0486e7') as claim_rows,
       (select count(*) from public.line_source_captures where capture_id = '124f265bb229645d21ae30b1792a18ceb7b58040200944bebc7c48f7e9d0c8be') as capture_rows,
       (select string_agg(tgrelid::regclass::text || ':' || tgenabled::text, ',') from pg_trigger
         where tgname = 'immutable_evidence' and tgrelid::regclass::text in ('line_claim_revisions', 'line_source_captures')) as triggers;
