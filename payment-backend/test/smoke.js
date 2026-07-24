// 冒烟测试：验证模块可加载、金额/状态机/渠道可用性/Mock 流程可用。
// 运行: node test/smoke.js   （无需任何真实密钥）
import assert from "node:assert";
import { yuanToCents, centsToYuan, computePayable, formatMoney } from "../src/lib/money.js";
import { canPaymentTransition } from "../src/lib/statemachine.js";
import { channelAvailability } from "../src/providers/config.js";
import { resolveProvider } from "../src/providers/registry.js";

let pass = 0;
const ok = (name, fn) => { fn(); pass++; console.log("  ✓", name); };

console.log("金额(整数分):");
ok("元->分", () => assert.equal(yuanToCents("12.34"), 1234));
ok("分->元", () => assert.equal(centsToYuan(1234), "12.34"));
ok("应付=商品-优惠", () => assert.equal(computePayable(10000, 1500), 8500));
ok("拒绝浮点脏值", () => assert.throws(() => yuanToCents("1.005")));
ok("格式化", () => assert.equal(formatMoney(123400), "¥1,234.00"));

console.log("状态机:");
ok("unpaid->processing 合法", () => assert.equal(canPaymentTransition("unpaid", "processing"), true));
ok("人工->paid 合法", () => assert.equal(canPaymentTransition("pending_manual_verification", "paid"), true));
ok("unpaid->paid 非法(必须经渠道确认)", () => assert.throws(() => canPaymentTransition("unpaid", "paid")));

console.log("渠道可用性(未配置=暂未开放, 对公可用):");
const prod = channelAvailability({ PAYMENT_MODE: "prod" }, { applePaySupported: true });
const get = (c) => prod.find((x) => x.channel === c);
ok("微信暂未开放", () => assert.equal(get("wechat").available, false));
ok("支付宝暂未开放", () => assert.equal(get("alipay").available, false));
ok("银联暂未开放", () => assert.equal(get("unionpay").available, false));
ok("ApplePay暂未开放(未配置)", () => assert.equal(get("apple_pay").available, false));
ok("对公转账可用", () => assert.equal(get("bank_transfer").available, true));

console.log("TEST 模式(MockProvider) 全链路:");
const env = { PAYMENT_MODE: "test", MOCK_NOTIFY_SECRET: "s" };
const testAvail = channelAvailability(env, { applePaySupported: false });
ok("测试模式微信标 TEST", () => assert.match(testAvail.find(x=>x.channel==="wechat").display, /TEST/));
const mock = resolveProvider("wechat_native", env);
const order = { payment_number: "PZ1", amount: 8500, currency: "CNY" };
const created = await mock.createPayment(order, "wechat_native", { device: "desktop" });
ok("PC 端返回二维码", () => assert.equal(created.action, "qrcode"));
mock._simulatePay("PZ1", true);
const notif = mock.buildNotification("PZ1");
const verified = await mock.verifyNotification({ body: notif });
ok("合法通知验签通过", () => assert.ok(verified && verified.status === "paid" && verified.amount === 8500));
const forged = await mock.verifyNotification({ body: { ...notif, total_fee: 1, sign: notif.sign } });
ok("篡改金额->验签失败", () => assert.equal(forged, null));

console.log(`\n全部通过 ✅  (${pass} 项)`);
