export type NodeType = 'intersection' | 'bus_stop' | 'park_gate' | 'house_gate' | 'amenity_gate' | 'roundabout';

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  label: string;
  type: NodeType;
  isCustom?: boolean;
  isRoundabout?: boolean; // Узел принадлежит кольцу (съезд/дуга/центр) — снос запрещён
}

export type EdgeType = 'road' | 'sidewalk' | 'crossing' | 'underpass' | 'park_path' | 'bike_lane';

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  lengthM: number;
  type: EdgeType;
  isActive: boolean;
  isAccessible: boolean;
  lanes?: 2 | 4;
  hasSidewalkLeft?: boolean;
  hasSidewalkRight?: boolean;
  isRoundabout?: boolean;
  isCustom?: boolean;
  loadCount?: number; // Нагрузка: сколько жителей проходит по этому ребру
  // Наследованная инфраструктура: полосы/тротуары достались от исходного ребра
  // при разрезе, кольце или ремонте — бюджет за них не платит (только за новое).
  // Любая ручная смена полос/тротуара сбрасывает свой флаг.
  inheritedLanes?: boolean;
  inheritedSidewalkLeft?: boolean;
  inheritedSidewalkRight?: boolean;
}

export interface Building {
  id: string;
  name: string;
  address: string;
  floors: number;
  residentsPerFloor: number;
  residents: number;
  gateNodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  polygon?: { x: number; y: number }[]; // Произвольный полигональный контур
  rotationDeg?: number; // Поворот корпуса вдоль улицы (органичная застройка)
  isCustom?: boolean;
  // Социальный тег корпуса (назначается через ПКМ-меню дома).
  // Тег превращает корпус в точку обслуживания: участвует в покрытии
  // (Дейкстра от gateNodeId, радиус 500) и стоит денег (INFRA_COSTS.tag_*).
  tag?: BuildingTag;
  tagCustom?: boolean; // Тег назначен пользователем (а не пришёл из сейва)
}

// Социальный тег корпуса: назначается ПКМ по дому, снимается пунктом «Жилой».
export type BuildingTag = 'school' | 'police' | 'hospital' | 'shop';

export const BUILDING_TAG_LABEL: Record<BuildingTag, string> = {
  school: 'Школа',
  police: 'Полиция',
  hospital: 'Больница',
  shop: 'Магазин',
};

export const BUILDING_TAGS: BuildingTag[] = ['school', 'police', 'hospital', 'shop'];

export type AmenityType = 'bus_stop' | 'park' | 'mall' | 'school';

export interface Amenity {
  id: string;
  name: string;
  type: AmenityType;
  nodeId: string;
  coverageRadiusM: number;
  polygon?: { x: number; y: number }[]; // Границы кастомного сквера/парка
  isCustom?: boolean;
}

export interface DistrictScenario {
  id: string;
  name: string;
  description: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  buildings: Building[];
  amenities: Amenity[];
}

export interface PathResult {
  fromNodeId: string;
  toNodeId: string;
  distanceM: number;
  timeMinutes: number;
  pathNodeIds: string[];
  isFullyAccessible: boolean;
}

export interface CriticalBottleneck {
  edgeId: string;
  load: number;
  description: string;
}

export interface DistrictMetrics {
  weightedAvgBusDistM: number;
  weightedAvgBusTimeMin: number;
  medianBusDistM: number;
  p90BusDistM: number;
  parkAccessPercent: number;
  parkCoveredResidents: number;
  schoolAccessPercent: number;
  schoolCoveredResidents: number;
  policeAccessPercent: number;
  policeCoveredResidents: number;
  hospitalAccessPercent: number;
  hospitalCoveredResidents: number;
  shopAccessPercent: number;
  shopCoveredResidents: number;
  avgDetourIndex: number;
  iso5BusPercent: number;
  iso10BusPercent: number;
  greenM2PerResident: number;
  bikeAccessPercent: number;
  totalResidents: number;
  mobilityIndex: number;
  budgetSpentRub: number;
  budgetLimitRub: number;
  costPerCapitaRub: number;
  busPaths: Record<string, PathResult | null>;
  parkPaths: Record<string, PathResult | null>;
  schoolPaths: Record<string, PathResult | null>;
  policePaths: Record<string, PathResult | null>;
  hospitalPaths: Record<string, PathResult | null>;
  shopPaths: Record<string, PathResult | null>;
  edgeLoads: Record<string, number>;
  bottlenecks: CriticalBottleneck[];
}
