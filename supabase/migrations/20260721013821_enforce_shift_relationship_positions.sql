-- Prevent relationship-column writes with missing or internally inconsistent
-- position metadata. A column-specific trigger preserves unrelated updates to
-- incomplete historical rows while enforcing every new relationship write.

begin;

set lock_timeout = '5s';
set statement_timeout = '60s';

create or replace function public.enforce_shift_relationship_position_complete_v1()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.shifts is not null
    and (
      new.display_position is null
      or pg_catalog.btrim(new.display_position) = ''
      or new.display_position !~ '^(C|LW|RW|D|G)(,(C|LW|RW|D|G))*$'
      or new.primary_position is null
      or new.primary_position not in ('C', 'LW', 'RW', 'D', 'G')
      or new.player_type is null
      or new.player_type not in ('F', 'D', 'G')
      or new.player_type is distinct from case
        when new.primary_position = 'G' then 'G'::character
        when new.primary_position = 'D' then 'D'::character
        when new.primary_position in ('C', 'LW', 'RW') then 'F'::character
        else null::character
      end
      or not (
        pg_catalog.string_to_array(new.display_position, ',')
          @> array[new.primary_position::text]
      )
      or exists (
        select 1
        from pg_catalog.unnest(
          pg_catalog.string_to_array(new.display_position, ',')
        ) as displayed(position)
        where new.player_type is distinct from case
          when displayed.position = 'G' then 'G'::character
          when displayed.position = 'D' then 'D'::character
          when displayed.position in ('C', 'LW', 'RW') then 'F'::character
          else null::character
        end
      )
      or pg_catalog.cardinality(
        pg_catalog.string_to_array(new.display_position, ',')
      ) is distinct from (
        select pg_catalog.count(distinct displayed.position)::integer
        from pg_catalog.unnest(
          pg_catalog.string_to_array(new.display_position, ',')
        ) as displayed(position)
      )
    )
  then
    raise exception using
      errcode = '23514',
      message = 'SHIFT_RELATIONSHIP_POSITION_INCOMPLETE',
      constraint = 'shift_charts_relationship_position_complete_check';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_shift_relationship_position_complete_v1()
  from public, anon, authenticated, service_role;

drop trigger if exists shift_charts_relationship_position_complete
  on public.shift_charts;

create trigger shift_charts_relationship_position_complete
before insert or update of
  shifts,
  display_position,
  primary_position,
  player_type
on public.shift_charts
for each row
execute function public.enforce_shift_relationship_position_complete_v1();

commit;
