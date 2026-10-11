-- Einmalig im Supabase SQL-Editor ausführen (Projekt "Honig Filz"):
-- schaltet das Löschen von Reservierungen, Produkten, Benutzern und Fotos frei
-- und räumt den Spam-Schutz regelmäßig auf.

create or replace function public.admin_delete_reservation(p_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.reservations;
begin
  if not public.is_admin() then raise exception 'nicht berechtigt'; end if;
  select * into r from public.reservations where id = p_id for update;
  if not found then return jsonb_build_object('ok', false); end if;
  if r.status in ('neu','bestaetigt') then perform private.restock(r.id, 1); end if;
  delete from public.reservations where id = r.id;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.admin_delete_reservation(bigint) from public, anon;
grant execute on function public.admin_delete_reservation(bigint) to authenticated;

create or replace function private.cleanup_rate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if random() < 0.05 then delete from public.rate_events where ts < now() - interval '1 day'; end if;
  return null;
end $$;
create trigger rate_cleanup after insert on public.rate_events for each statement execute function private.cleanup_rate();
revoke execute on function private.cleanup_rate() from public, anon, authenticated;

create policy "produkte admin loeschen" on public.products for delete to authenticated using ((select public.is_admin()));
create policy "admins loeschen" on public.admins for delete to authenticated using ((select public.is_admin()) and user_id <> (select auth.uid()));
create policy "bilder admin loeschen" on storage.objects for delete to authenticated using (bucket_id = 'bilder' and (select public.is_admin()));

-- Test-Reservierung vom Einrichten entfernen
delete from public.reservations where name = 'TEST (bitte löschen)';
