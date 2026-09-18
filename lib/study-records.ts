import { env } from "cloudflare:workers";

export type StudyRecord = {
  id: number;
  user_id: string;
  study_date: string;
  subject: string;
  duration_minutes: number;
  note: string;
  created_at: string;
  updated_at: string;
};

export type StudyRecordInput = {
  study_date: string;
  subject: string;
  duration_minutes: number;
  note: string;
};

function database() {
  if (!env.DB) throw new Error("学习记录数据库暂时不可用。");
  return env.DB;
}

export function validateRecord(input: StudyRecordInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.study_date)) return "请选择有效日期。";
  if (!input.subject || input.subject.length > 80) return "学习内容需填写且不超过 80 个字。";
  if (!Number.isInteger(input.duration_minutes) || input.duration_minutes < 1 || input.duration_minutes > 1440) {
    return "学习时长需为 1–1440 分钟。";
  }
  if (input.note.length > 2000) return "备注不能超过 2000 个字。";
  return null;
}

export async function listRecords(userId: string) {
  const result = await database()
    .prepare(
      `SELECT id, user_id, study_date, subject, duration_minutes, note, created_at, updated_at
       FROM study_records
       WHERE user_id = ?
       ORDER BY study_date DESC, created_at DESC
       LIMIT 200`,
    )
    .bind(userId)
    .all<StudyRecord>();
  return result.results;
}

export async function insertRecord(userId: string, input: StudyRecordInput) {
  return database()
    .prepare(
      `INSERT INTO study_records (user_id, study_date, subject, duration_minutes, note)
       VALUES (?, ?, ?, ?, ?)
       RETURNING id, user_id, study_date, subject, duration_minutes, note, created_at, updated_at`,
    )
    .bind(userId, input.study_date, input.subject, input.duration_minutes, input.note)
    .first<StudyRecord>();
}

export async function editRecord(userId: string, id: number, input: StudyRecordInput) {
  return database()
    .prepare(
      `UPDATE study_records
       SET study_date = ?, subject = ?, duration_minutes = ?, note = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?
       RETURNING id, user_id, study_date, subject, duration_minutes, note, created_at, updated_at`,
    )
    .bind(input.study_date, input.subject, input.duration_minutes, input.note, id, userId)
    .first<StudyRecord>();
}

export async function removeRecord(userId: string, id: number) {
  const result = await database()
    .prepare("DELETE FROM study_records WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
  return result.meta.changes > 0;
}
