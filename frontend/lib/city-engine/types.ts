export type NodeType = 'intersection' | 'bus_stop' | 'park_gate' | 'house_gate' | 'amenity_gate';

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  label: string;
  type: NodeType;
  isCustom?: boolean;
}

export type EdgeType = 'sidewalk' | 'crossing' | 'underpass' | 'park_path' | 'bike_lane';

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  lengthM: number;
  type: EdgeType;
  isActive: boolean;
  isAccessible: boolean;
  isCustom?: boolean;
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
  isCustom?: boolean;
}

export type AmenityType = 'bus_stop' | 'park' | 'mall' | 'school';

export interface Amenity {
  id: string;
  name: string;
  type: AmenityType;
  nodeId: string;
  coverageRadiusM: number;
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
}
