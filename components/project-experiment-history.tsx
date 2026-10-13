"use client";

import { useEffect, useId, useState } from "react";
import { Circle, FlaskConical, Gauge } from "lucide-react";
import type { ProjectExperiment } from "@/lib/project-model";

type ExperimentList = {
  experiments: Array<ProjectExperiment & { project_name: string }>;
  experiment_count: number;
  experiment_todo_count: number;
};

export function ProjectExperimentHistory({ title = "待做实验列表" }: { title?: string }) {
  const headingId = useId();
  const [items, setItems] = useState<ExperimentList["experiments"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch("/api/project-experiments", { signal: controller.signal })
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

  function renderItems(rows: ExperimentList["experiments"]) {
    return rows.map((item) => (
      <article className="project-experiment-history-item" key={item.id}>
        <Circle aria-label="待做" />
        <div><strong>{item.name}</strong><span><Gauge />强度 {item.intensity_score} · {item.project_name}</span></div>
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
