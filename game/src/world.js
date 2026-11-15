// Lumen Bastion's rules and state, with no drawing and no browser in it: the path,
// the waves, the towers and their light, the shadow pools, the enemies, projectiles,
// particles, gold and lives. step() advances one fixed step and returns what happened
// as bit flags, so the caller can react (sounds, announcements) without the world
// knowing about screens. Nothing here allocates after createWorld returns, except the
// short-lived spawn and sound lists, which are reused.

import {
  BUILD_BAR, ENEMIES, FIELD, HEART, HP_GROWTH, INTEREST_CAP, INTEREST_RATE, MAX_TOWER_LEVEL,
  MAX_WAVE, PADS, PAD_RADIUS, PATH, PATH_WIDTH, SELL_RATE, SHADOWS, SPEED_GROWTH,
  SPEED_GROWTH_CAP, START_GOLD, START_LIVES, TOWERS, TOP_BAR, waveClearBonus, waveComposition,
} from './config.js';

export const EVENT_KILL = 1;
export const EVENT_LEAK = 2;
export const EVENT_WAVE_CLEAR = 4;
export const EVENT_WIN = 8;
export const EVENT_LOSE = 16;
export const EVENT_BOSS = 32;

const PROJECTILE_SPEED = 520;
const MAX_ENEMIES = 90;
const MAX_PROJECTILES = 120;
const MAX_PARTICLES = 400;
const MAX_FLOATS = 40;

/** Path segment lengths and cumulative distances, computed once from PATH. */
const SEGMENTS = [];
let PATH_LENGTH = 0;
for (let i = 0; i < PATH.length - 1; i += 1) {
  const a = PATH[i];
  const b = PATH[i + 1];
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  SEGMENTS.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, length, start: PATH_LENGTH });
  PATH_LENGTH += length;
}

/** Position (and segment index) at `dist` px along the path. */
function positionAt(dist) {
  let seg = SEGMENTS[SEGMENTS.length - 1];
  for (let i = 0; i < SEGMENTS.length; i += 1) {
    if (dist <= SEGMENTS[i].start + SEGMENTS[i].length) { seg = SEGMENTS[i]; break; }
  }
  const t = Math.min(1, Math.max(0, (dist - seg.start) / seg.length));
  return {
    x: seg.ax + (seg.bx - seg.ax) * t,
    y: seg.ay + (seg.by - seg.ay) * t,
    seg: SEGMENTS.indexOf(seg),
  };
}

/** Distance from a point to the path's centre line, for pad placement checks. */
export function distanceToPath(x, y) {
  let best = Infinity;
  for (const seg of SEGMENTS) {
    const dx = seg.bx - seg.ax;
    const dy = seg.by - seg.ay;
    const t = Math.min(1, Math.max(0, ((x - seg.ax) * dx + (y - seg.ay) * dy) / (seg.length * seg.length)));
    const px = seg.ax + dx * t;
    const py = seg.ay + dy * t;
    best = Math.min(best, Math.hypot(x - px, y - py));
  }
  return best;
}

function inShadow(x, y) {
  for (const s of SHADOWS) {
    const dx = x - s.x;
    const dy = y - s.y;
    if (dx * dx + dy * dy < s.r * s.r) return true;
  }
  return false;
}

