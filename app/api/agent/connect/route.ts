import { agentDatabase } from "@/lib/agent-database";
import { agentBody, agentError, agentJson, startAgentRequest } from "@/lib/agent-access";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const body = await agentBody(request);
    const connection = await startAgentRequest(agentDatabase(), body.token_hash, body.client_name, request.headers.get("cf-connecting-ip") || "local");
    return agentJson({ ...connection, authorization_path: `/agent-access?request=${connection.id}`, poll_interval: 5 }, 201);
  } catch (error) { return agentError(error); }
}
