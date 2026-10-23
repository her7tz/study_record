"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
type Grant = { id: string; client_name: string; code: string; status: string; expires_at: number | null; request_expires_at: number };
const statusName: Record<string, string> = { pending: "等待授权", connected: "已授权", expired: "已过期", revoked: "已撤销" };
async function api<T>(path: string, body?: unknown) {
  const response = await fetch(path, { method: body ? "POST" : "GET", cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const value = await response.json() as T & { error?: string }; if (!response.ok) throw new Error(value.error || "操作失败，请重试。"); return value;
}
export function AgentAccessPanel({ email, requestId }: { email: string; requestId?: string }) {
  const [grants, setGrants] = useState<Grant[]>([]), [pending, setPending] = useState<Grant | null>(null);
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const refresh = useCallback(async () => {
    const data = await api<{ grants: Grant[] }>("/api/agent/authorizations"); setGrants(data.grants);
    if (requestId) setPending((await api<{ request: Grant }>(`/api/agent/authorizations?request=${requestId}`)).request);
    setLoaded(true);
  }, [requestId]);
  useEffect(() => { refresh().catch(e => { setError(e.message); setLoaded(true); }); }, [refresh]);
  async function act(id: string, action: "approve" | "revoke") {
    setBusy(true); setError(""); setMessage("");
    try { await api("/api/agent/authorizations", { id, action }); await refresh(); setMessage(action === "approve" ? "已授权。请回到 Agent，连接会自动完成。" : "已撤销，此连接不能再读取你的数据。"); }
    catch (e) { setError(e instanceof Error ? e.message : "操作失败。"); } finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-2xl px-5 py-10 text-slate-800">
    <a href="/" className="mb-8 inline-flex items-center gap-2 text-blue-700"><ArrowLeft size={18} /> 返回研习簿</a>
    <div className="mb-6 flex items-center gap-3"><ShieldCheck size={30} /><h1 className="text-3xl font-semibold">Agent 只读授权</h1></div>
    <p className="mb-6 break-all text-slate-600">当前账户：{email}</p>
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {message && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-emerald-800">{message}</p>}
    {pending?.status === "pending" && <section className="mb-6 rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">授权 {pending.client_name}</h2>
      <p className="mt-3">核对 Agent 中的连接码：<strong className="font-mono tracking-widest">{pending.code}</strong></p>
      <p className="mt-3 text-slate-600">允许读取你的学习和实验记录、项目及依赖、统计信息。授权有效期 30 天，可随时撤销。</p>
      <p className="mt-3 text-sm text-slate-600">Agent 分析时，会将读取的数据提交给你在 Agent 中配置的模型服务。撤销会阻止后续读取，已生成的对话或报告仍保存在 Agent 中。</p>
      <label className="my-5 flex items-start gap-3"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1" />这是我刚刚在自己的 Agent 中发起的连接，连接码一致。</label>
      <div className="flex flex-wrap gap-4"><button type="button" disabled={busy || !confirmed} onClick={() => act(pending.id, "approve")} className="rounded-xl bg-blue-700 px-5 py-3 text-white disabled:opacity-50">{busy ? "处理中…" : "授权 Agent 只读访问"}</button><a className="px-3 py-3 text-slate-600" href="/agent-access">暂不授权</a></div>
    </section>}
    {pending && pending.status !== "pending" && <p className="mb-6">此请求{statusName[pending.status]}。{pending.status === "connected" ? "请回到 Agent 查看连接状态。" : "如需连接，请从 Agent 重新发起。"}</p>}
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-xl font-semibold">已授权连接</h2>
      {!loaded ? <p>读取中…</p> : grants.length === 0 ? <p className="text-slate-600">还没有授权。请在 Agent 设置中点击“连接 Study Log”，再回到这里确认。</p> : <ul className="space-y-4">{grants.map(grant => <li key={grant.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div><strong>{grant.client_name}</strong><p className="mt-1 text-sm text-slate-600">{statusName[grant.status]} · {grant.code}{grant.expires_at ? ` · 有效至 ${new Date(grant.expires_at * 1000).toLocaleDateString("zh-CN")}` : ""}</p></div>
        {grant.status === "connected" && <button type="button" disabled={busy} onClick={() => act(grant.id, "revoke")} className="rounded-lg border border-red-200 px-3 py-2 text-red-700 disabled:opacity-50">撤销授权</button>}
      </li>)}</ul>}
    </section>
  </main>;
}
