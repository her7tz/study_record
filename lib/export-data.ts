import { env } from "cloudflare:workers";

export type ExportProject = {
  id: number;
  name: string;
  description: string;
  goal: string;
  status: string;
  importance: number;
  start_date: string | null;
  target_date: string | null;
  color: string;
  record_count: number;
  total_intensity: number;
  total_points: number;
  credits: number;
  created_at: string;
  updated_at: string;
};

export type ExportRecord = {
  id: number;
  study_date: string;
  subject: string;
  project_id: number | null;
  project_name: string | null;
  project_importance: number | null;
  project_status: string | null;
  intensity_score: number;
  points: number;
  note: string;
  created_at: string;
  updated_at: string;
};

function database() {
  if (!env.DB) throw new Error("学习记录数据库暂时不可用。");
  return env.DB;
}

export async function getExportData(userId: string) {
  const db = database();
  const projectResult = await db.prepare(
    `SELECT p.id, p.name, p.description, p.goal, p.status, p.importance, p.start_date, p.target_date, p.color,
            COUNT(r.id) AS record_count,
            COALESCE(SUM(r.intensity_score), 0) AS total_intensity,
            COALESCE(SUM(r.intensity_score * p.importance), 0) AS total_points,
            CASE WHEN p.status = 'completed' THEN p.importance ELSE 0 END AS credits,
            p.created_at, p.updated_at
     FROM projects p
     LEFT JOIN study_records r ON r.project_id = p.id AND r.user_id = p.user_id AND r.deleted_at IS NULL
     WHERE p.user_id = ? AND p.deleted_at IS NULL
     GROUP BY p.id
     ORDER BY p.updated_at DESC, p.id DESC`,
  ).bind(userId).all<ExportProject>();

  const records: ExportRecord[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const page = await db.prepare(
      `SELECT r.id, r.study_date, r.subject, r.project_id,
              p.name AS project_name, p.importance AS project_importance, p.status AS project_status,
              r.intensity_score,
              COALESCE(p.importance, 0) * r.intensity_score AS points,
              r.note, r.created_at, r.updated_at
       FROM study_records r
       LEFT JOIN projects p ON p.id = r.project_id AND p.user_id = r.user_id AND p.deleted_at IS NULL
       WHERE r.user_id = ? AND r.deleted_at IS NULL
       ORDER BY r.study_date DESC, r.created_at DESC
       LIMIT ? OFFSET ?`,
    ).bind(userId, pageSize, offset).all<ExportRecord>();
    records.push(...page.results);
    if (page.results.length < pageSize) break;
  }

  const projects = projectResult.results.map((project) => ({
    ...project,
    importance: Number(project.importance),
    record_count: Number(project.record_count),
    total_intensity: Number(project.total_intensity),
    total_points: Number(project.total_points),
    credits: Number(project.credits),
  }));
  const normalizedRecords = records.map((record) => ({
    ...record,
    project_importance: record.project_importance === null ? null : Number(record.project_importance),
    intensity_score: Number(record.intensity_score),
    points: Number(record.points),
  }));

  return {
    projects,
    records: normalizedRecords,
    summary: {
      total_projects: projects.length,
      completed_projects: projects.filter((project) => project.status === "completed").length,
      total_records: normalizedRecords.length,
      total_intensity: normalizedRecords.reduce((sum, record) => sum + record.intensity_score, 0),
      total_points: normalizedRecords.reduce((sum, record) => sum + record.points, 0),
      total_credits: projects.reduce((sum, project) => sum + project.credits, 0),
    },
  };
}
