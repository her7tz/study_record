import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  editProjectExperiment,
  insertProjectExperiment,
  listProjectExperiments,
  listAllProjectExperiments,
  removeProjectExperiment,
  validateProjectExperiment,
} from "@/lib/project-experiments";
import { projectExperimentStatuses, type ProjectExperimentStatus } from "@/lib/project-model";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function positiveId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function readBody(request: Request) {
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return jsonError("请先登录。", 401);
  const url = new URL(request.url);
  const projectIdValue = url.searchParams.get("project_id");
  if (projectIdValue === null) {
    const status = url.searchParams.get("status") ?? "todo";
    if (!projectExperimentStatuses.includes(status as ProjectExperimentStatus)) return jsonError("请选择有效的实验状态。", 400);
    try {
      return Response.json(await listAllProjectExperiments(user.userId, status as ProjectExperimentStatus));
    } catch (error) {
      console.error("project-experiments:list-all", error);
      return jsonError("暂时无法读取实验目录。", 503);
    }
  }
  const projectId = positiveId(projectIdValue);
  if (!projectId) return jsonError("项目编号无效。", 400);
  try {
    const result = await listProjectExperiments(user.userId, projectId);
    if (!result) return jsonError("这个项目不存在。", 404);
    return Response.json(result);
  } catch (error) {
    console.error("project-experiments:list", error);
    return jsonError("暂时无法读取项目实验。", 503);
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return jsonError("请先登录。", 401);
  const payload = await readBody(request);
  if (!payload) return jsonError("实验信息无效。", 400);
  const projectId = positiveId(payload.project_id);
  const name = String(payload.name ?? "").trim();
  const description = String(payload.description ?? "").trim();
  const intensityScore = Number(payload.intensity_score);
  const status = String(payload.status ?? "todo");
  if (!projectId) return jsonError("项目编号无效。", 400);
  const problem = validateProjectExperiment(name, intensityScore, status, description);
  if (problem) return jsonError(problem, 400);
  try {
    if (!(await insertProjectExperiment(user.userId, projectId, name, intensityScore, description, status as ProjectExperimentStatus))) return jsonError("这个项目不存在。", 404);
    return Response.json(await listProjectExperiments(user.userId, projectId), { status: 201 });
  } catch (error) {
    console.error("project-experiments:create", error);
    return jsonError("实验保存失败，请稍后再试。", 503);
  }
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return jsonError("请先登录。", 401);
  const payload = await readBody(request);
  if (!payload) return jsonError("实验信息无效。", 400);
  const projectId = positiveId(payload.project_id);
  const id = positiveId(payload.id);
  const name = String(payload.name ?? "").trim();
  const description = String(payload.description ?? "").trim();
  const intensityScore = Number(payload.intensity_score);
  const status = String(payload.status ?? "");
  if (!projectId || !id) return jsonError("项目或实验编号无效。", 400);
  const problem = validateProjectExperiment(name, intensityScore, status, description);
  if (problem) return jsonError(problem, 400);
  try {
    if (!(await editProjectExperiment(user.userId, projectId, id, name, intensityScore, status as ProjectExperimentStatus, description))) {
      return jsonError("这条实验不存在。", 404);
    }
    return Response.json(await listProjectExperiments(user.userId, projectId));
  } catch (error) {
    console.error("project-experiments:update", error);
    return jsonError("实验修改失败，请稍后再试。", 503);
  }
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return jsonError("请先登录。", 401);
  const url = new URL(request.url);
  const projectId = positiveId(url.searchParams.get("project_id"));
  const id = positiveId(url.searchParams.get("id"));
  if (!projectId || !id) return jsonError("项目或实验编号无效。", 400);
  try {
    if (!(await removeProjectExperiment(user.userId, projectId, id, new Date().toISOString()))) return jsonError("这条实验不存在。", 404);
    return Response.json(await listProjectExperiments(user.userId, projectId));
  } catch (error) {
    console.error("project-experiments:delete", error);
    return jsonError("实验删除失败，请稍后再试。", 503);
  }
}
