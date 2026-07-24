// 金额一律用「最小货币单位的整数」(人民币=分) 保存与运算，禁止浮点。
// 对外展示时才转成元字符串。

/** 把「元」(字符串或数字) 转成整数分。拒绝精度不安全的输入。 */
export function yuanToCents(yuan) {
  if (typeof yuan === "number") {
    if (!Number.isFinite(yuan)) throw new Error("MONEY_INVALID");
    yuan = yuan.toFixed(2);
  }
  const s = String(yuan).trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) throw new Error("MONEY_INVALID");
  const neg = s.startsWith("-");
  const [int, frac = ""] = s.replace("-", "").split(".");
  const cents = Number(int) * 100 + Number((frac + "00").slice(0, 2));
  return neg ? -cents : cents;
}

/** 整数分 -> 元字符串，仅用于展示。 */
export function centsToYuan(cents) {
  assertCents(cents);
  const neg = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${neg}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** 展示用格式化，例如 ¥1,234.00 */
export function formatMoney(cents, currency = "CNY") {
  const sign = { CNY: "¥", USD: "$", CAD: "CA$", AUD: "A$", JPY: "¥" }[currency] || "";
  const y = centsToYuan(cents);
  const [int, frac] = y.replace("-", "").split(".");
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${cents < 0 ? "-" : ""}${sign}${withSep}.${frac}`;
}

/** 断言是安全整数分。 */
export function assertCents(cents) {
  if (!Number.isInteger(cents)) throw new Error("MONEY_NOT_INTEGER");
  if (!Number.isSafeInteger(cents)) throw new Error("MONEY_UNSAFE");
  return cents;
}

/** 应付金额 = 商品金额 - 优惠金额，全部整数分，且不为负。 */
export function computePayable(subtotalCents, discountCents) {
  assertCents(subtotalCents);
  assertCents(discountCents);
  const payable = subtotalCents - discountCents;
  if (payable < 0) throw new Error("PAYABLE_NEGATIVE");
  return payable;
}
