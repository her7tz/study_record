import { getAppUser } from "@/app/chatgpt-auth";
import {
  createPointRedemption,
  listPointRedemptions,
  validateRedemption,
} from "@/lib/point-redemptions";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET() {
  const user = await getAppUser();
  if (!user) return jsonError("请先登录。", 401);
  try {
    return Response.json(await listPointRedemptions(user.userId));
  } catch (error) {
    console.error("redemptions:list", error);
    return jsonError("暂时无法读取积分兑换记录。", 503);
  }
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return jsonError("请先登录。", 401);
  try {
    const payload = (await request.json()) as { reward_name?: unknown; points?: unknown };
    const rewardName = String(payload.reward_name || "").trim();
    const points = Number(payload.points);
    const problem = validateRedemption(rewardName, points);
    if (problem) return jsonError(problem, 400);

    const redemption = await createPointRedemption(user.userId, rewardName, points);
    if (!redemption) return jsonError("可用积分不足，刷新后检查积分余额。", 409);
    return Response.json({ redemption }, { status: 201 });
  } catch (error) {
    console.error("redemptions:create", error);
    return jsonError("积分兑换失败，请稍后再试。", 503);
  }
}
