// Процедурная 3D-фабрика: экструзия OSM-полигонов, чистые архитектурные плоские
// кровли с надстройками, деревья в парках, дорожная сеть и 3D-маркеры притяжений.
// Палитра — slate + приглушённый стально-голубой (см. AGENTS.md). Мир: 1000м,
// центр 0; wx=x-500, wz=500-y.
import * as THREE from 'three';
import type { Attraction, Building, DistrictModel } from './model';

const texCache = new Map<string, THREE.CanvasTexture>();

function facadeTexture(floors: number, dark: boolean): THREE.CanvasTexture {
  const key = `${floors}_${dark ? 'd' : 'l'}`;
  const hit = texCache.get(key);
  if (hit) return hit;

  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d')!;

  // Фасадная основа.
  g.fillStyle = dark ? '#2a3447' : '#94a3b8';
  g.fillRect(0, 0, 128, 256);

  // Вертикальные простенки.
  g.fillStyle = dark ? 'rgba(15, 23, 42, 0.35)' : 'rgba(255, 255, 255, 0.2)';
  for (let x = 0; x < 128; x += 32) {
    g.fillRect(x, 0, 1, 256);
  }

  // Оконные проёмы по этажам.
  const rows = Math.max(1, Math.min(24, floors));
  const rowH = 256 / rows;
  const winH = rowH * 0.48;
  const cols = 4;
  const colW = 128 / cols;
  const winW = colW * 0.55;

  for (let r = 0; r < rows; r++) {
    const y = r * rowH + (rowH - winH) / 2;
    // Линия плиты перекрытия.
    g.fillStyle = 'rgba(0, 0, 0, 0.3)';
    g.fillRect(0, (r + 1) * rowH - 2, 128, 2);

    for (let cIdx = 0; cIdx < cols; cIdx++) {
      const x = cIdx * colW + (colW - winW) / 2;
      g.fillStyle = 'rgba(15, 23, 42, 0.45)';
      g.fillRect(x - 1, y - 1, winW + 2, winH + 2);

      const isLit = (r * 3 + cIdx * 7) % 5 === 0;
      g.fillStyle = isLit ? (dark ? '#60a5fa' : '#bfdbfe') : dark ? '#1e293b' : '#334155';
      g.fillRect(x, y, winW, winH);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / 12, 1 / (Math.max(1, rows) * 3));
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
    const px = x - cx;
    const py = y - cy;
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

export function createBuildingMesh(b: Building, dark = false): BuiltHouse {
  const group = new THREE.Group();
  const { shape, cx, cy } = shapeFromFootprint(b.footprint);

  const geo = new THREE.ExtrudeGeometry(shape, { depth: b.h, bevelEnabled: false });
  const isCustom = b.preset === 'custom';

  const tex = facadeTexture(b.floors, dark);
  const wallColor = isCustom ? (dark ? '#1d4ed8' : '#2563eb') : dark ? '#475569' : '#8ca3ba';

  const wallMat = new THREE.MeshStandardMaterial({
    map: tex,
    color: wallColor,
    roughness: isCustom ? 0.35 : 0.85,
    metalness: isCustom ? 0.25 : 0.05,
  });

  const roofColor = isCustom ? (dark ? '#1e40af' : '#1d4ed8') : dark ? '#1e293b' : '#334155';

  const roofMat = new THREE.MeshStandardMaterial({
    color: roofColor,
    roughness: 0.95,
  });

  const body = new THREE.Mesh(geo, [roofMat, wallMat]);
  body.rotation.x = -Math.PI / 2;
  body.position.set(cx - 500, 0, 500 - cy);
  body.castShadow = true;
  body.receiveShadow = true;
  body.userData.buildingId = b.id;
  group.add(body);

  // Чёткие архитектурные ребра.
  const edgeGeo = new THREE.EdgesGeometry(geo, 25);
  const edgeMat = new THREE.LineBasicMaterial({
    color: isCustom ? 0x93c5fd : dark ? 0x64748b : 0x334155,
    transparent: true,
    opacity: isCustom ? 0.85 : 0.45,
  });
  const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
  edgeLines.rotation.x = -Math.PI / 2;
  edgeLines.position.set(cx - 500, 0, 500 - cy);
  group.add(edgeLines);

  // Надстройки лифтовых шахт и вентиляции для зданий от 3 этажей.
  if (b.floors >= 3) {
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
    const bw = maxX - minX;
    const bd = maxY - minY;
    if (bw > 12 && bd > 8) {
      const pw = Math.max(3, Math.min(8, bw * 0.25));
      const pd = Math.max(3, Math.min(8, bd * 0.25));
      const ph = 2.4;
      const pBox = new THREE.BoxGeometry(pw, ph, pd);
      const pMesh = new THREE.Mesh(pBox, roofMat);
      pMesh.position.set(cx - 500, b.h + ph / 2, 500 - cy);
      pMesh.castShadow = true;
      pMesh.receiveShadow = true;
      pMesh.userData.buildingId = b.id;
      group.add(pMesh);
    }
  }

  return { group, body };
}

export function disposeBuilding(g: THREE.Group): void {
  g.traverse((o) => {
    const anyO = o as THREE.Mesh | THREE.LineSegments;
    const geo = (anyO as { geometry?: THREE.BufferGeometry }).geometry;
    geo?.dispose();
    const mat = (anyO as { material?: THREE.Material | THREE.Material[] }).material;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}

function pointInPolygon(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function createAttractionPin(attr: Attraction, pos: [number, number]): THREE.Group {
  const group = new THREE.Group();
  const [x, z] = pos;
  group.position.set(x, 0, z);
  group.userData.attrId = attr.id;

  const hexColor = attr.kind === 'ostanovka' ? 0x2563eb : attr.kind === 'park' ? 0x16a34a : 0xd97706;
  const letter = attr.kind === 'ostanovka' ? 'О' : attr.kind === 'park' ? 'П' : 'Ш';

  // Игла.
  const poleGeo = new THREE.CylinderGeometry(0.2, 0.2, 14, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.8 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = 7;
  pole.castShadow = true;
  group.add(pole);

  // Кольцо на земле.
  const ringGeo = new THREE.RingGeometry(2.5, 3.4, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: hexColor, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.3;
  group.add(ring);

  // Спрайт-бейдж с буквой.
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = attr.kind === 'ostanovka' ? '#2563eb' : attr.kind === 'park' ? '#16a34a' : '#d97706';
  g.beginPath();
  g.arc(32, 32, 28, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = '#ffffff';
  g.stroke();
  g.fillStyle = '#ffffff';
  g.font = 'bold 30px Inter, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, 32, 33);

  const tex = new THREE.CanvasTexture(c);
  const spriteMat = new THREE.SpriteMaterial({ map: tex });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.y = 15;
  sprite.scale.set(8, 8, 1);
  sprite.userData.attrId = attr.id;
  group.add(sprite);

  return group;
}

export function buildContextGroup(model: DistrictModel, dark = false): THREE.Group {
  const group = new THREE.Group();
  const nodeById = new Map(model.nodes.map((n) => [n.id, n]));

  // Дороги и переходы.
  const trot: number[] = [];
  const pereh: number[] = [];
  for (const e of model.edges) {
    const A = nodeById.get(e.a);
    const B = nodeById.get(e.b);
    if (!A || !B) continue;
    const dst = e.type === 'perehod' ? pereh : trot;
    dst.push(A.x - 500, 0.4, 500 - A.y, B.x - 500, 0.4, 500 - B.y);
  }

  const mkLines = (arr: number[], color: string, width = 1) => {
    if (arr.length === 0) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3));
    const m = new THREE.LineBasicMaterial({ color, linewidth: width, transparent: true, opacity: 0.85 });
    group.add(new THREE.LineSegments(g, m));
  };
  mkLines(trot, dark ? '#64748b' : '#cbd5e1');
  mkLines(pereh, '#3b82f6', 2);

  // Зелёные зоны (парки) с процедурными деревьями.
  for (const gr of model.greens) {
    if (gr.polygon.length < 3) continue;
    const s = new THREE.Shape();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    gr.polygon.forEach(([x, y], i) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const sx = x - 500;
      const sy = y - 500;
      if (i === 0) s.moveTo(sx, sy);
      else s.lineTo(sx, sy);
    });
    s.closePath();

    const g = new THREE.ShapeGeometry(s);
    g.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({ color: dark ? '#1e3a2f' : '#86efac', roughness: 0.95 }),
    );
    mesh.position.y = 0.2;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Сажаем низкополигональные деревья в границах парка.
    let planted = 0;
    for (let attempt = 0; attempt < 60 && planted < 12; attempt++) {
      const tx = minX + Math.random() * (maxX - minX);
      const ty = minY + Math.random() * (maxY - minY);
      if (pointInPolygon(tx, ty, gr.polygon)) {
        planted++;
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.4, 2.2, 5),
          new THREE.MeshStandardMaterial({ color: dark ? '#334155' : '#78350f', roughness: 0.9 }),
        );
        trunk.position.y = 1.1;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        tree.add(trunk);

        const fol = new THREE.Mesh(
          new THREE.ConeGeometry(2.1, 4.0, 6),
          new THREE.MeshStandardMaterial({ color: dark ? '#166534' : '#22c55e', roughness: 0.85, flatShading: true }),
        );
        fol.position.y = 3.8;
        fol.castShadow = true;
        fol.receiveShadow = true;
        tree.add(fol);

        tree.position.set(tx - 500, 0, 500 - ty);
        group.add(tree);
      }
    }
  }

  // Маркеры притяжений.
  for (const a of model.attractions) {
    const node = nodeById.get(a.nodeId);
    if (!node) continue;
    group.add(createAttractionPin(a, [node.x - 500, 500 - node.y]));
  }

  return group;
}

export function createGroundGrid(dark: boolean): THREE.GridHelper {
  const grid = new THREE.GridHelper(1000, 20, dark ? '#334155' : '#cbd5e1', dark ? '#1e293b' : '#e2e8f0');
  grid.position.y = 0.12;
  const mat = grid.material as THREE.LineBasicMaterial;
  mat.transparent = true;
  mat.opacity = dark ? 0.4 : 0.6;
  return grid;
}

export function disposeContextGroup(g: THREE.Group): void {
  g.traverse((o) => {
    const anyO = o as THREE.Mesh | THREE.Line | THREE.Sprite;
    const geo = (anyO as { geometry?: THREE.BufferGeometry }).geometry;
    geo?.dispose();
    const mat = (anyO as { material?: THREE.Material | THREE.Material[] }).material;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}
