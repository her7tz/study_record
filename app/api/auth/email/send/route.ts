import { getChatGPTUser } from "@/app/chatgpt-auth";
import { emailIsLinked, normalizeEmail, sendEmailCode, type EmailCodePurpose } from "@/lib/email-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "请求无效，请刷新后重试。" }, { status: 403 });
  try {
    const payload = await request.json() as { email?: unknown; purpose?: unknown };
    const email = normalizeEmail(String(payload.email ?? ""));
    const purpose = payload.purpose === "link" ? "link" : payload.purpose === "login" ? "login" : null;
    if (!email || !purpose) return Response.json({ error: "请输入有效邮箱地址。" }, { status: 400 });
    if (purpose === "link" && !(await getChatGPTUser())) return Response.json({ error: "请先使用 ChatGPT 登录，再绑定备用邮箱。" }, { status: 401 });

    // Return the same response for unbound login addresses to avoid account enumeration.
    if (purpose === "link" || await emailIsLinked(email)) {
      const result = await sendEmailCode(email, purpose as EmailCodePurpose);
      if (result === "throttled") return Response.json({ error: "请稍等一分钟再获取验证码。" }, { status: 429 });
    }
    return Response.json({ ok: true, message: "如果邮箱已绑定，验证码会在数分钟内发送。" });
  } catch (error) {
    console.error("auth:email-send", error);
    return Response.json({ error: "邮箱验证服务暂不可用，请稍后再试。" }, { status: 503 });
  }
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
