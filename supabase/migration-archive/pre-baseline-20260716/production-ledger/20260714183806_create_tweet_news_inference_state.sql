create table if not exists public.tweet_news_inference_state (
  id uuid primary key default gen_random_uuid(),
  review_item_id uuid not null references public.tweet_pattern_review_items(id) on delete cascade,
  source_tweet_id text,
  dedupe_key text not null unique,
  status text not null check (status in ('processing', 'published', 'review', 'error')),
  attempts integer not null default 1 check (attempts > 0),
  model text not null,
  prompt_version text not null,
  decision text,
  category text,
  subcategory text,
  verification_state text,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  result jsonb,
  evidence jsonb not null default '[]'::jsonb,
  error text,
  lease_expires_at timestamptz,
  next_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tweet_news_inference_state_review_item_idx
  on public.tweet_news_inference_state (review_item_id, updated_at desc);
create index if not exists tweet_news_inference_state_retry_idx
  on public.tweet_news_inference_state (status, next_attempt_at)
  where status in ('processing', 'error');
alter table public.tweet_news_inference_state enable row level security;
comment on table public.tweet_news_inference_state is
  'Server-only idempotency, lease, and audit state for model-assisted tweet news classification.';;
