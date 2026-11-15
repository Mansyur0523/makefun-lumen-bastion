// Lumen Bastion — every tuning number, colour and level definition in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the window,
// so no rule below depends on the screen size. Top bar 0..52, play area 52..608,
// build bar 608..720. The path is a serpentine road across a floating island;
// three shadow pools on it shroud enemies from damage unless a tower's light reaches them.

export const FIELD = { width: 1280, height: 720 };
export const TOP_BAR = 52;
export const BUILD_BAR = 608;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const START_GOLD = 200;
export const START_LIVES = 20;
export const MAX_WAVE = 20;
export const SELL_RATE = 0.7;
export const INTEREST_RATE = 0.08;
export const INTEREST_CAP = 25;

/** The road the enemies walk, in order, from off-screen left to the Heartstone. */
export const PATH = [
  { x: -40, y: 150 },
  { x: 420, y: 150 },
  { x: 420, y: 300 },
  { x: 880, y: 300 },
  { x: 880, y: 460 },
  { x: 1240, y: 460 },
];
export const PATH_WIDTH = 52;
/** Where the Heartstone (the base) stands: the path's end. */
export const HEART = { x: 1205, y: 460 };

/** Shadow pools: enemies inside one take no damage unless a tower's light overlaps them. */
export const SHADOWS = [
  { x: 420, y: 300, r: 92 },
  { x: 880, y: 300, r: 82 },
  { x: 1060, y: 460, r: 88 },
];

/** Stone pads a tower can be built on. Every pad sits within a tower's reach of the road. */
export const PADS = [
  { x: 150, y: 240 }, { x: 300, y: 230 }, { x: 520, y: 210 }, { x: 520, y: 380 },
  { x: 700, y: 210 }, { x: 700, y: 380 }, { x: 960, y: 210 }, { x: 980, y: 380 },
  { x: 1120, y: 380 }, { x: 1120, y: 545 }, { x: 1000, y: 545 }, { x: 90, y: 240 },
  { x: 180, y: 92 }, { x: 300, y: 90 },
];
export const PAD_RADIUS = 30;

/** Tower kinds. levels[] holds level 1..3 stats; cost is the build price. */
export const TOWERS = {
  ember: {
    name: 'Ember Spire',
    short: 'Ember',
    key: '1',
    cost: 60,
    color: '#ff9a3c',
    glow: '#ffb35c',
    desc: 'Fast bolts of fire. Cheap and reliable.',
    levels: [
      { damage: 8, rate: 2.2, range: 132, light: 170, upgrade: 50 },
      { damage: 14, rate: 2.6, range: 146, light: 185, upgrade: 95 },
      { damage: 24, rate: 3.1, range: 162, light: 205, upgrade: 0 },
    ],
  },
  frost: {
    name: 'Frost Lantern',
    short: 'Frost',
    key: '2',
    cost: 80,
    color: '#7fd4ff',
    glow: '#bfe9ff',
    desc: 'Chills every foe in its glow, slowing them.',
    levels: [
      { damage: 3, rate: 1.0, range: 122, light: 190, slow: 0.45, slowTime: 1.2, upgrade: 65 },
      { damage: 6, rate: 1.0, range: 134, light: 205, slow: 0.55, slowTime: 1.4, upgrade: 115 },
      { damage: 13, rate: 1.0, range: 148, light: 225, slow: 0.65, slowTime: 1.6, upgrade: 0 },
    ],
  },
  prism: {
    name: 'Prism Obelisk',
    short: 'Prism',
    key: '3',
    cost: 140,
    color: '#c98cff',
    glow: '#e3b8ff',
    desc: 'Heavy light orbs that burst and splash.',
    levels: [
      { damage: 20, rate: 0.7, range: 152, light: 210, splash: 58, upgrade: 115 },
      { damage: 34, rate: 0.75, range: 166, light: 225, splash: 72, upgrade: 175 },
      { damage: 58, rate: 0.9, range: 182, light: 245, splash: 88, upgrade: 0 },
    ],
  },
};
export const TOWER_ORDER = ['ember', 'frost', 'prism'];
export const MAX_TOWER_LEVEL = 3;

