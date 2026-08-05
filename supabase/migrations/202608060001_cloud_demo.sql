-- KiNG DESiGN cloud demo schema
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, role text not null default 'designer' check (role in ('admin','designer')), display_name text not null);
create table public.works (id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id), title text not null, status text not null default 'uploading', storage_key text, created_at timestamptz not null default now());
alter table public.profiles enable row level security;
alter table public.works enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy works_read on public.works for select to authenticated using (true);
create policy works_insert on public.works for insert to authenticated with check (owner_id = auth.uid());
alter publication supabase_realtime add table public.works;
