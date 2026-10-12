import Link from "next/link";
import { redirect } from "next/navigation";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { EmailAuthForm } from "@/components/email-auth-form";
import { getLinkedEmail } from "@/lib/email-auth";

export const dynamic = "force-dynamic";

export default async function EmailAccountPage() {
  const user = await getChatGPTUser();
  if (!user) redirect("/signin-with-chatgpt?return_to=%2Faccount%2Femail");
  const linkedEmail = await getLinkedEmail(user.userId);
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" href="/">研习簿 <span>STUDY LOG</span></Link>
        <p className="section-kicker">账户安全</p>
        <h1>备用邮箱</h1>
        {linkedEmail ? <>
          <p className="auth-description">已绑定的 QQ 邮箱：<strong>{linkedEmail}</strong></p>
          <p className="auth-description">你可以使用该邮箱接收验证码，登录并找回这个学习账户。</p>
        </> : <>
          <p className="auth-description">绑定 QQ 邮箱后，即使暂时无法使用 ChatGPT 账户，也可以通过邮箱验证码登录并找回原有学习记录。</p>
          <EmailAuthForm purpose="link" />
        </>}
        <p className="auth-footnote"><Link href="/">返回研习簿</Link></p>
      </section>
    </main>
  );
}
