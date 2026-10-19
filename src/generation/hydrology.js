import { distance, neighbours } from './hex.js';
import { randomFor, smoothNoise, weightedChoice } from './seed.js';
import { bendLongRiverRuns } from './river-routing.js';

function makeLakes(world, byKey, random) {
  const lakes = [];
  for (const region of world.regions) {
    const count = weightedChoice(random, [0, 1, 2], [55, 35, 10]);
    for (let index = 0; index < count; index++) place(region.id);
  }
  // An inland world still needs a drainage outlet. This is one of its regional lakes.
  if (!world.geography.coastEdges.length && !lakes.length) place(1);
  return lakes;

  function place(regionId) {
    const valid = (cell) =>
      cell.regionId === regionId &&
      !cell.water &&
      !cell.islandId &&
      distance(cell) >= world.radius * 0.62 &&
      !cell.edgeSides.length &&
      neighbours(cell, byKey).every((next) => !next.water && !next.islandId);
    const candidates = world.cells.filter(valid);
    if (!candidates.length) return;
    const group = [candidates[Math.floor(random() * candidates.length)]];
    const size = weightedChoice(random, [1, 2, 3, 4, 5], [50, 25, 13, 8, 4]);
    const shape = random() < 0.5 ? 'round' : 'long';
    const axis = random() * Math.PI;
    while (group.length < size) {
      const choices = [...new Set(group.flatMap((cell) => neighbours(cell, byKey)))].filter(
        (cell) => !group.includes(cell) && valid(cell),
      );
      if (!choices.length) break;
      const weight = choices.map((cell) =>
        shape === 'round'
          ? 1 + 4 * neighbours(cell, byKey).filter((next) => group.includes(next)).length
          : 1 +
            4 *
              Math.abs(
                (cell.wx - group[0].wx) * Math.cos(axis) + (cell.wz - group[0].wz) * Math.sin(axis),
              ),
      );
      group.push(weightedChoice(random, choices, weight));
    }
    const id = `lake-${lakes.length + 1}`;
    group.forEach((cell) => {
      cell.water = 'lake';
      cell.lakeId = id;
    });
    lakes.push({ id, regionId, shape, hexKeys: group.map((cell) => cell.key) });
  }
}

