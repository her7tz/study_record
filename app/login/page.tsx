import Link from "next/link";
import { EmailAuthForm } from "@/components/email-auth-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" href="/">研习簿 <span>STUDY LOG</span></Link>
        <p className="section-kicker">邮箱登录</p>
        <h1>用 QQ 邮箱登录</h1>
        <p className="auth-description">输入已绑定的 QQ 邮箱，我们会发送一次性验证码。无需设置或记住额外密码。</p>
        <EmailAuthForm purpose="login" />
        <p className="auth-footnote">还没有绑定备用邮箱？请先 <a href="/signin-with-chatgpt?return_to=%2Faccount%2Femail">使用 ChatGPT 登录并绑定</a>。</p>
        <p className="auth-footnote">也可以 <a href="/signin-with-chatgpt?return_to=%2F">继续使用 ChatGPT 登录</a>。</p>
        <p className="auth-footnote">邮箱仅用于验证登录和找回账户；验证码邮件由 Resend 发送。<Link href="/privacy">隐私说明</Link></p>
      </section>
    </main>
  );
}
