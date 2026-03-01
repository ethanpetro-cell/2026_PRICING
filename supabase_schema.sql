-- ── Old Goats Pricing Tool — Supabase Schema ────────────────────
-- Run this entire file in your Supabase SQL Editor (one paste, one run)
-- Dashboard → SQL Editor → New query → paste → Run

-- Projects table
create table if not exists og_projects (
  id         text primary key,
  data       text not null,          -- full JSON blob of the project entry
  updated_at timestamptz default now()
);

-- Change orders table
create table if not exists og_change_orders (
  id         text primary key,       -- "{projectId}_{coId}"
  project_id text not null,
  co_id      text not null,
  data       text not null,          -- full JSON blob of the CO
  updated_at timestamptz default now()
);

-- Settings table (stateConfig, userPerms, templates)
create table if not exists og_settings (
  key        text primary key,
  value      text not null,          -- JSON-serialized value
  updated_at timestamptz default now()
);

-- Indexes
create index if not exists og_projects_updated    on og_projects    (updated_at desc);
create index if not exists og_cos_project_id      on og_change_orders (project_id);
create index if not exists og_cos_updated         on og_change_orders (updated_at desc);

-- Row Level Security: allow anon key full access (tool uses anon key directly)
-- This is appropriate for an internal tool on a private Vercel deployment.
-- If you add auth later, tighten these policies.
alter table og_projects      enable row level security;
alter table og_change_orders enable row level security;
alter table og_settings      enable row level security;

create policy "anon full access projects"
  on og_projects for all using (true) with check (true);

create policy "anon full access change_orders"
  on og_change_orders for all using (true) with check (true);

create policy "anon full access settings"
  on og_settings for all using (true) with check (true);
