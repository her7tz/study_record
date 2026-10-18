import type { StudyProject } from "./project-model";
import type { ProjectDependency } from "./project-dependencies";

export const GRAPH_CARD_WIDTH = 262;
export const GRAPH_CARD_HEIGHT = 164;
const COLUMN_GAP = 96;
const ROW_GAP = 40;
const MAIN_X = 380;
const TOP = 82;

type Vertex = { key: string; rank: number; height: number; project?: StudyProject };
type Point = { x: number; y: number };
export type ProjectGraphNode = Point & { project: StudyProject };
export type ProjectGraphEdge = ProjectDependency & { path: string };

// Invisible routing vertices keep long dependencies out of intermediate cards.
// Barycentric sweeps then reduce crossings without adding visible levels or zones.
export function layoutProjectGraph(projects: StudyProject[], dependencies: ProjectDependency[]) {
  const ordered = [...projects].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const byId = new Map(ordered.map((p) => [p.id, p]));
  const edgeKeys = new Set<string>();
  const validEdges = dependencies.filter((edge) => {
    const key = `${edge.from_project_id}:${edge.to_project_id}`;
    if (!byId.has(edge.from_project_id) || !byId.has(edge.to_project_id) || edge.from_project_id === edge.to_project_id || edgeKeys.has(key)) return false;
    edgeKeys.add(key);
    return true;
  }).sort((a, b) => a.from_project_id - b.from_project_id || a.to_project_id - b.to_project_id);
  const incoming = new Map(ordered.map((p) => [p.id, [] as number[]]));
  const outgoing = new Map(ordered.map((p) => [p.id, [] as number[]]));
  for (const edge of validEdges) {
    incoming.get(edge.to_project_id)!.push(edge.from_project_id);
    outgoing.get(edge.from_project_id)!.push(edge.to_project_id);
  }
  const indegree = new Map(ordered.map((p) => [p.id, incoming.get(p.id)!.length]));
  const rank = new Map(ordered.map((p) => [p.id, p.is_foundation ? 0 : 1]));
  const queue = ordered.filter((p) => indegree.get(p.id) === 0).map((p) => p.id);
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index];
    for (const next of outgoing.get(id)!) {
      if (!byId.get(next)!.is_foundation) rank.set(next, Math.max(rank.get(next)!, rank.get(id)! + 1));
      indegree.set(next, indegree.get(next)! - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }

  const isolated = ordered.filter((p) => !p.is_foundation && !incoming.get(p.id)!.length && !outgoing.get(p.id)!.length);
  const isolatedIds = new Set(isolated.map((p) => p.id));
  const layers: Vertex[][] = [[]];
  const vertices = new Map<string, Vertex>();
  function add(vertex: Vertex) {
    (layers[vertex.rank] ||= []).push(vertex);
    vertices.set(vertex.key, vertex);
  }
  ordered.filter((p) => !isolatedIds.has(p.id)).forEach((project) => add({ key: `p${project.id}`, rank: rank.get(project.id)!, height: GRAPH_CARD_HEIGHT, project }));
  const paths = validEdges.flatMap((edge) => {
    const from = rank.get(edge.from_project_id)!;
    const to = rank.get(edge.to_project_id)!;
    // The server prevents cycles; ignore invalid backward edges defensively.
    if (to <= from) return [];
    const keys = [`p${edge.from_project_id}`];
    for (let layer = from + 1; layer < to; layer++) {
      const key = `e${edge.from_project_id}:${edge.to_project_id}:${layer}`;
      add({ key, rank: layer, height: 8 });
      keys.push(key);
    }
    keys.push(`p${edge.to_project_id}`);
    return [{ ...edge, keys }];
  });
  for (let i = 0; i < layers.length; i++) layers[i] ||= [];
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  for (const path of paths) for (let i = 1; i < path.keys.length; i++) {
    const from = path.keys[i - 1], to = path.keys[i];
    parents.set(to, [...(parents.get(to) || []), from]);
    children.set(from, [...(children.get(from) || []), to]);
  }
  function orders() {
    return new Map(layers.flatMap((layer) => layer.map((vertex, index) => [vertex.key, index] as const)));
  }
  function crossingCount() {
    const position = orders();
    let count = 0;
    for (let rankIndex = 1; rankIndex < layers.length; rankIndex++) {
      const links = layers[rankIndex].flatMap((vertex) => (parents.get(vertex.key) || []).map((key) => [position.get(key)!, position.get(vertex.key)!]));
      links.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      // Count inversions with a Fenwick tree, including large dependency sets.
      const tree = new Array(layers[rankIndex].length + 2).fill(0);
      let seen = 0;
      for (const [, target] of links) {
        let before = 0;
        for (let i = target + 1; i > 0; i -= i & -i) before += tree[i];
        count += seen++ - before;
        for (let i = target + 1; i < tree.length; i += i & -i) tree[i]++;
      }
    }
    return count;
  }
  let best = layers.map((layer) => [...layer]);
  let bestCrossings = crossingCount();
  for (let sweep = 0; sweep < 8; sweep++) {
    const forward = sweep % 2 === 0;
    const start = forward ? 1 : layers.length - 2;
    const end = forward ? layers.length : -1;
    const step = forward ? 1 : -1;
    for (let r = start; r !== end; r += step) {
      const position = orders();
      const neighbors = forward ? parents : children;
      const barycenter = (vertex: Vertex) => {
        const connected = neighbors.get(vertex.key) || [];
        return connected.length ? connected.reduce((sum, key) => sum + position.get(key)!, 0) / connected.length : position.get(vertex.key)!;
      };
      layers[r].sort((a, b) => barycenter(a) - barycenter(b) || position.get(a.key)! - position.get(b.key)!);
    }
    const crossings = crossingCount();
    if (crossings < bestCrossings) { bestCrossings = crossings; best = layers.map((layer) => [...layer]); }
  }
  layers.splice(0, layers.length, ...best);

  const layerHeight = (layer: Vertex[]) => layer.reduce((height, vertex) => height + vertex.height, 0) + Math.max(0, layer.length - 1) * ROW_GAP;
  const tallest = Math.max(0, ...layers.map(layerHeight));
  const centers = new Map<string, number>();
  for (const layer of layers) {
    let y = (tallest - layerHeight(layer)) / 2;
    for (const vertex of layer) { centers.set(vertex.key, y + vertex.height / 2); y += vertex.height + ROW_GAP; }
  }
  // Align connected cards vertically, while preserving order and minimum spacing.
  for (let sweep = 0; sweep < 6; sweep++) {
    const forward = sweep % 2 === 0;
    const sequence = forward ? layers : [...layers].reverse();
    const neighbors = forward ? parents : children;
    for (const layer of sequence) {
      const desired = layer.map((vertex) => {
        const connected = neighbors.get(vertex.key) || [];
        return connected.length ? connected.reduce((sum, key) => sum + centers.get(key)!, 0) / connected.length : centers.get(vertex.key)!;
      });
      let bottom = -ROW_GAP;
      const packed = layer.map((vertex, i) => {
        const top = Math.max(bottom + ROW_GAP, desired[i] - vertex.height / 2);
        bottom = top + vertex.height;
        return top + vertex.height / 2;
      });
      const shift = layer.length ? Math.min(packed[0] - layer[0].height / 2, packed.reduce((sum, center, i) => sum + center - desired[i], 0) / layer.length) : 0;
      layer.forEach((vertex, i) => centers.set(vertex.key, packed[i] - shift));
    }
  }
  const xForRank = (r: number) => r === 0 ? 32 : MAIN_X + (r - 1) * (GRAPH_CARD_WIDTH + COLUMN_GAP);
  const nodes: ProjectGraphNode[] = [];
  for (const layer of layers) for (const vertex of layer) {
    if (vertex.project) nodes.push({ project: vertex.project, x: xForRank(vertex.rank), y: TOP + centers.get(vertex.key)! - GRAPH_CARD_HEIGHT / 2 });
  }
  const connectedBottom = Math.max(TOP, ...layers.slice(1).flatMap((layer) => layer.map((vertex) => TOP + centers.get(vertex.key)! + vertex.height / 2 + ROW_GAP)));
  // Unconnected projects share the main canvas in a compact grid, without a zone.
  const looseColumns = Math.min(3, Math.max(1, isolated.length));
  isolated.forEach((project, index) => nodes.push({ project, x: MAIN_X + (index % looseColumns) * (GRAPH_CARD_WIDTH + COLUMN_GAP), y: connectedBottom + Math.floor(index / looseColumns) * (GRAPH_CARD_HEIGHT + ROW_GAP) }));
  const positions = new Map(nodes.map((node) => [node.project.id, node]));
  const sourcePorts = new Map<number, typeof paths>();
  const targetPorts = new Map<number, typeof paths>();
  for (const path of paths) {
    sourcePorts.set(path.from_project_id, [...(sourcePorts.get(path.from_project_id) || []), path]);
    targetPorts.set(path.to_project_id, [...(targetPorts.get(path.to_project_id) || []), path]);
  }
  for (const links of sourcePorts.values()) links.sort((a, b) => positions.get(a.to_project_id)!.y - positions.get(b.to_project_id)!.y || a.to_project_id - b.to_project_id);
  for (const links of targetPorts.values()) links.sort((a, b) => positions.get(a.from_project_id)!.y - positions.get(b.from_project_id)!.y || a.from_project_id - b.from_project_id);
  function portOffset(links: typeof paths, path: typeof paths[number]) {
    return links.length < 2 ? 0 : -24 + 48 * links.indexOf(path) / (links.length - 1);
  }
  const edges: ProjectGraphEdge[] = paths.map((path) => {
    const source = positions.get(path.from_project_id)!, target = positions.get(path.to_project_id)!;
    const points: Point[] = [{ x: source.x + GRAPH_CARD_WIDTH, y: source.y + GRAPH_CARD_HEIGHT / 2 + portOffset(sourcePorts.get(path.from_project_id)!, path) }];
    for (const key of path.keys.slice(1, -1)) {
      const vertex = vertices.get(key)!;
      const x = xForRank(vertex.rank), y = TOP + centers.get(key)!;
      points.push({ x: x - 12, y }, { x: x + GRAPH_CARD_WIDTH + 12, y });
    }
    points.push({ x: target.x, y: target.y + GRAPH_CARD_HEIGHT / 2 + portOffset(targetPorts.get(path.to_project_id)!, path) });
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const from = points[i - 1], to = points[i], curve = (to.x - from.x) / 2;
      d += ` C ${from.x + curve} ${from.y}, ${to.x - curve} ${to.y}, ${to.x} ${to.y}`;
    }
    return { from_project_id: path.from_project_id, to_project_id: path.to_project_id, path: d };
  });
  const width = Math.max(760, ...nodes.map((node) => node.x + GRAPH_CARD_WIDTH + 32));
  const height = Math.max(350, ...nodes.map((node) => node.y + GRAPH_CARD_HEIGHT + 32), ...[...centers.values()].map((y) => TOP + y + 32));
  return { nodes, edges, width, height };
}
