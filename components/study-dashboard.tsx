"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  FolderKanban,
  Gauge,
  History,
  LayoutDashboard,
  LogOut,
  NotebookPen,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { formatStudyDate, weekStartString } from "@/lib/date";
import type { StudyRecord, StudyRecordInput } from "@/lib/study-records";
import { projectColors, type StudyProject, type StudyProjectInput } from "@/lib/project-model";

type DashboardProps = {
  initialRecords: StudyRecord[];
  initialProjects: StudyProject[];
  today: string;
  user: { displayName: string; email: string };
  loadError: string;
};

type ToolRegistration = {
  registerTool: (tool: {
    name: string;
    title: string;
    description: string;
    inputSchema: object;
    annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
    execute: (input: unknown) => Promise<unknown>;
  }, options?: { signal?: AbortSignal }) => void | Promise<void>;
};

declare global {
  interface Document { modelContext?: ToolRegistration }
}

const intensityChoices = [1, 2, 3, 4, 5];
const colorLabels: Record<string, string> = {
  blue: "蓝色",
  teal: "青色",
  amber: "琥珀",
  violet: "紫色",
  rose: "玫红",
  slate: "灰蓝",
};

function recordInput(record: StudyRecord | null, today: string): StudyRecordInput {
  return {
    study_date: record?.study_date || today,
    subject: record?.subject || "",
    project_id: record?.project_id ?? null,
    intensity_score: record?.intensity_score || 3,
    note: record?.note || "",
  };
}

async function requestJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const payload = (await response.json()) as { error?: string; record?: StudyRecord; project?: StudyProject };
  if (!response.ok) throw new Error(payload.error || "操作失败，请稍后再试。");
  return payload;
}

