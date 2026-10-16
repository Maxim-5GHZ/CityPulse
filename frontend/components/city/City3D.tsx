// Кейс 03 — 3D-сцена на Three.js. Процедурная геометрия из DistrictModel.
// Свет из suncalc, тени PCFSoft. OrbitControls + ResizeObserver + rAF чистятся.
'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { DistrictModel } from '@/lib/city/model';
import { createBuildingMesh, disposeBuilding } from '@/lib/city/three-factory';
import { sunLightPos, type SunPos } from '@/lib/city/shadow';

interface Props {
  model: DistrictModel;
  sun: SunPos;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}

export default function City3D({ model, sun, selectedId, onSelect, className }: Props) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; light: THREE.DirectionalLight; groups: Map<string, THREE.Group> } | null>(null);
  const cbRef = useRef({ onSelect });
  cbRef.current = { onSelect };

  // Сцена один раз.
  useEffect(() => {
    const host = divRef.current;
    if (!host) return;
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(dark ? '#0f172a' : '#e2e8f0');
    scene.fog = new THREE.Fog(dark ? '#0f172a' : '#e2e8f0', 1800, 3200);
    const camera = new THREE.PerspectiveCamera(50, 1, 1, 6000);
    camera.position.set(650, 620, 950);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.update();

    const hemi = new THREE.HemisphereLight(0xffffff, dark ? '#1e293b' : '#94a3b8', 0.9);
    scene.add(hemi);
    const light = new THREE.DirectionalLight(0xffffff, 2.2);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.left = -800;
    light.shadow.camera.right = 800;
    light.shadow.camera.top = 800;
    light.shadow.camera.bottom = -800;
    light.shadow.camera.far = 5000;
    scene.add(light);
    scene.add(light.target);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1100, 1100),
      new THREE.MeshStandardMaterial({ color: dark ? '#1e293b' : '#cbd5e1', roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

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

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!reduce.matches) loop();
    else renderer.render(scene, camera);

    const ray = new THREE.Raycaster();
    const ptr = new THREE.Vector2();
    const onClick = (ev: MouseEvent) => {
      const el = renderer.domElement;
      const r = el.getBoundingClientRect();
      ptr.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
      ptr.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ptr, camera);
      const hits = ray.intersectObjects(scene.children, true);
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object;
        while (o) {
          const id = (o.userData as { buildingId?: string }).buildingId;
          if (id) {
            cbRef.current.onSelect(id);
            return;
          }
          o = o.parent;
        }
      }
      cbRef.current.onSelect(null);
    };
    renderer.domElement.addEventListener('click', onClick);

    sceneRef.current = { renderer, scene, camera, light, groups: new Map() };
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('click', onClick);
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
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

  // Здания при смене модели.
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    const seen = new Set<string>();
    for (const b of model.buildings) {
      seen.add(b.id);
      if (s.groups.has(b.id)) continue;
      const built = createBuildingMesh(b);
      s.groups.set(b.id, built.group);
      s.scene.add(built.group);
    }
    const dead: string[] = [];
    s.groups.forEach((g, id) => {
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

  // Солнце и подсветка выбора.
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    const [x, y, z] = sunLightPos(sun);
    s.light.position.set(x, Math.max(50, y), z);
    s.groups.forEach((g, id) => {
      const sel = id === selectedId;
      g.traverse((o: THREE.Object3D) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const mm of mats) {
            const sm = mm as THREE.MeshStandardMaterial;
            if ('emissive' in sm) sm.emissive.setHex(sel ? 0x1d4ed8 : 0x000000);
          }
        }
      });
      g.scale.setScalar(sel ? 1.02 : 1);
    });
  }, [sun, selectedId]);

  return (
    <div
      ref={divRef}
      role="img"
      aria-label="Трёхмерная модель района: процедурные здания из открытых данных OpenStreetMap. Клик выбирает здание."
      className={
        className ??
        'h-[420px] w-full overflow-hidden rounded-[24px] border border-white/60 dark:border-white/20 [&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full'
      }
    />
  );
}
