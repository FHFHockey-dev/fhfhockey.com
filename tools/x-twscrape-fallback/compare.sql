-- Read-only shadow evaluation: twscrape observations (layer 3) against x_timeline_shadow_posts (layer 1, FxTwitter).
-- Run in the Supabase SQL editor. Lists every post in the last 24 hours that only one layer has, or whose fields differ.
-- A post first seen by either layer in the window is compared with the other layer's row whenever that was stored.
with start as (
  select greatest(now() - interval '24 hours', min(first_observed_at)) as at from public.x_timeline_twscrape_observations
), keys as (
  select source_key, tweet_id from public.x_timeline_twscrape_observations, start where first_observed_at >= start.at
  union
  select source_key, tweet_id from public.x_timeline_shadow_posts, start where first_seen_at >= start.at
), obs as (
  select o.* from public.x_timeline_twscrape_observations o join keys using (source_key, tweet_id)
), fx as (
  select f.* from public.x_timeline_shadow_posts f join keys using (source_key, tweet_id)
)
select
  coalesce(o.source_key, f.source_key) as source_key,
  coalesce(o.tweet_id, f.tweet_id) as tweet_id,
  case when f.tweet_id is null then 'twscrape_only' when o.tweet_id is null then 'fxtwitter_only' else 'both' end as seen_by,
  o.first_observed_at - f.first_seen_at as twscrape_lead_lag,
  nullif(concat_ws(',',
    case when o.post_kind is distinct from f.post_kind then 'post_kind' end,
    case when o.author_handle is distinct from f.author_handle then 'author' end,
    case when o.reposted_by_handle is distinct from f.reposted_by_handle then 'reposted_by' end,
    case when o.quoted_tweet_id is distinct from f.quoted_tweet_id then 'quoted_id' end,
    case when o.replying_to_handle is distinct from f.replying_to_handle then 'replying_to' end,
    case when o.tweet_created_at is distinct from f.tweet_created_at then 'created_at' end,
    case when o.full_text is distinct from f.full_text then 'full_text' end,
    case when o.has_media is distinct from f.has_media then 'has_media' end,
    case when o.media_alt_texts is distinct from f.media_alt_texts then 'alt_texts' end,
    case when o.link_to_tweet is distinct from f.link_to_tweet then 'link' end
  ), '') as differs
from obs o
full join fx f using (source_key, tweet_id)
where f.tweet_id is null or o.tweet_id is null
   or row(o.post_kind, o.author_handle, o.reposted_by_handle, o.quoted_tweet_id, o.replying_to_handle, o.tweet_created_at,
          o.full_text, o.has_media, o.media_alt_texts, o.link_to_tweet)
      is distinct from
      row(f.post_kind, f.author_handle, f.reposted_by_handle, f.quoted_tweet_id, f.replying_to_handle, f.tweet_created_at,
          f.full_text, f.has_media, f.media_alt_texts, f.link_to_tweet)
order by 1, 2 desc;