export function createWorld(random) {
  const enemies = [];
  const towers = [];
  const projectiles = [];
  const particles = [];
  const floats = [];
  for (let i = 0; i < MAX_ENEMIES; i += 1) {
    enemies.push({ active: false, kind: 'wisp', x: 0, y: 0, hp: 1, maxHp: 1, dist: 0, speed: 0, slowUntil: 0, slowFactor: 0, radius: 10, gold: 0, score: 0, boss: false, leak: 1, shrouded: false, flash: 0, split: false });
  }
  for (let i = 0; i < MAX_PROJECTILES; i += 1) {
    projectiles.push({ active: false, x: 0, y: 0, target: null, tx: 0, ty: 0, damage: 0, splash: 0, color: '#fff', kind: 'ember' });
  }
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', gravity: 0 });
  }
  for (let i = 0; i < MAX_FLOATS; i += 1) {
    floats.push({ active: false, x: 0, y: 0, text: '', life: 0, color: '#fff' });
  }

  const state = {
    gold: START_GOLD,
    lives: START_LIVES,
    wave: 0,
    score: 0,
    kills: 0,
    phase: 'build', // build | wave | won | lost
    time: 0,
    spawnQueue: [],
    spawnIndex: 0,
    spawnTimer: 0,
    waveTotal: 0,
    waveLeft: 0,
    selectedPad: -1,
    selectedTower: null,
    shake: 0,
    heartFlash: 0,
    enemies,
    towers,
    projectiles,
    particles,
    floats,
    /** Sound names queued this step; the caller drains and plays them. */
    sounds: [],
    /** How many towers of each kind stand, for the HUD's build hints. */
    built: { ember: 0, frost: 0, prism: 0 },
  };

  function freeEnemy() {
    for (const e of enemies) if (!e.active) return e;
    return null;
  }
  function freeProjectile() {
    for (const p of projectiles) if (!p.active) return p;
    return null;
  }
  function freeParticle() {
    for (const p of particles) if (!p.active) return p;
    return null;
  }
  function freeFloat() {
    for (const f of floats) if (!f.active) return f;
    return null;
  }

  function burst(x, y, color, count, speed, size, life) {
    for (let i = 0; i < count; i += 1) {
      const p = freeParticle();
      if (!p) return;
      const angle = random() * Math.PI * 2;
      const v = speed * (0.4 + random() * 0.8);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      p.life = life * (0.6 + random() * 0.6);
      p.maxLife = p.life;
      p.size = size * (0.6 + random() * 0.8);
      p.color = color;
      p.gravity = 60;
    }
  }

  function floatText(x, y, text, color) {
    const f = freeFloat();
    if (!f) return;
    f.active = true;
    f.x = x;
    f.y = y;
    f.text = text;
    f.life = 1.1;
    f.color = color;
  }

  function towerAtPad(padIndex) {
    for (const t of towers) if (t.padIndex === padIndex) return t;
    return null;
  }

  function towerStats(kind, level) {
    return TOWERS[kind].levels[level - 1];
  }

  /** Is this enemy lit by any tower's light right now? */
  function isLit(enemy) {
    for (const t of towers) {
      const stats = towerStats(t.kind, t.level);
      const dx = enemy.x - t.x;
      const dy = enemy.y - t.y;
      if (dx * dx + dy * dy < stats.light * stats.light) return true;
    }
    return false;
  }

  function refreshShroud() {
    for (const e of enemies) {
      if (!e.active) continue;
      e.shrouded = inShadow(e.x, e.y) && !isLit(e);
    }
  }

  function killEnemy(enemy, awardGold) {
    enemy.active = false;
    state.kills += 1;
    state.score += enemy.score;
    if (awardGold) {
      state.gold += enemy.gold;
      floatText(enemy.x, enemy.y - 14, `+${enemy.gold}`, '#ffd94d');
    }
    const def = ENEMIES[enemy.kind];
    burst(enemy.x, enemy.y, def.color, enemy.boss ? 42 : 14, enemy.boss ? 260 : 170, enemy.boss ? 5 : 3, 0.7);
    state.sounds.push('kill');
    if (enemy.boss) {
      state.shake = Math.max(state.shake, 0.55);
      state.sounds.push('burst');
      floatText(enemy.x, enemy.y - 30, 'BOSS DOWN!', '#ff5a6e');
    }
    if (enemy.split) {
      for (let i = 0; i < 2; i += 1) {
        const child = freeEnemy();
        if (!child) break;
        const wisp = ENEMIES.wisp;
        child.active = true;
        child.kind = 'wisp';
        child.dist = Math.max(0, enemy.dist - 14 - i * 10);
        const pos = positionAt(child.dist);
        child.x = pos.x + (random() - 0.5) * 20;
        child.y = pos.y + (random() - 0.5) * 20;
        child.maxHp = wisp.hp * Math.pow(HP_GROWTH, state.wave - 1) * 0.8;
        child.hp = child.maxHp;
        child.speed = wisp.speed;
        child.radius = wisp.radius;
        child.gold = 3;
        child.score = 5;
        child.boss = false;
        child.leak = 1;
        child.split = false;
        child.slowUntil = 0;
        child.slowFactor = 0;
        child.flash = 0;
        child.shrouded = false;
      }
    }
  }

  /** Damage one enemy; returns true when it died. Shrouded enemies take nothing. */
  function damageEnemy(enemy, damage) {
    if (!enemy.active) return false;
    if (enemy.shrouded) {
      if (random() < 0.25) burst(enemy.x, enemy.y, '#8a5ad0', 3, 60, 2, 0.4);
      return false;
    }
    enemy.hp -= damage;
    enemy.flash = 0.12;
    if (enemy.hp <= 0) {
      killEnemy(enemy, true);
      return true;
    }
    return false;
  }

  function spawnEnemy(kind) {
    const def = ENEMIES[kind];
    const e = freeEnemy();
    if (!e) return;
    // Bosses keep their listed hp: they are tuned to late-game damage, not scaled.
    const hpScale = def.boss ? 1 : Math.pow(HP_GROWTH, state.wave - 1);
    const speedScale = Math.min(SPEED_GROWTH_CAP, 1 + (state.wave - 1) * SPEED_GROWTH);
    e.active = true;
    e.kind = kind;
    e.dist = 0;
    e.x = PATH[0].x;
    e.y = PATH[0].y;
    e.maxHp = def.hp * hpScale;
    e.hp = e.maxHp;
    e.speed = def.speed * speedScale;
    e.radius = def.radius;
    e.gold = def.gold;
    e.score = def.score;
    e.boss = !!def.boss;
    e.leak = def.leak || 1;
    e.split = kind === 'splitter';
    e.slowUntil = 0;
    e.slowFactor = 0;
    e.flash = 0;
    e.shrouded = false;
    if (e.boss) {
      state.sounds.push('boss');
      state.shake = Math.max(state.shake, 0.3);
    }
  }

  function startWave() {
    if (state.phase !== 'build' || state.wave >= MAX_WAVE) return false;
    state.wave += 1;
    state.phase = 'wave';
    state.spawnQueue = waveComposition(state.wave);
    state.spawnIndex = 0;
    state.spawnTimer = 0.5;
    state.waveTotal = state.spawnQueue.length;
    state.waveLeft = state.spawnQueue.length;
    state.selectedPad = -1;
    state.selectedTower = null;
    state.sounds.push('horn');
    return true;
  }

  function endWaveClear() {
    const bonus = waveClearBonus(state.wave);
    const interest = Math.min(INTEREST_CAP, Math.floor(state.gold * INTEREST_RATE));
    state.gold += bonus + interest;
    state.score += 100 * state.wave;
    state.sounds.push('coin');
    if (state.wave >= MAX_WAVE) {
      state.phase = 'won';
      state.score += state.lives * 50 + state.gold;
      state.sounds.push('victory');
      return EVENT_WAVE_CLEAR | EVENT_WIN;
    }
    state.phase = 'build';
    return EVENT_WAVE_CLEAR;
  }

  function leakEnemy(enemy) {
    enemy.active = false;
    // If the Night Sovereign reaches the Heartstone, the night wins at once.
    if (enemy.kind === 'sovereign') {
      state.lives = 0;
      state.heartFlash = 0.5;
      state.shake = Math.max(state.shake, 0.6);
      state.sounds.push('leak');
      state.sounds.push('defeat');
      burst(HEART.x, HEART.y, '#ff5a6e', 30, 260, 4, 1);
      state.phase = 'lost';
      return EVENT_LEAK | EVENT_LOSE;
    }
    state.lives -= enemy.leak;
    state.heartFlash = 0.5;
    state.shake = Math.max(state.shake, 0.4);
    state.sounds.push('leak');
    burst(HEART.x, HEART.y, '#ff5a6e', 20, 220, 4, 0.8);
    if (state.lives <= 0) {
      state.lives = 0;
      state.phase = 'lost';
      state.sounds.push('defeat');
      return EVENT_LEAK | EVENT_LOSE;
    }
    return EVENT_LEAK;
  }

  function buildTower(padIndex, kind) {
    const def = TOWERS[kind];
    if (!def || state.phase === 'won' || state.phase === 'lost') return false;
    if (padIndex < 0 || padIndex >= PADS.length) return false;
    if (towerAtPad(padIndex)) return false;
    if (state.gold < def.cost) return false;
    state.gold -= def.cost;
    const pad = PADS[padIndex];
    towers.push({
      kind, padIndex, x: pad.x, y: pad.y, level: 1, cooldown: 0,
      angle: -Math.PI / 2, kills: 0, spent: def.cost, flash: 0,
    });
    state.built[kind] += 1;
    state.sounds.push('build');
    burst(pad.x, pad.y, def.color, 16, 140, 3, 0.6);
    return true;
  }

  function upgradeTower(tower) {
    if (!tower || tower.level >= MAX_TOWER_LEVEL) return false;
    const stats = towerStats(tower.kind, tower.level);
    if (state.gold < stats.upgrade) return false;
    state.gold -= stats.upgrade;
    tower.spent += stats.upgrade;
    tower.level += 1;
    tower.flash = 0.4;
    state.sounds.push('upgrade');
    burst(tower.x, tower.y, TOWERS[tower.kind].color, 22, 180, 3, 0.7);
    return true;
  }

  function sellTower(tower) {
    if (!tower) return false;
    const refund = Math.floor(tower.spent * SELL_RATE);
    state.gold += refund;
    state.built[tower.kind] -= 1;
    const index = towers.indexOf(tower);
    if (index !== -1) towers.splice(index, 1);
    if (state.selectedTower === tower) state.selectedTower = null;
    state.sounds.push('coin');
    burst(tower.x, tower.y, '#ffd94d', 12, 120, 3, 0.5);
    return true;
  }

  function reset() {
    for (const e of enemies) e.active = false;
    for (const p of projectiles) p.active = false;
    for (const p of particles) p.active = false;
    for (const f of floats) f.active = false;
    towers.length = 0;
    state.gold = START_GOLD;
    state.lives = START_LIVES;
    state.wave = 0;
    state.score = 0;
    state.kills = 0;
    state.phase = 'build';
    state.time = 0;
    state.spawnQueue = [];
    state.spawnIndex = 0;
    state.spawnTimer = 0;
    state.waveTotal = 0;
    state.waveLeft = 0;
    state.selectedPad = -1;
    state.selectedTower = null;
    state.shake = 0;
    state.heartFlash = 0;
    state.built = { ember: 0, frost: 0, prism: 0 };
    state.sounds.length = 0;
  }

  function nearestTarget(tower, range) {
    let best = null;
    let bestDist = -1;
    for (const e of enemies) {
      if (!e.active) continue;
      const dx = e.x - tower.x;
      const dy = e.y - tower.y;
      if (dx * dx + dy * dy > range * range) continue;
      if (e.dist > bestDist) {
        bestDist = e.dist;
        best = e;
      }
    }
    return best;
  }

  function fireProjectile(tower, target, stats) {
    const p = freeProjectile();
    if (!p) return;
    p.active = true;
    p.x = tower.x;
    p.y = tower.y - 14;
    p.target = target;
    p.tx = target.x;
    p.ty = target.y;
    p.damage = stats.damage;
    p.splash = stats.splash || 0;
    p.color = TOWERS[tower.kind].color;
    p.kind = tower.kind;
    tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
    state.sounds.push(tower.kind === 'prism' ? 'burst' : 'shoot');
  }

  function updateTowers(dt) {
    for (const t of towers) {
      const stats = towerStats(t.kind, t.level);
      t.cooldown -= dt;
      if (t.flash > 0) t.flash -= dt;
      if (t.kind === 'frost') {
        // Frost is an aura: every tick it chills and nicks everything in range.
        if (t.cooldown <= 0) {
          t.cooldown += 1 / stats.rate;
          let hitAny = false;
          for (const e of enemies) {
            if (!e.active) continue;
            const dx = e.x - t.x;
            const dy = e.y - t.y;
            if (dx * dx + dy * dy > stats.range * stats.range) continue;
            e.slowUntil = state.time + stats.slowTime;
            e.slowFactor = stats.slow;
            damageEnemy(e, stats.damage);
            hitAny = true;
          }
          if (hitAny) state.sounds.push('frost');
        }
        continue;
      }
      if (t.cooldown > 0) continue;
      const target = nearestTarget(t, stats.range);
      if (!target) continue;
      t.cooldown += 1 / stats.rate;
      fireProjectile(t, target, stats);
    }
  }

  function updateProjectiles(dt) {
    for (const p of projectiles) {
      if (!p.active) continue;
      if (p.target && p.target.active) {
        p.tx = p.target.x;
        p.ty = p.target.y;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      const stepLen = PROJECTILE_SPEED * dt;
      if (d <= stepLen + 6) {
        p.active = false;
        if (p.splash > 0) {
          burst(p.tx, p.ty, p.color, 12, 180, 3, 0.5);
          for (const e of enemies) {
            if (!e.active) continue;
            const ex = e.x - p.tx;
            const ey = e.y - p.ty;
            if (ex * ex + ey * ey <= p.splash * p.splash) damageEnemy(e, p.damage);
          }
        } else if (p.target && p.target.active) {
          burst(p.tx, p.ty, p.color, 5, 120, 2, 0.35);
          damageEnemy(p.target, p.damage);
        }
      } else {
        p.x += (dx / d) * stepLen;
        p.y += (dy / d) * stepLen;
      }
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
    }
    for (const f of floats) {
      if (!f.active) continue;
      f.life -= dt;
      f.y -= 26 * dt;
      if (f.life <= 0) f.active = false;
    }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.6);
    if (state.heartFlash > 0) state.heartFlash = Math.max(0, state.heartFlash - dt);
  }

  /**
   * One fixed step. During 'build' only particles drift; during 'wave' the whole
   * battle runs. Returns event flags for the caller.
   */
  function step(dt) {
    let events = 0;
    state.time += dt;
    state.sounds.length = 0;
    updateParticles(dt);
    if (state.phase !== 'wave') {
      refreshShroud();
      return events;
    }

    // Spawn the wave's queue.
    if (state.spawnIndex < state.spawnQueue.length) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        const entry = state.spawnQueue[state.spawnIndex];
        state.spawnIndex += 1;
        if (entry.kind === 'herald' || entry.kind === 'sovereign') events |= EVENT_BOSS;
        spawnEnemy(entry.kind);
        const next = state.spawnQueue[state.spawnIndex];
        state.spawnTimer = next ? next.delay : 0;
      }
    }

    refreshShroud();
    updateTowers(dt);
    updateProjectiles(dt);

    // Move enemies; leaks are resolved after movement so a kill on the last tile counts.
    for (const e of enemies) {
      if (!e.active) continue;
      if (e.flash > 0) e.flash -= dt;
      let speed = e.speed;
      if (state.time < e.slowUntil) speed *= (1 - e.slowFactor);
      e.dist += speed * dt;
      const pos = positionAt(e.dist);
      e.x = pos.x;
      e.y = pos.y;
      if (e.dist >= PATH_LENGTH) {
        e.active = false;
        events |= leakEnemy(e);
        if (state.phase === 'lost') break;
      }
    }

    if (state.phase === 'wave') {
      let remaining = 0;
      for (const e of enemies) if (e.active) remaining += 1;
      state.waveLeft = (state.spawnQueue.length - state.spawnIndex) + remaining;
      if (state.spawnIndex >= state.spawnQueue.length && remaining === 0) {
        events |= endWaveClear();
      }
    }
    return events;
  }

  reset();
  return {
    state,
    reset,
    step,
    startWave,
    buildTower,
    upgradeTower,
    sellTower,
    towerAtPad,
    towerStats,
    positionAt,
    damageEnemy,
    burst,
    floatText,
    refreshShroud,
    PATH_LENGTH,
  };
}
