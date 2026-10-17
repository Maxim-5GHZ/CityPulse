import { DistrictScenario, GraphEdge, GraphNode } from './types';
import { uniqueStamp } from './ids';

/** Радиус кольца в метрах CAD-сетки (1 ед = 1 м). */
export const RING_RADIUS = 26;

/** Шаг разбиения дуги на сегменты (градусы) — хорды незаметны, Дейкстра и трафик идут по дуге. */
const ARC_STEP_DEG = 15;

export type RoundaboutPlan =
  | { ok: true; nodes: GraphNode[]; edges: GraphEdge[] }
  | { ok: false; error: string };

/**
 * Перестройка графа под кольцевое движение вокруг узла centerId.
 * Примыкающие автодороги обрезаются до точек-съездов на окружности,
 * съезды соединяются дуговыми рёбрами (type 'road', isRoundabout).
 * Не меняет переданный сценарий, возвращает новые массивы узлов и рёбер.
 */
export function planRoundabout(scenario: DistrictScenario, centerId: string): RoundaboutPlan {
  const center = scenario.nodes.find((n) => n.id === centerId);
  if (!center) return { ok: false, error: 'Узел не найден' };
  if (center.type === 'roundabout' || center.isRoundabout) {
    return { ok: false, error: 'Кольцо здесь уже построено' };
  }

  const stamp = uniqueStamp();
  const nodeMap = new Map(scenario.nodes.map((n) => [n.id, n] as const));

  // Активные автодороги, примыкающие к центру.
  const incident = scenario.edges.filter(
    (e) =>
      e.type === 'road' &&
      e.isActive &&
      !e.isRoundabout &&
      (e.from === centerId || e.to === centerId),
  );
  if (incident.length < 3) {
    return { ok: false, error: `Для кольца нужно ≥3 примыкающих дороги (сейчас: ${incident.length})` };
  }

  const newNodes: GraphNode[] = [
    { ...center, type: 'roundabout', isCustom: true, isRoundabout: true },
  ];
  const newEdges: GraphEdge[] = [];

  interface Exit {
    angle: number;
    node: GraphNode;
  }
  const exits: Exit[] = [];

  // Годными считаем только примыкания длиной ≥ RING_RADIUS+4: короткое ребро
  // нельзя обрезать до съезда, поэтому оно остаётся в графе как было
  // (раньше такие рёбра молча удалялись вместе с остальными примыканиями).
  const usable = incident.filter((edge) => {
    const otherId = edge.from === centerId ? edge.to : edge.from;
    const other = nodeMap.get(otherId);
    if (!other) return false;
    return Math.hypot(other.x - center.x, other.y - center.y) >= RING_RADIUS + 4;
  });
  const removedEdgeIds = new Set(usable.map((e) => e.id));

  if (usable.length < 3) {
    const shortCount = incident.length - usable.length;
    return {
      ok: false,
      error:
        shortCount > 0
          ? `Для кольца нужно ≥3 примыкающих дороги длиной от ${RING_RADIUS + 4} м (годных: ${usable.length}, слишком коротких: ${shortCount})`
          : `Для кольца нужно ≥3 примыкающих дороги (сейчас: ${incident.length})`,
    };
  }

  usable.forEach((edge, i) => {
    const otherId = edge.from === centerId ? edge.to : edge.from;
    const other = nodeMap.get(otherId);
    if (!other) return;
    const dx = other.x - center.x;
    const dy = other.y - center.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const px = Math.round(center.x + Math.cos(angle) * RING_RADIUS);
    const py = Math.round(center.y + Math.sin(angle) * RING_RADIUS);

    const exitNode: GraphNode = {
      id: `re-${stamp}-${i}`,
      x: px,
      y: py,
      label: 'Съезд кольца',
      type: 'intersection',
      isCustom: true,
      isRoundabout: true,
    };
    newNodes.push(exitNode);
    exits.push({ angle, node: exitNode });

    // Обрезанное примыкание: от внешней точки до съезда, длина — пропорционально.
    const ratio = Math.hypot(other.x - px, other.y - py) / dist;
    newEdges.push({
      ...edge,
      id: `re-entry-${stamp}-${i}`,
      from: otherId,
      to: exitNode.id,
      lengthM: Math.max(10, Math.round(edge.lengthM * ratio)),
      isCustom: true,
      // Обрезок наследует полосы/тротуары исходного примыкания — не оплачиваются.
      inheritedLanes: true,
      inheritedSidewalkLeft: true,
      inheritedSidewalkRight: true,
    });
  });

  // Годных примыканий уже проверено ≥3 — съездов хватит на кольцо.

  // Дуги между соседними съездами по углу.
  const sorted = [...exits].sort((a, b) => a.angle - b.angle);
  sorted.forEach((exit, i) => {
    const next = sorted[(i + 1) % sorted.length];
    let arc = next.angle - exit.angle;
    if (arc <= 0) arc += Math.PI * 2;
    const segments = Math.max(1, Math.round((arc * 180) / Math.PI / ARC_STEP_DEG));
    let prevId = exit.node.id;
    for (let s = 1; s <= segments; s++) {
      const a = exit.angle + (arc * s) / segments;
      const isLast = s === segments;
      const segNodeId = isLast ? next.node.id : `ra-${stamp}-${i}-${s}`;
      if (!isLast) {
        newNodes.push({
          id: segNodeId,
          x: Math.round(center.x + Math.cos(a) * RING_RADIUS),
          y: Math.round(center.y + Math.sin(a) * RING_RADIUS),
          label: 'Дуга кольца',
          type: 'intersection',
          isCustom: true,
          isRoundabout: true,
        });
      }
      const segLen = Math.max(5, Math.round(RING_RADIUS * (arc / segments)));
      newEdges.push({
        id: `ra-e-${stamp}-${i}-${s}`,
        from: prevId,
        to: segNodeId,
        lengthM: segLen,
        type: 'road',
        lanes: 2,
        isActive: true,
        isAccessible: true,
        isRoundabout: true,
        isCustom: true,
      });
      prevId = segNodeId;
    }
  });

  return {
    ok: true,
    nodes: [
      ...scenario.nodes.filter((n) => n.id !== centerId),
      ...newNodes,
    ],
    edges: [...scenario.edges.filter((e) => !removedEdgeIds.has(e.id)), ...newEdges],
  };
}

/** Элемент принадлежит кольцу — снос и переделка запрещены. */
export function isRingEdge(edge: GraphEdge): boolean {
  return edge.isRoundabout === true;
}

/** Узел принадлежит кольцу — снос запрещён. */
export function isRingNode(node: GraphNode): boolean {
  return node.isRoundabout === true || node.type === 'roundabout';
}
