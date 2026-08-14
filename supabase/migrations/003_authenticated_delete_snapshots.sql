grant delete
on public.sakti_snapshots
to authenticated;

create policy "authenticated delete snapshots"
on public.sakti_snapshots
for delete
to authenticated
using (true);
