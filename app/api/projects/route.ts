import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  editProject,
  insertProject,
  listProjects,
  projectColors,
  projectStatuses,
  removeProject,
  validateProject,
  type ProjectColor,
  type ProjectStatus,
  type StudyProjectInput,
} from "@/lib/projects";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function readProjectInput(payload: Partial<StudyProjectInput>): StudyProjectInput {
  const requestedColor = String(payload.color || "blue") as ProjectColor;
  const requestedStatus = String(payload.status || "active") as ProjectStatus;
  return {
    name: String(payload.name || "").trim(),
    description: String(payload.description || "").trim(),
    goal: String(payload.goal || "").trim(),
    status: projectStatuses.includes(requestedStatus) ? requestedStatus : "active",
    start_date: payload.start_date ? String(payload.start_date) : null,
    target_date: payload.target_date ? String(payload.target_date) : null,
    color: projectColors.includes(requestedColor) ? requestedColor : "blue",
  };
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return jsonError("请先登录。", 401);
  try {
    return Response.json({ projects: await listProjects(user.userId) });
  } catch (error) {
    console.error("projects:get", error);
    return jsonError("暂时无法读取项目。", 503);
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return jsonError("请先登录。", 401);
  try {
    const input = readProjectInput(await request.json());
    const problem = validateProject(input);
    if (problem) return jsonError(problem, 400);
    const project = await insertProject(user.userId, input);
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) return jsonError("已经有同名项目了。", 409);
    console.error("projects:create", error);
    return jsonError("项目保存失败，请稍后再试。", 503);
  }
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return jsonError("请先登录。", 401);
  try {
    const payload = (await request.json()) as Partial<StudyProjectInput> & { id?: number };
    const id = Number(payload.id);
    if (!Number.isInteger(id) || id < 1) return jsonError("找不到要修改的项目。", 400);
    const input = readProjectInput(payload);
    const problem = validateProject(input);
    if (problem) return jsonError(problem, 400);
    const project = await editProject(user.userId, id, input);
    if (!project) return jsonError("这个项目不存在。", 404);
    return Response.json({ project });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) return jsonError("已经有同名项目了。", 409);
    console.error("projects:update", error);
    return jsonError("项目修改失败，请稍后再试。", 503);
  }
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return jsonError("请先登录。", 401);
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) return jsonError("找不到要删除的项目。", 400);
  try {
    if (!(await removeProject(user.userId, id))) return jsonError("这个项目不存在。", 404);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("projects:delete", error);
    return jsonError("项目删除失败，请稍后再试。", 503);
  }
}
