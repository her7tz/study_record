"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Circle, FlaskConical, Gauge, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectExperiment, ProjectExperimentStatus, StudyProject } from "@/lib/project-model";

type ExperimentList = {
  experiments: ProjectExperiment[];
  experiment_count: number;
  experiment_todo_count: number;
};

export function ProjectExperiments({
  project,
  compact = false,
  onCountsChange,
}: {
  project: StudyProject;
  compact?: boolean;
  onCountsChange: (projectId: number, total: number, todo: number, changed?: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ProjectExperiment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [intensityScore, setIntensityScore] = useState(3);
  const [status, setStatus] = useState<ProjectExperimentStatus>("todo");

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    void fetch(`/api/project-experiments?project_id=${project.id}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as ExperimentList & { error?: string };
        if (!response.ok) throw new Error(result.error || "实验列表加载失败。");
        setItems(result.experiments || []);
        onCountsChange(project.id, result.experiment_count, result.experiment_todo_count);
      })
      .catch((error) => {
        if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : "实验列表加载失败。");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, project.id, onCountsChange]);

  function applyList(result: ExperimentList) {
    setItems(result.experiments || []);
    onCountsChange(project.id, result.experiment_count, result.experiment_todo_count, true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSaving(true);
    try {
      const response = await fetch("/api/project-experiments", {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          id: editingId,
          name: trimmedName,
          description: description.trim(),
          intensity_score: intensityScore,
          status,
        }),
      });
      const result = await response.json() as ExperimentList & { error?: string };
      if (!response.ok) throw new Error(result.error || "实验保存失败。");
      applyList(result);
      resetForm();
      toast.success(editingId ? "实验已更新" : "实验已添加");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "实验保存失败。");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(item: ProjectExperiment, nextStatus: ProjectExperimentStatus) {
    if (nextStatus === item.status) return;
    setBusyId(item.id);
    try {
      const response = await fetch("/api/project-experiments", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: project.id, id: item.id, name: item.name, description: item.description, intensity_score: item.intensity_score, status: nextStatus }),
      });
      const result = await response.json() as ExperimentList & { error?: string };
      if (!response.ok) throw new Error(result.error || "实验状态更新失败。");
      applyList(result);
      if (editingId === item.id) setStatus(nextStatus);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "实验状态更新失败。");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: ProjectExperiment) {
    setBusyId(item.id);
    try {
      const response = await fetch(`/api/project-experiments?project_id=${project.id}&id=${item.id}`, { method: "DELETE" });
      const result = await response.json() as ExperimentList & { error?: string };
      if (!response.ok) throw new Error(result.error || "实验删除失败。");
      applyList(result);
      if (editingId === item.id) resetForm();
      toast.success("实验已移入回收站，7 天内可恢复");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "实验删除失败。");
    } finally {
      setBusyId(null);
    }
  }

  function edit(item: ProjectExperiment) {
    setEditingId(item.id);
    setName(item.name);
    setDescription(item.description || "");
    setIntensityScore(item.intensity_score);
    setStatus(item.status);
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setDescription("");
    setIntensityScore(3);
    setStatus("todo");
  }

  const todoItems = items.filter((item) => item.status === "todo");
  const doneItems = items.filter((item) => item.status === "done");

  return (
    <>
      <button
        type="button"
        className={compact ? "project-experiment-link" : "project-experiment-entry"}
        onClick={() => setOpen(true)}
        aria-label={`${project.name}，实验待做 ${project.experiment_todo_count} 项，共 ${project.experiment_count} 项`}
      >
        <FlaskConical />
        <span>实验</span>
        <small>{project.experiment_todo_count}/{project.experiment_count}{compact ? "" : " 待做"}</small>
      </button>
      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) resetForm(); }}>
        <DialogContent className="experiment-dialog sm:max-w-[560px]">
          <DialogHeader>
            <p className="section-kicker">EXPERIMENTS</p>
            <DialogTitle>{project.name} · 实验</DialogTitle>
            <DialogDescription>完成实验会自动记入历史并计分；强度填写正整数，不设上限。</DialogDescription>
          </DialogHeader>
          <form className="experiment-form" onSubmit={submit}>
            <div className="form-row">
              <Label htmlFor={`experiment-name-${project.id}`}>实验名称</Label>
              <Input
                id={`experiment-name-${project.id}`}
                value={name}
                maxLength={80}
                placeholder="例如：比较两种检索策略的效果"
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div className="form-row">
              <div className="label-line"><Label htmlFor={`experiment-description-${project.id}`}>实验简介</Label><span>选填</span></div>
              <Textarea
                id={`experiment-description-${project.id}`}
                value={description}
                maxLength={2000}
                rows={3}
                placeholder="简述实验目的、要做的内容或预期结果"
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="form-row">
              <div className="label-line"><Label htmlFor={`experiment-intensity-${project.id}`}>实验强度</Label><span>正整数</span></div>
              <Input
                id={`experiment-intensity-${project.id}`}
                type="number"
                min={1}
                step={1}
                value={intensityScore}
                onChange={(event) => setIntensityScore(Number(event.target.value))}
                required
              />
            </div>
            <div className="form-row">
              <Label htmlFor={`experiment-status-${project.id}`}>实验状态</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as ProjectExperimentStatus)}>
                <SelectTrigger id={`experiment-status-${project.id}`} className="project-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">待做</SelectItem>
                  <SelectItem value="done">已完成</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="experiment-form-actions">
              {editingId ? <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>取消编辑</Button> : null}
              <Button type="submit" disabled={saving || !name.trim()}><Plus />{saving ? "保存中…" : editingId ? "保存修改" : "添加实验"}</Button>
            </div>
          </form>
          {loading ? <div className="experiment-empty">正在读取实验…</div> : items.length ? (
            <div className="experiment-lists">
              {[["todo", "待做", todoItems], ["done", "已完成", doneItems]].map(([status, label, rows]) => {
                const experiments = rows as ProjectExperiment[];
                if (!experiments.length) return null;
                return (
                  <section className="experiment-list" key={status as string}>
                    <h3>{label as string}<span>{experiments.length}</span></h3>
                    {experiments.map((item) => (
                      <article className={`experiment-item ${item.status}`} key={item.id}>
                        <div className={`experiment-status-toggle ${item.status}`} aria-label={item.status === "todo" ? "待做" : "已完成"}>
                          {item.status === "done" ? <CheckCircle2 /> : <Circle />}
                        </div>
                        <div className="experiment-item-copy">
                          <strong>{item.name}</strong>
                          {item.description ? <p className="experiment-description">{item.description}</p> : null}
                          <span><Gauge />强度 {item.intensity_score}{item.status === "done" ? ` · 完成日期 ${item.completed_at?.slice(0, 10) || "—"}` : ""}</span>
                        </div>
                        <div className="experiment-item-actions">
                          <Select value={item.status} onValueChange={(value) => void updateStatus(item, value as ProjectExperimentStatus)} disabled={busyId !== null || saving}>
                            <SelectTrigger className="experiment-status-select" size="sm" aria-label={`${item.name} 的状态`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todo">待做</SelectItem>
                              <SelectItem value="done">已完成</SelectItem>
                            </SelectContent>
                          </Select>
                          <button type="button" className="record-action" aria-label={`编辑实验 ${item.name}`} onClick={() => edit(item)} disabled={busyId !== null || saving}><Pencil /></button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><button type="button" className="record-action danger" aria-label={`删除实验 ${item.name}`} disabled={busyId === item.id}><Trash2 /></button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>删除“{item.name}”？</AlertDialogTitle>
                                <AlertDialogDescription>实验会移入回收站，7 天内可以恢复。</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>保留实验</AlertDialogCancel>
                                <AlertDialogAction variant="destructive" onClick={() => void remove(item)} disabled={busyId === item.id}>确认删除</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </article>
                    ))}
                  </section>
                );
              })}
            </div>
          ) : <div className="experiment-empty"><FlaskConical /><p>还没有实验，先记下一个想验证的问题。</p></div>}
        </DialogContent>
      </Dialog>
    </>
  );
}
