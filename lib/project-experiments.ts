import { env } from "cloudflare:workers";
import { projectExperimentStatuses, type ProjectExperiment, type ProjectExperimentStatus } from "@/lib/project-model";

function database() {
  if (!env.DB) throw new Error("项目实验暂时不可用。");
  return env.DB;
}

// A unique experiment link makes retries and repeated completion idempotent.
function completedRecord(db: D1Database, userId: string, projectId: number, experimentId?: number) {
  const condition = experimentId === undefined
    ? "e.id = (SELECT MAX(id) FROM project_experiments WHERE user_id = ? AND project_id = ?)"
    : "e.id = ?";
  const identity = experimentId === undefined ? [userId, projectId] : [experimentId];
  return db.prepare(
    `INSERT INTO study_records (user_id, study_date, subject, record_type, project_id, intensity_score, note, experiment_id)
     SELECT e.user_id, date(COALESCE(e.completed_at, e.created_at), '+8 hours'), e.name, 'experiment',
            e.project_id, e.intensity_score, e.description, e.id
     FROM project_experiments e
     JOIN projects p ON p.id = e.project_id AND p.user_id = e.user_id AND p.deleted_at IS NULL
     WHERE e.user_id = ? AND e.project_id = ? AND ${condition} AND e.deleted_at IS NULL AND e.status = 'done'
     ON CONFLICT(user_id, experiment_id) DO UPDATE SET
       study_date = excluded.study_date, subject = excluded.subject, record_type = 'experiment',
       project_id = excluded.project_id, intensity_score = excluded.intensity_score,
       note = excluded.note, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP`,
  ).bind(userId, projectId, ...identity);
}

export function validateProjectExperiment(name: string, intensityScore: number, status?: string, description = "") {
  if (!name.trim() || name.trim().length > 80) return "实验名称需填写且不超过 80 个字。";
  if (description.trim().length > 2000) return "实验简介不超过 2000 个字。";
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
    `SELECT id, user_id, project_id, name, description, intensity_score, status, sort_order, completed_at, created_at, updated_at
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

export async function listAllProjectExperiments(userId: string, status: ProjectExperimentStatus = "todo") {
  const result = await database().prepare(
    `SELECT e.id, e.user_id, e.project_id, e.name, e.description, e.intensity_score, e.status, e.sort_order,
            e.completed_at, e.created_at, e.updated_at, p.name AS project_name
     FROM project_experiments e
     JOIN projects p ON p.id = e.project_id AND p.user_id = e.user_id AND p.deleted_at IS NULL
     WHERE e.user_id = ? AND e.deleted_at IS NULL AND e.status = ?
     ORDER BY p.sort_order, p.created_at, p.id, e.sort_order, e.id`,
  ).bind(userId, status).all<ProjectExperiment & { project_name: string }>();
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
    experiment_todo_count: status === "todo" ? experiments.length : 0,
  };
}

export async function insertProjectExperiment(
  userId: string,
  projectId: number,
  name: string,
  intensityScore: number,
  description = "",
  status: ProjectExperimentStatus = "todo",
) {
  const db = database();
  const project = await db.prepare(
    "SELECT id FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
  ).bind(projectId, userId).first<{ id: number }>();
  if (!project) return false;

  const order = await db.prepare(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM project_experiments WHERE project_id = ? AND user_id = ? AND deleted_at IS NULL",
  ).bind(projectId, userId).first<{ next_order: number }>();
  const results = await db.batch([db.prepare(
    `INSERT INTO project_experiments (user_id, project_id, name, description, intensity_score, status, sort_order, completed_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'done' THEN CURRENT_TIMESTAMP ELSE NULL END
     WHERE EXISTS (SELECT 1 FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL)`,
  ).bind(userId, projectId, name.trim(), description.trim(), intensityScore, status, Number(order?.next_order || 0), status, projectId, userId),
  completedRecord(db, userId, projectId),
  ]);
  return results[0].meta.changes > 0;
}

export async function editProjectExperiment(
  userId: string,
  projectId: number,
  experimentId: number,
  name: string,
  intensityScore: number,
  status: ProjectExperimentStatus,
  description = "",
) {
  const db = database();
  const results = await db.batch([db.prepare(
    `UPDATE project_experiments
     SET name = ?, description = ?, intensity_score = ?, status = ?,
         completed_at = CASE WHEN ? = 'done' THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE NULL END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND project_id = ? AND user_id = ? AND deleted_at IS NULL
       AND EXISTS (SELECT 1 FROM projects p WHERE p.id = project_experiments.project_id AND p.user_id = ? AND p.deleted_at IS NULL)`,
  ).bind(name.trim(), description.trim(), intensityScore, status, status, experimentId, projectId, userId, userId),
  completedRecord(db, userId, projectId, experimentId),
  db.prepare(`UPDATE study_records SET deleted_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND experiment_id = ? AND deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM project_experiments e JOIN projects p ON p.id = e.project_id AND p.user_id = e.user_id
        WHERE e.id = ? AND e.project_id = ? AND e.user_id = ? AND e.status = 'todo' AND e.deleted_at IS NULL AND p.deleted_at IS NULL)`)
    .bind(new Date().toISOString(), userId, experimentId, experimentId, projectId, userId),
  ]);
  return results[0].meta.changes > 0;
}

export async function removeProjectExperiment(userId: string, projectId: number, experimentId: number, deletedAt: string) {
  const db = database();
  const results = await db.batch([db.prepare(
    `UPDATE project_experiments
     SET deleted_at = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND project_id = ? AND user_id = ? AND deleted_at IS NULL
       AND EXISTS (SELECT 1 FROM projects p WHERE p.id = project_experiments.project_id AND p.user_id = ? AND p.deleted_at IS NULL)`,
  ).bind(deletedAt, experimentId, projectId, userId, userId),
  db.prepare(`UPDATE study_records SET deleted_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND experiment_id = ? AND deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM project_experiments e WHERE e.id = ? AND e.project_id = ? AND e.user_id = ? AND e.deleted_at = ?)`)
    .bind(deletedAt, userId, experimentId, experimentId, projectId, userId, deletedAt),
  ]);
  return results[0].meta.changes > 0;
}
