import { neighbours } from './hex.js';

export function distanceField(cells, byKey, predicate) {
  const queue = cells.filter(predicate);
  const result = new Map(queue.map((cell) => [cell.key, 0]));
  for (let i = 0; i < queue.length; i++) {
    for (const next of neighbours(queue[i], byKey)) {
      if (result.has(next.key)) continue;
      result.set(next.key, result.get(queue[i].key) + 1);
      queue.push(next);
    }
  }
  return (cell) => result.get(cell.key) ?? 99;
}

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
