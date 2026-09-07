-- Draft Pro foundation. Provider and payment writes are server-only; browser
-- clients may read only their own non-secret records through RLS.
create table public.draft_pro_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  season text not null default 'draft_pro_2026_27' check (season = 'draft_pro_2026_27'),
  provider text not null default 'stripe' check (provider = 'stripe'),
  provider_checkout_session_id text unique,
  provider_payment_intent_id text unique,
  amount_cents integer not null default 599 check (amount_cents = 599),
  currency text not null default 'usd' check (currency = 'usd'),
  status text not null default 'pending' check (status in ('pending', 'active', 'refunded', 'disputed', 'failed', 'expired')),
  activated_at timestamptz,
  refunded_at timestamptz,
  expires_at timestamptz not null default '2027-07-01T04:00:00Z',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.draft_pro_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe', 'patreon')),
  provider_event_id text not null,
  event_type text not null check (char_length(event_type) between 1 and 160),
  user_id uuid references auth.users(id) on delete set null,
  purchase_id uuid references public.draft_pro_purchases(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text check (processing_error is null or char_length(processing_error) <= 2000),
  unique (provider, provider_event_id)
);

create table public.draft_pro_refund_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purchase_id uuid not null references public.draft_pro_purchases(id) on delete restrict,
  reason text not null check (reason in ('accidental_purchase', 'technical_issue', 'missing_feature', 'confusing_experience', 'not_useful_for_my_draft', 'other')),
  explanation text not null check (char_length(explanation) between 10 and 2000),
  improvement_notes text check (improvement_notes is null or char_length(improvement_notes) <= 2000),
  used_during_live_draft boolean,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'declined', 'withdrawn')),
  submitted_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 2000),
  email_status text not null default 'pending' check (email_status in ('pending', 'sent', 'failed')),
  email_attempts integer not null default 0 check (email_attempts >= 0),
  email_last_error text check (email_last_error is null or char_length(email_last_error) <= 2000),
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index draft_pro_one_open_refund_request_per_purchase
  on public.draft_pro_refund_requests(purchase_id) where status in ('open', 'reviewing');

create table public.draft_pro_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  season text not null default 'draft_pro_2026_27' check (season = 'draft_pro_2026_27'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'archived')),
  schema_version integer not null default 1 check (schema_version between 1 and 1),
  lock_version integer not null default 0 check (lock_version >= 0),
  snapshot jsonb not null default '{}'::jsonb,
  snapshot_bytes integer not null default 0 check (snapshot_bytes between 0 and 10485760),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index draft_pro_drafts_owner_updated_idx on public.draft_pro_drafts(user_id, updated_at desc);

create table public.draft_pro_private_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_id uuid references public.draft_pro_drafts(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  content_type text not null check (content_type in ('text/csv', 'application/json')),
  storage_path text not null unique check (char_length(storage_path) between 1 and 500),
  normalized_rows jsonb not null default '[]'::jsonb,
  mapping jsonb not null default '{}'::jsonb,
  byte_size integer not null check (byte_size between 1 and 10485760),
  row_count integer not null default 0 check (row_count between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index draft_pro_private_imports_owner_idx on public.draft_pro_private_imports(user_id, created_at desc);

create table public.draft_pro_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_id uuid references public.draft_pro_drafts(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  schema_version integer not null default 1 check (schema_version between 1 and 1),
  source_fingerprint text not null check (char_length(source_fingerprint) between 1 and 128),
  input jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.draft_pro_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_id uuid references public.draft_pro_drafts(id) on delete set null,
  scenario_id uuid references public.draft_pro_scenarios(id) on delete set null,
  report_type text not null check (report_type in ('draft_summary', 'scenario_comparison')),
  schema_version integer not null default 1 check (schema_version between 1 and 1),
  source_fingerprint text not null check (char_length(source_fingerprint) between 1 and 128),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index draft_pro_reports_owner_created_idx on public.draft_pro_reports(user_id, created_at desc);

alter table public.draft_pro_purchases enable row level security;
alter table public.draft_pro_provider_events enable row level security;
alter table public.draft_pro_refund_requests enable row level security;
alter table public.draft_pro_drafts enable row level security;
alter table public.draft_pro_private_imports enable row level security;
alter table public.draft_pro_scenarios enable row level security;
alter table public.draft_pro_reports enable row level security;

revoke all on table public.draft_pro_purchases, public.draft_pro_provider_events, public.draft_pro_refund_requests, public.draft_pro_drafts, public.draft_pro_private_imports, public.draft_pro_scenarios, public.draft_pro_reports from anon, authenticated;
grant select, insert, update, delete on table public.draft_pro_purchases, public.draft_pro_provider_events, public.draft_pro_refund_requests, public.draft_pro_drafts, public.draft_pro_private_imports, public.draft_pro_scenarios, public.draft_pro_reports to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('draft-pro-private-imports', 'draft-pro-private-imports', false, 10485760, array['text/csv', 'application/json'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy draft_pro_private_imports_service_role on storage.objects
  for all to service_role using (bucket_id = 'draft-pro-private-imports') with check (bucket_id = 'draft-pro-private-imports');
create policy draft_pro_private_imports_deny_authenticated on storage.objects as restrictive
  for all to authenticated using (bucket_id <> 'draft-pro-private-imports') with check (bucket_id <> 'draft-pro-private-imports');
create policy draft_pro_private_imports_deny_anon on storage.objects as restrictive
  for all to anon using (bucket_id <> 'draft-pro-private-imports') with check (bucket_id <> 'draft-pro-private-imports');
grant select, insert, update, delete on storage.objects to service_role;

create trigger draft_pro_purchases_touch_updated_at before update on public.draft_pro_purchases for each row execute function public.update_updated_at_column();
create trigger draft_pro_refund_requests_touch_updated_at before update on public.draft_pro_refund_requests for each row execute function public.update_updated_at_column();
create trigger draft_pro_drafts_touch_updated_at before update on public.draft_pro_drafts for each row execute function public.update_updated_at_column();
create trigger draft_pro_private_imports_touch_updated_at before update on public.draft_pro_private_imports for each row execute function public.update_updated_at_column();
create trigger draft_pro_scenarios_touch_updated_at before update on public.draft_pro_scenarios for each row execute function public.update_updated_at_column();
