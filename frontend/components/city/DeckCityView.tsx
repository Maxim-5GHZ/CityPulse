'use client';

import { useEffect, useMemo, useState } from 'react';
import { DeckGL } from '@deck.gl/react';
import { OrbitView, LightingEffect, AmbientLight, DirectionalLight } from '@deck.gl/core';
import { PolygonLayer, PathLayer, ScatterplotLayer } from '@deck.gl/layers';
import { TripsLayer } from '@deck.gl/geo-layers';
import {
  DistrictScenario,
  Building,
  GraphEdge,
  GraphNode,
  Amenity,
  PathResult,
} from '@/lib/city-engine/types';

interface DeckCityViewProps {
  scenario: DistrictScenario;
  selectedBuildingId: string | null;
  onSelectBuilding: (buildingId: string) => void;
  activePathNodeIds: string[];
  edgeLoads: Record<string, number>;
  busPaths: Record<string, PathResult | null>;
  parkPaths: Record<string, PathResult | null>;
  simPlaying?: boolean;
  simSpeed?: 1 | 2 | 5;
}

type Vec3 = [number, number, number];

// САПР (960×620, Y вниз) → мир Deck.gl (центр в нуле, север вверх, Z вверх).
const toWorld = (x: number, y: number, z = 0): Vec3 => [x - 480, 320 - y, z];

// Подошва корпуса с учётом поворота вдоль улицы (зеркалит rotate() из 2D-карты).
function buildingFootprint(b: Building): [number, number][] {
  const corners: [number, number][] = [
    [b.x, b.y],
    [b.x + b.width, b.y],
    [b.x + b.width, b.y + b.height],
    [b.x, b.y + b.height],
  ];
  if (!b.rotationDeg) return corners;
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const rad = ((-b.rotationDeg * Math.PI) / 180);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return corners.map(([px, py]) => {
    const dx = px - cx;
    const dy = py - cy;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  });
}

interface Trip {
  path: Vec3[];
  timestamps: number[];
  color: [number, number, number];
}

// Путь Дейкстры → «рейс»: метки времени = накопленная длина (метры), хвост догоняет голову.
function pathToTrip(
  ids: string[],
  nodeMap: Map<string, GraphNode>,
  z: number,
  color: [number, number, number],
): Trip | null {
  const pts: Vec3[] = [];
  ids.forEach((id) => {
    const n = nodeMap.get(id);
    if (n) pts.push(toWorld(n.x, n.y, z));
  });
  if (pts.length < 2) return null;
  const timestamps: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    timestamps.push(
      timestamps[i - 1] +
        Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]),
    );
  }
  return { path: pts, timestamps, color };
}

// Архитектурный свет для экструдированных корпусов (синглтоны — вне рендера).
const ambientLight = new AmbientLight({ color: [255, 255, 255], intensity: 0.9 });
const dirLight = new DirectionalLight({
  color: [255, 255, 255],
  intensity: 1.8,
  direction: [-300, -500, -400],
});
const lightingEffect = new LightingEffect({ ambientLight, dirLight });
const orbitView = new OrbitView({ id: 'orbit' });

