-- PROPOSED BOUNDED PRODUCTION READ #3 (read-only; for Chef to put to TJ). The accepted news cards the H10 material
-- path consumes (web/lib/forge-v2/h10NewsRoute.server.ts H10_NEWS_SQL), bound to 2026-11-16 onward, for the G2c local
-- replay through h10News.ts. No route run, no official roster fetch. Expected size: a few hundred rows (limit 500).
-- Columns: card id, status, category/subcategory, author handle, post ids/URL, club, headline, post/publish/update
-- times, and the attached players (id, club, role). Public league news; no account data.
begin read only;
set local statement_timeout = '30s';
select i.id::text as id, i.card_status, i.category, i.subcategory, i.source_account, i.source_tweet_id, i.original_tweet_id, i.tweet_url,
  i.team_id::int as team_id, i.headline, i.observed_at, i.published_at, i.updated_at,
  coalesce((select jsonb_agg(jsonb_build_object('player_id', p.player_id, 'team_id', p.team_id, 'role', p.role) order by p.player_id, p.role)
    from public.news_feed_item_players p where p.news_item_id = i.id), '[]'::jsonb) as players
from public.news_feed_items i
where i.updated_at > timestamptz '2026-11-16 00:00:00+00' and i.card_status in ('published', 'archived')
  and upper(i.category) in ('TRADE', 'SIGNING', 'WAIVER', 'ROSTER MOVE', 'RETIREMENT', 'TRANSACTION', 'INJURY', 'REPORTED INJURY', 'SCRATCHES', 'RETURN',
    'RETURNING', 'GOALIE START', 'LINE COMBINATION', 'LINE CHANGE', 'LINEUP', 'PRACTICE LINES')
order by i.updated_at, i.id limit 500;
-- Shape check (no row data): how many cards per category/subcategory and how many carry no observed_at or no player.
select upper(category) as category, upper(coalesce(subcategory, '')) as subcategory, card_status, count(*) as cards,
  count(*) filter (where observed_at is null) as no_post_time,
  count(*) filter (where not exists (select from public.news_feed_item_players p where p.news_item_id = i.id and p.player_id is not null)) as no_player
from public.news_feed_items i where i.updated_at > timestamptz '2026-11-16 00:00:00+00' group by 1, 2, 3 order by 1, 2, 3;
-- Authors (no row data beyond handles): availability needs a club or reviewed beat handle in source_account, so this
-- shows whether accepted cards carry the original author or a relay account.
select lower(coalesce(source_account, '(none)')) as account, count(*) as cards from public.news_feed_items
where updated_at > timestamptz '2026-11-16 00:00:00+00' and card_status = 'published' group by 1 order by 2 desc limit 60;
-- Volume against the route's limit: the most cards changed in any 72 h window since 11-16 (the route throws at 500).
select max(n) as max_cards_in_72h from (select (select count(*) from public.news_feed_items j
  where j.updated_at > i.updated_at - interval '72 hours' and j.updated_at <= i.updated_at) as n
  from public.news_feed_items i where i.updated_at > timestamptz '2026-11-16 00:00:00+00') w;
rollback;
