'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DistrictScenario, GraphNode } from '@/lib/city-engine/types';

interface DistrictMap3DProps {
  scenario: DistrictScenario;
  selectedBuildingId: string | null;
  onSelectBuilding: (buildingId: string) => void;
  activePathNodeIds: string[];
  onToggleCrossing: () => void;
  onToggleStop: () => void;
  hasCustomCrossing: boolean;
  busStopNodeId: string;
  hasCustomPark: boolean;
  onToggleNewBuilding?: () => void;
  hasNewBuilding?: boolean;
}

const SCALE = 0.52;
const to3D = (x: number, y: number): [number, number] => [(x - 480) * SCALE, (y - 320) * SCALE];

export default function DistrictMap3D({
  scenario, selectedBuildingId, onSelectBuilding, activePathNodeIds,
  onToggleCrossing, onToggleStop, hasCustomCrossing, busStopNodeId,
  hasCustomPark, onToggleNewBuilding, hasNewBuilding,
}: DistrictMap3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onSelectBuilding, onToggleCrossing, onToggleStop, onToggleNewBuilding });

  useEffect(() => {
    callbacksRef.current = { onSelectBuilding, onToggleCrossing, onToggleStop, onToggleNewBuilding };
  });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f6f9);
    scene.fog = new THREE.FogExp2(0xf3f6f9, 0.0014);

    const width = container.clientWidth || 960;
    const height = 540;
    const camera = new THREE.PerspectiveCamera(38, width / height, 1, 3000);
    camera.position.set(0, 390, 430);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2.25;
    controls.minDistance = 120;
    controls.maxDistance = 900;
    controls.target.set(0, 0, 15);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    scene.add(new THREE.HemisphereLight(0xe2e8f0, 0xcfd8dc, 0.55));
    const sun = new THREE.DirectionalLight(0xfff7e6, 1.4);
    sun.position.set(180, 320, 140);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 1000;
    sun.shadow.camera.left = -300;
    sun.shadow.camera.right = 300;
    sun.shadow.camera.top = 300;
    sun.shadow.camera.bottom = -300;
    scene.add(sun);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(600, 10, 440),
      new THREE.MeshLambertMaterial({ color: 0xcfd6df }),
    );
    base.position.y = -5.5;
    base.receiveShadow = true;
    scene.add(base);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(590, 430),
      new THREE.MeshLambertMaterial({ color: 0xe6ebf0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const nodeMap = new Map<string, GraphNode>(scenario.nodes.map((n) => [n.id, n]));
    const [, roadZ] = to3D(480, 330);
    const [gagarX] = to3D(800, 320);

    const roadMarx = new THREE.Mesh(
      new THREE.PlaneGeometry(590, 110 * SCALE),
      new THREE.MeshLambertMaterial({ color: 0x334155 }),
    );
    roadMarx.rotation.x = -Math.PI / 2;
    roadMarx.position.set(0, 0.25, roadZ);
    roadMarx.receiveShadow = true;
    scene.add(roadMarx);

    const roadGagarin = new THREE.Mesh(
      new THREE.PlaneGeometry(80 * SCALE, 430),
      new THREE.MeshLambertMaterial({ color: 0x3b4759 }),
    );
    roadGagarin.rotation.x = -Math.PI / 2;
    roadGagarin.position.set(gagarX, 0.28, 0);
    roadGagarin.receiveShadow = true;
    scene.add(roadGagarin);

    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf1f5f9 });
    for (let i = 0; i < 24; i++) {
      const dx = -270 + i * 24;
      if (Math.abs(dx - gagarX) > 30) {
        for (const zOff of [-14, 14]) {
          const dash = new THREE.Mesh(new THREE.PlaneGeometry(9, 1), dashMat);
          dash.rotation.x = -Math.PI / 2;
          dash.position.set(dx, 0.36, roadZ + zOff);
          scene.add(dash);
        }
      }
    }

    const walkMat = new THREE.MeshLambertMaterial({ color: 0xdde3ea });
    for (const yOff of [250, 410]) {
      const [, wz] = to3D(480, yOff);
      const walk = new THREE.Mesh(new THREE.BoxGeometry(590, 1.2, 14), walkMat);
      walk.position.set(0, 0.6, wz);
      walk.receiveShadow = true;
      scene.add(walk);
    }

    const [parkX, parkZ] = to3D(290, 500);
    const park = new THREE.Mesh(
      new THREE.BoxGeometry(260 * SCALE, 2.2, 160 * SCALE),
      new THREE.MeshLambertMaterial({ color: 0xa1c19d }),
    );
    park.position.set(parkX, 1.1, parkZ);
    park.receiveShadow = true;
    scene.add(park);

    const alley = new THREE.Mesh(
      new THREE.BoxGeometry(190 * SCALE, 0.6, 8),
      new THREE.MeshLambertMaterial({ color: 0xe8e2ce }),
    );
    alley.position.set(parkX, 2.3, parkZ);
    scene.add(alley);

    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6e4e37 });
    const leafMat1 = new THREE.MeshLambertMaterial({ color: 0x3d704d });
    const leafMat2 = new THREE.MeshLambertMaterial({ color: 0x4f8760 });
    const treeAt = (tx: number, ty: number, s: number, leaf: THREE.Material) => {
      const [wx, wz] = to3D(tx, ty);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 5.5, 6), trunkMat);
      trunk.position.set(wx, 4, wz);
      trunk.castShadow = true;
      scene.add(trunk);
      const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(5.8 * s, 1), leaf);
      leaves.position.set(wx, 9.8, wz);
      leaves.castShadow = true;
      scene.add(leaves);
    };
    [[200, 460], [230, 520], [270, 465], [330, 540], [380, 490], [410, 460], [240, 485], [350, 520]].forEach(([tx, ty], i) => {
      treeAt(tx, ty, 1, i % 2 ? leafMat1 : leafMat2);
    });

    if (hasCustomPark) {
      const [npX, npZ] = to3D(240, 85);
      const newPark = new THREE.Mesh(
        new THREE.BoxGeometry(120 * SCALE, 1.8, 90 * SCALE),
        new THREE.MeshLambertMaterial({ color: 0x9bc298 }),
      );
      newPark.position.set(npX, 0.9, npZ);
      newPark.receiveShadow = true;
      scene.add(newPark);
      treeAt(200, 70, 0.8, leafMat1);
      treeAt(260, 95, 0.85, leafMat2);
      treeAt(225, 100, 0.75, leafMat1);
    }

    const [plazaX, plazaZ] = to3D(630, 500);
    const plazaBase = new THREE.Mesh(
      new THREE.BoxGeometry(220 * SCALE, 18, 140 * SCALE),
      new THREE.MeshLambertMaterial({ color: 0xb4c0cc }),
    );
    plazaBase.position.set(plazaX, 9, plazaZ);
    plazaBase.castShadow = true;
    plazaBase.receiveShadow = true;
    scene.add(plazaBase);
    const plazaGlass = new THREE.Mesh(
      new THREE.BoxGeometry(140 * SCALE, 8, 70 * SCALE),
      new THREE.MeshLambertMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 }),
    );
    plazaGlass.position.set(plazaX, 22, plazaZ);
    scene.add(plazaGlass);

    const clickable: THREE.Object3D[] = [];
    const facadePalette = [0xfbf7ee, 0xf4eedf, 0xeee7d6, 0xf8f3e7, 0xf2ece0, 0xede6d8];
    scenario.buildings.forEach((b, bi) => {
      const isSelected = b.id === selectedBuildingId;
      const [bx, bz] = to3D(b.x + b.width / 2, b.y + b.height / 2);
      const h = Math.max(10, b.floors * 3.2);
      const w = b.width * SCALE;
      const dep = b.height * SCALE;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, dep),
        new THREE.MeshLambertMaterial({ color: isSelected ? 0xdbeafe : (b.isCustom ? 0xfef08a : facadePalette[bi % facadePalette.length]) }),
      );
      mesh.position.set(bx, h / 2, bz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { buildingId: b.id };
      clickable.push(mesh);
      scene.add(mesh);
      const edgeLines = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry),
        new THREE.LineBasicMaterial({ color: isSelected ? 0x2563eb : 0x94a3b8 }),
      );
      edgeLines.position.copy(mesh.position);
      scene.add(edgeLines);
      const winMat = new THREE.MeshBasicMaterial({ color: isSelected ? 0x2563eb : 0x7c94a6 });
      const rows = Math.min(b.floors, 22);
      for (let f = 0; f < rows; f++) {
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, 0.75), winMat);
        strip.position.set(bx, 3 + f * 3.2, bz + dep / 2 + 0.08);
        scene.add(strip);
      }
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w + 1.2, 1.5, dep + 1.2),
        new THREE.MeshLambertMaterial({ color: 0x64748b }),
      );
      roof.position.set(bx, h + 0.75, bz);
      roof.castShadow = true;
      scene.add(roof);
    });

    if (!hasNewBuilding) {
      const [slotX, slotZ] = to3D(800, 60);
      const slotPlot = new THREE.Mesh(
        new THREE.BoxGeometry(85 * SCALE, 1.2, 60 * SCALE),
        new THREE.MeshLambertMaterial({ color: 0xfde68a, transparent: true, opacity: 0.7 }),
      );
      slotPlot.position.set(slotX, 0.6, slotZ);
      slotPlot.userData = { isNewBuildingSlot: true };
      clickable.push(slotPlot);
      scene.add(slotPlot);
      const slotOutline = new THREE.LineSegments(
        new THREE.EdgesGeometry(slotPlot.geometry),
        new THREE.LineBasicMaterial({ color: 0xd97706 }),
      );
      slotOutline.position.copy(slotPlot.position);
      scene.add(slotOutline);
    }

    const stopNode = nodeMap.get(busStopNodeId);
    if (stopNode) {
      const [sx, sz] = to3D(stopNode.x, stopNode.y);
      const platform = new THREE.Mesh(
        new THREE.BoxGeometry(26, 1.2, 12),
        new THREE.MeshLambertMaterial({ color: 0x94a3b8 }),
      );
      platform.position.set(sx, 0.6, sz);
      platform.receiveShadow = true;
      scene.add(platform);
      const pavilion = new THREE.Mesh(
        new THREE.BoxGeometry(20, 7.5, 6.5),
        new THREE.MeshLambertMaterial({ color: 0x1e3a8a, transparent: true, opacity: 0.88 }),
      );
      pavilion.position.set(sx, 4.6, sz - 2);
      pavilion.castShadow = true;
      pavilion.userData = { isStop: true };
      clickable.push(pavilion);
      scene.add(pavilion);
      const signPole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 13, 6), new THREE.MeshLambertMaterial({ color: 0x475569 }));
      signPole.position.set(sx + 12, 6.5, sz);
      scene.add(signPole);
      const sign = new THREE.Mesh(new THREE.SphereGeometry(2.8, 16, 16), new THREE.MeshBasicMaterial({ color: 0x2563eb }));
      sign.position.set(sx + 12, 14, sz);
      scene.add(sign);
    }

    const zebraAt = (cx: number, cy: number, interactive: boolean) => {
      const [zx, zz] = to3D(cx, cy);
      const group = new THREE.Group();
      for (let i = 0; i < 7; i++) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(3.4, 0.45, 110 * SCALE),
          new THREE.MeshLambertMaterial({ color: 0xffffff }),
        );
        stripe.position.set(zx - 10 + i * 3.3, 0.45, zz);
        if (interactive) {
          stripe.userData = { isCrossing: true };
          clickable.push(stripe);
        }
        group.add(stripe);
      }
      scene.add(group);
    };
    zebraAt(800, 330, false);
    if (hasCustomCrossing) zebraAt(440, 330, true);

    const pathPoints: THREE.Vector3[] = [];
    activePathNodeIds.forEach((id) => {
      const n = nodeMap.get(id);
      if (n) {
        const [px, pz] = to3D(n.x, n.y);
        pathPoints.push(new THREE.Vector3(px, 1.8, pz));
      }
    });
    if (pathPoints.length > 1) {
      const curve = new THREE.CatmullRomCurve3(pathPoints, false, 'catmullrom', 0.06);
      scene.add(new THREE.Mesh(
        new THREE.TubeGeometry(curve, 90, 1.2, 8, false),
        new THREE.MeshBasicMaterial({ color: 0x2563eb }),
      ));
      pathPoints.forEach((p) => {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 12), new THREE.MeshBasicMaterial({ color: 0x1d4ed8 }));
        dot.position.copy(p);
        scene.add(dot);
      });
    }

    const walkers: { mesh: THREE.Mesh; halo: THREE.Mesh; curve: THREE.CatmullRomCurve3; speed: number; offset: number }[] = [];
    if (pathPoints.length > 1) {
      const pathCurve = new THREE.CatmullRomCurve3(pathPoints);
      for (let i = 0; i < 3; i++) {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 16), new THREE.MeshBasicMaterial({ color: i === 0 ? 0x2563eb : 0x0284c7 }));
        scene.add(mesh);
        const halo = new THREE.Mesh(
          new THREE.RingGeometry(2.8, 4.2, 24),
          new THREE.MeshBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
        );
        halo.rotation.x = -Math.PI / 2;
        scene.add(halo);
        walkers.push({ mesh, halo, curve: pathCurve, speed: 0.16 + i * 0.04, offset: i * 0.33 });
      }
    }

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
        else if (top.userData.isCrossing) callbacksRef.current.onToggleCrossing();
        else if (top.userData.isStop) callbacksRef.current.onToggleStop();
        else if (top.userData.isNewBuildingSlot) callbacksRef.current.onToggleNewBuilding?.();
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    let reqId = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      controls.update();
      const elapsed = clock.getElapsedTime();
      walkers.forEach((w) => {
        const t = (elapsed * w.speed + w.offset) % 1;
        const pos = w.curve.getPointAt(t);
        const bob = Math.abs(Math.sin(elapsed * 6 + w.offset * 10)) * 0.8;
        w.mesh.position.set(pos.x, pos.y + 2.2 + bob, pos.z);
        w.halo.position.set(pos.x, 1.1, pos.z);
        const s = 1 + 0.15 * Math.sin(elapsed * 4 + w.offset * 5);
        w.halo.scale.set(s, s, 1);
      });
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
  }, [scenario, selectedBuildingId, activePathNodeIds, hasCustomCrossing, busStopNodeId, hasCustomPark, hasNewBuilding]);

  return (
    <div className="relative w-full overflow-hidden rounded-[28px] border border-white/60 bg-white/40 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(0,0,0,0.05),0_20px_50px_-16px_rgba(20,26,38,0.25)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/20 dark:bg-gray-900/40">
      <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-1.5 text-xs text-gray-700 shadow-sm backdrop-blur-xl dark:border-white/20 dark:bg-gray-900/70 dark:text-gray-200">
        <span className="font-semibold text-gray-900 dark:text-gray-100">3D Макет района</span>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <span className="text-gray-500 dark:text-gray-400">Вращение • Панорама • Зум</span>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <span className="flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-400">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-600" />
          Потоки жителей (Дейкстра)
        </span>
      </div>
      <div ref={mountRef} className="h-[540px] w-full cursor-grab active:cursor-grabbing" />
    </div>
  );
}
