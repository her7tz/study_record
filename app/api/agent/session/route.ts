import { agentDatabase } from "@/lib/agent-database";
import { agentError, agentJson, bearerGrant, publicGrant, unixNow } from "@/lib/agent-access";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { return agentJson(publicGrant(await bearerGrant(agentDatabase(), request))); }
  catch (error) { return agentError(error); }
}
// The Agent can discard its own grant, never change learning data.
export async function DELETE(request: Request) {
  try {
    const grant = await bearerGrant(agentDatabase(), request);
    await agentDatabase().prepare("UPDATE agent_authorizations SET revoked_at = COALESCE(revoked_at, ?) WHERE id = ?").bind(unixNow(), grant.id).run();
    return agentJson({ status: "revoked" });
  } catch (error) { return agentError(error); }
}
