import * as THREE from 'three';
import { SPELLS, PLAYER_RADIUS, OBSTACLES } from './config.js';
import { scene } from './scene.js';

const _chainMat = new THREE.LineBasicMaterial({ color: 0x88ff88, linewidth: 2 });

const activeSpells = [];

export function getActiveSpells() {
  return activeSpells;
}

export function createSpell(spellName, caster) {
  const def = SPELLS[spellName];
  const pos = caster.getPosition().clone();
  const dir = caster.getFacingDirection();

  if (def.type === 'projectile') {
    // Fireball with glow layers
    const group = new THREE.Group();

    const coreGeo = new THREE.SphereGeometry(def.radius * 0.6, 10, 8);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      emissive: 0xffaa00,
      emissiveIntensity: 2.0,
    });
    group.add(new THREE.Mesh(coreGeo, coreMat));

    const outerGeo = new THREE.SphereGeometry(def.radius, 10, 8);
    const outerMat = new THREE.MeshStandardMaterial({
      color: def.color,
      emissive: def.color,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.5,
    });
    group.add(new THREE.Mesh(outerGeo, outerMat));

    // Point light on the fireball
    const light = new THREE.PointLight(def.color, 1.5, 6, 2);
    group.add(light);

    group.position.set(
      pos.x + dir.x * (PLAYER_RADIUS + def.radius + 0.2),
      0.6,
      pos.z + dir.z * (PLAYER_RADIUS + def.radius + 0.2)
    );
    scene.add(group);

    activeSpells.push({
      mesh: group,
      velocity: new THREE.Vector3(dir.x * def.speed, 0, dir.z * def.speed),
      def,
      owner: caster,
      lifetime: def.lifetime,
      type: def.type,
    });
  } else if (def.type === 'aoe') {
    // Cone shockwave with better visuals
    const coneAngle = Math.PI / 4;
    const segments = 16;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    for (let i = 0; i <= segments; i++) {
      const a = -coneAngle / 2 + (coneAngle / segments) * i;
      shape.lineTo(Math.sin(a) * def.radius, Math.cos(a) * def.radius);
    }
    shape.lineTo(0, 0);
    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshStandardMaterial({
      color: def.color,
      emissive: def.color,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const inner = new THREE.Mesh(geo, mat);
    inner.rotation.x = -Math.PI / 2;
    const mesh = new THREE.Group();
    mesh.add(inner);

    // Add a flash light
    const flash = new THREE.PointLight(def.color, 3, 8, 2);
    flash.position.y = 0.5;
    mesh.add(flash);

    mesh.position.set(pos.x, 0.05, pos.z);
    mesh.rotation.y = caster.facingAngle + Math.PI;
    scene.add(mesh);

    activeSpells.push({
      mesh,
      innerMat: mat,
      flashLight: flash,
      velocity: new THREE.Vector3(),
      def,
      owner: caster,
      lifetime: def.lifetime,
      type: def.type,
      origin: pos.clone(),
      facingDir: dir.clone(),
      coneAngle,
      hasHit: false,
    });
  } else if (def.type === 'hook') {
    // Hook head
    const geo = new THREE.SphereGeometry(def.radius, 8, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: def.color,
      emissive: def.color,
      emissiveIntensity: 1.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      pos.x + dir.x * (PLAYER_RADIUS + def.radius + 0.2),
      0.6,
      pos.z + dir.z * (PLAYER_RADIUS + def.radius + 0.2)
    );
    scene.add(mesh);

    // Chain line
    const chainGeo = new THREE.BufferGeometry().setFromPoints([pos.clone(), mesh.position.clone()]);
    const chainLine = new THREE.Line(chainGeo, _chainMat);
    scene.add(chainLine);

    const hookSpell = {
      mesh,
      chainLine,
      chainGeo,
      velocity: new THREE.Vector3(dir.x * def.speed, 0, dir.z * def.speed),
      def,
      owner: caster,
      lifetime: def.lifetime,
      type: def.type,
      latched: false,
      latchPos: null,
      latchTarget: null,
    };

    caster.activeHook = hookSpell;
    activeSpells.push(hookSpell);
  } else if (def.type === 'dash') {
    // Dash with trail
    caster.velocity.x += dir.x * def.speed;
    caster.velocity.z += dir.z * def.speed;

    const group = new THREE.Group();

    const coreGeo = new THREE.SphereGeometry(def.radius, 10, 8);
    const coreMat = new THREE.MeshStandardMaterial({
      color: def.color,
      emissive: def.color,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.6,
    });
    group.add(new THREE.Mesh(coreGeo, coreMat));

    const light = new THREE.PointLight(def.color, 2, 5, 2);
    group.add(light);

    group.position.copy(pos);
    group.position.y = 0.6;
    scene.add(group);

    activeSpells.push({
      mesh: group,
      velocity: new THREE.Vector3(),
      def,
      owner: caster,
      lifetime: def.lifetime,
      type: def.type,
      followOwner: true,
    });
  }
}

export function updateSpells(dt) {
  for (let i = activeSpells.length - 1; i >= 0; i--) {
    const spell = activeSpells[i];
    spell.lifetime -= dt;

    if (spell.type === 'projectile') {
      spell.mesh.position.x += spell.velocity.x * dt;
      spell.mesh.position.z += spell.velocity.z * dt;

      // Obstacle collision
      for (const obs of OBSTACLES) {
        const dx = spell.mesh.position.x - obs.x;
        const dz = spell.mesh.position.z - obs.z;
        if (Math.sqrt(dx * dx + dz * dz) < obs.radius + spell.def.radius) {
          spell.lifetime = 0;
          break;
        }
      }
    } else if (spell.type === 'hook') {
      if (!spell.latched) {
        spell.mesh.position.x += spell.velocity.x * dt;
        spell.mesh.position.z += spell.velocity.z * dt;

        // Check obstacle latch
        for (const obs of OBSTACLES) {
          const dx = spell.mesh.position.x - obs.x;
          const dz = spell.mesh.position.z - obs.z;
          if (Math.sqrt(dx * dx + dz * dz) < obs.radius + spell.def.radius) {
            spell.latched = true;
            spell.latchPos = spell.mesh.position.clone();
            spell.velocity.set(0, 0, 0);
            spell.lifetime = 5;
            break;
          }
        }
      }

      // Update chain
      const ownerPos = spell.owner.getPosition();
      const positions = spell.chainGeo.attributes.position.array;
      positions[0] = ownerPos.x;
      positions[1] = 0.6;
      positions[2] = ownerPos.z;
      positions[3] = spell.mesh.position.x;
      positions[4] = spell.mesh.position.y;
      positions[5] = spell.mesh.position.z;
      spell.chainGeo.attributes.position.needsUpdate = true;
    } else if (spell.type === 'aoe') {
      const t = spell.lifetime / spell.def.lifetime;
      spell.innerMat.opacity = Math.max(0, t * 0.8);
      if (spell.flashLight) {
        spell.flashLight.intensity = t * 3;
      }
    } else if (spell.type === 'dash' && spell.followOwner) {
      const ownerPos = spell.owner.getPosition();
      spell.mesh.position.set(ownerPos.x, 0.6, ownerPos.z);
    }

    // Remove expired
    if (spell.lifetime <= 0) {
      _disposeSpell(spell);
      activeSpells.splice(i, 1);
    }
  }
}

function _disposeSpell(spell) {
  scene.remove(spell.mesh);
  spell.mesh.traverse((child) => {
    if (child.isMesh) {
      child.geometry.dispose();
      child.material.dispose();
    }
  });
  if (spell.mesh.isMesh) {
    spell.mesh.geometry.dispose();
    spell.mesh.material.dispose();
  }
  if (spell.type === 'hook') {
    scene.remove(spell.chainLine);
    spell.chainGeo.dispose();
    spell.owner.activeHook = null;
  }
}

export function clearAllSpells() {
  for (const spell of activeSpells) {
    _disposeSpell(spell);
  }
  activeSpells.length = 0;
}
