alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
check (role in ('admin', 'designer', 'painter', 'sales'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    'designer',
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;
