-- 管理工作台的服务端权威状态。保留前端当前数据形状，便于渐进迁移。
create table if not exists studio_states (
  organization_id uuid primary key references organizations(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  revision bigint not null default 0 check (revision >= 0),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table studio_states enable row level security;

create policy studio_states_staff_read on studio_states for select using (
  current_role_in(organization_id) in ('admin','boss','finance','sales','designer','painter')
);

-- 写入统一经过 Worker service_role，并在应用层校验管理员角色和 revision。
create or replace function replace_studio_state(
  p_organization_id uuid,
  p_state jsonb,
  p_expected_revision bigint,
  p_updated_by uuid
) returns setof studio_states
language plpgsql security definer set search_path = public as $$
begin
  insert into studio_states (organization_id, state, revision, updated_by)
  select p_organization_id, p_state, 1, p_updated_by
  where p_expected_revision = 0
  on conflict (organization_id) do update
    set state = excluded.state,
        revision = studio_states.revision + 1,
        updated_by = excluded.updated_by,
        updated_at = now()
    where studio_states.revision = p_expected_revision;
  return query select * from studio_states
    where organization_id = p_organization_id
      and revision = p_expected_revision + 1;
end $$;

create or replace function update_studio_module(
  p_organization_id uuid,
  p_module text,
  p_value jsonb,
  p_expected_revision bigint,
  p_updated_by uuid
) returns setof studio_states
language plpgsql security definer set search_path = public as $$
begin
  insert into studio_states (organization_id, state, revision, updated_by)
  select p_organization_id, jsonb_build_object(p_module, p_value), 1, p_updated_by
  where p_expected_revision = 0
  on conflict (organization_id) do update
    set state = jsonb_set(studio_states.state, array[p_module], p_value, true),
        revision = studio_states.revision + 1,
        updated_by = excluded.updated_by,
        updated_at = now()
    where studio_states.revision = p_expected_revision;
  return query select * from studio_states
    where organization_id = p_organization_id
      and revision = p_expected_revision + 1;
end $$;
