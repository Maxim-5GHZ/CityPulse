'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DistrictScenario, GraphNode, PathResult } from '@/lib/city-engine/types';
import { RING_RADIUS } from '@/lib/city-engine/roundabout';
import { createTreeMesh } from './3d/meshes';

interface DistrictMap3DProps {
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

const SCALE = 0.55;
const VIEW_H = 560;
const FLOW_Y = 1.4;
const to3D = (x: number, y: number): [number, number] => [(x - 480) * SCALE, (y - 320) * SCALE];

function pointInPolygon(x: number, y: number, vs: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i].x, yi = vs[i].y;
    const xj = vs[j].x, yj = vs[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function disposeGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) mat.dispose();
  });
  group.clear();
}

/** Один поток частиц вдоль ломаной пути Дейкстры. */
interface FlowDesc {
  pts: THREE.Vector3[];
  cum: number[];
  total: number;
  start: number;
  count: number;
}

interface AnimState {
  busPoints: THREE.Points | null;
  parkPoints: THREE.Points | null;
  busFlows: FlowDesc[];
  parkFlows: FlowDesc[];
  pulses: THREE.MeshBasicMaterial[];
}

function advancePoints(
  points: THREE.Points | null,
  flows: FlowDesc[],
  elapsed: number,
  speedMul: number,
): void {
  if (!points) return;
  const attr = points.geometry.getAttribute('position') as THREE.BufferAttribute;
  const arr = attr.array as Float32Array;
  flows.forEach((f) => {
    if (f.total < 0.01) return;
    for (let k = 0; k < f.count; k++) {
      let d = (elapsed * 7 * speedMul + (k / f.count) * f.total) % f.total;
      let seg = 0;
      while (seg < f.cum.length - 2 && f.cum[seg + 1] < d) seg++;
      const segLen = f.cum[seg + 1] - f.cum[seg] || 1;
      const t = (d - f.cum[seg]) / segLen;
      const a = f.pts[seg];
      const b = f.pts[seg + 1];
      const o = (f.start + k) * 3;
      arr[o] = a.x + (b.x - a.x) * t;
      arr[o + 1] = a.y + (b.y - a.y) * t;
      arr[o + 2] = a.z + (b.z - a.z) * t;
    }
  });
  attr.needsUpdate = true;
}

