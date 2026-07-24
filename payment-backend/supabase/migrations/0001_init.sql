-- =====================================================================
-- KiNG DESiGN 支付模块 · 初始迁移 0001
-- 原则：金额一律整数分(bigint)；订单/支付/交付三状态分离；开启 RLS；敏感变更进 audit_logs。
-- 可回滚：见 0001_init_down.sql
-- =====================================================================

-- ---- 枚举 ----
create type order_status_t    as enum ('draft','pending_confirmation','active','completed','cancelled','expired');
create type payment_status_t  as enum ('unpaid','processing','pending_manual_verification','paid','partially_refunded','refunding','refunded','failed','expired');
create type delivery_status_t as enum ('not_ready','preparing','ready','downloaded','frozen','revoked');
create type user_role_t       as enum ('admin','boss','finance','sales','designer','painter','customer');
create type license_type_t    as enum ('non_exclusive','exclusive','buyout');   -- 非独家/独家/买断

-- ---- 组织 & 客户 & 成员 ----
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  contact text,
  created_at timestamptz not null default now()
);

-- 员工/客户账号与角色（与 Supabase auth.users 关联）
create table memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,                         -- = auth.users.id
  organization_id uuid not null references organizations(id) on delete cascade,
  role user_role_t not null,
  customer_id uuid references customers(id),     -- 角色=customer 时指向其公司
  created_at timestamptz not null default now(),
  unique (user_id, organization_id)
);

-- ---- 订单 ----
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid not null references customers(id),
  license_type license_type_t not null default 'non_exclusive',
  currency text not null default 'CNY',
  subtotal_amount bigint not null check (subtotal_amount >= 0),   -- 分
  discount_amount bigint not null default 0 check (discount_amount >= 0),
  payable_amount  bigint not null check (payable_amount >= 0),
  order_status    order_status_t    not null default 'pending_confirmation',
  payment_status  payment_status_t  not null default 'unpaid',
  delivery_status delivery_status_t not null default 'not_ready',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on orders (organization_id);
create index on orders (customer_id);

-- 订单明细（花型）
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  pattern_id text not null,
  pattern_name text,
  pattern_code text,
  thumb_url text,
  license_type license_type_t not null default 'non_exclusive',
  unit_amount bigint not null check (unit_amount >= 0)            -- 分
);
create index on order_items (order_id);

-- ---- 支付 ----
create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  payment_number text not null unique,
  provider text not null,                          -- wechat/alipay/unionpay/apple_pay/bank_transfer/manual_collect/mock
  payment_method text not null,                    -- wechat_native/alipay_page/...
  provider_transaction_id text,
  amount bigint not null check (amount >= 0),       -- 分
  currency text not null default 'CNY',
  status payment_status_t not null default 'unpaid',
  paid_at timestamptz,
  expired_at timestamptz,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on payments (order_id);
create unique index on payments (provider, provider_transaction_id) where provider_transaction_id is not null;

-- ---- 支付事件（回调/查单日志 + 幂等）----
create table payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references payments(id) on delete set null,
  event_type text not null,                        -- notify/query/close/refund_notify
  provider text not null,
  provider_event_id text,                          -- 渠道事件唯一 id
  verification_status text not null default 'unverified', -- verified/failed/unverified
  payload jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
-- 幂等：同一渠道同一事件 id 只入一次
create unique index on payment_events (provider, provider_event_id) where provider_event_id is not null;

-- ---- 退款 ----
create table refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  refund_number text not null unique,
  provider_refund_id text,
  amount bigint not null check (amount >= 0),        -- 分
  status text not null default 'refunding',          -- refunding/refunded/failed
  reason text,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on refunds (payment_id);

-- ---- 对公转账记录 ----
create table bank_transfer_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  payment_proof_url text,
  payer_name text,
  transfer_reference text,
  amount bigint check (amount >= 0),                 -- 实际到账(分)，财务填写
  submitted_at timestamptz not null default now(),
  confirmed_by uuid,                                 -- 确认的财务/管理员 user_id
  confirmed_at timestamptz,
  status text not null default 'submitted',           -- submitted/confirmed/rejected
  remark text
);
create index on bank_transfer_records (order_id);

-- ---- 交付文件 & 下载令牌 ----
create table delivery_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  r2_key text not null,                              -- R2 对象键(不公开)
  file_type text,                                    -- psd/tiff/ai/png...
  version int not null default 1,
  created_at timestamptz not null default now()
);
create index on delivery_files (order_id);

