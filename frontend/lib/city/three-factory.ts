// Кейс 03 — процедурная 3D-фабрика без спутника и внешних мешей.
// Тело: ExtrudeGeometry(footprint, h). Фасад: CanvasTexture 128x256, сетка окон по floors.
// Крыши: flat плита / gable призма / hip пирамида. Палитра — slate + приглушённый
// стально-голубой (см. AGENTS.md). Мир: 1000м, центр 0; wx=x-500, wz=500-y.
import * as THREE from 'three';
import type { Building } from './model';

const WALL = '#8fa3b8'; // приглушённый стально-голубой
const WALL_DARK = '#64748b'; // slate
const ROOF_C = '#475569';
const WIN_LIT = '#dbe7f3';
const WIN_DARK = '#334155';

const texCache = new Map<string, THREE.CanvasTexture>();

function facadeTexture(floors: number, w: number): THREE.CanvasTexture {
  const key = `${floors}x${Math.round(w)}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = WALL;
  g.fillRect(0, 0, 128, 256);
  // лёгкая вертикальная вуаль
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(0,0,0,0.12)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);
  const cols = Math.max(2, Math.min(8, Math.round(w / 4)));
  const rows = Math.max(1, Math.min(24, floors));
  const mx = 12;
  const my = 10;
  const cw = (128 - mx * 2) / cols;
  const ch = (256 - my * 2) / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const lit = (r * 7 + col * 3) % 4 !== 0;
      g.fillStyle = lit ? WIN_LIT : WIN_DARK;
      g.fillRect(mx + col * cw + 2, my + r * ch + 3, cw - 4, ch - 6);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

function shapeFromFootprint(fp: [number, number][]): { shape: THREE.Shape; cx: number; cy: number } {
  let cx = 0;
  let cy = 0;
  for (const [x, y] of fp) {
    cx += x;
    cy += y;
  }
  cx /= fp.length;
  cy /= fp.length;
  const s = new THREE.Shape();
  fp.forEach(([x, y], i) => {
    const px = x - 500 - (cx - 500);
    const py = y - 500 - (cy - 500);
    if (i === 0) s.moveTo(px, py);
    else s.lineTo(px, py);
  });
  s.closePath();
  return { shape: s, cx, cy };
}

export interface BuiltHouse {
  group: THREE.Group;
  body: THREE.Mesh;
}

export function createBuildingMesh(b: Building): BuiltHouse {
  const group = new THREE.Group();
  const { shape, cx, cy } = shapeFromFootprint(b.footprint);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: b.h, bevelEnabled: false });
  const tex = facadeTexture(b.floors, Math.hypot(b.footprint[1]?.[0] ?? 10, 0) || 10);
  const wallMat = new THREE.MeshStandardMaterial({ map: tex, color: '#ffffff', roughness: 0.9 });
  const capMat = new THREE.MeshStandardMaterial({ color: WALL_DARK, roughness: 1 });
  const body = new THREE.Mesh(geo, [capMat, wallMat]);
  body.rotation.x = -Math.PI / 2;
  body.position.set(cx - 500, 0, 500 - cy);
  body.castShadow = true;
  body.receiveShadow = true;
  body.userData.buildingId = b.id;
  group.add(body);

  // Крыша поверх корпуса (мир: y = h).
  const wx = cx - 500;
  const wz = 500 - cy;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of b.footprint) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const w = Math.max(2, maxX - minX);
  const d = Math.max(2, maxY - minY);
  const roofMat = new THREE.MeshStandardMaterial({ color: ROOF_C, roughness: 1 });
  if (b.roof === 'gable') {
    const rh = Math.min(6, Math.max(2, d * 0.18));
    const g = new THREE.BufferGeometry();
    const hw = w / 2;
    const hd = d / 2;
    const v = new Float32Array([
      -hw, 0, -hd, hw, 0, -hd, 0, rh, -hd,
      -hw, 0, hd, 0, rh, hd, hw, 0, hd,
      -hw, 0, -hd, -hw, 0, hd, 0, rh, hd, 0, rh, -hd,
      hw, 0, -hd, 0, rh, -hd, 0, rh, hd, hw, 0, hd,
    ]);
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    g.computeVertexNormals();
    const roof = new THREE.Mesh(g, roofMat);
    roof.position.set(wx, b.h, wz);
    roof.castShadow = true;
    roof.receiveShadow = true;
    roof.userData.buildingId = b.id;
    group.add(roof);
  } else if (b.roof === 'hip') {
    const rh = Math.min(7, Math.max(2, Math.min(w, d) * 0.22));
    const g = new THREE.ConeGeometry(Math.SQRT1_2 * Math.max(w, d), rh, 4);
    const roof = new THREE.Mesh(g, roofMat);
    roof.position.set(wx, b.h + rh / 2, wz);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
    roof.castShadow = true;
    roof.receiveShadow = true;
    roof.userData.buildingId = b.id;
    group.add(roof);
  } else {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, d), roofMat);
    slab.position.set(wx, b.h + 0.3, wz);
    slab.castShadow = true;
    slab.receiveShadow = true;
    slab.userData.buildingId = b.id;
    group.add(slab);
  }
  return { group, body };
}

export function disposeBuilding(g: THREE.Group): void {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    }
  });
}
