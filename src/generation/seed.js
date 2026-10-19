// Every stage gets its own stream, so adding a later stage cannot change geography.
export function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function randomFor(seed, stage) {
  let state = hashSeed(`${seed}:${stage}`);
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function weightedChoice(random, values, weights) {
  let roll = random() * weights.reduce((sum, value) => sum + value, 0);
  return values.find((_, index) => (roll -= weights[index]) < 0) ?? values.at(-1);
}

export function normalizeSeed(seed) {
  const value = String(seed).trim();
  if (!value || value.length > 128) throw new RangeError('Use a seed of 1–128 characters.');
  return value;
}

export function smoothNoise(seed, scale = 3) {
  const salt = hashSeed(seed);
  const value = (x, y) => hashSeed(`${salt}:${x},${y}`) / 4294967296;
  return (x, y) => {
    x /= scale;
    y /= scale;
    const ix = Math.floor(x),
      iy = Math.floor(y);
    const ease = (t) => t * t * (3 - 2 * t);
    const u = ease(x - ix),
      v = ease(y - iy);
    const a = value(ix, iy) * (1 - u) + value(ix + 1, iy) * u;
    const b = value(ix, iy + 1) * (1 - u) + value(ix + 1, iy + 1) * u;
    return a * (1 - v) + b * v;
  };
}
