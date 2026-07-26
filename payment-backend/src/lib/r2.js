// R2 受控下载：生成短期签名 URL。
// 测试/无 R2 凭证时返回占位签名 URL（明确标注 test），绝不暴露永久公开地址。
// 生产：用 R2 S3 兼容 API 的 presign（AWS SigV4）在 Workers 内签名，密钥来自 Secrets。
export async function signR2Url(env, r2Key, ttlSec = 1800) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_ACCOUNT_ID) {
    // 测试占位：可用于流程验证，不是真实可下载地址
    return `https://r2.test.local/${encodeURIComponent(r2Key)}?X-Test=1&Expires=${exp}`;
  }
  // TODO(生产)：SigV4 presign 到 https://<account>.r2.cloudflarestorage.com/<bucket>/<key>
  // 此处返回结构占位，接入真实 R2 凭证后实现签名。
  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_DELIVERY}/${encodeURIComponent(r2Key)}?Expires=${exp}`;
}
