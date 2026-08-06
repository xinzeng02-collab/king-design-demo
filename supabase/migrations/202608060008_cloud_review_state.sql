alter table public.works
  add column if not exists review_action text,
  add column if not exists review_note text,
  add column if not exists review_logs jsonb not null default '[]'::jsonb,
  add column if not exists sleeping boolean not null default false,
  add column if not exists submission_round integer not null default 1 check (submission_round > 0),
  add column if not exists resubmitted_at timestamptz;

create index if not exists works_review_queue_idx
  on public.works (status, sleeping, created_at desc)
  where deleted_at is null;
