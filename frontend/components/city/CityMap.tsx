// frontend/components/city/CityMap.tsx
'use client';

import { useEffect, useRef } from 'react';
import 'ol/ol.css';
import OlMap from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import OSM from 'ol/source/OSM.js';
import VectorSource from 'ol/source/Vector.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import Polygon from 'ol/geom/Polygon.js';
import LineString from 'ol/geom/LineString.js';
import { fromLonLat, toLonLat } from 'ol/proj.js';
import Translate from 'ol/interaction/Translate.js';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style.js';
import type { Building, DistrictModel } from '@/lib/city/model';
import type { WindCell } from '@/lib/city/wind';
import type { Metrics } from '@/lib/city/metrics';
import { GW_FILL, WATER_COLOR, type GwCell, type WaterFeature } from '@/lib/city/water';
import { POL_FILL, pollutionClass, type PollutionCell } from '@/lib/city/pollution';
import { gridToLonLat, lonLatToGrid } from '@/lib/city/proj';

interface Props {
  model: DistrictModel;
  metrics?: Metrics;
  selectedAttrId: string | null;
  addMode: boolean;
  shadowPolys: [number, number][][];
  windCells: WindCell[] | null;
  showShadow?: boolean;
  showOsm?: boolean;
  showTurb?: boolean;
  showPedestrians?: boolean;
  gwCells?: GwCell[] | null;
  water?: WaterFeature[];
  pollutionCells?: PollutionCell[] | null;
  ghostW?: number;
  ghostD?: number;
  ghostCollides?: boolean;
  onGhostCollide?: (collides: boolean) => void;
  onSelectBld?: (id: string | null) => void;
  onSelectAttr: (attrId: string | null) => void;
  onMoveAttrToNode: (attrId: string, nodeId: string) => void;
  onToggleEdge?: (edgeId: string) => void;
  onAddAt: (x: number, y: number) => void;
  className?: string;
}

const g2map = (x: number, y: number): [number, number] => {
  const [lon, lat] = gridToLonLat(x, y);
  return fromLonLat([lon, lat]) as [number, number];
};

