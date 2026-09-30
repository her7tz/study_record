import { env } from "cloudflare:workers";

const RECOVERY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type TrashRecord = {
  kind: "record";
  id: number;
  title: string;
  study_date: string;
  deleted_at: string;
  expires_at: string;
  project_name: string | null;
};

export type TrashProject = {
  kind: "project";
  id: number;
  title: string;
  deleted_at: string;
  expires_at: string;
  record_count: number;
};

export type TrashItem = TrashRecord | TrashProject;

function database() {
  if (!env.DB) throw new Error("回收站暂时不可用。");
  return env.DB;
}

function cutoffDate() {
  return new Date(Date.now() - RECOVERY_WINDOW_MS).toISOString();
}

function expiryDate(deletedAt: string) {
  return new Date(new Date(deletedAt).getTime() + RECOVERY_WINDOW_MS).toISOString();
}

async function purgeExpired(userId: string) {
  const db = database();
  const cutoff = cutoffDate();
  await db.batch([
    db.prepare("DELETE FROM study_records WHERE user_id = ? AND deleted_at IS NOT NULL AND deleted_at < ?").bind(userId, cutoff),
    db.prepare("DELETE FROM projects WHERE user_id = ? AND deleted_at IS NOT NULL AND deleted_at < ?").bind(userId, cutoff),
  ]);
}

export async function listTrash(userId: string): Promise<TrashItem[]> {
  await purgeExpired(userId);
  const db = database();
  const cutoff = cutoffDate();
  const [records, projects] = await Promise.all([
    db.prepare(
      `SELECT r.id, r.subject AS title, r.study_date, r.deleted_at, p.name AS project_name
       FROM study_records r
       LEFT JOIN projects p ON p.id = r.project_id AND p.user_id = r.user_id AND p.deleted_at IS NULL
       WHERE r.user_id = ? AND r.deleted_at IS NOT NULL AND r.deleted_at >= ?
         AND NOT EXISTS (
           SELECT 1 FROM projects deleted_project
           WHERE deleted_project.id = r.project_id AND deleted_project.user_id = r.user_id
             AND deleted_project.deleted_at = r.deleted_at
         )
       ORDER BY r.deleted_at DESC, r.id DESC`,
    ).bind(userId, cutoff).all<Omit<TrashRecord, "kind" | "expires_at">>(),
    db.prepare(
      `SELECT p.id, p.name AS title, p.deleted_at, COUNT(r.id) AS record_count
       FROM projects p
       LEFT JOIN study_records r ON r.project_id = p.id AND r.user_id = p.user_id AND r.deleted_at = p.deleted_at
       WHERE p.user_id = ? AND p.deleted_at IS NOT NULL AND p.deleted_at >= ?
       GROUP BY p.id
       ORDER BY p.deleted_at DESC, p.id DESC`,
    ).bind(userId, cutoff).all<Omit<TrashProject, "kind" | "expires_at">>(),
  ]);

  return [
    ...records.results.map((record) => ({ ...record, kind: "record" as const, expires_at: expiryDate(record.deleted_at) })),
    ...projects.results.map((project) => ({ ...project, kind: "project" as const, record_count: Number(project.record_count), expires_at: expiryDate(project.deleted_at) })),
  ].sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));
}

export async function restoreTrashItem(userId: string, kind: "record" | "project", id: number) {
  const db = database();
  const cutoff = cutoffDate();
  if (kind === "record") {
    const result = await db.prepare(
      `UPDATE study_records SET deleted_at = NULL
       WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL AND deleted_at >= ?
         AND NOT EXISTS (
           SELECT 1 FROM projects p WHERE p.id = study_records.project_id AND p.user_id = study_records.user_id
             AND p.deleted_at = study_records.deleted_at
         )`,
    ).bind(id, userId, cutoff).run();
    return result.meta.changes > 0;
  }

  const project = await db.prepare(
    "SELECT deleted_at FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL AND deleted_at >= ?",
  ).bind(id, userId, cutoff).first<{ deleted_at: string }>();
  if (!project) return false;
  const deletedAt = project.deleted_at;
  const results = await db.batch([
    db.prepare("UPDATE projects SET deleted_at = NULL WHERE id = ? AND user_id = ? AND deleted_at = ?").bind(id, userId, deletedAt),
    db.prepare("UPDATE study_records SET deleted_at = NULL WHERE project_id = ? AND user_id = ? AND deleted_at = ?").bind(id, userId, deletedAt),
  ]);
  return Number(results[0]?.meta.changes || 0) > 0;
}
