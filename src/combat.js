import * as THREE from 'three';
import {
  PLAYER_RADIUS,
  BODY_COLLISION_SPEED_THRESHOLD,
  BODY_COLLISION_DAMAGE_FACTOR,
  BODY_COLLISION_KNOCKBACK_FACTOR,
  BODY_COLLISION_COOLDOWN,
} from './config.js';
import { scene } from './scene.js';

const _dir = new THREE.Vector3();

export function checkCollisions(players, spells) {
  const events = [];

  for (let i = spells.length - 1; i >= 0; i--) {
    const spell = spells[i];

    for (const player of players) {
      if (!player.alive) continue;
      if (player === spell.owner && spell.type !== 'aoe') continue; // no self-hit (except aoe skips owner differently)
      if (player === spell.owner) continue; // aoe also shouldn't self-hit

      const spellPos = spell.mesh.position;
      const playerPos = player.getPosition();

      if (spell.type === 'aoe') {
        // Cone AoE: check distance AND angle from caster's facing direction
        if (spell.hasHit) continue;
        const dist = _dist2D(spell.origin, playerPos);
        if (dist < spell.def.radius + PLAYER_RADIUS) {
          // Check if player is within the cone angle
          _dir.set(playerPos.x - spell.origin.x, 0, playerPos.z - spell.origin.z).normalize();
          const dot = _dir.x * spell.facingDir.x + _dir.z * spell.facingDir.z;
          const angleTo = Math.acos(Math.min(1, Math.max(-1, dot)));
          if (angleTo <= spell.coneAngle / 2) {
            player.takeDamage(spell.def.damage, _dir, spell.def.knockback);
            spawnHitFlash(playerPos);
            events.push({ type: 'hit', target: player, spell: spell.def.name });
          }
        }
      } else if (spell.type === 'projectile') {
        // Projectile: sphere-sphere collision
        const dist = _dist2D(spellPos, playerPos);
        if (dist < spell.def.radius + PLAYER_RADIUS) {
          _dir.set(playerPos.x - spellPos.x, 0, playerPos.z - spellPos.z).normalize();
          player.takeDamage(spell.def.damage, _dir, spell.def.knockback);
          spawnHitFlash(playerPos);
          events.push({ type: 'hit', target: player, spell: spell.def.name });

          // Remove spell — handled by _disposeSpell in spells.js via lifetime
          spell.lifetime = 0;
          break;
        }
      } else if (spell.type === 'hook') {
        // Hook latches onto players too (not just obstacles)
        if (!spell.latched) {
          const dist = _dist2D(spellPos, playerPos);
          if (dist < spell.def.radius + PLAYER_RADIUS) {
            // Latch to player
            spell.latched = true;
            spell.latchTarget = player;
            spell.latchPos = playerPos.clone();
            spell.velocity.set(0, 0, 0);
            spell.lifetime = 5;

            // Apply damage + small knockback toward caster
            _dir.set(spell.owner.getPosition().x - playerPos.x, 0, spell.owner.getPosition().z - playerPos.z).normalize();
            player.takeDamage(spell.def.damage, _dir, spell.def.knockback);
            spawnHitFlash(playerPos);
            events.push({ type: 'hit', target: player, spell: spell.def.name });
          }
        } else if (spell.latchTarget) {
          // Keep hook following latched player
          spell.mesh.position.set(spell.latchTarget.getPosition().x, 0.6, spell.latchTarget.getPosition().z);
          spell.latchPos = spell.latchTarget.getPosition().clone();
        }
      } else if (spell.type === 'dash') {
        // Dash: collision-style knockback (HP ratio between players)
        const dist = _dist2D(spellPos, playerPos);
        if (dist < spell.def.radius + PLAYER_RADIUS && !spell.dashHit) {
          _dir.set(playerPos.x - spellPos.x, 0, playerPos.z - spellPos.z).normalize();
          // Target knockback uses attacker/target HP ratio
          player.takeDamage(spell.def.damage, _dir, spell.def.knockback, spell.owner);
          spawnHitFlash(playerPos);
          events.push({ type: 'hit', target: player, spell: spell.def.name });

          // Reverse knockback on dasher uses target/dasher HP ratio
          const reverseDir = { x: -_dir.x, z: -_dir.z };
          spell.owner.takeDamage(spell.def.damage * 0.5, reverseDir, spell.def.knockback, player);
          spawnHitFlash(spell.owner.getPosition());

          spell.dashHit = true;
        }
      }
    }

    // Mark AoE as having hit (one-shot)
    if (spell.type === 'aoe' && !spell.hasHit) {
      spell.hasHit = true;
    }
  }

  return events;
}

