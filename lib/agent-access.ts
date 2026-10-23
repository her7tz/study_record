// Dedicated read-only credentials. Browser identity is used only when granting/revoking.
// The Agent generates and retains the token; the server stores its SHA-256 hash only.
export const AGENT_SCOPES = ["records:read", "projects:read", "analytics:read"] as const;
export const PAIR_SECONDS = 10 * 60;
export const GRANT_SECONDS = 30 * 24 * 60 * 60;
export type AgentGrant = {
  id: string; token_hash: string; client_name: string; user_id: string | null;
  created_at: number; request_expires_at: number; authorized_at: number | null;
  expires_at: number | null; revoked_at: number | null;
};
export class AgentAccessError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export const unixNow = () => Math.floor(Date.now() / 1000);
export async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}
export function grantState(grant: AgentGrant, now = unixNow()) {
  if (grant.revoked_at !== null) return "revoked";
  if (grant.user_id && grant.expires_at !== null) return grant.expires_at > now ? "connected" : "expired";
  return grant.request_expires_at > now ? "pending" : "expired";
}
export function publicGrant(grant: AgentGrant, now = unixNow()) {
  return { id: grant.id, client_name: grant.client_name, status: grantState(grant, now),
    code: grant.id.slice(0, 8).toUpperCase(), created_at: grant.created_at,
    request_expires_at: grant.request_expires_at, authorized_at: grant.authorized_at,
    expires_at: grant.expires_at, scopes: AGENT_SCOPES };
}
export async function startAgentRequest(db: D1Database, tokenHash: unknown, clientName: unknown, ip: string, now = unixNow()) {
  if (typeof tokenHash !== "string" || !/^[a-f0-9]{64}$/.test(tokenHash)) throw new AgentAccessError("连接请求无效。");
  if (typeof clientName !== "string" || !clientName.trim() || clientName.length > 60 || /[\x00-\x1f\x7f]/.test(clientName)) throw new AgentAccessError("请输入有效的设备名称。");
  const id = crypto.randomUUID().replaceAll("-", "");
  const ipHash = await digest(ip);
  await db.prepare("DELETE FROM agent_authorizations WHERE user_id IS NULL AND request_expires_at < ?").bind(now - 86400).run();
  // A single conditional insert keeps concurrent requests within the limits.
  const grant = await db.prepare(`INSERT INTO agent_authorizations
    (id, token_hash, client_name, request_ip_hash, created_at, request_expires_at)
    SELECT ?, ?, ?, ?, ?, ? WHERE
      (SELECT COUNT(*) FROM agent_authorizations WHERE request_ip_hash = ? AND created_at > ?) < 10
      AND (SELECT COUNT(*) FROM agent_authorizations WHERE created_at > ?) < 1000
    ON CONFLICT(token_hash) DO NOTHING RETURNING *`)
    .bind(id, tokenHash, clientName.trim(), ipHash, now, now + PAIR_SECONDS, ipHash, now - 600, now - 600).first<AgentGrant>();
  if (!grant) throw new AgentAccessError("连接请求过于频繁，请稍后重试。", 429);
  return publicGrant(grant, now);
}
export async function findAgentRequest(db: D1Database, id: string) {
  if (!/^[a-f0-9]{32}$/.test(id)) throw new AgentAccessError("连接请求无效。", 404);
  const row = await db.prepare("SELECT * FROM agent_authorizations WHERE id = ?").bind(id).first<AgentGrant>();
  if (!row) throw new AgentAccessError("连接请求不存在。", 404);
  return row;
}
export async function grantToUser(db: D1Database, id: string, userId: string, now = unixNow()) {
  const row = await db.prepare(`UPDATE agent_authorizations SET user_id = ?, authorized_at = ?, expires_at = ?
    WHERE id = ? AND user_id IS NULL AND revoked_at IS NULL AND request_expires_at > ? RETURNING *`)
    .bind(userId, now, now + GRANT_SECONDS, id, now).first<AgentGrant>();
  if (!row) throw new AgentAccessError("请求已处理或已过期，请从 Agent 重新连接。", 409);
  return publicGrant(row, now);
}
export async function listAgentGrants(db: D1Database, userId: string) {
  const rows = await db.prepare("SELECT * FROM agent_authorizations WHERE user_id = ? ORDER BY created_at DESC").bind(userId).all<AgentGrant>();
  return rows.results.map(row => publicGrant(row));
}
export async function revokeAgentGrant(db: D1Database, id: string, userId: string, now = unixNow()) {
  const row = await db.prepare("UPDATE agent_authorizations SET revoked_at = COALESCE(revoked_at, ?) WHERE id = ? AND user_id = ? RETURNING id").bind(now, id, userId).first();
  if (!row) throw new AgentAccessError("授权不存在。", 404);
}
export async function bearerGrant(db: D1Database, request: Request) {
  const match = /^Bearer (slr_[a-f0-9]{64})$/.exec(request.headers.get("authorization") || "");
  if (!match) throw new AgentAccessError("需要 Agent 只读授权。", 401);
  const row = await db.prepare("SELECT * FROM agent_authorizations WHERE token_hash = ?").bind(await digest(match[1])).first<AgentGrant>();
  if (!row) throw new AgentAccessError("授权无效，请重新连接。", 401);
  return row;
}
export async function requireAgentUser(db: D1Database, request: Request) {
  const row = await bearerGrant(db, request);
  if (grantState(row) !== "connected" || !row.user_id) throw new AgentAccessError("授权未生效、已过期或已撤销，请重新连接。", 401);
  return row.user_id;
}
export function requireSameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") throw new AgentAccessError("请在 Study Log 页面内操作。", 403);
}
export async function agentBody(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") throw new AgentAccessError("需要 JSON 请求。", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new AgentAccessError("请求为空。");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 2048) { await reader.cancel(); throw new AgentAccessError("请求过大。", 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let value;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new AgentAccessError("请求格式无效。"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AgentAccessError("请求格式无效。");
  return value;
}
export function agentJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
}
export function agentError(error: unknown) {
  return error instanceof AgentAccessError ? agentJson({ error: error.message }, error.status) : agentJson({ error: "暂时无法处理连接，请稍后重试。" }, 503);
}
