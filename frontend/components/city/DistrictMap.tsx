'use client';

import { DistrictScenario, GraphNode, GraphEdge } from '@/lib/city-engine/types';

interface DistrictMapProps {
  scenario: DistrictScenario;
  selectedBuildingId: string | null;
  onSelectBuilding: (buildingId: string) => void;
  activePathNodeIds: string[];
  onToggleCrossing: () => void;
  onToggleStop: () => void;
  onToggleBlock: (edgeId: string) => void;
  hasCustomCrossing: boolean;
  busStopNodeId: string;
  hasCustomPark: boolean;
  onToggleNewBuilding?: () => void;
  hasNewBuilding?: boolean;
}

export default function DistrictMap({
  scenario, selectedBuildingId, onSelectBuilding, activePathNodeIds,
  onToggleCrossing, onToggleStop, onToggleBlock, hasCustomCrossing,
  busStopNodeId, hasCustomPark, onToggleNewBuilding, hasNewBuilding,
}: DistrictMapProps) {
  const nodeMap = new Map<string, GraphNode>(scenario.nodes.map((n) => [n.id, n]));

  const isSegmentActive = (u: string, v: string) => {
    const idxU = activePathNodeIds.indexOf(u);
    const idxV = activePathNodeIds.indexOf(v);
    return idxU !== -1 && idxV !== -1 && Math.abs(idxU - idxV) === 1;
  };

  const trees = [
    { cx: 200, cy: 470, r: 16 },
    { cx: 230, cy: 520, r: 20 },
    { cx: 270, cy: 465, r: 18 },
    { cx: 330, cy: 540, r: 22 },
    { cx: 380, cy: 490, r: 19 },
    { cx: 410, cy: 460, r: 17 },
  ];

  return (
    <div className="relative w-full overflow-hidden rounded-[28px] border border-white/60 bg-[#E8ECEF] shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),0_20px_50px_-16px_rgba(20,26,38,0.25)] dark:border-white/20 dark:bg-[#1E293B]">
      <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2 rounded-full border border-white/60 bg-white/80 px-3.5 py-1.5 text-xs text-gray-700 shadow-sm backdrop-blur-xl dark:border-white/20 dark:bg-gray-800/80 dark:text-gray-200">
        <span className="font-semibold text-gray-900 dark:text-gray-100">2D Генплан: 51-й мкр Обнинска</span>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <span className="text-gray-500 dark:text-gray-400">Масштаб 1:1000</span>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <span className="flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-400">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-600" />
          Маршрут выбранного жителя
        </span>
      </div>

      <svg viewBox="0 0 960 620" className="h-auto w-full select-none" style={{ minHeight: '520px' }} role="img" aria-label="Генплан 51-го микрорайона Обнинска">
        <rect width="960" height="620" fill="#E8ECEF" />

        <g>
          <rect x="180" y="420" width="250" height="170" rx="16" fill="#C5D9BF" stroke="#9EBD95" strokeWidth="1.5" />
          <text x="195" y="445" fill="#3B6347" fontSize="11" fontWeight="700" letterSpacing="0.5">
            СКВЕР ИМ. КУДРЯВЦЕВОЙ
          </text>
          {trees.map((tree, i) => (
            <g key={i}>
              <circle cx={tree.cx + 2} cy={tree.cy + 3} r={tree.r} fill="#97AB92" opacity="0.3" />
              <circle cx={tree.cx} cy={tree.cy} r={tree.r} fill="#7A9A74" stroke="#688762" strokeWidth="1.5" />
              <circle cx={tree.cx} cy={tree.cy} r={tree.r * 0.45} fill="#4D7C5F" opacity="0.6" />
            </g>
          ))}
        </g>

        {hasCustomPark && (
          <g>
            <rect x="180" y="40" width="120" height="90" rx="12" fill="#C5D9BF" stroke="#9EBD95" strokeWidth="1.5" />
            <text x="190" y="60" fill="#3B6347" fontSize="10" fontWeight="700">НОВЫЙ СКВЕР</text>
            <circle cx="210" cy="85" r="14" fill="#7A9A74" />
            <circle cx="260" cy="95" r="16" fill="#7A9A74" />
          </g>
        )}

        <g>
          <rect x="524" y="424" width="230" height="150" rx="8" fill="#000000" opacity="0.08" />
          <rect x="520" y="420" width="230" height="150" rx="8" fill="#D3D9DE" stroke="#9AA5B1" strokeWidth="2" />
          <rect x="560" y="455" width="150" height="70" rx="6" fill="#BAE6FD" stroke="#7DD3FC" strokeWidth="1.5" />
          <text x="635" y="490" textAnchor="middle" fill="#0369A1" fontSize="12" fontWeight="800" letterSpacing="0.8">
            ТРК «ТРИУМФ ПЛАЗА»
          </text>
          <text x="635" y="508" textAnchor="middle" fill="#0284C7" fontSize="10" fontWeight="600">
            Главный пересадочный узел
          </text>
        </g>

        <g>
          <rect x="760" y="20" width="80" height="580" fill="#3B4759" />
          <line x1="800" y1="20" x2="800" y2="600" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="16 12" />
          <text x="825" y="160" fill="#CBD5E1" fontSize="11" fontWeight="700" letterSpacing="2" transform="rotate(90, 825, 160)">
            УЛИЦА ГАГАРИНА
          </text>
        </g>

        <g>
          <rect x="20" y="270" width="920" height="120" fill="#334155" />
          <line x1="20" y1="330" x2="940" y2="330" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="16 12" />
          <line x1="20" y1="300" x2="940" y2="300" stroke="#64748B" strokeWidth="1.2" strokeDasharray="12 16" />
          <line x1="20" y1="360" x2="940" y2="360" stroke="#64748B" strokeWidth="1.2" strokeDasharray="12 16" />
          <text x="50" y="320" fill="#CBD5E1" fontSize="11" fontWeight="700" letterSpacing="2.5" opacity="0.9">
            ПРОСПЕКТ МАРКСА
          </text>
        </g>

        {!hasNewBuilding && onToggleNewBuilding && (
          <g className="cursor-pointer" onClick={onToggleNewBuilding}>
            <rect x="760" y="40" width="80" height="60" rx="8" fill="#FEF08A" stroke="#EAB308" strokeWidth="2" strokeDasharray="4 3" opacity="0.8" />
            <text x="800" y="65" textAnchor="middle" fill="#854D0E" fontSize="9" fontWeight="700">+ СТРОИТЕЛЬСТВО</text>
            <text x="800" y="82" textAnchor="middle" fill="#A16207" fontSize="8" fontWeight="600">Новый корпус</text>
          </g>
        )}

        {scenario.edges.map((edge: GraphEdge) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          const isActiveInPath = isSegmentActive(edge.from, edge.to);
          if (edge.type === 'sidewalk' || edge.type === 'park_path' || edge.type === 'bike_lane' || edge.type === 'underpass') {
            return (
              <g key={edge.id} className="cursor-pointer" onClick={() => onToggleBlock(edge.id)}>
                <title>{`${edge.lengthM} м${edge.isActive ? '' : ' (перекрыто)'}`}</title>
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  stroke={edge.type === 'park_path' ? '#A3B899' : '#D1D5DB'}
                  strokeWidth={edge.isActive ? 6 : 4} strokeLinecap="round" />
                {!edge.isActive && (
                  <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#DC2626" strokeWidth={3} strokeDasharray="6 4" strokeLinecap="round" />
                )}
                {isActiveInPath && (
                  <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#2563EB" strokeWidth={4.5} strokeDasharray="6 4" strokeLinecap="round" />
                )}
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="transparent" strokeWidth={16} />
              </g>
            );
          }
          if (edge.type === 'crossing') {
            return (
              <g key={edge.id} className="cursor-pointer" onClick={onToggleCrossing}>
                <title>Пешеходный переход</title>
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#FFFFFF" strokeWidth={14} strokeDasharray="4 6" strokeLinecap="butt" />
                <rect x={from.x - 7} y={from.y - 7} width="14" height="14" rx="3" fill="#1D4ED8" stroke="#FFFFFF" strokeWidth="1.5" />
                <rect x={to.x - 7} y={to.y - 7} width="14" height="14" rx="3" fill="#1D4ED8" stroke="#FFFFFF" strokeWidth="1.5" />
                {isActiveInPath && (
                  <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#2563EB" strokeWidth={4} strokeDasharray="4 4" />
                )}
              </g>
            );
          }
          return null;
        })}

        {!hasCustomCrossing && (
          <g className="cursor-pointer opacity-70 transition-opacity hover:opacity-100" onClick={onToggleCrossing}>
            <line x1="440" y1="260" x2="440" y2="400" stroke="#94A3B8" strokeWidth="10" strokeDasharray="4 6" />
            <rect x="350" y="315" width="180" height="28" rx="8" fill="#1E293B" stroke="#475569" strokeWidth="1" />
            <text x="440" y="333" textAnchor="middle" fill="#F8FAFC" fontSize="10" fontWeight="700">+ УСТАНОВИТЬ ПЕРЕХОД</text>
          </g>
        )}

        {scenario.buildings.map((b) => {
          const isSelected = selectedBuildingId === b.id;
          return (
            <g key={b.id} className="cursor-pointer" onClick={() => onSelectBuilding(b.id)}>
              <title>{`${b.name}, ${b.residents} жителей (${b.floors} эт.)`}</title>
              <rect x={b.x + 3} y={b.y + 4} width={b.width} height={b.height} rx={6} fill="#000000" opacity={isSelected ? 0.25 : 0.1} />
              <rect x={b.x} y={b.y} width={b.width} height={b.height} rx={6}
                fill={isSelected ? '#EFF6FF' : (b.isCustom ? '#FEF08A' : '#FFFFFF')}
                stroke={isSelected ? '#2563EB' : '#94A3B8'} strokeWidth={isSelected ? 3 : 1} />
              <line x1={b.x + 8} y1={b.y + b.height / 2} x2={b.x + b.width - 8} y2={b.y + b.height / 2} stroke="#CBD5E1" strokeWidth="1" />
              <text x={b.x + b.width / 2} y={b.y + 19} textAnchor="middle" fill={isSelected ? '#1D4ED8' : '#1E293B'} fontSize="10.5" fontWeight="700">
                {b.name}
              </text>
              <text x={b.x + b.width / 2} y={b.y + 35} textAnchor="middle" fill="#64748B" fontSize="9.5" fontWeight="600">
                {b.floors} эт. • {b.residents} жит.
              </text>
            </g>
          );
        })}

        {(() => {
          const stopNode = nodeMap.get(busStopNodeId);
          if (!stopNode) return null;
          return (
            <g className="cursor-pointer" onClick={onToggleStop}>
              <title>Остановка общественного транспорта</title>
              <rect x={stopNode.x - 32} y={stopNode.y - 12} width="64" height="24" rx="6" fill="#334155" stroke="#94A3B8" strokeWidth="1.5" />
              <rect x={stopNode.x - 24} y={stopNode.y - 8} width="48" height="12" rx="3" fill="#0F172A" />
              <circle cx={stopNode.x} cy={stopNode.y - 20} r="9" fill="#2563EB" stroke="#FFFFFF" strokeWidth="1.8" />
              <text x={stopNode.x} y={stopNode.y - 16} textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="800">A</text>
              <text x={stopNode.x} y={stopNode.y + 24} textAnchor="middle" fill="#1E293B" fontSize="10" fontWeight="700">Остановка ОТ</text>
            </g>
          );
        })()}

        {scenario.nodes.map((node) => {
          const isSelectedPath = activePathNodeIds.includes(node.id);
          return (
            <circle key={node.id} cx={node.x} cy={node.y} r={isSelectedPath ? 4.5 : 2.5}
              fill={isSelectedPath ? '#2563EB' : '#94A3B8'} stroke="#FFFFFF" strokeWidth={1} />
          );
        })}
      </svg>
    </div>
  );
}
