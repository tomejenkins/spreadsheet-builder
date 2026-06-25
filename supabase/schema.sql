-- Spreadsheet Fixer Supabase schema.
-- Run this file in the Supabase SQL Editor. Server-side Cloudflare Functions use SUPABASE_SECRET_KEY.
-- RLS is enabled and no public policies are granted for jobs, job_events, or webhook_events.
-- Add authenticated admin policies later if you build a real admin login.

create extension if not exists pgcrypto;

create table if not exists public.packages (
  id text primary key,
  name text not null,
  package_type text not null,
  price_cents integer not null,
  currency text default 'usd',
  is_deposit boolean default false,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  status text default 'paid_no_intake',
  payment_status text default 'unpaid',
  scope_review_required boolean default false,
  package_id text references public.packages(id),
  package_name text,
  package_type text,
  amount_paid_cents integer,
  currency text default 'usd',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  customer_email text,
  customer_name text,
  customer_phone text,
  business_name text,
  spreadsheet_platform text,
  project_description text,
  project_goal text,
  broken_or_needed_details text,
  file_link text,
  access_notes text,
  desired_deadline text,
  terms_acknowledged boolean default false,
  internal_notes text,
  source text default 'website'
);

create table if not exists public.job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  created_at timestamptz default now(),
  event_type text not null,
  event_payload jsonb
);

create table if not exists public.webhook_events (
  id text primary key,
  provider text not null,
  created_at timestamptz default now(),
  processed_at timestamptz,
  event_type text,
  payload jsonb
);

create index if not exists jobs_created_at_idx on public.jobs(created_at desc);
create index if not exists jobs_status_idx on public.jobs(status);
create index if not exists jobs_payment_status_idx on public.jobs(payment_status);
create index if not exists jobs_stripe_checkout_session_id_idx on public.jobs(stripe_checkout_session_id);
create index if not exists jobs_customer_email_idx on public.jobs(customer_email);
create index if not exists job_events_job_id_created_at_idx on public.job_events(job_id, created_at desc);

create or replace view public.jobs_sheet_export as
select
  id as job_id,
  created_at,
  updated_at,
  status,
  payment_status,
  scope_review_required,
  package_id,
  package_name,
  package_type,
  amount_paid_cents,
  round((amount_paid_cents::numeric / 100), 2) as amount_paid_dollars,
  customer_name,
  customer_email,
  customer_phone,
  business_name,
  spreadsheet_platform,
  desired_deadline,
  left(coalesce(project_description, broken_or_needed_details, ''), 240) as short_project_description,
  file_link,
  access_notes
from public.jobs;

alter table public.packages enable row level security;
alter table public.jobs enable row level security;
alter table public.job_events enable row level security;
alter table public.webhook_events enable row level security;

-- No public RLS policies are created intentionally.
-- Cloudflare server routes use SUPABASE_SECRET_KEY/service-role privileges for all writes and private reads.
-- Add explicit authenticated admin SELECT/UPDATE policies later when replacing the temporary admin password route.

insert into public.packages (id, name, package_type, price_cents, currency, is_deposit, active) values
  ('quick_fix', 'Quick Fix', 'repair', 9900, 'usd', false, true),
  ('spreadsheet_repair', 'Spreadsheet Repair', 'repair', 24900, 'usd', false, true),
  ('custom_dashboard_deposit', 'Custom Tracker / Dashboard Build Deposit', 'build_deposit', 14900, 'usd', true, true),
  ('automation_deposit', 'Automation / Connected Data Diagnostic Deposit', 'automation_deposit', 14900, 'usd', true, true)
on conflict (id) do update set
  name = excluded.name,
  package_type = excluded.package_type,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  is_deposit = excluded.is_deposit,
  active = excluded.active;
