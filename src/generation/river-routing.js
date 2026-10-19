import { DIRECTIONS, directionTo, neighbours } from './hex.js';

function straightRuns(path) {
  const runs = [];
  let start = 0;
  for (let step = 1; step < path.length; step++) {
    const direction = directionTo(path[step - 1], path[step]);
    if (step > 1 && direction !== directionTo(path[step - 2], path[step - 1])) start = step - 1;
    if (
      step - start >= 4 &&
      (step === path.length - 1 || direction !== directionTo(path[step], path[step + 1]))
    ) {
      runs.push({ start, end: step, direction });
    }
  }
  return runs;
}

function clearRoute(path, byKey, riverKeys) {
  const indices = new Map(path.map((cell, index) => [cell.key, index]));
  if (indices.size !== path.length) return false;
  for (let index = 0; index < path.length - 1; index++) {
    const cell = path[index];
    if (cell.water || cell.islandId) return false;
    for (const next of neighbours(cell, byKey)) {
      const other = indices.get(next.key);
      if (other !== undefined && Math.abs(index - other) > 1) return false;
      if (riverKeys.has(next.key) && next.key !== path[index + 1].key) return false;
    }
  }
  return true;
}

// Replace three steps within a long straight reach with a one-cell lateral bow.
// Endpoints and outlets stay fixed; the bow must fit in free mainland cells and
// cannot touch nonconsecutive cells or create a second contact with a tributary.
export function bendLongRiverRuns(route, byKey, riverKeys, random) {
  let path = route;
  for (let pass = 0; pass < route.length; pass++) {
    let replacement;
    for (const run of straightRuns(path)) {
      const [dq, dr] = DIRECTIONS[run.direction];
      const starts = Array.from(
        { length: run.end - run.start - 2 },
        (_, index) => run.start + index,
      );
      const centre = (run.start + run.end - 3) / 2;
      starts.sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre));
      const sides = random() < 0.5 ? [1, 5] : [5, 1];
      for (const start of starts) {
        const anchor = path[start];
        for (const offset of sides) {
          const [sq, sr] = DIRECTIONS[(run.direction + offset) % 6];
          const bow = [0, 1, 2].map((step) =>
            byKey.get(`${anchor.q + sq + dq * step},${anchor.r + sr + dr * step}`),
          );
          if (bow.some((cell) => !cell)) continue;
          const candidate = [...path.slice(0, start + 1), ...bow, ...path.slice(start + 3)];
          if (clearRoute(candidate, byKey, riverKeys)) {
            replacement = candidate;
            break;
          }
        }
        if (replacement) break;
      }
      if (replacement) break;
    }
    if (!replacement) break;
    path = replacement;
  }
  return path;
}
