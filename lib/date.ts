const TIME_ZONE = "Asia/Shanghai";

export function todayString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function weekStartString(today: string) {
  const date = new Date(`${today}T00:00:00Z`);
  const weekday = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  return date.toISOString().slice(0, 10);
}

export function formatStudyDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatWeekRange(weekStart: string) {
  const format = (value: string) => value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1/$2/$3");
  return `${format(weekStart)} – ${format(shiftDate(weekStart, 6))}`;
}
