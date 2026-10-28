import { env } from "cloudflare:workers";
import type { WeeklyTask, WeeklyTaskInput, WeeklyTaskStatus } from "@/lib/weekly-task-model";

function database() {
  if (!env.DB) throw new Error("每周任务暂时不可用。");
  return env.DB;
}
const columns = "id, week_start, title, note, status, created_at, updated_at";

export async function listWeeklyTasks(userId: string, weekStart: string) {
  const result = await database().prepare(`SELECT ${columns} FROM weekly_tasks
    WHERE user_id = ? AND week_start = ? AND deleted_at IS NULL ORDER BY created_at ASC, id ASC`)
    .bind(userId, weekStart).all<WeeklyTask>();
  return result.results;
}

export function insertWeeklyTask(userId: string, input: WeeklyTaskInput) {
  return database().prepare(`INSERT INTO weekly_tasks (user_id, week_start, title, note, status)
    VALUES (?, ?, ?, ?, ?) RETURNING ${columns}`).bind(userId, input.week_start, input.title, input.note, input.status).first<WeeklyTask>();
}

export function editWeeklyTask(userId: string, id: number, input: WeeklyTaskInput) {
  return database().prepare(`UPDATE weekly_tasks SET week_start = ?, title = ?, note = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND deleted_at IS NULL RETURNING ${columns}`)
    .bind(input.week_start, input.title, input.note, input.status, id, userId).first<WeeklyTask>();
}

export async function removeWeeklyTask(userId: string, id: number) {
  const result = await database().prepare(`UPDATE weekly_tasks SET deleted_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND deleted_at IS NULL`).bind(new Date().toISOString(), id, userId).run();
  return result.meta.changes > 0;
}

export function markWeeklyTask(userId: string, id: number, status: WeeklyTaskStatus) {
  return database().prepare(`UPDATE weekly_tasks SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND deleted_at IS NULL RETURNING ${columns}`).bind(status, id, userId).first<WeeklyTask>();
}
