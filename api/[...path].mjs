import worker from "../payment-backend/src/index.js";

// Vercel Functions 使用 Web Request/Response；复用同一套业务和鉴权代码，
// 不在前端暴露 Supabase service role。
export default async function handler(request) {
  return worker.fetch(request, process.env);
}
