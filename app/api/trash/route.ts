import { getChatGPTUser } from "@/app/chatgpt-auth";
import { listTrash, restoreTrashItem } from "@/lib/trash";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return jsonError("请先登录。", 401);
  try {
    return Response.json({ items: await listTrash(user.userId) });
  } catch (error) {
    console.error("trash:list", error);
    return jsonError("暂时无法读取回收站。", 503);
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return jsonError("请先登录。", 401);
  try {
    const payload = (await request.json()) as { kind?: unknown; id?: unknown };
    const kind = payload.kind;
    const id = Number(payload.id);
    if ((kind !== "record" && kind !== "project") || !Number.isInteger(id) || id < 1) {
      return jsonError("恢复信息无效。", 400);
    }
    const restored = await restoreTrashItem(user.userId, kind, id);
    if (!restored) return jsonError("内容已超过 7 天恢复期限，或已不在回收站中。", 404);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("trash:restore", error);
    return jsonError("恢复失败，请稍后再试。", 503);
  }
}
