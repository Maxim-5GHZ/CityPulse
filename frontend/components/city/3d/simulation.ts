import * as THREE from 'three';
import { GraphEdge, GraphNode } from '@/lib/city-engine/types';

export interface CrowdAgent {
  mesh: THREE.Group;
  waypoints: THREE.Vector3[];
  currentIdx: number;
  progress: number;
  speed: number;
  bobOffset: number;
}

export interface CarAgent {
  mesh: THREE.Group;
  edgeId: string;
  direction: 1 | -1;
  progress: number;
  speed: number;
  laneOffset: number;
  currentAngle: number;
}

export function updateCrowdSimulation(
  crowd: CrowdAgent[],
  dt: number,
  speedMultiplier: number,
  elapsedTime: number,
) {
  crowd.forEach((ped) => {
    ped.progress += dt * ped.speed * speedMultiplier * 0.4;
    if (ped.progress >= 1) {
      ped.progress = 0;
      ped.currentIdx = (ped.currentIdx + 1) % (ped.waypoints.length - 1);
    }
    const p1 = ped.waypoints[ped.currentIdx];
    const p2 = ped.waypoints[ped.currentIdx + 1];
    if (p1 && p2) {
      ped.mesh.position.lerpVectors(p1, p2, ped.progress);
      ped.mesh.position.y = 0.4 + Math.abs(Math.sin(elapsedTime * 8 + ped.bobOffset)) * 0.25;
    }
  });
}

export function updateCarsSimulation(
  cars: CarAgent[],
  dt: number,
  speedMultiplier: number,
  edgeMap: Map<string, GraphEdge>,
  nodeMap: Map<string, GraphNode>,
  roadEdges: GraphEdge[],
  to3D: (x: number, y: number) => [number, number],
) {
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
    const targetAngle = Math.atan2(dz, dx);

    const curSpeed = edge.isActive ? car.speed : 0;
    car.progress += dt * curSpeed * speedMultiplier * 0.45;

    if (car.progress >= 1) {
      car.progress = 0;
      const nextEdges = roadEdges.filter(
        (e) => e.id !== edge.id && (e.from === toNode.id || e.to === toNode.id),
      );
      if (nextEdges.length > 0) {
        const nextEdge = nextEdges[idx % nextEdges.length];
        car.edgeId = nextEdge.id;
        car.direction = nextEdge.from === toNode.id ? 1 : -1;
      } else {
        car.direction = (car.direction * -1) as 1 | -1;
      }
    }

    const curX = x1 + dx * car.progress;
    const curZ = z1 + dz * car.progress;
    const perpX = -Math.sin(targetAngle) * car.laneOffset;
    const perpZ = Math.cos(targetAngle) * car.laneOffset;

    car.mesh.position.set(curX + perpX, 0.45, curZ + perpZ);
    car.currentAngle = THREE.MathUtils.lerp(car.currentAngle, -targetAngle, 0.12);
    car.mesh.rotation.y = car.currentAngle;
  });
}
