import * as THREE from 'three';
import { MAX_HP, PLAYER_SPEED, PLAYER_RADIUS, PLAYER_HEIGHT, SPELLS, KNOCKBACK_CAP } from './config.js';
import { scene } from './scene.js';
import { getMovementVector, isKeyJustPressed, mouseWorld } from './input.js';

export class Player {
  constructor(index, color, spawnPos, bindings, { useMouseAim = false } = {}) {
    this.index = index;
    this.color = color;
    this.bindings = bindings;
    this.useMouseAim = useMouseAim;

    this.hp = MAX_HP;
    this.maxHp = MAX_HP;
    this.alive = true;

    this.velocity = new THREE.Vector3();
    this.grounded = true;

    this.cooldowns = {
      hook: 0,
      fireball: 0,
      shockwave: 0,
      dash: 0,
    };

    this.activeHook = null;

    // Build mesh
    this.group = new THREE.Group();

    // Body - rounded cylinder with beveled edges
    const bodyGeo = new THREE.CylinderGeometry(PLAYER_RADIUS * 0.9, PLAYER_RADIUS, PLAYER_HEIGHT, 16, 1);
    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.35,
      metalness: 0.5,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = PLAYER_HEIGHT / 2;
    body.castShadow = true;
    this.group.add(body);

    // Head - sphere with slight emissive glow
    const headGeo = new THREE.SphereGeometry(PLAYER_RADIUS * 0.75, 16, 12);
    const headMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.3,
      metalness: 0.4,
      emissive: color,
      emissiveIntensity: 0.15,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = PLAYER_HEIGHT + PLAYER_RADIUS * 0.35;
    head.castShadow = true;
    this.group.add(head);

    // Eye visor - dark strip across the face
    const visorGeo = new THREE.BoxGeometry(PLAYER_RADIUS * 1.2, PLAYER_RADIUS * 0.2, PLAYER_RADIUS * 0.15);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.1,
      metalness: 0.9,
      emissive: color,
      emissiveIntensity: 0.4,
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, PLAYER_HEIGHT + PLAYER_RADIUS * 0.35, -(PLAYER_RADIUS * 0.65));
    this.group.add(visor);

