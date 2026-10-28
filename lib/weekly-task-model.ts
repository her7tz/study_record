export const weeklyTaskStatuses = ["todo", "done", "crossed"] as const;
export type WeeklyTaskStatus = typeof weeklyTaskStatuses[number];
export type WeeklyTaskInput = { week_start: string; title: string; note: string; status: WeeklyTaskStatus };
export type WeeklyTask = WeeklyTaskInput & { id: number; created_at: string; updated_at: string };

export function isValidWeeklyDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= "1900-01-01" && value <= "9999-12-24"
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function validateWeeklyTask(input: WeeklyTaskInput) {
  if (!isValidWeeklyDate(input.week_start) || new Date(`${input.week_start}T00:00:00Z`).getUTCDay() !== 1) return "请选择有效的周次（周一开始）。";
  if (!input.title.trim() || input.title.length > 120) return "任务内容需填写且不超过 120 个字。";
  if (input.note.length > 2000) return "备注不能超过 2000 个字。";
  if (!weeklyTaskStatuses.includes(input.status)) return "请选择待做、打勾或打叉。";
  return null;
}
