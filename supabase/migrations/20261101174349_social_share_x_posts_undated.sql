-- Social Share posted source: a post's time can be unknown, and unknown is not the receipt time.
-- Applied to production 2026-11-01 with TJ's approval, version 20261101174349.
-- Without it, a delivery with a missing or unreadable CreatedAt fails its insert and stores nothing.
--
-- A null posted_at marks no day done. A later delivery of the same post with a real date fills it in.
-- Writer: web/pages/api/v1/sources/ifttt/FHFHockey-post.ts. Reader: web/pages/api/v1/social-share/posted-week.ts.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.social_share_x_posts alter column posted_at drop not null;
