import test from 'node:test';
import assert from 'node:assert/strict';
import { createTopology } from '../src/map-data.js';
import { generateWorld, generateDressing } from '../src/generation/world.js';
import { generateGeography } from '../src/generation/geography.js';
import { generateHydrology } from '../src/generation/hydrology.js';
import { generateElevation } from '../src/generation/elevation.js';
import { ELEVATION_STEP, prepareMap } from '../src/generation/presentation.js';
import { components, directionTo, distance, neighbours } from '../src/generation/hex.js';

test('elevation is replayable and preserves the earlier geography and drainage stages', () => {
  for (const seed of ['7', 'coastal escarpment']) {
    const base = { seed, ...createTopology() };
    generateGeography(base);
    generateHydrology(base);
    const earlier = JSON.stringify(base);
    generateElevation(base);
    const replay = JSON.stringify(base);
    generateElevation(base);
    assert.equal(JSON.stringify(base), replay);
    const stripElevation = (value) =>
      JSON.stringify({
        ...value,
        elevation: undefined,
        cells: value.cells.map(({ mountainRangeId, elevationFeatureId, ...cell }) => ({
          ...cell,
          elevation: 0,
        })),
      });
    assert.equal(stripElevation(base), earlier);
    assert.deepEqual(generateWorld(seed).elevation, base.elevation);
  }
});

test('100 landscapes reserve level four for ranges, with coherent slopes and occasional accents', () => {
  const featureMaps = { canyon: 0, hill: 0, cliff: 0 };
  const levels = Array(5).fill(0);
  const islandLevels = Array(4).fill(0);
  let smoothEdges = 0,
    edges = 0,
    nearHeight = 0,
    nearCount = 0,
    farHeight = 0,
    farCount = 0,
    mountainWaterCliffs = 0;
  for (let seed = 0; seed < 100; seed++) {
    const world = generateWorld(String(seed));
    const byKey = new Map(world.cells.map((cell) => [cell.key, cell]));
    const water = world.cells.filter((cell) => cell.water);
    assert.equal(world.stages.elevation, true);
    assert.equal(world.scale.hexSpacingKm, 18);
    const peaks = world.cells.filter((cell) => cell.elevation === 4);
    assert.equal(components(peaks, byKey).length, world.elevation.ranges.length);
    for (const range of world.elevation.ranges) {
      const group = range.hexKeys.map((key) => byKey.get(key));
      assert.ok(group.length >= 4 && group.length <= 12);
      assert.equal(components(group, byKey).length, 1);
      assert.ok(group.every((cell) => cell.elevation === 4 && cell.mountainRangeId === range.id));
    }
    const kinds = new Set();
    for (const feature of world.elevation.features) {
      kinds.add(feature.kind);
      const group = feature.hexKeys.map((key) => byKey.get(key));
      const keys = new Set(feature.hexKeys);
      const rim = [...new Set(group.flatMap((cell) => neighbours(cell, byKey)))].filter(
        (cell) => !keys.has(cell.key),
      );
      assert.equal(components(group, byKey).length, 1);
      assert.ok(group.every((cell) => !cell.water && !cell.mountainRangeId));
      if (feature.kind === 'canyon') {
        assert.ok(group.length >= 4 && group.length <= 7);
        assert.ok(group.every((cell) => cell.elevation === 0));
        assert.ok(rim.every((cell) => !cell.water && cell.elevation >= 2));
        assert.deepEqual(new Set(feature.rimKeys), new Set(rim.map((cell) => cell.key)));
        const turns = new Set();
        for (let i = 1; i < group.length; i++) {
          turns.add(directionTo(group[i - 1], group[i]));
          for (let j = 0; j < i - 1; j++)
            assert.ok(distance(group[i], group[j]) > 1, 'Canyon remains one hex wide');
        }
        assert.ok(turns.size >= 2, 'Canyon bends');
      } else if (feature.kind === 'hill') {
        assert.ok(group.length >= 1 && group.length <= 3);
        const ground = Math.max(...rim.map((cell) => cell.elevation));
        assert.ok(group.every((cell) => cell.elevation >= ground + 2 && cell.elevation <= 3));
      } else {
        assert.ok(group.every((cell) => cell.elevation >= 2));
        assert.ok(group.every((cell) => neighbours(cell, byKey).some((next) => next.water)));
      }
    }
    for (const kind of kinds) featureMaps[kind]++;
    for (const cell of world.cells) {
      assert.ok(Number.isInteger(cell.elevation) && cell.elevation >= 0 && cell.elevation <= 4);
      levels[cell.elevation]++;
      if (cell.islandId) {
        assert.ok(cell.elevation <= 3 && !cell.mountainRangeId);
        islandLevels[cell.elevation]++;
        for (const next of neighbours(cell, byKey).filter(
          (next) => next.islandId === cell.islandId,
        ))
          assert.ok(Math.abs(cell.elevation - next.elevation) <= 1, 'Island slopes stay coherent');
      }
      assert.equal(!!cell.mountainRangeId, cell.elevation === 4);
      if (cell.water) assert.equal(cell.elevation, 0, 'Water surfaces stay continuous');
      else {
        const clearance = Math.min(...water.map((next) => distance(cell, next)));
        if (clearance === 1) {
          nearHeight += cell.elevation;
          nearCount++;
        }
        if (clearance >= 4) {
          farHeight += cell.elevation;
          farCount++;
        }
      }
      for (const next of neighbours(cell, byKey)) {
        edges++;
        if (Math.abs(cell.elevation - next.elevation) <= 1) smoothEdges++;
        if (cell.elevation === 4 && next.water) mountainWaterCliffs++;
      }
    }
  }
  assert.ok(levels.every((count) => count > 100));
  assert.ok(
    islandLevels.every((count) => count > 0),
    'Islands can use each of levels zero to three',
  );
  assert.ok(smoothEdges / edges > 0.9, 'Ordinary zero/one-step slopes dominate');
  assert.ok(farHeight / farCount > nearHeight / nearCount + 1, 'Relief rises away from water');
  assert.ok(mountainWaterCliffs > 0, 'Ranges can occasionally end in a four-level cliff');
  for (const count of Object.values(featureMaps))
    assert.ok(count >= 30 && count <= 90, 'Dramatic features are occasional, not universal');
});

test('render heights step gently and mountain bases match level three without changing the world', () => {
  const world = generateWorld('elevation');
  const before = JSON.stringify(world);
  const map = prepareMap(world, generateDressing(world));
  assert.equal(JSON.stringify(world), before);
  assert.ok(ELEVATION_STEP > 0 && ELEVATION_STEP <= 0.22);
  for (const cell of map) {
    if (cell.water) assert.equal(cell.top, 0.2);
    if (cell.water === 'river') assert.equal(cell.river.bankHeight, 0.14);
    assert.equal(!!cell.surface, cell.elevation === 4, 'Only mountain ranges receive ridge meshes');
    if (cell.water === 'river')
      assert.equal(cell.props.length, 0, 'River banks remain undisturbed');
  }
  const tops = Array.from(
    { length: 5 },
    (_, level) => map.find((cell) => !cell.water && cell.elevation === level).top,
  );
  for (let level = 1; level <= 3; level++)
    assert.ok(Math.abs(tops[level] - tops[level - 1] - ELEVATION_STEP) < 1e-9);
  assert.equal(tops[4], tops[3], 'Level four adds mountain props, not another terrain step');
});
