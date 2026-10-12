"use client";

import { useEffect, useState } from "react";
import { Circle, FlaskConical, Gauge } from "lucide-react";
import type { ProjectExperiment } from "@/lib/project-model";

type ExperimentList = {
  experiments: Array<ProjectExperiment & { project_name: string }>;
  experiment_count: number;
  experiment_todo_count: number;
};

export function ProjectExperimentHistory() {
  const [items, setItems] = useState<ExperimentList["experiments"]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void fetch("/api/project-experiments", { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as ExperimentList & { error?: string };
        if (!response.ok) throw new Error(result.error || "实验列表加载失败。");
        setItems(result.experiments || []);
      })
      .catch(() => {
        if (!controller.signal.aborted) setItems([]);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  function renderItems(rows: ExperimentList["experiments"]) {
    return rows.map((item) => (
      <article className="project-experiment-history-item" key={item.id}>
        <Circle aria-label="待做" />
        <div><strong>{item.name}</strong><span><Gauge />强度 {item.intensity_score} · {item.project_name}</span></div>
      </article>
    ));
  }

  return (
    <section className="project-experiment-history" aria-labelledby="project-experiment-history-title">
      <div className="project-experiment-history-heading">
        <div><p className="section-kicker"><FlaskConical />EXPERIMENTS</p><h2 id="project-experiment-history-title">待做实验列表 <span>{items.length}</span></h2></div>
      </div>
      {loading ? <div className="project-experiment-history-empty">正在读取实验…</div> : items.length ? (
        <div className="project-experiment-history-list">{renderItems(items)}</div>
      ) : <div className="project-experiment-history-empty"><FlaskConical /><p>当前没有待做实验。</p></div>}
    </section>
  );
}
