import { GraphEdge, GraphNode, PathResult } from './types';

interface AdjacencyEdge {
  to: string;
  edgeId: string;
  lengthM: number;
  isAccessible: boolean;
  weight: number; // «Привлекательность» пути (штрафы и бонусы среды)
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

    // Умные веса: люди выбирают логичные маршруты, а не геометрически короткие.
    // Пешеход не ходит по проезжей части: голая дорога без тротуаров —
    // заградительный штраф, переход — только по зебрам.
    let weight = e.lengthM;
    if (e.type === 'road') {
      if (!e.hasSidewalkLeft && !e.hasSidewalkRight) weight *= 25.0; // пешеходу туда нельзя
      else weight *= 1.05; // дорога с тротуаром: комфортно, но улицу переходим в створах
    } else if (e.type === 'sidewalk') {
      weight *= 0.85; // выделенный тротуар приоритетнее дороги
    } else if (e.type === 'park_path') {
      weight *= 0.7; // скверы и парковые дорожки притягивают пешеходов
    } else if (e.type === 'crossing') {
      weight *= 0.25; // зебра — самый приоритетный способ пересечь проезжую часть
    } else if (e.type === 'underpass') {
      weight *= 1.8; // лестницы неудобны, но безопасны
    }

    adj.get(e.from)?.push({ to: e.to, edgeId: e.id, lengthM: e.lengthM, isAccessible: e.isAccessible, weight });
    adj.get(e.to)?.push({ to: e.from, edgeId: e.id, lengthM: e.lengthM, isAccessible: e.isAccessible, weight });
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
  const prev = new Map<string, { node: string; isAccessible: boolean; physicalLengthM: number }>();
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
      const alt = shortestDist + edge.weight; // поиск — по привлекательности
      if (alt < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, alt);
        // Физическую длину сохраняем отдельно — в ответ идут честные метры.
        prev.set(edge.to, { node: closestNode, isAccessible: edge.isAccessible, physicalLengthM: edge.lengthM });
      }
    }
  }
  const targetDist = dist.get(targetNodeId);
  if (targetDist === undefined || targetDist === Infinity) return null;
  const path: string[] = [targetNodeId];
  let curr = targetNodeId;
  let allAccessible = true;
  let totalPhysicalM = 0; // сумма реальных метров вдоль найденного пути
  while (curr !== startNodeId) {
    const step = prev.get(curr);
    if (!step) break;
    if (!step.isAccessible) allAccessible = false;
    totalPhysicalM += step.physicalLengthM;
    curr = step.node;
    path.unshift(curr);
  }
  return {
    fromNodeId: startNodeId,
    toNodeId: targetNodeId,
    distanceM: Math.round(totalPhysicalM),
    timeMinutes: Number((totalPhysicalM / 75).toFixed(1)),
    pathNodeIds: path,
    isFullyAccessible: allAccessible,
  };
}