const _collisionCooldowns = new Map(); // "i-j" -> timer

export function resetCollisionCooldowns() {
  _collisionCooldowns.clear();
}

export function checkPlayerCollisions(players, dt) {
  // Tick cooldowns
  for (const [key, timer] of _collisionCooldowns) {
    const newTimer = timer - dt;
    if (newTimer <= 0) _collisionCooldowns.delete(key);
    else _collisionCooldowns.set(key, newTimer);
  }

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];
      if (!a.alive || !b.alive) continue;

      const aPos = a.getPosition();
      const bPos = b.getPosition();
      const dist = _dist2D(aPos, bPos);
      const minDist = PLAYER_RADIUS * 2;

      if (dist >= minDist) continue;

      // Check cooldown
      const key = `${i}-${j}`;
      if (_collisionCooldowns.has(key)) continue;

      // Relative velocity between the two players
      const relVx = a.velocity.x - b.velocity.x;
      const relVz = a.velocity.z - b.velocity.z;
      const relSpeed = Math.sqrt(relVx * relVx + relVz * relVz);

      // Separate players so they don't overlap
      if (dist > 0.01) {
        const overlap = (minDist - dist) / 2;
        const nx = (bPos.x - aPos.x) / dist;
        const nz = (bPos.z - aPos.z) / dist;
        aPos.x -= nx * overlap;
        aPos.z -= nz * overlap;
        bPos.x += nx * overlap;
        bPos.z += nz * overlap;
      }

      if (relSpeed < BODY_COLLISION_SPEED_THRESHOLD) continue;

      _collisionCooldowns.set(key, BODY_COLLISION_COOLDOWN);

      // Each player's own speed determines how much they hurt the other
      const aSpeed = Math.sqrt(a.velocity.x ** 2 + a.velocity.z ** 2);
      const bSpeed = Math.sqrt(b.velocity.x ** 2 + b.velocity.z ** 2);

      // Direction from a to b
      const dx = bPos.x - aPos.x;
      const dz = bPos.z - aPos.z;
      const d = Math.sqrt(dx * dx + dz * dz) || 1;
      const dirAtoB = { x: dx / d, z: dz / d };
      const dirBtoA = { x: -dirAtoB.x, z: -dirAtoB.z };

      // Knockback uses HP ratio between attacker and target
      if (aSpeed > BODY_COLLISION_SPEED_THRESHOLD * 0.5) {
        const damage = aSpeed * BODY_COLLISION_DAMAGE_FACTOR;
        const knockback = aSpeed * BODY_COLLISION_KNOCKBACK_FACTOR;

        // A hits B: knockback scales with A's HP / B's HP
        b.takeDamage(damage, dirAtoB, knockback, a);
        // B bounces A back: knockback scales with B's HP / A's HP
        a.takeDamage(damage * 0.5, dirBtoA, knockback, b);
        spawnHitFlash(bPos);
      }

      if (bSpeed > BODY_COLLISION_SPEED_THRESHOLD * 0.5) {
        const damage = bSpeed * BODY_COLLISION_DAMAGE_FACTOR;
        const knockback = bSpeed * BODY_COLLISION_KNOCKBACK_FACTOR;

        // B hits A: knockback scales with B's HP / A's HP
        a.takeDamage(damage, dirBtoA, knockback, b);
        // A bounces B back: knockback scales with A's HP / B's HP
        b.takeDamage(damage * 0.5, dirAtoB, knockback, a);
        spawnHitFlash(aPos);
      }
    }
  }
}

function _dist2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function spawnHitFlash(position) {
  const geo = new THREE.SphereGeometry(0.6, 8, 6);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8,
  });
  const flash = new THREE.Mesh(geo, mat);
  flash.position.set(position.x, 0.8, position.z);
  scene.add(flash);

  // Animate and remove
  let t = 0;
  const animate = () => {
    t += 0.03;
    flash.scale.setScalar(1 + t * 3);
    mat.opacity = Math.max(0, 0.8 - t * 4);
    if (mat.opacity > 0) {
      requestAnimationFrame(animate);
    } else {
      scene.remove(flash);
      geo.dispose();
      mat.dispose();
    }
  };
  requestAnimationFrame(animate);
}
