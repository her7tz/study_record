import { env } from "cloudflare:workers";
import { weekStartString } from "@/lib/date";

export type HeatmapDay = {
  date: string;
  count: number;
  average_intensity: number;
};

export type TrendDay = HeatmapDay & {
  label: string;
};

export type StudyAnalytics = {
  total_records: number;
  total_active_days: number;
  overall_average: number;
  today_count: number;
  today_average: number;
  week_count: number;
  week_average: number;
  current_streak: number;
  longest_streak: number;
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

function heatmapStart(today: string) {
  const end = new Date(`${today}T00:00:00Z`);
  const weekday = end.getUTCDay();
  const mondayDistance = weekday === 0 ? 6 : weekday - 1;
  end.setUTCDate(end.getUTCDate() - mondayDistance - 11 * 7);
  return end.toISOString().slice(0, 10);
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
    };
  });
}

export async function getHeatmapData(userId: string, today: string, projectId?: number | null) {
  const conditions = ["user_id = ?", "study_date >= ?", "study_date <= ?"];
  const bindings: Array<string | number> = [userId, heatmapStart(today), today];
  if (projectId === null) {
    conditions.push("project_id IS NULL");
  } else if (typeof projectId === "number") {
    conditions.push("project_id = ?");
    bindings.push(projectId);
  }
  const result = await database().prepare(
    `SELECT study_date AS date, COUNT(*) AS count, AVG(intensity_score) AS average_intensity
     FROM study_records
     WHERE ${conditions.join(" AND ")}
     GROUP BY study_date
     ORDER BY study_date`,
  ).bind(...bindings).all<HeatmapDay>();
  return result.results.map((row) => ({
    date: row.date,
    count: Number(row.count),
    average_intensity: Number(row.average_intensity),
  }));
}

export async function getStudyAnalytics(userId: string, today: string): Promise<StudyAnalytics> {
  const weekStart = weekStartString(today);
  const trendStart = shiftDate(today, -13);
  const db = database();
  const [metrics, activeDates, trendRows, heatmap] = await Promise.all([
    db.prepare(
      `SELECT
         COUNT(*) AS total_records,
         COUNT(DISTINCT study_date) AS total_active_days,
         COALESCE(AVG(intensity_score), 0) AS overall_average,
         SUM(CASE WHEN study_date = ? THEN 1 ELSE 0 END) AS today_count,
         COALESCE(AVG(CASE WHEN study_date = ? THEN intensity_score END), 0) AS today_average,
         SUM(CASE WHEN study_date >= ? AND study_date <= ? THEN 1 ELSE 0 END) AS week_count,
         COALESCE(AVG(CASE WHEN study_date >= ? AND study_date <= ? THEN intensity_score END), 0) AS week_average
       FROM study_records
       WHERE user_id = ?`,
    ).bind(today, today, weekStart, today, weekStart, today, userId).first<Omit<StudyAnalytics, "current_streak" | "longest_streak" | "trend" | "heatmap">>(),
    db.prepare(
      `SELECT DISTINCT study_date AS date
       FROM study_records
       WHERE user_id = ? AND study_date <= ?
       ORDER BY study_date`,
    ).bind(userId, today).all<{ date: string }>(),
    db.prepare(
      `SELECT study_date AS date, COUNT(*) AS count, AVG(intensity_score) AS average_intensity
       FROM study_records
       WHERE user_id = ? AND study_date >= ? AND study_date <= ?
       GROUP BY study_date
       ORDER BY study_date`,
    ).bind(userId, trendStart, today).all<HeatmapDay>(),
    getHeatmapData(userId, today),
  ]);

  const streaks = calculateStreaks(activeDates.results.map((row) => row.date), today);
  return {
    total_records: Number(metrics?.total_records || 0),
    total_active_days: Number(metrics?.total_active_days || 0),
    overall_average: Number(metrics?.overall_average || 0),
    today_count: Number(metrics?.today_count || 0),
    today_average: Number(metrics?.today_average || 0),
    week_count: Number(metrics?.week_count || 0),
    week_average: Number(metrics?.week_average || 0),
    current_streak: streaks.current,
    longest_streak: streaks.longest,
    trend: fillTrend(trendRows.results, today),
    heatmap,
  };
}
