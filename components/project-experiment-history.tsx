"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, FlaskConical, Gauge } from "lucide-react";
import { ProjectExperiments } from "@/components/project-experiments";
import type { ProjectExperiment, StudyProject } from "@/lib/project-model";

type ExperimentList = {
  experiments: ProjectExperiment[];
  experiment_count: number;
  experiment_todo_count: number;
};

export function ProjectExperimentHistory({
  project,
  onCountsChange,
}: {
  project: StudyProject;
  onCountsChange: (projectId: number, total: number, todo: number) => void;
}) {
  const [items, setItems] = useState<ProjectExperiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void fetch(`/api/project-experiments?project_id=${project.id}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as ExperimentList & { error?: string };
        if (!response.ok) throw new Error(result.error || "实验列表加载失败。");
        setItems(result.experiments || []);
        onCountsChange(project.id, result.experiment_count, result.experiment_todo_count);
      })
      .catch(() => {
        if (!controller.signal.aborted) setItems([]);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [onCountsChange, project.id, revision]);

  function refreshCounts(projectId: number, total: number, todo: number) {
    onCountsChange(projectId, total, todo);
    setRevision((current) => current + 1);
  }

  return (
    <section className="project-experiment-history" aria-labelledby={`project-experiment-history-${project.id}`}>
      <div className="project-experiment-history-heading">
        <div><p className="section-kicker"><FlaskConical />EXPERIMENTS</p><h2 id={`project-experiment-history-${project.id}`}>实验记录</h2></div>
        <ProjectExperiments project={project} compact onCountsChange={refreshCounts} />
      </div>
      {loading ? <div className="project-experiment-history-empty">正在读取实验…</div> : items.length ? (
        <div className="project-experiment-history-list">
          {items.map((item) => (
            <article className={`project-experiment-history-item ${item.status}`} key={item.id}>
              {item.status === "done" ? <CheckCircle2 aria-label="已完成" /> : <Circle aria-label="待做" />}
              <div><strong>{item.name}</strong><span><Gauge />强度 {item.intensity_score}{item.status === "done" ? ` · 完成日期 ${item.completed_at?.slice(0, 10) || "—"}` : " · 待做"}</span></div>
            </article>
          ))}
        </div>
      ) : <div className="project-experiment-history-empty"><FlaskConical /><p>还没有实验记录。</p></div>}
    </section>
  );
}
