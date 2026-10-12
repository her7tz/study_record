"use client";

import { useState } from "react";

export function EmailAuthForm({ purpose, initialEmail = "" }: { purpose: "login" | "link"; initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function sendCode() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/auth/email/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "验证码发送失败。");
      setSent(true); setMessage("如果邮箱已绑定，验证码会发送到该邮箱。请检查收件箱和垃圾邮件。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "验证码发送失败，请稍后再试。");
    } finally { setBusy(false); }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/auth/email/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, purpose }),
      });
      const result = await response.json() as { error?: string; redirect?: string };
      if (!response.ok) throw new Error(result.error || "验证失败。");
      if (purpose === "login") window.location.assign(result.redirect || "/");
      else { setMessage("QQ 邮箱已绑定，可以用它登录并找回此账户。"); setSent(false); setCode(""); }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "验证失败，请稍后再试。");
    } finally { setBusy(false); }
  }

  return (
    <form className="email-auth-form" onSubmit={verifyCode}>
      <label htmlFor="email-auth-address">QQ 邮箱</label>
      <input id="email-auth-address" type="email" autoComplete="email" required maxLength={254}
        placeholder="name@qq.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy || sent} />
      {!sent ? <button type="button" onClick={sendCode} disabled={busy || !email.trim()}>{busy ? "发送中…" : "发送验证码"}</button> : <>
        <label htmlFor="email-auth-code">邮箱验证码</label>
        <input id="email-auth-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required
          placeholder="6 位验证码" value={code} onChange={(event) => setCode(event.target.value)} disabled={busy} />
        <div className="email-auth-actions">
          <button type="submit" disabled={busy || code.length !== 6}>{busy ? "验证中…" : purpose === "login" ? "登录" : "确认绑定"}</button>
          <button type="button" className="email-auth-secondary" onClick={sendCode} disabled={busy}>重新发送</button>
        </div>
      </>}
      {message && <p className="email-auth-message" role="status">{message}</p>}
      {error && <p className="email-auth-error" role="alert">{error}</p>}
    </form>
  );
}
