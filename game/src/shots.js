// The screenshot scenes behind ?shot=title|play|victory|defeat. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot that builds and upgrades towers from a fixed plan, so the frame is what a
// real game looks like and the same seed always gives the same frame. No wall clock is
// read anywhere here: the scenes are fully deterministic for a given seed.
import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

// The autopilot's build plan, in order: [padIndex, kind] to build, or [padIndex, 'up']
// to upgrade the tower standing there. It favours pads whose light reaches the shadow
// pools, mixes all three tower kinds, and upgrades before it buys its last towers.
const BUILD_PLAN = [
  [13, 'ember'], [2, 'ember'], [0, 'ember'], [3, 'frost'], [1, 'ember'],
  [6, 'prism'], [4, 'ember'], [5, 'frost'], [13, 'up'], [2, 'up'],
  [7, 'prism'], [8, 'prism'], [6, 'up'], [3, 'up'], [12, 'ember'],
  [9, 'prism'], [10, 'frost'], [7, 'up'], [8, 'up'], [4, 'up'],
  [1, 'up'], [0, 'up'], [5, 'up'], [13, 'up'], [2, 'up'],
  [11, 'ember'], [11, 'up'], [6, 'up'], [9, 'up'], [10, 'up'],
  [3, 'up'], [12, 'up'], [4, 'up'], [7, 'up'], [8, 'up'],
  [1, 'up'], [0, 'up'], [5, 'up'], [9, 'up'], [10, 'up'],
];

const MAX_STEPS = 60 * 60 * 25; // 25 minutes of simulated play, at most.

/**
 * Spend gold on the next affordable plan step, then upgrade whatever is cheapest,
 * until nothing affordable is left. Returns true when it spent anything.
 */
export function autopilotAct(world) {
  const { state } = world;
  let spent = false;
  let planIndex = state.planIndex || 0;
  while (planIndex < BUILD_PLAN.length) {
    const [pad, action] = BUILD_PLAN[planIndex];
    let done = false;
    if (action === 'up') {
      const tower = world.towerAtPad(pad);
      // Nothing there, or already at max level: the step is done, move on.
      done = !tower || tower.level >= 3 ? true : world.upgradeTower(tower);
    } else {
      done = world.buildTower(pad, action);
      if (!done && world.towerAtPad(pad)) done = true; // already built: skip the step
    }
    if (!done) break; // cannot afford it yet: save gold for it
    spent = true;
    planIndex += 1;
  }
  state.planIndex = planIndex;
  // No plan step affordable: upgrade the cheapest tower that can still grow.
  if (!spent || planIndex >= BUILD_PLAN.length) {
    let cheapest = null;
    let cheapestCost = Infinity;
    for (const tower of state.towers) {
      if (tower.level >= 3) continue;
      const cost = world.towerStats(tower.kind, tower.level).upgrade;
      if (cost < cheapestCost) {
        cheapestCost = cost;
        cheapest = tower;
      }
    }
    if (cheapest && world.upgradeTower(cheapest)) spent = true;
  }
  return spent;
}

/**
 * Run the world forward with the autopilot until `until(state)` is true or the step
 * budget runs out. Returns true when the condition was met.
 */
export function simulate(world, until) {
  const { state } = world;
  state.planIndex = 0;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (until(state)) return true;
    if (state.phase === 'build') {
      autopilotAct(world);
      if (!world.startWave()) return false;
    } else if (state.phase === 'won' || state.phase === 'lost') {
      return until(state);
    }
    world.step(STEP);
  }
  return until(state);
}

/** A short idle demo for the title screen: a few towers, wave 1 walking in. */
function stageTitle(world) {
  world.reset();
  world.state.gold = 9999;
  world.buildTower(2, 'ember');
  world.buildTower(6, 'ember');
  world.buildTower(3, 'frost');
  world.buildTower(7, 'prism');
  world.state.gold = 180;
  world.startWave();
  for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP);
  return { screen: SCREEN_TITLE, best: 0, bestWave: 0 };
}

/** Mid-combat on wave 8: towers built, a crowd of foes on the road, HUD full. */
function stagePlay(world) {
  world.reset();
  const crowded = (state) => {
    if (state.phase !== 'wave' || state.wave !== 8) return false;
    let alive = 0;
    for (const e of state.enemies) if (e.active) alive += 1;
    return alive >= 9;
  };
  const ok = simulate(world, crowded);
  if (!ok) {
    // Fall back to whatever wave the autopilot reached, still mid-combat.
    simulate(world, (state) => state.phase === 'wave' && state.wave >= 5);
  }
  return { screen: SCREEN_PLAY, best: 0, bestWave: 0 };
}

/** A real win: the autopilot holds the Heartstone through all 20 waves. */
function stageVictory(world) {
  world.reset();
  simulate(world, (state) => state.phase === 'won');
  return { screen: SCREEN_WIN, best: world.state.score, bestWave: 20 };
}

/** A real loss: no towers at all, the horde walks straight through. */
function stageDefeat(world) {
  world.reset();
  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (world.state.phase === 'lost') break;
    if (world.state.phase === 'build') {
      if (!world.startWave()) break;
    }
    world.step(STEP);
  }
  return { screen: SCREEN_OVER, best: world.state.score, bestWave: world.state.wave };
}

/**
 * Set `world` to the named scene (title, play, victory or defeat; any other name is
 * title) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  const scene = name === 'play' ? stagePlay(world)
    : name === 'victory' ? stageVictory(world)
    : name === 'defeat' ? stageDefeat(world)
    : stageTitle(world);
  // A staged frame must be reproducible: clear the random screen shake and the
  // Heartstone flash so the same seed always paints the same pixels.
  world.state.shake = 0;
  world.state.heartFlash = 0;
  return scene;
}
