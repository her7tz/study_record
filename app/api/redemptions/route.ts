import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  createPointRedemption,
  editPointRedemption,
  removePointRedemption,
  listPointRedemptions,
  validateRedemption,
} from "@/lib/point-redemptions";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return jsonError("请先登录。", 401);
  try {
    const offset = Number(new URL(request.url).searchParams.get("offset") || 0);
    if (!Number.isSafeInteger(offset) || offset < 0) return jsonError("分页参数无效。", 400);
    return Response.json(await listPointRedemptions(user.userId, offset));
  } catch (error) {
    console.error("redemptions:list", error);
    return jsonError("暂时无法读取积分兑换记录。", 503);
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return jsonError("请先登录。", 401);
  try {
    const payload = await request.json().catch(() => null) as { reward_name?: unknown; points?: unknown } | null;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return jsonError("兑换信息无效。", 400);
    const rewardName = String(payload.reward_name || "").trim();
    const points = Number(payload.points);
    const problem = validateRedemption(rewardName, points);
    if (problem) return jsonError(problem, 400);

    const redemption = await createPointRedemption(user.userId, rewardName, points);
    if (!redemption) throw new Error("兑换记录没有保存成功。");
    return Response.json({ redemption }, { status: 201 });
  } catch (error) {
    console.error("redemptions:create", error);
    return jsonError("积分兑换失败，请稍后再试。", 503);
  }
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return jsonError("请先登录。", 401);
  try {
    const payload = await request.json().catch(() => null) as { id?: unknown; reward_name?: unknown; points?: unknown } | null;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return jsonError("兑换信息无效。", 400);
    const id = Number(payload.id);
    if (!Number.isSafeInteger(id) || id < 1) return jsonError("兑换记录编号无效。", 400);
    const rewardName = String(payload.reward_name || "").trim();
    const points = Number(payload.points);
    const problem = validateRedemption(rewardName, points);
    if (problem) return jsonError(problem, 400);
    const redemption = await editPointRedemption(user.userId, id, rewardName, points);
    if (!redemption) return jsonError("这条兑换记录不存在或已删除。", 404);
    return Response.json({ redemption });
  } catch (error) {
    console.error("redemptions:update", error);
    return jsonError("兑换记录修改失败，请稍后再试。", 503);
  }
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return jsonError("请先登录。", 401);
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id < 1) return jsonError("兑换记录编号无效。", 400);
  try {
    if (!(await removePointRedemption(user.userId, id, new Date().toISOString()))) {
      return jsonError("这条兑换记录不存在或已删除。", 404);
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("redemptions:delete", error);
    return jsonError("兑换记录删除失败，请稍后再试。", 503);
  }
}