export default function DistrictMap3D({
  scenario,
  selectedBuildingId,
  onSelectBuilding,
  activePathNodeIds,
  edgeLoads,
  busPaths,
  parkPaths,
  simPlaying = true,
  simSpeed = 1,
}: DistrictMap3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onSelectBuilding });
  const simRef = useRef({ simPlaying, simSpeed });
  const dynamicRef = useRef<THREE.Group | null>(null);
  const clickableRef = useRef<THREE.Object3D[]>([]);
  const animRef = useRef<AnimState>({ busPoints: null, parkPoints: null, busFlows: [], parkFlows: [], pulses: [] });

  useEffect(() => {
    callbacksRef.current = { onSelectBuilding };
    simRef.current = { simPlaying, simSpeed };
  });

  // Сцена и рендерер создаются РОВНО ОДИН РАЗ и живут всё время.
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f131a);
    scene.fog = new THREE.FogExp2(0x0f131a, 0.0011);

    const width = container.clientWidth || 960;
    const camera = new THREE.PerspectiveCamera(40, width / VIEW_H, 1, 3500);
    camera.position.set(0, 410, 450);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, VIEW_H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2.22;
    controls.minDistance = 60;
    controls.maxDistance = 1200;

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    scene.add(new THREE.HemisphereLight(0x94a3b8, 0x1e293b, 0.5));
    const sun = new THREE.DirectionalLight(0x9fc2ff, 1.25);
    sun.position.set(240, 400, 180);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(780, 10, 600),
      new THREE.MeshLambertMaterial({ color: 0x0f131a }),
    );
    base.position.y = -5.5;
    scene.add(base);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(770, 590),
      new THREE.MeshLambertMaterial({ color: 0x161c26 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const dynamicGroup = new THREE.Group();
    scene.add(dynamicGroup);
    dynamicRef.current = dynamicGroup;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const onPointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(clickableRef.current);
      if (hits.length > 0) {
        const id = (hits[0].object.userData as { buildingId?: string }).buildingId;
        if (id) callbacksRef.current.onSelectBuilding(id);
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    const clock = new THREE.Clock();
    let reqId = 0;
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const { simPlaying: playing, simSpeed: spd } = simRef.current;
      const st = animRef.current;
      if (playing) {
        advancePoints(st.busPoints, st.busFlows, t, spd);
        advancePoints(st.parkPoints, st.parkFlows, t, spd);
      }
      st.pulses.forEach((m, i) => {
        m.opacity = 0.22 + 0.18 * Math.sin(t * 3.5 + i * 1.3);
      });
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = container.clientWidth || 960;
      camera.aspect = w / VIEW_H;
      camera.updateProjectionMatrix();
      renderer.setSize(w, VIEW_H);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      disposeGroup(dynamicGroup);
      dynamicRef.current = null;
      renderer.dispose();
      controls.dispose();
    };
  }, []);

  // Перерисовка динамики: чистим dynamicGroup и за миллисекунды строим актуальное.
  useEffect(() => {
    const group = dynamicRef.current;
    if (!group) return;
    disposeGroup(group);
    clickableRef.current = [];
    animRef.current = { busPoints: null, parkPoints: null, busFlows: [], parkFlows: [], pulses: [] };

    const nodeMap = new Map<string, GraphNode>(scenario.nodes.map((n) => [n.id, n]));
    const asphaltMat = new THREE.MeshLambertMaterial({ color: 0x2f3b52 });
    const zebraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const underpassMat = new THREE.MeshLambertMaterial({ color: 0x0284c7 });
    const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
    const holoMat = () => {
      const m = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.3 });
      animRef.current.pulses.push(m);
      return m;
    };

    const edgeByNodes = new Map<string, string>();
    scenario.edges.forEach((e) => {
      edgeByNodes.set(`${e.from}>${e.to}`, e.id);
      edgeByNodes.set(`${e.to}>${e.from}`, e.id);
    });

    // Дороги, тротуары, переходы + красные голограммы на перекрытых участках.
    scenario.edges.forEach((edge) => {
      const u = nodeMap.get(edge.from);
      const v = nodeMap.get(edge.to);
      if (!u || !v) return;

      const [x1, z1] = to3D(u.x, u.y);
      const [x2, z2] = to3D(v.x, v.y);
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.01) return;
      const angle = Math.atan2(dz, dx);

      const isCarRoad = edge.type === 'road';
      const isCrossing = edge.type === 'crossing';
      const isUnderpass = edge.type === 'underpass';

      const is4Lanes = edge.lanes === 4;
      const widthM = isCarRoad ? (is4Lanes ? 24 : 16) : isCrossing || isUnderpass ? 6.5 : 4.5;
      const roadMat = isUnderpass ? underpassMat : isCrossing ? zebraMat : isCarRoad ? asphaltMat : sidewalkMat;

      const roadMesh = new THREE.Mesh(new THREE.PlaneGeometry(len, widthM), roadMat);
      roadMesh.rotation.x = -Math.PI / 2;
      roadMesh.rotation.z = -angle;
      roadMesh.position.set((x1 + x2) / 2, isUnderpass ? 0.1 : 0.35, (z1 + z2) / 2);
      roadMesh.receiveShadow = true;
      group.add(roadMesh);

      if (isCarRoad) {
        const perpX = -Math.sin(angle);
        const perpZ = Math.cos(angle);
        const offsetDist = widthM / 2 + 2.0;
        if (edge.hasSidewalkLeft) {
          const sw = new THREE.Mesh(new THREE.BoxGeometry(len, 0.4, 3.2), sidewalkMat);
          sw.rotation.y = -angle;
          sw.position.set((x1 + x2) / 2 + perpX * offsetDist, 0.2, (z1 + z2) / 2 + perpZ * offsetDist);
          group.add(sw);
        }
        if (edge.hasSidewalkRight) {
          const sw = new THREE.Mesh(new THREE.BoxGeometry(len, 0.4, 3.2), sidewalkMat);
          sw.rotation.y = -angle;
          sw.position.set((x1 + x2) / 2 - perpX * offsetDist, 0.2, (z1 + z2) / 2 - perpZ * offsetDist);
          group.add(sw);
        }
      }

      // Перекрытие: красная полупрозрачная голограмма-шлагбаум поперёк полотна.
      if (!edge.isActive) {
        const holo = new THREE.Mesh(new THREE.BoxGeometry(len, 5, widthM + 2), holoMat());
        holo.rotation.y = -angle;
        holo.position.set((x1 + x2) / 2, 2.5, (z1 + z2) / 2);
        group.add(holo);
      }
    });

    // Подложки перекрёстков.
    scenario.nodes.forEach((node) => {
      const adj = scenario.edges.filter(
        (e) => e.type === 'road' && e.isActive && (e.from === node.id || e.to === node.id),
      );
      if (adj.length < 2) return;
      const padR = Math.max(...adj.map((e) => (e.lanes === 4 ? 12 : 8)));
      const [px, pz] = to3D(node.x, node.y);
      const pad = new THREE.Mesh(new THREE.CircleGeometry(padR, 24), asphaltMat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(px, 0.37, pz);
      pad.receiveShadow = true;
      group.add(pad);
    });

    // Кольца: полотно + островок с деревом.
    scenario.nodes
      .filter((n) => n.type === 'roundabout')
      .forEach((center) => {
        const [cx, cz] = to3D(center.x, center.y);
        const r3d = RING_RADIUS * SCALE;
        const band = new THREE.Mesh(new THREE.RingGeometry(r3d - 8, r3d + 8, 48), asphaltMat);
        band.rotation.x = -Math.PI / 2;
        band.position.set(cx, 0.36, cz);
        band.receiveShadow = true;
        group.add(band);

        const island = new THREE.Mesh(
          new THREE.CylinderGeometry((RING_RADIUS - 13) * SCALE, (RING_RADIUS - 13) * SCALE, 1.4, 32),
          sidewalkMat,
        );
        island.position.set(cx, 0.7, cz);
        island.castShadow = true;
        island.receiveShadow = true;
        group.add(island);

        const tree = createTreeMesh();
        tree.position.set(cx, 1.4, cz);
        group.add(tree);
      });

    // Скверы и парки с деревьями.
    scenario.amenities.filter((a) => a.type === 'park').forEach((park) => {
      if (park.polygon && park.polygon.length >= 3) {
        const shape = new THREE.Shape();
        park.polygon.forEach((pt, idx) => {
          const [px, pz] = to3D(pt.x, pt.y);
          if (idx === 0) shape.moveTo(px, -pz);
          else shape.lineTo(px, -pz);
        });
        const parkMesh = new THREE.Mesh(
          new THREE.ShapeGeometry(shape),
          new THREE.MeshLambertMaterial({ color: 0x143828 }),
        );
        parkMesh.rotation.x = -Math.PI / 2;
        parkMesh.position.y = 0.4;
        group.add(parkMesh);

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        park.polygon.forEach((p) => {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        });
        for (let x = minX + 15; x < maxX - 15; x += 30) {
          for (let y = minY + 15; y < maxY - 15; y += 30) {
            if (pointInPolygon(x, y, park.polygon)) {
              const tree = createTreeMesh();
              const [tx, tz] = to3D(x, y);
              tree.position.set(tx, 0.4, tz);
              group.add(tree);
            }
          }
        }
      } else {
        const node = nodeMap.get(park.nodeId);
        if (node) {
          const [px, pz] = to3D(node.x, node.y);
          const patch = new THREE.Mesh(
            new THREE.CylinderGeometry(26, 26, 1.2, 24),
            new THREE.MeshLambertMaterial({ color: 0x143828 }),
          );
          patch.position.set(px, 0.6, pz);
          group.add(patch);
        }
      }
    });

    // Остановки.
    scenario.amenities.filter((a) => a.type === 'bus_stop').forEach((bus) => {
      const node = nodeMap.get(bus.nodeId);
      if (!node) return;
      const [sx, sz] = to3D(node.x, node.y);
      const pavilion = new THREE.Mesh(
        new THREE.BoxGeometry(9, 5, 4),
        new THREE.MeshLambertMaterial({ color: 0x2563eb }),
      );
      pavilion.position.set(sx, 2.5, sz);
      group.add(pavilion);
    });

    // Здания-призмы Digital Twin: полупрозрачный корпус + светящийся контур.
    scenario.buildings.forEach((b) => {
      const isSelected = b.id === selectedBuildingId;
      const h = Math.max(12, b.floors * 4.2);
      const bodyMat = new THREE.MeshLambertMaterial({
        color: isSelected ? 0x2563eb : 0x1e3a5f,
        transparent: true,
        opacity: isSelected ? 0.85 : 0.55,
      });
      const edgeMat = new THREE.LineBasicMaterial({ color: isSelected ? 0xffffff : 0x7fb2ff });

      if (b.polygon && b.polygon.length >= 3) {
        const shape = new THREE.Shape();
        b.polygon.forEach((pt, idx) => {
          const [px, pz] = to3D(pt.x, pt.y);
          if (idx === 0) shape.moveTo(px, -pz);
          else shape.lineTo(px, -pz);
        });
        const geom = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
        const mesh = new THREE.Mesh(geom, bodyMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { buildingId: b.id };
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geom), edgeMat));
        group.add(mesh);
        clickableRef.current.push(mesh);
      } else {
        const [bx, bz] = to3D(b.x + b.width / 2, b.y + b.height / 2);
        const geom = new THREE.BoxGeometry(b.width * SCALE, h, b.height * SCALE);
        const mesh = new THREE.Mesh(geom, bodyMat);
        mesh.position.set(bx, h / 2, bz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { buildingId: b.id };
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geom), edgeMat));
        group.add(mesh);
        clickableRef.current.push(mesh);
      }
    });

    // Светящиеся потоки жителей вдоль путей Дейкстры.
    const pathToFlow = (ids: string[]): { pts: THREE.Vector3[]; cum: number[]; total: number } | null => {
      const pts: THREE.Vector3[] = [];
      ids.forEach((id) => {
        const n = nodeMap.get(id);
        if (n) {
          const [px, pz] = to3D(n.x, n.y);
          pts.push(new THREE.Vector3(px, FLOW_Y, pz));
        }
      });
      if (pts.length < 2) return null;
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
      return { pts, cum, total: cum[cum.length - 1] };
    };

    const makePoints = (color: number): { points: THREE.Points; attr: THREE.BufferAttribute; flows: FlowDesc[] } => {
      const geom = new THREE.BufferGeometry();
      const attr = new THREE.BufferAttribute(new Float32Array(4096 * 3), 3);
      attr.setUsage(THREE.DynamicDrawUsage);
      geom.setAttribute('position', attr);
      const points = new THREE.Points(
        geom,
        new THREE.PointsMaterial({
          color,
          size: 2.4,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      points.frustumCulled = false;
      return { points, attr, flows: [] };
    };

    const bus = makePoints(0x60a5fa);
    const park = makePoints(0x34d399);
    let busCursor = 0;
    let parkCursor = 0;

    scenario.buildings.forEach((b) => {
      // Нагрузка на пути дома — масштабирует число огоньков.
      const loadOf = (ids: string[] | undefined): number => {
        if (!ids) return 0;
        let sum = 0;
        for (let i = 1; i < ids.length; i++) {
          const eid = edgeByNodes.get(`${ids[i - 1]}>${ids[i]}`);
          if (eid) sum += edgeLoads[eid] ?? 0;
        }
        return sum;
      };

      const busPath = busPaths[b.id];
      if (busPath) {
        const f = pathToFlow(busPath.pathNodeIds);
        if (f) {
          const count = Math.min(12, Math.max(3, 4 + Math.round(loadOf(busPath.pathNodeIds) / 150)));
          if (busCursor + count <= 4096) {
            bus.flows.push({ ...f, start: busCursor, count });
            busCursor += count;
          }
        }
      }
      const parkPath = parkPaths[b.id];
      if (parkPath) {
        const f = pathToFlow(parkPath.pathNodeIds);
        if (f) {
          const count = Math.min(8, Math.max(2, 3 + Math.round(b.residents / 120)));
          if (parkCursor + count <= 4096) {
            park.flows.push({ ...f, start: parkCursor, count });
            parkCursor += count;
          }
        }
      }
    });

    bus.points.geometry.setDrawRange(0, busCursor);
    park.points.geometry.setDrawRange(0, parkCursor);
    group.add(bus.points);
    group.add(park.points);
    animRef.current.busPoints = bus.points;
    animRef.current.parkPoints = park.points;
    animRef.current.busFlows = bus.flows;
    animRef.current.parkFlows = park.flows;

    // Выбранный путь Дейкстры — светящаяся неоновая трубка.
    if (activePathNodeIds.length >= 2) {
      const f = pathToFlow(activePathNodeIds);
      if (f && f.total > 0.01) {
        const tube = new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(f.pts), 64, 0.7, 6, false),
          new THREE.MeshBasicMaterial({ color: 0x22d3ee }),
        );
        group.add(tube);
      }
    }
  }, [scenario, selectedBuildingId, activePathNodeIds, edgeLoads, busPaths, parkPaths]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-gray-700 bg-[#161a22] shadow-xl">
      <div className="flex h-8 items-center justify-between border-b border-gray-700 bg-[#11141c] px-3 font-mono text-[11px] text-gray-300 select-none">
        <span className="font-semibold text-blue-400">
          3D ДВОЙНИК: ПОТОКИ ЖИТЕЛЕЙ ПО ДЕЙКСТРЕ
        </span>
        <span className="text-gray-400">ЛКМ: Вращение | ПКМ: Панорама | Колесо: Зум</span>
      </div>
      <div ref={mountRef} className="h-[560px] w-full cursor-grab active:cursor-grabbing" />
    </div>
  );
}
