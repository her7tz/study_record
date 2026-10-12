import { env } from "cloudflare:workers";

export type EmailCodePurpose = "login" | "link";

function database() {
  const config = env as unknown as Record<string, string | D1Database | undefined>;
  const db = config.DB as D1Database | undefined;
  if (!db) throw new Error("D1 is unavailable.");
  return db;
}

function bindings() {
  const config = env as unknown as Record<string, string | D1Database | undefined>;
  const db = database();
  const secret = config.APP_AUTH_SECRET;
  const apiKey = config.RESEND_API_KEY;
  const from = config.EMAIL_FROM;
  if (!db || typeof secret !== "string" || secret.length < 32 || typeof apiKey !== "string" || typeof from !== "string") {
    throw new Error("Email authentication is not configured.");
  }
  return { db, secret, apiKey, from };
}

export function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export async function emailIsLinked(email: string) {
  const db = database();
  return Boolean(await db.prepare("SELECT 1 FROM email_identities WHERE email = ? LIMIT 1").bind(email).first());
}

export async function emailLinkedTo(email: string, userId: string) {
  const { db } = bindings();
  const row = await db.prepare("SELECT user_id FROM email_identities WHERE email = ? LIMIT 1").bind(email).first<{ user_id: string }>();
  return row?.user_id === userId;
}

export async function sendEmailCode(email: string, purpose: EmailCodePurpose) {
  const { db, secret, apiKey, from } = bindings();
  await db.prepare("DELETE FROM email_login_codes WHERE expires_at <= ?").bind(new Date().toISOString()).run();
  const existing = await db.prepare("SELECT sent_at, window_started_at, send_count FROM email_login_codes WHERE email = ? AND purpose = ?")
    .bind(email, purpose).first<{ sent_at: string; window_started_at: string; send_count: number }>();
  if (existing && Date.now() - Date.parse(existing.sent_at) < 60_000) return "throttled" as const;
  const windowStartedAt = existing && Date.now() - Date.parse(existing.window_started_at) < 60 * 60_000
    ? existing.window_started_at
    : new Date().toISOString();
  const sendCount = existing && windowStartedAt === existing.window_started_at ? existing.send_count + 1 : 1;
  if (sendCount > 5) return "throttled" as const;

  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  const codeHash = await hmac(secret, `${purpose}:${email}:${code}`);
  const sentAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  await db.prepare(`INSERT INTO email_login_codes (email, purpose, code_hash, expires_at, attempts, sent_at, window_started_at, send_count)
    VALUES (?, ?, ?, ?, 0, ?, ?, ?)
    ON CONFLICT(email, purpose) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0,
      sent_at = excluded.sent_at, window_started_at = excluded.window_started_at, send_count = excluded.send_count`)
    .bind(email, purpose, codeHash, expiresAt, sentAt, windowStartedAt, sendCount).run();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "研习簿登录验证码",
      text: `你的研习簿验证码是 ${code}，10 分钟内有效。若你没有发起此操作，请忽略此邮件。`,
    }),
  });
  if (!response.ok) {
    await db.prepare("DELETE FROM email_login_codes WHERE email = ? AND purpose = ? AND code_hash = ?")
      .bind(email, purpose, codeHash).run();
    throw new Error("Email delivery failed.");
  }
  return "sent" as const;
}

export async function verifyEmailCode(email: string, purpose: EmailCodePurpose, code: string) {
  const { db, secret } = bindings();
  await db.prepare("DELETE FROM email_login_codes WHERE expires_at <= ?").bind(new Date().toISOString()).run();
  const row = await db.prepare("SELECT code_hash, expires_at, attempts FROM email_login_codes WHERE email = ? AND purpose = ?")
    .bind(email, purpose).first<{ code_hash: string; expires_at: string; attempts: number }>();
  if (!row || row.attempts >= 5 || Date.parse(row.expires_at) <= Date.now()) return false;
  const expected = await hmac(secret, `${purpose}:${email}:${code}`);
  if (!constantTimeTextEqual(expected, row.code_hash)) {
    await db.prepare("UPDATE email_login_codes SET attempts = attempts + 1 WHERE email = ? AND purpose = ?")
      .bind(email, purpose).run();
    return false;
  }
  await db.prepare("DELETE FROM email_login_codes WHERE email = ? AND purpose = ?").bind(email, purpose).run();
  return true;
}

export async function linkEmailIdentity(email: string, userId: string) {
  const db = database();
  try {
    const result = await db.prepare(`INSERT INTO email_identities (email, user_id)
      VALUES (?, ?)
      ON CONFLICT(email) DO NOTHING`).bind(email, userId).run();
    if (result.meta.changes > 0) return "linked" as const;
    return await emailLinkedTo(email, userId) ? "already-linked" as const : "used" as const;
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) return "account-already-linked" as const;
    throw error;
  }
}

export async function getLinkedEmail(userId: string) {
  const db = database();
  const row = await db.prepare("SELECT email FROM email_identities WHERE user_id = ? LIMIT 1")
    .bind(userId).first<{ email: string }>();
  return row?.email ?? null;
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeTextEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}
