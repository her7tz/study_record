import { getChatGPTUser, emailSessionCookieHeader, makeEmailSessionToken } from "@/app/chatgpt-auth";
import { linkEmailIdentity, normalizeEmail, verifyEmailCode, type EmailCodePurpose } from "@/lib/email-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求无效，请刷新后重试。" }, { status: 403 });
  try {
    const payload = await request.json() as { email?: unknown; code?: unknown; purpose?: unknown };
    const email = normalizeEmail(String(payload.email ?? ""));
    const code = String(payload.code ?? "").trim();
    const purpose = payload.purpose === "link" ? "link" : payload.purpose === "login" ? "login" : null;
    if (!email || !purpose || !/^\d{6}$/.test(code)) return Response.json({ error: "邮箱或验证码格式不正确。" }, { status: 400 });

    const chatGPTUser = purpose === "link" ? await getChatGPTUser() : null;
    if (purpose === "link" && !chatGPTUser) return Response.json({ error: "请先使用 ChatGPT 登录，再绑定备用邮箱。" }, { status: 401 });
    if (!(await verifyEmailCode(email, purpose as EmailCodePurpose, code))) return Response.json({ error: "验证码无效或已过期，请重新获取。" }, { status: 400 });

    if (purpose === "link" && chatGPTUser) {
      const result = await linkEmailIdentity(email, chatGPTUser.userId);
      if (result === "used") return Response.json({ error: "这个邮箱已绑定其他账户。" }, { status: 409 });
      if (result === "account-already-linked") return Response.json({ error: "此账户已绑定一个备用邮箱，请先解绑后再试。" }, { status: 409 });
      return Response.json({ ok: true, email });
    }

    const identity = await findEmailIdentity(email);
    if (!identity) return Response.json({ error: "验证码无效或已过期，请重新获取。" }, { status: 400 });
    const token = await makeEmailSessionToken({ userId: identity.user_id, email });
    return new Response(JSON.stringify({ ok: true, redirect: "/" }), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Set-Cookie": emailSessionCookieHeader(token) },
    });
  } catch (error) {
    console.error("auth:email-verify", error);
    return Response.json({ error: "邮箱验证服务暂不可用，请稍后再试。" }, { status: 503 });
  }
}

async function findEmailIdentity(email: string) {
  const { env } = await import("cloudflare:workers");
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("D1 is unavailable.");
  return db.prepare("SELECT user_id FROM email_identities WHERE email = ? LIMIT 1").bind(email).first<{ user_id: string }>();
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
