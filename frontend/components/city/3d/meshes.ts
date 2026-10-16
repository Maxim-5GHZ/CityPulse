import * as THREE from 'three';

export function createCarMesh(colorHex: number): THREE.Group {
  const car = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(6.4, 1.8, 3.2),
    new THREE.MeshLambertMaterial({ color: colorHex }),
  );
  body.position.y = 1.1;
  body.castShadow = true;
  car.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 1.4, 2.6),
    new THREE.MeshLambertMaterial({ color: 0x0f172a }),
  );
  cabin.position.set(-0.4, 2.4, 0);
  cabin.castShadow = true;
  car.add(cabin);

  return car;
}

export function createPedestrianMesh(colorHex: number): THREE.Group {
  const ped = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.35, 1.4, 8),
    new THREE.MeshLambertMaterial({ color: colorHex }),
  );
  body.position.y = 0.9;
  ped.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 8, 8),
    new THREE.MeshLambertMaterial({ color: 0xfef08a }),
  );
  head.position.y = 1.8;
  ped.add(head);

  return ped;
}

export function createTreeMesh(): THREE.Group {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.6, 2.5, 6),
    new THREE.MeshLambertMaterial({ color: 0x5c4033 }),
  );
  trunk.position.y = 1.25;
  tree.add(trunk);

  const foliage = new THREE.Mesh(
    new THREE.ConeGeometry(2.6, 6, 8),
    new THREE.MeshLambertMaterial({ color: 0x166534 }),
  );
  foliage.position.y = 5.0;
  foliage.castShadow = true;
  tree.add(foliage);

  return tree;
}
