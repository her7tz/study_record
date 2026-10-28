"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, NotebookPen, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatWeekRange, shiftDate, weekStartString } from "@/lib/date";
import { isValidWeeklyDate, type WeeklyTask, type WeeklyTaskStatus } from "@/lib/weekly-task-model";

type Result = { tasks?: WeeklyTask[]; task?: WeeklyTask; error?: string };
const statusLabels = { todo: "待做", done: "已打勾", crossed: "已打叉" };
async function request(path: string, options: RequestInit = {}): Promise<Result> {
  const response = await fetch(path, { ...options, cache: "no-store" });
  const value = await response.json() as Result;
  if (!response.ok) throw new Error(value.error || "任务操作失败，请稍后重试。");
  return value;
}

export function WeeklyTasks({ today, onTrashChanged }: { today: string; onTrashChanged: () => void }) {
  const currentWeek = weekStartString(today);
  const [week, setWeek] = useState(currentWeek), [revision, setRevision] = useState(0);
  const [tasks, setTasks] = useState<WeeklyTask[]>([]), [loadedWeek, setLoadedWeek] = useState("");
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState<WeeklyTask | null>(null), [editorOpen, setEditorOpen] = useState(false);
  const [title, setTitle] = useState(""), [note, setNote] = useState(""), [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<WeeklyTask | null>(null), [removing, setRemoving] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError("");
    request(`/api/weekly-tasks?week_start=${week}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setTasks(result.tasks || []); setLoadedWeek(week); } })
      .catch(error => { if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "任务加载失败。"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [week, revision]);

  function openEditor(task: WeeklyTask | null = null) {
    setEditing(task); setTitle(task?.title || ""); setNote(task?.note || ""); setEditorOpen(true);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (saving) return;
    setSaving(true);
    try {
      const result = await request("/api/weekly-tasks", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing?.id, week_start: week, title, note, status: editing?.status || "todo" }) });
      if (!result.task) throw new Error("没有收到保存结果，请检查任务列表。");
      setTasks(current => editing ? current.map(task => task.id === editing.id ? result.task! : task) : [...current, result.task!]);
      setEditorOpen(false); setRevision(value => value + 1);
      toast.success(editing ? "每周任务已更新" : "每周任务已记录");
    } catch (error) { toast.error(error instanceof Error ? error.message : "保存失败。"); }
    finally { setSaving(false); }
  }
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  async function mark(task: WeeklyTask, selected: WeeklyTaskStatus) {
    if (updatingIds.has(task.id)) return;
    const status = task.status === selected ? "todo" : selected;
    setUpdatingIds(current => new Set(current).add(task.id));
    setTasks(current => current.map(item => item.id === task.id ? { ...item, status } : item));
    try {
      const result = await request("/api/weekly-tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: task.id, status }) });
      if (!result.task) throw new Error("没有收到标记结果，请刷新后重试。");
      setTasks(current => current.map(item => item.id === task.id ? result.task! : item));
    } catch (error) {
      setTasks(current => current.map(item => item.id === task.id ? { ...item, status: task.status } : item));
      toast.error(error instanceof Error ? error.message : "标记保存失败。");
    } finally { setUpdatingIds(current => { const next = new Set(current); next.delete(task.id); return next; }); }
  }
  async function restore(id: number) {
    try {
      await request("/api/trash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "weekly_task", id }) });
      refresh(); onTrashChanged(); toast.success("每周任务已恢复");
    } catch (error) { toast.error(error instanceof Error ? error.message : "恢复失败。"); }
  }
  async function remove() {
    if (!deleting || removing) return;
    setRemoving(true);
    try {
      const id = deleting.id;
      await request(`/api/weekly-tasks?id=${id}`, { method: "DELETE" });
      setTasks(current => current.filter(task => task.id !== id)); setDeleting(null); onTrashChanged();
      toast.success("任务已移入回收站，7 天内可恢复", { action: { label: "撤销", onClick: () => void restore(id) } });
    } catch (error) { toast.error(error instanceof Error ? error.message : "删除失败。"); }
    finally { setRemoving(false); }
  }
  const waiting = loading || (loadedWeek !== week && !loadError);
  return <section className="weekly-tasks-card weekly-tasks-home" aria-labelledby="weekly-tasks-title">
    <div className="weekly-tasks-heading">
      <div><p className="section-kicker"><NotebookPen />WEEKLY TASKS</p><h1 id="weekly-tasks-title">{week === currentWeek ? "本周任务" : "每周任务"}</h1><p className="weekly-tasks-caption">记下这一周要做的事。</p></div>
      <Button type="button" variant="outline" onClick={() => openEditor()}><Plus />添加任务</Button>
    </div>
    <div className="weekly-tasks-toolbar">
      <div className="weekly-tasks-switcher">
        <Button type="button" variant="ghost" size="icon" aria-label="上一周" disabled={week <= "1900-01-01"} onClick={() => setWeek(shiftDate(week, -7))}><ChevronLeft /></Button>
        <span aria-live="polite">{formatWeekRange(week)}</span>
        <Button type="button" variant="ghost" size="icon" aria-label="下一周" disabled={shiftDate(week, 7) > "9999-12-24"} onClick={() => setWeek(shiftDate(week, 7))}><ChevronRight /></Button>
      </div>
      <div className="weekly-tasks-date"><Input type="date" aria-label="选择任务周次" title="选择该周任意一天" min="1900-01-01" max="9999-12-24" value={week} onChange={event => { if (isValidWeeklyDate(event.target.value)) setWeek(weekStartString(event.target.value)); }} /><Button type="button" size="sm" variant="ghost" disabled={week === currentWeek} onClick={() => setWeek(currentWeek)}>本周</Button></div>
    </div>
    {loadError ? <div className="weekly-tasks-empty" role="alert"><p>{loadError}</p><Button type="button" variant="outline" size="sm" onClick={refresh}>重试</Button></div> : waiting ? <p className="weekly-tasks-empty" role="status">正在读取任务…</p> : tasks.length ? <ul className="weekly-tasks-list">{tasks.map(task => <li key={task.id} className={`weekly-task-${task.status}`}>
      <div className="weekly-task-status" role="group" aria-label={`${task.title}的标记`}>
        <button type="button" className="weekly-mark mark-done" aria-pressed={task.status === "done"} aria-label={`打勾 ${task.title}`} title={task.status === "done" ? "取消打勾，恢复待做" : "打勾"} disabled={updatingIds.has(task.id)} onClick={() => void mark(task, "done")}><Check /></button>
        <button type="button" className="weekly-mark mark-crossed" aria-pressed={task.status === "crossed"} aria-label={`打叉 ${task.title}`} title={task.status === "crossed" ? "取消打叉，恢复待做" : "打叉"} disabled={updatingIds.has(task.id)} onClick={() => void mark(task, "crossed")}><X /></button>
      </div>
      <div className="weekly-task-copy"><h3>{task.title}</h3><span className="weekly-task-state" role="status">{updatingIds.has(task.id) ? "保存中…" : statusLabels[task.status]}</span>{task.note && <p>{task.note}</p>}</div>
      <div className="record-actions"><button className="record-action" type="button" aria-label={`编辑每周任务 ${task.title}`} disabled={updatingIds.has(task.id)} onClick={() => openEditor(task)}><Pencil /></button><button className="record-action danger" type="button" aria-label={`删除每周任务 ${task.title}`} disabled={updatingIds.has(task.id)} onClick={() => setDeleting(task)}><Trash2 /></button></div>
    </li>)}</ul> : <div className="weekly-tasks-empty"><CalendarDays /><p>这一周还没有任务，随手记下想做的事。</p><button type="button" className="weekly-task-add" onClick={() => openEditor()}>记录第一个任务</button></div>}
    <Dialog open={editorOpen} onOpenChange={open => { if (!saving) setEditorOpen(open); }}>
      <DialogContent className="record-dialog weekly-task-dialog sm:max-w-[540px]">
        <DialogHeader><DialogTitle>{editing ? "编辑每周任务" : "添加每周任务"}</DialogTitle><DialogDescription>{formatWeekRange(week)}</DialogDescription></DialogHeader>
        <form className="record-form" onSubmit={save}>
          <div className="form-row"><Label htmlFor="weekly-task-title">任务内容</Label><Input id="weekly-task-title" value={title} onChange={event => setTitle(event.target.value)} required maxLength={120} placeholder="这周想做些什么？" disabled={saving} /></div>
          <div className="form-row"><Label htmlFor="weekly-task-note">备注 <span className="text-muted-foreground text-xs">选填</span></Label><Textarea id="weekly-task-note" value={note} onChange={event => setNote(event.target.value)} maxLength={2000} rows={5} placeholder="补充内容或留下记录…" disabled={saving} /></div>
          <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => setEditorOpen(false)}>取消</Button><Button type="submit" disabled={saving || !title.trim()}>{saving ? "保存中…" : "保存任务"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <AlertDialog open={Boolean(deleting)} onOpenChange={open => { if (!open && !removing) setDeleting(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除每周任务？</AlertDialogTitle><AlertDialogDescription>“{deleting?.title}”会移入回收站，7 天内可以恢复。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={removing}>取消</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={removing} onClick={event => { event.preventDefault(); void remove(); }}>{removing ? "删除中…" : "确认删除"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </section>;
}
