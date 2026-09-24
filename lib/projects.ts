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
  return null;
}

export async function listProjects(userId: string) {
  const result = await database()
    .prepare(
      `SELECT p.id, p.user_id, p.name, p.description, p.goal, p.status, p.start_date, p.target_date, p.color,
              COUNT(r.id) AS record_count, AVG(r.intensity_score) AS average_intensity,
              p.created_at, p.updated_at
       FROM projects p
       LEFT JOIN study_records r ON r.project_id = p.id AND r.user_id = p.user_id
       WHERE p.user_id = ?
       GROUP BY p.id
       ORDER BY p.updated_at DESC, p.id DESC`,
    )
    .bind(userId)
    .all<StudyProject>();
  return result.results;
}

export async function insertProject(userId: string, input: StudyProjectInput) {
  const project = await database()
    .prepare(
      `INSERT INTO projects (user_id, name, description, goal, status, start_date, target_date, color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id, user_id, name, description, goal, status, start_date, target_date, color, created_at, updated_at`,
    )
    .bind(userId, input.name, input.description, input.goal, input.status, input.start_date, input.target_date, input.color)
    .first<Omit<StudyProject, "record_count" | "average_intensity">>();
  return project ? { ...project, record_count: 0, average_intensity: null } : null;
}

export async function editProject(userId: string, id: number, input: StudyProjectInput) {
  const db = database();
  const updated = await db
    .prepare(
      `UPDATE projects
       SET name = ?, description = ?, goal = ?, status = ?, start_date = ?, target_date = ?, color = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?
       RETURNING id, user_id, name, description, goal, status, start_date, target_date, color, created_at, updated_at`,
    )
    .bind(input.name, input.description, input.goal, input.status, input.start_date, input.target_date, input.color, id, userId)
    .first<{ id: number }>();
  if (!updated) return null;
  return db.prepare(
    `SELECT p.id, p.user_id, p.name, p.description, p.goal, p.status, p.start_date, p.target_date, p.color,
            COUNT(r.id) AS record_count, AVG(r.intensity_score) AS average_intensity,
            p.created_at, p.updated_at
     FROM projects p
     LEFT JOIN study_records r ON r.project_id = p.id AND r.user_id = p.user_id
     WHERE p.id = ? AND p.user_id = ?
     GROUP BY p.id`,
  ).bind(id, userId).first<StudyProject>();
}

export async function removeProject(userId: string, id: number) {
  const db = database();
  const owned = await db
    .prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first<{ id: number }>();
  if (!owned) return false;
  await db.batch([
    db.prepare("UPDATE study_records SET project_id = NULL WHERE project_id = ? AND user_id = ?").bind(id, userId),
    db.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?").bind(id, userId),
  ]);
  return true;
}
