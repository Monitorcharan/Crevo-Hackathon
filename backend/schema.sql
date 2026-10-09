-- Run in the Supabase SQL editor before enabling Supabase mode.
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role text not null check (role in ('creator','brand')),
  company_name text not null default '', logo_url text,
  firebase_uid text unique,
  created_at timestamptz not null default now()
);
alter table public.users add column if not exists firebase_uid text unique;
alter table public.users add column if not exists company_name text not null default '';
alter table public.users add column if not exists logo_url text;
create table if not exists public.creators (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid unique references public.users(id) on delete set null,
  name text not null, title text not null default '', bio text not null default '',
  location text not null default '', categories jsonb not null default '[]'::jsonb,
  skills jsonb not null default '[]'::jsonb, platforms jsonb not null default '[]'::jsonb,
  social_links jsonb not null default '{}'::jsonb,
  audience integer not null default 0, rate integer not null default 0,
  avatar_url text, contact_email text, verified_at timestamptz,
  portfolio text not null default '', portfolio_source text not null default 'manual',
  created_at timestamptz not null default now()
);
alter table public.creators add column if not exists social_links jsonb not null default '{}'::jsonb;
alter table public.creators add column if not exists contact_email text;
alter table public.creators add column if not exists verified_at timestamptz;
create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  title text not null, description text not null default '',
  media_url text not null, media_type text not null,
  tools jsonb not null default '[]'::jsonb,
  workflow text not null default '', format text not null default '',
  commercial_use text not null default '',
  verification text not null default 'self-reported',
  created_at timestamptz not null default now()
);
create table if not exists public.briefs (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.users(id),
  title text not null, description text not null, category text not null,
  skills jsonb not null default '[]'::jsonb, platforms jsonb not null default '[]'::jsonb,
  budget integer not null default 0, location text not null default '',
  content_type text not null default '', style text not null default '',
  format text not null default '', commercial_use text not null default '',
  status text not null default 'open', created_at timestamptz not null default now()
);
alter table public.briefs add column if not exists content_type text not null default '';
alter table public.briefs add column if not exists style text not null default '';
alter table public.briefs add column if not exists format text not null default '';
alter table public.briefs add column if not exists commercial_use text not null default '';
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(), brief_id uuid not null references public.briefs(id) on delete cascade,
  creator_id uuid not null references public.creators(id), note text not null,
  status text not null default 'pending', created_at timestamptz not null default now(),
  unique(brief_id, creator_id)
);
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(), brief_id uuid not null references public.briefs(id),
  creator_id uuid not null references public.creators(id), brand_id uuid not null references public.users(id),
  status text not null default 'active', created_at timestamptz not null default now(),
  unique(brief_id, creator_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  sender_id uuid not null references public.users(id), body text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.contact_threads (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.users(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  kind text not null check (kind in ('question','quote')),
  subject text not null, message text not null, budget integer, timeline text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(), thread_id uuid not null references public.contact_threads(id) on delete cascade,
  sender_id uuid not null references public.users(id), body text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(), project_id uuid not null unique references public.projects(id) on delete cascade,
  brand_id uuid not null references public.users(id), creator_id uuid not null references public.creators(id),
  rating integer not null check (rating between 1 and 5), body text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.creators(id) on delete cascade,
  evidence_url text not null, statement text not null, status text not null check (status in ('pending','approved','rejected')),
  decision_note text not null default '', reviewed_by uuid references public.users(id), reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists contact_threads_brand_idx on public.contact_threads(brand_id);
create index if not exists contact_threads_creator_idx on public.contact_threads(creator_id);
create index if not exists contact_messages_thread_idx on public.contact_messages(thread_id,created_at);
create index if not exists reviews_creator_idx on public.reviews(creator_id);
create index if not exists verification_requests_creator_idx on public.verification_requests(creator_id);
create index if not exists briefs_owner_idx on public.briefs(owner_id);
create index if not exists applications_brief_idx on public.applications(brief_id);
create index if not exists messages_project_idx on public.messages(project_id,created_at);

-- The API validates access and uses the service role key only on the server.
-- Keep direct client access closed; never expose the service role key to Vite.
alter table public.users enable row level security;
alter table public.creators enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.briefs enable row level security;
alter table public.applications enable row level security;
alter table public.projects enable row level security;
alter table public.messages enable row level security;
alter table public.contact_threads enable row level security;
alter table public.contact_messages enable row level security;
alter table public.reviews enable row level security;
alter table public.verification_requests enable row level security;

-- New Supabase projects may not grant Data API access to new tables by default.
-- Crevo's browser talks only to FastAPI; only the server's service role needs table access.
revoke all on table public.users, public.creators, public.portfolio_items,
  public.briefs, public.applications, public.projects, public.messages,
  public.contact_threads, public.contact_messages, public.reviews, public.verification_requests
  from anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.users, public.creators,
  public.portfolio_items, public.briefs, public.applications,
  public.projects, public.messages, public.contact_threads, public.contact_messages,
  public.reviews, public.verification_requests to service_role;

insert into storage.buckets(id,name,public)
values ('portfolios','portfolios',true)
on conflict (id) do nothing;
