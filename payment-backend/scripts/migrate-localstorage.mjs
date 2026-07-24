// 把现有原型的 localStorage 订单数据迁移到 Supabase orders 表（兼容方案）。
//
// 步骤：
//   1) 在浏览器打开现有网站，控制台执行：
//        copy(localStorage.getItem("studio_site_design_ops_v2"))
//      粘贴保存为 export.json
//   2) 运行： node scripts/migrate-localstorage.mjs export.json > seed_orders.sql
//   3) 在 Supabase SQL Editor 执行 seed_orders.sql（需先跑完 0001_init.sql）
//
// 说明：原型金额 price 为「元」，这里转成「整数分」(×100)。不改动原型数据，只做只读导出。

import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) { console.error("用法: node scripts/migrate-localstorage.mjs <export.json>"); process.exit(1); }

const raw = JSON.parse(readFileSync(file, "utf8"));
const orders = (raw.orders || raw.studioOrders || []);

const esc = (s) => String(s ?? "").replace(/'/g, "''");
const yuanToCents = (y) => Math.round(Number(y || 0) * 100);

const DELIVERY_MAP = { "已交付": "ready", "未交付": "not_ready" };
const ORDER_MAP = { "已确认下单": "active", "已完成": "completed", "已取消": "cancelled" };

console.log("-- 由 migrate-localstorage.mjs 生成。执行前请确认 organization_id / customer_id 映射。");
console.log("-- 建议先建一个默认组织与客户，再按名称匹配真实 customer_id。\n");

for (const o of orders) {
  const cents = yuanToCents(o.price);
  const orderStatus = ORDER_MAP[o.status] || "pending_confirmation";
  const deliveryStatus = DELIVERY_MAP[o.deliverStatus] || "not_ready";
  console.log(
    `insert into orders (order_number, organization_id, customer_id, currency, ` +
    `subtotal_amount, discount_amount, payable_amount, order_status, payment_status, delivery_status, created_at) ` +
    `values ('${esc(o.id)}', :org_id, :cust_id_for_'${esc(o.customer)}', 'CNY', ` +
    `${cents}, 0, ${cents}, '${orderStatus}', 'unpaid', '${deliveryStatus}', now());`
  );
  const patterns = o.patternIds || (o.files || []).map((f) => f.name || f);
  for (const p of patterns) {
    console.log(
      `insert into order_items (order_id, pattern_id, pattern_name, unit_amount) ` +
      `values ((select id from orders where order_number='${esc(o.id)}'), '${esc(p)}', '${esc(p)}', 10000);`
    );
  }
}
console.log(`\n-- 共 ${orders.length} 个订单。:org_id / :cust_id 请替换为真实 UUID。`);
