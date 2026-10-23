import { agentDatabase } from "@/lib/agent-database";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { AgentAccessError, agentBody, agentError, agentJson, findAgentRequest, grantState, grantToUser, listAgentGrants, publicGrant, requireSameOrigin, revokeAgentGrant } from "@/lib/agent-access";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) throw new AgentAccessError("请先登录 Study Log。", 401);
    const id = new URL(request.url).searchParams.get("request");
    if (id) {
      const row = await findAgentRequest(agentDatabase(), id);
      if (row.user_id && row.user_id !== user.userId) throw new AgentAccessError("该请求已由其他账户处理。", 409);
      return agentJson({ request: publicGrant(row), status: grantState(row) });
    }
    return agentJson({ grants: await listAgentGrants(agentDatabase(), user.userId) });
  } catch (error) { return agentError(error); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await getChatGPTUser();
    if (!user) throw new AgentAccessError("请先登录 Study Log。", 401);
    const body = await agentBody(request);
    if (typeof body.id !== "string" || !/^[a-f0-9]{32}$/.test(body.id)) throw new AgentAccessError("请选择有效的连接请求。");
    if (body.action === "approve") return agentJson(await grantToUser(agentDatabase(), body.id, user.userId));
    if (body.action === "revoke") { await revokeAgentGrant(agentDatabase(), body.id, user.userId); return agentJson({ status: "revoked" }); }
    throw new AgentAccessError("请选择授权或撤销授权。");
  } catch (error) { return agentError(error); }
}
