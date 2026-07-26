-- =====================================================================
-- KiNG DESiGN 迁移 0002 · 看稿 / 签约 / 生命周期扩展
-- 附加式变更，不改动 0001。可回滚见 0002_lifecycle_down.sql
-- 注意：ALTER TYPE ... ADD VALUE 需单独执行（不能与使用该值的语句同事务）。
-- =====================================================================

-- ---- 订单状态新增：待签约 / 已归档 ----
alter type order_status_t add value if not exists 'pending_signing' after 'pending_confirmation';
alter type order_status_t add value if not exists 'archived' after 'expired';

-- ---- 交付状态新增：已准备待付款(锁定) ----
alter type delivery_status_t add value if not exists 'prepared_locked' after 'preparing';

-- ---- 新枚举：看稿状态 / 签约状态 ----
do $$ begin
  create type review_status_t as enum ('not_started','in_progress','completed','returned','order_created','closed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type agreement_status_t as enum ('no_agreement','agreement_uploaded','awaiting_signature','signed_returned','reviewing','rejected','signed');
exception when duplicate_object then null; end $$;

-- ---- 看稿会话 ----
create table if not exists review_sessions (
  id uuid primary key default gen_random_uuid(),
  review_number text not null unique,
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid not null references customers(id),
  initiated_by uuid,                              -- 发起销售/管理员 user_id
  status review_status_t not null default 'not_started',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_review_sessions_customer on review_sessions (customer_id);

-- 本次选稿明细（客户在看稿会话中挑选的花型）
create table if not exists review_items (
  id uuid primary key default gen_random_uuid(),
  review_session_id uuid not null references review_sessions(id) on delete cascade,
  pattern_id text not null,
  pattern_name text,
  pattern_code text,
  selected_colorways jsonb,                       -- 客户选择的花色
  added_at timestamptz not null default now(),
  unique (review_session_id, pattern_id)
);

-- ---- 订单挂接看稿会话 + 冗余签约状态（便于查询/前端按钮）----
alter table orders add column if not exists review_session_id uuid references review_sessions(id);
alter table orders add column if not exists agreement_status agreement_status_t not null default 'no_agreement';

-- ---- 签约（合同上传 -> 发起 -> 客户回传 -> 内部审核）----
create table if not exists agreements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  version int not null default 1,
  status agreement_status_t not null default 'no_agreement',
  contract_file_url text,                         -- 员工上传的合同(PDF/Word)，R2 受控
  contract_file_name text,
  contract_uploaded_by uuid,
  contract_uploaded_at timestamptz,
  initiated_at timestamptz,                       -- 发起签约时间
  sign_deadline timestamptz,                      -- 签署截止
  signed_file_url text,                           -- 客户回传的已签署文件
  submitted_at timestamptz,                       -- 客户回传时间
  reviewed_by uuid,                               -- 内部审核人
  reviewed_at timestamptz,
  review_remark text,                             -- 驳回原因/审核备注
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_agreements_order on agreements (order_id);

-- ---- updated_at 触发器 ----
create trigger trg_review_sessions_updated before update on review_sessions for each row execute function set_updated_at();
create trigger trg_agreements_updated before update on agreements for each row execute function set_updated_at();

-- ---- RLS ----
alter table review_sessions enable row level security;
alter table review_items    enable row level security;
alter table agreements      enable row level security;

-- 看稿会话：客户看本公司；员工看本组织
create policy review_sessions_select on review_sessions for select using (
  (current_role_in(organization_id) = 'customer' and customer_id = current_customer_id())
  or (current_role_in(organization_id) is not null and current_role_in(organization_id) <> 'customer')
);
create policy review_items_select on review_items for select using (
  exists (select 1 from review_sessions s where s.id = review_session_id and (
    (current_role_in(s.organization_id) = 'customer' and s.customer_id = current_customer_id())
    or (current_role_in(s.organization_id) is not null and current_role_in(s.organization_id) <> 'customer')))
);
-- 签约：跟随订单可见性
create policy agreements_select on agreements for select using (
  exists (select 1 from orders o where o.id = order_id and (
    (current_role_in(o.organization_id) = 'customer' and o.customer_id = current_customer_id())
    or (current_role_in(o.organization_id) is not null and current_role_in(o.organization_id) <> 'customer')))
);
-- 客户可回传签署文件（insert/update signed_file_url 由服务端 service_role 落地并校验；此处允许读）
-- 权威写入(合同上传/发起/审核/状态流转)统一由 Workers service_role 执行并写 audit_logs。
