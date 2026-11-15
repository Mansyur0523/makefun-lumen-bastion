// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, victory and defeat.
//
// ?seed=N fixes the wave patterns. ?shot=title|play|victory|defeat (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.
import { BEST_KEY, BEST_WAVE_KEY, FIELD, PAD_RADIUS, PADS, START_LIVES, STEP, TOWERS, TOWER_ORDER } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BOSS, EVENT_KILL, EVENT_LEAK, EVENT_LOSE, EVENT_WAVE_CLEAR, EVENT_WIN } from './world.js';
import {
  ACTION_BUILD_1, ACTION_BUILD_2, ACTION_BUILD_3, ACTION_CONFIRM, ACTION_MUTE,
  ACTION_PAUSE, ACTION_RESTART, ACTION_SELL, ACTION_SPEED, ACTION_UPGRADE, ACTION_WAVE,
  createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** Shoot sounds are throttled so a volley stays one soft tick, not a buzz. */
const SHOT_SOUND_MS = 90;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return {
      score: Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0,
      wave: Number.parseInt(window.localStorage.getItem(BEST_WAVE_KEY) ?? '0', 10) || 0,
    };
  } catch {
    return { score: 0, wave: 0 };
  }
}

function saveBest(score, wave) {
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
    window.localStorage.setItem(BEST_WAVE_KEY, String(wave));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit only.
  }
}

