import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  editRecord,
  insertRecord,
  listRecords,
  removeRecord,
  validateRecord,
  type StudyRecordInput,
} from "@/lib/study-records";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function requireApiUser() {
  return getChatGPTUser();
}

async function readInput(request: Request): Promise<StudyRecordInput> {
  const payload = (await request.json()) as Partial<StudyRecordInput>;
  return {
    study_date: String(payload.study_date || ""),
    subject: String(payload.subject || "").trim(),
    project_id: payload.project_id === null || payload.project_id === undefined ? null : Number(payload.project_id),
    intensity_score: Number(payload.intensity_score),
    note: String(payload.note || "").trim(),
  };
}

export async function GET() {
  const user = await requireApiUser();
  if (!user) return jsonError("请先登录。", 401);
  try {
    return Response.json({ records: await listRecords(user.userId) });
  } catch (error) {
    console.error("records:get", error);
    return jsonError("暂时无法读取学习记录。", 503);
  }
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return jsonError("请先登录。", 401);
  try {
    const input = await readInput(request);
    const problem = validateRecord(input);
    if (problem) return jsonError(problem, 400);
    const record = await insertRecord(user.userId, input);
    return Response.json({ record }, { status: 201 });
  } catch (error) {
    console.error("records:create", error);
    return jsonError("保存失败，请稍后再试。", 503);
  }
}

export async function PATCH(request: Request) {
  const user = await requireApiUser();
  if (!user) return jsonError("请先登录。", 401);
  try {
    const payload = (await request.json()) as Partial<StudyRecordInput> & { id?: number };
    const id = Number(payload.id);
    const input: StudyRecordInput = {
      study_date: String(payload.study_date || ""),
      subject: String(payload.subject || "").trim(),
      project_id: payload.project_id === null || payload.project_id === undefined ? null : Number(payload.project_id),
      intensity_score: Number(payload.intensity_score),
      note: String(payload.note || "").trim(),
    };
    if (!Number.isInteger(id) || id < 1) return jsonError("找不到要修改的记录。", 400);
    const problem = validateRecord(input);
    if (problem) return jsonError(problem, 400);
    const record = await editRecord(user.userId, id, input);
    if (!record) return jsonError("这条记录不存在。", 404);
    return Response.json({ record });
  } catch (error) {
    console.error("records:update", error);
    return jsonError("修改失败，请稍后再试。", 503);
  }
}

export async function DELETE(request: Request) {
  const user = await requireApiUser();
  if (!user) return jsonError("请先登录。", 401);
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) return jsonError("找不到要删除的记录。", 400);
  try {
    if (!(await removeRecord(user.userId, id))) return jsonError("这条记录不存在。", 404);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("records:delete", error);
    return jsonError("删除失败，请稍后再试。", 503);
  }
}
