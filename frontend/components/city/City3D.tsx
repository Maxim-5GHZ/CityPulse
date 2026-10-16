// Кейс 03 — 3D-сцена на Three.js. Процедурная геометрия из DistrictModel.
// Инсоляция из suncalc (PCFSoft-тени 2048), 3D-аэродинамика частицами, ghost-превью
// коробки. OrbitControls + ResizeObserver + rAF чистятся; при reduced-motion — статика.
'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { DistrictModel } from '@/lib/city/model';
import {
  buildContextGroup,
  createBuildingMesh,
  createGroundGrid,
  disposeBuilding,
  disposeContextGroup,
} from '@/lib/city/three-factory';
import { sunLightPos, type SunPos } from '@/lib/city/shadow';

interface Props {
  model: DistrictModel;
  sun: SunPos;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  showWind?: boolean;
  showShadow?: boolean;
  showOsm?: boolean;
  windDir?: number;
  windSpeed?: number;
  hour?: number;
  ghostW?: number;
  ghostD?: number;
  onSelectAttr?: (id: string | null) => void;
  addMode?: boolean;
  onAddAt?: (x: number, y: number) => void;
  className?: string;
}

export default function City3D({
  model,
  sun,
  selectedId,
  onSelect,
  showWind = true,
  showShadow = true,
  showOsm = true,
  windDir = 90,
  windSpeed = 4,
  hour = 13,
  ghostW = 20,
  ghostD = 12,
  onSelectAttr,
  addMode = false,
  onAddAt,
  className,
}: Props) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const cbRef = useRef({ onSelect, onSelectAttr, onAddAt });
  cbRef.current = { onSelect, onSelectAttr, onAddAt };

  const stateRef = useRef({ addMode, ghostW, ghostD, windDir, windSpeed });
  stateRef.current = { addMode, ghostW, ghostD, windDir, windSpeed };

  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    light: THREE.DirectionalLight;
    sunMesh: THREE.Group;
    groups: Map<string, THREE.Group>;
    context: THREE.Group | null;
    ghostMesh: THREE.Mesh;
    ground: THREE.Mesh;
    grid: THREE.GridHelper;
    bgColor: string;
    windParticles: {
      mesh: THREE.InstancedMesh;
      positions: Float32Array;
      speeds: Float32Array;
    } | null;
  } | null>(null);

  // Инициализация Three.js.
  useEffect(() => {
    const host = divRef.current;
    if (!host) return;

    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    const bgColor = dark ? '#0b1120' : '#e6edf5';
    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.Fog(bgColor, 1800, 4200);

    const camera = new THREE.PerspectiveCamera(40, 1, 1, 7000);
    camera.position.set(520, 520, 720);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 30);
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minDistance = 150;
    controls.maxDistance = 2600;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.update();

    // Окружающий свет (небо + отражения от земли).
    const hemi = new THREE.HemisphereLight(0xffffff, dark ? '#1e293b' : '#94a3b8', 1.15);
    scene.add(hemi);

    const fill = new THREE.DirectionalLight(0xdbeafe, 0.45);
    fill.position.set(-500, 350, -400);
    scene.add(fill);

    // Солнце с мягкими тенями 2048×2048.
    const light = new THREE.DirectionalLight(0xffffff, 2.2);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.camera.left = -650;
    light.shadow.camera.right = 650;
    light.shadow.camera.top = 650;
    light.shadow.camera.bottom = -650;
    light.shadow.camera.near = 50;
    light.shadow.camera.far = 4200;
    light.shadow.bias = -0.0003;
    light.shadow.normalBias = 0.6;
    scene.add(light);
    scene.add(light.target);

    // Видимый диск солнца.
    const sunGroup = new THREE.Group();
    const sunSphere = new THREE.Mesh(
      new THREE.SphereGeometry(32, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfffbeb }),
    );
    sunGroup.add(sunSphere);
    const corona = new THREE.Mesh(
      new THREE.RingGeometry(36, 72, 32),
      new THREE.MeshBasicMaterial({ color: 0xfde047, side: THREE.DoubleSide, transparent: true, opacity: 0.35 }),
    );
    sunGroup.add(corona);
    scene.add(sunGroup);

    // Плита земли и архитектурная сетка.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400),
      new THREE.MeshStandardMaterial({ color: dark ? '#1e293b' : '#cbd5e1', roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.userData.isGround = true;
    scene.add(ground);

    const grid = createGroundGrid(dark);
    scene.add(grid);

    // Ghost-превью коробки в режиме добавления.
    const ghostGeo = new THREE.BoxGeometry(20, 15, 12);
    const ghostMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.45,
      wireframe: false,
    });
    const ghostMesh = new THREE.Mesh(ghostGeo, ghostMat);
    ghostMesh.visible = false;
    scene.add(ghostMesh);

    // 3D-поток ветра: 350 аэродинамических частиц.
    const PARTICLE_COUNT = 350;
    const pGeo = new THREE.CylinderGeometry(0.3, 0.3, 3.2, 5);
    pGeo.rotateX(Math.PI / 2);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    const windMesh = new THREE.InstancedMesh(pGeo, pMat, PARTICLE_COUNT);
    windMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const speeds = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 1000;
      positions[i * 3 + 1] = 4 + Math.random() * 16;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1000;
      speeds[i] = 0.6 + Math.random() * 0.8;
    }
    scene.add(windMesh);

    divRef.current?.appendChild(renderer.domElement);

    const ro = new ResizeObserver(() => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(host);

    const dummy = new THREE.Object3D();
    const cObj = new THREE.Color();
    let raf = 0;
    let lastTime = performance.now();

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      controls.update();

      // Движение частиц ветра.
      if (windMesh.visible) {
        const { windDir: wDir, windSpeed: wSpeed } = stateRef.current;
        const rad = (wDir * Math.PI) / 180;
        const wx = Math.sin(rad);
        const wz = -Math.cos(rad);
        const flowSpeed = Math.max(1, wSpeed) * 14;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
          positions[i * 3] += wx * flowSpeed * speeds[i] * dt;
          positions[i * 3 + 2] += wz * flowSpeed * speeds[i] * dt;

          if (positions[i * 3] < -520) positions[i * 3] += 1040;
          if (positions[i * 3] > 520) positions[i * 3] -= 1040;
          if (positions[i * 3 + 2] < -520) positions[i * 3 + 2] += 1040;
          if (positions[i * 3 + 2] > 520) positions[i * 3 + 2] -= 1040;

          dummy.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
          dummy.rotation.y = rad;
          dummy.scale.set(1, 1, Math.min(3, 1 + wSpeed * 0.25));
          dummy.updateMatrix();
          windMesh.setMatrixAt(i, dummy.matrix);

          if (wSpeed < 2) cObj.set('#94a3b8');
          else if (wSpeed < 5) cObj.set('#38bdf8');
          else if (wSpeed < 8) cObj.set('#34d399');
          else cObj.set('#fbbf24');
          windMesh.setColorAt(i, cObj);
        }
        windMesh.instanceMatrix.needsUpdate = true;
        if (windMesh.instanceColor) windMesh.instanceColor.needsUpdate = true;
      }

      corona.lookAt(camera.position);
      renderer.render(scene, camera);
    };

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!reduce.matches) raf = requestAnimationFrame(loop);
    else renderer.render(scene, camera);

    // Рейкастинг и интерактивность.
    const ray = new THREE.Raycaster();
    const ptr = new THREE.Vector2();

    const onClick = (ev: MouseEvent) => {
      const el = renderer.domElement;
      const r = el.getBoundingClientRect();
      ptr.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
      ptr.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ptr, camera);

      const hits = ray.intersectObjects(scene.children, true);
      const isAdd = stateRef.current.addMode;

      for (const h of hits) {
        if (isAdd && h.object.userData.isGround) {
          const gx = Math.round(h.point.x + 500);
          const gy = Math.round(500 - h.point.z);
          cbRef.current.onAddAt?.(gx, gy);
          return;
        }

        let o: THREE.Object3D | null = h.object;
        while (o) {
          if (o.userData.attrId) {
            cbRef.current.onSelectAttr?.(o.userData.attrId);
            return;
          }
          if (o.userData.buildingId) {
            cbRef.current.onSelect(o.userData.buildingId);
            return;
          }
          o = o.parent;
        }
      }
      cbRef.current.onSelect(null);
      cbRef.current.onSelectAttr?.(null);
    };

    const onPointerMove = (ev: MouseEvent) => {
      const el = renderer.domElement;
      const r = el.getBoundingClientRect();
      ptr.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
      ptr.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ptr, camera);

      const hits = ray.intersectObjects(scene.children, true);
      const isAdd = stateRef.current.addMode;

      if (isAdd) {
        const groundHit = hits.find((h) => h.object.userData.isGround);
        if (groundHit) {
          ghostMesh.visible = true;
          ghostMesh.scale.set(stateRef.current.ghostW / 20, 1, stateRef.current.ghostD / 12);
          ghostMesh.position.set(groundHit.point.x, 7.5, groundHit.point.z);
        } else {
          ghostMesh.visible = false;
        }
      } else {
        ghostMesh.visible = false;
      }

      const hoverable = hits.some(
        (h) => h.object.userData.buildingId || h.object.userData.attrId || (isAdd && h.object.userData.isGround),
      );
      renderer.domElement.style.cursor = hoverable ? 'pointer' : 'default';
    };

    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    sceneRef.current = {
      renderer,
      scene,
      camera,
      controls,
      light,
      sunMesh: sunGroup,
      groups: new Map(),
      context: null,
      ghostMesh,
      ground,
      grid,
      bgColor,
      windParticles: { mesh: windMesh, positions, speeds },
    };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      controls.dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          const mat = m.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else mat?.dispose();
        }
      });
      renderer.dispose();
      if (host.contains(renderer.domElement)) host.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, []);

  // Синхронизация модели района.
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (s.context) {
      s.scene.remove(s.context);
      disposeContextGroup(s.context);
      s.context = null;
    }
    const ctx = buildContextGroup(model, dark);
    s.context = ctx;
    s.scene.add(ctx);

    const seen = new Set<string>();
    for (const b of model.buildings) {
      seen.add(b.id);
      if (s.groups.has(b.id)) continue;
      const built = createBuildingMesh(b, dark);
      s.groups.set(b.id, built.group);
      s.scene.add(built.group);
    }
    const dead: string[] = [];
    s.groups.forEach((_, id) => {
      if (!seen.has(id)) dead.push(id);
    });
    for (const id of dead) {
      const g = s.groups.get(id);
      if (g) {
        s.scene.remove(g);
        disposeBuilding(g);
        s.groups.delete(id);
      }
    }
  }, [model]);

  // Управление слоями.
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.light.castShadow = showShadow;
    s.groups.forEach((g, id) => {
      const b = model.buildings.find((x) => x.id === id);
      g.visible = b?.preset === 'custom' || showOsm;
    });
    if (s.windParticles) {
      s.windParticles.mesh.visible = showWind && windSpeed > 0;
    }
    if (!addMode && s.ghostMesh) {
      s.ghostMesh.visible = false;
    }
  }, [showShadow, showOsm, showWind, windSpeed, addMode, model]);

  // Инсоляция и подсветка выбранного здания.
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    const [x, y, z] = sunLightPos(sun, 1800);
    s.light.position.set(x, Math.max(120, y), z);

    const [sx, sy, sz] = sunLightPos(sun, 2400);
    s.sunMesh.position.set(sx, sy, sz);
    s.sunMesh.visible = sun.alt > 0.02;

    s.groups.forEach((g, id) => {
      const sel = id === selectedId;
      g.traverse((o: THREE.Object3D) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const mm of mats) {
            const sm = mm as THREE.MeshStandardMaterial;
            if ('emissive' in sm) {
              sm.emissive.setHex(sel ? 0x2563eb : 0x000000);
              sm.emissiveIntensity = sel ? 0.45 : 0;
            }
          }
        }
      });
      g.scale.setScalar(sel ? 1.025 : 1);
    });
  }, [sun, selectedId]);

  const resetView = () => {
    const s = sceneRef.current;
    if (!s) return;
    s.camera.position.set(520, 520, 720);
    s.controls.target.set(0, 0, 30);
    s.controls.update();
  };

  return (
    <div
      role="img"
      aria-label="3D-модель района: симуляция теней и динамики ветра"
      className={`relative ${
        className ?? 'h-[460px] w-full overflow-hidden rounded-[24px] border border-white/60 dark:border-white/20'
      }`}
    >
      <div ref={divRef} className="h-full w-full [&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full" />

      {/* Оверлей состояния инсоляции и ветра. */}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5 rounded-2xl border border-white/60 bg-white/75 p-3 text-xs shadow-md backdrop-blur-md dark:border-white/10 dark:bg-gray-900/75">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
          <span className="font-bold text-gray-900 dark:text-gray-100">
            {hour}:00 · Высота солнца {Math.max(0, Math.round((sun.alt * 180) / Math.PI))}°
          </span>
        </div>
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <svg
            className="h-3.5 w-3.5 text-blue-500"
            style={{ transform: `rotate(${windDir}deg)` }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
          <span>Ветер {windSpeed} м/с · {windDir}°</span>
        </div>
      </div>

      <div className="absolute bottom-3 right-3 flex items-center gap-2">
        <button
          type="button"
          onClick={resetView}
          className="rounded-full border border-white/60 bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm backdrop-blur-md transition-all hover:scale-105 active:scale-95 dark:border-white/20 dark:bg-gray-900/80 dark:text-gray-200"
        >
          Сбросить ракурс
        </button>
      </div>
    </div>
  );
}
