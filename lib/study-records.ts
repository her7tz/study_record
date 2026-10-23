import { env } from "cloudflare:workers";

export type StudyRecordType = "learning" | "experiment";

export type StudyRecord = {
  id: number;
  user_id: string;
  study_date: string;
  subject: string;
  record_type: StudyRecordType;
  experiment_id: number | null;
  project_id: number | null;
  intensity_score: number;
  note: string;
  created_at: string;
  updated_at: string;
};

export type StudyRecordInput = {
  study_date: string;
  subject: string;
  record_type: StudyRecordType;
  project_id: number | null;
  intensity_score: number;
  note: string;
};

export type StudyRecordPage = {
  records: StudyRecord[];
  total: number;
  average_intensity: number;
  total_intensity: number;
  total_points: number;
};

export type StudyRecordQuery = {
  limit?: number;
  offset?: number;
  query?: string;
  projectId?: number | null;
  date?: string;
  from?: string;
  to?: string;
  recordType?: StudyRecordType;
};

function database() {
  if (!env.DB) throw new Error("记录数据库暂时不可用。");
  return env.DB;
}

export function validateRecord(input: StudyRecordInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.study_date)) return "请选择有效日期。";
  if (!input.subject || input.subject.length > 80) return "记录内容需填写且不超过 80 个字。";
  if (input.record_type !== "learning" && input.record_type !== "experiment") return "请选择学习或实验。";
  if (input.project_id !== null && (!Number.isInteger(input.project_id) || input.project_id < 1)) {
    return "请选择有效项目。";
  }
  if (!Number.isSafeInteger(input.intensity_score) || input.intensity_score < 1 || (input.record_type === "learning" && input.intensity_score > 5)) {
    return input.record_type === "learning" ? "学习强度需为 1–5 分。" : "实验强度需为正整数。";
  }
  if (input.note.length > 2000) return "备注不能超过 2000 个字。";
  return null;
}

export async function listRecords(userId: string, options: StudyRecordQuery = {}): Promise<StudyRecordPage> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const conditions = ["r.user_id = ?", "r.deleted_at IS NULL"];
  const bindings: Array<string | number> = [userId];
  if (options.recordType) {
    conditions.push("r.record_type = ?");
    bindings.push(options.recordType);
  }

  if (options.date) {
    conditions.push("r.study_date = ?");
    bindings.push(options.date);
  }
  if (options.projectId === null) {
    conditions.push("r.project_id IS NULL");
  } else if (typeof options.projectId === "number") {
    conditions.push("r.project_id = ?");
    bindings.push(options.projectId);
  }
  if (options.query) {
    conditions.push("LOWER(r.subject || ' ' || r.note || ' ' || COALESCE(p.name, '')) LIKE ?");
    bindings.push(`%${options.query.toLowerCase()}%`);
  }

  if (options.from) { conditions.push("r.study_date >= ?"); bindings.push(options.from); }
  if (options.to) { conditions.push("r.study_date <= ?"); bindings.push(options.to); }

  const where = conditions.join(" AND ");
  const db = database();
  const [recordsResult, summary] = await Promise.all([
    db.prepare(
      `SELECT r.id, r.user_id, r.study_date, r.subject, r.record_type, r.experiment_id, r.project_id, r.intensity_score, r.note, r.created_at, r.updated_at
       FROM study_records r
       LEFT JOIN projects p ON p.id = r.project_id AND p.user_id = r.user_id AND p.deleted_at IS NULL
       WHERE ${where}
       ORDER BY r.study_date DESC, r.created_at DESC, r.id DESC
       LIMIT ? OFFSET ?`,
    ).bind(...bindings, limit, offset).all<StudyRecord>(),
    db.prepare(
      `SELECT COUNT(*) AS total, COALESCE(AVG(r.intensity_score), 0) AS average_intensity,
              COALESCE(SUM(r.intensity_score), 0) AS total_intensity,
              COALESCE(SUM(COALESCE(p.importance, 0) * r.intensity_score), 0) AS total_points
       FROM study_records r
       LEFT JOIN projects p ON p.id = r.project_id AND p.user_id = r.user_id AND p.deleted_at IS NULL
       WHERE ${where}`,
    ).bind(...bindings).first<{ total: number; average_intensity: number; total_intensity: number; total_points: number }>(),
  ]);

  return {
    records: recordsResult.results,
    total: Number(summary?.total || 0),
    average_intensity: Number(summary?.average_intensity || 0),
    total_intensity: Number(summary?.total_intensity || 0),
    total_points: Number(summary?.total_points || 0),
  };
}

export async function insertRecord(userId: string, input: StudyRecordInput) {
  return database()
    .prepare(
      `INSERT INTO study_records (user_id, study_date, subject, record_type, project_id, intensity_score, note)
       SELECT ?, ?, ?, ?, ?, ?, ?
       WHERE ? IS NULL OR EXISTS (SELECT 1 FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL)
       RETURNING id, user_id, study_date, subject, record_type, experiment_id, project_id, intensity_score, note, created_at, updated_at`,
    )
    .bind(userId, input.study_date, input.subject, input.record_type, input.project_id, input.intensity_score, input.note, input.project_id, input.project_id, userId)
    .first<StudyRecord>();
}

export async function editRecord(userId: string, id: number, input: StudyRecordInput) {
  const db = database();
  const results = await db.batch([db.prepare(
      `UPDATE study_records
       SET study_date = ?, subject = ?, record_type = ?, project_id = ?, intensity_score = ?, note = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?
         AND deleted_at IS NULL
         AND (experiment_id IS NULL OR (record_type = ? AND project_id = ?))
         AND (? IS NULL OR EXISTS (SELECT 1 FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL))
       RETURNING id, user_id, study_date, subject, record_type, experiment_id, project_id, intensity_score, note, created_at, updated_at`,
    )
    .bind(input.study_date, input.subject, input.record_type, input.project_id, input.intensity_score, input.note, id, userId, input.record_type, input.project_id, input.project_id, input.project_id, userId),
    db.prepare(`UPDATE project_experiments SET name = ?, description = ?, intensity_score = ?,
      completed_at = CASE WHEN date(completed_at, '+8 hours') = ? THEN completed_at ELSE datetime(? || ' 00:00:00', '-8 hours') END,
      updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND deleted_at IS NULL AND status = 'done'
        AND id = (SELECT experiment_id FROM study_records WHERE id = ? AND user_id = ? AND deleted_at IS NULL AND record_type = ? AND project_id IS ? AND study_date = ? AND subject = ? AND intensity_score = ? AND note = ?)`)
      .bind(input.subject, input.note, input.intensity_score, input.study_date, input.study_date, userId, id, userId, input.record_type, input.project_id, input.study_date, input.subject, input.intensity_score, input.note),
  ]);
  return (results[0].results[0] as StudyRecord | undefined) ?? null;
}

export async function removeRecord(userId: string, id: number, deletedAt: string) {
  const result = await database()
    .prepare("UPDATE study_records SET deleted_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL")
    .bind(deletedAt, id, userId)
    .run();
  return result.meta.changes > 0;
}
