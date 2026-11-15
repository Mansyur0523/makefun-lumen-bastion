// A small seeded random generator (mulberry32): the same seed always deals the same
// waves, so a screenshot scene can be replayed exactly. Not for anything secret.

export function createRandom(seed) {
  let state = seed >>> 0;
  if (state === 0) state = 0x9e3779b9;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random integer in [min, max] from a generator. */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** Pick one entry of a weighted list [{ weight, value }] from a generator. */
export function randomWeighted(random, entries) {
  let total = 0;
  for (const entry of entries) total += entry.weight;
  let roll = random() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry.value;
  }
  return entries[entries.length - 1].value;
}
