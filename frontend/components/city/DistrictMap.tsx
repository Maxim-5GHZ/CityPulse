'use client';

import { useState, type MouseEvent as ReactMouseEvent } from 'react';
import { DistrictScenario, GraphNode, GraphEdge, Building } from '@/lib/city-engine/types';
import { RING_RADIUS, isRingEdge } from '@/lib/city-engine/roundabout';
import DistrictContextMenu from './DistrictContextMenu';
import { pointsToSmoothSvgPath } from '@/lib/city-engine/geometry';

export type ToolMode =
  | 'select'
  | 'road'
  | 'sidewalk'
  | 'crossing'
  | 'underpass'
  | 'poly_building'
  | 'poly_park'
  | 'block_spot'
  | 'delete';

interface DistrictMapProps {
  scenario: DistrictScenario;
  selectedBuildingId: string | null;
  selectedEdgeId: string | null;
  onSelectBuilding: (buildingId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
  activePathNodeIds: string[];
  edgeLoads: Record<string, number>;
  toolMode: ToolMode;
  onAddRoad: (x1: number, y1: number, x2: number, y2: number, type?: 'road' | 'sidewalk' | 'crossing') => void;
  onAddPolyBuilding: (points: { x: number; y: number }[]) => void;
  onAddPolyPark: (points: { x: number; y: number }[]) => void;
  onAddCrossingDirect: (edgeId: string, px: number, py: number, isUnderpass?: boolean) => void;
  onSplitAndBlockSpot: (edgeId: string, px: number, py: number) => void;
  onUpgradeLanes: (edgeId: string) => void;
  onToggleSidewalk: (edgeId: string, side: 'left' | 'right') => void;
  onMakeRoundabout: (nodeId: string) => void;
  onDeleteBuilding: (id: string) => void;
  onDeleteEdge: (id: string) => void;
  onDeleteAmenity: (id: string) => void;
}

// Половина ширины полотна по числу полос (для подложек стыков).
const halfWidth = (edge: GraphEdge): number => (edge.lanes === 4 ? 17 : 11);

// Палитра полотна: асфальт заметно светлее фона (#141822), бордюр — темнее асфальта.
const ROAD_ASPHALT = '#2f3b52';
const ROAD_CASING = '#0d1219';
const RING_ISLAND = '#1c2433';

export default function DistrictMap({
  scenario,
  selectedBuildingId,
  selectedEdgeId,
  onSelectBuilding,
  onSelectEdge,
  activePathNodeIds,
  edgeLoads,
  toolMode,
  onAddRoad,
  onAddPolyBuilding,
  onAddPolyPark,
  onAddCrossingDirect,
  onSplitAndBlockSpot,
  onUpgradeLanes,
  onToggleSidewalk,
  onMakeRoundabout,
  onDeleteBuilding,
  onDeleteEdge,
  onDeleteAmenity,
}: DistrictMapProps) {
  const [roadStart, setRoadStart] = useState<{ x: number; y: number } | null>(null);
  const [polygonDraft, setPolygonDraft] = useState<{ x: number; y: number }[]>([]);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);

  const nodeMap = new Map<string, GraphNode>(scenario.nodes.map((n) => [n.id, n]));
  const roadEdges = scenario.edges.filter((e) => e.type === 'road');

  // Радиус подложки стыка: половина ширины самой широкой примыкающей дороги.
  // Ставится только там, где сходятся ≥2 дорог, — на прямых участках швов нет.
  const padRadius = (nodeId: string): number => {
    const adj = roadEdges.filter(
      (e) => e.isActive && (e.from === nodeId || e.to === nodeId),
    );
    if (adj.length < 2) return 0;
    return Math.max(...adj.map(halfWidth));
  };

