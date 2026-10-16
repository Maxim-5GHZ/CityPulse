// Кейс 03 — сид P0. Граф СИНТЕТИЧЕСКИЙ поверх реальных коробок:
// гарантирует M1/M2, до/после, seed+hash (см. AGENTS.md).
// 12 узлов, 5 домов (80–240 жит.), остановка + парк (+школа опц.).
// Координаты фиксированы через seed — «возврат = те же цифры».
import type { CEdge, CNode, DistrictModel } from './model';

export const SEED = 2040;

const NODES: CNode[] = [
  { id: 'n1', x: 120, y: 820 },
  { id: 'n2', x: 300, y: 820 },
  { id: 'n3', x: 480, y: 820 },
  { id: 'n4', x: 660, y: 820 },
  { id: 'n5', x: 840, y: 820 },
  { id: 'n6', x: 120, y: 560 },
  { id: 'n7', x: 330, y: 560 },
  { id: 'n8', x: 560, y: 560 },
  { id: 'n9', x: 800, y: 560 },
  { id: 'n10', x: 200, y: 300 },
  { id: 'n11', x: 500, y: 300 },
  { id: 'n12', x: 780, y: 300 },
];

function len(a: CNode, b: CNode): number {
  return Math.round(Math.hypot(b.x - a.x, b.y - a.y) * 10) / 10;
}

const byId = new Map(NODES.map((n) => [n.id, n]));
function edge(id: string, a: string, b: string, type: CEdge['type']): CEdge {
  const A = byId.get(a)!;
  const B = byId.get(b)!;
  return { id, a, b, length: len(A, B), type };
}

const EDGES: CEdge[] = [
  edge('e01', 'n1', 'n2', 'trotuar'),
  edge('e02', 'n2', 'n3', 'trotuar'),
  edge('e03', 'n3', 'n4', 'trotuar'),
  edge('e04', 'n4', 'n5', 'trotuar'),
  edge('e05', 'n6', 'n7', 'trotuar'),
  edge('e06', 'n7', 'n8', 'trotuar'),
  edge('e07', 'n8', 'n9', 'trotuar'),
  edge('e08', 'n10', 'n11', 'trotuar'),
  edge('e09', 'n11', 'n12', 'trotuar'),
  edge('e10', 'n1', 'n6', 'trotuar'),
  edge('e11', 'n2', 'n7', 'perehod'),
  edge('e12', 'n4', 'n9', 'trotuar'),
  edge('e13', 'n6', 'n10', 'trotuar'),
  edge('e14', 'n7', 'n11', 'perehod'),
  edge('e15', 'n8', 'n11', 'trotuar'),
  edge('e16', 'n9', 'n12', 'trotuar'),
];

/** Пустой каркас сида: здания подтянутся из OSM-кэша через osm.ts (реальные коробки). */
export function seedModel(): DistrictModel {
  return {
    seed: SEED,
    nodes: NODES.map((n) => ({ ...n })),
    edges: EDGES.map((e) => ({ ...e })),
    houses: [
      { id: 'h1', nodeId: 'n1', residents: 240, label: 'Дом 1' },
      { id: 'h2', nodeId: 'n3', residents: 180, label: 'Дом 2' },
      { id: 'h3', nodeId: 'n5', residents: 120, label: 'Дом 3' },
      { id: 'h4', nodeId: 'n10', residents: 200, label: 'Дом 4' },
      { id: 'h5', nodeId: 'n12', residents: 80, label: 'Дом 5' },
    ],
    attractions: [
      { id: 'a1', nodeId: 'n7', kind: 'ostanovka', label: 'Остановка «Центр»' },
      { id: 'a2', nodeId: 'n11', kind: 'park', label: 'Парк' },
      { id: 'a3', nodeId: 'n6', kind: 'shkola', label: 'Школа' },
    ],
    buildings: [],
    greens: [{ id: 'g1', polygon: [[420, 200], [600, 200], [600, 380], [420, 380]], porosity: 0.6, label: 'Сквер' }],
  };
}
