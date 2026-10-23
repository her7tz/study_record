import { agentDatabase } from "@/lib/agent-database";
import { AgentAccessError, agentError, agentJson, requireAgentUser } from "@/lib/agent-access";
import { listRecords } from "@/lib/study-records";
import { listProjects } from "@/lib/projects";
import { listProjectDependencies } from "@/lib/project-dependencies";
import { getStudyAnalytics } from "@/lib/study-analytics";
import { todayString } from "@/lib/date";
export const dynamic = "force-dynamic";
function withoutOwner<T extends { user_id: string }>(row: T) {
  const { user_id: _owner, ...value } = row; return value;
}
export async function GET(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const userId = await requireAgentUser(agentDatabase(), request);
    const { resource } = await context.params;
    const p = new URL(request.url).searchParams;
    if (resource === "projects") return agentJson({ projects: (await listProjects(userId)).map(withoutOwner), dependencies: await listProjectDependencies(userId) });
    if (resource === "analytics") return agentJson({ analytics: await getStudyAnalytics(userId, todayString()) });
    if (resource !== "records") throw new AgentAccessError("没有该只读接口。", 404);
    for (const key of p.keys()) if (!["limit", "offset", "query", "project_id", "from", "to", "record_type"].includes(key)) throw new AgentAccessError("不支持的查询参数。");
    const number = (key: string, fallback: number, min: number, max: number) => {
      const raw = p.get(key); const n = raw === null ? fallback : Number(raw);
      if (!Number.isSafeInteger(n) || n < min || n > max) throw new AgentAccessError(`参数 ${key} 无效。`); return n;
    };
    const date = (key: string) => { const value = p.get(key); if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value)) throw new AgentAccessError("日期无效。"); return value || undefined; };
    const from = date("from"), to = date("to");
    if (from && to && from > to) throw new AgentAccessError("起始日期不能晚于结束日期。");
    const type = p.get("record_type");
    if (type && type !== "learning" && type !== "experiment") throw new AgentAccessError("记录类型无效。");
    if ((p.get("query")?.length || 0) > 200) throw new AgentAccessError("搜索内容过长。");
    const result = await listRecords(userId, { limit: number("limit", 50, 1, 100), offset: number("offset", 0, 0, 10000000),
      query: p.get("query") || undefined, projectId: p.has("project_id") ? number("project_id", 0, 1, Number.MAX_SAFE_INTEGER) : undefined,
      from, to, recordType: type === "learning" || type === "experiment" ? type : undefined });
    return agentJson({ ...result, records: result.records.map(withoutOwner), next_offset: number("offset", 0, 0, 10000000) + result.records.length < result.total ? number("offset", 0, 0, 10000000) + result.records.length : null });
  } catch (error) { return agentError(error); }
}
