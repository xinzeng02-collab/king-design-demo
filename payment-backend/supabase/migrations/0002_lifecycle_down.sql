-- 回滚 0002_lifecycle.sql
-- 注意：Postgres 无法从 enum 移除已添加的值(pending_signing/archived/prepared_locked)，
-- 如需彻底回退枚举，需重建类型；一般保留这些值即可(无害)。
drop table if exists agreements cascade;
drop table if exists review_items cascade;
drop table if exists review_sessions cascade;
alter table orders drop column if exists review_session_id;
alter table orders drop column if exists agreement_status;
drop type if exists agreement_status_t;
drop type if exists review_status_t;
