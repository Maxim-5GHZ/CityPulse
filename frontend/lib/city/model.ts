// Кейс 03 «Обнинск 2040» — единый источник для 2D/3D/расчетов.
// Один DistrictModel рисуют и OpenLayers-карта, и Three-сцена, и все движки.
// Реальная геометрия — только OpenStreetMap (см. AGENTS.md, раздел Кейс 03).

export interface CNode {
  id: string;
  /** метры локальной сетки 0..1000 */
  x: number;
  y: number;
}

export type EdgeType = 'trotuar' | 'perehod';

export interface CEdge {
  id: string;
  a: string;
  b: string;
  /** метры */
  length: number;
  type: EdgeType;
  closed?: boolean;
}

export interface House {
  id: string;
  nodeId: string;
  /** условное число жителей (п.11 кейса: данные условные) */
  residents: number;
  label: string;
}

export type AttractionKind = 'ostanovka' | 'park' | 'shkola';

export interface Attraction {
  id: string;
  nodeId: string;
  kind: AttractionKind;
  label: string;
}

export type RoofShape = 'flat' | 'gable' | 'hip';
export type BuildingPreset = 'panel5' | 'tower16' | 'shkola' | 'tc' | 'custom';

export interface Building {
  id: string;
  label: string;
  /** полигон в метрах сетки 0..1000 */
  footprint: [number, number][];
  /** высота, м (3..75) */
  h: number;
  floors: number;
  roof: RoofShape;
  preset: BuildingPreset;
  /** след OSM для отладки, в метрики не тащим */
  source?: { osmId: string; levels?: number | null; kind?: string | null };
}

export interface Green {
  id: string;
  polygon: [number, number][];
  /** пористость 0..1 (ветрозащита) */
  porosity: number;
  label: string;
}

export interface DistrictModel {
  seed: number;
  nodes: CNode[];
  edges: CEdge[];
  houses: House[];
  attractions: Attraction[];
  buildings: Building[];
  greens: Green[];
}

export interface Scenario {
  id: string;
  name: string;
  owner: string;
  model: DistrictModel;
  /** sha1 канонического JSON графа — воспроизводимость для жюри */
  hash: string;
  createdAt: string;
  updatedAt: string;
}
