"use client";

import { useEffect, useId, useState } from "react";
import { Circle, FlaskConical, Gauge } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProjectExperiment, ProjectExperimentStatus } from "@/lib/project-model";

type ExperimentList = {
  experiments: Array<ProjectExperiment & { project_name: string }>;
  experiment_count: number;
  experiment_todo_count: number;
};

export function ProjectExperimentHistory({ title = "实验目录", onChanged }: { title?: string; onChanged?: () => void }) {
  const headingId = useId();
  const [items, setItems] = useState<ExperimentList["experiments"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch("/api/project-experiments?status=todo", { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as ExperimentList & { error?: string };
        if (!response.ok) throw new Error(result.error || "实验列表加载失败。");
        setItems(result.experiments || []);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "实验列表加载失败。");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);

  async function updateStatus(item: ExperimentList["experiments"][number], nextStatus: ProjectExperimentStatus) {
    if (nextStatus === item.status) return;
    setBusyId(item.id);
    try {
      const response = await fetch("/api/project-experiments", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: item.project_id,
          id: item.id,
          name: item.name,
          description: item.description,
          intensity_score: item.intensity_score,
          status: nextStatus,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "实验状态更新失败。");
      setRetry((value) => value + 1);
      onChanged?.();
      toast.success(nextStatus === "done" ? "实验已完成" : "实验已改回待做");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "实验状态更新失败。");
    } finally {
      setBusyId(null);
    }
  }

  function renderItems(rows: ExperimentList["experiments"]) {
    return rows.map((item) => (
      <article className={`project-experiment-history-item ${item.status}`} key={item.id}>
        <Circle aria-label="待做" />
        <div className="experiment-item-copy">
          <strong>{item.name}</strong>
          {item.description ? <p className="experiment-description">{item.description}</p> : null}
          <span><Gauge />强度 {item.intensity_score} · {item.project_name}</span>
        </div>
        <Select value={item.status} onValueChange={(value) => void updateStatus(item, value as ProjectExperimentStatus)} disabled={busyId !== null || loading}>
          <SelectTrigger className="experiment-status-select" size="sm" aria-label={`${item.name} 的状态`}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todo">待做</SelectItem>
            <SelectItem value="done">已完成</SelectItem>
          </SelectContent>
        </Select>
      </article>
    ));
  }

  return (
    <section className="project-experiment-history" aria-labelledby={headingId}>
      <div className="project-experiment-history-heading">
        <div><h2 id={headingId}>{title} {!loading && !error ? <span>{items.length}</span> : null}</h2></div>
      </div>
      {loading ? <div className="project-experiment-history-empty" role="status">正在读取实验…</div> : error ? (
        <div className="project-experiment-history-empty"><p role="alert">{error}</p><button type="button" className="export-button" onClick={() => setRetry((value) => value + 1)}>重试</button></div>
      ) : items.length ? (
        <div className="project-experiment-history-list">{renderItems(items)}</div>
      ) : <div className="project-experiment-history-empty"><FlaskConical /><p>当前没有待做实验。</p></div>}
    </section>
  );
}
