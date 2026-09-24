import { getChatGPTUser } from "@/app/chatgpt-auth";
import { todayString } from "@/lib/date";
import { getHeatmapData, getStudyAnalytics } from "@/lib/study-analytics";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return jsonError("请先登录。", 401);
  try {
    const params = new URL(request.url).searchParams;
    const rawProject = params.get("project_id");
    if (rawProject !== null) {
      const projectId = rawProject === "all" ? undefined : rawProject === "none" ? null : Number(rawProject);
      if (typeof projectId === "number" && (!Number.isInteger(projectId) || projectId < 1)) return jsonError("请选择有效项目。", 400);
      return Response.json({ heatmap: await getHeatmapData(user.userId, todayString(), projectId) });
    }
    return Response.json({ analytics: await getStudyAnalytics(user.userId, todayString()) });
  } catch (error) {
    console.error("analytics:get", error);
    return jsonError("暂时无法读取学习趋势。", 503);
  }
}
