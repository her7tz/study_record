import { env } from "cloudflare:workers";
import { projectColors, type StudyProject, type StudyProjectInput } from "@/lib/project-model";

export { projectColors, type ProjectColor, type StudyProject, type StudyProjectInput } from "@/lib/project-model";

function database() {
  if (!env.DB) throw new Error("项目数据库暂时不可用。");
  return env.DB;
}

export function validateProject(input: StudyProjectInput) {
  if (!input.name || input.name.length > 40) return "项目名称需填写且不超过 40 个字。";
  if (input.description.length > 240) return "项目说明不能超过 240 个字。";
  if (!projectColors.includes(input.color)) return "请选择有效的项目颜色。";
  return null;
}

export async function listProjects(userId: string) {
  const result = await database()
    .prepare(
      `SELECT id, user_id, name, description, color, created_at, updated_at
       FROM projects
       WHERE user_id = ?
       ORDER BY updated_at DESC, id DESC`,
    )
    .bind(userId)
    .all<StudyProject>();
  return result.results;
}

export async function insertProject(userId: string, input: StudyProjectInput) {
  return database()
    .prepare(
      `INSERT INTO projects (user_id, name, description, color)
       VALUES (?, ?, ?, ?)
       RETURNING id, user_id, name, description, color, created_at, updated_at`,
    )
    .bind(userId, input.name, input.description, input.color)
    .first<StudyProject>();
}

export async function editProject(userId: string, id: number, input: StudyProjectInput) {
  return database()
    .prepare(
      `UPDATE projects
       SET name = ?, description = ?, color = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?
       RETURNING id, user_id, name, description, color, created_at, updated_at`,
    )
    .bind(input.name, input.description, input.color, id, userId)
    .first<StudyProject>();
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
