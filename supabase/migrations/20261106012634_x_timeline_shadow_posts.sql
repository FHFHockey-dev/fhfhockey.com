-- Shadow intake for the IFTTT replacement: posts and reposts by the seven tracked X accounts, read from FxTwitter's
-- public profile feed (no X login, no Twitter API). Written by supabase/functions/x-timeline-poll.
-- Applied to production 2026-11-05 with TJ's approval, version 20261106012634.
-- Nothing reads this table yet. It runs beside IFTTT so coverage can be compared before cutover; the live queues
-- (line_source_ifttt_events, lines_ccc_ifttt_events, social_share_x_posts) are untouched.
--
-- One row per (source_key, tweet_id). tweet_id is the status FxTwitter returns: the account's own post, or for a
-- repost, the ORIGINAL post (FxTwitter does not expose the repost wrapper's id). The first sighting wins.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.x_timeline_shadow_posts (
  id uuid primary key default gen_random_uuid(),
  source_group text not null check (btrim(source_group) <> ''),
  source_key text not null check (btrim(source_key) <> ''),
  source_account text not null check (btrim(source_account) <> ''),
  tweet_id text not null check (tweet_id ~ '^[0-9]+$'),
  post_kind text not null check (post_kind in ('post', 'repost', 'quote')),
  author_handle text not null,
  -- Repost: the account that reposted (the tracked account) and the nested original's author.
  reposted_by_handle text,
  original_author_handle text,
  -- Quote, including a repost of a quote: the quoted post.
  quoted_tweet_id text check (quoted_tweet_id is null or quoted_tweet_id ~ '^[0-9]+$'),
  quoted_author_handle text,
  quoted_text text,
  replying_to_handle text,
  -- full_text: the post's own full text (the original's, for a repost). text: the same in IFTTT's shape
  -- ("RT @handle: ..." for reposts, quoted post URL appended), so the existing parsers can read it at cutover.
  full_text text,
  text text,
  link_to_tweet text not null,
  tweet_created_at timestamptz,
  has_media boolean not null default false,
  media_alt_texts text[] not null default '{}',
  raw_payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now()
);

create unique index if not exists x_timeline_shadow_posts_source_tweet_idx
  on public.x_timeline_shadow_posts (source_key, tweet_id);
create index if not exists x_timeline_shadow_posts_first_seen_idx
  on public.x_timeline_shadow_posts (source_key, first_seen_at desc);

comment on table public.x_timeline_shadow_posts is
  'Shadow X intake from FxTwitter for the seven tracked accounts, run beside IFTTT before cutover. No consumers yet.';

-- Service role only, as for the IFTTT queues.
alter table public.x_timeline_shadow_posts enable row level security;
revoke all on table public.x_timeline_shadow_posts from public, anon, authenticated;
grant select, insert, update, delete on table public.x_timeline_shadow_posts to service_role;
