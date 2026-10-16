'use client';

import { useState, type MouseEvent as ReactMouseEvent } from 'react';
import { DistrictScenario, GraphNode, GraphEdge, Building } from '@/lib/city-engine/types';

export type ToolMode =
  | 'select'
  | 'road'
  | 'sidewalk'
  | 'crossing'
  | 'building'
  | 'bus_stop'
  | 'park'
  | 'block'
  | 'delete';

interface DistrictMapProps {
  scenario: DistrictScenario;
  selectedBuildingId: string | null;
  onSelectBuilding: (buildingId: string | null) => void;
  activePathNodeIds: string[];
  toolMode: ToolMode;
  onAddRoad: (x1: number, y1: number, x2: number, y2: number, type?: 'road' | 'sidewalk' | 'crossing') => void;
  onAddBuilding: (x: number, y: number) => void;
  onAddAmenity: (type: 'bus_stop' | 'park', x: number, y: number) => void;
  onAddCrossingDirect: (edgeId: string, px: number, py: number) => void;
  onToggleBlockEdge: (id: string) => void;
  onDeleteBuilding: (id: string) => void;
  onDeleteEdge: (id: string) => void;
  onDeleteAmenity: (id: string) => void;
}

export default function DistrictMap({
  scenario,
  selectedBuildingId,
  onSelectBuilding,
  activePathNodeIds,
  toolMode,
  onAddRoad,
  onAddBuilding,
  onAddAmenity,
  onAddCrossingDirect,
  onToggleBlockEdge,
  onDeleteBuilding,
  onDeleteEdge,
  onDeleteAmenity,
}: DistrictMapProps) {
  const [roadStart, setRoadStart] = useState<{ x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const nodeMap = new Map<string, GraphNode>(scenario.nodes.map((n) => [n.id, n]));

  const snapToNode = (x: number, y: number): { x: number; y: number } => {
    for (const node of scenario.nodes) {
      if (Math.hypot(node.x - x, node.y - y) <= 22) {
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

  const isLinearTool = toolMode === 'road' || toolMode === 'sidewalk';

  const handleSvgClick = (e: ReactMouseEvent<SVGSVGElement>) => {
    const coords = getSvgCoordinates(e);

    if (isLinearTool) {
      if (!roadStart) {
        setRoadStart(coords);
      } else {
        if (Math.hypot(roadStart.x - coords.x, roadStart.y - coords.y) > 15) {
          onAddRoad(roadStart.x, roadStart.y, coords.x, coords.y, toolMode);
        }
        setRoadStart(null);
      }
    } else if (toolMode === 'building') {
      onAddBuilding(coords.x - 42, coords.y - 25);
    } else if (toolMode === 'bus_stop') {
      onAddAmenity('bus_stop', coords.x, coords.y);
    } else if (toolMode === 'park') {
      onAddAmenity('park', coords.x, coords.y);
    } else if (toolMode === 'select') {
      onSelectBuilding(null);
    }
  };

  const handleMouseMove = (e: ReactMouseEvent<SVGSVGElement>) => {
    const coords = getSvgCoordinates(e);
    setMousePos(coords);
  };

  const isSegmentActive = (u: string, v: string) => {
    const idxU = activePathNodeIds.indexOf(u);
    const idxV = activePathNodeIds.indexOf(v);
    return idxU !== -1 && idxV !== -1 && Math.abs(idxU - idxV) === 1;
  };

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-gray-300 bg-[#1e2430] shadow-md dark:border-gray-700">
      {/* Статусная панель САПР сверху */}
      <div className="flex h-8 items-center justify-between border-b border-gray-700/80 bg-[#161a22] px-3 font-mono text-[11px] text-gray-300 select-none">
        <div className="flex items-center gap-4">
          <span className="text-gray-400">САПР-СЕТКА: 10px</span>
          <span className="text-blue-400 font-semibold uppercase">
            РЕЖИМ: {
              toolMode === 'select' ? 'ВЫБОР ОБЪЕКТА [ESC]' :
              toolMode === 'road' ? 'ТРАССИРОВКА АВТОДОРОГИ' :
              toolMode === 'sidewalk' ? 'УКЛАДКА ТРОТУАРА С БОРДЮРОМ' :
              toolMode === 'crossing' ? 'ПЕРЕХОД В 1 КЛИК ПО ДОРОГЕ' :
              toolMode === 'block' ? 'ПЕРЕКРЫТИЕ / РЕМОНТ ПУТИ' :
              toolMode === 'building' ? 'РАЗМЕЩЕНИЕ ЗДАНИЯ' :
              toolMode === 'bus_stop' ? 'УСТАНОВКА ПАВИЛЬОНА ОСТАНОВКИ' :
              toolMode === 'park' ? 'РАЗБИВКА СКВЕРА' : 'ДЕМОНТАЖ ОБЪЕКТА'
            }
          </span>
        </div>
        <div>
          X: <span className="text-emerald-400">{mousePos?.x ?? 0}</span> | Y: <span className="text-emerald-400">{mousePos?.y ?? 0}</span>
        </div>
      </div>

      <svg
        viewBox="0 0 960 620"
        className="h-auto w-full cursor-crosshair select-none"
        style={{ minHeight: '520px' }}
        onClick={handleSvgClick}
        onMouseMove={handleMouseMove}
        role="img"
        aria-label="САПР чертёж городского района"
      >
        <defs>
          {/* Инженерная координатная сетка */}
          <pattern id="cad-grid-sm" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#2a3242" strokeWidth="0.5" />
          </pattern>
          <pattern id="cad-grid-lg" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#cad-grid-sm)" />
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#374358" strokeWidth="1" />
          </pattern>
          {/* Штриховка ремонтной блокировки */}
          <pattern id="blocked-pattern" width="16" height="16" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <rect width="8" height="16" fill="#dc2626" />
            <rect x="8" width="8" height="16" fill="#fef2f2" />
          </pattern>
        </defs>

        <rect width="960" height="620" fill="#141822" />
        <rect width="960" height="620" fill="url(#cad-grid-lg)" />

        {/* Парки */}
        {scenario.amenities
          .filter((a) => a.type === 'park')
          .map((park) => {
            const node = nodeMap.get(park.nodeId);
            if (!node) return null;
            return (
              <g
                key={park.id}
                className="cursor-pointer"
                onClick={(e) => {
                  if (toolMode === 'delete') {
                    e.stopPropagation();
                    onDeleteAmenity(park.id);
                  }
                }}
              >
                <circle cx={node.x} cy={node.y} r="50" fill="#1b3d2f" stroke="#2d6a4f" strokeWidth="1.5" strokeDasharray="4 2" />
                <circle cx={node.x - 12} cy={node.y - 10} r="16" fill="#2d6a4f" opacity="0.8" />
                <circle cx={node.x + 14} cy={node.y + 12} r="18" fill="#1e4d38" opacity="0.8" />
                <rect x={node.x - 45} y={node.y + 36} width="90" height="16" rx="3" fill="#0b1e16" stroke="#2d6a4f" strokeWidth="1" />
                <text x={node.x} y={node.y + 48} textAnchor="middle" fill="#a7f3d0" fontSize="9.5" fontFamily="monospace" fontWeight="700">
                  {park.name}
                </text>
              </g>
            );
          })}

        {/* Дороги, тротуары с бордюрами, переходы */}
        {scenario.edges.map((edge: GraphEdge) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;

          const isCarRoad = edge.type === 'road';
          const isCrossing = edge.type === 'crossing';
          const isBlocked = !edge.isActive;
          const isActiveInPath = isSegmentActive(edge.from, edge.to);

          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.hypot(dx, dy);
          const nx = len > 0 ? -dy / len : 0;
          const ny = len > 0 ? dx / len : 0;

          return (
            <g
              key={edge.id}
              className="cursor-pointer"
              onClick={(e) => {
                if (toolMode === 'crossing' && isCarRoad) {
                  e.stopPropagation();
                  onAddCrossingDirect(edge.id, (from.x + to.x) / 2, (from.y + to.y) / 2);
                } else if (toolMode === 'block') {
                  e.stopPropagation();
                  onToggleBlockEdge(edge.id);
                } else if (toolMode === 'delete') {
                  e.stopPropagation();
                  onDeleteEdge(edge.id);
                }
              }}
            >
              {/* Проезжая часть автодороги */}
              {isCarRoad && (
                <>
                  <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#2a3242" strokeWidth={24} strokeLinecap="round" />
                  <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#1b212c" strokeWidth={20} strokeLinecap="round" />
                  <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#64748b" strokeWidth={1.5} strokeDasharray="10 8" />
                </>
              )}

              {/* Пешеходный переход */}
              {isCrossing && (
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#ffffff" strokeWidth={12} strokeDasharray="5 7" strokeLinecap="butt" />
              )}

              {/* Тротуар с бордюрами */}
              {!isCarRoad && !isCrossing && (
                <>
                  {/* Бордюр слева */}
                  <line
                    x1={from.x + nx * 4.5}
                    y1={from.y + ny * 4.5}
                    x2={to.x + nx * 4.5}
                    y2={to.y + ny * 4.5}
                    stroke="#94a3b8"
                    strokeWidth={1}
                  />
                  {/* Полотно пешеходной дорожки */}
                  <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#475569" strokeWidth={8} strokeLinecap="round" />
                  {/* Бордюр справа */}
                  <line
                    x1={from.x - nx * 4.5}
                    y1={from.y - ny * 4.5}
                    x2={to.x - nx * 4.5}
                    y2={to.y - ny * 4.5}
                    stroke="#94a3b8"
                    strokeWidth={1}
                  />
                </>
              )}

              {/* Визуализация перекрытия/ремонта */}
              {isBlocked && (
                <>
                  <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="url(#blocked-pattern)" strokeWidth={16} strokeLinecap="round" />
                  <circle cx={(from.x + to.x) / 2} cy={(from.y + to.y) / 2} r="10" fill="#dc2626" stroke="#ffffff" strokeWidth="2" />
                  <rect x={(from.x + to.x) / 2 - 6} y={(from.y + to.y) / 2 - 2} width="12" height="4" fill="#ffffff" rx="1" />
                </>
              )}

              {/* Подсветка маршрута Дейкстры */}
              {isActiveInPath && !isBlocked && (
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#3b82f6" strokeWidth={4.5} strokeDasharray="6 4" strokeLinecap="round" />
              )}

              {/* Невидимая полоса для легкого клика */}
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="transparent" strokeWidth="26" />
            </g>
          );
        })}

        {/* Предпросмотр протяжки дороги/тротуара */}
        {isLinearTool && roadStart && mousePos && (
          <line
            x1={roadStart.x}
            y1={roadStart.y}
            x2={mousePos.x}
            y2={mousePos.y}
            stroke={toolMode === 'road' ? '#60a5fa' : '#93c5fd'}
            strokeWidth={toolMode === 'road' ? 18 : 8}
            strokeDasharray="6 4"
            strokeLinecap="round"
          />
        )}

        {/* Дома */}
        {scenario.buildings.map((b: Building) => {
          const isSelected = selectedBuildingId === b.id;
          return (
            <g
              key={b.id}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (toolMode === 'delete') {
                  onDeleteBuilding(b.id);
                } else {
                  onSelectBuilding(b.id);
                }
              }}
            >
              <rect
                x={b.x}
                y={b.y}
                width={b.width}
                height={b.height}
                rx={4}
                fill={isSelected ? '#1e3a8a' : '#1e293b'}
                stroke={isSelected ? '#60a5fa' : '#475569'}
                strokeWidth={isSelected ? 2.5 : 1}
              />
              <text
                x={b.x + b.width / 2}
                y={b.y + b.height / 2 - 4}
                textAnchor="middle"
                fill={isSelected ? '#bfdbfe' : '#f1f5f9'}
                fontSize="10"
                fontFamily="monospace"
                fontWeight="700"
              >
                {b.name}
              </text>
              <text
                x={b.x + b.width / 2}
                y={b.y + b.height / 2 + 11}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="8.5"
                fontFamily="monospace"
              >
                {b.floors} эт • {b.residents} чел
              </text>
            </g>
          );
        })}

        {/* Остановки транспорта */}
        {scenario.amenities
          .filter((a) => a.type === 'bus_stop')
          .map((bus) => {
            const node = nodeMap.get(bus.nodeId);
            if (!node) return null;
            return (
              <g
                key={bus.id}
                className="cursor-pointer"
                onClick={(e) => {
                  if (toolMode === 'delete') {
                    e.stopPropagation();
                    onDeleteAmenity(bus.id);
                  }
                }}
              >
                <circle cx={node.x} cy={node.y} r="12" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                <text x={node.x} y={node.y + 3.5} textAnchor="middle" fill="#ffffff" fontSize="9.5" fontFamily="monospace" fontWeight="900">
                  А
                </text>
                <rect x={node.x - 30} y={node.y + 16} width="60" height="14" rx="2" fill="#0f172a" stroke="#3b82f6" strokeWidth="0.8" />
                <text x={node.x} y={node.y + 26} textAnchor="middle" fill="#93c5fd" fontSize="8" fontFamily="monospace">
                  ОСТАНОВКА
                </text>
              </g>
            );
          })}

        {/* Узлы графа */}
        {scenario.nodes.map((node) => {
          const isSelectedPath = activePathNodeIds.includes(node.id);
          return (
            <circle
              key={node.id}
              cx={node.x}
              cy={node.y}
              r={isSelectedPath ? 5 : 3}
              fill={isSelectedPath ? '#3b82f6' : '#64748b'}
              stroke="#0f172a"
              strokeWidth={1}
            />
          );
        })}
      </svg>
    </div>
  );
}
