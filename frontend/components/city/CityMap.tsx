// Кейс 03 — 2D-карта на OpenLayers. Подложка OSM приглушённая, поверх вектор.
// Канвас сплошной (стекло только в панелях, см. AGENTS.md).
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
import LineString from 'ol/geom/LineString.js';
import Polygon from 'ol/geom/Polygon.js';
import { fromLonLat, toLonLat } from 'ol/proj.js';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style.js';
import type { DistrictModel } from '@/lib/city/model';
import { gridToLonLat, lonLatToGrid } from '@/lib/city/proj';

interface Props {
  model: DistrictModel;
  selectedAttrId: string | null;
  addMode: boolean;
  shadowPolys: [number, number][][];
  onToggleEdge: (edgeId: string) => void;
  onSelectAttr: (attrId: string | null) => void;
  onMoveAttrToNode: (nodeId: string) => void;
  onAddAt: (x: number, y: number) => void;
  className?: string;
}

const g2map = (x: number, y: number): [number, number] => {
  const [lon, lat] = gridToLonLat(x, y);
  return fromLonLat([lon, lat]) as [number, number];
};

export default function CityMap({ model, selectedAttrId, addMode, shadowPolys, onToggleEdge, onSelectAttr, onMoveAttrToNode, onAddAt, className }: Props) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<OlMap | null>(null);
  const buildSrc = useRef(new VectorSource());
  const netSrc = useRef(new VectorSource());
  const attrSrc = useRef(new VectorSource());
  const shSrc = useRef(new VectorSource());
  const cbRef = useRef({ onToggleEdge, onSelectAttr, onMoveAttrToNode, onAddAt });
  cbRef.current = { onToggleEdge, onSelectAttr, onMoveAttrToNode, onAddAt };
  const stateRef = useRef({ selectedAttrId, addMode });
  stateRef.current = { selectedAttrId, addMode };

  // Создание карты один раз.
  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const osm = new TileLayer({ source: new OSM(), opacity: 0.55 });
    const shLayer = new VectorLayer({
      source: shSrc.current,
      style: new Style({ fill: new Fill({ color: 'rgba(51,65,85,0.35)' }), stroke: new Stroke({ color: 'rgba(51,65,85,0.6)', width: 1 }) }),
    });
    const buildLayer = new VectorLayer({
      source: buildSrc.current,
      style: new Style({ fill: new Fill({ color: 'rgba(143,163,184,0.55)' }), stroke: new Stroke({ color: '#475569', width: 1.2 }) }),
    });
    const netLayer = new VectorLayer({ source: netSrc.current });
    const attrLayer = new VectorLayer({ source: attrSrc.current });
    const map = new OlMap({
      target: divRef.current,
      layers: [osm, shLayer, buildLayer, netLayer, attrLayer],
      view: new View({ center: fromLonLat([36.61, 55.096]), zoom: 15 }),
    });
    map.on('singleclick', (e) => {
      const cb = cbRef.current;
      const st = stateRef.current;
      const [lon, lat] = toLonLat(e.coordinate);
      const [gx, gy] = lonLatToGrid(lon, lat);
      if (gx < -50 || gx > 1050 || gy < -50 || gy > 1050) return;
      if (st.addMode) {
        cb.onAddAt(Math.round(gx), Math.round(gy));
        return;
      }
      // Приоритет: ребро -> переключить; точка притяжения -> выбрать; узел при выбранном -> перенести.
      let handled = false;
      map.forEachFeatureAtPixel(e.pixel, (f) => {
        const kind = f.get('kind');
        if (kind === 'edge') {
          cb.onToggleEdge(f.get('edgeId'));
          handled = true;
          return true;
        }
        if (kind === 'attr') {
          cb.onSelectAttr(f.get('attrId'));
          handled = true;
          return true;
        }
        if (kind === 'node' && st.selectedAttrId) {
          cb.onMoveAttrToNode(f.get('nodeId'));
          handled = true;
          return true;
        }
        return false;
      });
      if (!handled) cb.onSelectAttr(null);
    });
    mapRef.current = map;
    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, []);

  // Перерисовка вектора при смене модели.
  useEffect(() => {
    const nodeById = new Map(model.nodes.map((n) => [n.id, n]));
    // Здания.
    buildSrc.current.clear();
    for (const b of model.buildings) {
      try {
        const ring = b.footprint.map(([x, y]) => g2map(x, y));
        const f = new Feature({ geometry: new Polygon([ring]) });
        buildSrc.current.addFeature(f);
      } catch {
        /* пропускаем битую геометрию */
      }
    }
    // Тени.
    shSrc.current.clear();
    for (const poly of shadowPolys) {
      try {
        shSrc.current.addFeature(new Feature({ geometry: new Polygon([poly.map(([x, y]) => g2map(x, y))]) }));
      } catch {
        /* ignore */
      }
    }
    // Сеть.
    netSrc.current.clear();
    for (const e of model.edges) {
      const A = nodeById.get(e.a);
      const B = nodeById.get(e.b);
      if (!A || !B) continue;
      const f = new Feature({ geometry: new LineString([g2map(A.x, A.y), g2map(B.x, B.y)]) });
      f.set('kind', 'edge');
      f.set('edgeId', e.id);
      f.setStyle(
        new Style({
          stroke: new Stroke({
            color: e.closed ? '#dc2626' : e.type === 'perehod' ? '#2563eb' : '#64748b',
            width: e.type === 'perehod' ? 4 : 2.5,
            lineDash: e.closed ? [6, 5] : undefined,
          }),
        }),
      );
      netSrc.current.addFeature(f);
    }
    for (const n of model.nodes) {
      const isHouse = model.houses.some((h) => h.nodeId === n.id);
      const f = new Feature({ geometry: new Point(g2map(n.x, n.y)) });
      f.set('kind', 'node');
      f.set('nodeId', n.id);
      f.setStyle(
        new Style({
          image: new CircleStyle({
            radius: isHouse ? 6 : 4,
            fill: new Fill({ color: isHouse ? '#1e293b' : '#ffffff' }),
            stroke: new Stroke({ color: '#1e293b', width: 1.5 }),
          }),
        }),
      );
      netSrc.current.addFeature(f);
    }
    // Притяжения.
    attrSrc.current.clear();
    const colors: Record<string, string> = { ostanovka: '#2563eb', park: '#16a34a', shkola: '#d97706' };
    for (const a of model.attractions) {
      const N = nodeById.get(a.nodeId);
      if (!N) continue;
      const sel = a.id === selectedAttrId;
      const f = new Feature({ geometry: new Point(g2map(N.x, N.y)) });
      f.set('kind', 'attr');
      f.set('attrId', a.id);
      f.setStyle(
        new Style({
          image: new CircleStyle({
            radius: sel ? 11 : 8,
            fill: new Fill({ color: colors[a.kind] ?? '#2563eb' }),
            stroke: new Stroke({ color: '#ffffff', width: sel ? 3 : 2 }),
          }),
          text: new Text({ text: a.kind === 'ostanovka' ? 'О' : a.kind === 'park' ? 'П' : 'Ш', fill: new Fill({ color: '#fff' }), font: 'bold 10px sans-serif', offsetY: 0 }),
        }),
      );
      attrSrc.current.addFeature(f);
    }
  }, [model, selectedAttrId, shadowPolys]);

  return (
    <div
      ref={divRef}
      role="img"
      aria-label="Схема района: здания, пешеходная сеть, остановки и парк. Клик по переходу закрывает или открывает его."
      className={
        className ??
        'h-[420px] w-full overflow-hidden rounded-[24px] border border-white/60 dark:border-white/20'
      }
    />
  );
}