function RecordEditor({
  today,
  projects,
  record = null,
  onSaved,
  compact = false,
}: {
  today: string;
  projects: StudyProject[];
  record?: StudyRecord | null;
  onSaved: (record: StudyRecord) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState(() => recordInput(record, today));

  function begin() {
    setValues(recordInput(record, today));
    setOpen(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = record ? { ...values, id: record.id } : values;
      const result = await requestJson("/api/records", {
        method: record ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!result.record) throw new Error("没有收到保存结果。");
      onSaved(result.record);
      setOpen(false);
      toast.success(record ? "记录已更新" : "学习记录已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败，请稍后再试。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
      <DialogTrigger asChild>
        {compact ? (
          <button className="record-action" type="button" onClick={begin} aria-label={`编辑 ${record?.subject}`}>
            <Pencil />
          </button>
        ) : (
          <Button className="add-button" size="lg" onClick={begin}>
            <Plus /> 添加学习记录
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="record-dialog sm:max-w-[560px]">
        <DialogHeader>
          <p className="section-kicker">{record ? "调整记录" : "新的积累"}</p>
          <DialogTitle>{record ? "编辑学习记录" : "今天学了什么？"}</DialogTitle>
          <DialogDescription>写下内容并评估这次学习的投入强度。</DialogDescription>
        </DialogHeader>
        <form className="record-form" onSubmit={submit}>
          <div className="form-row">
            <Label htmlFor={`study-date-${record?.id || "new"}`}>日期</Label>
            <Input
              id={`study-date-${record?.id || "new"}`}
              type="date"
              value={values.study_date}
              onChange={(event) => setValues({ ...values, study_date: event.target.value })}
              required
            />
          </div>
          <div className="form-row">
            <Label htmlFor={`subject-${record?.id || "new"}`}>学习内容</Label>
            <Input
              id={`subject-${record?.id || "new"}`}
              value={values.subject}
              maxLength={80}
              placeholder="例如：学习 Next.js 路由"
              onChange={(event) => setValues({ ...values, subject: event.target.value })}
              autoFocus
              required
            />
          </div>
          <div className="form-row">
            <div className="label-line"><Label>所属项目</Label><span>选填</span></div>
            <Select
              value={values.project_id === null ? "none" : String(values.project_id)}
              onValueChange={(value) => setValues({ ...values, project_id: value === "none" ? null : Number(value) })}
            >
              <SelectTrigger className="project-select"><SelectValue placeholder="选择项目" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未分类</SelectItem>
                {projects.map((project) => <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="form-row">
            <div className="label-line"><Label>学习强度</Label><span>{values.intensity_score} / 5</span></div>
            <div className="intensity-choices" aria-label="学习强度分数">
              {intensityChoices.map((score) => (
                <button
                  key={score}
                  type="button"
                  className={values.intensity_score === score ? "active" : ""}
                  onClick={() => setValues({ ...values, intensity_score: score })}
                  aria-label={`强度 ${score} 分`}
                >
                  <strong>{score}</strong><span>{score === 1 ? "轻松" : score === 2 ? "适中" : score === 3 ? "专注" : score === 4 ? "高强" : "极限"}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="form-row">
            <div className="label-line"><Label htmlFor={`note-${record?.id || "new"}`}>学习备注</Label><span>选填</span></div>
            <Textarea
              id={`note-${record?.id || "new"}`}
              rows={4}
              maxLength={2000}
              value={values.note}
              placeholder="记下掌握的知识点或下一步计划"
              onChange={(event) => setValues({ ...values, note: event.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>取消</Button>
            <Button type="submit" disabled={saving}>{saving ? "保存中…" : "保存记录"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteRecord({ record, onDeleted }: { record: StudyRecord; onDeleted: (id: number) => void }) {
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    try {
      await requestJson(`/api/records?id=${record.id}`, { method: "DELETE" });
      onDeleted(record.id);
      toast.success("记录已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败，请稍后再试。");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className="record-action danger" type="button" aria-label={`删除 ${record.subject}`}><Trash2 /></button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>删除“{record.subject}”？</AlertDialogTitle>
          <AlertDialogDescription>这条学习记录会被永久删除，此操作无法撤销。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>保留记录</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={remove} disabled={deleting}>
            {deleting ? "删除中…" : "确认删除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RecordList({
  records,
  projects,
  today,
  onSaved,
  onDeleted,
}: {
  records: StudyRecord[];
  projects: StudyProject[];
  today: string;
  onSaved: (record: StudyRecord) => void;
  onDeleted: (id: number) => void;
}) {
  if (!records.length) {
    return (
      <div className="empty-state">
        <span><NotebookPen /></span>
        <h3>从第一条学习记录开始</h3>
        <p>完成一次学习后，把内容和强度记下来。</p>
        <RecordEditor today={today} projects={projects} onSaved={onSaved} />
      </div>
    );
  }

  const groups = Object.entries(
    records.reduce<Record<string, StudyRecord[]>>((result, record) => {
      (result[record.study_date] ||= []).push(record);
      return result;
    }, {}),
  );

  return (
    <div className="record-groups">
      {groups.map(([date, items]) => (
        <section className="record-group" key={date}>
          <div className="date-heading">
            <h3>{formatStudyDate(date)}</h3>
            <span>平均强度 {(items.reduce((sum, item) => sum + item.intensity_score, 0) / items.length).toFixed(1)}</span>
          </div>
          <div className="record-stack">
            {items.map((record) => (
              <article className="record-card" key={record.id}>
                <div className={`subject-mark mark-${record.id % 4}`}>{record.subject.slice(0, 1).toUpperCase()}</div>
                <div className="record-copy">
                  <h4>{record.subject}</h4>
                  {record.project_id ? (() => {
                    const project = projects.find((item) => item.id === record.project_id);
                    return project ? <span className={`project-pill project-${project.color}`}>{project.name}</span> : null;
                  })() : null}
                  <p className={record.note ? "" : "muted"}>{record.note || "没有填写备注"}</p>
                </div>
                <div className="record-intensity" aria-label={`学习强度 ${record.intensity_score} 分`}>
                  <Gauge /><strong>{record.intensity_score}</strong><span>/ 5</span>
                  <div className="intensity-meter" aria-hidden="true">{intensityChoices.map((score) => <i key={score} className={score <= record.intensity_score ? "active" : ""} />)}</div>
                </div>
                <div className="record-actions">
                  <RecordEditor today={today} projects={projects} record={record} compact onSaved={onSaved} />
                  <DeleteRecord record={record} onDeleted={onDeleted} />
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function StudyHeatmap({ records, today }: { records: StudyRecord[]; today: string }) {
  const totals = records.reduce<Record<string, { score: number; count: number }>>((result, record) => {
    const current = result[record.study_date] || { score: 0, count: 0 };
    result[record.study_date] = { score: current.score + record.intensity_score, count: current.count + 1 };
    return result;
  }, {});
  const end = new Date(`${today}T00:00:00Z`);
  const weekday = end.getUTCDay();
  const mondayDistance = weekday === 0 ? 6 : weekday - 1;
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - mondayDistance - 11 * 7);
  const days = Array.from({ length: 84 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    const total = totals[key];
    const score = total ? total.score / total.count : 0;
    const future = key > today;
    const level = future ? -1 : Math.round(score);
    return { key, score, level, future };
  });
  const visibleDays = days.filter((day) => !day.future);
  const activeDays = visibleDays.filter((day) => day.score > 0).length;
  const startKey = start.toISOString().slice(0, 10);
  const visibleRecords = records.filter((record) => record.study_date >= startKey && record.study_date <= today);
  const averageScore = visibleRecords.length
    ? visibleRecords.reduce((sum, record) => sum + record.intensity_score, 0) / visibleRecords.length
    : 0;

  return (
    <section className="heatmap-card" aria-labelledby="heatmap-title">
      <div className="heatmap-heading">
        <div>
          <p className="section-kicker">CONSISTENCY</p>
          <h2 id="heatmap-title">学习热度</h2>
        </div>
        <p><strong>{activeDays}</strong> 个活跃日 · 平均强度 {averageScore.toFixed(1)}</p>
      </div>
      <div className="heatmap-scroll">
        <div className="heatmap-body">
          <div className="weekday-labels" aria-hidden="true"><span>一</span><span>三</span><span>五</span></div>
          <div className="heatmap-grid" role="grid" aria-label="近 12 周学习热度">
            {days.map((day) => (
              <time
                key={day.key}
                dateTime={day.key}
                className={`heat-cell level-${day.level}`}
                title={day.future ? `${day.key}（未来日期）` : `${day.key}：${day.score ? `平均强度 ${day.score.toFixed(1)}` : "无记录"}`}
                aria-label={day.future ? `${day.key}，未来日期` : `${day.key}，${day.score ? `平均强度 ${day.score.toFixed(1)}` : "无学习记录"}`}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="heatmap-legend" aria-hidden="true"><span>低</span><i className="level-0" /><i className="level-1" /><i className="level-2" /><i className="level-3" /><i className="level-4" /><i className="level-5" /><span>高</span></div>
    </section>
  );
}

function projectInput(project: StudyProject | null): StudyProjectInput {
  return {
    name: project?.name || "",
    description: project?.description || "",
    color: project?.color || "blue",
  };
}

function ProjectEditor({
  project = null,
  onSaved,
  compact = false,
}: {
  project?: StudyProject | null;
  onSaved: (project: StudyProject) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState(() => projectInput(project));

  function begin() {
    setValues(projectInput(project));
    setOpen(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = project ? { ...values, id: project.id } : values;
      const result = await requestJson("/api/projects", {
        method: project ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!result.project) throw new Error("没有收到保存结果。");
      onSaved(result.project);
      setOpen(false);
      toast.success(project ? "项目已更新" : "项目已创建");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "项目保存失败，请稍后再试。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
      <DialogTrigger asChild>
        {compact ? (
          <button className="record-action" type="button" onClick={begin} aria-label={`编辑项目 ${project?.name}`}><Pencil /></button>
        ) : (
          <Button className="add-button" size="lg" onClick={begin}><Plus /> 新建项目</Button>
        )}
      </DialogTrigger>
      <DialogContent className="record-dialog sm:max-w-[520px]">
        <DialogHeader>
          <p className="section-kicker">PROJECT</p>
          <DialogTitle>{project ? "编辑项目" : "建立学习项目"}</DialogTitle>
          <DialogDescription>把同一目标下的学习记录整理在一起。</DialogDescription>
        </DialogHeader>
        <form className="record-form" onSubmit={submit}>
          <div className="form-row">
            <Label htmlFor={`project-name-${project?.id || "new"}`}>项目名称</Label>
            <Input
              id={`project-name-${project?.id || "new"}`}
              value={values.name}
              maxLength={40}
              placeholder="例如：生成式软件工程"
              onChange={(event) => setValues({ ...values, name: event.target.value })}
              autoFocus
              required
            />
          </div>
          <div className="form-row">
            <div className="label-line"><Label htmlFor={`project-description-${project?.id || "new"}`}>项目说明</Label><span>选填</span></div>
            <Textarea
              id={`project-description-${project?.id || "new"}`}
              rows={3}
              maxLength={240}
              value={values.description}
              placeholder="这个项目想达成什么目标？"
              onChange={(event) => setValues({ ...values, description: event.target.value })}
            />
          </div>
          <div className="form-row">
            <Label>标识颜色</Label>
            <div className="color-choices" aria-label="项目颜色">
              {projectColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-choice project-${color} ${values.color === color ? "active" : ""}`}
                  onClick={() => setValues({ ...values, color })}
                  aria-label={colorLabels[color]}
                  aria-pressed={values.color === color}
                ><i /></button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>取消</Button>
            <Button type="submit" disabled={saving}>{saving ? "保存中…" : "保存项目"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProject({ project, onDeleted }: { project: StudyProject; onDeleted: (id: number) => void }) {
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    try {
      await requestJson(`/api/projects?id=${project.id}`, { method: "DELETE" });
      onDeleted(project.id);
      toast.success("项目已删除，关联记录已保留");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "项目删除失败，请稍后再试。");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className="record-action danger" type="button" aria-label={`删除项目 ${project.name}`}><Trash2 /></button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>删除“{project.name}”？</AlertDialogTitle>
          <AlertDialogDescription>项目会被删除，已有学习记录将保留并归入“未分类”。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>保留项目</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={remove} disabled={deleting}>{deleting ? "删除中…" : "确认删除"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ProjectBoard({
  projects,
  records,
  onSaved,
  onDeleted,
  onView,
}: {
  projects: StudyProject[];
  records: StudyRecord[];
  onSaved: (project: StudyProject) => void;
  onDeleted: (id: number) => void;
  onView: (id: number) => void;
}) {
  if (!projects.length) {
    return (
      <div className="empty-state project-empty">
        <span><FolderKanban /></span>
        <h3>创建第一个学习项目</h3>
        <p>按课程、目标或作品整理你的学习记录。</p>
        <ProjectEditor onSaved={onSaved} />
      </div>
    );
  }

  return (
    <div className="project-grid">
      {projects.map((project) => {
        const projectRecords = records.filter((record) => record.project_id === project.id);
        const average = projectRecords.length
          ? projectRecords.reduce((sum, record) => sum + record.intensity_score, 0) / projectRecords.length
          : 0;
        return (
          <article className={`project-card project-${project.color}`} key={project.id}>
            <div className="project-card-top">
              <span className="project-icon"><FolderKanban /></span>
              <div className="record-actions">
                <ProjectEditor project={project} compact onSaved={onSaved} />
                <DeleteProject project={project} onDeleted={onDeleted} />
              </div>
            </div>
            <h2>{project.name}</h2>
            <p>{project.description || "还没有项目说明"}</p>
            <div className="project-stats">
              <span><strong>{projectRecords.length}</strong> 条记录</span>
              <span><strong>{average ? average.toFixed(1) : "—"}</strong> 平均强度</span>
            </div>
            <button type="button" className="project-view" onClick={() => onView(project.id)}>查看项目记录 <ChevronRight /></button>
          </article>
        );
      })}
    </div>
  );
}

export function StudyDashboard({ initialRecords, initialProjects, today, user, loadError }: DashboardProps) {
  const [records, setRecords] = useState(initialRecords);
  const [projects, setProjects] = useState(initialProjects);
  const [view, setView] = useState("dashboard");
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const weekStart = weekStartString(today);

  const saveRecord = useCallback((record: StudyRecord) => {
    setRecords((current) => [record, ...current.filter((item) => item.id !== record.id)]
      .sort((a, b) => b.study_date.localeCompare(a.study_date) || b.created_at.localeCompare(a.created_at)));
  }, []);

  const deleteRecord = useCallback((id: number) => {
    setRecords((current) => current.filter((item) => item.id !== id));
  }, []);

  const saveProject = useCallback((project: StudyProject) => {
    setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)]);
  }, []);

  const deleteProject = useCallback((id: number) => {
    setProjects((current) => current.filter((item) => item.id !== id));
    setRecords((current) => current.map((record) => record.project_id === id ? { ...record, project_id: null } : record));
    setProjectFilter((current) => current === String(id) ? "all" : current);
  }, []);

  const viewProject = useCallback((id: number) => {
    setProjectFilter(String(id));
    setView("history");
  }, []);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "create_study_record",
      title: "添加学习记录",
      description: "添加一条学习内容、日期、强度和备注，并更新当前学习仪表盘。",
      inputSchema: {
        type: "object",
        properties: {
          study_date: { type: "string", description: "YYYY-MM-DD 格式的日期" },
          subject: { type: "string", minLength: 1, maxLength: 80 },
          project_id: { type: ["integer", "null"], description: "所属项目 ID，可不填" },
          intensity_score: { type: "integer", minimum: 1, maximum: 5, description: "学习强度，1 到 5 分" },
          note: { type: "string", maxLength: 2000 },
        },
        required: ["study_date", "subject", "intensity_score"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input) => {
        const value = input as StudyRecordInput;
        const result = await requestJson("/api/records", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...value, project_id: value.project_id ?? null, note: value.note || "" }),
        });
        if (!result.record) throw new Error("记录没有保存成功。");
        saveRecord(result.record);
        return { id: result.record.id, status: "saved", subject: result.record.subject };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    void Promise.resolve(context.registerTool({
      name: "create_study_project",
      title: "创建学习项目",
      description: "创建一个学习项目，用来整理相关学习记录。",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 40 },
          description: { type: "string", maxLength: 240 },
          color: { type: "string", enum: [...projectColors] },
        },
        required: ["name"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input) => {
        const value = input as Partial<StudyProjectInput>;
        const result = await requestJson("/api/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: value.name, description: value.description || "", color: value.color || "blue" }),
        });
        if (!result.project) throw new Error("项目没有保存成功。");
        saveProject(result.project);
        return { id: result.project.id, status: "saved", name: result.project.name };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [saveProject, saveRecord]);

  const todayRecords = useMemo(() => records.filter((record) => record.study_date === today), [records, today]);
  const weekRecords = useMemo(
    () => records.filter((record) => record.study_date >= weekStart && record.study_date <= today),
    [records, today, weekStart],
  );
  const todayIntensity = todayRecords.length ? todayRecords.reduce((sum, record) => sum + record.intensity_score, 0) / todayRecords.length : 0;
  const weekIntensity = weekRecords.length ? weekRecords.reduce((sum, record) => sum + record.intensity_score, 0) / weekRecords.length : 0;
  const filteredRecords = records.filter((record) => {
    const needle = query.trim().toLowerCase();
    const project = projects.find((item) => item.id === record.project_id);
    const matchesProject = projectFilter === "all" || (projectFilter === "none" ? record.project_id === null : record.project_id === Number(projectFilter));
    return matchesProject && (!needle || `${record.subject} ${record.note} ${project?.name || ""}`.toLowerCase().includes(needle));
  });
  const firstName = user.displayName.includes("@") ? "同学" : user.displayName.split(/\s+/)[0];

  return (
    <Tabs value={view} onValueChange={setView} className="app-frame">
      <aside className="sidebar">
        <div className="brand-lockup">
          <span className="brand-mark"><BookOpen /></span>
          <span><strong>研习簿</strong><small>STUDY LOG</small></span>
        </div>
        <TabsList className="side-nav">
          <TabsTrigger value="dashboard"><LayoutDashboard />今日概览</TabsTrigger>
          <TabsTrigger value="history"><History />历史记录</TabsTrigger>
          <TabsTrigger value="projects"><FolderKanban />学习项目</TabsTrigger>
        </TabsList>
        <div className="sidebar-note">
          <span>本周平均强度</span>
          <strong>{weekIntensity ? `${weekIntensity.toFixed(1)} / 5` : "尚无记录"}</strong>
          <Progress value={weekIntensity * 20} />
          <small>{weekRecords.length} 次学习记录</small>
        </div>
        <div className="account-card">
          <span className="avatar">{user.email.slice(0, 1).toUpperCase()}</span>
          <span><small>学习账户</small><strong title={user.email}>{user.email}</strong></span>
          <a href="/signout-with-chatgpt?return_to=/" aria-label="退出登录"><LogOut /></a>
        </div>
      </aside>

      <main className="main-content">
        <TabsContent value="dashboard" className="view-content">
          <header className="topbar">
            <div>
              <p className="section-kicker"><CalendarDays />{formatStudyDate(today)}</p>
              <h1>{firstName}，今天学了什么？</h1>
            </div>
            <RecordEditor today={today} projects={projects} onSaved={saveRecord} />
          </header>
          {loadError ? <p className="data-error">{loadError}</p> : null}
          <section className="stats-grid" aria-label="学习统计">
            <article className="focus-card">
              <div className="focus-copy"><span>今日学习强度</span><strong>{todayIntensity ? todayIntensity.toFixed(1) : "—"}<small>/ 5</small></strong></div>
              <div className="focus-ring" style={{ "--progress": `${todayIntensity * 72}deg` } as React.CSSProperties}>
                <span>{todayRecords.length ? `${todayRecords.length} 次` : "待记录"}</span>
              </div>
              <div className="focus-progress"><Progress value={todayIntensity * 20} /><p>{todayRecords.length ? "根据今日所有记录计算平均强度" : "添加记录后即可看见今日强度"}</p></div>
            </article>
            <article className="stat-card"><span>本周平均强度</span><strong>{weekIntensity ? weekIntensity.toFixed(1) : "—"}</strong><small>/ 5</small><p>从周一到今天</p></article>
            <article className="stat-card"><span>本周记录</span><strong>{weekRecords.length}</strong><small>次</small><p>{weekRecords.length ? "正在稳步积累" : "等待第一条记录"}</p></article>
          </section>
          <StudyHeatmap records={records} today={today} />
          <section className="records-section">
            <div className="section-heading">
              <div><p className="section-kicker">RECENT</p><h2>最近记录</h2></div>
              <button type="button" onClick={() => setView("history")}>查看全部 <ChevronRight /></button>
            </div>
            <RecordList records={records.slice(0, 6)} projects={projects} today={today} onSaved={saveRecord} onDeleted={deleteRecord} />
          </section>
        </TabsContent>

        <TabsContent value="history" className="view-content">
          <header className="topbar history-header">
            <div><p className="section-kicker">全部积累</p><h1>历史记录</h1><p className="page-description">共 {records.length} 条学习记录 · 平均强度 {records.length ? (records.reduce((sum, item) => sum + item.intensity_score, 0) / records.length).toFixed(1) : "—"}</p></div>
            <RecordEditor today={today} projects={projects} onSaved={saveRecord} />
          </header>
          <div className="history-filters">
            <div className="search-box"><Search /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索内容、项目或备注" aria-label="搜索学习记录" />{query ? <span>{filteredRecords.length} 条结果</span> : null}</div>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="history-project-filter"><SelectValue placeholder="全部项目" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部项目</SelectItem>
                <SelectItem value="none">未分类</SelectItem>
                {projects.map((project) => <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <section className="records-section history-records">
            <RecordList records={filteredRecords} projects={projects} today={today} onSaved={saveRecord} onDeleted={deleteRecord} />
          </section>
        </TabsContent>

        <TabsContent value="projects" className="view-content">
          <header className="topbar history-header">
            <div><p className="section-kicker">PROJECTS</p><h1>学习项目</h1><p className="page-description">用项目整理长期目标、课程和正在推进的作品。</p></div>
            <ProjectEditor onSaved={saveProject} />
          </header>
          <ProjectBoard projects={projects} records={records} onSaved={saveProject} onDeleted={deleteProject} onView={viewProject} />
        </TabsContent>
      </main>

      <TabsList className="mobile-nav">
        <TabsTrigger value="dashboard"><LayoutDashboard />今日</TabsTrigger>
        <TabsTrigger value="history"><History />历史</TabsTrigger>
        <TabsTrigger value="projects"><FolderKanban />项目</TabsTrigger>
      </TabsList>
      <Toaster position="top-center" richColors />
    </Tabs>
  );
}
