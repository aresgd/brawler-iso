import * as THREE from 'three';
import {
  ARENA_THICKNESS, OBSTACLES,
  DEATH_ZONE_INNER_RADIUS, PLAY_ZONE_RADIUS, DANGER_ZONE_RADIUS,
} from './config.js';
import { scene } from './scene.js';

function _makePlayTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Dark blue-gray stone base
  ctx.fillStyle = '#1e1e3a';
  ctx.fillRect(0, 0, size, size);

  // Tile grid pattern
  const tileSize = 64;
  ctx.strokeStyle = 'rgba(60, 60, 100, 0.4)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= size; x += tileSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
  }
  for (let y = 0; y <= size; y += tileSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
  }

  // Subtle noise / grain on each tile
  for (let tx = 0; tx < size; tx += tileSize) {
    for (let ty = 0; ty < size; ty += tileSize) {
      const brightness = Math.random() * 8 - 4;
      ctx.fillStyle = `rgba(${brightness > 0 ? 100 : 0}, ${brightness > 0 ? 100 : 0}, ${brightness > 0 ? 140 : 20}, 0.08)`;
      ctx.fillRect(tx + 2, ty + 2, tileSize - 4, tileSize - 4);
    }
  }

  // Scattered specks for texture
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 2;
    ctx.fillStyle = `rgba(80, 80, 120, ${Math.random() * 0.15})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

function _makeDangerTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Dark red-brown base
  ctx.fillStyle = '#3a1808';
  ctx.fillRect(0, 0, size, size);

  // Lava cracks
  ctx.strokeStyle = 'rgba(255, 100, 20, 0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) {
      x += (Math.random() - 0.5) * 80;
      y += (Math.random() - 0.5) * 80;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Glow spots along cracks
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 4 + Math.random() * 12;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255, 120, 30, 0.3)');
    grad.addColorStop(1, 'rgba(255, 60, 10, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // Dark rocky patches
  for (let i = 0; i < 100; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 3;
    ctx.fillStyle = `rgba(20, 8, 2, ${Math.random() * 0.3})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

