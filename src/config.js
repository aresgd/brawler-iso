// Arena zones (concentric circles from center outward)
export const DEATH_ZONE_INNER_RADIUS = 3;   // center death zone
export const PLAY_ZONE_RADIUS = 14;          // safe play area outer edge
export const DANGER_ZONE_RADIUS = 18;        // danger zone outer edge (HP drain)
export const ARENA_RADIUS = 18;              // visual edge = danger zone edge
export const ARENA_THICKNESS = 0.5;
export const DANGER_ZONE_DPS = 15;           // HP per second in danger zone

// Obstacles: { x, z, radius, height } — cylindrical pillars
export const OBSTACLES = [
  { x: -6, z: -6, radius: 1.0, height: 1.5 },      // corners (in play zone)
  { x: 6, z: -6, radius: 1.0, height: 1.5 },
  { x: -6, z: 6, radius: 1.0, height: 1.5 },
  { x: 6, z: 6, radius: 1.0, height: 1.5 },
  { x: 0, z: -10, radius: 0.8, height: 1.0 },      // mid edges
  { x: 0, z: 10, radius: 0.8, height: 1.0 },
  { x: -10, z: 0, radius: 0.8, height: 1.0 },
  { x: 10, z: 0, radius: 0.8, height: 1.0 },
];

// Players
export const MAX_HP = 100;
export const PLAYER_SPEED = 8;
export const PLAYER_RADIUS = 0.5;
export const PLAYER_HEIGHT = 1.2;

// Physics
export const FRICTION = 0.92;
export const GRAVITY = -20;
export const FALL_THRESHOLD = -5; // Y below this = eliminated
export const KNOCKBACK_CAP = 12; // max knockback multiplier

// Body collision
export const BODY_COLLISION_SPEED_THRESHOLD = 3; // min relative speed to trigger damage
export const BODY_COLLISION_DAMAGE_FACTOR = 0.8; // damage per unit of relative speed
export const BODY_COLLISION_KNOCKBACK_FACTOR = 0.3; // knockback per unit of relative speed
export const BODY_COLLISION_COOLDOWN = 0.3; // seconds between body collision hits

// Spells
export const SPELLS = {
  shockwave: {
    name: 'Shockwave',
    key: 'LMB',
    damage: 5,
    knockback: 10,
    cooldown: 1.8,
    radius: 3.0,
    lifetime: 0.3,
    color: 0xffee00,
    type: 'aoe',
  },
  fireball: {
    name: 'Fireball',
    key: 'RMB',
    damage: 20,
    knockback: 2,
    cooldown: 0.6,
    speed: 18,
    radius: 0.4,
    lifetime: 2.0,
    color: 0xff6600,
    type: 'projectile',
  },
  hook: {
    name: 'Hook',
    key: 'Q',
    damage: 8,
    knockback: 6,
    cooldown: 2.5,
    speed: 28,
    radius: 0.3,
    lifetime: 0.5,
    pullSpeed: 40,
    color: 0x88ff88,
    type: 'hook',
  },
  dash: {
    name: 'Dash',
    key: 'Space',
    damage: 8,
    knockback: 4,
    cooldown: 1.5,
    speed: 30,
    radius: 0.6,
    lifetime: 0.2,
    color: 0x00ccff,
    type: 'dash',
  },
  shield: {
    name: 'Shield',
    key: 'E',
    cooldown: 4.0,
    duration: 1.5,
    damageReduction: 0.5,
    knockbackReduction: 0.5,
    color: 0x44aaff,
    type: 'shield',
  },
};

// Round / match
export const WINS_TO_MATCH = 3;
export const ROUND_START_DELAY = 2.0; // seconds of countdown
export const ROUND_END_DELAY = 2.0;
