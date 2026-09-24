import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { StudyDashboard } from "@/components/study-dashboard";
import { todayString } from "@/lib/date";
import { listRecords, type StudyRecord } from "@/lib/study-records";
import { getStudyAnalytics, type StudyAnalytics } from "@/lib/study-analytics";
import { listProjects } from "@/lib/projects";
import type { StudyProject } from "@/lib/project-model";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  let records: StudyRecord[] = [];
  let projects: StudyProject[] = [];
  let recordTotal = 0;
  let analytics: StudyAnalytics = {
    total_records: 0,
    total_active_days: 0,
    total_intensity: 0,
    overall_average: 0,
    today_count: 0,
    today_average: 0,
    today_intensity: 0,
    week_count: 0,
    week_average: 0,
    week_intensity: 0,
    current_streak: 0,
    longest_streak: 0,
    trend: [],
    heatmap: [],
  };
  let loadError = "";

  try {
    const [recordPage, loadedProjects, loadedAnalytics] = await Promise.all([
      listRecords(user.userId, { limit: 50 }),
      listProjects(user.userId),
      getStudyAnalytics(user.userId, todayString()),
    ]);
    records = recordPage.records;
    recordTotal = recordPage.total;
    projects = loadedProjects;
    analytics = loadedAnalytics;
  } catch (error) {
    console.error("dashboard:load", error);
    loadError = "学习记录暂时没有加载出来，请稍后刷新。";
  }

  return (
    <StudyDashboard
      initialRecords={records}
      initialRecordTotal={recordTotal}
      initialAnalytics={analytics}
      initialProjects={projects}
      today={todayString()}
      user={{ displayName: user.displayName, email: user.email }}
      loadError={loadError}
    />
  );
}