export function createArena() {
  // === Play area (safe zone) ===
  const playTex = _makePlayTexture();
  const playGeo = new THREE.RingGeometry(DEATH_ZONE_INNER_RADIUS, PLAY_ZONE_RADIUS, 64);
  const playMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a4a,
    map: playTex,
    roughness: 0.75,
    metalness: 0.2,
    side: THREE.DoubleSide,
  });
  const playZone = new THREE.Mesh(playGeo, playMat);
  playZone.rotation.x = -Math.PI / 2;
  playZone.position.y = 0.01;
  playZone.receiveShadow = true;
  scene.add(playZone);

  // Play zone base for depth
  const playBaseGeo = new THREE.CylinderGeometry(PLAY_ZONE_RADIUS, PLAY_ZONE_RADIUS, ARENA_THICKNESS, 64);
  const playBaseMat = new THREE.MeshStandardMaterial({ color: 0x1e1e3a, roughness: 0.8 });
  const playBase = new THREE.Mesh(playBaseGeo, playBaseMat);
  playBase.position.y = -ARENA_THICKNESS / 2;
  playBase.receiveShadow = true;
  scene.add(playBase);

  // Hollow out center from the base
  const centerHoleGeo = new THREE.CylinderGeometry(DEATH_ZONE_INNER_RADIUS, DEATH_ZONE_INNER_RADIUS, ARENA_THICKNESS + 0.1, 64);
  const centerHoleMat = new THREE.MeshStandardMaterial({ color: 0x0a0a15, roughness: 1.0 });
  const centerHole = new THREE.Mesh(centerHoleGeo, centerHoleMat);
  centerHole.position.y = -ARENA_THICKNESS / 2 - 0.5;
  scene.add(centerHole);

  // === Danger zone ===
  const dangerTex = _makeDangerTexture();
  const dangerGeo = new THREE.RingGeometry(PLAY_ZONE_RADIUS, DANGER_ZONE_RADIUS, 64);
  const dangerMat = new THREE.MeshStandardMaterial({
    color: 0x5a2a10,
    map: dangerTex,
    roughness: 0.6,
    metalness: 0.3,
    emissive: 0x331100,
    emissiveIntensity: 0.4,
    side: THREE.DoubleSide,
  });
  const dangerZone = new THREE.Mesh(dangerGeo, dangerMat);
  dangerZone.rotation.x = -Math.PI / 2;
  dangerZone.position.y = 0.01;
  dangerZone.receiveShadow = true;
  scene.add(dangerZone);

  const dangerBaseGeo = new THREE.CylinderGeometry(DANGER_ZONE_RADIUS, DANGER_ZONE_RADIUS, ARENA_THICKNESS * 0.8, 64);
  const dangerBaseMat = new THREE.MeshStandardMaterial({ color: 0x4a2010, roughness: 0.7 });
  const dangerBase = new THREE.Mesh(dangerBaseGeo, dangerBaseMat);
  dangerBase.position.y = -ARENA_THICKNESS * 0.4;
  dangerBase.receiveShadow = true;
  scene.add(dangerBase);

  // === Zone boundary rings ===
  _addRing(DEATH_ZONE_INNER_RADIUS, 0xff2222, 0.8, 0.12);
  _addRing(PLAY_ZONE_RADIUS, 0xff8833, 0.5, 0.08);
  _addRing(DANGER_ZONE_RADIUS, 0xff2222, 0.8, 0.12);

  // === Grid on play area ===
  const gridMat = new THREE.LineBasicMaterial({ color: 0x2a2a50, transparent: true, opacity: 0.3 });
  const gridStep = 2;
  const gridRange = PLAY_ZONE_RADIUS;
  for (let i = -gridRange; i <= gridRange; i += gridStep) {
    // Horizontal lines
    const hPoints = [new THREE.Vector3(i, 0.015, -gridRange), new THREE.Vector3(i, 0.015, gridRange)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(hPoints), gridMat));
    // Vertical lines
    const vPoints = [new THREE.Vector3(-gridRange, 0.015, i), new THREE.Vector3(gridRange, 0.015, i)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(vPoints), gridMat));
  }

  // === Center death zone vortex effect ===
  for (let r = 0; r < 3; r++) {
    const vortexGeo = new THREE.TorusGeometry(DEATH_ZONE_INNER_RADIUS * (0.3 + r * 0.25), 0.03, 8, 32);
    const vortexMat = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff2200,
      emissiveIntensity: 0.5 - r * 0.12,
      transparent: true,
      opacity: 0.5 - r * 0.1,
    });
    const vortex = new THREE.Mesh(vortexGeo, vortexMat);
    vortex.rotation.x = -Math.PI / 2;
    vortex.position.y = -0.1;
    scene.add(vortex);
  }

  // === Obstacles with better look ===
  for (const obs of OBSTACLES) {
    // Main pillar
    const obsGeo = new THREE.CylinderGeometry(obs.radius * 0.85, obs.radius, obs.height, 16);
    const obsMat = new THREE.MeshStandardMaterial({
      color: 0x555577,
      roughness: 0.4,
      metalness: 0.6,
    });
    const mesh = new THREE.Mesh(obsGeo, obsMat);
    mesh.position.set(obs.x, obs.height / 2, obs.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Top cap with glow
    const capGeo = new THREE.CylinderGeometry(obs.radius * 0.9, obs.radius * 0.85, 0.1, 16);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x8888bb,
      emissive: 0x4444aa,
      emissiveIntensity: 0.4,
      roughness: 0.2,
      metalness: 0.7,
    });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(obs.x, obs.height + 0.05, obs.z);
    cap.castShadow = true;
    scene.add(cap);

    // Base ring
    const baseRingGeo = new THREE.TorusGeometry(obs.radius + 0.05, 0.05, 8, 24);
    const baseRingMat = new THREE.MeshStandardMaterial({
      color: 0x6666aa,
      emissive: 0x4444aa,
      emissiveIntensity: 0.3,
    });
    const baseRing = new THREE.Mesh(baseRingGeo, baseRingMat);
    baseRing.rotation.x = -Math.PI / 2;
    baseRing.position.set(obs.x, 0.02, obs.z);
    scene.add(baseRing);
  }

  // === Ambient particles (floating dust in the void below) ===
  const particleCount = 80;
  const particleGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = DANGER_ZONE_RADIUS * 0.5 + Math.random() * DANGER_ZONE_RADIUS * 0.6;
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = -1 - Math.random() * 3;
    positions[i * 3 + 2] = Math.sin(angle) * r;
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particleMat = new THREE.PointsMaterial({
    color: 0x6666ff,
    size: 0.15,
    transparent: true,
    opacity: 0.4,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);
}

function _addRing(radius, color, intensity, tubeRadius = 0.1) {
  const geo = new THREE.TorusGeometry(radius, tubeRadius, 8, 64);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  scene.add(ring);
}

export function getZone(position) {
  const dist = Math.sqrt(position.x * position.x + position.z * position.z);
  if (dist < DEATH_ZONE_INNER_RADIUS) return 'death';
  if (dist < PLAY_ZONE_RADIUS) return 'play';
  if (dist < DANGER_ZONE_RADIUS) return 'danger';
  return 'death';
}

export function isOutOfBounds(position) {
  const dx = position.x;
  const dz = position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  return dist > DANGER_ZONE_RADIUS || dist < DEATH_ZONE_INNER_RADIUS;
}

export function resolveObstacleCollision(pos, vel, entityRadius) {
  let hit = false;
  for (const obs of OBSTACLES) {
    const dx = pos.x - obs.x;
    const dz = pos.z - obs.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const minDist = obs.radius + entityRadius;

    if (dist < minDist && dist > 0.001) {
      const nx = dx / dist;
      const nz = dz / dist;
      pos.x = obs.x + nx * minDist;
      pos.z = obs.z + nz * minDist;

      const dotVel = vel.x * nx + vel.z * nz;
      if (dotVel < 0) {
        vel.x -= 2 * dotVel * nx;
        vel.z -= 2 * dotVel * nz;
        vel.x *= 0.7;
        vel.z *= 0.7;
      }
      hit = true;
    }
  }
  return hit;
}
