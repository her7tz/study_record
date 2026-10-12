import { getAppUser } from "@/app/chatgpt-auth";
import { listProjectDependencies, replaceProjectDependencies } from "@/lib/project-dependencies";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET() {
  const user = await getAppUser();
  if (!user) return jsonError("请先登录。", 401);
  try {
    return Response.json({ dependencies: await listProjectDependencies(user.userId) });
  } catch (error) {
    console.error("project-dependencies:get", error);
    return jsonError("暂时无法读取项目关系。", 503);
  }
}

export async function PUT(request: Request) {
  const user = await getAppUser();
  if (!user) return jsonError("请先登录。", 401);
  try {
    const payload = (await request.json()) as { project_id?: unknown; prerequisite_ids?: unknown; is_foundation?: unknown };
    const projectId = Number(payload.project_id);
    const prerequisiteIds = Array.isArray(payload.prerequisite_ids) ? payload.prerequisite_ids.map(Number) : null;
    if (!Number.isInteger(projectId) || projectId < 1 || !prerequisiteIds || typeof payload.is_foundation !== "boolean") return jsonError("项目关系数据无效。", 400);
    const result = await replaceProjectDependencies(user.userId, projectId, prerequisiteIds, payload.is_foundation);
    if (!result.ok) {
      const status = result.reason === "项目不存在。" ? 404 : result.reason.startsWith("这条依赖会形成循环") ? 409 : 400;
      return jsonError(result.reason, status);
    }
    return Response.json({ dependencies: result.edges, is_foundation: payload.is_foundation });
  } catch (error) {
    console.error("project-dependencies:update", error);
    return jsonError("项目关系保存失败，请稍后再试。", 503);
  }
}
