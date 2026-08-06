alter table public.works
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

create index if not exists works_deleted_updated_idx
  on public.works (deleted_at, updated_at desc);
