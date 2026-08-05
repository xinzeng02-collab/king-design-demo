grant usage on schema public to authenticated;

grant select on table public.profiles to authenticated;
grant select, insert, update, delete on table public.works to authenticated;

grant execute on function public.is_admin() to authenticated;
