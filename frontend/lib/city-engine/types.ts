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
}

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
  parkAccessPercent: number;
  parkCoveredResidents: number;
  totalResidents: number;
  mobilityIndex: number;
  budgetSpentRub: number;
  budgetLimitRub: number;
  busPaths: Record<string, PathResult | null>;
  parkPaths: Record<string, PathResult | null>;
  edgeLoads: Record<string, number>;
  bottlenecks: CriticalBottleneck[];
}
