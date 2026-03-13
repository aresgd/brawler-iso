import * as THREE from 'three';
import { initScene, scene, camera, renderer } from './scene.js';
import { createArena } from './arena.js';
import { Player } from './player.js';
import { Bot } from './bot.js';
import { applyPhysics } from './physics.js';
import { createSpell, updateSpells, getActiveSpells, clearAllSpells } from './spells.js';
import { checkCollisions, checkPlayerCollisions, resetCollisionCooldowns } from './combat.js';
import { updateInputState, updateMouseWorld } from './input.js';
import { initHUD, updateHUD, showCenterMessage } from './hud.js';
import { ROUND_END_DELAY, WINS_TO_MATCH } from './config.js';

const SPAWN_POSITIONS = [
  new THREE.Vector3(-8, 0, 0),
  new THREE.Vector3(8, 0, 0),
];

// Game state
let players = [];
let bot = null;
let scores = [0, 0];
let phase = 'countdown'; // 'countdown' | 'playing' | 'round_end' | 'match_end'
let phaseTimer = 0;
let countdownNum = 3;

function init() {
  initScene();
  createArena();

  // LMB=shockwave, RMB=fireball, Q=hook, Space=dash, E=shield
  const p1 = new Player(0, 0x4fc3f7, SPAWN_POSITIONS[0].clone(), {
    up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
    hook: 'KeyQ', dash: 'Space', shield: 'KeyE',
  }, { useMouseAim: true });

  const p2 = new Player(1, 0xef5350, SPAWN_POSITIONS[1].clone(), {
    up: '_', down: '_', left: '_', right: '_',
    hook: '_', dash: '_', shield: '_',
  });

  players = [p1, p2];
  bot = new Bot(p2, p1);
  initHUD(players);

  // Start first round countdown
  startCountdown();

  // Game loop
  let lastTime = performance.now();
  const FIXED_DT = 1 / 60;
  let accumulator = 0;

  function loop(now) {
    requestAnimationFrame(loop);
    const frameDt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    accumulator += frameDt;
    while (accumulator >= FIXED_DT) {
      update(FIXED_DT);
      accumulator -= FIXED_DT;
    }
    renderer.render(scene, camera);
  }

  requestAnimationFrame(loop);
}

function startCountdown() {
  phase = 'countdown';
  countdownNum = 3;
  phaseTimer = 1.0; // 1 second per count
  showCenterMessage('3', 0.9);
}

function startRound() {
  phase = 'playing';
  showCenterMessage('FIGHT!', 1.0);
}

function update(dt) {
  updateMouseWorld(camera);

  if (phase === 'countdown') {
    phaseTimer -= dt;
    if (phaseTimer <= 0) {
      countdownNum--;
      if (countdownNum > 0) {
        phaseTimer = 1.0;
        showCenterMessage(String(countdownNum), 0.9);
      } else {
        startRound();
      }
    }
    // During countdown: render but no gameplay
    updateHUD(players, scores);
    updateInputState();
    return;
  }

  if (phase === 'round_end') {
    phaseTimer -= dt;
    // Still apply physics so falling animation plays out
    for (const p of players) applyPhysics(p, dt);
    updateSpells(dt);
    updateHUD(players, scores);
    updateInputState();
    if (phaseTimer <= 0) {
      // Check for match win
      if (scores[0] >= WINS_TO_MATCH) {
        phase = 'match_end';
        showCenterMessage('YOU WIN!', 3.0);
        phaseTimer = 3.0;
      } else if (scores[1] >= WINS_TO_MATCH) {
        phase = 'match_end';
        showCenterMessage('BOT WINS!', 3.0);
        phaseTimer = 3.0;
      } else {
        resetRound();
        startCountdown();
      }
    }
    return;
  }

  if (phase === 'match_end') {
    phaseTimer -= dt;
    updateHUD(players, scores);
    updateInputState();
    if (phaseTimer <= 0) {
      scores = [0, 0];
      resetRound();
      startCountdown();
    }
    return;
  }

  // === phase === 'playing' ===

  // Bot AI
  bot.update(dt);

  // Player 1 movement
  players[0].update(dt);

  // Spell casting
  const p1Intent = players[0].getSpellIntent();
  if (p1Intent) handleSpellIntent(p1Intent);

  const botIntent = bot.getSpellIntent();
  if (botIntent) handleSpellIntent(botIntent);

  updateSpells(dt);
  checkCollisions(players, getActiveSpells());
  checkPlayerCollisions(players, dt);

  for (const p of players) applyPhysics(p, dt);

  // Check for round end (someone eliminated)
  checkRoundEnd();

  updateHUD(players, scores);
  updateInputState();
}

function checkRoundEnd() {
  for (let i = 0; i < players.length; i++) {
    if (!players[i].alive) {
      // The other player wins
      const winner = i === 0 ? 1 : 0;
      scores[winner]++;
      const winnerName = winner === 0 ? 'Player 1' : 'Bot';
      showCenterMessage(`${winnerName} scores!`, ROUND_END_DELAY - 0.2);
      phase = 'round_end';
      phaseTimer = ROUND_END_DELAY;
      return;
    }
  }
}

function resetRound() {
  clearAllSpells();
  resetCollisionCooldowns();
  for (let i = 0; i < players.length; i++) {
    players[i].reset(SPAWN_POSITIONS[i].clone());
  }
}

function handleSpellIntent(intent) {
  if (intent.spell === 'hook_reactivate') {
    const p = intent.caster;
    const hook = p.activeHook;
    if (hook && hook.latched && hook.latchPos) {
      const pos = p.getPosition();
      const dx = hook.latchPos.x - pos.x;
      const dz = hook.latchPos.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 0.1) {
        const pullSpeed = hook.def.pullSpeed;
        p.velocity.x = (dx / dist) * pullSpeed;
        p.velocity.z = (dz / dist) * pullSpeed;
      }
      hook.lifetime = 0;
    }
  } else {
    createSpell(intent.spell, intent.caster);
  }
}

init();