    // Shoulder pads
    const shoulderGeo = new THREE.SphereGeometry(PLAYER_RADIUS * 0.35, 8, 6);
    const shoulderMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.3,
      metalness: 0.6,
    });
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
      shoulder.position.set(side * (PLAYER_RADIUS + 0.05), PLAYER_HEIGHT * 0.85, 0);
      shoulder.scale.set(1, 0.8, 1.2);
      shoulder.castShadow = true;
      this.group.add(shoulder);
    }

    // Direction indicator - glowing arrow-like cone
    const indicatorGeo = new THREE.ConeGeometry(0.18, 0.5, 6);
    const indicatorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: color,
      emissiveIntensity: 0.8,
    });
    this.indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
    this.indicator.rotation.x = Math.PI / 2;
    this.indicator.position.set(0, PLAYER_HEIGHT * 0.5, -PLAYER_RADIUS - 0.35);
    this.group.add(this.indicator);

    // Ground ring (selection circle feel)
    const ringGeo = new THREE.TorusGeometry(PLAYER_RADIUS + 0.15, 0.04, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.6,
    });
    this.groundRing = new THREE.Mesh(ringGeo, ringMat);
    this.groundRing.rotation.x = -Math.PI / 2;
    this.groundRing.position.y = 0.02;
    this.group.add(this.groundRing);

    this.group.position.copy(spawnPos);
    this.facingAngle = 0;
    scene.add(this.group);
  }

  update(dt) {
    if (!this.alive) return;

    // Movement input (only when grounded)
    const move = getMovementVector(this.bindings);
    if (this.grounded && (move.x !== 0 || move.z !== 0)) {
      this.velocity.x += move.x * PLAYER_SPEED * dt * 5;
      this.velocity.z += move.z * PLAYER_SPEED * dt * 5;
    }

    // Aiming: mouse or movement direction
    if (this.useMouseAim) {
      const pos = this.group.position;
      const dx = mouseWorld.x - pos.x;
      const dz = mouseWorld.z - pos.z;
      if (dx !== 0 || dz !== 0) {
        this.facingAngle = Math.atan2(dx, dz);
      }
    } else if (move.x !== 0 || move.z !== 0) {
      this.facingAngle = Math.atan2(move.x, move.z);
    }
    this.group.rotation.y = this.facingAngle;

    // Tick cooldowns
    for (const key of Object.keys(this.cooldowns)) {
      if (this.cooldowns[key] > 0) this.cooldowns[key] -= dt;
    }

    // Pulse ground ring
    if (this.groundRing) {
      const pulse = 0.5 + Math.sin(performance.now() * 0.003) * 0.15;
      this.groundRing.material.opacity = pulse;
    }
  }

  getSpellIntent() {
    if (!this.alive) return null;

    // Hook: Q to throw, Q again to reactivate (pull to latched target)
    if (isKeyJustPressed(this.bindings.spell1)) {
      if (this.activeHook && this.activeHook.latched) {
        return { spell: 'hook_reactivate', caster: this };
      } else if (this.cooldowns.hook <= 0 && !this.activeHook) {
        this.cooldowns.hook = SPELLS.hook.cooldown;
        return { spell: 'hook', caster: this };
      }
    }

    const spellKeys = [
      { key: this.bindings.spell2, spell: 'fireball' },
      { key: this.bindings.spell3, spell: 'shockwave' },
      { key: this.bindings.spell4, spell: 'dash' },
    ];
    for (const { key, spell } of spellKeys) {
      if (isKeyJustPressed(key) && this.cooldowns[spell] <= 0) {
        this.cooldowns[spell] = SPELLS[spell].cooldown;
        return { spell, caster: this };
      }
    }
    return null;
  }

  getFacingDirection() {
    return new THREE.Vector3(
      Math.sin(this.facingAngle),
      0,
      Math.cos(this.facingAngle)
    );
  }

  getPosition() {
    return this.group.position;
  }

  takeDamage(amount, knockbackDir, basePower) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);

    const hpRatio = this.maxHp / Math.max(this.hp, 1);
    const effectivePower = basePower * Math.min(hpRatio, KNOCKBACK_CAP);

    // Horizontal knockback only
    this.velocity.x += knockbackDir.x * effectivePower;
    this.velocity.z += knockbackDir.z * effectivePower;

    // Flash the body on hit
    this._flashHit();
  }

  _flashHit() {
    this.group.traverse((child) => {
      if (child.isMesh && child.material.emissive) {
        // Store base intensity once to avoid race conditions on rapid hits
        if (child.userData._baseEmissive === undefined) {
          child.userData._baseEmissive = child.material.emissiveIntensity;
        }
        child.material.emissiveIntensity = 2.0;
        clearTimeout(child.userData._flashTimeout);
        child.userData._flashTimeout = setTimeout(() => {
          child.material.emissiveIntensity = child.userData._baseEmissive;
        }, 100);
      }
    });
  }

  eliminate() {
    this.alive = false;
    this.group.traverse((child) => {
      if (child.isMesh) {
        child.material.transparent = true;
        child.material.opacity = 0.3;
      }
    });
  }

  reset(spawnPos) {
    this.hp = this.maxHp;
    this.alive = true;
    this.velocity.set(0, 0, 0);
    this.group.position.copy(spawnPos);
    this.group.position.y = 0;
    this.grounded = true;
    this.cooldowns = { hook: 0, fireball: 0, shockwave: 0, dash: 0 };
    this.activeHook = null;
    this.group.traverse((child) => {
      if (child.isMesh) {
        // Preserve transparent flag for materials that need it (e.g. ground ring)
        if (child === this.groundRing) {
          child.material.opacity = 0.6;
        } else {
          child.material.transparent = false;
          child.material.opacity = 1;
        }
      }
    });
  }
}
