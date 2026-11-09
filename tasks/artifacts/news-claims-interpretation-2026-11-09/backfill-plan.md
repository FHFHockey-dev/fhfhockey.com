# Backfill plan: source interpretation onto published news cards

Status: PLAN ONLY. Not run. Needs TJ's pop-up approval, and the code change must be released first.

## Why the release must come first

`auto-news-feed-items` rewrites the cards behind the newest 300 review items from the last 14 days every 30 minutes. The old code builds card metadata without `interpretation`, so it would erase any backfilled value on its next run.

After the release, that same run adds `interpretation` to those cards by itself. It is a normal update, because the metadata now differs. Only older published cards need this backfill.

## Size (read-only, 2026-11-09 about 21:10 UTC)

The sample covered published cards from the last 45 days, newest 2,000; the 14–45 day bucket was cut off at the limit. The verdicts are a SQL approximation of `getPublicNewsClaimPresentation`.

| Age | Cards | Source has interpretation | Would show claims | Would show "couldn't verify" | No line |
|---|---|---|---|---|---|
| 0–7 d | 463 | 446 | 86 (19%) | 196 (42%) | 181 (39%) |
| 7–14 d | 436 | 436 | 108 (25%) | 215 (49%) | 113 (26%) |
| 14–45 d (first 1,101) | 1,101 | 450 | 116 | 255 | 730 |

"Couldn't verify" still shows when the source interpretation fails the strict check. In the 0–7 day events:
- 99 of 263 events had evidence text not found in the card blurb; 97 of those contain a URL, which the blurb strips.
- 61 of 263 named a player whose full name isn't in the evidence (surname only, for example).

Loosening either rule changes the claim check and needs TJ's call; it is not part of this change.

## Backfill

Scope: published cards whose review item has a `retainedInterpretation` object and whose card metadata has no `interpretation`. Only `version`, `events` and `unresolved` are copied, the same fields the code copies.

Run order:
1. Run the dry count.
2. Create the backup table.
3. Run the batch repeatedly until it returns 0 rows: 200 cards a batch, concurrency 1, about 1 s between batches. Expect about 8 batches for about 1,500 cards.
4. Read back.

Check `pg_stat_activity` before each batch; pause if more than 5 are active or any query is over 10 s.

```sql
-- 1. Dry count (read-only)
select count(*)
from public.news_feed_items c
join public.tweet_pattern_review_items r on r.id = c.source_review_item_id
where c.card_status = 'published'
  and jsonb_typeof(r.metadata->'retainedInterpretation') = 'object'
  and not (coalesce(c.metadata, '{}'::jsonb) ? 'interpretation');

-- 2. Backup table (once)
create table if not exists public.news_feed_items_interp_backfill_20261109 (
  id uuid primary key, metadata jsonb, backed_up_at timestamptz not null default now());

-- 3. One batch (repeat until it returns 0 rows)
with batch as (
  select c.id, c.metadata,
    (select jsonb_object_agg(k, r.metadata->'retainedInterpretation'->k)
       from unnest(array['version', 'events', 'unresolved']) k
      where r.metadata->'retainedInterpretation' ? k) as interp
  from public.news_feed_items c
  join public.tweet_pattern_review_items r on r.id = c.source_review_item_id
  where c.card_status = 'published'
    and jsonb_typeof(r.metadata->'retainedInterpretation') = 'object'
    and not (coalesce(c.metadata, '{}'::jsonb) ? 'interpretation')
  order by c.published_at desc
  limit 200
), saved as (
  insert into public.news_feed_items_interp_backfill_20261109 (id, metadata)
  select id, metadata from batch
  on conflict (id) do nothing
  returning id
)
update public.news_feed_items c
set metadata = coalesce(c.metadata, '{}'::jsonb) || jsonb_build_object('interpretation', b.interp),
    updated_at = now()
from batch b
where c.id = b.id and b.interp is not null and b.id in (select id from saved)
returning c.id;

-- 4. Readback
select count(*) from public.news_feed_items c
join public.news_feed_items_interp_backfill_20261109 b on b.id = c.id
where c.metadata ? 'interpretation';
```

Note: a batch row whose `interp` is null would be selected again on the next batch, which would never finish. The `jsonb_typeof(...) = 'object'` filter makes `interp` non-null unless the object has none of the three keys. If a batch returns fewer rows than it saved, stop and inspect.

## Rollback

```sql
update public.news_feed_items c
set metadata = b.metadata, updated_at = now()
from public.news_feed_items_interp_backfill_20261109 b
where c.id = b.id;
-- after TJ confirms: drop table public.news_feed_items_interp_backfill_20261109;
```

The code rollback is reverting the commit. Cards without `interpretation` then show no "couldn't verify" line only after the copy-rule change is also reverted.
