'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DistrictScenario, GraphNode, GraphEdge } from '@/lib/city-engine/types';

interface DistrictMap3DProps {
  scenario: DistrictScenario;
  selectedBuildingId: string | null;
  onSelectBuilding: (buildingId: string) => void;
  activePathNodeIds: string[];
  simPlaying?: boolean;
  simSpeed?: 1 | 2 | 5;
}

const SCALE = 0.55;
const to3D = (x: number, y: number): [number, number] => [(x - 480) * SCALE, (y - 320) * SCALE];

function createCarMesh(colorHex: number): THREE.Group {
  const car = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(6.4, 2.0, 3.2);
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.3;
  body.castShadow = true;
  car.add(body);

  const cabinGeo = new THREE.BoxGeometry(3.6, 1.6, 2.6);
  const cabinMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(-0.4, 2.8, 0);
  cabin.castShadow = true;
  car.add(cabin);

  // Фары и стоп-сигналы
  const lightGeo = new THREE.BoxGeometry(0.2, 0.35, 0.5);
  const frontMat = new THREE.MeshBasicMaterial({ color: 0xfff4cc });
  const rearMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

  const f1 = new THREE.Mesh(lightGeo, frontMat);
  f1.position.set(3.2, 1.4, 0.9);
  const f2 = new THREE.Mesh(lightGeo, frontMat);
  f2.position.set(3.2, 1.4, -0.9);
  const r1 = new THREE.Mesh(lightGeo, rearMat);
  r1.position.set(-3.2, 1.4, 0.9);
  const r2 = new THREE.Mesh(lightGeo, rearMat);
  r2.position.set(-3.2, 1.4, -0.9);
  car.add(f1, f2, r1, r2);

  // Колёса
  const wheelGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.45, 8);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
  wheelGeo.rotateX(Math.PI / 2);

  [
    [1.8, 0.75, 1.6],
    [1.8, 0.75, -1.6],
    [-1.8, 0.75, 1.6],
    [-1.8, 0.75, -1.6],
  ].forEach(([wx, wy, wz]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(wx, wy, wz);
    car.add(wheel);
  });

  return car;
}