/** Enemy kinds. hp scales with the wave; speed is px per second. */
export const ENEMIES = {
  wisp: {
    name: 'Wisp', hp: 26, speed: 78, gold: 6, score: 10, radius: 11,
    color: '#ffd94d', desc: 'Quick and frail.',
  },
  husk: {
    name: 'Husk', hp: 85, speed: 42, gold: 10, score: 15, radius: 16,
    color: '#9db3c8', desc: 'Slow, armoured shell.',
  },
  shade: {
    name: 'Shade', hp: 44, speed: 56, gold: 12, score: 20, radius: 13,
    color: '#b678f0', desc: 'Hides in shadow; only light hurts it.',
  },
  splitter: {
    name: 'Splitter', hp: 74, speed: 54, gold: 14, score: 20, radius: 15,
    color: '#7fe08a', desc: 'Bursts into two wisps when slain.',
  },
  dart: {
    name: 'Dart', hp: 18, speed: 128, gold: 8, score: 15, radius: 9,
    color: '#ff8ad0', desc: 'Very fast. Frost is the answer.',
  },
  herald: {
    name: 'Gloom Herald', hp: 2400, speed: 27, gold: 150, score: 500, radius: 26,
    color: '#e05a7a', boss: true, leak: 5, desc: 'Wave 10 boss.',
  },
  sovereign: {
    name: 'Night Sovereign', hp: 8200, speed: 25, gold: 400, score: 1500, radius: 32,
    color: '#ff4d6d', boss: true, leak: 10, desc: 'Wave 20 boss. Slay it to win.',
  },
};

/** Enemy hp multiplier per wave: 1.22^(wave-1). */
export const HP_GROWTH = 1.22;
/** Enemy speed grows a little with the wave, capped. */
export const SPEED_GROWTH = 0.02;
export const SPEED_GROWTH_CAP = 1.45;

/**
 * What a wave is made of. Returns a list of { kind, delay } spawn entries plus the
 * boss for waves 10 and 20. Composition is deterministic for a given wave.
 */
export function waveComposition(wave) {
  const list = [];
  // The horde grows gently at first, then steeply: 7, 10, 13, ... up to 40.
  const count = Math.min(40, 5 + wave * 2 + Math.max(0, wave - 8) * 2);
  const interval = Math.max(0.3, 0.9 - wave * 0.03);
  for (let i = 0; i < count; i += 1) {
    let kind = 'wisp';
    const roll = ((i * 37 + wave * 17) % 100) / 100;
    if (wave >= 7 && roll < 0.16) kind = 'splitter';
    else if (wave >= 6 && roll < 0.30) kind = 'dart';
    else if (wave >= 5 && roll < 0.56) kind = 'shade';
    else if (wave >= 3 && roll < 0.72) kind = 'husk';
    list.push({ kind, delay: i === 0 ? 0.6 : interval });
  }
  if (wave === 10) list.push({ kind: 'herald', delay: 2.5 });
  if (wave === 20) list.push({ kind: 'sovereign', delay: 2.5 });
  return list;
}

/** Gold for clearing a wave, before interest. */
export function waveClearBonus(wave) {
  return 20 + wave * 4;
}

export const PALETTE = {
  backdrop: '#0a0e1a',
  skyTop: '#131a33',
  skyBottom: '#1d2b4d',
  island: '#2c4a34',
  islandEdge: '#1d3323',
  islandSand: '#3d6b45',
  path: '#8a7a5c',
  pathEdge: '#6b5d45',
  pathStone: '#a08e6d',
  shadow: 'rgba(24, 8, 44, 0.55)',
  shadowEdge: 'rgba(140, 90, 220, 0.35)',
  heart: '#ffd94d',
  heartCore: '#fff3b0',
  panel: 'rgba(10, 14, 26, 0.82)',
  panelEdge: '#3a4a6b',
  text: '#eef1f5',
  muted: '#9aa7c2',
  gold: '#ffd94d',
  danger: '#ff5a6e',
  good: '#7fe08a',
  pad: '#4a5a6a',
  padEdge: '#7b8ba0',
  button: '#2c3a5e',
  buttonEdge: '#5a6ea0',
  buttonHot: '#c98cff',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score and best wave are kept between visits (this browser only). */
export const BEST_KEY = 'lumen-bastion.best';
export const BEST_WAVE_KEY = 'lumen-bastion.best-wave';