create table download_tokens (
  id uuid primary key default gen_random_uuid(),
  delivery_file_id uuid not null references delivery_files(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  issued_to uuid not null,                           -- 下载用户 user_id
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,                   -- 15-30 分钟
  downloaded_at timestamptz,
  version int not null default 1
);
create index on download_tokens (order_id);

-- ---- 审计日志 ----
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_role user_role_t,
  action text not null,                              -- amount_change/payment_confirm/refund/deliver...
  target_type text not null,
  target_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index on audit_logs (target_type, target_id);

-- ---- updated_at 自动维护 ----
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
create trigger trg_orders_updated   before update on orders   for each row execute function set_updated_at();
create trigger trg_payments_updated before update on payments for each row execute function set_updated_at();
create trigger trg_refunds_updated  before update on refunds  for each row execute function set_updated_at();

-- =====================================================================
-- RLS —— 行级安全。默认拒绝；服务端用 service_role 绕过做权威写入。
-- =====================================================================
alter table orders                enable row level security;
alter table order_items           enable row level security;
alter table payments              enable row level security;
alter table payment_events        enable row level security;
alter table refunds               enable row level security;
alter table bank_transfer_records enable row level security;
alter table delivery_files        enable row level security;
alter table download_tokens       enable row level security;
alter table audit_logs            enable row level security;
alter table customers             enable row level security;
alter table memberships           enable row level security;

-- 当前用户在某组织的角色
create or replace function current_role_in(org uuid) returns user_role_t as $$
  select role from memberships where user_id = auth.uid() and organization_id = org limit 1;
$$ language sql stable;

-- 当前用户绑定的客户公司
create or replace function current_customer_id() returns uuid as $$
  select customer_id from memberships where user_id = auth.uid() and role = 'customer' limit 1;
$$ language sql stable;

-- 客户：只能读本公司订单；员工(非 customer)：可读本组织订单
create policy orders_select on orders for select using (
  (current_role_in(organization_id) = 'customer' and customer_id = current_customer_id())
  or (current_role_in(organization_id) is not null and current_role_in(organization_id) <> 'customer')
);
-- 客户不能改订单（金额/支付状态等），写操作只允许服务端 service_role（绕过 RLS）
create policy orders_no_client_write on orders for update using (false) with check (false);

-- 订单明细 / 支付 / 退款：跟随订单可见性（客户只见本公司）
create policy items_select on order_items for select using (
  exists (select 1 from orders o where o.id = order_id and (
    (current_role_in(o.organization_id) = 'customer' and o.customer_id = current_customer_id())
    or (current_role_in(o.organization_id) is not null and current_role_in(o.organization_id) <> 'customer')))
);
create policy payments_select on payments for select using (
  exists (select 1 from orders o where o.id = order_id and (
    (current_role_in(o.organization_id) = 'customer' and o.customer_id = current_customer_id())
    or (current_role_in(o.organization_id) is not null and current_role_in(o.organization_id) <> 'customer')))
);
-- payment_events / audit_logs：仅管理员/老板/财务可读；客户不可读
create policy events_admin_read on payment_events for select using (
  exists (select 1 from memberships m where m.user_id = auth.uid() and m.role in ('admin','boss','finance'))
);
create policy audit_admin_read on audit_logs for select using (
  exists (select 1 from memberships m where m.user_id = auth.uid() and m.role in ('admin','boss','finance'))
);
-- 对公转账：客户可读本公司、可插入凭证；确认(update)只服务端
create policy bank_select on bank_transfer_records for select using (
  exists (select 1 from orders o where o.id = order_id and (
    (current_role_in(o.organization_id) = 'customer' and o.customer_id = current_customer_id())
    or (current_role_in(o.organization_id) is not null and current_role_in(o.organization_id) <> 'customer')))
);
create policy bank_insert on bank_transfer_records for insert with check (
  exists (select 1 from orders o where o.id = order_id
    and current_role_in(o.organization_id) = 'customer' and o.customer_id = current_customer_id())
);

-- 说明：所有「权威写入」(支付状态、退款、财务确认、交付、下载令牌)一律由 Cloudflare Workers
-- 使用 SUPABASE_SERVICE_ROLE_KEY 执行，绕过 RLS，并在应用层做角色校验 + 写 audit_logs。