  // Обрезка концов отрезка на t1/t2 (подложки узлов), чтобы швы ушли под круги.
  const trim = (
    u: GraphNode,
    v: GraphNode,
  ): { x1: number; y1: number; x2: number; y2: number } | null => {
    const dx = v.x - u.x;
    const dy = v.y - u.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return null;
    const t1 = Math.min(padRadius(u.id), len / 2 - 1);
    const t2 = Math.min(padRadius(v.id), len / 2 - 1);
    if (t1 + t2 >= len - 1) return null;
    const ux = dx / len;
    const uy = dy / len;
    return {
      x1: u.x + ux * Math.max(0, t1),
      y1: u.y + uy * Math.max(0, t1),
      x2: v.x - ux * Math.max(0, t2),
      y2: v.y - uy * Math.max(0, t2),
    };
  };

  const snapToNode = (x: number, y: number): { x: number; y: number } => {
    for (const node of scenario.nodes) {
      if (Math.hypot(node.x - x, node.y - y) <= 16) {
        return { x: node.x, y: node.y };
      }
    }
    return { x: Math.round(x / 10) * 10, y: Math.round(y / 10) * 10 };
  };

  const getSvgCoordinates = (e: ReactMouseEvent<SVGSVGElement>): { x: number; y: number } => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 960;
    const y = ((e.clientY - rect.top) / rect.height) * 620;
    return snapToNode(x, y);
  };

  const handleSvgClick = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (contextMenu) setContextMenu(null);
    const coords = getSvgCoordinates(e);

    if (toolMode === 'road' || toolMode === 'sidewalk') {
      if (!roadStart) {
        setRoadStart(coords);
      } else {
        if (Math.hypot(roadStart.x - coords.x, roadStart.y - coords.y) > 15) {
          onAddRoad(roadStart.x, roadStart.y, coords.x, coords.y, toolMode);
        }
        setRoadStart(null);
      }
    } else if (toolMode === 'poly_building' || toolMode === 'poly_park') {
      if (polygonDraft.length >= 3) {
        const first = polygonDraft[0];
        if (Math.hypot(first.x - coords.x, first.y - coords.y) <= 22) {
          if (toolMode === 'poly_building') onAddPolyBuilding(polygonDraft);
          else onAddPolyPark(polygonDraft);
          setPolygonDraft([]);
          return;
        }
      }
      setPolygonDraft((prev) => [...prev, coords]);
    } else if (toolMode === 'select') {
      onSelectBuilding(null);
      onSelectEdge(null);
    }
  };

  const handleContextMenu = (e: ReactMouseEvent, edgeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, edgeId });
    onSelectEdge(edgeId);
  };

  const handleEdgeClick = (
    e: ReactMouseEvent,
    edge: GraphEdge,
    from: GraphNode,
    to: GraphNode,
  ) => {
    const isCarRoad = edge.type === 'road';
    if (toolMode === 'block_spot') {
      e.stopPropagation();
      onSplitAndBlockSpot(edge.id, Math.round(mousePos?.x ?? 0), Math.round(mousePos?.y ?? 0));
    } else if (toolMode === 'crossing' && isCarRoad) {
      e.stopPropagation();
      onAddCrossingDirect(edge.id, (from.x + to.x) / 2, (from.y + to.y) / 2, false);
    } else if (toolMode === 'underpass' && isCarRoad) {
      e.stopPropagation();
      onAddCrossingDirect(edge.id, (from.x + to.x) / 2, (from.y + to.y) / 2, true);
    } else if (toolMode === 'delete') {
      e.stopPropagation();
      onDeleteEdge(edge.id);
    } else if (toolMode === 'select') {
      e.stopPropagation();
      onSelectEdge(edge.id);
      onSelectBuilding(null);
    }
  };

  // Плавная «народная тропа»: путь Дейкстры сплайном Безье вместо ломаной.
  const activePathD = pointsToSmoothSvgPath(
    activePathNodeIds
      .map((id) => nodeMap.get(id))
      .filter((n): n is GraphNode => !!n)
      .map((n) => ({ x: n.x, y: n.y })),
  );

  const roundaboutCenters = scenario.nodes.filter((n) => n.type === 'roundabout');
  const menuEdge = contextMenu ? scenario.edges.find((e) => e.id === contextMenu.edgeId) : undefined;
  const menuEdgeNodes =
    menuEdge && nodeMap.get(menuEdge.from) && nodeMap.get(menuEdge.to)
      ? { from: nodeMap.get(menuEdge.from)!, to: nodeMap.get(menuEdge.to)! }
      : null;

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-gray-700 bg-[#1e2430] shadow-xl">
      <div className="flex h-8 items-center justify-between border-b border-gray-700/80 bg-[#161a22] px-3 font-mono text-[11px] text-gray-300 select-none">
        <div className="flex items-center gap-4">
          <span className="text-gray-400">МАСШТАБ: 1ед = 1м</span>
          <span className="text-blue-400 font-semibold uppercase">
            РЕЖИМ: {
              toolMode === 'select' ? 'ВЫБОР (ПКМ — МЕНЮ • КЛИК ПО УЗЛУ — КОЛЬЦО)' :
              toolMode === 'road' ? 'ТРАССИРОВКА УДС' :
              toolMode === 'sidewalk' ? 'ТРОТУАР' :
              toolMode === 'crossing' ? 'НАЗЕМНЫЙ ПЕРЕХОД' :
              toolMode === 'underpass' ? 'ПОДЗЕМНЫЙ ПЕРЕХОД (НЕ МГН)' :
              toolMode === 'poly_building' ? `КОНТУР ЗДАНИЯ (${polygonDraft.length} ТОЧЕК)` :
              toolMode === 'poly_park' ? `КОНТУР СКВЕРА (${polygonDraft.length} ТОЧЕК)` :
              toolMode === 'block_spot' ? 'ЛОКАЛЬНЫЙ РЕМОНТ' : 'СНОС'
            }
          </span>
        </div>
        <div>
          X: <span className="text-emerald-400">{mousePos?.x ?? 0}м</span> | Y:{' '}
          <span className="text-emerald-400">{mousePos?.y ?? 0}м</span>
        </div>
      </div>

      <svg
        viewBox="0 0 960 620"
        className="h-auto w-full cursor-crosshair select-none"
        style={{ minHeight: '520px' }}
        onClick={handleSvgClick}
        onMouseMove={(e) => setMousePos(getSvgCoordinates(e))}
        role="img"
        aria-label="САПР чертёж района"
      >
        <defs>
          <pattern id="cad-grid-sm" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#2a3242" strokeWidth="0.5" />
          </pattern>
          <pattern id="cad-grid-lg" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#cad-grid-sm)" />
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#374358" strokeWidth="1" />
          </pattern>
        </defs>

        <rect width="960" height="620" fill="#141822" />
        <rect width="960" height="620" fill="url(#cad-grid-lg)" />

        {/* Парки */}
        {scenario.amenities
          .filter((a) => a.type === 'park')
          .map((park) => {
            const node = nodeMap.get(park.nodeId);
            if (park.polygon && park.polygon.length >= 3) {
              const pts = park.polygon.map((p) => `${p.x},${p.y}`).join(' ');
              return (
                <g key={park.id} onClick={() => toolMode === 'delete' && onDeleteAmenity(park.id)}>
                  <polygon points={pts} fill="#143828" stroke="#2d6a4f" strokeWidth="2" strokeDasharray="4 2" />
                  <text x={park.polygon[0].x} y={park.polygon[0].y + 14} fill="#a7f3d0" fontSize="9" fontFamily="monospace">
                    {park.name}
                  </text>
                </g>
              );
            }
            if (!node) return null;
            return (
              <g key={park.id} onClick={() => toolMode === 'delete' && onDeleteAmenity(park.id)}>
                <circle cx={node.x} cy={node.y} r="48" fill="#143828" stroke="#2d6a4f" strokeWidth="1.5" strokeDasharray="4 2" />
                <text x={node.x} y={node.y + 4} textAnchor="middle" fill="#a7f3d0" fontSize="9" fontFamily="monospace" fontWeight="700">
                  {park.name}
                </text>
              </g>
            );
          })}

        {/* Проход 1: окаймления всех дорог (слияние стыков) */}
        {roadEdges.map((edge) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          const t = trim(from, to);
          if (!t) return null;
          const w = edge.lanes === 4 ? 34 : 22;
          return (
            <line
              key={`casing-${edge.id}`}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={selectedEdgeId === edge.id ? '#3b82f6' : ROAD_CASING}
              strokeWidth={w + 6}
              strokeLinecap="round"
            />
          );
        })}

        {/* Проход 2: полотна дорог */}
        {roadEdges.map((edge) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          const t = trim(from, to);
          if (!t) return null;
          return (
            <line
              key={`asphalt-${edge.id}`}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={ROAD_ASPHALT}
              strokeWidth={edge.lanes === 4 ? 30 : 18}
              strokeLinecap="round"
            />
          );
        })}

        {/* Проход 3: подложки перекрёстков поверх швов */}
        {scenario.nodes.map((node) => {
          const r = padRadius(node.id);
          if (r <= 0) return null;
          return (
            <g key={`pad-${node.id}`}>
              <circle cx={node.x} cy={node.y} r={r + 3} fill={ROAD_CASING} />
              <circle cx={node.x} cy={node.y} r={r} fill={ROAD_ASPHALT} />
            </g>
          );
        })}

        {/* Проход 4: тротуары вдоль дорог и осевые (обрезаны подложками) */}
        {roadEdges.map((edge) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          const t = trim(from, to);
          if (!t) return null;
          const is4Lanes = edge.lanes === 4;
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.hypot(dx, dy);
          const nx = len > 0 ? -dy / len : 0;
          const ny = len > 0 ? dx / len : 0;
          const off = is4Lanes ? 20 : 14;
          return (
            <g key={`detail-${edge.id}`}>
              {edge.hasSidewalkLeft && (
                <line
                  x1={t.x1 + nx * off}
                  y1={t.y1 + ny * off}
                  x2={t.x2 + nx * off}
                  y2={t.y2 + ny * off}
                  stroke="#94a3b8"
                  strokeWidth={5}
                  strokeLinecap="round"
                />
              )}
              {edge.hasSidewalkRight && (
                <line
                  x1={t.x1 - nx * off}
                  y1={t.y1 - ny * off}
                  x2={t.x2 - nx * off}
                  y2={t.y2 - ny * off}
                  stroke="#94a3b8"
                  strokeWidth={5}
                  strokeLinecap="round"
                />
              )}
              {is4Lanes ? (
                <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#f59e0b" strokeWidth={1.5} />
              ) : (
                <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#64748b" strokeWidth={1} strokeDasharray="8 6" />
              )}
            </g>
          );
        })}

        {/* Кольца поверх стыков: полотно → разметка → островок → зебры съездов */}
        {roundaboutCenters.map((center) => (
          <g key={`ring-${center.id}`}>
            <circle cx={center.x} cy={center.y} r={RING_RADIUS + 15} fill="none" stroke={ROAD_CASING} strokeWidth={30} />
            <circle cx={center.x} cy={center.y} r={RING_RADIUS} fill="none" stroke={ROAD_ASPHALT} strokeWidth={24} />
            <circle cx={center.x} cy={center.y} r={RING_RADIUS} fill="none" stroke="#e2e8f0" strokeWidth={1.5} strokeDasharray="6 5" />
            <circle cx={center.x} cy={center.y} r={RING_RADIUS - 13} fill={RING_ISLAND} stroke="#64748b" strokeWidth={1.5} />
            <circle cx={center.x} cy={center.y} r={2.5} fill="#64748b" />
          </g>
        ))}
        {scenario.edges.map((edge) => {
          if (edge.type !== 'road' || isRingEdge(edge)) return null;
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          // Зебра на съезде: ищем конец ребра, лежащий на окружности кольца.
          const ends = [from, to].map((p) => {
            const c = roundaboutCenters.find(
              (cc) => Math.abs(Math.hypot(p.x - cc.x, p.y - cc.y) - RING_RADIUS) < 4,
            );
            return c ? { p, c } : null;
          });
          const hit = ends[0] ?? ends[1];
          if (!hit) return null;
          const other = hit.p === from ? to : from;
          const dx = other.x - hit.p.x;
          const dy = other.y - hit.p.y;
          const len = Math.hypot(dx, dy);
          if (len < 1) return null;
          const ux = dx / len;
          const uy = dy / len;
          // Полоса зебры на 8 м наружу от съезда, поперёк дороги.
          const qx = hit.p.x + ux * 8;
          const qy = hit.p.y + uy * 8;
          const hw = halfWidth(edge);
          return (
            <line
              key={`zebra-${edge.id}`}
              x1={qx - uy * hw}
              y1={qy + ux * hw}
              x2={qx + uy * hw}
              y2={qy - ux * hw}
              stroke="#ffffff"
              strokeWidth={5}
              strokeDasharray="3 3"
            />
          );
        })}

        {/* Наземные зебры */}
        {scenario.edges.map((edge) => {
          if (edge.type !== 'crossing') return null;
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          return (
            <line
              key={edge.id}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#ffffff"
              strokeWidth={12}
              strokeDasharray="4 5"
            />
          );
        })}

        {/* Подземные переходы */}
        {scenario.edges.map((edge) => {
          if (edge.type !== 'underpass') return null;
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          return (
            <g key={edge.id}>
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#1e293b" strokeWidth={12} strokeDasharray="6 4" />
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#38bdf8" strokeWidth={2} />
            </g>
          );
        })}

        {/* Тротуары и велодорожки с тепловой картой нагрузки */}
        {scenario.edges.map((edge) => {
          if (edge.type === 'road' || edge.type === 'crossing' || edge.type === 'underpass') return null;
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          const load = edgeLoads[edge.id] || 0;
          let heatColor = '#475569';
          if (load > 400) heatColor = '#ef4444';
          else if (load > 200) heatColor = '#f59e0b';
          else if (load > 50) heatColor = '#3b82f6';
          return (
            <line
              key={edge.id}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={heatColor}
              strokeWidth={6}
              strokeLinecap="round"
            />
          );
        })}

        {/* Активный путь Дейкстры — единый плавный сплайн поверх полотен */}
        {activePathD && (
          <path
            d={activePathD}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
        )}

        {/* Интерактив рёбер: оверлеи + хит-зоны */}
        {scenario.edges.map((edge) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          const isBlocked = !edge.isActive;
          return (
            <g
              key={`hit-${edge.id}`}
              className="cursor-pointer"
              onContextMenu={(e) => handleContextMenu(e, edge.id)}
              onClick={(e) => handleEdgeClick(e, edge, from, to)}
            >
              {isBlocked && (
                <circle cx={(from.x + to.x) / 2} cy={(from.y + to.y) / 2} r="8" fill="#dc2626" stroke="#ffffff" strokeWidth="2" />
              )}
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="transparent" strokeWidth={24} />
            </g>
          );
        })}

        {/* Черновой полигон */}
        {polygonDraft.length > 0 && (
          <g>
            <polyline
              points={[...polygonDraft, mousePos].filter(Boolean).map((p) => `${p!.x},${p!.y}`).join(' ')}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            {polygonDraft.map((pt, i) => (
              <circle key={i} cx={pt.x} cy={pt.y} r={i === 0 ? 6 : 4} fill={i === 0 ? '#10b981' : '#38bdf8'} />
            ))}
          </g>
        )}

        {/* Линия привязки новой дороги */}
        {roadStart && mousePos && (
          <line x1={roadStart.x} y1={roadStart.y} x2={mousePos.x} y2={mousePos.y} stroke="#60a5fa" strokeWidth={14} strokeDasharray="6 4" />
        )}

        {/* Дома */}
        {scenario.buildings.map((b: Building) => {
          const isSelected = selectedBuildingId === b.id;
          if (b.polygon && b.polygon.length >= 3) {
            const pts = b.polygon.map((p) => `${p.x},${p.y}`).join(' ');
            return (
              <g key={b.id} onClick={(e) => { e.stopPropagation(); toolMode === 'delete' ? onDeleteBuilding(b.id) : onSelectBuilding(b.id); }}>
                <polygon points={pts} fill={isSelected ? '#1e3a8a' : '#1e293b'} stroke={isSelected ? '#60a5fa' : '#475569'} strokeWidth="2" />
                <text x={b.polygon[0].x + 10} y={b.polygon[0].y + 16} fill="#f8fafc" fontSize="9" fontFamily="monospace" fontWeight="700">
                  {b.name} ({b.residents} чел)
                </text>
              </g>
            );
          }
          const cx = b.x + b.width / 2;
          const cy = b.y + b.height / 2;
          return (
            <g
              key={b.id}
              transform={b.rotationDeg ? `rotate(${b.rotationDeg} ${cx} ${cy})` : undefined}
              onClick={(e) => { e.stopPropagation(); toolMode === 'delete' ? onDeleteBuilding(b.id) : onSelectBuilding(b.id); }}
            >
              <rect x={b.x} y={b.y} width={b.width} height={b.height} rx={8} fill={isSelected ? '#1e3a8a' : '#1e293b'} stroke={isSelected ? '#60a5fa' : '#475569'} strokeWidth={isSelected ? 2.5 : 1} />
              <text x={cx} y={cy + 3} textAnchor="middle" fill="#f8fafc" fontSize="9" fontFamily="monospace" fontWeight="700">
                {b.name}
              </text>
            </g>
          );
        })}

        {/* Остановки */}
        {scenario.amenities.filter((a) => a.type === 'bus_stop').map((bus) => {
          const n = nodeMap.get(bus.nodeId);
          if (!n) return null;
          return (
            <g key={bus.id} onClick={() => toolMode === 'delete' && onDeleteAmenity(bus.id)}>
              <circle cx={n.x} cy={n.y} r="11" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
              <text x={n.x} y={n.y + 3.5} textAnchor="middle" fill="#ffffff" fontSize="9" fontFamily="monospace" fontWeight="900">
                А
              </text>
            </g>
          );
        })}

        {/* Узлы (клик в режиме выбора — построить кольцо) */}
        {scenario.nodes.map((node) => {
          const roadCount =
            toolMode === 'select' && node.type !== 'roundabout' && !node.isRoundabout
              ? scenario.edges.filter(
                  (e) =>
                    e.type === 'road' &&
                    e.isActive &&
                    !e.isRoundabout &&
                    (e.from === node.id || e.to === node.id),
                ).length
              : 0;
          const canRing = roadCount >= 3;
          return (
            <g key={node.id}>
              {canRing && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={10}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
              )}
              <circle
                cx={node.x}
                cy={node.y}
                r={node.type === 'roundabout' ? 14 : node.isRoundabout ? 2.5 : 3}
                fill={node.type === 'roundabout' ? '#1e3a8a' : canRing ? '#f59e0b' : '#64748b'}
                onClick={(e) => {
                  if (toolMode !== 'select') return;
                  e.stopPropagation();
                  onMakeRoundabout(node.id);
                }}
              >
                {canRing && <title>Клик — построить кольцо</title>}
              </circle>
            </g>
          );
        })}
      </svg>

      {contextMenu && menuEdge && menuEdgeNodes && (
        <DistrictContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          edgeId={contextMenu.edgeId}
          lanesLabel={menuEdge.type === 'road' ? `${menuEdge.lanes ?? 2}` : '—'}
          isRing={isRingEdge(menuEdge)}
          onUpgradeLanes={onUpgradeLanes}
          onToggleSidewalk={onToggleSidewalk}
          onDeleteEdge={onDeleteEdge}
          onBuildCrossing={(isUnderpass) => {
            onAddCrossingDirect(
              menuEdge.id,
              Math.round((menuEdgeNodes.from.x + menuEdgeNodes.to.x) / 2),
              Math.round((menuEdgeNodes.from.y + menuEdgeNodes.to.y) / 2),
              isUnderpass,
            );
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
