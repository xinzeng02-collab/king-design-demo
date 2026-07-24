// 统一支付适配层基类。业务代码只依赖这个接口，永远不写 "if 微信 else 支付宝"。
// 每个渠道返回的数据都要在各自 Provider 内转换成下面的「内部统一结构」。

/**
 * @typedef {Object} InternalPayment      createPayment 的统一返回
 * @property {string} providerTransactionId  渠道侧交易号
 * @property {"qrcode"|"redirect"|"applepay_session"|"offline"} action  前端该如何呈现
 * @property {string} [qrContent]         二维码内容(action=qrcode)
 * @property {string} [redirectUrl]       跳转收银台(action=redirect)
 * @property {Object} [sessionPayload]    Apple Pay session(action=applepay_session)
 * @property {number} expiresInSec        支付有效期(秒)
 * @property {Object} raw                 渠道原始响应
 *
 * @typedef {Object} VerifiedEvent        verifyNotification 通过后的统一结构
 * @property {string} providerEventId     渠道事件唯一 id(用于幂等)
 * @property {string} providerTransactionId
 * @property {string} outTradeNo          我方订单/支付号
 * @property {number} amount              整数分
 * @property {string} currency
 * @property {string} status              已归一的内部支付状态
 * @property {string} mchId               渠道商户号(供核对)
 * @property {string} appId               渠道 appid(供核对)
 * @property {Object} raw
 */

export class PaymentProvider {
  /** @param {string} name  provider 标识 */
  constructor(name) {
    this.name = name;
  }
  // 下面全部由子类实现；基类抛错以防漏实现被当成"成功"。
  async createPayment(/* order, method, ctx */) { throw new Error(`${this.name}:createPayment_NOT_IMPLEMENTED`); }
  async queryPayment(/* payment */) { throw new Error(`${this.name}:queryPayment_NOT_IMPLEMENTED`); }
  async verifyNotification(/* req */) { throw new Error(`${this.name}:verifyNotification_NOT_IMPLEMENTED`); }
  async closePayment(/* payment */) { throw new Error(`${this.name}:closePayment_NOT_IMPLEMENTED`); }
  async createRefund(/* payment, amountCents, reason */) { throw new Error(`${this.name}:createRefund_NOT_IMPLEMENTED`); }
  async queryRefund(/* refund */) { throw new Error(`${this.name}:queryRefund_NOT_IMPLEMENTED`); }
}
