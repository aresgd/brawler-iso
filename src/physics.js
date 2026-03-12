import { FRICTION, GRAVITY, FALL_THRESHOLD, PLAYER_RADIUS, DANGER_ZONE_DPS } from './config.js';
import { isOutOfBounds, resolveObstacleCollision, getZone } from './arena.js';

export function applyPhysics(player, dt) {
  if (!player.alive) return;

  const pos = player.getPosition();
  const vel = player.velocity;

  // Apply gravity if airborne
  if (!player.grounded) {
    vel.y += GRAVITY * dt;
  }

  // Integrate position
  pos.x += vel.x * dt;
  pos.y += vel.y * dt;
  pos.z += vel.z * dt;

  // Ground collision
  if (pos.y < 0 && !isOutOfBounds(pos)) {
    pos.y = 0;
    vel.y = 0;
    player.grounded = true;
  } else if (isOutOfBounds(pos)) {
    // Off the edge - start falling
    player.grounded = false;
  }

  // Obstacle collision (bounce off pillars)
  resolveObstacleCollision(pos, vel, PLAYER_RADIUS);

  // Friction (only horizontal, only when grounded)
  if (player.grounded) {
    vel.x *= FRICTION;
    vel.z *= FRICTION;

    // Kill tiny velocities
    if (Math.abs(vel.x) < 0.01) vel.x = 0;
    if (Math.abs(vel.z) < 0.01) vel.z = 0;
  }

  // Zone-based effects (only when on ground level)
  if (player.grounded) {
    const zone = getZone(pos);
    if (zone === 'danger') {
      player.hp = Math.max(0, player.hp - DANGER_ZONE_DPS * dt);
      if (player.hp <= 0) {
        player.eliminate();
        return;
      }
    }
    // 'death' zones (center hole + outer edge) are handled by isOutOfBounds → falling
  }

  // Elimination check (falling off edge)
  if (pos.y < FALL_THRESHOLD) {
    player.eliminate();
  }
}
