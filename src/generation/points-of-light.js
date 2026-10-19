import { distance, neighbours } from './hex.js';
import { randomFor, weightedChoice } from './seed.js';
import { clamp, distanceField } from './spatial.js';

export const chooseCitySize = (random) => weightedChoice(random, [1, 2, 3], [50, 40, 10]);

export function generatePointsOfLight(world) {
  const random = randomFor(world.seed, 'points-of-light');
  const byKey = new Map(world.cells.map((cell) => [cell.key, cell]));
  const water = distanceField(world.cells, byKey, (cell) => !!cell.water);
  const settlements = [];
  const occupied = [];
  const eligible = (cell) =>
    !cell.water &&
    cell.elevation <= 2 &&
    ['meadow', 'light forest'].includes(cell.terrain) &&
    neighbours(cell, byKey).every((next) => Math.abs(next.elevation - cell.elevation) <= 1) &&
    occupied.every((other) => distance(cell, other) > 2);
  // Global size order: cities first across all regions, then towns, then villages.
  for (const [type, cap, chance] of [
    ['city', 1, 0.42],
    ['town', 2, 0.34],
    ['village', 5, 0.32],
  ]) {
    for (const region of world.regions) {
      for (let attempt = 0; attempt < cap; attempt++) {
        if (random() >= clamp(chance * world.naming.weights.PL, 0.05, 0.95)) continue;
        const size = type === 'city' ? chooseCitySize(random) : 1;
        const candidates = world.cells.filter(
          (cell) =>
            cell.regionId === region.id && eligible(cell) && (type !== 'city' || !cell.islandId),
        );
        while (candidates.length) {
          const score = (cell) =>
            (1 + 4 / (1 + water(cell))) *
            (cell.terrain === 'meadow' ? 1.5 : 1) *
            (cell.elevation === 1 ? 1.35 : 1);
          const anchor = weightedChoice(random, candidates, candidates.map(score));
          candidates.splice(candidates.indexOf(anchor), 1);
          const group = [anchor];
          while (group.length < size) {
            const frontier = [...new Set(group.flatMap((cell) => neighbours(cell, byKey)))].filter(
              (cell) =>
                !group.includes(cell) &&
                cell.regionId === region.id &&
                cell.elevation === anchor.elevation &&
                eligible(cell),
            );
            if (!frontier.length) break;
            group.push(weightedChoice(random, frontier, frontier.map(score)));
          }
          if (group.length < size) continue;
          const id = `settlement-${settlements.length + 1}`;
          for (const cell of group) cell.pointOfLight = { id, type, size, centre: cell === anchor };
          settlements.push({
            id,
            type,
            regionId: region.id,
            anchorKey: anchor.key,
            hexKeys: group.map((cell) => cell.key),
          });
          occupied.push(...group);
          break;
        }
      }
    }
  }
  world.settlements = settlements;
  return world;
}
