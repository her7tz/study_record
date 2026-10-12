import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="auth-page">
      <article className="privacy-card">
        <Link className="auth-brand" href="/">研习簿 <span>STUDY LOG</span></Link>
        <p className="section-kicker">隐私说明</p>
        <h1>你的账户与学习数据</h1>
        <p>研习簿使用登录信息来识别你的账户，并把学习记录、项目、积分和回收站内容与该账户关联。</p>
        <h2>我们处理哪些信息</h2>
        <p>使用 ChatGPT 登录时，本站会收到 Sites 提供的账户标识、邮箱和可选姓名。绑定备用邮箱后，本站会保存验证过的邮箱地址，用于邮箱验证码登录和账户找回。验证码以不可逆摘要形式保存，10 分钟后失效，验证成功后删除。</p>
        <h2>数据保存与服务提供方</h2>
        <p>学习数据和备用邮箱保存在本站使用的 Sites 数据库中。发送验证码时，收件邮箱和邮件内容会交由 Resend 代为投递。本站不会收集或保存你的 QQ 邮箱密码。</p>
        <h2>数据访问与删除</h2>
        <p>账户登录后只能读取与该账户关联的学习数据。你可以在研习簿中删除记录或项目；删除内容按应用内回收站规则处理。备用邮箱会在账户保持绑定期间保留；如需更换，请使用 ChatGPT 登录并联系站点运营者。</p>
        <h2>联系与第三方说明</h2>
        <p>研习簿由站点创建者运营。有关数据请求，请通过创建此站点的 ChatGPT 会话联系运营者。ChatGPT Sites 和 Resend 各自的隐私政策也适用于其提供的托管、认证或邮件服务。</p>
        <p className="auth-footnote"><Link href="/login">返回登录</Link></p>
      </article>
    </main>
  );
}
