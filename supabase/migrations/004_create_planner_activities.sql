-- Module 4 planning records are deliberately separate from sakti_snapshots.
-- Apply this migration to the Supabase project before enabling cloud persistence.
create table if not exists public.planner_activities (
  id uuid primary key,
  activity_name text not null check (char_length(activity_name) between 1 and 180),
  activity_date date not null,
  directorates jsonb not null default '[]'::jsonb,
  status text not null check (status in ('draft', 'confirmed')),
  budget_lines jsonb not null default '[]'::jsonb,
  total_amount numeric(18,2) not null default 0 check (total_amount >= 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.planner_activities enable row level security;
revoke all on table public.planner_activities from anon, authenticated;
grant select, insert, update, delete on table public.planner_activities to authenticated;

create policy "authenticated read planner activities" on public.planner_activities for select to authenticated using (true);
create policy "authenticated insert planner activities" on public.planner_activities for insert to authenticated with check (true);
create policy "authenticated update planner activities" on public.planner_activities for update to authenticated using (true) with check (true);
create policy "authenticated delete planner activities" on public.planner_activities for delete to authenticated using (true);
