create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'designer' check (role in ('admin', 'designer')),
  display_name text not null,
  created_at timestamptz not null default now()
);

create table public.works (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 160),
  status text not null default 'uploading' check (status in ('uploading', 'ready', 'failed', 'pending_review', 'approved', 'revision')),
  file_name text,
  storage_key text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index works_owner_updated_idx on public.works (owner_id, updated_at desc);
create index works_status_updated_idx on public.works (status, updated_at desc);

alter table public.profiles enable row level security;
alter table public.works enable row level security;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

create policy "profiles are readable to signed-in users"
on public.profiles for select to authenticated using (true);
create policy "profiles can be created only for self"
on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "users can update their own profile"
on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "signed-in users can read works"
on public.works for select to authenticated using (true);
create policy "users can create their own works"
on public.works for insert to authenticated with check (owner_id = auth.uid());
create policy "owners and admins can update works"
on public.works for update to authenticated using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());

insert into storage.buckets (id, name, public) values ('artworks', 'artworks', false)
on conflict (id) do nothing;
create policy "signed-in users can read artwork"
on storage.objects for select to authenticated using (bucket_id = 'artworks');
create policy "users can upload only to their own folder"
on storage.objects for insert to authenticated with check (bucket_id = 'artworks' and (storage.foldername(name))[1] = auth.uid()::text);

alter publication supabase_realtime add table public.works;
