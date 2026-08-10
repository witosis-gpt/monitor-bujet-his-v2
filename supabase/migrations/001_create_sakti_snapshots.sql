-- Task E1: normalized SAKTI snapshot persistence.
-- TEMPORARY INSECURE DEV POLICY: replace with authenticated RLS in Task E2.
create table if not exists public.sakti_snapshots (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  month integer not null check (month between 1 and 12),
  period_label text not null,
  source_type text not null check (source_type in ('sp2d', 'accrual')),
  satker_code text,
  satker_name text,
  filename text,
  imported_at timestamptz not null default now(),
  pagu numeric,
  previous_period numeric,
  current_period numeric,
  cumulative numeric,
  remaining numeric,
  absorption numeric,
  snapshot_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, month, source_type)
);

alter table public.sakti_snapshots enable row level security;

-- TEMPORARY INSECURE DEV POLICY. TODO(Task E2): replace with authenticated ownership policies.
drop policy if exists "dev anon read snapshots" on public.sakti_snapshots;
drop policy if exists "dev anon write snapshots" on public.sakti_snapshots;
create policy "dev anon read snapshots" on public.sakti_snapshots for select to anon using (true);
create policy "dev anon write snapshots" on public.sakti_snapshots for all to anon using (true) with check (true);

grant select, insert, update on public.sakti_snapshots to anon;
