"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PointRedemption } from "@/lib/point-redemptions";

type RedemptionPage = {
  available_points: number;
  redemptions: PointRedemption[];
  total: number;
};

async function redemptionRequest<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error || "兑换记录操作失败，请稍后再试。");
  return result;
}

export function PointRedemptionDialog({ open, onClose, onChanged, onOpenTrash }: {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  onOpenTrash: () => void;
}) {
  const [availablePoints, setAvailablePoints] = useState(0);
  const [redemptions, setRedemptions] = useState<PointRedemption[]>([]);
  const [total, setTotal] = useState(0);
  const [editing, setEditing] = useState<PointRedemption | null>(null);
  const [rewardName, setRewardName] = useState("");
  const [points, setPoints] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const listRequest = useRef<AbortController | null>(null);
  const rewardInput = useRef<HTMLInputElement | null>(null);
  const busy = saving || loading || loadingMore;
  const validPoints = Number.isSafeInteger(Number(points)) && Number(points) >= 1 && Number(points) <= 1_000_000;
  const projectedBalance = availablePoints + (editing?.points || 0) - Number(points);

  const loadRedemptions = useCallback(async (offset = 0) => {
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    setLoading(offset === 0);
    setLoadingMore(offset > 0);
    setError("");
    try {
      const result = await redemptionRequest<RedemptionPage>(`/api/redemptions?offset=${offset}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setAvailablePoints(result.available_points);
      setTotal(result.total);
      setRedemptions((current) => offset ? [...current, ...result.redemptions] : result.redemptions);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "兑换记录加载失败。");
    } finally {
      if (!controller.signal.aborted) { setLoading(false); setLoadingMore(false); }
    }
  }, []);

  function resetForm() {
    setEditing(null);
    setRewardName("");
    setPoints("");
  }

  useEffect(() => {
    if (!open) return;
    resetForm();
    void loadRedemptions();
    return () => listRequest.current?.abort();
  }, [loadRedemptions, open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !validPoints || !rewardName.trim()) return;
    setSaving(true);
    try {
      await redemptionRequest("/api/redemptions", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: editing?.id, reward_name: rewardName, points: Number(points) }),
      });
      const wasEditing = Boolean(editing);
      resetForm();
      onChanged();
      await loadRedemptions();
      toast.success(wasEditing ? "兑换记录已更新" : "积分兑换已记录");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "保存失败，请稍后再试。");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: PointRedemption) {
    setSaving(true);
    try {
      await redemptionRequest(`/api/redemptions?id=${item.id}`, { method: "DELETE" });
      if (editing?.id === item.id) resetForm();
      onChanged();
      await loadRedemptions();
      toast.success("兑换记录已移入回收站，7 天内可恢复");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "删除失败，请稍后再试。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="redemption-dialog sm:max-w-[560px]">
        <DialogHeader>
          <p className="section-kicker">REDEEM POINTS</p>
          <DialogTitle>积分兑换</DialogTitle>
          <DialogDescription>允许超出剩余积分兑换，余额可为负数。兑换记录可修改，删除后 7 天内可恢复。</DialogDescription>
        </DialogHeader>
        <div className={`redemption-balance${availablePoints < 0 ? " negative" : ""}`} aria-live="polite"><span>剩余积分</span><strong>{loading ? "…" : availablePoints}</strong></div>
        {availablePoints < 0 && !loading ? <p className="redemption-hint">已超额兑换 {Math.abs(availablePoints)} 积分，后续获得的积分会补足余额。</p> : null}
        <form className="redemption-form" onSubmit={submit}>
          {editing ? <h3 className="redemption-edit-heading">修改兑换记录</h3> : null}
          <div className="form-row">
            <Label htmlFor="redemption-reward">兑换内容</Label>
            <Input ref={rewardInput} id="redemption-reward" value={rewardName} maxLength={80} disabled={saving} onChange={(event) => setRewardName(event.target.value)} placeholder="例如：看一场电影" required />
          </div>
          <div className="form-row">
            <Label htmlFor="redemption-points">使用积分</Label>
            <Input id="redemption-points" type="number" min={1} max={1000000} step={1} value={points} disabled={saving} onChange={(event) => setPoints(event.target.value)} placeholder="输入整数" required />
          </div>
          {validPoints && !loading ? <p className="redemption-hint">保存后剩余 {projectedBalance} 积分{projectedBalance < 0 ? "，可继续兑换。" : "。"}</p> : null}
          <DialogFooter>
            {editing ? <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>取消修改</Button> : null}
            <Button type="submit" disabled={busy || !rewardName.trim() || !validPoints}>
              {saving ? "正在保存…" : editing ? "保存修改" : "确认兑换"}
            </Button>
          </DialogFooter>
        </form>
        <section className="redemption-history" aria-labelledby="redemption-history-title">
          <div className="redemption-history-heading"><h3 id="redemption-history-title">兑换记录</h3><button type="button" className="redemption-trash-link" onClick={onOpenTrash} disabled={saving}><RotateCcw />回收站</button></div>
          {error ? <div className="redemption-load-error" role="alert"><p>{error}</p><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void loadRedemptions()}>重试</Button></div> : null}
          {loading ? <p className="redemption-empty">正在读取兑换记录…</p> : redemptions.length ? (
            <div className="redemption-list">
              {redemptions.map((item) => (
                <article key={item.id}>
                  <div className="redemption-copy"><strong>{item.reward_name}</strong><small>{item.created_at.slice(0, 16).replace("T", " ")}{item.updated_at !== item.created_at ? " · 已修改" : ""}</small></div>
                  <span>−{item.points} 积分</span>
                  <div className="redemption-actions">
                    <button className="record-action" type="button" aria-label={`修改兑换 ${item.reward_name}`} disabled={busy} onClick={() => { setEditing(item); setRewardName(item.reward_name); setPoints(String(item.points)); rewardInput.current?.focus(); }}><Pencil /></button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><button className="record-action danger" type="button" aria-label={`删除兑换 ${item.reward_name}`} disabled={busy}><Trash2 /></button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>删除兑换“{item.reward_name}”？</AlertDialogTitle><AlertDialogDescription>删除后返还 {item.points} 积分，7 天内可在历史记录的回收站中恢复，恢复后会重新扣除这笔积分。</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>保留记录</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void remove(item)} disabled={saving}>确认删除</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </article>
              ))}
            </div>
          ) : !error ? <p className="redemption-empty">还没有兑换记录。</p> : null}
          {!loading && redemptions.length ? <div className="redemption-pagination"><span>已显示 {redemptions.length} / {total} 条</span>{redemptions.length < total ? <Button type="button" variant="outline" size="sm" onClick={() => void loadRedemptions(redemptions.length)} disabled={busy}>{loadingMore ? "加载中…" : "加载更多"}</Button> : null}</div> : null}
        </section>
      </DialogContent>
    </Dialog>
  );
}