export default function CityMap({
  model,
  metrics,
  selectedAttrId,
  addMode,
  shadowPolys,
  windCells,
  showShadow = true,
  showOsm = true,
  showTurb = true,
  showPedestrians = true,
  gwCells = null,
  water = [],
  pollutionCells = null,
  ghostW = 0,
  ghostD = 0,
  ghostCollides = false,
  onGhostCollide,
  onSelectBld,
  onSelectAttr,
  onMoveAttrToNode,
  onToggleEdge,
  onAddAt,
  className,
}: Props) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<OlMap | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const osmLayerRef = useRef<TileLayer<OSM> | null>(null);
  const shLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const buildLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const previewLayerRef = useRef<VectorLayer<VectorSource> | null>(null);

  const buildSrc = useRef(new VectorSource());
  const edgeSrc = useRef(new VectorSource());
  const attrSrc = useRef(new VectorSource());
  const houseSrc = useRef(new VectorSource());
  const shSrc = useRef(new VectorSource());
  const previewSrc = useRef(new VectorSource());
  const waterSrc = useRef(new VectorSource());
  const gwSrc = useRef(new VectorSource());
  const polSrc = useRef(new VectorSource());

  const cbRef = useRef({ onGhostCollide, onSelectBld, onSelectAttr, onMoveAttrToNode, onToggleEdge, onAddAt });
  cbRef.current = { onGhostCollide, onSelectBld, onSelectAttr, onMoveAttrToNode, onToggleEdge, onAddAt };
  const stateRef = useRef({ selectedAttrId, addMode });
  stateRef.current = { selectedAttrId, addMode };
  const ghostRef = useRef({ w: ghostW, d: ghostD });
  ghostRef.current = { w: ghostW, d: ghostD };
  const collideRef = useRef(ghostCollides);
  collideRef.current = ghostCollides;
  const modelRef = useRef(model);
  modelRef.current = model;
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;

    const osm = new TileLayer({
      source: new OSM(),
      opacity: 0.65,
    });

    // Эко-слои
    const waterLayer = new VectorLayer({
      source: waterSrc.current,
      zIndex: 5,
      style: (feature) => {
        const isPoly = feature.get('kind') === 'poly';
        return new Style({
          stroke: new Stroke({ color: WATER_COLOR, width: isPoly ? 1.2 : 2 }),
          fill: new Fill({ color: isPoly ? 'rgba(59, 130, 246, 0.12)' : 'rgba(0, 0, 0, 0)' }),
        });
      },
    });

    const gwStyles = GW_FILL.map((color) => new Style({ fill: new Fill({ color }) }));
    const gwLayer = new VectorLayer({
      source: gwSrc.current,
      zIndex: 6,
      style: (f) => gwStyles[(f.get('cls') as number) ?? 0] ?? gwStyles[0],
    });

    const polStyles = POL_FILL.map((color) => new Style({ fill: new Fill({ color }) }));
    const polLayer = new VectorLayer({
      source: polSrc.current,
      zIndex: 7,
      style: (f) => polStyles[(f.get('cls') as number) ?? 0] ?? polStyles[0],
    });

    // Тротуары и переходы (аккуратный дизайн, не лезущий на глаза)
    const edgeLayer = new VectorLayer({
      source: edgeSrc.current,
      zIndex: 8,
      style: (feat) => {
        const closed = feat.get('closed');
        const isPerehod = feat.get('edgeType') === 'perehod';
        if (closed) {
          return new Style({
            stroke: new Stroke({ color: '#ef4444', width: 3, lineDash: [5, 5] }),
          });
        }
        if (isPerehod) {
          return [
            new Style({ stroke: new Stroke({ color: '#ffffff', width: 5 }) }),
            new Style({ stroke: new Stroke({ color: '#3b82f6', width: 3, lineDash: [6, 4] }) }),
          ];
        }
        return [
          new Style({ stroke: new Stroke({ color: 'rgba(255,255,255,0.7)', width: 3 }) }),
          new Style({ stroke: new Stroke({ color: '#64748b', width: 1.6 }) }),
        ];
      },
    });

    // Тени строго под зданиями
    const shLayer = new VectorLayer({
      source: shSrc.current,
      zIndex: 10,
      style: new Style({
        fill: new Fill({ color: 'rgba(15, 23, 42, 0.42)' }),
        stroke: new Stroke({ color: 'rgba(15, 23, 42, 0.55)', width: 1 }),
      }),
    });

    // Здания непрозрачные, контрастные
    const buildLayer = new VectorLayer({
      source: buildSrc.current,
      zIndex: 20,
      style: (feature) => {
        const isCustom = feature.get('isCustom');
        return new Style({
          fill: new Fill({ color: isCustom ? '#2563eb' : '#475569' }),
          stroke: new Stroke({ color: isCustom ? '#1d4ed8' : '#1e293b', width: isCustom ? 2 : 1.2 }),
        });
      },
    });

    const houseLayer = new VectorLayer({
      source: houseSrc.current,
      zIndex: 25,
      style: (feat) =>
        new Style({
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color: '#f59e0b' }),
            stroke: new Stroke({ color: '#ffffff', width: 2 }),
          }),
          text: new Text({
            text: feat.get('label') ?? '',
            offsetY: -13,
            font: 'bold 11px Inter, sans-serif',
            fill: new Fill({ color: '#0f172a' }),
            stroke: new Stroke({ color: '#ffffff', width: 2 }),
          }),
        }),
    });

    const attrLayer = new VectorLayer({ source: attrSrc.current, zIndex: 30 });

    const previewLayer = new VectorLayer({
      source: previewSrc.current,
      zIndex: 40,
      style: new Style({
        fill: new Fill({ color: 'rgba(37, 99, 235, 0.25)' }),
        stroke: new Stroke({ color: '#2563eb', width: 2, lineDash: [6, 4] }),
      }),
    });

    const map = new OlMap({
      target: divRef.current,
      layers: [osm, waterLayer, gwLayer, polLayer, edgeLayer, shLayer, buildLayer, houseLayer, attrLayer, previewLayer],
      view: new View({ center: fromLonLat([36.61, 55.096]), zoom: 15.3 }),
    });

    osmLayerRef.current = osm;
    shLayerRef.current = shLayer;
    buildLayerRef.current = buildLayer;
    previewLayerRef.current = previewLayer;

    const translate = new Translate({
      layers: [attrLayer],
      filter: (f) => f.get('kind') === 'attr',
      hitTolerance: 12,
    });
    translate.on('translateend', (ev) => {
      const feat = ev.features.item(0);
      const attrId = feat?.get('attrId');
      const coords = (feat?.getGeometry() as Point)?.getCoordinates();
      if (!coords || !attrId) return;
      const [lon, lat] = toLonLat(coords);
      const [gx, gy] = lonLatToGrid(lon, lat);
      let best: string | null = null;
      let bestD = Infinity;
      for (const n of modelRef.current.nodes) {
        const d = Math.hypot(n.x - gx, n.y - gy);
        if (d < bestD) {
          bestD = d;
          best = n.id;
        }
      }
      if (best) cbRef.current.onMoveAttrToNode(attrId, best);
    });
    map.addInteraction(translate);

    map.on('singleclick', (e) => {
      const cb = cbRef.current;
      const st = stateRef.current;
      const [lon, lat] = toLonLat(e.coordinate);
      const [gx, gy] = lonLatToGrid(lon, lat);

      if (st.addMode) {
        cb.onAddAt(Math.round(gx), Math.round(gy));
        return;
      }

      const feats = map.getFeaturesAtPixel(e.pixel) ?? [];
      const edgeFeat = feats.find((f) => f.get('kind') === 'edge');
      if (edgeFeat && cb.onToggleEdge) {
        cb.onToggleEdge(edgeFeat.get('edgeId'));
        return;
      }

      const attrFeat = feats.find((f) => f.get('kind') === 'attr');
      if (attrFeat) {
        cb.onSelectAttr(attrFeat.get('attrId'));
        return;
      }

      const bldFeat = feats.find((f) => f.get('kind') === 'building');
      cb.onSelectBld?.(bldFeat ? bldFeat.get('buildingId') : null);
    });

    mapRef.current = map;
    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    osmLayerRef.current?.setVisible(showOsm);
    shLayerRef.current?.setVisible(showShadow);
    buildLayerRef.current?.setVisible(showOsm);
  }, [showOsm, showShadow]);

  // Синхронизация геометрии модели
  useEffect(() => {
    const nodeById = new Map(model.nodes.map((n) => [n.id, n]));

    // Дорожки
    edgeSrc.current.clear();
    for (const e of model.edges) {
      const A = nodeById.get(e.a);
      const B = nodeById.get(e.b);
      if (!A || !B) continue;
      const f = new Feature({ geometry: new LineString([g2map(A.x, A.y), g2map(B.x, B.y)]) });
      f.set('kind', 'edge');
      f.set('edgeId', e.id);
      f.set('edgeType', e.type);
      f.set('closed', !!e.closed);
      edgeSrc.current.addFeature(f);
    }

    // Жилые дома
    houseSrc.current.clear();
    for (const h of model.houses) {
      const n = nodeById.get(h.nodeId);
      if (!n) continue;
      const f = new Feature({ geometry: new Point(g2map(n.x, n.y)) });
      f.set('label', `${h.label} (${h.residents}ж)`);
      houseSrc.current.addFeature(f);
    }

    // Здания
    buildSrc.current.clear();
    const sorted = [...model.buildings].sort((a, b) => a.h - b.h);
    for (const b of sorted) {
      try {
        const f = new Feature({ geometry: new Polygon([b.footprint.map(([x, y]) => g2map(x, y))]) });
        f.set('kind', 'building');
        f.set('buildingId', b.id);
        f.set('isCustom', b.preset === 'custom');
        buildSrc.current.addFeature(f);
      } catch {
        /* ignore */
      }
    }

    // Тени
    shSrc.current.clear();
    for (const poly of shadowPolys) {
      try {
        shSrc.current.addFeature(new Feature({ geometry: new Polygon([poly.map(([x, y]) => g2map(x, y))]) }));
      } catch {
        /* ignore */
      }
    }

    // Остановки и Парки
    attrSrc.current.clear();
    for (const a of model.attractions) {
      const n = nodeById.get(a.nodeId);
      if (!n) continue;
      const isSel = a.id === selectedAttrId;
      const f = new Feature({ geometry: new Point(g2map(n.x, n.y)) });
      f.set('kind', 'attr');
      f.set('attrId', a.id);
      f.setStyle(
        new Style({
          image: new CircleStyle({
            radius: isSel ? 14 : 11,
            fill: new Fill({ color: a.kind === 'ostanovka' ? '#2563eb' : '#16a34a' }),
            stroke: new Stroke({ color: '#ffffff', width: isSel ? 3 : 2 }),
          }),
          text: new Text({
            text: a.kind === 'ostanovka' ? 'О' : 'П',
            fill: new Fill({ color: '#fff' }),
            font: 'bold 12px Inter, sans-serif',
          }),
        }),
      );
      attrSrc.current.addFeature(f);
    }
  }, [model, selectedAttrId, shadowPolys]);

  // Эко-слои
  useEffect(() => {
    const rect = (x: number, y: number, w: number, h: number): [number, number][] =>
      [g2map(x, y), g2map(x + w, y), g2map(x + w, y + h), g2map(x, y + h)];

    waterSrc.current.clear();
    gwSrc.current.clear();
    if (gwCells) {
      for (const wf of water) {
        try {
          if (wf.line && wf.line.length >= 2) {
            const f = new Feature({ geometry: new LineString(wf.line.map(([x, y]) => g2map(x, y))) });
            f.set('kind', 'line');
            waterSrc.current.addFeature(f);
          } else if (wf.polygon && wf.polygon.length >= 3) {
            const f = new Feature({ geometry: new Polygon([wf.polygon.map(([x, y]) => g2map(x, y))]) });
            f.set('kind', 'poly');
            waterSrc.current.addFeature(f);
          }
        } catch {}
      }
      for (const c of gwCells) {
        try {
          const f = new Feature({ geometry: new Polygon([rect(c.x, c.y, c.w, c.h)]) });
          f.set('cls', c.cls);
          gwSrc.current.addFeature(f);
        } catch {}
      }
    }

    polSrc.current.clear();
    if (pollutionCells) {
      for (const c of pollutionCells) {
        try {
          const f = new Feature({ geometry: new Polygon([rect(c.x, c.y, c.w, c.h)]) });
          f.set('cls', pollutionClass(c.v));
          polSrc.current.addFeature(f);
        } catch {}
      }
    }
  }, [gwCells, water, pollutionCells]);

  // КАНВАС: Киношный непрерывный шелковистый ветер (trail) + доплеровские вихри + пешеходы
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Холст со следом затухания
    const trail = document.createElement('canvas');
    const tctx = trail.getContext('2d');
    if (!tctx) return;

    let width = 1;
    let height = 1;
    const fit = () => {
      const host = canvas.parentElement;
      if (!host) return;
      const r = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = r.width;
      height = r.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      trail.width = canvas.width;
      trail.height = canvas.height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const map = mapRef.current;
    const toPx = (gx: number, gy: number): [number, number] | null => {
      if (!map) return null;
      const px = map.getPixelFromCoordinate(g2map(gx, gy));
      return px ? [px[0], px[1]] : null;
    };

    const streamColor = (speed: number, alpha: number): string => {
      if (speed < 1.5) return `rgba(148, 163, 184, ${alpha * 0.7})`;
      if (speed < 4.0) return `rgba(224, 242, 254, ${alpha * 0.9})`;
      if (speed < 7.5) return `rgba(56, 189, 248, ${alpha * 0.95})`;
      return `rgba(52, 211, 153, ${alpha})`;
    };

    const drawTurb = (target: CanvasRenderingContext2D) => {
      if (!showTurb || !windCells) return;
      target.save();
      target.globalCompositeOperation = 'screen';
      const half = 1000 / 24;
      for (const c of windCells) {
        if (!c.turb || c.turb < 0.45) continue;
        const center = toPx(c.x, c.y);
        const edge = toPx(c.x + half, c.y);
        if (!center || !edge) continue;
        const rad = Math.max(25, Math.hypot(edge[0] - center[0], edge[1] - center[1]) * 1.6);
        const g = target.createRadialGradient(center[0], center[1], 2, center[0], center[1], rad);
        if (c.turb > 0.65) {
          g.addColorStop(0, 'rgba(239, 68, 68, 0.65)');
          g.addColorStop(0.4, 'rgba(249, 115, 22, 0.35)');
          g.addColorStop(1, 'rgba(239, 68, 68, 0)');
        } else {
          g.addColorStop(0, 'rgba(245, 158, 11, 0.6)');
          g.addColorStop(0.5, 'rgba(251, 191, 36, 0.25)');
          g.addColorStop(1, 'rgba(245, 158, 11, 0)');
        }
        target.fillStyle = g;
        target.beginPath();
        target.arc(center[0], center[1], rad, 0, Math.PI * 2);
        target.fill();
      }
      target.restore();
    };

    // 600 долгоживущих шелковистых частиц
    const parts = Array.from({ length: 550 }, () => ({
      x: Math.random() * 1000,
      y: Math.random() * 1000,
      age: Math.floor(Math.random() * 140),
      maxAge: 160 + Math.random() * 120,
    }));

    // 60 пешеходов
    const peds = Array.from({ length: 60 }, (_, i) => ({
      houseIdx: i % Math.max(1, modelRef.current.houses.length),
      t: Math.random(),
      speed: 0.003 + Math.random() * 0.003,
    }));

    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.045, (now - last) / 1000);
      last = now;

      // Мягкое угасание шлейфа ветра
      tctx.globalCompositeOperation = 'destination-out';
      tctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      tctx.fillRect(0, 0, width, height);
      tctx.globalCompositeOperation = 'source-over';
      tctx.lineWidth = 1.5;
      tctx.lineCap = 'round';

      if (windCells && windCells.length > 0) {
        const u = windCells[0];
        const baseSpeed = Math.max(1, u.speed) * 26;

        for (const p of parts) {
          // Интерполяция вектора из сетки
          const gx = Math.min(11, Math.max(0, Math.floor(p.x / (1000 / 12))));
          const gy = Math.min(11, Math.max(0, Math.floor(p.y / (1000 / 12))));
          const cell = windCells[gx * 12 + gy] || u;

          const nx = p.x + cell.ux * cell.speed * dt * 26;
          const ny = p.y + cell.uy * cell.speed * dt * 26;

          const p0 = toPx(p.x, p.y);
          const p1 = toPx(nx, ny);

          if (p0 && p1 && p.age < p.maxAge) {
            const life = p.age / p.maxAge;
            const alpha = Math.sin(Math.min(1, life) * Math.PI) * 0.9;
            tctx.strokeStyle = streamColor(cell.speed, alpha);
            tctx.beginPath();
            tctx.moveTo(p0[0], p0[1]);
            tctx.lineTo(p1[0], p1[1]);
            tctx.stroke();

            // Искорки
            if (cell.speed > 3 && Math.random() < 0.18) {
              tctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
              tctx.beginPath();
              tctx.arc(p1[0], p1[1], 1.2, 0, Math.PI * 2);
              tctx.fill();
            }
          }

          p.x = nx;
          p.y = ny;
          p.age += 1;

          if (p.x < 0) p.x += 1000;
          if (p.x > 1000) p.x -= 1000;
          if (p.y < 0) p.y += 1000;
          if (p.y > 1000) p.y -= 1000;
          if (p.age >= p.maxAge) {
            p.age = 0;
            p.maxAge = 160 + Math.random() * 120;
          }
        }
      }

      ctx.clearRect(0, 0, width, height);
      drawTurb(ctx);
      ctx.drawImage(trail, 0, 0, width, height);

      // ПЕШЕХОДЫ: сочные огоньки шагают по улицам
      if (showPedestrians && metricsRef.current) {
        const nodeMap = new Map(modelRef.current.nodes.map((n) => [n.id, n]));

        for (const ped of peds) {
          const pathInfo = metricsRef.current.paths[ped.houseIdx];
          const nodePath = pathInfo?.ostanovkaNodePath;
          if (!nodePath || nodePath.length < 2) continue;

          ped.t += ped.speed;
          if (ped.t >= 1) ped.t = 0;

          const segCount = nodePath.length - 1;
          const globalSeg = ped.t * segCount;
          const segIdx = Math.min(segCount - 1, Math.floor(globalSeg));
          const segT = globalSeg - segIdx;

          const na = nodeMap.get(nodePath[segIdx]);
          const nb = nodeMap.get(nodePath[segIdx + 1]);
          if (!na || !nb) continue;

          const gx = na.x + (nb.x - na.x) * segT;
          const gy = na.y + (nb.y - na.y) * segT;
          const pt = toPx(gx, gy);

          if (pt) {
            ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
            ctx.beginPath();
            ctx.arc(pt[0], pt[1], 5.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(pt[0], pt[1], 3.2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(pt[0], pt[1], 1.4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [windCells, showTurb, showPedestrians]);

  return (
    <div
      role="img"
      aria-label="Схема района и симуляция потоков"
      className={`relative ${className ?? 'h-[520px] w-full overflow-hidden rounded-[28px] border border-white/60 dark:border-white/20'}`}
    >
      <div ref={divRef} className="absolute inset-0" />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}