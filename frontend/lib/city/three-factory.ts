// Кейс 03 — процедурная 3D-фабрика без спутника и внешних мешей.
// Тело: ExtrudeGeometry(footprint, h). Фасад: CanvasTexture 128x256, сетка окон по floors.
// Крыши: flat плита / gable призма / hip пирамида. Палитра — slate + приглушённый
// стально-голубой (см. AGENTS.md). Мир: 1000м, центр 0; wx=x-500, wz=500-y.
import * as THREE from 'three';
import type { Building, DistrictModel } from './model';

const WALL = '#9db4c9'; // приглушённый стально-голубой (светлее — читается при низком солнце)
const WALL_DARK = '#64748b'; // slate
const ROOF_C = '#5d7389'; // slate: светлее прежнего #475569 — крыши не уходят в черноту
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
  // UV экструда — в метрах (координаты контура), поэтому без повтора текстура
  // клампится и мажется в края. Тайлим: плитка = cols*3 м по ширине и rows*3 м
  // по высоте (~окно каждые 3 м), тогда на корпусе любого размера сетка окон целая.
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / (cols * 3), 1 / (Math.max(1, rows) * 3));
  tex.anisotropy = 4;
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
  // Реальные габариты — из bbox (раньше ширина бралась из абсолютного X и всегда
  // давала cols=8 с растянутыми окнами).
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
  const geo = new THREE.ExtrudeGeometry(shape, { depth: b.h, bevelEnabled: false });
  const tex = facadeTexture(b.floors, w);
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
  // Плоское затенение: на 4-сегментном конусе и призме сглаженные нормали дают
  // грязный градиент через ребро 90°. Палитра та же — slate.
  const roofMat = new THREE.MeshStandardMaterial({ color: ROOF_C, roughness: 0.95, flatShading: true });
  if (b.roof === 'gable') {
    // Призма коньком вдоль X. Высота занижена (было до 6 м — на домиках смотрелось
    // шпилями) и торцы намотаны наружу: раньше оба торцевых треугольника были
    // завёрнуты внутрь и с лицевой стороны выцветали в черноту.
    const rh = Math.min(3.5, Math.max(1.2, d * 0.15));
    const g = new THREE.BufferGeometry();
    const hw = w / 2;
    const hd = d / 2;
    const v = new Float32Array([
      -hw, 0, -hd, 0, rh, -hd, hw, 0, -hd,
      -hw, 0, hd, hw, 0, hd, 0, rh, hd,
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
    // Пирамида строго в габаритах w×d (основание конуса на 4 сегмента после
    // поворота — квадрат со стороной max(w,d), масштабируем к w×d).
    const rh = Math.min(4, Math.max(1.2, Math.min(w, d) * 0.18));
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

/** Контекст сцены: улицы из рёбер графа + зелень. Та же проекция в мир 0→±500. */
export function buildContextGroup(model: DistrictModel): THREE.Group {
  const group = new THREE.Group();
  const nodeById = new Map(model.nodes.map((n) => [n.id, n]));
  const trot: number[] = [];
  const pereh: number[] = [];
  for (const e of model.edges) {
    const A = nodeById.get(e.a);
    const B = nodeById.get(e.b);
    if (!A || !B) continue;
    const dst = e.type === 'perehod' ? pereh : trot;
    dst.push(A.x - 500, 0.6, 500 - A.y, B.x - 500, 0.6, 500 - B.y);
  }
  const mkLines = (arr: number[], color: string) => {
    if (arr.length === 0) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3));
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    group.add(new THREE.LineSegments(g, m));
  };
  mkLines(trot, '#dfe7f0');
  mkLines(pereh, '#3b82f6');
  for (const gr of model.greens) {
    if (gr.polygon.length < 3) continue;
    const s = new THREE.Shape();
    gr.polygon.forEach(([x, y], i) => {
      const sx = x - 500;
      const sy = y - 500; // после rotateX(-90°) даст wz = 500-y
      if (i === 0) s.moveTo(sx, sy);
      else s.lineTo(sx, sy);
    });
    s.closePath();
    const g = new THREE.ShapeGeometry(s);
    g.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({ color: '#7e96ab', roughness: 1 }),
    );
    mesh.position.y = 0.3;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

export function disposeContextGroup(g: THREE.Group): void {
  g.traverse((o) => {
    const anyO = o as THREE.Line | THREE.Mesh;
    const geo = (anyO as { geometry?: THREE.BufferGeometry }).geometry;
    geo?.dispose();
    const mat = (anyO as { material?: THREE.Material | THREE.Material[] }).material;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}
