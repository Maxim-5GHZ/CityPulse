// Графовая модель конструктора «Обнинск 2040».
// Координаты — в узлах сетки, 1 клетка = 25 метров (см. METERS_PER_CELL).

/** Координаты в узлах сетки. */
export interface GridPoint {
  x: number;
  y: number;
}

export interface GraphNode {
  id: string;
  /** grid coords */
  x: number;
  y: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  /** метры (1 клетка = 25 метров) */
  length: number;
  /** пешеходный переход: снижает сопротивление пути в 3 раза */
  hasCrossing?: boolean;
  /** заблокировано / ремонт: ребро непроходимо */
  blocked?: boolean;
  /** жители, проходящие через ребро в текущей симуляции */
  flowCount?: number;
}

export interface Building {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** условные жители (50–300) */
  residents: number;
  /** ближайшая точка входа в пешеходную сеть */
  nearestNodeId: string;
}

export type POIType = 'BUS_STOP' | 'PARK' | 'SHOP';

export interface POI {
  id: string;
  type: POIType;
  x: number;
  y: number;
  nearestNodeId: string;
  name: string;
}

export interface DistrictState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  buildings: Building[];
  pois: POI[];
}

export interface MetricResult {
  /** взвешенное расстояние до остановки, метры */
  avgDistanceToBus: number;
  /** время при скорости 4.5 км/ч (75 м/мин) */
  avgTimeToBusMin: number;
  /** доля жителей с парком ближе 400 м по графу */
  parkCoveragePercent: number;
  /** дома без пути к инфраструктуре */
  isolatedBuildingsCount: number;
  /** топ-3 самых нагруженных рёбер */
  bottleneckEdgeIds: string[];
}

/** Инструменты конструктора. */
export type UrbanTool =
  | 'road'
  | 'crossing'
  | 'house'
  | 'stop'
  | 'park'
  | 'delete';

/** Метры в одной клетке сетки. */
export const METERS_PER_CELL = 25;

/** Метров в минуту при 4.5 км/ч. */
export const METERS_PER_MIN = 75;

/** Порог доступности парка по графу, метры. */
export const PARK_RADIUS_M = 400;

/** Переход снижает сопротивление пути в N раз. */
export const CROSSING_FACTOR = 3;
