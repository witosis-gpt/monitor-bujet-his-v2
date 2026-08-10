-- Task E2: production access policy. Apply before deployment.
-- Removes the temporary anonymous development policies from migration 001.
drop policy if exists "dev anon read snapshots" on public.sakti_snapshots;
drop policy if exists "dev anon write snapshots" on public.sakti_snapshots;
revoke all on public.sakti_snapshots from anon;
grant select, insert, update on public.sakti_snapshots to authenticated;

create policy "authenticated read snapshots" on public.sakti_snapshots
  for select to authenticated using (true);
create policy "authenticated insert snapshots" on public.sakti_snapshots
  for insert to authenticated with check (true);
create policy "authenticated update snapshots" on public.sakti_snapshots
  for update to authenticated using (true) with check (true);
