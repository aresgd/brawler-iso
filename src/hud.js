import { SPELLS, MAX_HP, WINS_TO_MATCH } from './config.js';

const spellNames = ['shockwave', 'fireball', 'hook', 'dash', 'shield'];

export function initHUD(players) {
  for (const p of players) {
    const prefix = p.index === 0 ? 'p1' : 'p2';
    const container = document.getElementById(`${prefix}-cooldowns`);
    container.innerHTML = '';
    for (const name of spellNames) {
      const pip = document.createElement('div');
      pip.className = 'cooldown-pip ready';
      pip.id = `${prefix}-cd-${name}`;
      pip.textContent = SPELLS[name].key;
      container.appendChild(pip);
    }
  }
}

export function updateHUD(players, scores) {
  for (const p of players) {
    const prefix = p.index === 0 ? 'p1' : 'p2';

    // HP bar
    const hpPct = Math.max(0, p.hp / p.maxHp * 100);
    document.getElementById(`${prefix}-hp`).style.width = `${hpPct}%`;

    // Cooldowns
    for (const name of spellNames) {
      const pip = document.getElementById(`${prefix}-cd-${name}`);
      if (p.cooldowns[name] <= 0) {
        pip.classList.add('ready');
        pip.style.opacity = '1';
      } else {
        pip.classList.remove('ready');
        pip.style.opacity = '0.4';
      }
    }
  }

  // Score
  document.getElementById('score').textContent =
    `Score: ${scores[0]} - ${scores[1]}  (First to ${WINS_TO_MATCH})`;
}

export function showCenterMessage(text, duration = 1.5) {
  const el = document.getElementById('center-msg');
  el.textContent = text;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), duration * 1000);
}
