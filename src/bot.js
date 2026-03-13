import {
  SPELLS, PLAYER_SPEED, OBSTACLES,
  DEATH_ZONE_INNER_RADIUS, PLAY_ZONE_RADIUS,
} from './config.js';

export class Bot {
  constructor(player, target) {
    this.player = player;
    this.target = target;
    this.thinkTimer = 0;
    this.moveDir = { x: 0, z: 0 };
    this.wantSpell = null;
    this.strafeDir = Math.random() > 0.5 ? 1 : -1;
    this.strafeSwitchTimer = 0;
  }

  update(dt) {
    const p = this.player;
    if (!p.alive) return;

    this.thinkTimer -= dt;
    this.strafeSwitchTimer -= dt;

    if (this.strafeSwitchTimer <= 0) {
      this.strafeDir = Math.random() > 0.5 ? 1 : -1;
      this.strafeSwitchTimer = 0.8 + Math.random() * 1.2;
    }

    if (this.thinkTimer <= 0) {
      this.think();
      this.thinkTimer = 0.1 + Math.random() * 0.1;
    }

    // Apply movement (only when grounded — can't steer mid-air)
    if (p.grounded && (this.moveDir.x !== 0 || this.moveDir.z !== 0)) {
      p.velocity.x += this.moveDir.x * PLAYER_SPEED * dt * 5;
      p.velocity.z += this.moveDir.z * PLAYER_SPEED * dt * 5;
    }
    p.group.rotation.y = p.facingAngle;

    // Tick cooldowns
    for (const key of Object.keys(p.cooldowns)) {
      if (p.cooldowns[key] > 0) p.cooldowns[key] -= dt;
    }
  }

  think() {
    const p = this.player;
    const t = this.target;
    if (!t.alive) {
      this.moveDir.x = 0;
      this.moveDir.z = 0;
      return;
    }

    const pPos = p.getPosition();
    const tPos = t.getPosition();

    const dx = tPos.x - pPos.x;
    const dz = tPos.z - pPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const toTarget = { x: dist > 0 ? dx / dist : 0, z: dist > 0 ? dz / dist : 0 };

    // Distance from center and zone awareness
    const distFromCenter = Math.sqrt(pPos.x * pPos.x + pPos.z * pPos.z);
    const inDangerZone = distFromCenter > PLAY_ZONE_RADIUS;
    const nearInnerDeath = distFromCenter < DEATH_ZONE_INNER_RADIUS + 2;
    const nearOuterEdge = distFromCenter > PLAY_ZONE_RADIUS - 2;

    // Movement strategy
    if (inDangerZone || nearOuterEdge) {
      // Move toward center of play ring
      const toCenterLen = distFromCenter;
      if (toCenterLen > 0.1) {
        this.moveDir.x = -pPos.x / toCenterLen;
        this.moveDir.z = -pPos.z / toCenterLen;
      }
    } else if (nearInnerDeath) {
      // Move away from center hole
      if (distFromCenter > 0.1) {
        this.moveDir.x = pPos.x / distFromCenter;
        this.moveDir.z = pPos.z / distFromCenter;
      }
    } else if (dist > 8) {
      // Approach target
      this.moveDir.x = toTarget.x;
      this.moveDir.z = toTarget.z;
    } else if (dist < 2.5) {
      // Too close, back off + strafe
      this.moveDir.x = -toTarget.x + (-toTarget.z) * this.strafeDir * 0.6;
      this.moveDir.z = -toTarget.z + (toTarget.x) * this.strafeDir * 0.6;
    } else {
      // Good range — strafe around target
      const perp = this.strafeDir;
      this.moveDir.x = -toTarget.z * perp + toTarget.x * 0.15;
      this.moveDir.z = toTarget.x * perp + toTarget.z * 0.15;
    }

    // Avoid obstacles
    for (const obs of OBSTACLES) {
      const odx = pPos.x - obs.x;
      const odz = pPos.z - obs.z;
      const oDist = Math.sqrt(odx * odx + odz * odz);
      if (oDist < obs.radius + 1.5) {
        const push = (obs.radius + 1.5 - oDist) / (obs.radius + 1.5);
        this.moveDir.x += (odx / oDist) * push * 2;
        this.moveDir.z += (odz / oDist) * push * 2;
      }
    }

    // Normalize
    const len = Math.sqrt(this.moveDir.x ** 2 + this.moveDir.z ** 2);
    if (len > 0) {
      this.moveDir.x /= len;
      this.moveDir.z /= len;
    }

    // Face target for aiming
    p.facingAngle = Math.atan2(toTarget.x, toTarget.z);
    this.wantSpell = null;

    // Spell decisions
    const targetLowHP = t.hp < t.maxHp * 0.4;

    // Shockwave if very close
    if (dist < SPELLS.shockwave.radius * 0.8 && p.cooldowns.shockwave <= 0) {
      this.wantSpell = 'shockwave';
    }
    // Dash into low HP targets
    else if (dist < 5 && dist > 2 && p.cooldowns.dash <= 0 && targetLowHP && Math.random() > 0.4) {
      this.wantSpell = 'dash';
    }
    // Fireball at mid range
    else if (dist < 12 && dist > 2 && p.cooldowns.fireball <= 0 && Math.random() > 0.25) {
      this.wantSpell = 'fireball';
    }
    // Hook at longer range
    else if (dist < 14 && dist > 4 && p.cooldowns.hook <= 0 && !p.activeHook && Math.random() > 0.5) {
      this.wantSpell = 'hook';
    }
    // Dash to escape danger zone
    else if (inDangerZone && p.cooldowns.dash <= 0) {
      // Face toward center for dash
      if (distFromCenter > 0.1) {
        p.facingAngle = Math.atan2(-pPos.x, -pPos.z);
      }
      this.wantSpell = 'dash';
    }

    // Reactivate hook if latched to obstacle (pull self toward it for mobility)
    if (p.activeHook && p.activeHook.latched) {
      // Reactivate if it latched onto an obstacle and we're in danger, or sometimes for movement
      if (inDangerZone || Math.random() > 0.7) {
        this.wantSpell = 'hook_reactivate';
      }
    }
  }

  getSpellIntent() {
    if (!this.player.alive || !this.wantSpell) return null;
    const spell = this.wantSpell;
    this.wantSpell = null;

    if (spell === 'hook_reactivate') {
      return { spell: 'hook_reactivate', caster: this.player };
    }

    if (this.player.cooldowns[spell] <= 0) {
      this.player.cooldowns[spell] = SPELLS[spell].cooldown;
      return { spell, caster: this.player };
    }
    return null;
  }
}
