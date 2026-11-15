// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred. Every clickable control the HUD
// draws is recorded in renderer.ui (logical coordinates) so the main loop can hit-test
// clicks against it. Flat shapes, gradients and canvas text; no images, no fonts loaded.
import {
  BUILD_BAR, ENEMIES, FIELD, FONT, HEART, MAX_TOWER_LEVEL, MAX_WAVE, PADS, PAD_RADIUS,
  PALETTE, PATH, PATH_WIDTH, SHADOWS, TOP_BAR, TOWERS, TOWER_ORDER,
} from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const TAU = Math.PI * 2;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, ratio: 1 };
  const fonts = new Map();
  const ui = {
    cards: [], wave: null, speed: null, pause: null, mute: null,
    upgrade: null, sell: null, start: null, restart: null, title: null,
  };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.ratio = ratio;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, weight) {
    const key = `${weight || ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || ''}${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function button(x, y, w, h, label, size, enabled, hot) {
    ctx.fillStyle = hot ? '#4a2a6e' : PALETTE.button;
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = hot ? PALETTE.buttonHot : PALETTE.buttonEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = enabled === false ? 0.45 : 1;
    text(label, x + w / 2, y + h / 2 + (size || 15) * 0.36, size || 15, PALETTE.text, 'center', 'bold ');
    ctx.globalAlpha = 1;
    return { x, y, w, h };
  }

  function heart(x, y, size, filled) {
    ctx.fillStyle = filled ? '#ff5a6e' : 'rgba(255,90,110,0.25)';
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.3);
    ctx.bezierCurveTo(x - size, y - size * 0.6, x - size * 0.4, y - size * 1.2, x, y - size * 0.4);
    ctx.bezierCurveTo(x + size * 0.4, y - size * 1.2, x + size, y - size * 0.6, x, y + size * 0.3);
    ctx.fill();
  }

  function drawIsland(state) {
    // Sky.
    const sky = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(1, PALETTE.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    // Stars.
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 40; i += 1) {
      const sx = (i * 197.3) % FIELD.width;
      const sy = (i * 89.7) % 300;
      ctx.fillRect(sx, sy, 2, 2);
    }

    // The floating island: grass top, rocky underside, soft glow beneath.
    ctx.save();
    ctx.shadowColor = 'rgba(120,180,255,0.35)';
    ctx.shadowBlur = 40;
    ctx.fillStyle = PALETTE.island;
    roundRect(ctx, 8, 58, FIELD.width - 16, 560, 26);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = PALETTE.islandSand;
    roundRect(ctx, 8, 58, FIELD.width - 16, 34, 26);
    ctx.fill();
    ctx.fillStyle = PALETTE.island;
    ctx.fillRect(8, 76, FIELD.width - 16, 16);
    // Rocky underside.
    ctx.fillStyle = PALETTE.islandEdge;
    ctx.beginPath();
    ctx.moveTo(20, 618);
    for (let x = 20; x <= FIELD.width - 20; x += 46) {
      ctx.lineTo(x + 23, 648 + ((x * 7) % 18));
      ctx.lineTo(x + 46, 618);
    }
    ctx.lineTo(FIELD.width - 20, 618);
    ctx.closePath();
    ctx.fill();

    // Grass tufts.
    ctx.strokeStyle = '#4a7a52';
    ctx.lineWidth = 2;
    for (let i = 0; i < 26; i += 1) {
      const gx = (i * 113.7) % (FIELD.width - 40) + 20;
      const gy = 66 + ((i * 31) % 18);
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx - 3, gy - 7);
      ctx.moveTo(gx + 3, gy);
      ctx.lineTo(gx + 6, gy - 6);
      ctx.stroke();
    }

    // The road, drawn as a stone path with a darker edge.
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = PALETTE.pathEdge;
    ctx.lineWidth = PATH_WIDTH + 8;
    ctx.beginPath();
    ctx.moveTo(PATH[0].x, PATH[0].y);
    for (let i = 1; i < PATH.length; i += 1) ctx.lineTo(PATH[i].x, PATH[i].y);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.path;
    ctx.lineWidth = PATH_WIDTH;
    ctx.stroke();
    // Cobbles.
    ctx.fillStyle = PALETTE.pathStone;
    for (let i = 0; i < PATH.length - 1; i += 1) {
      const a = PATH[i];
      const b = PATH[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.floor(len / 34);
      for (let s = 0; s < steps; s += 1) {
        const t = (s + 0.5) / steps;
        const cx = a.x + (b.x - a.x) * t + ((s * 13 + i * 7) % 17) - 8;
        const cy = a.y + (b.y - a.y) * t + ((s * 29 + i * 11) % 15) - 7;
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, TAU);
        ctx.fill();
      }
    }

    // Shadow pools: dark, swirling, with a violet rim.
    for (const s of SHADOWS) {
      const g = ctx.createRadialGradient(s.x, s.y, s.r * 0.2, s.x, s.y, s.r);
      g.addColorStop(0, 'rgba(20,6,40,0.75)');
      g.addColorStop(0.8, 'rgba(30,10,55,0.55)');
      g.addColorStop(1, 'rgba(30,10,55,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = PALETTE.shadowEdge;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 7]);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r - 2, state.time * 0.15, state.time * 0.15 + TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      text('☾ SHADOW', s.x, s.y - s.r - 8, 12, '#b678f0', 'center', 'bold ');
    }

    drawHeartstone(state);
  }

  function drawHeartstone(state) {
    const pulse = 1 + Math.sin(state.time * 2.4) * 0.06;
    const glow = state.heartFlash > 0 ? '#ff5a6e' : PALETTE.heart;
    const g = ctx.createRadialGradient(HEART.x, HEART.y, 4, HEART.x, HEART.y, 64 * pulse);
    g.addColorStop(0, 'rgba(255,243,176,0.85)');
    g.addColorStop(0.4, 'rgba(255,217,77,0.35)');
    g.addColorStop(1, 'rgba(255,217,77,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(HEART.x, HEART.y, 64 * pulse, 0, TAU);
    ctx.fill();
    // Crystal.
    ctx.save();
    ctx.translate(HEART.x, HEART.y);
    ctx.scale(pulse, pulse);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = glow;
    ctx.fillRect(-17, -17, 34, 34);
    ctx.fillStyle = PALETTE.heartCore;
    ctx.fillRect(-9, -9, 18, 18);
    ctx.restore();
    // Pedestal.
    ctx.fillStyle = '#5a4a3a';
    roundRect(ctx, HEART.x - 26, HEART.y + 20, 52, 12, 5);
    ctx.fill();
    text('HEARTSTONE', HEART.x, HEART.y + 52, 12, PALETTE.text, 'center', 'bold ');
  }

  function drawPads(state, hoverPad) {
    for (let i = 0; i < PADS.length; i += 1) {
      const pad = PADS[i];
      const occupied = state.towers.some((t) => t.padIndex === i);
      ctx.fillStyle = PALETTE.pad;
      ctx.beginPath();
      ctx.arc(pad.x, pad.y, PAD_RADIUS, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = state.selectedPad === i ? '#ffd94d' : PALETTE.padEdge;
      ctx.lineWidth = state.selectedPad === i ? 3 : 2;
      ctx.stroke();
      if (!occupied) {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pad.x, pad.y, PAD_RADIUS - 9, 0, TAU);
        ctx.stroke();
        if (hoverPad === i || state.selectedPad === i) {
          text('+ BUILD', pad.x, pad.y + 4, 11, '#eef1f5', 'center', 'bold ');
        }
      }
    }
  }

  function drawTowerLight(tower, stats) {
    const g = ctx.createRadialGradient(tower.x, tower.y, 8, tower.x, tower.y, stats.light);
    g.addColorStop(0, 'rgba(255,220,140,0.20)');
    g.addColorStop(0.7, 'rgba(255,220,140,0.07)');
    g.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, stats.light, 0, TAU);
    ctx.fill();
  }

  function drawTowers(state, selectedTower) {
    for (const tower of state.towers) {
      const def = TOWERS[tower.kind];
      const stats = def.levels[tower.level - 1];
      drawTowerLight(tower, stats);
      // Selected range ring.
      if (selectedTower === tower) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, stats.range, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(255,217,77,0.6)';
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, stats.light, 0, TAU);
        ctx.stroke();
      }
      // Stone base.
      ctx.fillStyle = '#3a3f4d';
      ctx.beginPath();
      ctx.arc(tower.x, tower.y + 8, 20, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#6b7288';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Body by kind.
      if (tower.kind === 'ember') {
        ctx.fillStyle = '#7a4a22';
        ctx.beginPath();
        ctx.moveTo(tower.x - 11, tower.y + 10);
        ctx.lineTo(tower.x, tower.y - 26);
        ctx.lineTo(tower.x + 11, tower.y + 10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(tower.x, tower.y - 28, 7 + Math.sin(state.time * 6 + tower.x) * 1.5, 0, TAU);
        ctx.fill();
      } else if (tower.kind === 'frost') {
        ctx.fillStyle = '#2c4a5e';
        ctx.fillRect(tower.x - 4, tower.y - 22, 8, 32);
        ctx.fillStyle = def.color;
        ctx.save();
        ctx.translate(tower.x, tower.y - 28);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-8, -8, 16, 16);
        ctx.restore();
        ctx.fillStyle = '#eaf7ff';
        ctx.beginPath();
        ctx.arc(tower.x, tower.y - 28, 4, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = '#4a2a6e';
        ctx.beginPath();
        ctx.moveTo(tower.x - 10, tower.y + 10);
        ctx.lineTo(tower.x - 5, tower.y - 26);
        ctx.lineTo(tower.x + 5, tower.y - 26);
        ctx.lineTo(tower.x + 10, tower.y + 10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = def.color;
        ctx.save();
        ctx.translate(tower.x, tower.y - 32);
        ctx.rotate(state.time * 0.8 + tower.x);
        ctx.fillRect(-7, -7, 14, 14);
        ctx.restore();
      }
      if (tower.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.7, tower.flash)})`;
        ctx.beginPath();
        ctx.arc(tower.x, tower.y - 12, 22, 0, TAU);
        ctx.fill();
      }
      // Level pips.
      for (let l = 0; l < MAX_TOWER_LEVEL; l += 1) {
        ctx.fillStyle = l < tower.level ? def.color : 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.arc(tower.x - 12 + l * 12, tower.y + 20, 3.5, 0, TAU);
        ctx.fill();
      }
    }
  }

  function drawEnemies(state) {
    for (const e of state.enemies) {
      if (!e.active) continue;
      const def = ENEMIES[e.kind];
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.shrouded) {
        // A dark veil: the foe cannot be hurt here.
        ctx.fillStyle = 'rgba(20,6,40,0.55)';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius + 7, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(182,120,240,0.8)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      const flash = e.flash > 0;
      if (e.kind === 'wisp') {
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, e.radius + 6);
        g.addColorStop(0, flash ? '#ffffff' : def.color);
        g.addColorStop(1, 'rgba(255,217,77,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius + 6, 0, TAU);
        ctx.fill();
        ctx.fillStyle = flash ? '#ffffff' : '#fff3b0';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius * 0.6, 0, TAU);
        ctx.fill();
      } else if (e.kind === 'husk') {
        ctx.fillStyle = flash ? '#ffffff' : def.color;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#5a6b7d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius - 4, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = '#2c3644';
        ctx.beginPath();
        ctx.arc(-5, -3, 2.5, 0, TAU);
        ctx.arc(5, -3, 2.5, 0, TAU);
        ctx.fill();
      } else if (e.kind === 'shade') {
        ctx.fillStyle = flash ? '#ffffff' : '#2a1245';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#e3b8ff';
        ctx.beginPath();
        ctx.arc(-4.5, -2, 2.2, 0, TAU);
        ctx.arc(4.5, -2, 2.2, 0, TAU);
        ctx.fill();
      } else if (e.kind === 'dart') {
        // A fast pink dart: a small diamond with a motion streak.
        ctx.fillStyle = flash ? '#ffffff' : def.color;
        ctx.save();
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-7, -7, 14, 14);
        ctx.restore();
        ctx.fillStyle = 'rgba(255,138,208,0.4)';
        ctx.beginPath();
        ctx.arc(-10, 6, 5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, TAU);
        ctx.fill();
      } else if (e.kind === 'splitter') {
        ctx.fillStyle = flash ? '#ffffff' : def.color;
        ctx.beginPath();
        ctx.arc(-5, 2, e.radius * 0.62, 0, TAU);
        ctx.arc(5, 2, e.radius * 0.62, 0, TAU);
        ctx.arc(0, -6, e.radius * 0.62, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#1d3323';
        ctx.beginPath();
        ctx.arc(-4, -3, 2, 0, TAU);
        ctx.arc(4, -3, 2, 0, TAU);
        ctx.fill();
      } else {
        // Boss: big crowned orb, pulsing.
        const pulse = 1 + Math.sin(state.time * 3) * 0.05;
        ctx.scale(pulse, pulse);
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, e.radius + 14);
        g.addColorStop(0, flash ? '#ffffff' : def.color);
        g.addColorStop(1, 'rgba(255,77,109,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius + 14, 0, TAU);
        ctx.fill();
        ctx.fillStyle = flash ? '#ffffff' : '#3a0a1e';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 3;
        ctx.stroke();
        // Crown spikes.
        ctx.fillStyle = def.color;
        for (let s = -1; s <= 1; s += 1) {
          ctx.beginPath();
          ctx.moveTo(s * 12 - 6, -e.radius + 4);
          ctx.lineTo(s * 12, -e.radius - 12);
          ctx.lineTo(s * 12 + 6, -e.radius + 4);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = '#ffd94d';
        ctx.beginPath();
        ctx.arc(-9, -4, 3.5, 0, TAU);
        ctx.arc(9, -4, 3.5, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      // Health bar for hurt or boss foes.
      if (e.hp < e.maxHp) {
        const w = e.boss ? 56 : 30;
        const y = e.y - e.radius - 10;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(e.x - w / 2, y, w, 5);
        ctx.fillStyle = e.boss ? '#ff4d6d' : '#7fe08a';
        ctx.fillRect(e.x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 5);
      }
    }
  }

  function drawProjectiles(state) {
    for (const p of state.projectiles) {
      if (!p.active) continue;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.kind === 'prism' ? 7 : 4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.kind === 'prism' ? 3 : 1.8, 0, TAU);
      ctx.fill();
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      if (!p.active) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const f of state.floats) {
      if (!f.active) continue;
      ctx.globalAlpha = Math.min(1, f.life);
      text(f.text, f.x, f.y, 15, f.color, 'center', 'bold ');
    }
    ctx.globalAlpha = 1;
  }

  function drawTopBar(state, best, speed, muted) {
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, 0, FIELD.width, TOP_BAR);
    ctx.fillStyle = PALETTE.panelEdge;
    ctx.fillRect(0, TOP_BAR - 2, FIELD.width, 2);

    text('LUMEN BASTION', 18, 33, 20, '#ffd94d', 'left', 'bold ');
    text(`WAVE ${Math.max(1, state.wave)} / ${MAX_WAVE}`, 250, 33, 18, PALETTE.text, 'left', 'bold ');
    // Lives as hearts + number.
    for (let i = 0; i < 5; i += 1) heart(430 + i * 24, 26, 9, i < Math.ceil(state.lives / 4));
    text(`${state.lives}`, 556, 33, 18, state.lives <= 5 ? PALETTE.danger : PALETTE.text, 'left', 'bold ');
    // Gold.
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(620, 26, 10, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#7a5a00';
    text('G', 620, 30, 13, '#7a5a00', 'center', 'bold ');
    text(`${state.gold}`, 638, 33, 18, PALETTE.gold, 'left', 'bold ');
    text(`SCORE ${state.score}`, 760, 33, 18, PALETTE.text, 'left', 'bold ');
    text(`BEST ${best}`, 920, 33, 15, PALETTE.muted, 'left');

    ui.speed = button(1040, 10, 64, 32, speed === 2 ? '2×' : '1×', 15, true, false);
    ui.pause = button(1112, 10, 64, 32, '❚❚', 14, true, false);
    ui.mute = button(1184, 10, 64, 32, muted ? '♪✕' : '♪', 15, true, false);
  }

  function drawBuildBar(state, hoverKind) {
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, BUILD_BAR, FIELD.width, FIELD.height - BUILD_BAR);
    ctx.fillStyle = PALETTE.panelEdge;
    ctx.fillRect(0, BUILD_BAR, FIELD.width, 2);

    ui.cards = [];
    TOWER_ORDER.forEach((kind, index) => {
      const def = TOWERS[kind];
      const stats = def.levels[0];
      const x = 16 + index * 312;
      const y = BUILD_BAR + 10;
      const w = 300;
      const h = 92;
      const afford = state.gold >= def.cost;
      const selected = hoverKind === kind;
      ctx.fillStyle = selected ? '#3a2a55' : PALETTE.button;
      roundRect(ctx, x, y, w, h, 10);
      ctx.fill();
      ctx.strokeStyle = selected ? def.color : PALETTE.buttonEdge;
      ctx.lineWidth = selected ? 3 : 2;
      ctx.stroke();
      ctx.globalAlpha = afford ? 1 : 0.45;
      // Colour chip.
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(x + 24, y + 24, 11, 0, TAU);
      ctx.fill();
      text(def.name, x + 44, y + 24, 17, PALETTE.text, 'left', 'bold ');
      text(`[${def.key}]`, x + w - 14, y + 24, 14, PALETTE.muted, 'right', 'bold ');
      text(`${def.cost} gold`, x + 44, y + 46, 14, PALETTE.gold, 'left', 'bold ');
      text(`DMG ${stats.damage}  ·  RNG ${stats.range}  ·  LIGHT ${stats.light}`, x + 14, y + 68, 13, PALETTE.muted, 'left');
      text(def.desc, x + 14, y + 88, 12, PALETTE.muted, 'left');
      ctx.globalAlpha = 1;
      ui.cards.push({ kind, x, y, w, h });
    });

    // Wave button / status.
    const wx = 968;
    const wy = BUILD_BAR + 10;
    if (state.phase === 'build') {
      if (state.wave >= MAX_WAVE) {
        ui.wave = button(wx, wy, 296, 44, 'ALL WAVES DONE', 16, false, false);
      } else {
        ui.wave = button(wx, wy, 296, 44, `▶  START WAVE ${state.wave + 1}  [Space]`, 16, true, true);
      }
      text(`Clear bonus ${20 + (state.wave + 1) * 4} gold + 8% interest on gold held`, wx + 148, wy + 66, 12, PALETTE.muted, 'center');
      text('Click a stone pad, then a tower card — or press 1 / 2 / 3.', wx + 148, wy + 86, 12, PALETTE.muted, 'center');
    } else if (state.phase === 'wave') {
      ui.wave = button(wx, wy, 296, 44, `WAVE ${state.wave} — ${state.waveLeft} FOES LEFT`, 16, false, false);
      text('Towers fire on their own. Watch the shadow pools!', wx + 148, wy + 66, 12, PALETTE.muted, 'center');
      text('P pause · F speed · M sound · R restart', wx + 148, wy + 86, 12, PALETTE.muted, 'center');
    } else {
      ui.wave = button(wx, wy, 296, 44, 'GAME OVER', 16, false, false);
    }
  }

  function drawSelectedPanel(state) {
    const tower = state.selectedTower;
    if (!tower) return;
    const def = TOWERS[tower.kind];
    const stats = def.levels[tower.level - 1];
    const x = 980;
    const y = 66;
    const w = 284;
    const h = 196;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    text(def.name, x + 16, y + 30, 18, PALETTE.text, 'left', 'bold ');
    text(`Level ${tower.level} / ${MAX_TOWER_LEVEL}`, x + w - 16, y + 30, 14, def.color, 'right', 'bold ');
    text(`Damage ${stats.damage}   ·   Rate ${stats.rate}/s`, x + 16, y + 58, 14, PALETTE.text, 'left');
    text(`Range ${stats.range}   ·   Light ${stats.light}`, x + 16, y + 80, 14, PALETTE.text, 'left');
    if (def.levels[tower.level - 1].slow) text(`Slow ${Math.round(stats.slow * 100)}% for ${stats.slowTime}s`, x + 16, y + 102, 14, PALETTE.text, 'left');
    if (stats.splash) text(`Splash radius ${stats.splash}`, x + 16, y + 102, 14, PALETTE.text, 'left');
    text(`Foes down: ${tower.kills}`, x + 16, y + 124, 13, PALETTE.muted, 'left');
    if (tower.level < MAX_TOWER_LEVEL) {
      ui.upgrade = button(x + 16, y + 138, 128, 40, `UPGRADE ${stats.upgrade}g [U]`, 13, state.gold >= stats.upgrade, false);
    } else {
      ui.upgrade = button(x + 16, y + 138, 128, 40, 'MAX LEVEL', 13, false, false);
    }
    const refund = Math.floor(tower.spent * 0.7);
    ui.sell = button(x + 156, y + 138, 112, 40, `SELL ${refund}g [X]`, 13, true, false);
  }

  function panel(width, top, title, lines, prompt, accent) {
    const height = 96 + lines.length * 30 + (prompt ? 46 : 0);
    const x = (FIELD.width - width) / 2;
    const y = top;
    ctx.fillStyle = 'rgba(6,9,18,0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, width, height, 14);
    ctx.fill();
    ctx.strokeStyle = accent || PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    text(title, FIELD.width / 2, y + 52, 34, accent || PALETTE.text, 'center', 'bold ');
    lines.forEach((line, i) => {
      text(line.text, FIELD.width / 2, y + 96 + i * 30, line.size || 17, line.color || PALETTE.text, 'center', line.bold ? 'bold ' : '');
    });
    if (prompt) text(prompt, FIELD.width / 2, y + height - 26, 16, PALETTE.muted, 'center');
    return { x, y, w: width, h: height };
  }

  function drawTitle(state, best, bestWave) {
    const lines = [
      { text: 'Night creeps over the floating isle. Its Heartstone is the last light.', size: 17 },
      { text: 'Build towers of living light on the stone pads. Foes in the shadow pools', size: 17 },
      { text: 'cannot be hurt — unless a tower’s light reaches them.', size: 17 },
      { text: 'Hold the Heartstone through 20 waves. Slay the Night Sovereign to win.', size: 17, color: '#ffd94d', bold: true },
      { text: 'Click a pad, then a tower card (or press 1 / 2 / 3).  Space starts a wave.', size: 15, color: PALETTE.muted },
      { text: 'U upgrades a tower, X sells it.  P pauses, F speeds up, M mutes.', size: 15, color: PALETTE.muted },
    ];
    if (best > 0) {
      lines.push({ text: `Best so far: ${best} points — wave ${bestWave}`, size: 15, color: PALETTE.gold, bold: true });
    }
    const rect = panel(860, 120, '✦ LUMEN BASTION ✦', lines, 'Click or press Space to start', '#ffd94d');
    ui.start = rect;
    ui.title = rect;
  }

  function drawPaused() {
    panel(560, 220, '❚❚ PAUSED', [
      { text: 'Take a breath. The night waits.', size: 17 },
    ], 'Press P or click to keep playing', '#7fd4ff');
  }

  function drawWin(state, best) {
    const lines = [
      { text: 'The Night Sovereign falls. Dawn breaks over the isle.', size: 18, color: '#7fe08a', bold: true },
      { text: `All 20 waves cleared with ${state.lives} lives standing.`, size: 17 },
      { text: `Score ${state.score}   ·   Foes slain ${state.kills}   ·   Best ${best}`, size: 17 },
    ];
    const rect = panel(760, 170, '☀ THE NIGHT IS BROKEN', lines, 'Press R or click to play again', '#7fe08a');
    ui.restart = rect;
  }

  function drawOver(state, best) {
    const lines = [
      { text: 'The Heartstone’s light goes out. The isle drifts into the dark.', size: 18, color: '#ff5a6e', bold: true },
      { text: `You fell on wave ${state.wave} of ${MAX_WAVE}.`, size: 17 },
      { text: `Score ${state.score}   ·   Foes slain ${state.kills}   ·   Best ${best}`, size: 17 },
      { text: 'Tip: Frost Lanterns slow the horde, and Prism light reaches the shadow pools.', size: 15, color: PALETTE.muted },
    ];
    const rect = panel(760, 150, 'THE HEARTSTONE FALLS', lines, 'Press R or click to try again', '#ff5a6e');
    ui.restart = rect;
  }

  function draw(state, screen, best, bestWave, options) {
    resize();
    const opts = options || {};
    ctx.setTransform(view.ratio, 0, 0, view.ratio, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.setTransform(view.scale * view.ratio, 0, 0, view.scale * view.ratio, view.x * view.ratio, view.y * view.ratio);
    // Screen shake: a small random offset while the Heartstone is under attack.
    if (state.shake > 0.01) {
      const mag = state.shake * 7;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }
    ui.cards = [];
    ui.upgrade = null;
    ui.sell = null;
    ui.restart = null;
    ui.start = null;

    drawIsland(state);
    drawPads(state, opts.hoverPad ?? -1);
    drawTowers(state, state.selectedTower);
    drawEnemies(state);
    drawProjectiles(state);
    drawParticles(state);
    drawTopBar(state, best, opts.speed || 1, !!opts.muted);
    drawBuildBar(state, opts.hoverKind || null);
    drawSelectedPanel(state);

    if (screen === SCREEN_TITLE) drawTitle(state, best, bestWave);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_WIN) drawWin(state, best);
    else if (screen === SCREEN_OVER) drawOver(state, best);
  }

  return {
    draw,
    ui,
    /** Convert a CSS-pixel point on the canvas to logical field coordinates. */
    toLogical(cssX, cssY) {
      return {
        x: (cssX * view.ratio - view.x * view.ratio) / (view.scale * view.ratio),
        y: (cssY * view.ratio - view.y * view.ratio) / (view.scale * view.ratio),
      };
    },
  };
}
