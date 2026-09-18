"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Clock3,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { formatDuration, formatStudyDate, weekStartString } from "@/lib/date";
import type { StudyRecord, StudyRecordInput } from "@/lib/study-records";

type DashboardProps = {
  initialRecords: StudyRecord[];
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

const durationChoices = [25, 45, 60, 90];

function recordInput(record: StudyRecord | null, today: string): StudyRecordInput {
  return {
    study_date: record?.study_date || today,
    subject: record?.subject || "",
    duration_minutes: record?.duration_minutes || 60,
    note: record?.note || "",
  };
}

async function requestJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const payload = (await response.json()) as { error?: string; record?: StudyRecord };
  if (!response.ok) throw new Error(payload.error || "操作失败，请稍后再试。");
  return payload;
}

function RecordEditor({
  today,
  record = null,
  onSaved,
  compact = false,
}: {
  today: string;
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
          <DialogDescription>写下内容和时长，保持简单就好。</DialogDescription>
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
            <div className="label-line"><Label htmlFor={`duration-${record?.id || "new"}`}>学习时长</Label><span>分钟</span></div>
            <Input
              id={`duration-${record?.id || "new"}`}
              type="number"
              min={1}
              max={1440}
              value={values.duration_minutes}
              onChange={(event) => setValues({ ...values, duration_minutes: Number(event.target.value) })}
              required
            />
            <div className="duration-choices" aria-label="常用时长">
              {durationChoices.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className={values.duration_minutes === minutes ? "active" : ""}
                  onClick={() => setValues({ ...values, duration_minutes: minutes })}
                >
                  {minutes} 分
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
  today,
  onSaved,
  onDeleted,
}: {
  records: StudyRecord[];
  today: string;
  onSaved: (record: StudyRecord) => void;
  onDeleted: (id: number) => void;
}) {
  if (!records.length) {
    return (
      <div className="empty-state">
        <span><NotebookPen /></span>
        <h3>从第一条学习记录开始</h3>
        <p>完成一次学习后，把内容和时长记下来。</p>
        <RecordEditor today={today} onSaved={onSaved} />
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
            <span>{formatDuration(items.reduce((sum, item) => sum + item.duration_minutes, 0))}</span>
          </div>
          <div className="record-stack">
            {items.map((record) => (
              <article className="record-card" key={record.id}>
                <div className={`subject-mark mark-${record.id % 4}`}>{record.subject.slice(0, 1).toUpperCase()}</div>
                <div className="record-copy">
                  <h4>{record.subject}</h4>
                  <p className={record.note ? "" : "muted"}>{record.note || "没有填写备注"}</p>
                </div>
                <div className="record-duration"><Clock3 /><strong>{record.duration_minutes}</strong><span>分钟</span></div>
                <div className="record-actions">
                  <RecordEditor today={today} record={record} compact onSaved={onSaved} />
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

export function StudyDashboard({ initialRecords, today, user, loadError }: DashboardProps) {
  const [records, setRecords] = useState(initialRecords);
  const [view, setView] = useState("dashboard");
  const [query, setQuery] = useState("");
  const weekStart = weekStartString(today);

  const saveRecord = useCallback((record: StudyRecord) => {
    setRecords((current) => [record, ...current.filter((item) => item.id !== record.id)]
      .sort((a, b) => b.study_date.localeCompare(a.study_date) || b.created_at.localeCompare(a.created_at)));
  }, []);

  const deleteRecord = useCallback((id: number) => {
    setRecords((current) => current.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "create_study_record",
      title: "添加学习记录",
      description: "添加一条学习内容、日期、时长和备注，并更新当前学习仪表盘。",
      inputSchema: {
        type: "object",
        properties: {
          study_date: { type: "string", description: "YYYY-MM-DD 格式的日期" },
          subject: { type: "string", minLength: 1, maxLength: 80 },
          duration_minutes: { type: "integer", minimum: 1, maximum: 1440 },
          note: { type: "string", maxLength: 2000 },
        },
        required: ["study_date", "subject", "duration_minutes"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input) => {
        const value = input as StudyRecordInput;
        const result = await requestJson("/api/records", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...value, note: value.note || "" }),
        });
        if (!result.record) throw new Error("记录没有保存成功。");
        saveRecord(result.record);
        return { id: result.record.id, status: "saved", subject: result.record.subject };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [saveRecord]);

  const todayRecords = useMemo(() => records.filter((record) => record.study_date === today), [records, today]);
  const weekRecords = useMemo(
    () => records.filter((record) => record.study_date >= weekStart && record.study_date <= today),
    [records, today, weekStart],
  );
  const todayMinutes = todayRecords.reduce((sum, record) => sum + record.duration_minutes, 0);
  const weekMinutes = weekRecords.reduce((sum, record) => sum + record.duration_minutes, 0);
  const filteredRecords = records.filter((record) => {
    const needle = query.trim().toLowerCase();
    return !needle || `${record.subject} ${record.note}`.toLowerCase().includes(needle);
  });
  const firstName = user.displayName.includes("@") ? "同学" : user.displayName.split(/\s+/)[0];

  return (
    <Tabs value={view} onValueChange={setView} className="app-frame">
      <aside className="sidebar">
        <div className="brand-lockup">
          <span className="brand-mark"><BookOpen /></span>
          <span><strong>研习簿</strong><small>STUDY LOG</small></span>
        </div>
        <TabsList className="side-nav" orientation="vertical">
          <TabsTrigger value="dashboard"><LayoutDashboard />今日概览</TabsTrigger>
          <TabsTrigger value="history"><History />历史记录</TabsTrigger>
        </TabsList>
        <div className="sidebar-note">
          <span>本周节奏</span>
          <strong>{formatDuration(weekMinutes)}</strong>
          <Progress value={Math.min(100, (weekMinutes / 600) * 100)} />
          <small>每一次专注都算数</small>
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
            <RecordEditor today={today} onSaved={saveRecord} />
          </header>
          {loadError ? <p className="data-error">{loadError}</p> : null}
          <section className="stats-grid" aria-label="学习统计">
            <article className="focus-card">
              <div className="focus-copy"><span>今日专注</span><strong>{todayMinutes}<small>分钟</small></strong></div>
              <div className="focus-ring" style={{ "--progress": `${Math.min(100, (todayMinutes / 120) * 100) * 3.6}deg` } as React.CSSProperties}>
                <span>{Math.min(100, Math.round((todayMinutes / 120) * 100))}%</span>
              </div>
              <div className="focus-progress"><Progress value={Math.min(100, (todayMinutes / 120) * 100)} /><p>{todayMinutes >= 120 ? "今日目标已完成" : `距 2 小时目标还差 ${120 - todayMinutes} 分钟`}</p></div>
            </article>
            <article className="stat-card"><span>本周累计</span><strong>{(weekMinutes / 60).toFixed(1)}</strong><small>小时</small><p>从周一到今天</p></article>
            <article className="stat-card"><span>本周记录</span><strong>{weekRecords.length}</strong><small>次</small><p>{weekRecords.length ? "正在稳步积累" : "等待第一条记录"}</p></article>
          </section>
          <section className="records-section">
            <div className="section-heading">
              <div><p className="section-kicker">RECENT</p><h2>最近记录</h2></div>
              <button type="button" onClick={() => setView("history")}>查看全部 <ChevronRight /></button>
            </div>
            <RecordList records={records.slice(0, 6)} today={today} onSaved={saveRecord} onDeleted={deleteRecord} />
          </section>
        </TabsContent>

        <TabsContent value="history" className="view-content">
          <header className="topbar history-header">
            <div><p className="section-kicker">全部积累</p><h1>历史记录</h1><p className="page-description">共 {records.length} 条，累计学习 {formatDuration(records.reduce((sum, item) => sum + item.duration_minutes, 0))}</p></div>
            <RecordEditor today={today} onSaved={saveRecord} />
          </header>
          <div className="search-box"><Search /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索学习内容或备注" aria-label="搜索学习记录" />{query ? <span>{filteredRecords.length} 条结果</span> : null}</div>
          <section className="records-section history-records">
            <RecordList records={filteredRecords} today={today} onSaved={saveRecord} onDeleted={deleteRecord} />
          </section>
        </TabsContent>
      </main>

      <TabsList className="mobile-nav">
        <TabsTrigger value="dashboard"><LayoutDashboard />今日</TabsTrigger>
        <TabsTrigger value="history"><History />历史</TabsTrigger>
      </TabsList>
      <Toaster position="top-center" richColors />
    </Tabs>
  );
}
