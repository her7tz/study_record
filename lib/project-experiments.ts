import { env } from "cloudflare:workers";
import { projectExperimentStatuses, type ProjectExperiment, type ProjectExperimentStatus } from "@/lib/project-model";

function database() {
  if (!env.DB) throw new Error("项目实验暂时不可用。");
  return env.DB;
}

export function validateProjectExperiment(name: string, intensityScore: number, status?: string) {
  if (!name.trim() || name.trim().length > 80) return "实验名称需填写且不超过 80 个字。";
  if (!Number.isSafeInteger(intensityScore) || intensityScore < 1) return "实验强度需为正整数。";
  if (status !== undefined && !projectExperimentStatuses.includes(status as ProjectExperimentStatus)) return "请选择有效的实验状态。";
  return null;
}

export async function listProjectExperiments(userId: string, projectId: number) {
  const db = database();
  const project = await db.prepare(
    "SELECT id FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
  ).bind(projectId, userId).first<{ id: number }>();
  if (!project) return null;

  const result = await db.prepare(
    `SELECT id, user_id, project_id, name, intensity_score, status, sort_order, completed_at, created_at, updated_at
     FROM project_experiments
     WHERE project_id = ? AND user_id = ? AND deleted_at IS NULL
     ORDER BY CASE WHEN status = 'todo' THEN 0 ELSE 1 END, sort_order, id`,
  ).bind(projectId, userId).all<ProjectExperiment>();
  const experiments = result.results.map((experiment) => ({
    ...experiment,
    id: Number(experiment.id),
    project_id: Number(experiment.project_id),
    intensity_score: Number(experiment.intensity_score),
    sort_order: Number(experiment.sort_order),
  }));
  return {
    experiments,
    experiment_count: experiments.length,
    experiment_todo_count: experiments.filter((experiment) => experiment.status === "todo").length,
  };
}

export async function listTodoProjectExperiments(userId: string) {
  const result = await database().prepare(
    `SELECT e.id, e.user_id, e.project_id, e.name, e.intensity_score, e.status, e.sort_order,
            e.completed_at, e.created_at, e.updated_at, p.name AS project_name
     FROM project_experiments e
     JOIN projects p ON p.id = e.project_id AND p.user_id = e.user_id AND p.deleted_at IS NULL
     WHERE e.user_id = ? AND e.deleted_at IS NULL AND e.status = 'todo'
     ORDER BY p.sort_order, p.id, e.sort_order, e.id`,
  ).bind(userId).all<ProjectExperiment & { project_name: string }>();
  const experiments = result.results.map((experiment) => ({
    ...experiment,
    id: Number(experiment.id),
    project_id: Number(experiment.project_id),
    intensity_score: Number(experiment.intensity_score),
    sort_order: Number(experiment.sort_order),
  }));
  return { experiments, experiment_count: experiments.length, experiment_todo_count: experiments.length };
}

export async function insertProjectExperiment(userId: string, projectId: number, name: string, intensityScore: number) {
  const db = database();
  const project = await db.prepare(
    "SELECT id FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
  ).bind(projectId, userId).first<{ id: number }>();
  if (!project) return false;

  const order = await db.prepare(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM project_experiments WHERE project_id = ? AND user_id = ? AND deleted_at IS NULL",
  ).bind(projectId, userId).first<{ next_order: number }>();
  await db.prepare(
    `INSERT INTO project_experiments (user_id, project_id, name, intensity_score, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(userId, projectId, name.trim(), intensityScore, Number(order?.next_order || 0)).run();
  return true;
}

export async function editProjectExperiment(
  userId: string,
  projectId: number,
  experimentId: number,
  name: string,
  intensityScore: number,
  status: ProjectExperimentStatus,
) {
  const result = await database().prepare(
    `UPDATE project_experiments
     SET name = ?, intensity_score = ?, status = ?,
         completed_at = CASE WHEN ? = 'done' THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE NULL END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND project_id = ? AND user_id = ? AND deleted_at IS NULL
       AND EXISTS (SELECT 1 FROM projects p WHERE p.id = project_experiments.project_id AND p.user_id = ? AND p.deleted_at IS NULL)`,
  ).bind(name.trim(), intensityScore, status, status, experimentId, projectId, userId, userId).run();
  return result.meta.changes > 0;
}

export async function removeProjectExperiment(userId: string, projectId: number, experimentId: number, deletedAt: string) {
  const result = await database().prepare(
    `UPDATE project_experiments
     SET deleted_at = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND project_id = ? AND user_id = ? AND deleted_at IS NULL
       AND EXISTS (SELECT 1 FROM projects p WHERE p.id = project_experiments.project_id AND p.user_id = ? AND p.deleted_at IS NULL)`,
  ).bind(deletedAt, experimentId, projectId, userId, userId).run();
  return result.meta.changes > 0;
}
