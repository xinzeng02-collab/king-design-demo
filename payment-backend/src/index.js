// Cloudflare Workers 入口。把 /api/* 路由接到统一业务处理器(core.js)。
// 支付成功只来自：验签回调 / 主动查单 / 财务确认；前端一律无权改支付状态。
import { authenticate } from "./lib/auth.js";
import { channelAvailability } from "./providers/config.js";
import { SupabaseRepo } from "./lib/supabaseRepo.js";
import * as core from "./core.js";
import * as sign from "./signing.js";
import * as admin from "./admin.js";
import * as authApi from "./authApi.js";
import * as studioAssets from "./studioAssets.js";

const corsHeaders = () => ({
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  vary: "Origin",
});
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...corsHeaders() } });

// 从 JWT 身份 + memberships 组装可信 actor（角色以数据库为准）
async function buildActor(repo, identity) {
  if (!identity) return null;
  const m = await repo.getMembership(identity.userId);
  return { userId: identity.userId, role: m?.role || null, customerId: m?.customer_id || null, organizationId: m?.organization_id || null };
}

async function readBody(request) { try { return await request.json(); } catch { return {}; } }

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;
    if (method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
    const seg = pathname.split("/").filter(Boolean); // ["api","payments",...]

    try {
      if (pathname === "/api/health") return json({ ok: true, mode: env.PAYMENT_MODE || "unset", ts: Date.now() });

      if (pathname === "/api/auth/login" && method === "POST")
        return json(await authApi.login(new SupabaseRepo(env), env, await readBody(request)));
      if (pathname === "/api/auth/refresh" && method === "POST")
        return json(await authApi.refresh(env, await readBody(request)));

      if (pathname === "/api/payments/channels" && method === "GET") {
        return json({ channels: channelAvailability(env, { applePaySupported: url.searchParams.get("applePay") === "1" }) });
      }

      // 渠道异步回调（无需登录，靠验签鉴权）
      if (seg[1] === "payments" && seg[3] === "notify" && method === "POST") {
        const channel = seg[2]; // wechat/alipay/unionpay
        const repo = new SupabaseRepo(env);
        const body = await readBody(request);
        const r = await core.handleNotify(repo, env, { channel, body });
        return json(r);
      }

      // ---- 以下需登录 ----
      const identity = await authenticate(request, env);
      if (pathname.startsWith("/api/") && !identity) return json({ error: "UNAUTHENTICATED" }, 401);
      const repo = new SupabaseRepo(env);
      const actor = await buildActor(repo, identity);
      if (pathname === "/api/admin/studio-assets" && method === "POST" && url.searchParams.get("action") === "sign-upload")
        return json(await studioAssets.createStudioAssetUploadUrl(env, actor, url.searchParams.get("key")));
      if (pathname === "/api/admin/studio-assets" && method === "PUT")
        return json(await studioAssets.putStudioAsset(env, actor, url.searchParams.get("key"), request));
      if (pathname === "/api/admin/studio-assets" && method === "DELETE")
        return json(await studioAssets.deleteStudioAsset(env, actor, url.searchParams.get("key")));
      if (pathname === "/api/admin/studio-assets" && method === "GET") {
        const asset = await studioAssets.getStudioAsset(env, actor, url.searchParams.get("key"));
        return new Response(asset.body, {
          headers: {
            "content-type": asset.httpMetadata?.contentType || "application/octet-stream",
            "cache-control": "private, max-age=300",
            ...corsHeaders(),
          },
        });
      }
      const body = ["POST", "PUT", "PATCH"].includes(method) ? await readBody(request) : {};

      if (pathname === "/api/admin/employee-account" && method === "POST")
        return json(await authApi.provisionEmployee(repo, env, actor, body));

      // ---- 管理工作台 ----
      if (pathname === "/api/admin/studio-state" && method === "GET")
        return json(await admin.getStudioState(repo, actor));
      if (pathname === "/api/admin/studio-state" && method === "PUT")
        return json(await admin.replaceStudioState(repo, body, actor));
      if (seg[1] === "admin" && seg[2] === "studio-state" && seg[3] === "modules" && seg[4] && method === "PATCH")
        return json(await admin.updateStudioModule(repo, { module: decodeURIComponent(seg[4]), value: body.value, revision: body.revision }, actor));

      // POST /api/payments/create
      if (pathname === "/api/payments/create" && method === "POST") {
        return json(await core.createPayment(repo, env, { orderId: body.orderId, method: body.method, ctx: body.ctx || {} }, actor));
      }
      // GET /api/payments/:id/status
      if (seg[1] === "payments" && seg[3] === "status" && method === "GET") {
        return json(await core.getPaymentStatus(repo, env, { paymentId: seg[2] }, actor));
      }
      // POST /api/payments/:id/query  主动查单
      if (seg[1] === "payments" && seg[3] === "query" && method === "POST") {
        return json(await core.queryAndReconcile(repo, env, { paymentId: seg[2] }, actor));
      }
      // POST /api/payments/:id/close
      if (seg[1] === "payments" && seg[3] === "close" && method === "POST") {
        return json(await core.closePayment(repo, env, { paymentId: seg[2] }, actor));
      }
      // POST /api/payments/:id/refund （财务）
      if (seg[1] === "payments" && seg[3] === "refund" && method === "POST") {
        return json(await core.createRefund(repo, env, { paymentId: seg[2], amount: body.amount, reason: body.reason }, actor));
      }
      // POST /api/refunds/:id/complete （退款回调/查单）
      if (seg[1] === "refunds" && seg[3] === "complete" && method === "POST") {
        return json(await core.completeRefund(repo, env, { refundId: seg[2] }));
      }
      // POST /api/bank-transfer/submit （客户）
      if (pathname === "/api/bank-transfer/submit" && method === "POST") {
        return json(await core.submitBankTransfer(repo, env, body, actor));
      }
      // POST /api/admin/bank-transfer/:id/confirm （财务）
      if (seg[1] === "admin" && seg[2] === "bank-transfer" && seg[4] === "confirm" && method === "POST") {
        return json(await core.confirmBankTransfer(repo, env, { recordId: seg[3], amount: body.amount, approve: body.approve, remark: body.remark }, actor));
      }
      // POST /api/deliveries/:id/create-download-url
      if (seg[1] === "deliveries" && seg[3] === "create-download-url" && method === "POST") {
        return json(await core.createDownloadUrl(repo, env, { orderId: body.orderId, fileId: seg[2] }, actor));
      }

      // ---- 看稿 ----
      if (pathname === "/api/reviews/start" && method === "POST")
        return json(await sign.startReview(repo, env, body, actor));
      if (seg[1] === "reviews" && seg[3] === "items" && method === "POST")
        return json(await sign.addReviewItem(repo, env, { sessionId: seg[2], ...body }, actor));
      if (seg[1] === "reviews" && seg[3] === "items" && method === "DELETE")
        return json(await sign.removeReviewItem(repo, env, { sessionId: seg[2], patternId: seg[4] }, actor));
      if (seg[1] === "reviews" && seg[3] === "complete" && method === "POST")
        return json(await sign.completeReview(repo, env, { sessionId: seg[2] }, actor));
      if (seg[1] === "reviews" && seg[3] === "return" && method === "POST")
        return json(await sign.returnReview(repo, env, { sessionId: seg[2] }, actor));
      if (seg[1] === "reviews" && seg[3] === "create-order" && method === "POST")
        return json(await sign.createOrderFromReview(repo, env, { sessionId: seg[2], ...body }, actor));

      // ---- 签约 ----
      if (seg[1] === "orders" && seg[3] === "agreement" && seg[4] === "upload" && method === "POST")
        return json(await sign.uploadAgreement(repo, env, { orderId: seg[2], ...body }, actor));
      if (seg[1] === "orders" && seg[3] === "agreement" && seg[4] === "initiate" && method === "POST")
        return json(await sign.initiateSigning(repo, env, { orderId: seg[2], ...body }, actor));
      if (seg[1] === "orders" && seg[3] === "agreement" && seg[4] === "submit-signed" && method === "POST")
        return json(await sign.submitSignedFile(repo, env, { orderId: seg[2], ...body }, actor));
      if (seg[1] === "orders" && seg[3] === "agreement" && seg[4] === "review" && method === "POST")
        return json(await sign.reviewSignedFile(repo, env, { orderId: seg[2], ...body }, actor));

      // ---- 交付准备 / 订单完成 ----
      if (seg[1] === "orders" && seg[3] === "delivery" && seg[4] === "prepare" && method === "POST")
        return json(await sign.prepareDelivery(repo, env, { orderId: seg[2], ...body }, actor));
      if (seg[1] === "orders" && seg[3] === "complete" && method === "POST")
        return json(await sign.completeOrder(repo, env, { orderId: seg[2] }, actor));

      return json({ error: "NOT_FOUND" }, 404);
    } catch (e) {
      const status = e.status || 500;
      return json({ error: e.code || e.message || "ERROR" }, status);
    }
  },
};
