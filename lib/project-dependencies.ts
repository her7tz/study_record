import { env } from "cloudflare:workers";

export type ProjectDependency = {
  from_project_id: number;
  to_project_id: number;
};

function database() {
  if (!env.DB) throw new Error("项目关系数据暂时不可用。");
  return env.DB;
}

export async function listProjectDependencies(userId: string): Promise<ProjectDependency[]> {
  const result = await database().prepare(
    `SELECT d.from_project_id, d.to_project_id
     FROM project_dependencies d
     JOIN projects source ON source.id = d.from_project_id AND source.user_id = d.user_id AND source.deleted_at IS NULL
     JOIN projects target ON target.id = d.to_project_id AND target.user_id = d.user_id AND target.deleted_at IS NULL
     WHERE d.user_id = ?
     ORDER BY d.from_project_id, d.to_project_id`,
  ).bind(userId).all<ProjectDependency>();
  return result.results.map((edge) => ({
    from_project_id: Number(edge.from_project_id),
    to_project_id: Number(edge.to_project_id),
  }));
}

export async function replaceProjectDependencies(userId: string, projectId: number, prerequisiteIds: number[], isFoundation: boolean) {
  const db = database();
  if (!Array.isArray(prerequisiteIds) || typeof isFoundation !== "boolean" || prerequisiteIds.length > 100 || prerequisiteIds.some((id) => !Number.isInteger(id) || id < 1) || new Set(prerequisiteIds).size !== prerequisiteIds.length || prerequisiteIds.includes(projectId) || (isFoundation && prerequisiteIds.length > 0)) {
    return { ok: false as const, reason: "前置项目列表无效。" };
  }

  const target = await db.prepare(
    "SELECT id FROM projects WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
  ).bind(projectId, userId).first<{ id: number }>();
  if (!target) return { ok: false as const, reason: "项目不存在。" };

  if (prerequisiteIds.length) {
    const placeholders = prerequisiteIds.map(() => "?").join(", ");
    const owned = await db.prepare(
      `SELECT id FROM projects WHERE user_id = ? AND deleted_at IS NULL AND id IN (${placeholders})`,
    ).bind(userId, ...prerequisiteIds).all<{ id: number }>();
    if (owned.results.length !== prerequisiteIds.length) return { ok: false as const, reason: "前置项目中包含无效项目。" };
  }

  const existing = await db.prepare(
    "SELECT from_project_id, to_project_id FROM project_dependencies WHERE user_id = ? AND to_project_id != ?",
  ).bind(userId, projectId).all<ProjectDependency>();
  const edges = [
    ...existing.results,
    ...prerequisiteIds.map((fromProjectId) => ({ from_project_id: fromProjectId, to_project_id: projectId })),
  ];
  const adjacency = new Map<number, number[]>();
  const indegree = new Map<number, number>();
  const nodeIds = new Set<number>([projectId, ...prerequisiteIds]);
  for (const edge of edges) {
    nodeIds.add(Number(edge.from_project_id));
    nodeIds.add(Number(edge.to_project_id));
    adjacency.set(Number(edge.from_project_id), [...(adjacency.get(Number(edge.from_project_id)) || []), Number(edge.to_project_id)]);
    indegree.set(Number(edge.to_project_id), (indegree.get(Number(edge.to_project_id)) || 0) + 1);
    if (!indegree.has(Number(edge.from_project_id))) indegree.set(Number(edge.from_project_id), 0);
  }
  const queue = [...nodeIds].filter((id) => (indegree.get(id) || 0) === 0);
  let visited = 0;
  while (queue.length) {
    const current = queue.shift()!;
    visited += 1;
    for (const next of adjacency.get(current) || []) {
      const nextDegree = (indegree.get(next) || 0) - 1;
      indegree.set(next, nextDegree);
      if (nextDegree === 0) queue.push(next);
    }
  }
  if (visited !== nodeIds.size) return { ok: false as const, reason: "这条依赖会形成循环，请调整前置项目。" };

  await db.batch([
    db.prepare("DELETE FROM project_dependencies WHERE user_id = ? AND to_project_id = ?").bind(userId, projectId),
    db.prepare("UPDATE projects SET is_foundation = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND deleted_at IS NULL").bind(isFoundation ? 1 : 0, projectId, userId),
    ...prerequisiteIds.map((fromProjectId) => db.prepare(
      "INSERT INTO project_dependencies (user_id, from_project_id, to_project_id) VALUES (?, ?, ?)",
    ).bind(userId, fromProjectId, projectId)),
  ]);
  return { ok: true as const, edges: await listProjectDependencies(userId) };
}
