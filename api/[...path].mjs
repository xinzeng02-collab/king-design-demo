import worker from "../payment-backend/src/index.js";

function runtimeEnv() {
  return typeof process !== "undefined" && process.env ? process.env : {};
}

async function toWebRequest(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const protocol = req.headers["x-forwarded-proto"] || "https";
  return new Request(`${protocol}://${req.headers.host}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : body,
  });
}

// Adapt Vercel's Node request/response API to the Web Fetch API used by the
// shared worker. This keeps the API behavior identical on Cloudflare/Vercel.
export default async function handler(req, res) {
  if (!res) return worker.fetch(req, runtimeEnv());
  const response = await worker.fetch(await toWebRequest(req), runtimeEnv());
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.statusCode = response.status;
  res.end(Buffer.from(await response.arrayBuffer()));
}
