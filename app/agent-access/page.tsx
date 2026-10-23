import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { AgentAccessPanel } from "@/components/agent-access-panel";
export const dynamic = "force-dynamic";
export default async function AgentAccessPage({ searchParams }: { searchParams: Promise<{ request?: string }> }) {
  const { request } = await searchParams;
  const id = typeof request === "string" && /^[a-f0-9]{32}$/.test(request) ? request : undefined;
  const user = await requireChatGPTUser(`/agent-access${id ? `?request=${id}` : ""}`);
  return <AgentAccessPanel email={user.email} requestId={id} />;
}
