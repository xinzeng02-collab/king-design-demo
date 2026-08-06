# KiNG DESiGN 支付后端 · payment-backend

统一 Payment Provider 适配层 + Cloudflare Workers + Supabase + R2。
**当前处于测试模式，不接入任何真实商户密钥，不产生真实扣款。所有模拟支付均标记 TEST。**

## 目录
```
payment-backend/
├─ src/
│  ├─ index.js                 Workers 入口(路由骨架 + 鉴权 + 渠道可用性)
│  ├─ lib/
│  │  ├─ money.js              金额=整数分，禁浮点
│  │  ├─ statemachine.js       订单/支付/交付 三状态机(分离)
│  │  └─ auth.js               Supabase JWT(HS256) 校验 + 角色权限
│  └─ providers/
│     ├─ PaymentProvider.js    统一接口基类
│     ├─ config.js             各渠道配置结构 + 可用性判定
│     ├─ registry.js           方式->Provider 解析(测试走 Mock)
│     ├─ MockProvider.js       测试渠道(TEST，含验签/幂等模拟)
│     ├─ WeChatPayProvider.js  微信(PC Native 扫码，待密钥)
│     ├─ AlipayProvider.js     支付宝(电脑网站/扫码，待密钥)
│     ├─ UnionPayProvider.js   银联(在线网关/聚合，待密钥)
│     ├─ ApplePayProvider.js   Apple Pay(需 PSP+域名验证+设备支持)
│     ├─ BankTransferProvider.js  对公转账(财务确认)
│     └─ ManualCollectProvider.js 人工收款码(pending_manual_verification)
├─ supabase/migrations/
│  ├─ 0001_init.sql            全部表 + 枚举 + RLS + 审计
│  └─ 0001_init_down.sql       回滚
├─ scripts/migrate-localstorage.mjs  现有 localStorage 订单迁移
├─ test/smoke.js               冒烟测试(17 项)
├─ wrangler.toml               Workers 配置(敏感值用 Secrets)
├─ .dev.vars.example / .env.example   变量模板(无真实值)
└─ 支付参数配置清单.md          每个参数来源/敏感/测试或生产
```

## 本地如何启动
```bash
cd payment-backend
node test/smoke.js          # 无需任何密钥，验证核心逻辑(应输出 全部通过 ✅)
# 起本地 Workers(可选，需 npm i)：
npm install
cp .dev.vars.example .dev.vars   # 填测试值即可，真实密钥留空
npm run dev                  # http://localhost:8787/api/health
```

## NAS 管理员认证

发布版登录由 Worker 的 `POST /api/auth/login` 转交 Supabase Auth 校验，再从
`memberships` 读取服务端角色。前端不保存管理员密码，也不能自行声明角色。

首次部署数据库迁移后，用环境变量创建管理员（密码不会写入仓库）：

```bash
ADMIN_USERNAME=kingadmin ADMIN_PASSWORD='你的强密码' \
SUPABASE_URL='https://xxx.supabase.co' SUPABASE_SERVICE_ROLE_KEY='xxx' \
npm run create-admin
```

NAS 静态包通过 `node tools/build-nas-release.mjs` 生成到 `dist/studio-site-nas`。
部署前把该目录内 `release-config.js` 的 `apiBaseUrl` 改成实际 Worker 地址。
验证接口：
- `GET /api/health` → `{ ok:true, mode:"test" }`
- `GET /api/payments/channels` → 各渠道"暂未开放/对公可用"，测试模式带 TEST

## 收款模式
- **A 自动支付**：仅当服务端收到并**验签通过的回调**或**主动查单确认**，才把 payment_status 改为 `paid`。
- **B 人工收款**：客户扫我方收款码付款并上传凭证 → 订单进入 `pending_manual_verification` → **财务确认真实到账**后才 `paid`。
- 前端返回的"成功"、URL 里的 success、客户上传的截图 —— **都不作为支付依据**。

## 如何确认没有破坏现有功能
本目录是**全新独立目录**，不修改 `studio-site/` 任何文件；现有静态原型照常运行。
- 打开 `studio-site/index.html`，员工/客户登录、作品库、订单中心、交付等功能与之前完全一致。
- 回滚方式：删除 `payment-backend/` 目录即可完全撤销本阶段全部改动（或 `git checkout main`）。

## 安全红线
- 敏感参数只进 **Cloudflare Secrets**（`wrangler secret put`），绝不进 GitHub/前端/localStorage。
- 前端只调 `/api/*`，永远拿不到私钥/证书/服务端密钥。
- 权威写入(支付状态/退款/财务确认/交付/下载令牌)一律由 Workers 用 service_role 执行并写 audit_logs。

## 第二阶段已完成（支付测试全链路）
- `src/core.js` 业务处理器：createPayment / getPaymentStatus / handleNotify / queryAndReconcile / closePayment / createRefund / completeRefund / submitBankTransfer / confirmBankTransfer / createDownloadUrl
- `src/lib/repo.js` InMemoryRepo（测试）+ `src/lib/supabaseRepo.js` SupabaseRepo（生产，PostgREST）
- `src/lib/r2.js` 受控下载短期签名（测试占位/生产 SigV4）
- `src/index.js` 已把 `/api/*` 路由接到处理器
- `studio-site/pay.html` 支付页 demo：订单信息 + 12 种状态 + 倒计时 + 按设备切换 + Apple Pay 探测隐藏 + TEST 标记
- `test/payment.test.js` 自动化测试：`node --test` 共 **30 项全过**（含伪造/验签错/金额不符/重复通知幂等/越权/退款后下载/对公驳回/财务重复确认/落库失败回滚等）

运行：`cd payment-backend && node --test`

## 下一阶段（第三阶段：文件与交付权限 + 第四阶段：权限与 RLS）
1. 接入 Cloudflare R2 测试 Bucket，落地真实 SigV4 短期签名
2. Supabase Auth 实际接线 + memberships 角色数据
3. RLS 策略联调 + 跨客户隔离端到端验证
4. 把 studio-site 前端订单中心接到 `/api/*`（灰度切换，不破坏现有功能）

## 管理员工作台 API

迁移 `0003_admin_studio.sql` 后，管理员页面中的项目、稿件、客户、订单、团队、资源和标签可按当前前端数据结构持久化到服务端。

- `GET /api/admin/studio-state`：员工读取本组织工作台状态。
- `PUT /api/admin/studio-state`：管理员/老板替换完整状态，请求体为 `{ "state": {...}, "revision": 0 }`。
- `PATCH /api/admin/studio-state/modules/:module`：管理员/老板只更新一个模块，请求体为 `{ "value": [...], "revision": 1 }`。

每次成功写入都会使 `revision` 加一并记录审计日志。客户端遇到 HTTP `409 REVISION_CONFLICT` 时，应重新 GET 后合并，不能盲目覆盖。支持的模块名与 `studio-site/script.js` 中 `studioState` 字段一致；单次状态最大 4 MB。

### 初始化四岗位测试环境

执行完 `0001`、`0002`、`0003` 迁移后运行：

```bash
SUPABASE_URL='https://xxx.supabase.co' \
SUPABASE_SERVICE_ROLE_KEY='xxx' \
npm run initialize:test-workspace
```

脚本会幂等创建管理员、设计师、手绘师、销售账号和完整空工作台状态；已有业务状态不会被覆盖。正式使用前应通过 `ADMIN_PASSWORD`、`DESIGNER_PASSWORD`、`PAINTER_PASSWORD`、`SALES_PASSWORD` 环境变量替换测试密码。
