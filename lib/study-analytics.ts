import { env } from "cloudflare:workers";
import { weekStartString } from "@/lib/date";

export type HeatmapDay = {
  date: string;
  count: number;
  average_intensity: number;
  total_intensity: number;
  total_points: number;
};

export type TrendDay = HeatmapDay & {
  label: string;
};

export type ProjectPointShare = {
  project_id: number;
  project_name: string;
  project_color: string;
  total_points: number;
  week_points: number;
};

export type StudyAnalytics = {
  total_records: number;
  total_active_days: number;
  total_intensity: number;
  total_points: number;
  overall_average: number;
  today_count: number;
  today_average: number;
  today_intensity: number;
  today_points: number;
  week_count: number;
  week_average: number;
  week_intensity: number;
  week_points: number;
  total_credits: number;
  completed_projects: number;
  current_streak: number;
  longest_streak: number;
  project_points: ProjectPointShare[];
  trend: TrendDay[];
  heatmap: HeatmapDay[];
};

function database() {
  if (!env.DB) throw new Error("学习记录数据库暂时不可用。");
  return env.DB;
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthRange(month: string, today: string) {
  const start = `${month}-01`;
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
  return { start, end: lastDay > today ? today : lastDay };
}

function calculateStreaks(dates: string[], today: string) {
  if (!dates.length) return { current: 0, longest: 0 };
  let longest = 1;
  let run = 1;
  for (let index = 1; index < dates.length; index += 1) {
    if (dates[index] === shiftDate(dates[index - 1], 1)) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  const latest = dates[dates.length - 1];
  if (latest !== today && latest !== shiftDate(today, -1)) return { current: 0, longest };
  let current = 1;
  for (let index = dates.length - 1; index > 0; index -= 1) {
    if (dates[index - 1] !== shiftDate(dates[index], -1)) break;
    current += 1;
  }
  return { current, longest };
}

function fillTrend(rows: HeatmapDay[], today: string) {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  return Array.from({ length: 14 }, (_, index) => {
    const date = shiftDate(today, index - 13);
    const row = byDate.get(date);
    const value = new Date(`${date}T00:00:00Z`);
    return {
      date,
      label: `${value.getUTCMonth() + 1}/${value.getUTCDate()}`,
      count: Number(row?.count || 0),
      average_intensity: Number(row?.average_intensity || 0),
      total_intensity: Number(row?.total_intensity || 0),
      total_points: Number(row?.total_points || 0),
    };
  });
}

export async function getHeatmapData(userId: string, today: string, projectId?: number | null, month = today.slice(0, 7)) {
  const range = monthRange(month, today);
  const conditions = ["r.user_id = ?", "r.deleted_at IS NULL", "r.study_date >= ?", "r.study_date <= ?"];
  const bindings: Array<string | number> = [userId, range.start, range.end];
  if (projectId === null) {
    conditions.push("r.project_id IS NULL");
  } else if (typeof projectId === "number") {
    conditions.push("r.project_id = ?");
    bindings.push(projectId);
  }
  const result = await database().prepare(
    `SELECT r.study_date AS date, COUNT(*) AS count, AVG(r.intensity_score) AS average_intensity,
            SUM(r.intensity_score) AS total_intensity,
            SUM(COALESCE(p.importance, 0) * r.intensity_score) AS total_points
     FROM study_records r
     LEFT JOIN projects p ON p.id = r.project_id AND p.user_id = r.user_id AND p.deleted_at IS NULL
     WHERE ${conditions.join(" AND ")}
     GROUP BY r.study_date
     ORDER BY r.study_date`,
  ).bind(...bindings).all<HeatmapDay>();
  return result.results.map((row) => ({
    date: row.date,
    count: Number(row.count),
    average_intensity: Number(row.average_intensity),
    total_intensity: Number(row.total_intensity),
    total_points: Number(row.total_points),
  }));
}

export async function getStudyAnalytics(userId: string, today: string): Promise<StudyAnalytics> {
  const weekStart = weekStartString(today);
  const trendStart = shiftDate(today, -13);
  const db = database();
  const [metrics, activeDates, trendRows, heatmap, credits, projectPoints] = await Promise.all([
    db.prepare(
      `SELECT
         COUNT(*) AS total_records,
         COUNT(DISTINCT study_date) AS total_active_days,
         COALESCE(SUM(intensity_score), 0) AS total_intensity,
         COALESCE(SUM(COALESCE(p.importance, 0) * intensity_score), 0) AS total_points,
         COALESCE(AVG(intensity_score), 0) AS overall_average,
         SUM(CASE WHEN study_date = ? THEN 1 ELSE 0 END) AS today_count,
         COALESCE(AVG(CASE WHEN study_date = ? THEN intensity_score END), 0) AS today_average,
         COALESCE(SUM(CASE WHEN study_date = ? THEN intensity_score ELSE 0 END), 0) AS today_intensity,
         COALESCE(SUM(CASE WHEN study_date = ? THEN COALESCE(p.importance, 0) * intensity_score ELSE 0 END), 0) AS today_points,
         SUM(CASE WHEN study_date >= ? AND study_date <= ? THEN 1 ELSE 0 END) AS week_count,
         COALESCE(AVG(CASE WHEN study_date >= ? AND study_date <= ? THEN intensity_score END), 0) AS week_average,
         COALESCE(SUM(CASE WHEN study_date >= ? AND study_date <= ? THEN intensity_score ELSE 0 END), 0) AS week_intensity,
         COALESCE(SUM(CASE WHEN study_date >= ? AND study_date <= ? THEN COALESCE(p.importance, 0) * intensity_score ELSE 0 END), 0) AS week_points
       FROM study_records r
       LEFT JOIN projects p ON p.id = r.project_id AND p.user_id = r.user_id AND p.deleted_at IS NULL
       WHERE r.user_id = ? AND r.deleted_at IS NULL`,
    ).bind(today, today, today, today, weekStart, today, weekStart, today, weekStart, today, weekStart, today, userId).first<Omit<StudyAnalytics, "current_streak" | "longest_streak" | "trend" | "heatmap" | "total_credits" | "completed_projects">>(),
    db.prepare(
      `SELECT DISTINCT study_date AS date
       FROM study_records
       WHERE user_id = ? AND deleted_at IS NULL AND study_date <= ?
       ORDER BY study_date`,
    ).bind(userId, today).all<{ date: string }>(),
    db.prepare(
      `SELECT r.study_date AS date, COUNT(*) AS count, AVG(r.intensity_score) AS average_intensity,
              SUM(r.intensity_score) AS total_intensity,
              SUM(COALESCE(p.importance, 0) * r.intensity_score) AS total_points
       FROM study_records r
       LEFT JOIN projects p ON p.id = r.project_id AND p.user_id = r.user_id AND p.deleted_at IS NULL
       WHERE r.user_id = ? AND r.deleted_at IS NULL AND r.study_date >= ? AND r.study_date <= ?
       GROUP BY r.study_date
       ORDER BY r.study_date`,
    ).bind(userId, trendStart, today).all<HeatmapDay>(),
    getHeatmapData(userId, today),
    db.prepare(
      `SELECT COUNT(*) AS completed_projects, COALESCE(SUM(importance), 0) AS total_credits
       FROM projects
       WHERE user_id = ? AND status = 'completed' AND deleted_at IS NULL`,
    ).bind(userId).first<{ completed_projects: number; total_credits: number }>(),
    db.prepare(
      `SELECT p.id AS project_id, p.name AS project_name, p.color AS project_color,
              COALESCE(SUM(r.intensity_score * p.importance), 0) AS total_points,
              COALESCE(SUM(CASE WHEN r.study_date >= ? AND r.study_date <= ? THEN r.intensity_score * p.importance ELSE 0 END), 0) AS week_points
       FROM projects p
       LEFT JOIN study_records r ON r.project_id = p.id AND r.user_id = p.user_id AND r.deleted_at IS NULL
       WHERE p.user_id = ? AND p.deleted_at IS NULL
       GROUP BY p.id
       ORDER BY p.sort_order ASC, p.created_at ASC, p.id ASC`,
    ).bind(weekStart, today, userId).all<ProjectPointShare>(),
  ]);

  const streaks = calculateStreaks(activeDates.results.map((row) => row.date), today);
  return {
    total_records: Number(metrics?.total_records || 0),
    total_active_days: Number(metrics?.total_active_days || 0),
    total_intensity: Number(metrics?.total_intensity || 0),
    total_points: Number(metrics?.total_points || 0),
    overall_average: Number(metrics?.overall_average || 0),
    today_count: Number(metrics?.today_count || 0),
    today_average: Number(metrics?.today_average || 0),
    today_intensity: Number(metrics?.today_intensity || 0),
    today_points: Number(metrics?.today_points || 0),
    week_count: Number(metrics?.week_count || 0),
    week_average: Number(metrics?.week_average || 0),
    week_intensity: Number(metrics?.week_intensity || 0),
    week_points: Number(metrics?.week_points || 0),
    total_credits: Number(credits?.total_credits || 0),
    completed_projects: Number(credits?.completed_projects || 0),
    current_streak: streaks.current,
    longest_streak: streaks.longest,
    project_points: projectPoints.results.map((project) => ({
      ...project,
      project_id: Number(project.project_id),
      total_points: Number(project.total_points),
      week_points: Number(project.week_points),
    })),
    trend: fillTrend(trendRows.results, today),
    heatmap,
  };
}
