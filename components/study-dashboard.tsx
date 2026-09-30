"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CalendarRange,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Flame,
  FolderKanban,
  Gauge,
  History,
  LayoutDashboard,
  LogOut,
  NotebookPen,
  Pencil,
  Plus,
  Search,
  RotateCcw,
  Star,
  Target,
  TrendingUp,
  Trash2,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
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
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
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
import { formatStudyDate } from "@/lib/date";
import type { HeatmapDay, StudyAnalytics } from "@/lib/study-analytics";
import type { StudyRecord, StudyRecordInput } from "@/lib/study-records";
import { projectColors, projectStatuses, type ProjectStatus, type StudyProject, type StudyProjectInput } from "@/lib/project-model";
import type { TrashItem } from "@/lib/trash";

type DashboardProps = {
  initialRecords: StudyRecord[];
  initialRecordTotal: number;
  initialAnalytics: StudyAnalytics;
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
const statusLabels: Record<ProjectStatus, string> = {
  active: "进行中",
  paused: "已暂停",
  completed: "已完成",
};
const trendConfig = {
  total_points: { label: "积分", color: "#2254d1" },
} satisfies ChartConfig;
const pointDistributionConfig = {
  points: { label: "积分", color: "#2254d1" },
} satisfies ChartConfig;
const projectChartColors: Record<string, string> = {
  blue: "#2254d1",
  teal: "#14867f",
  amber: "#b9780e",
  violet: "#7051b5",
  rose: "#bd435d",
  slate: "#52647e",
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
  const payload = (await response.json()) as {
    error?: string;
    record?: StudyRecord;
    project?: StudyProject;
    projects?: StudyProject[];
    records?: StudyRecord[];
    total?: number;
    average_intensity?: number;
    total_intensity?: number;
    total_points?: number;
    analytics?: StudyAnalytics;
    heatmap?: HeatmapDay[];
    items?: TrashItem[];
  };
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
                {projects.map((project) => <SelectItem key={project.id} value={String(project.id)}>{project.name} · 重要度 {project.importance}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="form-row">
            <div className="label-line"><Label>学习强度</Label><span>{values.intensity_score} / 5 · 可按记录累加</span></div>
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
      toast.success("已移入回收站，7 天内可恢复");
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
          <AlertDialogDescription>记录会移入回收站，你可以在 7 天内恢复。</AlertDialogDescription>
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

function TrashView({ active, revision, onRestored }: { active: boolean; revision: number; onRestored: () => void }) {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void requestJson("/api/trash", { method: "GET", signal: controller.signal })
        .then((result) => setItems(result.items || []))
        .catch((error) => {
          if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : "回收站加载失败。");
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [active, revision]);

  async function restore(item: TrashItem) {
    const key = `${item.kind}:${item.id}`;
    setRestoringId(key);
    try {
      await requestJson("/api/trash", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: item.kind, id: item.id }),
      });
      setItems((current) => current.filter((entry) => `${entry.kind}:${entry.id}` !== key));
      onRestored();
      toast.success(item.kind === "project" ? "项目及关联记录已恢复" : "学习记录已恢复");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "恢复失败，请稍后再试。");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <section className="trash-view" aria-label="回收站内容">
      <div className="trash-intro"><Trash2 /><p>内容删除后 7 天内可恢复，超过期限将无法恢复。</p></div>
      {loading ? <div className="history-loading">正在读取回收站…</div> : items.length ? (
        <div className="trash-list">
          {items.map((item) => {
            const key = `${item.kind}:${item.id}`;
            const deadline = new Date(item.expires_at).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
            return (
              <article className="trash-item" key={key}>
                <div className="trash-item-copy">
                  <span className={`trash-kind ${item.kind}`}>{item.kind === "project" ? "学习项目" : "学习记录"}</span>
                  <h2>{item.title}</h2>
                  {item.kind === "record" ? <p>{item.study_date}{item.project_name ? ` · ${item.project_name}` : " · 未分类"}</p> : <p>{item.record_count} 条关联记录会随项目一起恢复</p>}
                  <small>恢复期限至 {deadline}</small>
                </div>
                <Button type="button" variant="outline" onClick={() => void restore(item)} disabled={restoringId !== null}>
                  <RotateCcw />{restoringId === key ? "恢复中…" : "恢复"}
                </Button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state trash-empty"><span><Trash2 /></span><h3>回收站是空的</h3><p>删除的项目和学习记录会显示在这里。</p></div>
      )}
    </section>
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
            <span>
              累计强度 {items.reduce((sum, item) => sum + item.intensity_score, 0)} · 积分 {items.reduce((sum, item) => {
                const project = projects.find((candidate) => candidate.id === item.project_id);
                return sum + item.intensity_score * Number(project?.importance || 0);
              }, 0)}
            </span>
          </div>
          <div className="record-stack">
            {items.map((record) => {
              const recordProject = projects.find((item) => item.id === record.project_id);
              const points = record.intensity_score * Number(recordProject?.importance || 0);
              return <article className="record-card" key={record.id}>
                <div className={`subject-mark mark-${record.id % 4}`}>{record.subject.slice(0, 1).toUpperCase()}</div>
                <div className="record-copy">
                  <h4>{record.subject}</h4>
                  {recordProject ? <span className={`project-pill project-${recordProject.color}`}>{recordProject.name}</span> : null}
                  <p className={record.note ? "" : "muted"}>{record.note || "没有填写备注"}</p>
                </div>
                <div className="record-intensity" aria-label={`学习强度 ${record.intensity_score} 分`}>
                  <Gauge /><strong>{record.intensity_score}</strong><span>/ 5</span>
                  <b>{points} 积分</b>
                  <div className="intensity-meter" aria-hidden="true">{intensityChoices.map((score) => <i key={score} className={score <= record.intensity_score ? "active" : ""} />)}</div>
                </div>
                <div className="record-actions">
                  <RecordEditor today={today} projects={projects} record={record} compact onSaved={onSaved} />
                  <DeleteRecord record={record} onDeleted={onDeleted} />
                </div>
              </article>;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function StudyTrend({ analytics, projects }: { analytics: StudyAnalytics; projects: StudyProject[] }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedRecords, setSelectedRecords] = useState<StudyRecord[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const activeDays = analytics.trend.filter((day) => day.count > 0).length;
  const recent = analytics.trend.slice(-7);
  const previous = analytics.trend.slice(0, 7);
  const total = (days: StudyAnalytics["trend"]) => days.reduce((sum, day) => sum + day.total_points, 0);
  const change = total(recent) - total(previous);

  async function openSources(date: string) {
    setSelectedDate(date);
    setLoadingSources(true);
    try {
      const result = await requestJson(`/api/records?date=${date}&limit=100`, { method: "GET" });
      setSelectedRecords(result.records || []);
    } catch (error) {
      setSelectedRecords([]);
      toast.error(error instanceof Error ? error.message : "积分来源加载失败。");
    } finally {
      setLoadingSources(false);
    }
  }

  function renderTrendDot({ cx, cy, payload }: { cx?: number; cy?: number; payload?: StudyAnalytics["trend"][number] }) {
    if (cx === undefined || cy === undefined || !payload?.count) return <circle cx={cx} cy={cy} r={0} />;

    return (
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill="var(--color-total_points)"
        stroke="white"
        strokeWidth={2}
        className="trend-data-point"
        role="button"
        tabIndex={0}
        aria-label={`${payload.date}，${payload.total_points} 积分，查看积分来源`}
        onClick={() => void openSources(payload.date)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") void openSources(payload.date);
        }}
      />
    );
  }

  return (
    <>
      <section className="trend-card" aria-labelledby="trend-title">
        <div className="trend-heading">
          <div><p className="section-kicker"><TrendingUp />TREND</p><h2 id="trend-title">近 14 天积分趋势</h2><small>点击数据点查看积分来源</small></div>
          <div className="trend-summary">
            <span><strong>{activeDays}</strong> 个学习日</span>
            <span className={change > 0 ? "up" : change < 0 ? "down" : "steady"}>{change > 0 ? "+" : ""}{change} 较前 7 天</span>
          </div>
        </div>
        <ChartContainer config={trendConfig} className="trend-chart" initialDimension={{ width: 760, height: 220 }}>
          <AreaChart data={analytics.trend} margin={{ top: 12, right: 10, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="intensity-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-total_points)" stopOpacity={0.32} />
                <stop offset="100%" stopColor="var(--color-total_points)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 5" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis domain={[0, "auto"]} allowDecimals={false} tickLine={false} axisLine={false} width={28} />
            <ChartTooltip
              cursor={{ stroke: "#9db4f0", strokeDasharray: "3 3" }}
              content={<ChartTooltipContent labelFormatter={(_, payload) => String(payload[0]?.payload?.date || "")} formatter={(value) => <span className="trend-tooltip-value">积分 {Number(value)}</span>} />}
            />
            <Area type="monotone" dataKey="total_points" stroke="var(--color-total_points)" strokeWidth={2.5} fill="url(#intensity-fill)" dot={renderTrendDot} activeDot={false} />
          </AreaChart>
        </ChartContainer>
      </section>
      <Dialog open={Boolean(selectedDate)} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent className="heatmap-dialog sm:max-w-[520px]">
          <DialogHeader>
            <p className="section-kicker">POINT SOURCES</p>
            <DialogTitle>{selectedDate ? `${formatStudyDate(selectedDate)} · 积分来源` : "积分来源"}</DialogTitle>
            <DialogDescription>{loadingSources ? "正在读取…" : `${selectedRecords.length} 条学习记录`}</DialogDescription>
          </DialogHeader>
          {loadingSources ? <div className="heatmap-day-empty"><p>加载中…</p></div> : selectedRecords.length ? (
            <div className="heatmap-day-list">
              {selectedRecords.map((record) => {
                const project = projects.find((item) => item.id === record.project_id);
                const points = record.intensity_score * Number(project?.importance || 0);
                return (
                  <article key={record.id}>
                    <div><h3>{record.subject}</h3>{project ? <span className={`project-pill project-${project.color}`}>{project.name}</span> : <span className="day-unclassified">未分类</span>}{record.note ? <p>{record.note}</p> : null}</div>
                    <strong>{points}<small>积分 · 强度 {record.intensity_score}{project ? ` × 重要度 ${project.importance}` : ""}</small></strong>
                  </article>
                );
              })}
            </div>
          ) : <div className="heatmap-day-empty"><p>这一天没有积分来源。</p></div>}
        </DialogContent>
      </Dialog>
    </>
  );
}

type PointDistributionScope = "week" | "total";

function PointDistributionDialog({
  analytics,
  scope,
  onClose,
}: {
  analytics: StudyAnalytics;
  scope: PointDistributionScope | null;
  onClose: () => void;
}) {
  const valueKey = scope === "week" ? "week_points" : "total_points";
  const data = analytics.project_points
    .map((project) => ({
      id: project.project_id,
      name: project.project_name,
      color: projectChartColors[project.project_color] || projectChartColors.slate,
      points: Number(project[valueKey] || 0),
    }))
    .filter((project) => project.points > 0)
    .sort((a, b) => b.points - a.points);
  const total = data.reduce((sum, project) => sum + project.points, 0);

  return (
    <Dialog open={scope !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="points-dialog sm:max-w-[620px]">
        <DialogHeader>
          <p className="section-kicker">DISTRIBUTION</p>
          <DialogTitle>{scope === "week" ? "本周积分分布" : "累计积分分布"}</DialogTitle>
          <DialogDescription>按学习项目查看积分构成。</DialogDescription>
        </DialogHeader>
        {data.length ? (
          <div className="points-distribution">
            <div className="points-chart-wrap">
              <ChartContainer config={pointDistributionConfig} className="points-chart" initialDimension={{ width: 250, height: 250 }}>
                <PieChart>
                  <ChartTooltip
                    content={<ChartTooltipContent hideLabel formatter={(value, _name, item) => <span className="points-tooltip"><strong>{item.payload?.name}</strong>{Number(value)} 积分</span>} />}
                  />
                  <Pie data={data} dataKey="points" nameKey="name" innerRadius={64} outerRadius={96} paddingAngle={2} strokeWidth={0}>
                    {data.map((project) => <Cell key={project.id} fill={project.color} />)}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="points-chart-total"><strong>{total}</strong><span>积分</span></div>
            </div>
            <div className="points-legend">
              {data.map((project) => (
                <div key={project.id}>
                  <i style={{ background: project.color }} />
                  <span title={project.name}>{project.name}</span>
                  <strong>{project.points}</strong>
                  <small>{Math.round((project.points / total) * 100)}%</small>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="points-empty"><FolderKanban /><p>该周期还没有归入项目的积分。</p></div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StudyHeatmap({ initialDays, projects, today }: { initialDays: HeatmapDay[]; projects: StudyProject[]; today: string }) {
  const [projectFilter, setProjectFilter] = useState("all");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [heatmap, setHeatmap] = useState(initialDays);
  const [selectedRecords, setSelectedRecords] = useState<StudyRecord[]>([]);
  const [selectedTotal, setSelectedTotal] = useState(0);
  const [selectedAverage, setSelectedAverage] = useState(0);
  const [selectedTotalIntensity, setSelectedTotalIntensity] = useState(0);
  const [selectedTotalPoints, setSelectedTotalPoints] = useState(0);
  const [loadingDay, setLoadingDay] = useState(false);
  const displayedHeatmap = month === today.slice(0, 7) && projectFilter === "all" ? initialDays : heatmap;
  const totals = new Map(displayedHeatmap.map((day) => [day.date, day]));
  const [year, monthNumber] = month.split("-").map(Number);
  const dayCount = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const firstColumn = firstWeekday === 0 ? 7 : firstWeekday;
  const days = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(Date.UTC(year, monthNumber - 1, index + 1));
    const key = date.toISOString().slice(0, 10);
    const total = totals.get(key);
    const score = total ? total.total_intensity : 0;
    const future = key > today;
    const level = future ? -1 : score === 0 ? 0 : score <= 2 ? 1 : score <= 5 ? 2 : score <= 9 ? 3 : score <= 14 ? 4 : 5;
    return { key, day: index + 1, score, count: total?.count || 0, level, future };
  });
  const visibleDays = days.filter((day) => !day.future);
  const activeDays = visibleDays.filter((day) => day.score > 0).length;
  const visibleIntensity = displayedHeatmap.reduce((sum, day) => sum + day.total_intensity, 0);
  const visiblePoints = displayedHeatmap.reduce((sum, day) => sum + day.total_points, 0);

  async function loadHeatmap(nextMonth: string, nextProject: string) {
    const result = await requestJson(`/api/analytics?month=${encodeURIComponent(nextMonth)}&project_id=${encodeURIComponent(nextProject)}`, { method: "GET" });
    setHeatmap(result.heatmap || []);
  }

  async function changeProject(value: string) {
    setProjectFilter(value);
    setSelectedDate(null);
    try {
      if (value === "all" && month === today.slice(0, 7)) return;
      await loadHeatmap(month, value);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "热度数据加载失败。");
    }
  }

  async function changeMonth(offset: -1 | 1) {
    const value = new Date(Date.UTC(year, monthNumber - 1 + offset, 1)).toISOString().slice(0, 7);
    setMonth(value);
    setSelectedDate(null);
    try {
      if (value === today.slice(0, 7) && projectFilter === "all") return;
      await loadHeatmap(value, projectFilter);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "热度数据加载失败。");
    }
  }

  async function openDay(date: string) {
    setSelectedDate(date);
    setSelectedRecords([]);
    setSelectedTotal(0);
    setSelectedAverage(0);
    setSelectedTotalIntensity(0);
    setSelectedTotalPoints(0);
    setLoadingDay(true);
    try {
      const project = projectFilter === "all" ? "" : `&project_id=${encodeURIComponent(projectFilter)}`;
      const result = await requestJson(`/api/records?date=${date}&limit=100${project}`, { method: "GET" });
      setSelectedRecords(result.records || []);
      setSelectedTotal(result.total || 0);
      setSelectedAverage(result.average_intensity || 0);
      setSelectedTotalIntensity(result.total_intensity || 0);
      setSelectedTotalPoints(result.total_points || 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "当天记录加载失败。");
    } finally {
      setLoadingDay(false);
    }
  }

  return (
    <section className="heatmap-card" aria-labelledby="heatmap-title">
      <div className="heatmap-heading">
        <div>
          <p className="section-kicker">CONSISTENCY</p>
          <h2 id="heatmap-title">学习热度</h2>
        </div>
        <div className="heatmap-summary">
          <div className="heatmap-month-switcher">
            <button type="button" onClick={() => changeMonth(-1)} aria-label="查看上个月"><ChevronLeft /></button>
            <strong>{year}年{monthNumber}月</strong>
            <button type="button" onClick={() => changeMonth(1)} disabled={month >= today.slice(0, 7)} aria-label="查看下个月"><ChevronRight /></button>
          </div>
          <Select
            value={projectFilter}
            onValueChange={changeProject}
          >
            <SelectTrigger className="heatmap-project-filter" aria-label="按项目筛选热度"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部项目</SelectItem>
              <SelectItem value="none">未分类</SelectItem>
              {projects.map((project) => <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <p><strong>{activeDays}</strong> 个活跃日 · 强度 {visibleIntensity} · 积分 {visiblePoints}</p>
        </div>
      </div>
      <div className="heatmap-scroll">
        <div className="heatmap-body">
          <div className="heatmap-grid" role="grid" aria-label={`${year}年${monthNumber}月学习热度`}>
            {days.map((day, index) => (
              <button
                key={day.key}
                type="button"
                disabled={day.future}
                className={`heat-cell level-${day.level} ${selectedDate === day.key ? "selected" : ""}`}
                style={index === 0 ? { gridColumnStart: firstColumn } : undefined}
                onClick={() => openDay(day.key)}
                title={day.future ? `${day.key}（未来日期）` : `${day.key}：${day.count ? `${day.count} 条记录，累计强度 ${day.score}，积分 ${totals.get(day.key)?.total_points || 0}` : "无记录"}`}
                aria-label={day.future ? `${day.key}，未来日期` : `${day.key}，${day.count ? `${day.count} 条记录，累计强度 ${day.score}，积分 ${totals.get(day.key)?.total_points || 0}` : "无学习记录"}`}
              ><span>{day.day}</span></button>
            ))}
          </div>
        </div>
      </div>
      <div className="heatmap-legend" aria-hidden="true"><span>低</span><i className="level-0" /><i className="level-1" /><i className="level-2" /><i className="level-3" /><i className="level-4" /><i className="level-5" /><span>高</span></div>
      <Dialog open={Boolean(selectedDate)} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent className="heatmap-dialog sm:max-w-[520px]">
          <DialogHeader>
            <p className="section-kicker">DAY REVIEW</p>
            <DialogTitle>{selectedDate ? formatStudyDate(selectedDate) : "当天记录"}</DialogTitle>
            <DialogDescription>
              {loadingDay
                ? "正在读取当天记录…"
                : selectedRecords.length
                ? `${selectedTotal} 条学习记录 · 累计强度 ${selectedTotalIntensity} · 积分 ${selectedTotalPoints} · 平均强度 ${selectedAverage.toFixed(1)}${selectedTotal > selectedRecords.length ? ` · 显示前 ${selectedRecords.length} 条` : ""}`
                : "这一天还没有学习记录。"}
            </DialogDescription>
          </DialogHeader>
          {loadingDay ? <div className="heatmap-day-empty"><p>加载中…</p></div> : selectedRecords.length ? (
            <div className="heatmap-day-list">
              {selectedRecords.map((record) => {
                const project = projects.find((item) => item.id === record.project_id);
                return (
                  <article key={record.id}>
                    <div>
                      <h3>{record.subject}</h3>
                      {project ? <span className={`project-pill project-${project.color}`}>{project.name}</span> : <span className="day-unclassified">未分类</span>}
                      {record.note ? <p>{record.note}</p> : null}
                    </div>
                    <strong><Gauge />{record.intensity_score}<small>/5 · {record.intensity_score * Number(project?.importance || 0)} 积分</small></strong>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="heatmap-day-empty"><NotebookPen /><p>从“添加学习记录”开始积累这一天。</p></div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function projectInput(project: StudyProject | null): StudyProjectInput {
  return {
    name: project?.name || "",
    description: project?.description || "",
    goal: project?.goal || "",
    status: project?.status || "active",
    start_date: project?.start_date || null,
    target_date: project?.target_date || null,
    color: project?.color || "blue",
    importance: project?.importance || 3,
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
      <DialogContent className="record-dialog project-dialog sm:max-w-[600px]">
        <DialogHeader>
          <p className="section-kicker">PROJECT</p>
          <DialogTitle>{project ? "编辑项目" : "建立学习项目"}</DialogTitle>
          <DialogDescription>把同一目标下的学习记录整理在一起。</DialogDescription>
        </DialogHeader>
        <form className="record-form project-editor-form" onSubmit={submit}>
          <div className="project-form-scroll">
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
                placeholder="补充课程、作品或学习范围"
                onChange={(event) => setValues({ ...values, description: event.target.value })}
              />
            </div>
            <div className="form-row">
              <div className="label-line"><Label htmlFor={`project-goal-${project?.id || "new"}`}>项目目标</Label><span>选填</span></div>
              <Textarea
                id={`project-goal-${project?.id || "new"}`}
                rows={3}
                maxLength={500}
                value={values.goal}
                placeholder="例如：完成一个可发布的学习记录网站"
                onChange={(event) => setValues({ ...values, goal: event.target.value })}
              />
            </div>
            <div className="form-row">
              <div className="label-line"><Label>项目重要度</Label><span>{values.importance} / 5</span></div>
              <div className="importance-choices" aria-label="项目重要度">
                {intensityChoices.map((score) => (
                  <button
                    key={score}
                    type="button"
                    className={values.importance === score ? "active" : ""}
                    onClick={() => setValues({ ...values, importance: score })}
                    aria-label={`重要度 ${score}`}
                    aria-pressed={values.importance === score}
                  >
                    <Star /><strong>{score}</strong>
                  </button>
                ))}
              </div>
              <p className="form-hint">记录积分 = 项目重要度 × 学习强度；完成项目可获得同等学分。</p>
            </div>
            <div className="project-form-grid">
              <div className="form-row">
                <Label>项目状态</Label>
                <Select value={values.status} onValueChange={(status) => setValues({ ...values, status: status as ProjectStatus })}>
                  <SelectTrigger className="project-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {projectStatuses.map((status) => <SelectItem key={status} value={status}>{statusLabels[status]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="form-row">
                <div className="label-line"><Label htmlFor={`project-start-${project?.id || "new"}`}>开始日期</Label><span>选填</span></div>
                <Input
                  id={`project-start-${project?.id || "new"}`}
                  type="date"
                  value={values.start_date || ""}
                  onChange={(event) => setValues({ ...values, start_date: event.target.value || null })}
                />
              </div>
              <div className="form-row">
                <div className="label-line"><Label htmlFor={`project-target-${project?.id || "new"}`}>计划完成</Label><span>选填</span></div>
                <Input
                  id={`project-target-${project?.id || "new"}`}
                  type="date"
                  value={values.target_date || ""}
                  min={values.start_date || undefined}
                  onChange={(event) => setValues({ ...values, target_date: event.target.value || null })}
                />
              </div>
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
          </div>
          <DialogFooter className="project-dialog-footer">
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
      toast.success("已移入回收站，项目及记录可在 7 天内恢复");
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
          <AlertDialogDescription>项目和关联的学习记录会一起移入回收站，可在 7 天内一起恢复。</AlertDialogDescription>
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
  onSaved,
  onDeleted,
  onView,
  onReorder,
}: {
  projects: StudyProject[];
  onSaved: (project: StudyProject) => void;
  onDeleted: (id: number) => void;
  onView: (id: number) => void;
  onReorder: (projects: StudyProject[]) => void;
}) {
  const [sortMode, setSortMode] = useState("manual");
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

  const sortedProjects = [...projects].sort((a, b) => {
    if (sortMode === "importance") return b.importance - a.importance || b.updated_at.localeCompare(a.updated_at);
    if (sortMode === "time") return b.updated_at.localeCompare(a.updated_at) || b.id - a.id;
    return a.sort_order - b.sort_order || a.id - b.id;
  });
  const groups = [
    { key: "unfinished", title: "未完成", projects: sortedProjects.filter((project) => project.status !== "completed") },
    { key: "completed", title: "已完成", projects: sortedProjects.filter((project) => project.status === "completed") },
  ];

  function moveProject(project: StudyProject, direction: -1 | 1) {
    const groupProjects = sortedProjects.filter((item) => (item.status === "completed") === (project.status === "completed"));
    const currentIndex = groupProjects.findIndex((item) => item.id === project.id);
    const target = groupProjects[currentIndex + direction];
    if (!target) return;
    const reordered = [...sortedProjects];
    const sourceIndex = reordered.findIndex((item) => item.id === project.id);
    const targetIndex = reordered.findIndex((item) => item.id === target.id);
    [reordered[sourceIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[sourceIndex]];
    onReorder(reordered.map((item, index) => ({ ...item, sort_order: index })));
  }

  function renderProject(project: StudyProject, index: number, groupLength: number) {
    const recordCount = Number(project.record_count || 0);
    const totalIntensity = Number(project.total_intensity || 0);
    const totalPoints = Number(project.total_points || 0);
    return (
      <article className={`project-card project-${project.color}`} key={project.id}>
        <div className="project-card-top">
          <div className="project-card-identity">
            <span className="project-icon"><FolderKanban /></span>
            <span className={`project-status status-${project.status}`}>{statusLabels[project.status]}</span>
            <span className="project-importance"><Star />重要度 {project.importance}</span>
          </div>
          <div className="record-actions">
            {sortMode === "manual" ? <>
              <button className="record-action" type="button" disabled={index === 0} onClick={() => moveProject(project, -1)} aria-label={`上移项目 ${project.name}`}><ArrowUp /></button>
              <button className="record-action" type="button" disabled={index === groupLength - 1} onClick={() => moveProject(project, 1)} aria-label={`下移项目 ${project.name}`}><ArrowDown /></button>
            </> : null}
            <ProjectEditor project={project} compact onSaved={onSaved} />
            <DeleteProject project={project} onDeleted={onDeleted} />
          </div>
        </div>
        <h2>{project.name}</h2>
        <p>{project.description || "还没有项目说明"}</p>
        {project.goal ? <div className="project-goal"><Target /><div><span>项目目标</span><p>{project.goal}</p></div></div> : null}
        {(project.start_date || project.target_date) ? (
          <div className="project-dates"><CalendarRange /><span>{project.start_date ? `开始 ${project.start_date}` : "未设开始日期"}</span><i /> <span>{project.target_date ? `计划 ${project.target_date}` : "未设完成日期"}</span></div>
        ) : null}
        <div className="project-stats">
          <span><strong>{recordCount}</strong> 条记录</span>
          <span><strong>{totalIntensity}</strong> 累计强度</span>
          <span><strong>{totalPoints}</strong> 积分</span>
        </div>
        {project.status === "completed" ? <div className="project-credit"><Star />已获得 {project.importance} 学分</div> : null}
        <button type="button" className="project-view" onClick={() => onView(project.id)}>查看项目记录 <ChevronRight /></button>
      </article>
    );
  }

  return (
    <div className="project-board">
      <div className="project-toolbar">
        <div><strong>按完成状态分类</strong><span>每类项目可独立查看和手动排序</span></div>
        <Select value={sortMode} onValueChange={setSortMode}>
          <SelectTrigger className="project-sort" aria-label="项目排序方式"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">自主排序</SelectItem>
            <SelectItem value="time">按时间排序</SelectItem>
            <SelectItem value="importance">按重要度排序</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {groups.map((group) => group.projects.length ? (
        <section className="project-group" key={group.key}>
          <div className="project-group-heading"><h2>{group.title}</h2><span>{group.projects.length} 个项目</span></div>
          <div className="project-grid">{group.projects.map((project, index) => renderProject(project, index, group.projects.length))}</div>
        </section>
      ) : null)}
    </div>
  );
}

export function StudyDashboard({ initialRecords, initialRecordTotal, initialAnalytics, initialProjects, today, user, loadError }: DashboardProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [pointDistribution, setPointDistribution] = useState<PointDistributionScope | null>(null);
  const [view, setView] = useState("dashboard");
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [historyRecords, setHistoryRecords] = useState(initialRecords);
  const [historyTotal, setHistoryTotal] = useState(initialRecordTotal);
  const [historyAverage, setHistoryAverage] = useState(initialAnalytics.overall_average);
  const [historyTotalIntensity, setHistoryTotalIntensity] = useState(initialAnalytics.total_intensity);
  const [historyTotalPoints, setHistoryTotalPoints] = useState(initialAnalytics.total_points);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRevision, setHistoryRevision] = useState(0);

  const refreshAnalytics = useCallback(async () => {
    try {
      const result = await requestJson("/api/analytics", { method: "GET" });
      if (result.analytics) setAnalytics(result.analytics);
    } catch {
      // Keep the last complete snapshot when a background refresh fails.
    }
  }, []);

  const refreshProjects = useCallback(async () => {
    try {
      const result = await requestJson("/api/projects", { method: "GET" });
      if (result.projects) setProjects(result.projects);
    } catch {
      // Project counts will refresh on the next successful request.
    }
  }, []);

  const restoreTrash = useCallback(() => {
    setHistoryRevision((current) => current + 1);
    void refreshAnalytics();
    void refreshProjects();
  }, [refreshAnalytics, refreshProjects]);

  const saveRecord: (record: StudyRecord) => void = useCallback(() => {
    setHistoryRevision((current) => current + 1);
    void refreshAnalytics();
    void refreshProjects();
  }, [refreshAnalytics, refreshProjects]);

  const deleteRecord: (id: number) => void = useCallback(() => {
    setHistoryRevision((current) => current + 1);
    void refreshAnalytics();
    void refreshProjects();
  }, [refreshAnalytics, refreshProjects]);

  const saveProject = useCallback((project: StudyProject) => {
    setProjects((current) => current.some((item) => item.id === project.id)
      ? current.map((item) => item.id === project.id ? project : item)
      : [...current, project]);
    setHistoryRevision((current) => current + 1);
    void refreshAnalytics();
  }, [refreshAnalytics]);

  const deleteProject = useCallback((id: number) => {
    setProjects((current) => current.filter((item) => item.id !== id));
    setProjectFilter((current) => current === String(id) ? "all" : current);
    setHistoryRevision((current) => current + 1);
    void refreshAnalytics();
  }, [refreshAnalytics]);

  const reorderProjectCards = useCallback(async (orderedProjects: StudyProject[]) => {
    const previous = projects;
    setProjects(orderedProjects);
    try {
      const result = await requestJson("/api/projects", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_ids: orderedProjects.map((project) => project.id) }),
      });
      if (result.projects) setProjects(result.projects);
    } catch (error) {
      setProjects(previous);
      toast.error(error instanceof Error ? error.message : "项目排序保存失败，请稍后再试。");
    }
  }, [projects]);

  const viewProject = useCallback((id: number) => {
    setProjectFilter(String(id));
    setView("history");
  }, []);

  useEffect(() => {
    if (view !== "history") return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setHistoryLoading(true);
      try {
        const params = new URLSearchParams({ limit: "50", offset: "0" });
        if (query.trim()) params.set("q", query.trim());
        if (projectFilter !== "all") params.set("project_id", projectFilter);
        const result = await requestJson(`/api/records?${params}`, { method: "GET", signal: controller.signal });
        setHistoryRecords(result.records || []);
        setHistoryTotal(result.total || 0);
        setHistoryAverage(result.average_intensity || 0);
        setHistoryTotalIntensity(result.total_intensity || 0);
        setHistoryTotalPoints(result.total_points || 0);
      } catch (error) {
        if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : "历史记录加载失败。");
      } finally {
        if (!controller.signal.aborted) setHistoryLoading(false);
      }
    }, query ? 250 : 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [historyRevision, projectFilter, query, view]);

  async function loadMoreHistory() {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50", offset: String(historyRecords.length) });
      if (query.trim()) params.set("q", query.trim());
      if (projectFilter !== "all") params.set("project_id", projectFilter);
      const result = await requestJson(`/api/records?${params}`, { method: "GET" });
      setHistoryRecords((current) => [...current, ...(result.records || [])]);
      setHistoryTotal(result.total || 0);
      setHistoryAverage(result.average_intensity || 0);
      setHistoryTotalIntensity(result.total_intensity || 0);
      setHistoryTotalPoints(result.total_points || 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更多记录加载失败。");
    } finally {
      setHistoryLoading(false);
    }
  }

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
          goal: { type: "string", maxLength: 500 },
          status: { type: "string", enum: [...projectStatuses] },
          start_date: { type: ["string", "null"], description: "YYYY-MM-DD 格式的开始日期" },
          target_date: { type: ["string", "null"], description: "YYYY-MM-DD 格式的计划完成日期" },
          importance: { type: "integer", minimum: 1, maximum: 5, description: "项目重要度，1 到 5" },
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
          body: JSON.stringify({
            name: value.name,
            description: value.description || "",
            goal: value.goal || "",
            status: value.status || "active",
            start_date: value.start_date || null,
            target_date: value.target_date || null,
            color: value.color || "blue",
            importance: value.importance || 3,
          }),
        });
        if (!result.project) throw new Error("项目没有保存成功。");
        saveProject(result.project);
        return { id: result.project.id, status: "saved", name: result.project.name };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [saveProject, saveRecord]);

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
          <TabsTrigger value="trash"><Trash2 />回收站</TabsTrigger>
        </TabsList>
        <div className="sidebar-note">
          <span>本周积分</span>
          <strong>{analytics.week_points || "尚无记录"}</strong>
          <Progress value={analytics.week_average * 20} />
          <small>累计强度 {analytics.week_intensity} · {analytics.week_count} 次记录</small>
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
              <div className="focus-copy"><span>今日累计强度</span><strong>{analytics.today_intensity || "—"}</strong></div>
              <div className="focus-ring" style={{ "--progress": `${analytics.today_average * 72}deg` } as React.CSSProperties}>
                <span>{analytics.today_count ? `${analytics.today_points} 积分` : "待记录"}</span>
              </div>
              <div className="focus-progress"><Progress value={analytics.today_average * 20} /><p>{analytics.today_count ? `今日平均强度 ${analytics.today_average.toFixed(1)} / 5` : "每条记录的强度会在当天累加"}</p></div>
            </article>
            <article className="stat-card streak-card"><span><Flame />连续学习</span><strong>{analytics.current_streak}</strong><small>天</small><p>最长连续 {analytics.longest_streak} 天</p></article>
            <button type="button" className="stat-card stat-card-button" onClick={() => setPointDistribution("week")}><span>本周积分</span><strong>{analytics.week_points}</strong><p>累计强度 {analytics.week_intensity} · {analytics.week_count} 次记录</p><small>点击查看项目分布</small></button>
            <button type="button" className="stat-card stat-card-button" onClick={() => setPointDistribution("total")}><span>累计积分</span><strong>{analytics.total_points}</strong><p>累计强度 {analytics.total_intensity} · {analytics.total_records} 条记录</p><small>点击查看项目分布</small></button>
            <article className="stat-card credit-card"><span><Star />项目学分</span><strong>{analytics.total_credits}</strong><small>学分</small><p>{analytics.completed_projects} 个已完成项目</p></article>
          </section>
          <StudyTrend analytics={analytics} projects={projects} />
          <StudyHeatmap initialDays={analytics.heatmap} projects={projects} today={today} />
          <PointDistributionDialog analytics={analytics} scope={pointDistribution} onClose={() => setPointDistribution(null)} />
        </TabsContent>

        <TabsContent value="history" className="view-content">
          <header className="topbar history-header">
            <div><p className="section-kicker">全部积累</p><h1>历史记录</h1><p className="page-description">共 {historyTotal} 条学习记录 · 累计强度 {historyTotalIntensity} · 积分 {historyTotalPoints} · 平均强度 {historyTotal ? historyAverage.toFixed(1) : "—"}</p></div>
            <div className="header-actions">
              <a className="export-button" href="/api/export?format=csv" download><Download />导出 CSV</a>
              <a className="export-button" href="/api/export?format=json" download><Download />导出 JSON</a>
              <RecordEditor today={today} projects={projects} onSaved={saveRecord} />
            </div>
          </header>
          <div className="history-filters">
            <div className="search-box"><Search /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索内容、项目或备注" aria-label="搜索学习记录" />{query ? <span>{historyTotal} 条结果</span> : null}</div>
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
            {historyLoading && !historyRecords.length ? <div className="history-loading">正在读取历史记录…</div> : <RecordList records={historyRecords} projects={projects} today={today} onSaved={saveRecord} onDeleted={deleteRecord} />}
            {historyTotal ? <div className="history-pagination"><span>已显示 {historyRecords.length} / {historyTotal} 条</span>{historyRecords.length < historyTotal ? <Button variant="outline" onClick={loadMoreHistory} disabled={historyLoading}>{historyLoading ? "加载中…" : "加载更多"}</Button> : null}</div> : null}
          </section>
        </TabsContent>

        <TabsContent value="projects" className="view-content">
          <header className="topbar history-header">
            <div><p className="section-kicker">PROJECTS</p><h1>学习项目</h1></div>
            <ProjectEditor onSaved={saveProject} />
          </header>
          <ProjectBoard projects={projects} onSaved={saveProject} onDeleted={deleteProject} onView={viewProject} onReorder={reorderProjectCards} />
        </TabsContent>

        <TabsContent value="trash" className="view-content">
          <header className="topbar history-header">
            <div><p className="section-kicker">RECOVERY</p><h1>回收站</h1><p className="page-description">项目和学习记录可在删除后 7 天内恢复。</p></div>
          </header>
          <TrashView active={view === "trash"} revision={historyRevision} onRestored={restoreTrash} />
        </TabsContent>
      </main>

      <TabsList className="mobile-nav">
        <TabsTrigger value="dashboard"><LayoutDashboard />今日</TabsTrigger>
        <TabsTrigger value="history"><History />历史</TabsTrigger>
        <TabsTrigger value="projects"><FolderKanban />项目</TabsTrigger>
        <TabsTrigger value="trash"><Trash2 />回收站</TabsTrigger>
      </TabsList>
      <Toaster position="top-center" richColors />
    </Tabs>
  );
}
