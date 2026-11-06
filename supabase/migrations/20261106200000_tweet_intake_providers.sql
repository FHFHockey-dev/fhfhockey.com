-- Per-account switch for the IFTTT → FxTwitter cutover (tasks/artifacts/cross-platform/2026-10-24-coordination/
-- handoffs/IFTTT-TO-FXTWITTER-CUTOVER/DEBRIEF.md §6.2). Exactly one intake feeds each account's live queue:
--   'ifttt'     the IFTTT webhook receivers insert pending rows (today's behaviour);
--   'fxtwitter' the x-timeline-poll scraper inserts them, and the receivers acknowledge and ignore that account.
-- Switching or rolling back is a one-row update. switched_at is set by the trigger whenever provider changes; the
-- scraper enqueues only posts it first saw at or after it, so posts IFTTT already delivered are not processed twice.
-- Applied to production 2026-11-06 by TJ in the SQL editor (so the CLI history needs
-- `supabase migration repair --status applied 20261106200000`). All seven accounts are seeded as 'ifttt', so it
-- changes nothing until a row is switched.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.tweet_intake_providers (
  source_key text primary key check (btrim(source_key) <> ''),
  provider text not null default 'ifttt' check (provider in ('ifttt', 'fxtwitter')),
  switched_at timestamptz not null default now(),
  note text,
  updated_at timestamptz not null default now()
);

comment on table public.tweet_intake_providers is
  'Which intake (ifttt or fxtwitter) feeds each tracked X account''s live tweet queue. See the IFTTT-TO-FXTWITTER-CUTOVER debrief.';

create or replace function public.tweet_intake_providers_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.provider is distinct from old.provider then
    new.switched_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists tweet_intake_providers_touch on public.tweet_intake_providers;
create trigger tweet_intake_providers_touch
  before update on public.tweet_intake_providers
  for each row execute function public.tweet_intake_providers_touch();

-- Service role only, as for the queues and the shadow table.
alter table public.tweet_intake_providers enable row level security;
revoke all on table public.tweet_intake_providers from public, anon, authenticated;
grant select, insert, update, delete on table public.tweet_intake_providers to service_role;
revoke all on function public.tweet_intake_providers_touch() from public, anon, authenticated;

insert into public.tweet_intake_providers (source_key, note) values
  ('dfofantasy', 'DFOFantasy'),
  ('nhl_rosters', 'NHL_Rosters'),
  ('ccc', 'CcCMiddleton'),
  ('gamedaylines', 'GameDayLines'),
  ('gamedaynewsnhl', 'GameDayNewsNHL'),
  ('gamedaygoalies', 'GameDayGoalies'),
  ('fhfhockey', 'FHFHockey: social_share_x_posts, not a line queue (cutover phase P6)')
on conflict (source_key) do nothing;
