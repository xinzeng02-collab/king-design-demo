// Cloudflare Workers 入口。第一阶段：路由骨架 + 鉴权 + 渠道可用性。
// 支付创建/回调/退款等业务将在第二阶段接入处理器（当前返回 501 占位，不伪造成功）。
import { authenticate } from "./lib/auth.js";
import { channelAvailability } from "./providers/config.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // 健康检查
    if (pathname === "/api/health") {
      return json({ ok: true, mode: env.PAYMENT_MODE || "unset", ts: Date.now() });
    }

    // 渠道可用性（前端据此渲染入口；未配置=暂未开放）
    if (pathname === "/api/payments/channels" && method === "GET") {
      const applePaySupported = url.searchParams.get("applePay") === "1";
      return json({ channels: channelAvailability(env, { applePaySupported }) });
    }

    // ---- 以下均需登录 ----
    const identity = await authenticate(request, env);
    const needAuth = pathname.startsWith("/api/payments/")
      || pathname.startsWith("/api/refunds/")
      || pathname.startsWith("/api/bank-transfer/")
      || pathname.startsWith("/api/deliveries/")
      || pathname.startsWith("/api/admin/");
    if (needAuth && !identity) return json({ error: "UNAUTHENTICATED" }, 401);

    // 第二阶段将接入的路由（占位，明确 501，不返回假成功）
    const phase2 = {
      "POST /api/payments/create": true,
      "GET /api/payments/:id/status": true,
      "POST /api/payments/wechat/notify": true,
      "POST /api/payments/alipay/notify": true,
      "POST /api/payments/unionpay/notify": true,
      "POST /api/payments/apple-pay/session": true,
      "POST /api/payments/:id/close": true,
      "POST /api/payments/:id/refund": true,
      "GET /api/refunds/:id/status": true,
      "POST /api/bank-transfer/submit": true,
      "POST /api/admin/bank-transfer/:id/confirm": true,
      "POST /api/deliveries/:id/create-download-url": true,
    };
    if (pathname.startsWith("/api/")) {
      return json({ error: "NOT_IMPLEMENTED", phase: 2, note: "该接口将在第二阶段实现，当前不返回任何支付成功状态。", routes: Object.keys(phase2) }, 501);
    }

    return json({ error: "NOT_FOUND" }, 404);
  },
};
