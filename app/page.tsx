import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { StudyDashboard } from "@/components/study-dashboard";
import { todayString } from "@/lib/date";
import { listRecords, type StudyRecord } from "@/lib/study-records";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  let records: StudyRecord[] = [];
  let loadError = "";

  try {
    records = await listRecords(user.userId);
  } catch (error) {
    console.error("dashboard:load", error);
    loadError = "学习记录暂时没有加载出来，请稍后刷新。";
  }

  return (
    <StudyDashboard
      initialRecords={records}
      today={todayString()}
      user={{ displayName: user.displayName, email: user.email }}
      loadError={loadError}
    />
  );
}
