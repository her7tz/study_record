import { env } from "cloudflare:workers";
import { projectColors, projectStatuses, type StudyProject, type StudyProjectInput } from "@/lib/project-model";

export { projectColors, projectStatuses, type ProjectColor, type ProjectStatus, type StudyProject, type StudyProjectInput } from "@/lib/project-model";

function database() {
  if (!env.DB) throw new Error("项目数据库暂时不可用。");
  return env.DB;
}

export function validateProject(input: StudyProjectInput) {
  if (!input.name || input.name.length > 40) return "项目名称需填写且不超过 40 个字。";
  if (input.description.length > 240) return "项目说明不能超过 240 个字。";
  if (input.goal.length > 500) return "项目目标不能超过 500 个字。";
  if (!projectStatuses.includes(input.status)) return "请选择有效的项目状态。";
  if (input.start_date && !/^\d{4}-\d{2}-\d{2}$/.test(input.start_date)) return "请选择有效的开始日期。";
  if (input.target_date && !/^\d{4}-\d{2}-\d{2}$/.test(input.target_date)) return "请选择有效的计划完成日期。";
  if (input.start_date && input.target_date && input.target_date < input.start_date) return "计划完成日期不能早于开始日期。";
  if (!projectColors.includes(input.color)) return "请选择有效的项目颜色。";
  if (!Number.isInteger(input.importance) || input.importance < 1 || input.importance > 5) return "项目重要度需为 1–5。";
  return null;
}

export async function listProjects(userId: string) {
  const result = await database()
    .prepare(
      `SELECT p.id, p.user_id, p.name, p.description, p.goal, p.status, p.start_date, p.target_date, p.color, p.importance, p.sort_order,
              COUNT(r.id) AS record_count, AVG(r.intensity_score) AS average_intensity,
              COALESCE(SUM(r.intensity_score), 0) AS total_intensity,
              COALESCE(SUM(r.intensity_score * p.importance), 0) AS total_points,
              p.created_at, p.updated_at
       FROM projects p
       LEFT JOIN study_records r ON r.project_id = p.id AND r.user_id = p.user_id AND r.deleted_at IS NULL
       WHERE p.user_id = ? AND p.deleted_at IS NULL
       GROUP BY p.id
       ORDER BY p.sort_order ASC, p.created_at ASC, p.id ASC`,
    )
    .bind(userId)
    .all<StudyProject>();
  return result.results;
}

export async function insertProject(userId: string, input: StudyProjectInput) {
  const db = database();
  const nextOrder = await db.prepare(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM projects WHERE user_id = ? AND deleted_at IS NULL",
  ).bind(userId).first<{ next_order: number }>();
  const project = await db
    .prepare(
      `INSERT INTO projects (user_id, name, description, goal, status, start_date, target_date, color, importance, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id, user_id, name, description, goal, status, start_date, target_date, color, importance, sort_order, created_at, updated_at`,
    )
    .bind(userId, input.name, input.description, input.goal, input.status, input.start_date, input.target_date, input.color, input.importance, Number(nextOrder?.next_order || 0))
    .first<Omit<StudyProject, "record_count" | "average_intensity" | "total_intensity" | "total_points">>();
  return project ? { ...project, record_count: 0, average_intensity: null, total_intensity: 0, total_points: 0 } : null;
}

export async function editProject(userId: string, id: number, input: StudyProjectInput) {
  const db = database();
  const updated = await db
    .prepare(
      `UPDATE projects
       SET name = ?, description = ?, goal = ?, status = ?, start_date = ?, target_date = ?, color = ?, importance = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL
       RETURNING id, user_id, name, description, goal, status, start_date, target_date, color, importance, sort_order, created_at, updated_at`,
    )
    .bind(input.name, input.description, input.goal, input.status, input.start_date, input.target_date, input.color, input.importance, id, userId)
    .first<{ id: number }>();
  if (!updated) return null;
  return db.prepare(
    `SELECT p.id, p.user_id, p.name, p.description, p.goal, p.status, p.start_date, p.target_date, p.color, p.importance, p.sort_order,
            COUNT(r.id) AS record_count, AVG(r.intensity_score) AS average_intensity,
            COALESCE(SUM(r.intensity_score), 0) AS total_intensity,
            COALESCE(SUM(r.intensity_score * p.importance), 0) AS total_points,
            p.created_at, p.updated_at
     FROM projects p
     LEFT JOIN study_records r ON r.project_id = p.id AND r.user_id = p.user_id AND r.deleted_at IS NULL
     WHERE p.id = ? AND p.user_id = ? AND p.deleted_at IS NULL
     GROUP BY p.id`,
  ).bind(id, userId).first<StudyProject>();
}

export async function reorderProjects(userId: string, projectIds: number[]) {
  const db = database();
  const owned = await db.prepare("SELECT id FROM projects WHERE user_id = ? AND deleted_at IS NULL ORDER BY id").bind(userId).all<{ id: number }>();
  const ownedIds = owned.results.map((project) => Number(project.id)).sort((a, b) => a - b);
  const requestedIds = [...projectIds].sort((a, b) => a - b);
  if (ownedIds.length !== requestedIds.length || ownedIds.some((id, index) => id !== requestedIds[index])) return false;
  await db.batch(projectIds.map((id, index) => db.prepare(
    "UPDATE projects SET sort_order = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
  ).bind(index, id, userId)));
  return true;
}

export async function removeProject(userId: string, id: number, deletedAt: string) {
  const db = database();
  const owned = await db
    .prepare("SELECT id FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL")
    .bind(id, userId)
    .first<{ id: number }>();
  if (!owned) return false;
  await db.batch([
    db.prepare("UPDATE study_records SET deleted_at = ? WHERE project_id = ? AND user_id = ? AND deleted_at IS NULL").bind(deletedAt, id, userId),
    db.prepare("UPDATE projects SET deleted_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL").bind(deletedAt, id, userId),
  ]);
  return true;
}
