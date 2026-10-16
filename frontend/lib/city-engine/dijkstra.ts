import { GraphEdge, GraphNode, PathResult } from './types';

interface AdjacencyEdge {
  to: string;
  edgeId: string;
  lengthM: number;
  isAccessible: boolean;
}

export function buildAdjacency(
  nodes: GraphNode[],
  edges: GraphEdge[],
  mobilityOnly = false,
): Map<string, AdjacencyEdge[]> {
  const adj = new Map<string, AdjacencyEdge[]>();
  for (const n of nodes) {
    adj.set(n.id, []);
  }
  for (const e of edges) {
    if (!e.isActive) continue;
    if (mobilityOnly && !e.isAccessible) continue;
    adj.get(e.from)?.push({ to: e.to, edgeId: e.id, lengthM: e.lengthM, isAccessible: e.isAccessible });
    adj.get(e.to)?.push({ to: e.from, edgeId: e.id, lengthM: e.lengthM, isAccessible: e.isAccessible });
  }
  return adj;
}

export function findShortestPath(
  startNodeId: string,
  targetNodeId: string,
  adj: Map<string, AdjacencyEdge[]>,
): PathResult | null {
  if (startNodeId === targetNodeId) {
    return { fromNodeId: startNodeId, toNodeId: targetNodeId, distanceM: 0, timeMinutes: 0, pathNodeIds: [startNodeId], isFullyAccessible: true };
  }
  const dist = new Map<string, number>();
  const prev = new Map<string, { node: string; isAccessible: boolean }>();
  const visited = new Set<string>();
  dist.set(startNodeId, 0);
  while (true) {
    let closestNode: string | null = null;
    let shortestDist = Infinity;
    dist.forEach((d, node) => {
      if (!visited.has(node) && d < shortestDist) {
        shortestDist = d;
        closestNode = node;
      }
    });
    if (!closestNode || shortestDist === Infinity) break;
    if (closestNode === targetNodeId) break;
    visited.add(closestNode);
    const neighbors = adj.get(closestNode as string) ?? [];
    for (let i = 0; i < neighbors.length; i++) {
      const edge = neighbors[i];
      if (visited.has(edge.to)) continue;
      const alt = shortestDist + edge.lengthM;
      if (alt < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, alt);
        prev.set(edge.to, { node: closestNode, isAccessible: edge.isAccessible });
      }
    }
  }
  const targetDist = dist.get(targetNodeId);
  if (targetDist === undefined || targetDist === Infinity) return null;
  const path: string[] = [targetNodeId];
  let curr = targetNodeId;
  let allAccessible = true;
  while (curr !== startNodeId) {
    const step = prev.get(curr);
    if (!step) break;
    if (!step.isAccessible) allAccessible = false;
    curr = step.node;
    path.unshift(curr);
  }
  return {
    fromNodeId: startNodeId,
    toNodeId: targetNodeId,
    distanceM: Math.round(targetDist),
    timeMinutes: Number((targetDist / 75).toFixed(1)),
    pathNodeIds: path,
    isFullyAccessible: allAccessible,
  };
}
