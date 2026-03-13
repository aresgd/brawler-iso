import * as THREE from 'three';
import { MAX_HP, PLAYER_SPEED, PLAYER_RADIUS, PLAYER_HEIGHT, SPELLS, KNOCKBACK_CAP } from './config.js';
import { scene } from './scene.js';
import { getMovementVector, isKeyJustPressed, isMouseJustPressed, mouseWorld } from './input.js';

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
      shockwave: 0,
      fireball: 0,
      hook: 0,
      dash: 0,
      shield: 0,
    };

    this.activeHook = null;

    // Shield state
    this.shieldActive = false;
    this.shieldTimer = 0;
    this.shieldMesh = null;

    // Build mesh
    this.group = new THREE.Group();

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

    // Shield timer
    if (this.shieldActive) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this._removeShield();
      }
    }

    // Pulse ground ring
    if (this.groundRing) {
      const pulse = 0.5 + Math.sin(performance.now() * 0.003) * 0.15;
      this.groundRing.material.opacity = pulse;
    }
  }

  getSpellIntent() {
    if (!this.alive) return null;

    // LMB: shockwave
    if (isMouseJustPressed('left') && this.cooldowns.shockwave <= 0) {
      this.cooldowns.shockwave = SPELLS.shockwave.cooldown;
      return { spell: 'shockwave', caster: this };
    }

    // RMB: fireball
    if (isMouseJustPressed('right') && this.cooldowns.fireball <= 0) {
      this.cooldowns.fireball = SPELLS.fireball.cooldown;
      return { spell: 'fireball', caster: this };
    }

    // Q: hook (reactivate if latched)
    if (isKeyJustPressed(this.bindings.hook)) {
      if (this.activeHook && this.activeHook.latched) {
        return { spell: 'hook_reactivate', caster: this };
      } else if (this.cooldowns.hook <= 0 && !this.activeHook) {
        this.cooldowns.hook = SPELLS.hook.cooldown;
        return { spell: 'hook', caster: this };
      }
    }

    // Space: dash
    if (isKeyJustPressed(this.bindings.dash) && this.cooldowns.dash <= 0) {
      this.cooldowns.dash = SPELLS.dash.cooldown;
      return { spell: 'dash', caster: this };
    }

    // E: shield
    if (isKeyJustPressed(this.bindings.shield) && this.cooldowns.shield <= 0 && !this.shieldActive) {
      this.cooldowns.shield = SPELLS.shield.cooldown;
      this._activateShield();
      return null; // shield is self-buff, no spell entity
    }

    return null;
  }

  _activateShield() {
    this.shieldActive = true;
    this.shieldTimer = SPELLS.shield.duration;

    // Visual: translucent sphere around player
    const geo = new THREE.SphereGeometry(PLAYER_RADIUS + 0.4, 16, 12);
    const mat = new THREE.MeshStandardMaterial({
      color: SPELLS.shield.color,
      emissive: SPELLS.shield.color,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    this.shieldMesh = new THREE.Mesh(geo, mat);
    this.shieldMesh.position.y = PLAYER_HEIGHT * 0.5;
    this.group.add(this.shieldMesh);
  }

  _removeShield() {
    this.shieldActive = false;
    this.shieldTimer = 0;
    if (this.shieldMesh) {
      this.group.remove(this.shieldMesh);
      this.shieldMesh.geometry.dispose();
      this.shieldMesh.material.dispose();
      this.shieldMesh = null;
    }
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

    // Shield reduces damage and knockback
    let dmg = amount;
    let kb = basePower;
    if (this.shieldActive) {
      dmg *= SPELLS.shield.damageReduction;
      kb *= SPELLS.shield.knockbackReduction;
    }

    this.hp = Math.max(0, this.hp - dmg);

    const hpRatio = this.maxHp / Math.max(this.hp, 1);
    const effectivePower = kb * Math.min(hpRatio, KNOCKBACK_CAP);

    this.velocity.x += knockbackDir.x * effectivePower;
    this.velocity.z += knockbackDir.z * effectivePower;

    this._flashHit();
  }

  _flashHit() {
    this.group.traverse((child) => {
      if (child.isMesh && child.material.emissive) {
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
    this._removeShield();
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
    this.cooldowns = { shockwave: 0, fireball: 0, hook: 0, dash: 0, shield: 0 };
    this.activeHook = null;
    this._removeShield();
    this.group.traverse((child) => {
      if (child.isMesh) {
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