export function generateHydrology(world) {
  const { cells, seed } = world;
  const random = randomFor(seed, 'hydrology');
  const noise = smoothNoise(`${seed}:drainage`, 2.4);
  const byKey = new Map(cells.map((cell) => [cell.key, cell]));
  const lakes = makeLakes(world, byKey, random);
  const costs = new Map(cells.map((cell) => [cell.key, cell.water ? 0 : Infinity]));
  const parents = new Map();
  const remaining = new Set(cells.filter((cell) => !cell.islandId));
  // A world-scale least-cost drainage field. Every parent has strictly lower cost,
  // so paths terminate in water and tributaries can merge but never split or cycle.
  while (remaining.size) {
    const current = [...remaining].sort(
      (a, b) => costs.get(a.key) - costs.get(b.key) || (a.key < b.key ? -1 : 1),
    )[0];
    remaining.delete(current);
    if (!Number.isFinite(costs.get(current.key))) break;
    for (const next of neighbours(current, byKey)) {
      if (!remaining.has(next) || next.water) continue;
      // Broad, low-cost drainage corridors bend routes around coherent obstacles.
      const valley = noise((next.q + current.q) / 2, (next.r + current.r) / 2);
      const step = 0.2 + valley ** 3 * 6;
      const cost = costs.get(current.key) + step;
      if (cost < costs.get(next.key)) {
        costs.set(next.key, cost);
        parents.set(next.key, current.key);
      }
    }
  }
  const sources = [];
  const attempted = new Set();
  const riverKeys = new Set();
  let meanderBends = 0;
  const bendRandom = randomFor(seed, 'river-bends');
  const desired = 2 + Math.floor(random() * 3);
  const routeLength = (cell) => {
    let length = 0;
    while (cell && !cell.water) {
      length++;
      cell = byKey.get(parents.get(cell.key));
    }
    return length;
  };
  const lengths = new Map(cells.map((cell) => [cell.key, routeLength(cell)]));
  for (let attempt = 0; attempt < desired * 8 && sources.length < desired; attempt++) {
    let candidates = cells.filter(
      (cell) =>
        !cell.water &&
        !cell.islandId &&
        !riverKeys.has(cell.key) &&
        !attempted.has(cell.key) &&
        lengths.get(cell.key) >= 5 &&
        Number.isFinite(costs.get(cell.key)) &&
        sources.every((source) => distance(cell, byKey.get(source)) >= 3) &&
        neighbours(cell, byKey).every((next) => !riverKeys.has(next.key)),
    );
    const central = candidates.filter((cell) => distance(cell) <= world.radius * 0.45);
    if (central.length) candidates = central;
    if (!candidates.length) break;
    const source = weightedChoice(
      random,
      candidates,
      candidates.map((cell) => lengths.get(cell.key) ** 3 / (1 + distance(cell) * 0.15)),
    );
    attempted.add(source.key);
    const route = [source];
    let current = source;
    while (!current.water && !riverKeys.has(current.key)) {
      // Join a neighbouring downstream river immediately rather than run parallel.
      const joining = neighbours(current, byKey)
        .filter((cell) => riverKeys.has(cell.key))
        .sort((a, b) => costs.get(a.key) - costs.get(b.key))[0];
      const next = joining ?? byKey.get(parents.get(current.key));
      if (!next) break;
      route.push(next);
      current = next;
    }
    if (!current.water && !riverKeys.has(current.key)) continue;
    // Remove tight triangular detours: a river occupies a single chain of hexes.
    let path = [];
    for (let cursor = 0; cursor < route.length;) {
      path.push(route[cursor]);
      let next = cursor + 1;
      for (let later = cursor + 2; later < route.length; later++) {
        if (distance(route[cursor], route[later]) === 1) next = later;
      }
      cursor = next;
    }
    if (path.length < 3) continue;
    const originalLength = path.length;
    path = bendLongRiverRuns(path, byKey, riverKeys, bendRandom);
    if (
      path
        .slice(0, -1)
        .some(
          (cell) => neighbours(cell, byKey).filter((next) => riverKeys.has(next.key)).length > 1,
        )
    )
      continue;
    sources.push(source.key);
    meanderBends += path.length - originalLength;
    for (let step = 0; step < path.length - 1; step++) {
      const cell = path[step];
      if (riverKeys.has(cell.key)) break;
      cell.water = 'river';
      cell.downstream = path[step + 1].key;
      riverKeys.add(cell.key);
    }
  }
  const rivers = cells.filter((cell) => cell.water === 'river');
  for (const cell of rivers) {
    const outlet = byKey.get(cell.downstream);
    if (outlet.water === 'river') outlet.upstream.push(cell.key);
    cell.flow = 1;
  }
  // Rank the final drainage graph after tributary joins. This is the constraint
  // that future elevation must respect, independent of the routing search cost.
  const rank = (cell) =>
    cell.water !== 'river' ? 0 : (cell.drainageRank ??= 1 + rank(byKey.get(cell.downstream)));
  rivers.forEach(rank);
  rivers.sort((a, b) => b.drainageRank - a.drainageRank);
  for (const cell of rivers) {
    const outlet = byKey.get(cell.downstream);
    if (outlet.water === 'river') outlet.flow += cell.flow;
  }
  const maxRank = Math.max(1, ...rivers.map((cell) => cell.drainageRank));
  for (const cell of rivers) {
    cell.riverWidth = Math.min(
      0.255,
      0.15 + 0.07 * (1 - cell.drainageRank / maxRank) + Math.sqrt(cell.flow) * 0.0045,
    );
  }
  world.hydrology = { lakes, sources, riverKeys: rivers.map((cell) => cell.key), meanderBends };
}
