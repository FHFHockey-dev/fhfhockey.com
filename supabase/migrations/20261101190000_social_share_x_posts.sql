-- Social Share landing page: @FHFHockey's own media posts, delivered by one IFTTT applet.
-- LOCAL CANDIDATE: not applied anywhere. Apply only with TJ's explicit approval, BEFORE turning the applet on.
-- Until this table exists, or while it is empty, the landing strip stays on hand marking.
--
-- One row per X post. The first delivery wins: a repeat delivery of a tweet_id is ignored.
-- matched_card is a landing card id (web/lib/socialShare/landingCatalog.ts) read from the alt text's prefix at
-- receipt; null means unmatched, and such a post still counts as posted.
-- Writer: web/pages/api/v1/sources/ifttt/FHFHockey-post.ts. Reader: web/pages/api/v1/social-share/posted-week.ts.
-- Both use the service role, after their own secret or editor check, so no other role has any access.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.social_share_x_posts (
  tweet_id text primary key check (tweet_id ~ '^[0-9]+$'),
  post_link text not null check (btrim(post_link) <> ''),
  username text,
  -- The post's own time from IFTTT, or the receipt time if IFTTT sent a date that could not be read.
  posted_at timestamptz not null,
  created_at_label text,
  post_text text,
  alt_text text,
  matched_card text,
  raw_payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

comment on table public.social_share_x_posts is 'FHFHockey media posts from IFTTT, for the Social Share landing strip. No likes or views: there is no free official source.';

create index if not exists social_share_x_posts_posted_at_idx on public.social_share_x_posts (posted_at);

-- RLS on with no policies, and Supabase's default grants taken back: only the service role can reach this table.
alter table public.social_share_x_posts enable row level security;
revoke all on table public.social_share_x_posts from public, anon, authenticated;
grant select, insert, update, delete on table public.social_share_x_posts to service_role;
