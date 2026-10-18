import assert from "node:assert/strict";
import test from "node:test";
import { GRAPH_CARD_WIDTH as W, GRAPH_CARD_HEIGHT as H, layoutProjectGraph } from "../lib/project-graph-layout.ts";

const project = (id, extra = {}) => ({ id, sort_order: id, is_foundation: false, ...extra });
const edge = (from, to) => ({ from_project_id: from, to_project_id: to });
const node = (graph, id) => graph.nodes.find((n) => n.project.id === id);
function assertGeometry(graph, count) {
  assert.equal(graph.nodes.length, count);
  assert.equal(new Set(graph.nodes.map((n) => n.project.id)).size, count);
  for (const n of graph.nodes) {
    assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y));
    assert.ok(n.x >= 0 && n.y >= 70 && n.x + W <= graph.width && n.y + H <= graph.height);
  }
  for (let a = 0; a < graph.nodes.length; a++) for (let b = a + 1; b < graph.nodes.length; b++) {
    const p = graph.nodes[a], q = graph.nodes[b];
    assert.ok(p.x + W <= q.x || q.x + W <= p.x || p.y + H <= q.y || q.y + H <= p.y, `overlap: ${p.project.id}, ${q.project.id}`);
  }
  for (const e of graph.edges) {
    assert.ok(node(graph, e.from_project_id).x < node(graph, e.to_project_id).x);
    assert.ok(!/NaN|Infinity/.test(e.path));
  }
}

// Evaluate every curve, rather than just checking its control points.
function assertRoutesClear(graph) {
  for (const e of graph.edges) {
    const numbers = e.path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);
    let from = { x: numbers[0], y: numbers[1] };
    for (let i = 2; i < numbers.length; i += 6) {
      const [ax, ay, bx, by, x, y] = numbers.slice(i, i + 6);
      for (let t = 0.025; t < 1; t += 0.025) {
        const u = 1 - t;
        const px = u ** 3 * from.x + 3 * u ** 2 * t * ax + 3 * u * t ** 2 * bx + t ** 3 * x;
        const py = u ** 3 * from.y + 3 * u ** 2 * t * ay + 3 * u * t ** 2 * by + t ** 3 * y;
        for (const n of graph.nodes) {
          if (n.project.id === e.from_project_id || n.project.id === e.to_project_id) continue;
          assert.ok(!(px > n.x - 8 && px < n.x + W + 8 && py > n.y - 8 && py < n.y + H + 8), `edge ${e.from_project_id}->${e.to_project_id} approaches card ${n.project.id}`);
        }
      }
      from = { x, y };
    }
  }
}

test("only manually selected foundations occupy the left zone", () => {
  const g = layoutProjectGraph([project(1, { is_foundation: true }), project(2), project(3)], [edge(1, 2)]);
  assert.equal(node(g, 1).x, 32);
  assert.ok(node(g, 2).x >= 380 && node(g, 3).x >= 380);
  assertGeometry(g, 3);
});

test("new dependencies automatically rearrange the graph", () => {
  const p = [project(1), project(2), project(3)];
  const before = layoutProjectGraph(p, [edge(1, 2)]);
  const after = layoutProjectGraph(p, [edge(1, 2), edge(2, 3)]);
  assert.ok(node(after, 3).x > node(after, 2).x);
  assert.notDeepEqual(node(before, 3), node(after, 3));
  assertGeometry(after, 3);
  assertRoutesClear(after);
});

test("parallel branches are reordered to avoid avoidable crossings", () => {
  const g = layoutProjectGraph([1, 2, 3, 4].map((id) => project(id)), [edge(1, 4), edge(2, 3)]);
  assert.ok((node(g, 1).y - node(g, 2).y) * (node(g, 4).y - node(g, 3).y) > 0);
  assertGeometry(g, 4);
});

test("long dependencies route around intermediate cards", () => {
  const g = layoutProjectGraph([1, 2, 3, 4, 5].map((id) => project(id)), [edge(1, 2), edge(2, 3), edge(3, 4), edge(1, 4), edge(2, 5)]);
  assertGeometry(g, 5);
  assertRoutesClear(g);
});

test("unconnected projects are packed without creating another zone", () => {
  const g = layoutProjectGraph(Array.from({ length: 18 }, (_, i) => project(i + 1)), []);
  assertGeometry(g, 18);
  assert.ok(g.nodes.every((n) => n.x >= 380));
  assert.ok(new Set(g.nodes.map((n) => n.x)).size > 1);
  assert.ok(g.height < 18 * H / 2);
});

test("layout is deterministic, handles empty data, and ignores stale edges", () => {
  assertGeometry(layoutProjectGraph([], []), 0);
  const p = [project(1), project(2), project(3, { is_foundation: true })];
  const e = [edge(3, 1), edge(1, 2)];
  assert.deepEqual(layoutProjectGraph(p, e), layoutProjectGraph([...p].reverse(), [...e].reverse()));
  assert.deepEqual(layoutProjectGraph(p, [...e, edge(1, 2), edge(1, 1), edge(1, 99)]), layoutProjectGraph(p, e));
});

test("branching DAGs remain bounded and collision free", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const p = Array.from({ length: 24 }, (_, i) => project(i + 1, { is_foundation: i < 2 }));
    const e = [];
    for (let from = 1; from <= 24; from++) for (let to = Math.max(3, from + 1); to <= 24; to++) {
      if ((from * 17 + to * 31 + seed * 7) % 19 === 0) e.push(edge(from, to));
    }
    const g = layoutProjectGraph(p, e);
    assertGeometry(g, p.length);
    assertRoutesClear(g);
  }
});
