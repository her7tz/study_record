import { getChatGPTUser } from "@/app/chatgpt-auth";
import { editWeeklyTask, insertWeeklyTask, listWeeklyTasks, markWeeklyTask, removeWeeklyTask } from "@/lib/weekly-tasks";
import { validateWeeklyTask, weeklyTaskStatuses, type WeeklyTaskInput, type WeeklyTaskStatus } from "@/lib/weekly-task-model";
export const dynamic = "force-dynamic";

class InputError extends Error {}
function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}
function errorResponse(error: unknown) {
  return json({ error: error instanceof InputError ? error.message : "每周任务暂时无法保存或读取，请稍后重试。" }, error instanceof InputError ? 400 : 503);
}
function taskId(value: unknown) {
  if (typeof value !== "number" && (typeof value !== "string" || !/^[1-9]\d*$/.test(value))) throw new InputError("请选择有效的任务。");
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new InputError("请选择有效的任务。");
  return id;
}
async function body(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") throw new InputError("请发送 JSON 请求。");
  const reader = request.body?.getReader();
  if (!reader) throw new InputError("任务内容不能为空。");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 16384) { await reader.cancel(); throw new InputError("任务内容过长。"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new InputError("任务信息格式无效。"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InputError("任务信息格式无效。");
  return value as Record<string, unknown>;
}
function taskInput(value: Record<string, unknown>): WeeklyTaskInput {
  if (typeof value.week_start !== "string" || typeof value.title !== "string" || (value.note !== undefined && typeof value.note !== "string")) throw new InputError("请填写任务内容及所属周次。");
  if (value.status !== undefined && (typeof value.status !== "string" || !weeklyTaskStatuses.includes(value.status as WeeklyTaskStatus))) throw new InputError("请选择待做、打勾或打叉。");
  const input: WeeklyTaskInput = { week_start: value.week_start, title: value.title.trim(), note: typeof value.note === "string" ? value.note.trim() : "", status: (value.status || "todo") as WeeklyTaskStatus };
  const problem = validateWeeklyTask(input); if (problem) throw new InputError(problem);
  return input;
}
function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin && request.headers.get("sec-fetch-site") !== "cross-site";
}

export async function GET(request: Request) {
  const user = await getChatGPTUser(); if (!user) return json({ error: "请先登录。" }, 401);
  try {
    const weekStart = new URL(request.url).searchParams.get("week_start") || "";
    const problem = validateWeeklyTask({ week_start: weekStart, title: "query", note: "", status: "todo" });
    if (problem) throw new InputError(problem);
    return json({ tasks: await listWeeklyTasks(user.userId, weekStart) });
  } catch (error) { return errorResponse(error); }
}

async function save(request: Request, editing: boolean) {
  const user = await getChatGPTUser(); if (!user) return json({ error: "请先登录。" }, 401);
  if (!sameOrigin(request)) return json({ error: "请在研习簿页面内操作。" }, 403);
  try {
    const value = await body(request);
    if (editing && Object.keys(value).every(key => key === "id" || key === "status")) {
      if (typeof value.status !== "string" || !weeklyTaskStatuses.includes(value.status as WeeklyTaskStatus)) throw new InputError("请选择待做、打勾或打叉。");
      const task = await markWeeklyTask(user.userId, taskId(value.id), value.status as WeeklyTaskStatus);
      return task ? json({ task }) : json({ error: "这个任务已删除或不存在。" }, 404);
    }
    const input = taskInput(value);
    const task = editing ? await editWeeklyTask(user.userId, taskId(value.id), input) : await insertWeeklyTask(user.userId, input);
    if (!task) return json({ error: "这个任务已删除或不存在。" }, 404);
    return json({ task }, editing ? 200 : 201);
  } catch (error) { return errorResponse(error); }
}
export const POST = (request: Request) => save(request, false);
export const PATCH = (request: Request) => save(request, true);
export async function DELETE(request: Request) {
  const user = await getChatGPTUser(); if (!user) return json({ error: "请先登录。" }, 401);
  if (!sameOrigin(request)) return json({ error: "请在研习簿页面内操作。" }, 403);
  try {
    if (!(await removeWeeklyTask(user.userId, taskId(new URL(request.url).searchParams.get("id"))))) return json({ error: "这个任务已删除或不存在。" }, 404);
    return json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