function inside(rect, x, y) {
  return !!rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, scene.bestWave, { speed: 1, muted: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (x, y) => renderer.toLogical(x, y));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let speed = 1;
  let pendingKind = null;
  let accumulator = 0;
  let last = performance.now();
  let lastShotSound = 0;

  function announce(message) {
    status.textContent = message;
  }

  /** The title screen's live backdrop: a few towers hold wave 1 on a loop. */
  function setupTitleDemo() {
    world.reset();
    world.state.gold = 9999;
    world.buildTower(2, 'ember');
    world.buildTower(6, 'ember');
    world.buildTower(3, 'frost');
    world.buildTower(7, 'prism');
    world.state.gold = 180;
    world.startWave();
  }

  function startGame() {
    world.reset();
    pendingKind = null;
    speed = 1;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startMusic();
    announce('Playing. Hold the Heartstone through 20 waves.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best.score) {
      best = { score: world.state.score, wave: world.state.wave };
      saveBest(best.score, best.wave);
    } else if (world.state.wave > best.wave) {
      best = { score: best.score, wave: world.state.wave };
      saveBest(best.score, best.wave);
    }
    announce(won
      ? `Victory. Score ${world.state.score}. Best ${best.score}.`
      : `The Heartstone falls on wave ${world.state.wave}. Score ${world.state.score}. Best ${best.score}.`);
  }

  /** Play every sound the world queued this step, throttling the rapid fire ticks. */
  function drainSounds() {
    const now = performance.now();
    for (const name of world.state.sounds) {
      if (name === 'shoot') {
        if (now - lastShotSound < SHOT_SOUND_MS) continue;
        lastShotSound = now;
        audio.shoot();
      } else if (name === 'frost') audio.frost();
      else if (name === 'burst') audio.burst();
      else if (name === 'kill') audio.kill();
      else if (name === 'coin') audio.coin();
      else if (name === 'leak') audio.leak();
      else if (name === 'build') audio.build();
      else if (name === 'upgrade') audio.upgrade();
      else if (name === 'horn') audio.horn();
      else if (name === 'boss') audio.boss();
      else if (name === 'victory') audio.victory();
      else if (name === 'defeat') audio.defeat();
    }
    world.state.sounds.length = 0;
  }

  function tryBuildOnPad(padIndex) {
    if (pendingKind) {
      if (world.buildTower(padIndex, pendingKind)) {
        pendingKind = null;
        return true;
      }
      audio.denied();
      return false;
    }
    world.state.selectedPad = padIndex;
    world.state.selectedTower = null;
    audio.click();
    return true;
  }

  function handleClick(click) {
    const { x, y } = click;
    const ui = renderer.ui;
    const state = world.state;
    audio.unlock();

    if (screen === SCREEN_TITLE) {
      startGame();
      return;
    }
    if (screen === SCREEN_WIN || screen === SCREEN_OVER) {
      startGame();
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (inside(ui.pause, x, y)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }

    // Playing: top-bar buttons first.
    if (inside(ui.speed, x, y)) {
      speed = speed === 1 ? 2 : 1;
      audio.click();
      return;
    }
    if (inside(ui.pause, x, y)) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return;
    }
    if (inside(ui.mute, x, y)) {
      audio.setMuted(!audio.muted);
      audio.click();
      return;
    }
    // Selected tower panel.
    if (state.selectedTower) {
      if (inside(ui.upgrade, x, y)) {
        if (world.upgradeTower(state.selectedTower)) announce('Tower upgraded.');
        else audio.denied();
        return;
      }
      if (inside(ui.sell, x, y)) {
        world.sellTower(state.selectedTower);
        announce('Tower sold.');
        return;
      }
    }
    // Wave button.
    if (inside(ui.wave, x, y)) {
      if (state.phase === 'build' && world.startWave()) announce(`Wave ${state.wave} begins.`);
      return;
    }
    // Tower cards: pick a kind, or build at once on the selected pad.
    for (const card of ui.cards) {
      if (inside(card, x, y)) {
        if (state.selectedPad >= 0) {
          if (world.buildTower(state.selectedPad, card.kind)) {
            state.selectedPad = -1;
            announce(`${TOWERS[card.kind].name} built.`);
          } else {
            audio.denied();
          }
        } else {
          pendingKind = pendingKind === card.kind ? null : card.kind;
          audio.click();
          announce(pendingKind ? `${TOWERS[card.kind].name} chosen. Click a stone pad.` : 'Tower choice cleared.');
        }
        return;
      }
    }
    // A stone pad.
    for (let i = 0; i < PADS.length; i += 1) {
      const pad = PADS[i];
      if (Math.hypot(x - pad.x, y - pad.y) <= PAD_RADIUS + 6) {
        const tower = world.towerAtPad(i);
        if (tower) {
          state.selectedTower = tower;
          state.selectedPad = -1;
          pendingKind = null;
          audio.click();
          announce(`${TOWERS[tower.kind].name}, level ${tower.level}. U upgrades, X sells.`);
        } else {
          tryBuildOnPad(i);
        }
        return;
      }
    }
    // A tower body (towers sit on pads, but a fat finger may miss the pad ring).
    for (const tower of state.towers) {
      if (Math.hypot(x - tower.x, y - tower.y) <= 30) {
        state.selectedTower = tower;
        state.selectedPad = -1;
        pendingKind = null;
        audio.click();
        return;
      }
    }
    // Empty ground: clear the selection.
    state.selectedPad = -1;
    state.selectedTower = null;
    pendingKind = null;
  }

  function handleActions() {
    const actions = input.takeActions();
    const state = world.state;
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.muted);
      return;
    }
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) {
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE || screen === SCREEN_WIN || screen === SCREEN_OVER) startGame();
      else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
      else if (state.phase === 'build') world.startWave();
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACTION_WAVE && state.phase === 'build') world.startWave();
    if (actions & ACTION_SPEED) speed = speed === 1 ? 2 : 1;
    if (actions & ACTION_BUILD_1) pendingKind = 'ember';
    if (actions & ACTION_BUILD_2) pendingKind = 'frost';
    if (actions & ACTION_BUILD_3) pendingKind = 'prism';
    if (actions & ACTION_UPGRADE && state.selectedTower) {
      if (!world.upgradeTower(state.selectedTower)) audio.denied();
    }
    if (actions & ACTION_SELL && state.selectedTower) world.sellTower(state.selectedTower);
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The demo loops wave 1 behind the title; rebuild it when it ends.
      if (world.state.phase === 'build' && world.state.wave >= 1) setupTitleDemo();
      if (world.state.lives < START_LIVES - 4) setupTitleDemo();
      world.step(STEP);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const events = world.step(STEP);
    drainSounds();
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_LOSE) endGame(false);
    else if (events & EVENT_BOSS) announce(`A boss walks the road. Wave ${world.state.wave}.`);
    else if (events & EVENT_WAVE_CLEAR) announce(`Wave ${world.state.wave} cleared. Build, then start wave ${world.state.wave + 1}.`);
    else if (events & EVENT_LEAK) announce(`A foe reached the Heartstone. ${world.state.lives} lives left.`);
    else if (events & EVENT_KILL && world.state.kills % 25 === 0) {
      // Quiet milestone, not a chatterbox: the status line only.
      status.textContent = `${world.state.kills} foes slain.`;
    }
  }

  function hoverInfo() {
    const pointer = input.pointer;
    let hoverPad = -1;
    let hoverKind = null;
    if (pointer && screen === SCREEN_PLAY) {
      for (let i = 0; i < PADS.length; i += 1) {
        if (Math.hypot(pointer.x - PADS[i].x, pointer.y - PADS[i].y) <= PAD_RADIUS + 6) {
          hoverPad = i;
          break;
        }
      }
      for (const card of renderer.ui.cards) {
        if (inside(card, pointer.x, pointer.y)) {
          hoverKind = card.kind;
          break;
        }
      }
    }
    return { hoverPad, hoverKind };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME) * speed;
    last = now;
    for (const click of input.takeClicks()) handleClick(click);
    handleActions();
    while (accumulator >= STEP) {
      step();
      accumulator -= STEP;
    }
    const { hoverPad, hoverKind } = hoverInfo();
    renderer.draw(world.state, screen, best.score, best.wave, {
      speed,
      muted: audio.muted,
      hoverPad,
      hoverKind: hoverKind || pendingKind,
    });
  }

  // Leaving the tab pauses a running game rather than letting the horde walk unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('keydown', () => audio.unlock(), { once: true });

  // A small read-only handle for automated playtests (and curious players): it only
  // reports the public state, it cannot change the game.
  window.__lumen = {
    state: () => ({
      screen, phase: world.state.phase, wave: world.state.wave,
      lives: world.state.lives, gold: world.state.gold, score: world.state.score,
      kills: world.state.kills, towers: world.state.towers.length,
      enemies: world.state.enemies.filter((e) => e.active).length,
    }),
  };

  setupTitleDemo();
  announce('Lumen Bastion. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
