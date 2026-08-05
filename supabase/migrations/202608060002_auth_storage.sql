create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'role' = 'admin' then 'admin' else 'designer' end,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into storage.buckets (id, name, public)
values ('artworks', 'artworks', false)
on conflict (id) do nothing;

create policy "artworks_read_authenticated"
on storage.objects for select to authenticated
using (bucket_id = 'artworks');

create policy "artworks_upload_own_folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'artworks'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "artworks_update_own_folder"
on storage.objects for update to authenticated
using (
  bucket_id = 'artworks'
  and (storage.foldername(name))[1] = auth.uid()::text
);