export default function DeckCityView({
  scenario,
  selectedBuildingId,
  onSelectBuilding,
  activePathNodeIds,
  edgeLoads,
  busPaths,
  parkPaths,
  simPlaying = true,
  simSpeed = 1,
}: DeckCityViewProps) {
  const nodeMap = useMemo(
    () => new Map<string, GraphNode>(scenario.nodes.map((n) => [n.id, n])),
    [scenario.nodes],
  );

  const busTrips = useMemo(
    () =>
      Object.values(busPaths)
        .map((p) => (p ? pathToTrip(p.pathNodeIds, nodeMap, 2, [96, 165, 250]) : null))
        .filter((t): t is Trip => t !== null),
    [busPaths, nodeMap],
  );
  const parkTrips = useMemo(
    () =>
      Object.values(parkPaths)
        .map((p) => (p ? pathToTrip(p.pathNodeIds, nodeMap, 2, [52, 211, 153]) : null))
        .filter((t): t is Trip => t !== null),
    [parkPaths, nodeMap],
  );

  const maxTime = useMemo(() => {
    let m = 0;
    [...busTrips, ...parkTrips].forEach((t) => {
      const last = t.timestamps[t.timestamps.length - 1] ?? 0;
      if (last > m) m = last;
    });
    return m > 1 ? m : 100;
  }, [busTrips, parkTrips]);

  // Игровая петля «головы» потоков; пауза и скорость — из тулбара симуляции.
  const [time, setTime] = useState(0);
  useEffect(() => {
    if (!simPlaying) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setTime((t) => (t + dt * 45 * (simSpeed ?? 1)) % maxTime);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [simPlaying, simSpeed, maxTime]);

  const activePathCoords = useMemo(() => {
    const pts: Vec3[] = [];
    activePathNodeIds.forEach((id) => {
      const n = nodeMap.get(id);
      if (n) pts.push(toWorld(n.x, n.y, 2.5));
    });
    return pts;
  }, [activePathNodeIds, nodeMap]);

  const layers = useMemo(() => {
    const parks = new PolygonLayer<Amenity>({
      id: 'parks-layer',
      data: scenario.amenities.filter((a) => a.type === 'park'),
      getPolygon: (p) => {
        if (p.polygon && p.polygon.length >= 3) {
          return p.polygon.map((pt) => toWorld(pt.x, pt.y, 0.2));
        }
        const n = nodeMap.get(p.nodeId);
        const cx = n?.x ?? 250;
        const cy = n?.y ?? 450;
        return [
          toWorld(cx - 75, cy - 55, 0.2),
          toWorld(cx + 75, cy - 55, 0.2),
          toWorld(cx + 75, cy + 55, 0.2),
          toWorld(cx - 75, cy + 55, 0.2),
        ];
      },
      getFillColor: [20, 83, 45, 180],
      getLineColor: [34, 197, 94, 200],
      lineWidthMinPixels: 1,
      stroked: true,
      filled: true,
    });

    const roads = new PathLayer<GraphEdge>({
      id: 'roads-layer',
      data: scenario.edges,
      getPath: (e) => {
        const u = nodeMap.get(e.from);
        const v = nodeMap.get(e.to);
        if (!u || !v) return [];
        return [toWorld(u.x, u.y, 0.6), toWorld(v.x, v.y, 0.6)];
      },
      getColor: (e) => {
        if (!e.isActive) return [239, 68, 68, 220];
        if (e.type === 'crossing') return [255, 255, 255, 240];
        if (e.type === 'road') return [51, 65, 85, 255];
        const load = edgeLoads[e.id] || 0;
        if (load > 400) return [249, 115, 22, 230];
        return [100, 116, 139, 200];
      },
      getWidth: (e) =>
        e.type === 'road' ? (e.lanes === 4 ? 22 : 14) : e.type === 'crossing' ? 6 : 4,
      widthMinPixels: 2,
      capRounded: true,
      jointRounded: true,
    });

    const busFlows = new TripsLayer<Trip>({
      id: 'bus-flows',
      data: busTrips,
      getPath: (d) => d.path,
      getTimestamps: (d) => d.timestamps,
      getColor: (d) => d.color,
      getWidth: 5,
      widthMinPixels: 3,
      capRounded: true,
      jointRounded: true,
      trailLength: 90,
      currentTime: time,
    });

    const parkFlows = new TripsLayer<Trip>({
      id: 'park-flows',
      data: parkTrips,
      getPath: (d) => d.path,
      getTimestamps: (d) => d.timestamps,
      getColor: (d) => d.color,
      getWidth: 4,
      widthMinPixels: 2,
      capRounded: true,
      jointRounded: true,
      trailLength: 70,
      currentTime: time,
    });

    const activePath =
      activePathCoords.length >= 2
        ? new PathLayer<{ path: Vec3[] }>({
            id: 'active-dijkstra-path',
            data: [{ path: activePathCoords }],
            getPath: (d) => d.path,
            getColor: [56, 189, 248, 255],
            getWidth: 7,
            widthMinPixels: 4,
            capRounded: true,
            jointRounded: true,
          })
        : null;

    const buildings = new PolygonLayer<Building>({
      id: 'buildings-3d-layer',
      data: scenario.buildings,
      extruded: true,
      wireframe: true,
      getPolygon: (b) => buildingFootprint(b).map(([px, py]) => toWorld(px, py)),
      getElevation: (b) => b.floors * 4.8,
      getFillColor: (b) =>
        b.id === selectedBuildingId ? [37, 99, 235, 230] : [30, 41, 59, 215],
      getLineColor: (b) =>
        b.id === selectedBuildingId ? [147, 197, 253, 255] : [71, 85, 105, 160],
      lineWidthMinPixels: 1.5,
      pickable: true,
      onClick: (info) => {
        const picked = info.object;
        if (picked) onSelectBuilding(picked.id);
      },
    });

    const busStops = new ScatterplotLayer<Amenity>({
      id: 'bus-stops-layer',
      data: scenario.amenities.filter((a) => a.type === 'bus_stop'),
      getPosition: (s) => {
        const n = nodeMap.get(s.nodeId);
        return toWorld(n?.x ?? 0, n?.y ?? 0, 3);
      },
      getRadius: 10,
      radiusMinPixels: 5,
      getFillColor: [59, 130, 246, 255],
      getLineColor: [255, 255, 255, 255],
      stroked: true,
      lineWidthMinPixels: 2,
    });

    return [parks, roads, busFlows, parkFlows, activePath, buildings, busStops].filter(
      (l) => l !== null,
    );
  }, [
    scenario.amenities,
    scenario.buildings,
    scenario.edges,
    nodeMap,
    edgeLoads,
    busTrips,
    parkTrips,
    activePathCoords,
    selectedBuildingId,
    onSelectBuilding,
    time,
  ]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-gray-700 bg-[#161a22] shadow-xl">
      <div className="flex h-8 items-center justify-between border-b border-gray-700 bg-[#11141c] px-3 font-mono text-[11px] text-gray-300 select-none">
        <span className="font-semibold text-blue-400">
          3D ДВОЙНИК НА DECK.GL: ПОТОКИ ПО ДЕЙКСТРЕ
        </span>
        <span className="text-gray-400">ЛКМ: Вращение | ПКМ: Панорама | Колесо: Зум</span>
      </div>
      <div className="relative h-[560px] w-full cursor-grab active:cursor-grabbing">
        <DeckGL
          views={orbitView}
          initialViewState={{
            target: [0, 0, 0],
            zoom: -0.9,
            rotationX: 50,
            rotationOrbit: 0,
            minZoom: -3,
            maxZoom: 5,
          }}
          controller
          layers={layers}
          effects={[lightingEffect]}
        />
      </div>
    </div>
  );
}
