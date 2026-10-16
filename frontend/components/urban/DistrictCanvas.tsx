'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { DistrictState, UrbanTool } from '@/lib/urban/types';
import { METERS_PER_CELL } from '@/lib/urban/types';
import { GRID_W, GRID_H, nearestNode } from '@/lib/urban/defaultDistrict';
import type { ResidentRoute } from '@/lib/urban/paths';

interface DistrictCanvasProps {
  state: DistrictState;
  tool: UrbanTool;
  flowByEdge: Map<string, number>;
  bottleneckEdgeIds: string[];
  routes: ResidentRoute[];
  houseResidents: number;
  paused: boolean;
  onChange: (next: DistrictState) => void;
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000000)}`;
}

function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Тепловая карта: зелёный → жёлтый → красный по доле от максимума. */
function heatColor(flow: number, maxFlow: number, isDark: boolean): string {
  if (flow <= 0 || maxFlow <= 0) return isDark ? 'rgba(148,163,184,0.7)' : 'rgba(100,116,139,0.6)';
  const t = Math.max(0, Math.min(1, flow / maxFlow));
  const stops: [number, [number, number, number]][] = [
    [0, [34, 197, 94]],
    [0.5, [250, 204, 21]],
    [1, [239, 68, 68]],
  ];
  let a = stops[0];
  let b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      a = stops[i];
      b = stops[i + 1];
      break;
    }
  }
  const span = b[0] - a[0] || 1;
  const k = (t - a[0]) / span;
  const r = Math.round(a[1][0] + (b[1][0] - a[1][0]) * k);
  const g = Math.round(a[1][1] + (b[1][1] - a[1][1]) * k);
  const bl = Math.round(a[1][2] + (b[1][2] - a[1][2]) * k);
  return `rgba(${r},${g},${bl},${isDark ? 0.9 : 0.85})`;
}

/**
 * Интерактивное поле конструктора на нативном canvas (HiDPI как PulseLogo).
 * Сетка + snap, слои графа, тепловая карта, частицы жителей по маршрутам.
 */
export default function DistrictCanvas({
  state,
  tool,
  flowByEdge,
  bottleneckEdgeIds,
  routes,
  houseResidents,
  paused,
  onChange,
}: DistrictCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef(state);
  const toolRef = useRef(tool);
  const flowRef = useRef(flowByEdge);
  const bottleRef = useRef(bottleneckEdgeIds);
  const routesRef = useRef(routes);
  const pausedRef = useRef(paused);
  const pendingNodeRef = useRef<string | null>(null);
  const dragRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const changeRef = useRef(onChange);
  const residentsRef = useRef(houseResidents);

  stateRef.current = state;
  toolRef.current = tool;
  flowRef.current = flowByEdge;
  bottleRef.current = bottleneckEdgeIds;
  routesRef.current = routes;
  pausedRef.current = paused;
  changeRef.current = onChange;
  residentsRef.current = houseResidents;

  useEffect(() => {
    pendingNodeRef.current = null;
    dragRef.current = null;
  }, [tool]);

  // Полилинии маршрутов для частиц (в клетках сетки).
  const polylines = useMemo(() => {
    const nodeById = new Map(state.nodes.map((n) => [n.id, n]));
    const edgeById = new Map(state.edges.map((e) => [e.id, e]));
    return routes
      .map((r) => {
        if (r.edgeIds.length === 0) return null;
        // Восстанавливаем узлы цепочки через рёбра.
        const pts: { x: number; y: number }[] = [];
        let cur: string | null = null;
        // Начало — nearestNode дома.
        const b = state.buildings.find((x) => x.id === r.buildingId);
        if (!b) return null;
        cur = b.nearestNodeId;
        const start = nodeById.get(cur);
        if (!start) return null;
        pts.push({ x: start.x, y: start.y });
        for (const eid of r.edgeIds) {
          const e = edgeById.get(eid);
          if (!e || cur === null) return null;
          const fromId: string = e.from;
          const toId: string = e.to;
          const nextId: string = fromId === cur ? toId : fromId;
          const nn = nodeById.get(nextId);
          if (!nn) return null;
          pts.push({ x: nn.x, y: nn.y });
          cur = nextId;
        }
        // Длина в клетках для равномерного движения.
        let total = 0;
        const cum: number[] = [0];
        for (let i = 1; i < pts.length; i++) {
          total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
          cum.push(total);
        }
        if (total === 0) return null;
        return { pts, cum, total, kind: r.kind, residents: r.residents };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .slice(0, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.nodes, state.edges, state.buildings, routes]);

  const polyRef = useRef(polylines);
  polyRef.current = polylines;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let disposed = false;
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    let isDark = darkQuery.matches;
    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const geom = () => {
      const dpr = Math.min((window.devicePixelRatio || 1) * 2, 6);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.max(1, Math.ceil(w * dpr));
      canvas.height = Math.max(1, Math.ceil(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cell = Math.min(w / GRID_W, h / GRID_H);
      const ox = (w - cell * GRID_W) / 2;
      const oy = (h - cell * GRID_H) / 2;
      return { w, h, cell, ox, oy };
    };
    let g = geom();

    const onResize = () => {
      if (!disposed) g = geom();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(wrap);

    const toPx = (gx: number, gy: number) => ({ x: g.ox + gx * g.cell, y: g.oy + gy * g.cell });

    const draw = (t: number) => {
      const st = stateRef.current;
      const flow = flowRef.current;
      const bottles = new Set(bottleRef.current);
      ctx.clearRect(0, 0, g.w, g.h);
      // Подложка.
      ctx.fillStyle = isDark ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.55)';
      ctx.fillRect(0, 0, g.w, g.h);
      // Сетка.
      ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(100,116,139,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= GRID_W; i++) {
        const x = g.ox + i * g.cell;
        ctx.moveTo(x, g.oy);
        ctx.lineTo(x, g.oy + GRID_H * g.cell);
      }
      for (let j = 0; j <= GRID_H; j++) {
        const y = g.oy + j * g.cell;
        ctx.moveTo(g.ox, y);
        ctx.lineTo(g.ox + GRID_W * g.cell, y);
      }
      ctx.stroke();

      const nodeById = new Map(st.nodes.map((n) => [n.id, n]));
      let maxFlow = 0;
      flow.forEach((v) => {
        maxFlow = Math.max(maxFlow, v);
      });

      // Рёбра с тепловой картой.
      for (const e of st.edges) {
        const a = nodeById.get(e.from);
        const b = nodeById.get(e.to);
        if (!a || !b) continue;
        const pa = toPx(a.x, a.y);
        const pb = toPx(b.x, b.y);
        const f = e.blocked ? 0 : (flow.get(e.id) ?? 0);
        ctx.save();
        if (e.blocked) ctx.setLineDash([6, 5]);
        ctx.strokeStyle = e.blocked
          ? (isDark ? 'rgba(148,163,184,0.5)' : 'rgba(100,116,139,0.5)')
          : heatColor(f, maxFlow, isDark);
        ctx.lineWidth = bottles.has(e.id) ? 5 : 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
        ctx.restore();
        // Зебра перехода.
        if (e.hasCrossing && !e.blocked) {
          const mx = (pa.x + pb.x) / 2;
          const my = (pa.y + pb.y) / 2;
          ctx.save();
          ctx.fillStyle = isDark ? 'rgba(226,232,240,0.9)' : 'rgba(30,41,59,0.85)';
          const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x) + Math.PI / 2;
          for (let k = -2; k <= 2; k++) {
            const px = mx + Math.cos(ang) * k * 4;
            const py = my + Math.sin(ang) * k * 4;
            ctx.fillRect(px - 3, py - 1.5, 6, 3);
          }
          ctx.restore();
        }
        if (e.blocked) {
          const mx = (pa.x + pb.x) / 2;
          const my = (pa.y + pb.y) / 2;
          ctx.save();
          ctx.font = `700 ${Math.max(11, g.cell * 0.5)}px Inter, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = isDark ? '#fca5a5' : '#b91c1c';
          ctx.fillText('⌀', mx, my - 8);
          ctx.restore();
        }
      }

      // Парки (под зданиями).
      for (const p of st.pois.filter((x) => x.type === 'PARK')) {
        const c = toPx(p.x, p.y);
        ctx.save();
        ctx.fillStyle = isDark ? 'rgba(34,197,94,0.30)' : 'rgba(34,197,94,0.25)';
        ctx.strokeStyle = isDark ? 'rgba(34,197,94,0.8)' : 'rgba(22,101,52,0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(c.x, c.y, g.cell * 0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.font = `${Math.max(13, g.cell * 0.7)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('❧', c.x, c.y);
        ctx.restore();
      }

      // Дома.
      for (const b of st.buildings) {
        const tl = toPx(b.x, b.y);
        const wpx = b.w * g.cell;
        const hpx = b.h * g.cell;
        ctx.save();
        ctx.fillStyle = isDark ? 'rgba(51,65,85,0.9)' : 'rgba(30,41,59,0.85)';
        ctx.strokeStyle = isDark ? 'rgba(226,232,240,0.7)' : 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(tl.x, tl.y, wpx, hpx, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = `600 ${Math.max(10, Math.min(13, g.cell * 0.5))}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(b.residents), tl.x + wpx / 2, tl.y + hpx / 2);
        ctx.restore();
        // Линк к узлу.
        const nn = nodeById.get(b.nearestNodeId);
        if (nn) {
          const c = toPx(b.x + b.w / 2, b.y + b.h / 2);
          const pn = toPx(nn.x, nn.y);
          ctx.save();
          ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.5)' : 'rgba(100,116,139,0.5)';
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(pn.x, pn.y);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Остановки.
      for (const p of st.pois.filter((x) => x.type !== 'PARK')) {
        const c = toPx(p.x, p.y);
        ctx.save();
        ctx.fillStyle = '#2563eb';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c.x, c.y, Math.max(7, g.cell * 0.35), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = `700 ${Math.max(9, g.cell * 0.4)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.type === 'SHOP' ? '$' : 'А', c.x, c.y + 0.5);
        ctx.restore();
      }

      // Узлы.
      for (const n of st.nodes) {
        const c = toPx(n.x, n.y);
        const isPending = pendingNodeRef.current === n.id;
        ctx.save();
        ctx.fillStyle = isPending ? '#2563eb' : isDark ? '#e2e8f0' : '#1e293b';
        ctx.beginPath();
        ctx.arc(c.x, c.y, isPending ? 7 : 4.5, 0, Math.PI * 2);
        ctx.fill();
        if (isPending) {
          ctx.strokeStyle = '#93c5fd';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(c.x, c.y, 11, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Частицы жителей.
      const still = pausedRef.current || reduceQuery.matches;
      const polys = polyRef.current;
      const speed = g.cell * 1.6; // клеток/сек в px
      polys.forEach((poly, idx) => {
        const dots = Math.max(1, Math.min(3, Math.round(poly.residents / 80)));
        for (let d = 0; d < dots; d++) {
          const phase = (idx * 0.37 + d / dots) % 1;
          const tt = still ? phase : (phase + t * 0.06 * (poly.kind === 'bus' ? 1 : 0.7)) % 1;
          const target = tt * poly.total;
          let seg = 0;
          while (seg < poly.cum.length - 1 && poly.cum[seg + 1] < target) seg++;
          const c0 = poly.cum[seg];
          const c1 = poly.cum[seg + 1] ?? c0 + 1;
          const k = c1 === c0 ? 0 : (target - c0) / (c1 - c0);
          void speed;
          const gx = poly.pts[seg].x + (poly.pts[seg + 1].x - poly.pts[seg].x) * k;
          const gy = poly.pts[seg].y + (poly.pts[seg + 1].y - poly.pts[seg].y) * k;
          const c = toPx(gx, gy);
          ctx.save();
          ctx.fillStyle = poly.kind === 'bus' ? '#2563eb' : '#16a34a';
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(c.x, c.y, 3.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      });

      // Превью: pending-ребро и drag-прямоугольник.
      const hov = hoverRef.current;
      if (hov && toolRef.current === 'road' && pendingNodeRef.current) {
        const pn = nodeById.get(pendingNodeRef.current);
        if (pn) {
          const pa = toPx(pn.x, pn.y);
          const pb = toPx(hov.x, hov.y);
          ctx.save();
          ctx.strokeStyle = '#2563eb';
          ctx.setLineDash([5, 4]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.stroke();
          ctx.restore();
        }
      }
      const drag = dragRef.current;
      if (drag) {
        const x0 = Math.min(drag.x0, drag.x1);
        const y0 = Math.min(drag.y0, drag.y1);
        const x1 = Math.max(drag.x0, drag.x1);
        const y1 = Math.max(drag.y0, drag.y1);
        const pa = toPx(Math.floor(x0), Math.floor(y0));
        const pb = toPx(Math.ceil(x1), Math.ceil(y1));
        ctx.save();
        ctx.fillStyle = 'rgba(37,99,235,0.15)';
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1.5;
        ctx.fillRect(pa.x, pa.y, pb.x - pa.x, pb.y - pa.y);
        ctx.strokeRect(pa.x, pa.y, pb.x - pa.x, pb.y - pa.y);
        ctx.restore();
      }
      // Курсор-прицел.
      if (hov) {
        const c = toPx(Math.round(hov.x), Math.round(hov.y));
        ctx.save();
        ctx.strokeStyle = 'rgba(37,99,235,0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    };

    const start = performance.now();
    const loop = (now: number) => {
      if (disposed) return;
      draw((now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    if (reduceQuery.matches && pausedRef.current) draw(0);
    else raf = requestAnimationFrame(loop);

    const onTheme = () => {
      isDark = darkQuery.matches;
    };
    darkQuery.addEventListener('change', onTheme);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      darkQuery.removeEventListener('change', onTheme);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Интеракт: pointer → сетка ---
  const toGrid = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const cell = Math.min(w / GRID_W, h / GRID_H);
    const ox = (w - cell * GRID_W) / 2;
    const oy = (h - cell * GRID_H) / 2;
    return { x: (clientX - rect.left - ox) / cell, y: (clientY - rect.top - oy) / cell };
  };

  const commit = (next: DistrictState) => changeRef.current(next);

  const findNodeNear = (gx: number, gy: number): string | null => {
    let best: string | null = null;
    let bestD = 0.6;
    for (const n of stateRef.current.nodes) {
      const d = Math.hypot(n.x - gx, n.y - gy);
      if (d < bestD) {
        bestD = d;
        best = n.id;
      }
    }
    return best;
  };

  const findEdgeNear = (gx: number, gy: number): string | null => {
    const byId = new Map(stateRef.current.nodes.map((n) => [n.id, n]));
    let best: string | null = null;
    let bestD = 0.45;
    for (const e of stateRef.current.edges) {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (!a || !b) continue;
      const d = distToSeg(gx, gy, a.x, a.y, b.x, b.y);
      if (d < bestD) {
        bestD = d;
        best = e.id;
      }
    }
    return best;
  };

  const handleDown = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = toGrid(ev.clientX, ev.clientY);
    const gx = Math.max(0, Math.min(GRID_W, x));
    const gy = Math.max(0, Math.min(GRID_H, y));
    const tool = toolRef.current;
    const st = stateRef.current;

    if (tool === 'house' || tool === 'park') {
      dragRef.current = { x0: gx, y0: gy, x1: gx, y1: gy };
      (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
      return;
    }
    if (tool === 'road') {
      let id = findNodeNear(gx, gy);
      const snap = { x: Math.round(gx), y: Math.round(gy) };
      if (!id) {
        id = uid('n');
        commit({ ...st, nodes: [...st.nodes, { id, x: snap.x, y: snap.y }] });
      }
      const pending = pendingNodeRef.current;
      if (pending && pending !== id) {
        const a = stateRef.current.nodes.find((n) => n.id === pending);
        const b = stateRef.current.nodes.find((n) => n.id === id);
        if (a && b) {
          const exists = stateRef.current.edges.some(
            (e) => (e.from === pending && e.to === id) || (e.from === id && e.to === pending),
          );
          if (!exists) {
            const length = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) * METERS_PER_CELL));
            commit({
              ...stateRef.current,
              edges: [...stateRef.current.edges, { id: uid('e'), from: pending, to: id, length }],
            });
          }
        }
        pendingNodeRef.current = id;
      } else if (pending === id) {
        pendingNodeRef.current = null;
      } else {
        pendingNodeRef.current = id;
      }
      return;
    }
    if (tool === 'crossing') {
      const eid = findEdgeNear(gx, gy);
      if (eid) {
        commit({
          ...st,
          edges: st.edges.map((e) => (e.id === eid ? { ...e, hasCrossing: true, blocked: false } : e)),
        });
      }
      return;
    }
    if (tool === 'stop') {
      const snap = { x: Math.round(gx), y: Math.round(gy) };
      let nodeId = findNodeNear(gx, gy);
      let nodes = st.nodes;
      if (!nodeId) {
        nodeId = uid('n');
        nodes = [...nodes, { id: nodeId, x: snap.x, y: snap.y }];
      }
      const count = st.pois.length + 1;
      commit({
        ...st,
        nodes,
        pois: [...st.pois, { id: uid('p'), type: 'BUS_STOP', x: snap.x, y: snap.y, nearestNodeId: nodeId, name: `Остановка №${count}` }],
      });
      return;
    }
    if (tool === 'delete') {
      // Приоритет: POI → дом → ребро → узел.
      const poi = st.pois.find((p) => Math.hypot(p.x - gx, p.y - gy) < 0.7);
      if (poi) {
        commit({ ...st, pois: st.pois.filter((p) => p.id !== poi.id) });
        return;
      }
      const b = st.buildings.find(
        (x) => gx >= x.x && gx <= x.x + x.w && gy >= x.y && gy <= x.y + x.h,
      );
      if (b) {
        commit({ ...st, buildings: st.buildings.filter((x) => x.id !== b.id) });
        return;
      }
      const eid = findEdgeNear(gx, gy);
      if (eid) {
        const e = st.edges.find((x) => x.id === eid);
        if (e && !e.blocked) {
          // Первый клик — ремонт (непроходимо), второй — снос.
          commit({ ...st, edges: st.edges.map((x) => (x.id === eid ? { ...x, blocked: true } : x)) });
        } else {
          commit({ ...st, edges: st.edges.filter((x) => x.id !== eid) });
        }
        return;
      }
      const nid = findNodeNear(gx, gy);
      if (nid) {
        const nodes = st.nodes.filter((n) => n.id !== nid);
        const edges = st.edges.filter((e) => e.from !== nid && e.to !== nid);
        const relink = (id: string) => (id === nid ? nearestNode(nodes, gx, gy) : id);
        commit({
          nodes,
          edges,
          buildings: st.buildings.map((x) => ({ ...x, nearestNodeId: relink(x.nearestNodeId) })),
          pois: st.pois.map((x) => ({ ...x, nearestNodeId: relink(x.nearestNodeId) })),
        });
        if (pendingNodeRef.current === nid) pendingNodeRef.current = null;
      }
    }
  };

  const handleMove = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = toGrid(ev.clientX, ev.clientY);
    hoverRef.current = { x, y };
    const d = dragRef.current;
    if (d) dragRef.current = { ...d, x1: x, y1: y };
  };

  const handleUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const tool = toolRef.current;
    if (tool !== 'house' && tool !== 'park') return;
    const x = Math.max(0, Math.min(Math.floor(Math.min(d.x0, d.x1)), GRID_W - 1));
    const y = Math.max(0, Math.min(Math.floor(Math.min(d.y0, d.y1)), GRID_H - 1));
    const w = Math.max(1, Math.ceil(Math.abs(d.x1 - d.x0)));
    const h = Math.max(1, Math.ceil(Math.abs(d.y1 - d.y0)));
    const st = stateRef.current;
    if (tool === 'house') {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const nodeId = nearestNode(st.nodes, cx, cy);
      if (!nodeId) return;
      commit({
        ...st,
        buildings: [
          ...st.buildings,
          { id: uid('b'), x, y, w: Math.min(w, GRID_W - x), h: Math.min(h, GRID_H - y), residents: residentsRef.current, nearestNodeId: nodeId },
        ],
      });
    } else {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const nodeId = nearestNode(st.nodes, cx, cy);
      if (!nodeId) return;
      const count = st.pois.filter((p) => p.type === 'PARK').length + 1;
      commit({
        ...st,
        pois: [...st.pois, { id: uid('p'), type: 'PARK', x: Math.round(cx), y: Math.round(cy), nearestNodeId: nodeId, name: `Сквер №${count}` }],
      });
    }
  };

  return (
    <div ref={wrapRef} className="relative h-[420px] w-full overflow-hidden rounded-[24px] lg:h-full lg:min-h-[520px]">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Интерактивная карта района: дороги, дома, остановки и парки"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={() => {
          hoverRef.current = null;
        }}
        className="block h-full w-full cursor-crosshair touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60"
      />
    </div>
  );
}