export default function DistrictMap3D({
  scenario,
  selectedBuildingId,
  onSelectBuilding,
  activePathNodeIds,
  simPlaying = true,
  simSpeed = 1,
}: DistrictMap3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onSelectBuilding });
  const simRef = useRef({ simPlaying, simSpeed });

  useEffect(() => {
    callbacksRef.current = { onSelectBuilding };
    simRef.current = { simPlaying, simSpeed };
  });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x181e29);
    scene.fog = new THREE.FogExp2(0x181e29, 0.0012);

    const width = container.clientWidth || 960;
    const height = 560;
    const camera = new THREE.PerspectiveCamera(40, width / height, 1, 3500);
    camera.position.set(0, 420, 460);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2.22;
    controls.minDistance = 80;
    controls.maxDistance = 1200;
    controls.target.set(0, 0, 10);

    // Освещение САПР
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    scene.add(new THREE.HemisphereLight(0x94a3b8, 0x1e293b, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(220, 380, 160);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    // Основание
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(760, 12, 590),
      new THREE.MeshLambertMaterial({ color: 0x111620 }),
    );
    base.position.y = -6.5;
    base.receiveShadow = true;
    scene.add(base);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(750, 580),
      new THREE.MeshLambertMaterial({ color: 0x1a212d }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const nodeMap = new Map<string, GraphNode>(scenario.nodes.map((n) => [n.id, n]));

    const asphaltMat = new THREE.MeshLambertMaterial({ color: 0x273142 });
    const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
    const zebraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const roadMarkMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    const blockedMat = new THREE.MeshLambertMaterial({ color: 0xb91c1c });

    const roadEdges: GraphEdge[] = [];

    // Дороги и тротуары
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
      if (isCarRoad) roadEdges.push(edge);

      const widthM = isCarRoad ? 16 : isCrossing ? 6.5 : 4.5;
      const roadMat = !edge.isActive ? blockedMat : isCarRoad ? asphaltMat : isCrossing ? zebraMat : sidewalkMat;

      const roadMesh = new THREE.Mesh(new THREE.PlaneGeometry(len, widthM), roadMat);
      roadMesh.rotation.x = -Math.PI / 2;
      roadMesh.rotation.z = -angle;
      roadMesh.position.set((x1 + x2) / 2, isCarRoad ? 0.35 : 0.45, (z1 + z2) / 2);
      roadMesh.receiveShadow = true;
      scene.add(roadMesh);

      if (isCarRoad && edge.isActive) {
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.5), roadMarkMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.rotation.z = -angle;
        stripe.position.set((x1 + x2) / 2, 0.42, (z1 + z2) / 2);
        scene.add(stripe);
      }
    });

    // Скверы
    const parkMat = new THREE.MeshLambertMaterial({ color: 0x1b3d2f });
    scenario.amenities.filter((a) => a.type === 'park').forEach((park) => {
      const node = nodeMap.get(park.nodeId);
      if (!node) return;
      const [px, pz] = to3D(node.x, node.y);
      const patch = new THREE.Mesh(new THREE.CylinderGeometry(28, 28, 1.2, 24), parkMat);
      patch.position.set(px, 0.6, pz);
      scene.add(patch);
    });

    // Остановки
    scenario.amenities.filter((a) => a.type === 'bus_stop').forEach((bus) => {
      const node = nodeMap.get(bus.nodeId);
      if (!node) return;
      const [sx, sz] = to3D(node.x, node.y);
      const pavilion = new THREE.Mesh(
        new THREE.BoxGeometry(10, 5, 4.5),
        new THREE.MeshLambertMaterial({ color: 0x2563eb }),
      );
      pavilion.position.set(sx, 2.5, sz);
      pavilion.castShadow = true;
      scene.add(pavilion);
    });

    // Дома
    const clickable: THREE.Object3D[] = [];
    scenario.buildings.forEach((b) => {
      const isSelected = b.id === selectedBuildingId;
      const [bx, bz] = to3D(b.x + b.width / 2, b.y + b.height / 2);
      const h = Math.max(12, b.floors * 4.2);
      const w = b.width * SCALE;
      const dep = b.height * SCALE;

      const group = new THREE.Group();
      group.position.set(bx, 0, bz);

      const bodyMesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, dep),
        new THREE.MeshLambertMaterial({ color: isSelected ? 0x2563eb : 0x334155 }),
      );
      bodyMesh.position.y = h / 2;
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      bodyMesh.userData = { buildingId: b.id };
      group.add(bodyMesh);
      clickable.push(bodyMesh);

      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w - 2, 1, dep - 2),
        new THREE.MeshLambertMaterial({ color: 0x0f172a }),
      );
      roof.position.y = h + 0.5;
      group.add(roof);

      scene.add(group);
    });

    // Активный маршрут Дейкстры
    const pathPoints: THREE.Vector3[] = [];
    activePathNodeIds.forEach((id) => {
      const n = nodeMap.get(id);
      if (n) {
        const [px, pz] = to3D(n.x, n.y);
        pathPoints.push(new THREE.Vector3(px, 1.8, pz));
      }
    });

    if (pathPoints.length > 1) {
      const curve = new THREE.CatmullRomCurve3(pathPoints, false, 'catmullrom', 0.05);
      scene.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(curve, 100, 1.3, 8, false),
          new THREE.MeshBasicMaterial({ color: 0x3b82f6 }),
        ),
      );
    }

    // -------------------------------------------------------------
    // АГЕНТЫ АВТОМОБИЛЕЙ: Повороты по графу + Car-following (пробка)
    // -------------------------------------------------------------
    interface CarAgent {
      mesh: THREE.Group;
      edgeId: string;
      direction: 1 | -1;
      progress: number;
      pos: THREE.Vector3;
      speed: number;
      laneOffset: number;
    }

    const cars: CarAgent[] = [];
    const colors = [0x3b82f6, 0xef4444, 0x10b981, 0xf59e0b, 0x94a3b8];

    // На каждую автодорогу создаём по 2 автомобиля
    roadEdges.forEach((edge, eIdx) => {
      for (let i = 0; i < 2; i++) {
        const carMesh = createCarMesh(colors[(eIdx * 2 + i) % colors.length]);
        scene.add(carMesh);
        cars.push({
          mesh: carMesh,
          edgeId: edge.id,
          direction: i === 0 ? 1 : -1,
          progress: (i * 0.45 + eIdx * 0.2) % 0.9,
          pos: new THREE.Vector3(),
          speed: 0.16 + ((eIdx + i) % 3) * 0.03,
          laneOffset: 3.5,
        });
      }
    });

    const edgeMap = new Map<string, GraphEdge>(scenario.edges.map((e) => [e.id, e]));

    // Raycaster для кликов
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const onPointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(clickable);
      if (hits.length > 0) {
        const top = hits[0].object;
        if (top.userData.buildingId) callbacksRef.current.onSelectBuilding(top.userData.buildingId);
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    let reqId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);

      if (simRef.current.simPlaying) {
        const spd = simRef.current.simSpeed;

        // Обновляем позиции каждой машины
        cars.forEach((car, idx) => {
          const edge = edgeMap.get(car.edgeId);
          if (!edge) return;

          const fromNode = nodeMap.get(car.direction === 1 ? edge.from : edge.to);
          const toNode = nodeMap.get(car.direction === 1 ? edge.to : edge.from);
          if (!fromNode || !toNode) return;

          const [x1, z1] = to3D(fromNode.x, fromNode.y);
          const [x2, z2] = to3D(toNode.x, toNode.y);
          const dx = x2 - x1;
          const dz = z2 - z1;
          const angle = Math.atan2(dz, dx);

          // Проверка на пробку / препятствие впереди (Car-Following Model)
          let targetSpeed = car.speed;

          // 1. Если ребро перекрыто (ремонт) — машина тормозит
          if (!edge.isActive) {
            targetSpeed = 0;
          }

          // 2. Дистанция до впереди идущей машины на том же ребре
          for (let j = 0; j < cars.length; j++) {
            if (j === idx) continue;
            const other = cars[j];
            if (other.edgeId === car.edgeId && other.direction === car.direction) {
              const diff = other.progress - car.progress;
              if (diff > 0 && diff < 0.22) {
                // Впереди затор! Снижаем скорость или полностью останавливаемся
                targetSpeed = Math.min(targetSpeed, other.speed * 0.4);
                if (diff < 0.12) targetSpeed = 0; // Встали бампер к бамперу в пробку
              }
            }
          }

          // Перемещение
          car.progress += dt * targetSpeed * spd * 0.4;

          // Если доехали до конца ребра — переход/поворот на смежное ребро
          if (car.progress >= 1) {
            car.progress = 0;
            // Ищем следующее смежное авторебро у целевого узла (поворот)
            const nextEdges = roadEdges.filter(
              (e) => e.id !== edge.id && (e.from === toNode.id || e.to === toNode.id),
            );
            if (nextEdges.length > 0) {
              const nextEdge = nextEdges[idx % nextEdges.length];
              car.edgeId = nextEdge.id;
              car.direction = nextEdge.from === toNode.id ? 1 : -1;
            } else {
              // Разворот в тупике
              car.direction = (car.direction * -1) as 1 | -1;
            }
          }

          // Координаты на полосе со смещением
          const curX = x1 + dx * car.progress;
          const curZ = z1 + dz * car.progress;
          const perpX = -Math.sin(angle) * car.laneOffset;
          const perpZ = Math.cos(angle) * car.laneOffset;

          car.pos.set(curX + perpX, 0.45, curZ + perpZ);
          car.mesh.position.copy(car.pos);
          car.mesh.rotation.y = -angle;
        });
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = container.clientWidth;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.dispose();
      controls.dispose();
    };
  }, [scenario, selectedBuildingId, activePathNodeIds]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-gray-300 bg-[#161a22] shadow-md dark:border-gray-700">
      <div className="flex h-8 items-center justify-between border-b border-gray-700 bg-[#11141c] px-3 font-mono text-[11px] text-gray-300 select-none">
        <span className="font-semibold text-blue-400">3D СИМУЛЯЦИЯ: ОБНИНСК (CAR-FOLLOWING & ДЕЙКСТРА)</span>
        <span className="text-gray-400">Вращение: ЛКМ | Панорама: ПКМ | Зум: Колесо</span>
      </div>
      <div ref={mountRef} className="h-[560px] w-full cursor-grab active:cursor-grabbing" />
    </div>
  );
}
